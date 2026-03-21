import React, { useEffect, useState } from 'react';
import { FileText, Plus, Trash2, Edit2, Tag, Eye, Copy, Check } from 'lucide-react';
import api from '../lib/api';
import toast from 'react-hot-toast';
import { extractVariables, renderTemplate } from '../lib/templateUtils';

const CATEGORIES = ['notification', 'transactional', 'reminder', 'alert'];

const categoryColors = {
  notification: 'badge-info',
  transactional: 'badge-success',
  reminder: 'badge-warn',
  alert: 'badge-danger',
};

function TemplateForm({ initial, onSave, onCancel }) {
  const [form, setForm] = useState(initial || { name: '', body: '', category: 'notification' });
  const [saving, setSaving] = useState(false);
  const [previewVars, setPreviewVars] = useState({});
  const [showPreview, setShowPreview] = useState(false);

  const vars = extractVariables(form.body);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave(form);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="card border-[#25D366]/20 animate-in">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-sm font-semibold text-[#dce8df]">{initial ? 'Edit template' : 'New template'}</h2>
        <button onClick={() => setShowPreview(!showPreview)} className="btn-ghost text-xs gap-1.5">
          <Eye size={13} /> {showPreview ? 'Hide preview' : 'Preview'}
        </button>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4 mb-4">
          <div>
            <label className="label">Template name</label>
            <input className="input" value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="Order confirmation" required />
          </div>
          <div>
            <label className="label">Category</label>
            <select className="input" value={form.category}
              onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
              {CATEGORIES.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
            </select>
          </div>
        </div>

        <div className="mb-4">
          <label className="label">Message body</label>
          <textarea className="input font-mono text-xs h-28 resize-none leading-relaxed" value={form.body}
            onChange={e => setForm(f => ({ ...f, body: e.target.value }))}
            placeholder="Hi {{name}}, your {{plan}} membership expires on {{date}}. Renew here: {{link}}" required />
          <p className="input-hint">Use <code className="text-[#25D366]">{'{{variable}}'}</code> syntax for dynamic content</p>
        </div>

        {vars.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            <span className="text-xs text-[#5a7a62]">Detected variables:</span>
            {vars.map(v => (
              <span key={v} className="inline-flex items-center gap-1 text-xs font-mono bg-[#0a1f0d] text-[#25D366] border border-[#1c2e20] px-2 py-0.5 rounded-lg">
                <Tag size={10} />{`{{${v}}}`}
              </span>
            ))}
          </div>
        )}

        {showPreview && vars.length > 0 && (
          <div className="mb-4 p-4 bg-[#0a1209] rounded-xl border border-[#1c2e20]">
            <p className="text-xs font-semibold text-[#5a7a62] uppercase tracking-wider mb-3">Preview variables</p>
            <div className="grid grid-cols-2 gap-2 mb-3">
              {vars.map(v => (
                <div key={v}>
                  <label className="text-xs text-[#5a7a62] mb-1 block font-mono">{v}</label>
                  <input className="input text-xs py-1.5" placeholder={`Sample ${v}`}
                    value={previewVars[v] || ''}
                    onChange={e => setPreviewVars(p => ({ ...p, [v]: e.target.value }))} />
                </div>
              ))}
            </div>
            <div className="bg-[#060c07] rounded-lg border border-[#1c2e20] p-3">
              <p className="text-xs text-[#5a7a62] mb-1">Output:</p>
              <p className="text-sm text-[#dce8df] whitespace-pre-wrap">
                {renderTemplate(form.body, previewVars) || <span className="text-[#344a38]">Start typing a message above...</span>}
              </p>
            </div>
          </div>
        )}

        <div className="flex gap-3">
          <button type="submit" disabled={saving} className="btn-primary">
            {saving && <div className="w-3.5 h-3.5 border-2 border-[#061008] border-t-transparent rounded-full animate-spin" />}
            {initial ? 'Save changes' : 'Create template'}
          </button>
          <button type="button" onClick={onCancel} className="btn-secondary">Cancel</button>
        </div>
      </form>
    </div>
  );
}

