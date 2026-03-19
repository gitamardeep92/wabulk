import express from 'express';
import supabase from '../lib/supabase.js';
import { requireAuth } from '../middleware/auth.js';
import { createSession, disconnectSession } from '../services/sessionManager.js';

const router = express.Router();

// GET /sessions - list all sessions for user
router.get('/', requireAuth, async (req, res) => {
  const { data } = await supabase
    .from('wa_sessions')
    .select('id, phone_number, display_name, status, connected_at, created_at')
    .eq('user_id', req.user.id)
    .order('created_at', { ascending: false });

  res.json({ sessions: data || [] });
});

// POST /sessions - create new session (initiate QR)
router.post('/', requireAuth, async (req, res) => {
  // Check plan session limit
  const { data: limits } = await supabase
    .from('plan_limits')
    .select('max_sessions')
    .eq('plan', req.user.plan)
    .single();

  const { count } = await supabase
    .from('wa_sessions')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', req.user.id)
    .neq('status', 'disconnected');

  if (count >= limits.max_sessions) {
    return res.status(403).json({
      error: `Your ${req.user.plan} plan allows max ${limits.max_sessions} WhatsApp number(s)`,
    });
  }

  const { data: session, error } = await supabase
    .from('wa_sessions')
    .insert({ user_id: req.user.id, status: 'pending' })
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });

  // Start WA client async
  createSession(session.id, req.user.id).catch(console.error);

  res.status(201).json({ session_id: session.id, status: 'initializing' });
});

// GET /sessions/:id/qr - poll for QR code
router.get('/:id/qr', requireAuth, async (req, res) => {
  const { data } = await supabase
    .from('wa_sessions')
    .select('id, status, qr_code, phone_number, display_name')
    .eq('id', req.params.id)
    .eq('user_id', req.user.id)
    .single();

  if (!data) return res.status(404).json({ error: 'Session not found' });
  res.json(data);
});

// DELETE /sessions/:id - disconnect
router.delete('/:id', requireAuth, async (req, res) => {
  const { data: session } = await supabase
    .from('wa_sessions')
    .select('id')
    .eq('id', req.params.id)
    .eq('user_id', req.user.id)
    .single();

  if (!session) return res.status(404).json({ error: 'Session not found' });

  await disconnectSession(req.params.id);
  await supabase
    .from('wa_sessions')
    .update({ status: 'disconnected', updated_at: new Date().toISOString() })
    .eq('id', req.params.id);

  res.json({ success: true });
});

export default router;
