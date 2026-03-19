import express from 'express';
import supabase from '../lib/supabase.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

// GET /webhooks
router.get('/', requireAuth, async (req, res) => {
  const { data } = await supabase
    .from('webhooks')
    .select('id, url, events, is_active, created_at')
    .eq('user_id', req.user.id)
    .order('created_at', { ascending: false });
  res.json({ webhooks: data || [] });
});

// POST /webhooks
router.post('/', requireAuth, async (req, res) => {
  const { url, events } = req.body;
  if (!url) return res.status(400).json({ error: 'url is required' });

  // Upsert: one webhook per user for now
  const { data: existing } = await supabase
    .from('webhooks')
    .select('id')
    .eq('user_id', req.user.id)
    .single();

  let result;
  if (existing) {
    const { data } = await supabase
      .from('webhooks')
      .update({ url, events: events || ['delivered', 'failed'], is_active: true })
      .eq('id', existing.id)
      .select()
      .single();
    result = data;
  } else {
    const { data } = await supabase
      .from('webhooks')
      .insert({ user_id: req.user.id, url, events: events || ['delivered', 'failed'] })
      .select()
      .single();
    result = data;
  }

  res.json({ webhook: result });
});

// DELETE /webhooks/:id
router.delete('/:id', requireAuth, async (req, res) => {
  await supabase
    .from('webhooks')
    .update({ is_active: false })
    .eq('id', req.params.id)
    .eq('user_id', req.user.id);
  res.json({ success: true });
});

// Internal: fire webhook for message status change
export async function fireWebhook(userId, payload) {
  const { data: webhook } = await supabase
    .from('webhooks')
    .select('url, events')
    .eq('user_id', userId)
    .eq('is_active', true)
    .single();

  if (!webhook) return;
  if (!webhook.events.includes(payload.status)) return;

  try {
    await fetch(webhook.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(5000),
    });
  } catch (err) {
    console.error('[Webhook] Delivery failed:', err.message);
  }
}

export default router;
