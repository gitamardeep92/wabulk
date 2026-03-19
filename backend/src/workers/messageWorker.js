/**
 * messageWorker.js — Simple queue processor using Supabase polling
 *
 * No Redis, no BullMQ. Instead:
 * - Messages are stored in Supabase with status='queued'
 * - A setInterval polls every 2s for queued messages
 * - Sends them one by one with the configured delay
 * - This works perfectly on Render free tier with zero extra services
 */

import supabase from '../lib/supabase.js';
import { sendMessage, createSession, getSessionStatus } from '../services/sessionManager.js';

let isProcessing = false;
let workerInterval = null;

// Auto-restore session if not in memory
async function ensureSession(sessionId) {
  if (getSessionStatus(sessionId) === 'in_memory') return;

  console.log(`[Worker] Restoring session ${sessionId}...`);

  const { data: session } = await supabase
    .from('wa_sessions')
    .select('id, user_id, status')
    .eq('id', sessionId)
    .single();

  if (!session || session.status !== 'connected') {
    throw new Error(`Session ${sessionId} not connected (status: ${session?.status})`);
  }

  await createSession(session.id, session.user_id);

  // Wait up to 20s for socket to come online
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    if (getSessionStatus(sessionId) === 'in_memory') {
      console.log(`[Worker] Session restored after ${i + 1}s`);
      return;
    }
  }

  throw new Error(`Session ${sessionId} failed to restore`);
}

// Process one queued message
async function processNext() {
  if (isProcessing) return;
  isProcessing = true;

  try {
    // Grab the oldest queued message
    const { data: messages } = await supabase
      .from('messages')
      .select('id, campaign_id, to_number, rendered_body, variables')
      .eq('status', 'queued')
      .order('queued_at', { ascending: true })
      .limit(1);

    if (!messages?.length) {
      isProcessing = false;
      return;
    }

    const msg = messages[0];

    // Get the campaign to find session_id and delay
    const { data: campaign } = await supabase
      .from('campaigns')
      .select('id, session_id, delay_ms, status')
      .eq('id', msg.campaign_id)
      .single();

    if (!campaign) {
      // Campaign deleted — mark message failed
      await supabase.from('messages').update({ status: 'failed', error_message: 'Campaign not found' }).eq('id', msg.id);
      isProcessing = false;
      return;
    }

    if (campaign.status === 'cancelled') {
      await supabase.from('messages').update({ status: 'failed', error_message: 'Campaign cancelled' }).eq('id', msg.id);
      isProcessing = false;
      return;
    }

    // Mark as sending
    await supabase
      .from('messages')
      .update({ status: 'sending', sent_at: new Date().toISOString() })
      .eq('id', msg.id);

    console.log(`[Worker] Sending to ${msg.to_number}...`);

    try {
      await ensureSession(campaign.session_id);
      const waId = await sendMessage(campaign.session_id, msg.to_number, msg.rendered_body);

      await supabase
        .from('messages')
        .update({ status: 'sent', wa_message_id: waId, sent_at: new Date().toISOString() })
        .eq('id', msg.id);

      await supabase.rpc('increment_campaign_sent', { campaign_id: campaign.id });
      console.log(`[Worker] ✓ Sent to ${msg.to_number}`);

      // Check if campaign is complete
      const { count } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('campaign_id', campaign.id)
        .eq('status', 'queued');

      if (count === 0) {
        await supabase
          .from('campaigns')
          .update({ status: 'completed', completed_at: new Date().toISOString() })
          .eq('id', campaign.id);
        console.log(`[Worker] Campaign ${campaign.id} completed`);
      }

      // Respect delay between messages
      await new Promise((r) => setTimeout(r, campaign.delay_ms || 3000));

    } catch (err) {
      console.error(`[Worker] ✗ Failed to send to ${msg.to_number}:`, err.message);
      await supabase
        .from('messages')
        .update({ status: 'failed', error_message: err.message, failed_at: new Date().toISOString() })
        .eq('id', msg.id);
      await supabase.rpc('increment_campaign_failed', { campaign_id: campaign.id });
    }

  } catch (err) {
    console.error('[Worker] Unexpected error:', err.message);
  }

  isProcessing = false;
}

export function startWorker() {
  console.log('[Worker] Starting Supabase-based message worker (no Redis needed)');
  // Poll every 2 seconds for new messages
  workerInterval = setInterval(processNext, 2000);
  return { workerInterval };
}

export function stopWorker() {
  if (workerInterval) clearInterval(workerInterval);
}

// Keep this for compatibility — adds messages directly to Supabase
// (they're already inserted by the send route, this is a no-op now)
export async function enqueueCampaign(campaign, messages) {
  console.log(`[Worker] ${messages.length} messages queued for campaign ${campaign.id}`);
  // Messages already inserted with status='queued' by the send route
  // Worker will pick them up automatically via polling
}
