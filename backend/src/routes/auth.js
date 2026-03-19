import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { body, validationResult } from 'express-validator';
import { nanoid } from 'nanoid';
import supabase from '../lib/supabase.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

function signToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, plan: user.plan, isAdmin: user.is_admin || false },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
}

// POST /auth/signup
router.post(
  '/signup',
  [
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 8 }),
    body('full_name').trim().notEmpty(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { email, password, full_name, company } = req.body;

    const { data: existing } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .single();

    if (existing) return res.status(409).json({ error: 'Email already registered' });

    const password_hash = await bcrypt.hash(password, 12);

    const { data: user, error } = await supabase
      .from('users')
      .insert({ email, password_hash, full_name, company, plan: 'free' })
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });

    const token = signToken(user);
    res.status(201).json({ token, user: sanitizeUser(user) });
  }
);

// POST /auth/login
router.post(
  '/login',
  [body('email').isEmail().normalizeEmail(), body('password').notEmpty()],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { email, password } = req.body;

    const { data: user } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .single();

    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    if (user.status === 'suspended') return res.status(403).json({ error: 'Account suspended' });

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    const token = signToken(user);
    res.json({ token, user: sanitizeUser(user) });
  }
);

// GET /auth/me
router.get('/me', requireAuth, async (req, res) => {
  const { data: user } = await supabase
    .from('users')
    .select('*')
    .eq('id', req.user.id)
    .single();

  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ user: sanitizeUser(user) });
});

// PUT /auth/profile
router.put('/profile', requireAuth, async (req, res) => {
  const { full_name, company } = req.body;
  const { data: user, error } = await supabase
    .from('users')
    .update({ full_name, company, updated_at: new Date().toISOString() })
    .eq('id', req.user.id)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json({ user: sanitizeUser(user) });
});

// POST /auth/api-keys
router.post('/api-keys', requireAuth, async (req, res) => {
  const { name } = req.body;
  const rawKey = 'wabk_live_' + nanoid(32);
  const key_prefix = rawKey.substring(0, 8);
  const key_hash = await bcrypt.hash(rawKey, 10);

  const { data, error } = await supabase
    .from('api_keys')
    .insert({ user_id: req.user.id, key_hash, key_prefix, name: name || 'Default' })
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });

  // Return the raw key ONCE - it's never stored in plain text
  res.status(201).json({ key: rawKey, id: data.id, name: data.name });
});

// GET /auth/api-keys
router.get('/api-keys', requireAuth, async (req, res) => {
  const { data } = await supabase
    .from('api_keys')
    .select('id, key_prefix, name, is_active, last_used_at, created_at')
    .eq('user_id', req.user.id)
    .order('created_at', { ascending: false });

  res.json({ keys: data || [] });
});

// DELETE /auth/api-keys/:id
router.delete('/api-keys/:id', requireAuth, async (req, res) => {
  await supabase
    .from('api_keys')
    .update({ is_active: false })
    .eq('id', req.params.id)
    .eq('user_id', req.user.id);
  res.json({ success: true });
});

function sanitizeUser(user) {
  const { password_hash, ...safe } = user;
  return safe;
}

export default router;
