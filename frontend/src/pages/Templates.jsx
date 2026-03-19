import React, { useEffect, useState } from 'react';
import { FileText, Plus, Trash2, Edit2, Tag } from 'lucide-react';
import api from '../lib/api';
import toast from 'react-hot-toast';
import { extractVariables } from '../lib/templateUtils';

export default function Templates() {
  const [templates, setTemplates] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: '', body: '', category: 'notification' });

  const load = () => api.get('/templates').then((r) => setTemplates(r.data.templates));

  useEffect(() => { load(); }, []);

  const openNew = () => { setEditing(null); setForm({ name: '', body: '', category: 'notification' }); setShowForm(true); };
  const openEdit = (t) => { setEditing(t); setForm({ name: t.name, body: t.body, category: t.category }); setShowForm(true); };

  const save = async (e) => {
    e.preventDefault();
    try {
      if (editing) {
        await api.put(`/templates/${editing.id}`, form);
        toast.success('Template updated');
      } else {
        await api.post('/templates', form);
        toast.success('Template created');
      }
      setShowForm(false);
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Save failed');
    }
  };

  const del = async (id) => {
    if (!confirm('Delete this template?')) return;
    await api.delete(`/templates/${id}`);
    toast.success('Template deleted');
    load();
  };

  const vars = extractVariables(form.body);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-[#e8f0eb]">Templates</h1>
          <p className="text-sm text-[#6b8f72] mt-0.5">Reusable message templates with dynamic variables</p>
        </div>
        <button onClick={openNew} className="btn-primary flex items-center gap-2">
          <Plus size={14} /> New template
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <div className="card mb-6 border-wa/20">
          <h2 className="text-sm font-medium text-[#a8c4ae] mb-4">{editing ? 'Edit template' : 'New template'}</h2>
          <form onSubmit={save} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Template name</label>
                <input className="input" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Order confirmation" required />
              </div>
              <div>
                <label className="label">Category</label>
                <select className="input" value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}>
                  <option value="notification">Notification</option>
                  <option value="transactional">Transactional</option>
                  <option value="reminder">Reminder</option>
                </select>
              </div>
            </div>
            <div>
              <label className="label">Message body</label>
              <textarea className="input h-28 resize-none font-mono text-xs" value={form.body}
                onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
                placeholder="Hi {{name}}, your {{plan}} membership expires on {{date}}. Renew at {{link}}" required />
              <p className="text-xs text-[#3a5040] mt-1">Use {'{{variable}}'} syntax for dynamic values</p>
            </div>
            {vars.length > 0 && (
              <div className="flex flex-wrap gap-2">
                <span className="text-xs text-[#6b8f72]">Variables detected:</span>
                {vars.map((v) => (
                  <span key={v} className="badge-info font-mono"><Tag size={10} />{v}</span>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <button type="submit" className="btn-primary">Save template</button>
              <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">Cancel</button>
            </div>
          </form>
        </div>
      )}

      {/* List */}
      {templates.length === 0 ? (
        <div className="card text-center py-16">
          <FileText size={40} className="text-[#3a5040] mx-auto mb-3" />
          <h3 className="text-[#a8c4ae] font-medium mb-1">No templates yet</h3>
          <p className="text-sm text-[#3a5040] mb-4">Create reusable templates for your notifications</p>
          <button onClick={openNew} className="btn-primary">Create first template</button>
        </div>
      ) : (
        <div className="space-y-3">
          {templates.map((t) => (
            <div key={t.id} className="card hover:border-[#2a3a2f] transition-colors">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium text-[#e8f0eb]">{t.name}</span>
                    <span className="badge-info text-[10px]">{t.category}</span>
                  </div>
                  <p className="text-xs text-[#6b8f72] font-mono bg-[#0d1610] px-2 py-1.5 rounded border border-[#1e2e22] truncate">
                    {t.body}
                  </p>
                  {t.variables?.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {t.variables.map((v) => (
                        <span key={v} className="text-[10px] font-mono bg-[#0d2016] text-wa border border-[#1a4a2a] px-1.5 py-0.5 rounded">
                          {`{{${v}}}`}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button onClick={() => openEdit(t)} className="btn-ghost"><Edit2 size={14} /></button>
                  <button onClick={() => del(t.id)} className="btn-ghost text-[#f87171] hover:text-[#f87171]"><Trash2 size={14} /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
