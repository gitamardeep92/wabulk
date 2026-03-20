import express from 'express';
import { body, validationResult } from 'express-validator';
import supabase from '../lib/supabase.js';
import { requireApiKey, requireAuth } from '../middleware/auth.js';
import { checkPlanLimits, incrementUsage } from '../middleware/planLimits.js';
import { renderTemplate } from '../services/templateEngine.js';
import { enqueueCampaign } from '../workers/messageWorker.js';

const router = express.Router();

// Accept either JWT (dashboard) or API key (external integrations)
async function requireAuthOrApiKey(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing authorization header' });
  }
  const token = authHeader.slice(7);
  if (token.startsWith('wabk_')) return requireApiKey(req, res, next);
  return requireAuth(req, res, next);
}

// POST /v1/messages/send
router.post('/send', requireAuthOrApiKey, checkPlanLimits, [
  body('template').isString().notEmpty(),
  body('messages').isArray({ min: 1, max: 1000 }),
  body('session_id').isUUID(),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { template, messages, session_id, delay_ms = 3000, campaign_name } = req.body;
  const userId = req.user.id;

  // Verify session belongs to user and is connected
  const { data: session } = await supabase
    .from('wa_sessions').select('id, status')
    .eq('id', session_id).eq('user_id', userId).maybeSingle();

  if (!session) return res.status(404).json({ error: 'Session not found' });
  if (session.status !== 'connected') {
    return res.status(400).json({ error: `Session is ${session.status}. Connect your WhatsApp number first.` });
  }

  // Check quota
  const { data: limits } = await supabase
    .from('plan_limits').select('monthly_messages').eq('plan', req.user.plan).maybeSingle();
  const monthlyLimit = limits?.monthly_messages ?? 500;

  const month = new Date().toISOString().slice(0, 7);
  const { data: usage } = await supabase
    .from('usage').select('messages_sent')
    .eq('user_id', userId).eq('month', month).maybeSingle();

  const sent = usage?.messages_sent || 0;
  let allowedCount = messages.length;

  if (monthlyLimit !== -1) {
    const remaining = monthlyLimit - sent;
    if (remaining <= 0) return res.status(429).json({ error: 'Monthly limit reached. Upgrade your plan.' });
    allowedCount = Math.min(messages.length, remaining);
  }

  // Create campaign
  const { data: campaign, error: campErr } = await supabase
    .from('campaigns')
    .insert({
      user_id: userId, session_id,
      name: campaign_name || `Campaign ${new Date().toLocaleDateString('en-IN')}`,
      status: 'queued', total_recipients: allowedCount, delay_ms,
    })
    .select().single();

  if (campErr) return res.status(500).json({ error: campErr.message });

  // Insert messages
  const messagesToInsert = messages.slice(0, allowedCount).map(msg => ({
    campaign_id: campaign.id, user_id: userId,
    to_number: msg.to?.startsWith('+') ? msg.to : '+' + msg.to,
    rendered_body: renderTemplate(template, msg.vars || {}),
    variables: msg.vars || {}, status: 'queued',
  }));

  const { data: insertedMessages, error: msgErr } = await supabase
    .from('messages').insert(messagesToInsert).select('id, to_number, rendered_body');

  if (msgErr) return res.status(500).json({ error: msgErr.message });

  await enqueueCampaign(campaign, insertedMessages);

  await supabase.from('campaigns')
    .update({ status: 'sending', started_at: new Date().toISOString() })
    .eq('id', campaign.id);

  await incrementUsage(userId, allowedCount);

  res.status(202).json({
    campaign_id: campaign.id, queued: allowedCount,
    skipped: messages.length - allowedCount,
    message: `${allowedCount} messages queued successfully`,
  });
});

// GET /v1/messages/campaigns
router.get('/campaigns', requireAuth, async (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  const offset = (page - 1) * limit;

  const { data, count } = await supabase
    .from('campaigns')
    .select('*, wa_sessions(phone_number)', { count: 'exact' })
    .eq('user_id', req.user.id)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  res.json({ campaigns: data || [], total: count, page: +page, limit: +limit });
});

// GET /v1/messages/campaigns/:id
router.get('/campaigns/:id', requireAuth, async (req, res) => {
  const { data: campaign } = await supabase
    .from('campaigns').select('*')
    .eq('id', req.params.id).eq('user_id', req.user.id).single();

  if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

  const { data: messages } = await supabase
    .from('messages')
    .select('id, to_number, rendered_body, status, sent_at, delivered_at, failed_at, error_message')
    .eq('campaign_id', campaign.id)
    .order('queued_at', { ascending: true });

  res.json({ campaign, messages: messages || [] });
});

// DELETE /v1/messages/campaigns/:id — cancel campaign
router.delete('/campaigns/:id', requireAuth, async (req, res) => {
  const { data: campaign } = await supabase
    .from('campaigns').select('id, status')
    .eq('id', req.params.id).eq('user_id', req.user.id).maybeSingle();

  if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

  if (['completed', 'cancelled'].includes(campaign.status)) {
    return res.status(400).json({ error: `Campaign is already ${campaign.status}` });
  }

  // Cancel queued messages
  await supabase.from('messages')
    .update({ status: 'failed', error_message: 'Cancelled by user' })
    .eq('campaign_id', req.params.id)
    .in('status', ['queued', 'pending']);

  await supabase.from('campaigns')
    .update({ status: 'cancelled', completed_at: new Date().toISOString() })
    .eq('id', req.params.id);

  res.json({ success: true });
});

// GET /v1/messages/stats
router.get('/stats', requireAuth, async (req, res) => {
  const month = new Date().toISOString().slice(0, 7);
  const userId = req.user.id;

  // Use maybeSingle to avoid errors when no row exists
  const [usageRes, limitsRes, campaignsCountRes, messagesRes] = await Promise.all([
    supabase.from('usage').select('messages_sent').eq('user_id', userId).eq('month', month).maybeSingle(),
    supabase.from('plan_limits').select('monthly_messages').eq('plan', req.user.plan).maybeSingle(),
    supabase.from('campaigns').select('*', { count: 'exact', head: true }).eq('user_id', userId),
    // Get actual message counts from messages table (more accurate than campaign counters)
    supabase.from('messages')
      .select('status')
      .eq('user_id', userId)
      .gte('queued_at', new Date(Date.now() - 30 * 86400000).toISOString()),
  ]);

  const monthUsage = usageRes.data?.messages_sent || 0;
  const monthLimit = limitsRes.data?.monthly_messages ?? 500;
  const totalCampaigns = campaignsCountRes.count || 0;

  // Count from actual messages table for accuracy
  const msgs = messagesRes.data || [];
  const totals = msgs.reduce((acc, m) => {
    acc.sent++;
    if (m.status === 'delivered') acc.delivered++;
    if (m.status === 'failed') acc.failed++;
    return acc;
  }, { sent: 0, delivered: 0, failed: 0 });

  res.json({
    month_usage: monthUsage,
    month_limit: monthLimit,
    total_campaigns: totalCampaigns,
    last_30_days: totals,
  });
});

export default router;
