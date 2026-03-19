import { Worker, Queue } from 'bullmq';
import { createRedisConnection } from '../lib/redis.js';
import supabase from '../lib/supabase.js';
import { sendMessage, createSession, getSessionStatus } from '../services/sessionManager.js';

// BullMQ requires separate dedicated connections — not shared with app
const queueConnection = createRedisConnection();
const workerConnection = createRedisConnection();

export const messageQueue = new Queue('messages', { connection: queueConnection });

// Auto-restore a session if it's not in memory but DB says connected
async function ensureSessionInMemory(sessionId) {
  if (getSessionStatus(sessionId) === 'in_memory') return true;

  console.log(`[Worker] Session ${sessionId} not in memory, attempting restore...`);

  const { data: session } = await supabase
    .from('wa_sessions')
    .select('id, user_id, status')
    .eq('id', sessionId)
    .single();

  if (!session || session.status !== 'connected') {
    throw new Error(`Session ${sessionId} is not connected (status: ${session?.status})`);
  }

  // Restore from Supabase auth data
  await createSession(session.id, session.user_id);

  // Wait up to 15 seconds for socket to be ready
  for (let i = 0; i < 15; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    if (getSessionStatus(sessionId) === 'in_memory') {
      console.log(`[Worker] Session ${sessionId} restored after ${i + 1}s`);
      return true;
    }
  }

  throw new Error(`Session ${sessionId} failed to restore after 15s`);
}

export function startWorker() {
  const worker = new Worker(
    'messages',
    async (job) => {
      const { messageId, sessionId, toNumber, body, campaignId } = job.data;

      console.log(`[Worker] Processing message ${messageId} to ${toNumber}`);

      // Ensure session is active before sending
      await ensureSessionInMemory(sessionId);

      // Mark as sending
      await supabase
        .from('messages')
        .update({ status: 'sending', sent_at: new Date().toISOString() })
        .eq('id', messageId);

      try {
        const waMessageId = await sendMessage(sessionId, toNumber, body);

        await supabase
          .from('messages')
          .update({
            status: 'sent',
            wa_message_id: waMessageId,
            sent_at: new Date().toISOString(),
          })
          .eq('id', messageId);

        await supabase.rpc('increment_campaign_sent', { campaign_id: campaignId });
        console.log(`[Worker] ✓ Sent message ${messageId} to ${toNumber}`);

      } catch (err) {
        console.error(`[Worker] ✗ Failed message ${messageId}:`, err.message);

        await supabase
          .from('messages')
          .update({
            status: 'failed',
            error_message: err.message,
            failed_at: new Date().toISOString(),
          })
          .eq('id', messageId);

        await supabase.rpc('increment_campaign_failed', { campaign_id: campaignId });
        throw err;
      }
    },
    {
      connection: workerConnection,
      concurrency: 1,
      limiter: { max: 1, duration: 100 },
    }
  );

  worker.on('completed', (job) => {
    console.log(`[Worker] Job ${job.id} completed`);
  });

  worker.on('failed', (job, err) => {
    console.error(`[Worker] Job ${job?.id} failed:`, err.message);
  });

  worker.on('error', (err) => {
    console.error('[Worker] Worker error:', err.message);
  });

  console.log('[Worker] Message worker started');
  return worker;
}

export async function enqueueCampaign(campaign, messages) {
  const jobs = messages.map((msg, index) => ({
    name: 'send-message',
    data: {
      messageId: msg.id,
      sessionId: campaign.session_id,
      toNumber: msg.to_number,
      body: msg.rendered_body,
      campaignId: campaign.id,
    },
    opts: {
      delay: index * (campaign.delay_ms || 3000),
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
      removeOnComplete: { count: 100 },
      removeOnFail: { count: 50 },
    },
  }));

  await messageQueue.addBulk(jobs);
  console.log(`[Queue] Enqueued ${jobs.length} messages for campaign ${campaign.id}`);
}
