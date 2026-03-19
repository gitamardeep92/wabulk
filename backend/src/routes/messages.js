import express from 'express';
import { body, validationResult } from 'express-validator';
import supabase from '../lib/supabase.js';
import { requireApiKey, requireAuth } from '../middleware/auth.js';
import { checkPlanLimits, incrementUsage } from '../middleware/planLimits.js';
import { renderTemplate, extractVariables } from '../services/templateEngine.js';
import { enqueueCampaign } from '../workers/messageWorker.js';

const router = express.Router();

// Middleware that accepts EITHER a JWT token (dashboard) OR an API key (external)
async function requireAuthOrApiKey(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing authorization header' });
  }
  const token = authHeader.slice(7);
  // API keys start with wabk_
  if (token.startsWith('wabk_')) {
    return requireApiKey(req, res, next);
  }
  return requireAuth(req, res, next);
}

/**
 * POST /v1/messages/send
 * Main bulk send endpoint - used via API key
 */
router.post(
  '/send',
  requireAuthOrApiKey,
  checkPlanLimits,
  [
    body('template').isString().notEmpty(),
    body('messages').isArray({ min: 1, max: 1000 }),
    body('messages.*.to').matches(/^\+?[1-9]\d{6,14}$/),
    body('session_id').isUUID(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { template, messages, session_id, delay_ms = 3000, campaign_name } = req.body;
    const userId = req.user.id;

    // Verify session belongs to user and is connected
    const { data: session } = await supabase
      .from('wa_sessions')
      .select('id, status')
      .eq('id', session_id)
      .eq('user_id', userId)
      .single();

    if (!session) return res.status(404).json({ error: 'Session not found' });
    if (session.status !== 'connected') {
      return res.status(400).json({ error: `Session is ${session.status}, must be connected` });
    }

    // Check remaining quota
    const { data: limits } = await supabase
      .from('plan_limits')
      .select('monthly_messages')
      .eq('plan', req.user.plan)
      .single();

    const monthlyLimit = limits?.monthly_messages ?? 500;

    const month = new Date().toISOString().slice(0, 7);
    const { data: usage } = await supabase
      .from('usage')
      .select('messages_sent')
      .eq('user_id', userId)
      .eq('month', month)
      .maybeSingle();

    const sent = usage?.messages_sent || 0;
    let allowedCount = messages.length;

    if (monthlyLimit !== -1) {
      const remaining = monthlyLimit - sent;
      if (remaining <= 0) {
        return res.status(429).json({ error: 'Monthly limit reached. Upgrade your plan.' });
      }
      allowedCount = Math.min(messages.length, remaining);
    }

    // Create campaign
    const { data: campaign, error: campErr } = await supabase
      .from('campaigns')
      .insert({
        user_id: userId,
        session_id,
        name: campaign_name || `Campaign ${new Date().toLocaleDateString()}`,
        status: 'queued',
        total_recipients: allowedCount,
        delay_ms,
      })
      .select()
      .single();

    if (campErr) return res.status(500).json({ error: campErr.message });

    // Render and insert messages
    const messagesToInsert = messages.slice(0, allowedCount).map((msg) => ({
      campaign_id: campaign.id,
      user_id: userId,
      to_number: msg.to.startsWith('+') ? msg.to : '+' + msg.to,
      rendered_body: renderTemplate(template, msg.vars || {}),
      variables: msg.vars || {},
      status: 'queued',
    }));

    const { data: insertedMessages, error: msgErr } = await supabase
      .from('messages')
      .insert(messagesToInsert)
      .select('id, to_number, rendered_body');

    if (msgErr) return res.status(500).json({ error: msgErr.message });

    // Enqueue to BullMQ
    await enqueueCampaign(campaign, insertedMessages);

    // Update campaign to sending
    await supabase
      .from('campaigns')
      .update({ status: 'sending', started_at: new Date().toISOString() })
      .eq('id', campaign.id);

    // Increment usage counter
    await incrementUsage(userId, allowedCount);

    res.status(202).json({
      campaign_id: campaign.id,
      queued: allowedCount,
      skipped: messages.length - allowedCount,
      message: `${allowedCount} messages queued successfully`,
    });
  }
);

/**
 * GET /v1/messages/campaigns - list campaigns (dashboard)
 */
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

/**
 * GET /v1/messages/campaigns/:id - campaign details with messages
 */
router.get('/campaigns/:id', requireAuth, async (req, res) => {
  const { data: campaign } = await supabase
    .from('campaigns')
    .select('*')
    .eq('id', req.params.id)
    .eq('user_id', req.user.id)
    .single();

  if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

  const { data: messages } = await supabase
    .from('messages')
    .select('id, to_number, status, sent_at, delivered_at, failed_at, error_message')
    .eq('campaign_id', campaign.id)
    .order('queued_at', { ascending: true });

  res.json({ campaign, messages: messages || [] });
});

/**
 * GET /v1/messages/stats - usage stats for dashboard
 */
router.get('/stats', requireAuth, async (req, res) => {
  const month = new Date().toISOString().slice(0, 7);

  const { data: usage } = await supabase
    .from('usage')
    .select('messages_sent')
    .eq('user_id', req.user.id)
    .eq('month', month)
    .single();

  const { data: limits } = await supabase
    .from('plan_limits')
    .select('monthly_messages')
    .eq('plan', req.user.plan)
    .single();

  const { count: totalCampaigns } = await supabase
    .from('campaigns')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', req.user.id);

  const { data: recentStats } = await supabase
    .from('campaigns')
    .select('sent_count, delivered_count, failed_count')
    .eq('user_id', req.user.id)
    .gte('created_at', new Date(Date.now() - 30 * 86400000).toISOString());

  const totals = (recentStats || []).reduce(
    (acc, c) => ({
      sent: acc.sent + (c.sent_count || 0),
      delivered: acc.delivered + (c.delivered_count || 0),
      failed: acc.failed + (c.failed_count || 0),
    }),
    { sent: 0, delivered: 0, failed: 0 }
  );

  res.json({
    month_usage: usage?.messages_sent || 0,
    month_limit: limits?.monthly_messages || 500,
    total_campaigns: totalCampaigns || 0,
    last_30_days: totals,
  });
});

export default router;
