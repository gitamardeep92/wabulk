import React, { useEffect, useState } from 'react';
import { Key, Plus, Trash2, Copy, Check, AlertTriangle, Eye, EyeOff } from 'lucide-react';
import api from '../lib/api';
import toast from 'react-hot-toast';

export default function ApiKeys() {
  const [keys, setKeys] = useState([]);
  const [newKey, setNewKey] = useState(null);
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [showKey, setShowKey] = useState(false);

  const load = () => api.get('/auth/api-keys').then(r => setKeys(r.data.keys || []));
  useEffect(() => { load(); }, []);

  const create = async (e) => {
    e.preventDefault();
    setCreating(true);
    try {
      const { data } = await api.post('/auth/api-keys', { name });
      setNewKey(data.key);
      setName('');
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create key');
    } finally {
      setCreating(false);
    }
  };

  const revoke = async (id) => {
    try {
      await api.delete(`/auth/api-keys/${id}`);
      toast.success('API key revoked');
      setKeys(k => k.filter(x => x.id !== id));
      setDeleteConfirm(null);
    } catch {
      toast.error('Failed to revoke key');
    }
  };

  const copy = (text) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success('Copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-5 animate-in">
      <div>
        <h1 className="page-title">API Keys</h1>
        <p className="page-subtitle">Authenticate your application to send messages via the WaBulk API</p>
      </div>

      {/* New key revealed */}
      {newKey && (
        <div className="card border-[#fbbf24]/20 animate-in">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#150f00] border border-[#2a2000] flex items-center justify-center shrink-0">
              <AlertTriangle size={16} className="text-[#fbbf24]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-[#fbbf24] mb-0.5">Save this key now</p>
              <p className="text-xs text-[#8fb898] mb-3">This is the only time we'll show you the full key. Copy it and store it securely.</p>
              <div className="flex items-center gap-2 bg-[#0a1209] border border-[#1c2e20] rounded-xl px-3 py-2.5">
                <code className="flex-1 text-xs font-mono text-[#25D366] break-all select-all">
                  {showKey ? newKey : newKey.slice(0, 12) + '•'.repeat(24)}
                </code>
                <button onClick={() => setShowKey(!showKey)} className="btn-icon shrink-0">
                  {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
                <button onClick={() => copy(newKey)} className="btn-icon shrink-0">
                  {copied ? <Check size={14} className="text-[#25D366]" /> : <Copy size={14} />}
                </button>
              </div>
              <button onClick={() => setNewKey(null)} className="text-xs text-[#5a7a62] hover:text-[#8fb898] mt-2 transition-colors">
                I've saved it safely →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create form */}
      <div className="card">
        <h2 className="text-sm font-semibold text-[#a8c4ae] mb-4">Create new API key</h2>
        <form onSubmit={create} className="flex gap-3">
          <input className="input flex-1" value={name} onChange={e => setName(e.target.value)}
            placeholder="e.g. Production app, Staging, Testing" required />
          <button type="submit" disabled={creating} className="btn-primary shrink-0">
            {creating ? <div className="w-4 h-4 border-2 border-[#061008] border-t-transparent rounded-full animate-spin" /> : <Plus size={15} />}
            Create key
          </button>
        </form>
      </div>

      {/* Delete confirm */}
      {deleteConfirm && (
        <div className="modal-backdrop" onClick={() => setDeleteConfirm(null)}>
          <div className="modal-box max-w-sm animate-in" onClick={e => e.stopPropagation()}>
            <h3 className="text-sm font-semibold text-[#dce8df] mb-2">Revoke API key?</h3>
            <p className="text-sm text-[#8fb898] mb-1">
              <span className="font-medium text-[#dce8df]">{deleteConfirm.name}</span>
            </p>
            <p className="text-sm text-[#8fb898] mb-5">Any applications using this key will stop working immediately.</p>
            <div className="flex gap-3">
              <button onClick={() => revoke(deleteConfirm.id)} className="btn-danger flex-1">Revoke key</button>
              <button onClick={() => setDeleteConfirm(null)} className="btn-secondary flex-1">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Keys list */}
      {keys.length === 0 ? (
        <div className="card py-10 text-center">
          <Key size={24} className="text-[#344a38] mx-auto mb-3" />
          <p className="text-sm text-[#5a7a62]">No API keys yet. Create one above.</p>
        </div>
      ) : (
        <div className="card overflow-hidden p-0">
          <table className="w-full text-sm">
            <thead className="border-b border-[#1c2e20]">
              <tr>
                {['Name', 'Key prefix', 'Last used', 'Created', ''].map(h => (
                  <th key={h} className="table-head">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {keys.map(k => (
                <tr key={k.id} className="table-row">
                  <td className="table-cell font-medium text-[#dce8df]">{k.name}</td>
                  <td className="table-cell">
                    <code className="text-xs font-mono text-[#5a7a62] bg-[#0a1209] border border-[#1c2e20] px-2 py-1 rounded-lg">
                      {k.key_prefix}••••••••
                    </code>
                  </td>
                  <td className="table-cell text-[#5a7a62] text-xs">
                    {k.last_used_at ? new Date(k.last_used_at).toLocaleDateString('en-IN') : 'Never'}
                  </td>
                  <td className="table-cell text-[#5a7a62] text-xs">
                    {new Date(k.created_at).toLocaleDateString('en-IN')}
                  </td>
                  <td className="table-cell">
                    <button onClick={() => setDeleteConfirm(k)} className="btn-ghost text-[#f87171] hover:text-[#f87171] text-xs gap-1">
                      <Trash2 size={12} /> Revoke
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Usage example */}
      <div className="card border-[#1a3518]">
        <h3 className="text-sm font-semibold text-[#4ade80] mb-3">How to use your API key</h3>
        <pre className="text-xs font-mono text-[#8fb898] bg-[#0a1209] border border-[#1c2e20] rounded-xl p-4 overflow-x-auto leading-relaxed whitespace-pre">{`curl -X POST https://wabulk-api.onrender.com/v1/messages/send \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "session_id": "your-wa-session-uuid",
    "template": "Hi {{name}}, your order is confirmed!",
    "messages": [
      { "to": "+919876543210", "vars": { "name": "Rahul" } }
    ]
  }'`}</pre>
      </div>
    </div>
  );
}
