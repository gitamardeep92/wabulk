import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import supabase from '../lib/supabase.js';

// JWT middleware (for dashboard/admin routes)
export function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing authorization header' });
  }
  const token = authHeader.slice(7);
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// Admin middleware
export function requireAdmin(req, res, next) {
  requireAuth(req, res, () => {
    if (!req.user.isAdmin) {
      return res.status(403).json({ error: 'Admin access required' });
    }
    next();
  });
}

// API Key middleware (for external API usage)
export async function requireApiKey(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing API key' });
  }

  const rawKey = authHeader.slice(7);

  // API keys start with "wabk_"
  if (!rawKey.startsWith('wabk_')) {
    return res.status(401).json({ error: 'Invalid API key format' });
  }

  const prefix = rawKey.substring(0, 8);

  // Look up by prefix, then verify hash
  const { data: keys } = await supabase
    .from('api_keys')
    .select('*, users(*)')
    .eq('key_prefix', prefix)
    .eq('is_active', true);

  if (!keys?.length) {
    return res.status(401).json({ error: 'Invalid API key' });
  }

  // Find matching key by hash comparison
  let matchedKey = null;
  for (const k of keys) {
    const match = await bcrypt.compare(rawKey, k.key_hash);
    if (match) { matchedKey = k; break; }
  }

  if (!matchedKey) {
    return res.status(401).json({ error: 'Invalid API key' });
  }

  if (matchedKey.users.status !== 'active') {
    return res.status(403).json({ error: 'Account suspended' });
  }

  // Update last used
  await supabase
    .from('api_keys')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', matchedKey.id);

  req.user = matchedKey.users;
  req.apiKey = matchedKey;
  next();
}
