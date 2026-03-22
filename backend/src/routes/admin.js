import express from 'express';
import supabase from '../lib/supabase.js';
import { requireAdmin } from '../middleware/auth.js';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

const router = express.Router();

// Admin login (separate from user login)
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPass = process.env.ADMIN_PASSWORD_HASH;

  if (email !== adminEmail) return res.status(401).json({ error: 'Invalid credentials' });
  const valid = await bcrypt.compare(password, adminPass);
  if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

  const token = jwt.sign({ email, isAdmin: true }, process.env.JWT_SECRET, { expiresIn: '24h' });
  res.json({ token });
});

// GET /admin/stats - platform overview
router.get('/stats', requireAdmin, async (req, res) => {
  const month = new Date().toISOString().slice(0, 7);
  const monthStart = `${month}-01`;

  const [totalUsersRes, activeUsersRes, sessionsRes, campaignRes, monthMsgsRes, totalMsgsRes] =
    await Promise.all([
      supabase.from('users').select('*', { count: 'exact', head: true }),
      supabase.from('users').select('*', { count: 'exact', head: true }).gte('created_at', new Date(Date.now() - 30 * 86400000).toISOString()),
      supabase.from('wa_sessions').select('*', { count: 'exact', head: true }).eq('status', 'connected'),
      supabase.from('campaigns').select('status').gte('created_at', new Date(Date.now() - 30 * 86400000).toISOString()),
      // Messages sent this month
      supabase.from('messages').select('*', { count: 'exact', head: true })
        .gte('queued_at', monthStart).not('status', 'eq', 'queued'),
      // Total messages all time
      supabase.from('messages').select('*', { count: 'exact', head: true })
        .not('status', 'eq', 'queued'),
    ]);

  const campaignsByStatus = (campaignRes.data || []).reduce((acc, c) => {
    acc[c.status] = (acc[c.status] || 0) + 1;
    return acc;
  }, {});

  res.json({
    totalUsers: totalUsersRes.count || 0,
    activeUsers: activeUsersRes.count || 0,
    connectedSessions: sessionsRes.count || 0,
    totalMessages: totalMsgsRes.count || 0,
    monthMessages: monthMsgsRes.count || 0,
    campaignsByStatus,
  });
});

// GET /admin/users
router.get('/users', requireAdmin, async (req, res) => {
  const { page = 1, limit = 50, search, plan, status } = req.query;
  const offset = (page - 1) * limit;

  let query = supabase
    .from('users')
    .select('id, email, full_name, company, plan, status, created_at', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (search) query = query.ilike('email', `%${search}%`);
  if (plan) query = query.eq('plan', plan);
  if (status) query = query.eq('status', status);

  const { data, count } = await query;
  res.json({ users: data || [], total: count, page: +page, limit: +limit });
});

// PUT /admin/users/:id - update user (plan, status)
router.put('/users/:id', requireAdmin, async (req, res) => {
  const { plan, status } = req.body;
  const updates = { updated_at: new Date().toISOString() };
  if (plan) updates.plan = plan;
  if (status) updates.status = status;

  const { data, error } = await supabase
    .from('users')
    .update(updates)
    .eq('id', req.params.id)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });

  // Log admin action
  await supabase.from('admin_logs').insert({
    admin_email: req.user.email,
    action: 'update_user',
    target_type: 'user',
    target_id: req.params.id,
    details: updates,
  });

  res.json({ user: data });
});

// GET /admin/campaigns - all campaigns across all users
router.get('/campaigns', requireAdmin, async (req, res) => {
  const { page = 1, limit = 50 } = req.query;
  const offset = (page - 1) * limit;

  const { data, count } = await supabase
    .from('campaigns')
    .select('*, users(email, full_name), wa_sessions(phone_number)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  res.json({ campaigns: data || [], total: count });
});

// PUT /admin/campaigns/:id/cancel
router.put('/campaigns/:id/cancel', requireAdmin, async (req, res) => {
  await supabase
    .from('campaigns')
    .update({ status: 'cancelled' })
    .eq('id', req.params.id);

  await supabase
    .from('messages')
    .update({ status: 'failed', error_message: 'Campaign cancelled by admin' })
    .eq('campaign_id', req.params.id)
    .eq('status', 'queued');

  res.json({ success: true });
});

// GET /admin/sessions - all WA sessions
router.get('/sessions', requireAdmin, async (req, res) => {
  const { data } = await supabase
    .from('wa_sessions')
    .select('*, users(email, full_name)')
    .order('created_at', { ascending: false });

  res.json({ sessions: data || [] });
});

// GET /admin/plan-limits
router.get('/plan-limits', requireAdmin, async (req, res) => {
  const { data } = await supabase.from('plan_limits').select('*');
  res.json({ limits: data || [] });
});

// PUT /admin/plan-limits/:plan
router.put('/plan-limits/:plan', requireAdmin, async (req, res) => {
  const { monthly_messages, max_sessions, api_calls_per_minute, price_inr } = req.body;

  const { data, error } = await supabase
    .from('plan_limits')
    .update({ monthly_messages, max_sessions, api_calls_per_minute, price_inr })
    .eq('plan', req.params.plan)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json({ limit: data });
});

// GET /admin/logs
router.get('/logs', requireAdmin, async (req, res) => {
  const { data } = await supabase
    .from('admin_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100);

  res.json({ logs: data || [] });
});

export default router;
