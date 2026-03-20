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

// POST /sessions - create new session
router.post('/', requireAuth, async (req, res) => {
  console.log(`[Sessions] Creating session for user ${req.user.id} (plan: ${req.user.plan})`);

  try {
    // Get plan limits
    const { data: limits } = await supabase
      .from('plan_limits')
      .select('max_sessions')
      .eq('plan', req.user.plan)
      .maybeSingle();

    const maxSessions = limits?.max_sessions ?? 1;

    // Count ONLY connected sessions (not pending/disconnected)
    // Pending sessions are stale and should not block new ones
    const { count } = await supabase
      .from('wa_sessions')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', req.user.id)
      .eq('status', 'connected');

    console.log(`[Sessions] Connected: ${count}, Max allowed: ${maxSessions}`);

    if (count >= maxSessions) {
      return res.status(403).json({
        error: `Your ${req.user.plan} plan allows max ${maxSessions} connected number(s). Disconnect an existing number first.`,
      });
    }

    // Clean up any old stuck pending sessions for this user before creating new one
    await supabase
      .from('wa_sessions')
      .delete()
      .eq('user_id', req.user.id)
      .eq('status', 'pending');

    // Create new session record
    const { data: session, error: insertError } = await supabase
      .from('wa_sessions')
      .insert({ user_id: req.user.id, status: 'pending' })
      .select()
      .single();

    if (insertError) {
      console.error('[Sessions] DB insert error:', insertError.message);
      return res.status(500).json({ error: insertError.message });
    }

    console.log(`[Sessions] Created session ${session.id} — launching Baileys...`);

    // Start in background
    createSession(session.id, req.user.id).catch((err) => {
      console.error(`[Sessions] createSession failed for ${session.id}:`, err.message);
    });

    res.status(201).json({ session_id: session.id, status: 'initializing' });

  } catch (err) {
    console.error('[Sessions] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /sessions/:id/qr
router.get('/:id/qr', requireAuth, async (req, res) => {
  const { data, error } = await supabase
    .from('wa_sessions')
    .select('id, status, qr_code, phone_number, display_name')
    .eq('id', req.params.id)
    .eq('user_id', req.user.id)
    .maybeSingle();

  if (error || !data) return res.status(404).json({ error: 'Session not found' });
  res.json(data);
});

// DELETE /sessions/:id — fully delete the session
router.delete('/:id', requireAuth, async (req, res) => {
  const { data: session } = await supabase
    .from('wa_sessions')
    .select('id, status')
    .eq('id', req.params.id)
    .eq('user_id', req.user.id)
    .maybeSingle();

  if (!session) return res.status(404).json({ error: 'Session not found' });

  // Try to gracefully disconnect Baileys socket — don't fail if not in memory
  try {
    await disconnectSession(req.params.id);
  } catch (err) {
    console.warn(`[Sessions] Could not gracefully disconnect ${req.params.id}:`, err.message);
    // Continue anyway — we still want to delete from DB
  }

  // Nullify session_id on any campaigns referencing this session
  // (so we can delete the session even if campaigns exist)
  await supabase
    .from('campaigns')
    .update({ session_id: null })
    .eq('session_id', req.params.id);

  // Hard delete from DB
  const { error: deleteError } = await supabase
    .from('wa_sessions')
    .delete()
    .eq('id', req.params.id)
    .eq('user_id', req.user.id);

  if (deleteError) {
    console.error('[Sessions] Delete error:', deleteError.message);
    return res.status(500).json({ error: deleteError.message });
  }

  console.log(`[Sessions] Deleted session ${req.params.id}`);
  res.json({ success: true });
});

export default router;
