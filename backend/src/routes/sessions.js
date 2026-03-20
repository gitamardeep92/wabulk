import express from 'express';
import supabase from '../lib/supabase.js';
import { requireAuth } from '../middleware/auth.js';
import { createSession, disconnectSession } from '../services/sessionManager.js';

const router = express.Router();

// GET /sessions - list all sessions for user
router.get('/', requireAuth, async (req, res) => {
  const { data, error } = await supabase
    .from('wa_sessions')
    .select('id, phone_number, display_name, status, connected_at, created_at')
    .eq('user_id', req.user.id)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[Sessions] GET error:', error.message);
    return res.status(500).json({ error: error.message });
  }

  res.json({ sessions: data || [] });
});

// POST /sessions - create new session (initiate QR)
router.post('/', requireAuth, async (req, res) => {
  console.log(`[Sessions] Creating session for user ${req.user.id} (plan: ${req.user.plan})`);

  try {
    // Get plan limits — default to 1 if lookup fails
    const { data: limits } = await supabase
      .from('plan_limits')
      .select('max_sessions')
      .eq('plan', req.user.plan)
      .single();

    const maxSessions = limits?.max_sessions ?? 1;
    console.log(`[Sessions] Plan limit: ${maxSessions} sessions`);

    // Count existing active sessions
    const { count } = await supabase
      .from('wa_sessions')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', req.user.id)
      .neq('status', 'disconnected');

    console.log(`[Sessions] Existing active sessions: ${count}`);

    if (count >= maxSessions) {
      return res.status(403).json({
        error: `Your ${req.user.plan} plan allows max ${maxSessions} WhatsApp number(s). Disconnect an existing number first.`,
      });
    }

    // Create session record in DB
    const { data: session, error: insertError } = await supabase
      .from('wa_sessions')
      .insert({ user_id: req.user.id, status: 'pending' })
      .select()
      .single();

    if (insertError) {
      console.error('[Sessions] DB insert error:', insertError.message);
      return res.status(500).json({ error: insertError.message });
    }

    console.log(`[Sessions] Created DB record: ${session.id} — launching WA client...`);

    // Start WA client in background — respond to user immediately
    createSession(session.id, req.user.id).catch((err) => {
      console.error(`[Sessions] createSession failed for ${session.id}:`, err.message);
      console.error(err.stack);
    });

    res.status(201).json({ session_id: session.id, status: 'initializing' });

  } catch (err) {
    console.error('[Sessions] Unexpected error:', err.message);
    console.error(err.stack);
    res.status(500).json({ error: err.message });
  }
});

// GET /sessions/:id/qr - poll for QR code
router.get('/:id/qr', requireAuth, async (req, res) => {
  const { data, error } = await supabase
    .from('wa_sessions')
    .select('id, status, qr_code, phone_number, display_name')
    .eq('id', req.params.id)
    .eq('user_id', req.user.id)
    .single();

  if (error || !data) {
    return res.status(404).json({ error: 'Session not found' });
  }

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