export default function Templates() {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [copied, setCopied] = useState(null);

  const load = () => api.get('/templates').then(r => { setTemplates(r.data.templates || []); setLoading(false); });
  useEffect(() => { load(); }, []);

  const handleSave = async (form) => {
    try {
      if (editing) {
        await api.put(`/templates/${editing.id}`, form);
        toast.success('Template updated');
      } else {
        await api.post('/templates', form);
        toast.success('Template created');
      }
      setShowForm(false);
      setEditing(null);
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Save failed');
    }
  };

  const handleDelete = async (id) => {
    try {
      await api.delete(`/templates/${id}`);
      toast.success('Template deleted');
      setTemplates(t => t.filter(x => x.id !== id));
      setDeleteConfirm(null);
    } catch {
      toast.error('Delete failed');
    }
  };

  const copyBody = (id, body) => {
    navigator.clipboard.writeText(body);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-4 md:space-y-5 animate-in">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="page-title">Templates</h1>
          <p className="page-subtitle">Reusable message templates with dynamic variable support</p>
        </div>
        {!showForm && (
          <button onClick={() => { setEditing(null); setShowForm(true); }} className="btn-primary">
            <Plus size={15} /> New template
          </button>
        )}
      </div>

      {(showForm || editing) && (
        <TemplateForm
          initial={editing}
          onSave={handleSave}
          onCancel={() => { setShowForm(false); setEditing(null); }}
        />
      )}

      {deleteConfirm && (
        <div className="modal-backdrop" onClick={() => setDeleteConfirm(null)}>
          <div className="modal-box max-w-sm animate-in" onClick={e => e.stopPropagation()}>
            <h3 className="text-sm font-semibold text-[#dce8df] mb-2">Delete template?</h3>
            <p className="text-sm text-[#8fb898] mb-5">
              "<span className="text-[#dce8df]">{deleteConfirm.name}</span>" will be permanently deleted.
            </p>
            <div className="flex gap-3">
              <button onClick={() => handleDelete(deleteConfirm.id)} className="btn-danger flex-1">Delete</button>
              <button onClick={() => setDeleteConfirm(null)} className="btn-secondary flex-1">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="skeleton h-24 rounded-2xl" />)}</div>
      ) : templates.length === 0 && !showForm ? (
        <div className="card py-16 text-center">
          <div className="w-14 h-14 rounded-2xl bg-[#0a1f0d] border border-[#1c2e20] flex items-center justify-center mx-auto mb-4">
            <FileText size={24} className="text-[#25D366]" />
          </div>
          <h3 className="text-[#a8c4ae] font-semibold mb-1">No templates yet</h3>
          <p className="text-sm text-[#5a7a62] mb-5">Create reusable message templates with dynamic variables</p>
          <button onClick={() => setShowForm(true)} className="btn-primary mx-auto">Create first template</button>
        </div>
      ) : (
        <div className="space-y-3">
          {templates.map(t => (
            <div key={t.id} className="card hover:border-[#25402a] transition-colors">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <span className="text-sm font-semibold text-[#dce8df]">{t.name}</span>
                    <span className={categoryColors[t.category] || 'badge-gray'}>{t.category}</span>
                    {t.variables?.length > 0 && (
                      <span className="badge-gray">{t.variables.length} variables</span>
                    )}
                  </div>
                  <div className="flex items-start gap-2">
                    <p className="text-xs text-[#5a7a62] font-mono bg-[#0a1209] px-2.5 py-2 rounded-lg border border-[#1c2e20] flex-1 leading-relaxed">
                      {t.body}
                    </p>
                    <button onClick={() => copyBody(t.id, t.body)} className="btn-icon shrink-0 mt-1">
                      {copied === t.id ? <Check size={13} className="text-[#25D366]" /> : <Copy size={13} />}
                    </button>
                  </div>
                  {t.variables?.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {t.variables.map(v => (
                        <span key={v} className="text-[10px] font-mono bg-[#0a1f0d] text-[#25D366] border border-[#1c2e20] px-1.5 py-0.5 rounded">
                          {`{{${v}}}`}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => { setEditing(t); setShowForm(false); }} className="btn-icon">
                    <Edit2 size={14} />
                  </button>
                  <button onClick={() => setDeleteConfirm(t)} className="btn-icon text-[#f87171] hover:text-[#f87171] hover:bg-[#150606]">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
