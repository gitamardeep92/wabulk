import express from 'express';
import supabase from '../lib/supabase.js';
import { requireAuth } from '../middleware/auth.js';
import { extractVariables } from '../services/templateEngine.js';

const router = express.Router();

router.get('/', requireAuth, async (req, res) => {
  const { data } = await supabase
    .from('templates')
    .select('*')
    .eq('user_id', req.user.id)
    .eq('is_active', true)
    .order('created_at', { ascending: false });
  res.json({ templates: data || [] });
});

router.post('/', requireAuth, async (req, res) => {
  const { name, body, category } = req.body;
  if (!name || !body) return res.status(400).json({ error: 'name and body required' });

  const variables = extractVariables(body);

  const { data, error } = await supabase
    .from('templates')
    .insert({ user_id: req.user.id, name, body, variables, category: category || 'notification' })
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json({ template: data });
});

router.put('/:id', requireAuth, async (req, res) => {
  const { name, body, category } = req.body;
  const variables = body ? extractVariables(body) : undefined;

  const updates = { updated_at: new Date().toISOString() };
  if (name) updates.name = name;
  if (body) { updates.body = body; updates.variables = variables; }
  if (category) updates.category = category;

  const { data, error } = await supabase
    .from('templates')
    .update(updates)
    .eq('id', req.params.id)
    .eq('user_id', req.user.id)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json({ template: data });
});

router.delete('/:id', requireAuth, async (req, res) => {
  await supabase
    .from('templates')
    .update({ is_active: false })
    .eq('id', req.params.id)
    .eq('user_id', req.user.id);
  res.json({ success: true });
});

export default router;
