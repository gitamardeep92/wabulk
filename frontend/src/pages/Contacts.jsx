import React, { useEffect, useState, useRef } from 'react';
import { Users, Plus, Upload, Trash2, Search, UserPlus, FolderPlus, Edit2, ChevronRight, X, Check, AlertCircle } from 'lucide-react';
import api from '../lib/api';
import toast from 'react-hot-toast';

// ── CSV Parser ────────────────────────────────────────────
function parseCsv(text) {
  const lines = text.trim().split('\n').filter(Boolean);
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
  return lines.slice(1).map(row => {
    const vals = row.split(',').map(v => v.trim());
    const obj = {};
    headers.forEach((h, i) => (obj[h] = vals[i] || ''));
    return obj;
  });
}

// ── Import Modal ──────────────────────────────────────────
function ImportModal({ onClose, onImported }) {
  const [csvText, setCsvText] = useState('');
  const [preview, setPreview] = useState([]);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef();

  const handleFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target.result;
      setCsvText(text);
      setPreview(parseCsv(text).slice(0, 5));
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    if (!csvText) return toast.error('Upload a CSV file first');
    const contacts = parseCsv(csvText);
    if (!contacts.length) return toast.error('No valid rows found');
    setImporting(true);
    try {
      const { data } = await api.post('/contacts/import', { contacts });
      toast.success(`${data.imported} contacts imported`);
      onImported();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Import failed');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-box max-w-lg animate-in" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-sm font-semibold text-[#dce8df]">Import contacts from CSV</h3>
          <button onClick={onClose} className="btn-icon"><X size={16} /></button>
        </div>

        <div className="mb-4 p-3 bg-[#0a1209] rounded-xl border border-[#1c2e20]">
          <p className="text-xs font-semibold text-[#5a7a62] uppercase tracking-wider mb-2">Required CSV format</p>
          <code className="text-xs font-mono text-[#25D366]">name,phone,email</code><br />
          <code className="text-xs font-mono text-[#5a7a62]">Rahul Sharma,+919876543210,rahul@example.com</code><br />
          <code className="text-xs font-mono text-[#5a7a62]">Priya Singh,+918800001234,</code>
          <p className="text-xs text-[#344a38] mt-2">Only <code className="text-[#25D366]">name</code> and <code className="text-[#25D366]">phone</code> are required. Add any extra columns — they'll be saved as custom data.</p>
        </div>

        <div
          className="border-2 border-dashed border-[#1c2e20] rounded-xl p-6 text-center mb-4 hover:border-[#25D366]/30 transition-colors cursor-pointer"
          onClick={() => fileRef.current?.click()}>
          <Upload size={20} className="text-[#5a7a62] mx-auto mb-2" />
          <p className="text-sm text-[#5a7a62]">Click to upload CSV</p>
          <p className="text-xs text-[#344a38] mt-0.5">or drag and drop</p>
          <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleFile} />
        </div>

        {preview.length > 0 && (
          <div className="mb-4 overflow-x-auto">
            <p className="text-xs text-[#5a7a62] mb-2">Preview (first 5 rows):</p>
            <table className="w-full text-xs">
              <thead><tr className="border-b border-[#1c2e20]">
                {Object.keys(preview[0]).map(h => <th key={h} className="table-head py-1.5">{h}</th>)}
              </tr></thead>
              <tbody>
                {preview.map((row, i) => (
                  <tr key={i} className="border-b border-[#1c2e20]">
                    {Object.values(row).map((v, j) => <td key={j} className="table-cell py-1.5 text-[#8fb898]">{v}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex gap-3">
          <button onClick={handleImport} disabled={importing || !csvText} className="btn-primary flex-1 disabled:opacity-40">
            {importing && <div className="w-4 h-4 border-2 border-[#061008] border-t-transparent rounded-full animate-spin" />}
            Import contacts
          </button>
          <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ── Group Modal ───────────────────────────────────────────
function GroupModal({ group, contacts, onClose, onSaved }) {
  const [name, setName] = useState(group?.name || '');
  const [description, setDescription] = useState(group?.description || '');
  const [selected, setSelected] = useState(new Set());
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');

  const filtered = contacts.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.phone.includes(search)
  );

  const toggle = (id) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleSave = async () => {
    if (!name.trim()) return toast.error('Group name required');
    setSaving(true);
    try {
      let grp;
      if (group) {
        const { data } = await api.put(`/contacts/groups/${group.id}`, { name, description });
        grp = data.group;
      } else {
        const { data } = await api.post('/contacts/groups', { name, description });
        grp = data.group;
      }
      if (selected.size > 0) {
        await api.post(`/contacts/groups/${grp.id}/members`, { contact_ids: [...selected] });
      }
      toast.success(group ? 'Group updated' : 'Group created');
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-box max-w-md animate-in" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-sm font-semibold text-[#dce8df]">{group ? 'Edit group' : 'New contact group'}</h3>
          <button onClick={onClose} className="btn-icon"><X size={16} /></button>
        </div>
        <div className="space-y-3 mb-4">
          <div><label className="label">Group name</label>
            <input className="input" value={name} onChange={e => setName(e.target.value)} placeholder="VIP Members, Gym Subscribers..." autoFocus /></div>
          <div><label className="label">Description <span className="text-[#344a38] normal-case font-normal">(optional)</span></label>
            <input className="input" value={description} onChange={e => setDescription(e.target.value)} placeholder="Brief description" /></div>
        </div>
        {!group && contacts.length > 0 && (
          <div className="mb-4">
            <label className="label">Add contacts <span className="text-[#344a38] normal-case font-normal">({selected.size} selected)</span></label>
            <div className="relative mb-2">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#344a38]" />
              <input className="input pl-8 text-xs" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search contacts..." />
            </div>
            <div className="max-h-48 overflow-y-auto space-y-0.5 bg-[#0a1209] rounded-xl border border-[#1c2e20] p-1">
              {filtered.map(c => (
                <div key={c.id} onClick={() => toggle(c.id)}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-colors ${selected.has(c.id) ? 'bg-[#0a1f0d]' : 'hover:bg-[#0f1810]'}`}>
                  <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${selected.has(c.id) ? 'bg-[#25D366] border-[#25D366]' : 'border-[#1c2e20]'}`}>
                    {selected.has(c.id) && <Check size={10} className="text-[#061008]" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium text-[#dce8df] truncate">{c.name}</div>
                    <div className="text-[10px] text-[#5a7a62] font-mono">{c.phone}</div>
                  </div>
                </div>
              ))}
              {filtered.length === 0 && <div className="text-center py-4 text-xs text-[#344a38]">No contacts found</div>}
            </div>
          </div>
        )}
        <div className="flex gap-3">
          <button onClick={handleSave} disabled={saving} className="btn-primary flex-1">
            {saving && <div className="w-4 h-4 border-2 border-[#061008] border-t-transparent rounded-full animate-spin" />}
            {group ? 'Save changes' : 'Create group'}
          </button>
          <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ── Main Contacts Page ────────────────────────────────────
export default function Contacts() {
  const [contacts, setContacts] = useState([]);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('contacts'); // contacts | groups
  const [search, setSearch] = useState('');
  const [showImport, setShowImport] = useState(false);
  const [showGroup, setShowGroup] = useState(false);
  const [editGroup, setEditGroup] = useState(null);
  const [deleteContact, setDeleteContact] = useState(null);
  const [deleteGroup, setDeleteGroup] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState({ name: '', phone: '', email: '' });
  const [addSaving, setAddSaving] = useState(false);

  const loadAll = async () => {
    try {
      const [cr, gr] = await Promise.all([
        api.get('/contacts'),
        api.get('/contacts/groups'),
      ]);
      setContacts(cr.data.contacts || []);
      setGroups(gr.data.groups || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadAll(); }, []);

  const filteredContacts = contacts.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.phone.includes(search)
  );

  const addContact = async (e) => {
    e.preventDefault();
    setAddSaving(true);
    try {
      await api.post('/contacts', addForm);
      toast.success('Contact added');
      setAddForm({ name: '', phone: '', email: '' });
      setShowAdd(false);
      loadAll();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to add contact');
    } finally {
      setAddSaving(false);
    }
  };

  const handleDeleteContact = async (id) => {
    await api.delete(`/contacts/${id}`);
    toast.success('Contact deleted');
    setContacts(c => c.filter(x => x.id !== id));
    setDeleteContact(null);
  };

  const handleDeleteGroup = async (id) => {
    await api.delete(`/contacts/groups/${id}`);
    toast.success('Group deleted');
    setGroups(g => g.filter(x => x.id !== id));
    setDeleteGroup(null);
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-5 animate-in">
      {/* Modals */}
      {showImport && <ImportModal onClose={() => setShowImport(false)} onImported={loadAll} />}
      {(showGroup || editGroup) && (
        <GroupModal
          group={editGroup}
          contacts={contacts}
          onClose={() => { setShowGroup(false); setEditGroup(null); }}
          onSaved={loadAll}
        />
      )}
      {deleteContact && (
        <div className="modal-backdrop" onClick={() => setDeleteContact(null)}>
          <div className="modal-box max-w-sm animate-in" onClick={e => e.stopPropagation()}>
            <h3 className="text-sm font-semibold text-[#dce8df] mb-2">Delete contact?</h3>
            <p className="text-sm text-[#8fb898] mb-5"><span className="text-[#dce8df]">{deleteContact.name}</span> ({deleteContact.phone}) will be permanently removed.</p>
            <div className="flex gap-3">
              <button onClick={() => handleDeleteContact(deleteContact.id)} className="btn-danger flex-1">Delete</button>
              <button onClick={() => setDeleteContact(null)} className="btn-secondary flex-1">Cancel</button>
            </div>
          </div>
        </div>
      )}
      {deleteGroup && (
        <div className="modal-backdrop" onClick={() => setDeleteGroup(null)}>
          <div className="modal-box max-w-sm animate-in" onClick={e => e.stopPropagation()}>
            <h3 className="text-sm font-semibold text-[#dce8df] mb-2">Delete group?</h3>
            <p className="text-sm text-[#8fb898] mb-5"><span className="text-[#dce8df]">{deleteGroup.name}</span> will be deleted. Contacts inside are not deleted.</p>
            <div className="flex gap-3">
              <button onClick={() => handleDeleteGroup(deleteGroup.id)} className="btn-danger flex-1">Delete group</button>
              <button onClick={() => setDeleteGroup(null)} className="btn-secondary flex-1">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="page-title">Contacts</h1>
          <p className="page-subtitle">{contacts.length} contacts · {groups.length} groups</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowImport(true)} className="btn-secondary gap-2">
            <Upload size={14} /> Import CSV
          </button>
          {tab === 'contacts'
            ? <button onClick={() => setShowAdd(!showAdd)} className="btn-primary"><Plus size={15} /> Add contact</button>
            : <button onClick={() => setShowGroup(true)} className="btn-primary"><FolderPlus size={15} /> New group</button>
          }
        </div>
      </div>

      {/* Add contact inline form */}
      {showAdd && tab === 'contacts' && (
        <div className="card border-[#25D366]/20 animate-in">
          <form onSubmit={addContact}>
            <div className="grid grid-cols-3 gap-3 mb-3">
              <div><label className="label">Name</label>
                <input className="input" value={addForm.name} onChange={e => setAddForm(f => ({ ...f, name: e.target.value }))} placeholder="Rahul Sharma" required autoFocus /></div>
              <div><label className="label">Phone</label>
                <input className="input" value={addForm.phone} onChange={e => setAddForm(f => ({ ...f, phone: e.target.value }))} placeholder="+919876543210" required /></div>
              <div><label className="label">Email <span className="text-[#344a38] normal-case font-normal">(optional)</span></label>
                <input className="input" type="email" value={addForm.email} onChange={e => setAddForm(f => ({ ...f, email: e.target.value }))} placeholder="rahul@example.com" /></div>
            </div>
            <div className="flex gap-2">
              <button type="submit" disabled={addSaving} className="btn-primary">
                {addSaving && <div className="w-4 h-4 border-2 border-[#061008] border-t-transparent rounded-full animate-spin" />}
                Add contact
              </button>
              <button type="button" onClick={() => setShowAdd(false)} className="btn-secondary">Cancel</button>
            </div>
          </form>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-[#0a1209] border border-[#1c2e20] rounded-xl p-1 w-fit">
        {[['contacts', 'Contacts', contacts.length], ['groups', 'Groups', groups.length]].map(([v, l, c]) => (
          <button key={v} onClick={() => setTab(v)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === v ? 'bg-[#0f1810] text-[#dce8df] border border-[#1c2e20]' : 'text-[#5a7a62] hover:text-[#8fb898]'}`}>
            {l} <span className={`ml-1 text-xs ${tab === v ? 'text-[#25D366]' : 'text-[#344a38]'}`}>{c}</span>
          </button>
        ))}
      </div>

      {/* Search */}
      {tab === 'contacts' && (
        <div className="relative max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#344a38]" />
          <input className="input pl-9 text-sm" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name or phone..." />
        </div>
      )}

      {/* Contacts tab */}
      {tab === 'contacts' && (
        loading ? (
          <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="skeleton h-14 rounded-xl" />)}</div>
        ) : filteredContacts.length === 0 ? (
          <div className="card py-14 text-center">
            <Users size={28} className="text-[#344a38] mx-auto mb-3" />
            <h3 className="text-[#a8c4ae] font-semibold mb-1">{search ? 'No contacts found' : 'No contacts yet'}</h3>
            <p className="text-sm text-[#5a7a62] mb-4">{search ? 'Try a different search' : 'Add contacts manually or import a CSV'}</p>
            {!search && (
              <div className="flex gap-2 justify-center">
                <button onClick={() => setShowAdd(true)} className="btn-primary"><UserPlus size={14} /> Add manually</button>
                <button onClick={() => setShowImport(true)} className="btn-secondary"><Upload size={14} /> Import CSV</button>
              </div>
            )}
          </div>
        ) : (
          <div className="card overflow-hidden p-0">
            <table className="w-full text-sm">
              <thead className="border-b border-[#1c2e20]">
                <tr>{['Name', 'Phone', 'Email', 'Added', ''].map(h => <th key={h} className="table-head">{h}</th>)}</tr>
              </thead>
              <tbody>
                {filteredContacts.map(c => (
                  <tr key={c.id} className="table-row">
                    <td className="table-cell font-medium text-[#dce8df]">{c.name}</td>
                    <td className="table-cell font-mono text-xs text-[#8fb898]">{c.phone}</td>
                    <td className="table-cell text-[#5a7a62] text-xs">{c.email || '—'}</td>
                    <td className="table-cell text-[#5a7a62] text-xs">{new Date(c.created_at).toLocaleDateString('en-IN')}</td>
                    <td className="table-cell">
                      <button onClick={() => setDeleteContact(c)} className="btn-icon text-[#f87171] hover:text-[#f87171] hover:bg-[#150606]">
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {/* Groups tab */}
      {tab === 'groups' && (
        loading ? (
          <div className="space-y-3">{[1,2].map(i => <div key={i} className="skeleton h-20 rounded-2xl" />)}</div>
        ) : groups.length === 0 ? (
          <div className="card py-14 text-center">
            <Users size={28} className="text-[#344a38] mx-auto mb-3" />
            <h3 className="text-[#a8c4ae] font-semibold mb-1">No groups yet</h3>
            <p className="text-sm text-[#5a7a62] mb-4">Create groups to quickly select contacts when sending campaigns</p>
            <button onClick={() => setShowGroup(true)} className="btn-primary mx-auto"><FolderPlus size={14} /> Create first group</button>
          </div>
        ) : (
          <div className="space-y-3">
            {groups.map(g => (
              <div key={g.id} className="card flex items-center justify-between gap-4 hover:border-[#25402a] transition-colors">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-[#0a1f0d] border border-[#1c2e20] flex items-center justify-center shrink-0">
                    <Users size={16} className="text-[#25D366]" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-[#dce8df]">{g.name}</div>
                    <div className="text-xs text-[#5a7a62]">
                      {g.contact_count} contact{g.contact_count !== 1 ? 's' : ''}
                      {g.description && <span className="ml-2">· {g.description}</span>}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button onClick={() => setEditGroup(g)} className="btn-icon"><Edit2 size={14} /></button>
                  <button onClick={() => setDeleteGroup(g)} className="btn-icon text-[#f87171] hover:text-[#f87171] hover:bg-[#150606]"><Trash2 size={14} /></button>
                </div>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}
