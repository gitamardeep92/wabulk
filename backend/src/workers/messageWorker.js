import { Worker, Queue } from 'bullmq';
import redis from '../lib/redis.js';
import supabase from '../lib/supabase.js';
import { sendMessage } from '../services/sessionManager.js';

export const messageQueue = new Queue('messages', { connection: redis });

export function startWorker() {
  const worker = new Worker(
    'messages',
    async (job) => {
      const { messageId, sessionId, toNumber, body, campaignId } = job.data;

      console.log(`[Worker] Processing message ${messageId} to ${toNumber}`);

      // Mark as sending
      await supabase
        .from('messages')
        .update({ status: 'sending', sent_at: new Date().toISOString() })
        .eq('id', messageId);

      try {
        const waMessageId = await sendMessage(sessionId, toNumber, body);

        // Mark as sent
        await supabase
          .from('messages')
          .update({
            status: 'sent',
            wa_message_id: waMessageId,
            sent_at: new Date().toISOString(),
          })
          .eq('id', messageId);

        // Increment campaign sent_count
        await supabase.rpc('increment_campaign_sent', { campaign_id: campaignId });

        console.log(`[Worker] Sent message ${messageId}`);
      } catch (err) {
        console.error(`[Worker] Failed message ${messageId}:`, err.message);

        await supabase
          .from('messages')
          .update({
            status: 'failed',
            error_message: err.message,
            failed_at: new Date().toISOString(),
          })
          .eq('id', messageId);

        await supabase.rpc('increment_campaign_failed', { campaign_id: campaignId });

        throw err; // BullMQ will retry based on job options
      }
    },
    {
      connection: redis,
      concurrency: 1, // Process ONE at a time to respect delays
      limiter: { max: 1, duration: 100 },
    }
  );

  worker.on('completed', (job) => {
    console.log(`[Worker] Job ${job.id} completed`);
  });

  worker.on('failed', (job, err) => {
    console.error(`[Worker] Job ${job?.id} failed:`, err.message);
  });

  console.log('[Worker] Message worker started');
  return worker;
}

/**
 * Enqueue a campaign's messages with delay between each
 */
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
