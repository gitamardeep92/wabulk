import express from 'express';
import supabase from '../lib/supabase.js';
import { requireAuth } from '../middleware/auth.js';
import { createSession, disconnectSession } from '../services/sessionManager.js';

const router = express.Router();

// GET /sessions
router.get('/', requireAuth, async (req, res) => {
  const { data, error } = await supabase
    .from('wa_sessions')
    .select('id, phone_number, display_name, status, connected_at, created_at')
    .eq('user_id', req.user.id)
    .order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json({ sessions: data || [] });
});

// POST /sessions
router.post('/', requireAuth, async (req, res) => {
  console.log(`[Sessions] Creating session for user ${req.user.id} (plan: ${req.user.plan})`);
  try {
    // Always re-fetch plan from DB — JWT may be stale
    const { data: freshUser } = await supabase
      .from('users').select('plan').eq('id', req.user.id).single();
    const plan = freshUser?.plan || req.user.plan || 'free';

    const { data: limits } = await supabase
      .from('plan_limits').select('max_sessions').eq('plan', plan).maybeSingle();
    const maxSessions = limits?.max_sessions ?? 1;

    const { count } = await supabase
      .from('wa_sessions').select('*', { count: 'exact', head: true })
      .eq('user_id', req.user.id).eq('status', 'connected');

    console.log(`[Sessions] Connected: ${count}, Max: ${maxSessions}, Plan: ${plan}`);

    if (count >= maxSessions) {
      return res.status(403).json({
        error: `Your ${plan} plan allows max ${maxSessions} connected number(s). Disconnect an existing number first.`,
      });
    }

    // Clean up old stuck pending sessions
    await supabase.from('wa_sessions').delete()
      .eq('user_id', req.user.id).eq('status', 'pending');

    const { data: session, error: insertError } = await supabase
      .from('wa_sessions').insert({ user_id: req.user.id, status: 'pending' })
      .select().single();

    if (insertError) return res.status(500).json({ error: insertError.message });

    console.log(`[Sessions] Created ${session.id} — launching Baileys...`);
    createSession(session.id, req.user.id).catch(err => {
      console.error(`[Sessions] createSession failed:`, err.message);
    });

    res.status(201).json({ session_id: session.id, status: 'initializing' });
  } catch (err) {
    console.error('[Sessions] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /sessions/:id/connect-phone — connect via phone number pairing code
router.post('/:id/connect-phone', requireAuth, async (req, res) => {
  const { phone_number } = req.body;
  if (!phone_number) return res.status(400).json({ error: 'phone_number required' });

  const { data: session } = await supabase
    .from('wa_sessions').select('id, status')
    .eq('id', req.params.id).eq('user_id', req.user.id).maybeSingle();

  if (!session) return res.status(404).json({ error: 'Session not found' });

  try {
    const { requestPairingCode } = await import('../services/sessionManager.js');
    const code = await requestPairingCode(req.params.id, phone_number);
    res.json({ pairing_code: code });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /sessions/:id/qr
router.get('/:id/qr', requireAuth, async (req, res) => {
  const { data, error } = await supabase
    .from('wa_sessions').select('id, status, qr_code, phone_number, display_name')
    .eq('id', req.params.id).eq('user_id', req.user.id).maybeSingle();
  if (error || !data) return res.status(404).json({ error: 'Session not found' });
  res.json(data);
});

// DELETE /sessions/:id
router.delete('/:id', requireAuth, async (req, res) => {
  const { data: session } = await supabase
    .from('wa_sessions').select('id, status')
    .eq('id', req.params.id).eq('user_id', req.user.id).maybeSingle();
  if (!session) return res.status(404).json({ error: 'Session not found' });

  try { await disconnectSession(req.params.id); } catch (err) {
    console.warn(`[Sessions] Disconnect error:`, err.message);
  }

  await supabase.from('campaigns').update({ session_id: null }).eq('session_id', req.params.id);

  const { error: deleteError } = await supabase.from('wa_sessions')
    .delete().eq('id', req.params.id).eq('user_id', req.user.id);

  if (deleteError) return res.status(500).json({ error: deleteError.message });
  res.json({ success: true });
});

export default router;
