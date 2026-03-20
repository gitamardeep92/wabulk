import express from 'express';
import supabase from '../lib/supabase.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

// ── Contacts ──────────────────────────────────────────────

// GET /contacts
router.get('/', requireAuth, async (req, res) => {
  const { search, page = 1, limit = 100 } = req.query;
  const offset = (page - 1) * limit;

  let query = supabase
    .from('contacts')
    .select('*', { count: 'exact' })
    .eq('user_id', req.user.id)
    .order('name', { ascending: true })
    .range(offset, offset + limit - 1);

  if (search) query = query.ilike('name', `%${search}%`);

  const { data, count, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  res.json({ contacts: data || [], total: count });
});

// POST /contacts — create single contact
router.post('/', requireAuth, async (req, res) => {
  const { name, phone, email, custom_data } = req.body;
  if (!name || !phone) return res.status(400).json({ error: 'name and phone required' });

  const { data, error } = await supabase
    .from('contacts')
    .upsert({ user_id: req.user.id, name, phone, email, custom_data: custom_data || {} },
      { onConflict: 'user_id,phone' })
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json({ contact: data });
});

// POST /contacts/import — bulk import from CSV data
router.post('/import', requireAuth, async (req, res) => {
  const { contacts } = req.body;
  if (!Array.isArray(contacts) || contacts.length === 0) {
    return res.status(400).json({ error: 'contacts array required' });
  }

  const rows = contacts.map(c => ({
    user_id: req.user.id,
    name: c.name || c.Name || 'Unknown',
    phone: (c.phone || c.to || c.Phone || c.mobile || '').toString().trim(),
    email: c.email || c.Email || null,
    custom_data: c,
  })).filter(r => r.phone && /^\+?[0-9]{7,15}$/.test(r.phone.replace(/\s/g, '')));

  if (rows.length === 0) {
    return res.status(400).json({ error: 'No valid contacts found. Ensure phone numbers are valid.' });
  }

  const { data, error } = await supabase
    .from('contacts')
    .upsert(rows, { onConflict: 'user_id,phone', ignoreDuplicates: false })
    .select('id');

  if (error) return res.status(500).json({ error: error.message });
  res.json({ imported: data.length, skipped: contacts.length - data.length });
});

// DELETE /contacts/:id
router.delete('/:id', requireAuth, async (req, res) => {
  await supabase.from('contacts').delete().eq('id', req.params.id).eq('user_id', req.user.id);
  res.json({ success: true });
});

// ── Groups ────────────────────────────────────────────────

// GET /contacts/groups
router.get('/groups', requireAuth, async (req, res) => {
  const { data, error } = await supabase
    .from('contact_groups')
    .select('*')
    .eq('user_id', req.user.id)
    .order('created_at', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });
  res.json({ groups: data || [] });
});

// POST /contacts/groups
router.post('/groups', requireAuth, async (req, res) => {
  const { name, description } = req.body;
  if (!name) return res.status(400).json({ error: 'name required' });

  const { data, error } = await supabase
    .from('contact_groups')
    .insert({ user_id: req.user.id, name, description })
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json({ group: data });
});

// PUT /contacts/groups/:id
router.put('/groups/:id', requireAuth, async (req, res) => {
  const { name, description } = req.body;
  const { data, error } = await supabase
    .from('contact_groups')
    .update({ name, description, updated_at: new Date().toISOString() })
    .eq('id', req.params.id)
    .eq('user_id', req.user.id)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json({ group: data });
});

// DELETE /contacts/groups/:id
router.delete('/groups/:id', requireAuth, async (req, res) => {
  await supabase.from('contact_groups').delete()
    .eq('id', req.params.id).eq('user_id', req.user.id);
  res.json({ success: true });
});

// GET /contacts/groups/:id/members
router.get('/groups/:id/members', requireAuth, async (req, res) => {
  // verify group belongs to user
  const { data: group } = await supabase
    .from('contact_groups')
    .select('id')
    .eq('id', req.params.id)
    .eq('user_id', req.user.id)
    .single();

  if (!group) return res.status(404).json({ error: 'Group not found' });

  const { data } = await supabase
    .from('contact_group_members')
    .select('contacts(*)')
    .eq('group_id', req.params.id);

  const contacts = (data || []).map(r => r.contacts);
  res.json({ contacts });
});

// POST /contacts/groups/:id/members — add contacts to group
router.post('/groups/:id/members', requireAuth, async (req, res) => {
  const { contact_ids } = req.body;
  if (!Array.isArray(contact_ids)) return res.status(400).json({ error: 'contact_ids array required' });

  const { data: group } = await supabase
    .from('contact_groups')
    .select('id')
    .eq('id', req.params.id)
    .eq('user_id', req.user.id)
    .single();

  if (!group) return res.status(404).json({ error: 'Group not found' });

  const rows = contact_ids.map(id => ({ group_id: req.params.id, contact_id: id }));
  await supabase.from('contact_group_members').upsert(rows, { ignoreDuplicates: true });

  res.json({ success: true, added: rows.length });
});

// DELETE /contacts/groups/:id/members/:contactId
router.delete('/groups/:id/members/:contactId', requireAuth, async (req, res) => {
  await supabase.from('contact_group_members')
    .delete()
    .eq('group_id', req.params.id)
    .eq('contact_id', req.params.contactId);
  res.json({ success: true });
});

export default router;
