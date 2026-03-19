import React, { useEffect, useState } from 'react';
import { Key, Plus, Trash2, Copy, Check, AlertTriangle } from 'lucide-react';
import api from '../lib/api';
import toast from 'react-hot-toast';

export default function ApiKeys() {
  const [keys, setKeys] = useState([]);
  const [newKey, setNewKey] = useState(null); // shown once after creation
  const [name, setName] = useState('');
  const [copied, setCopied] = useState(false);

  const load = () => api.get('/auth/api-keys').then((r) => setKeys(r.data.keys));
  useEffect(() => { load(); }, []);

  const create = async (e) => {
    e.preventDefault();
    try {
      const { data } = await api.post('/auth/api-keys', { name });
      setNewKey(data.key);
      setName('');
      load();
      toast.success('API key created');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed');
    }
  };

  const revoke = async (id) => {
    if (!confirm('Revoke this API key? It will stop working immediately.')) return;
    await api.delete(`/auth/api-keys/${id}`);
    toast.success('Key revoked');
    load();
  };

  const copy = (text) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-[#e8f0eb]">API Keys</h1>
        <p className="text-sm text-[#6b8f72] mt-0.5">Use these keys to authenticate API requests from your application</p>
      </div>

      {/* New key revealed */}
      {newKey && (
        <div className="card border-wa/30 mb-6">
          <div className="flex items-start gap-3">
            <AlertTriangle size={18} className="text-[#facc15] flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-[#facc15] mb-1">Save your key now — it won't be shown again</p>
              <div className="flex items-center gap-2 bg-[#0d1610] border border-[#1e2e22] rounded-lg px-3 py-2.5 mt-2">
                <code className="flex-1 text-xs font-mono text-wa break-all">{newKey}</code>
                <button onClick={() => copy(newKey)} className="btn-ghost flex-shrink-0 flex items-center gap-1">
                  {copied ? <Check size={14} className="text-[#4ade80]" /> : <Copy size={14} />}
                </button>
              </div>
              <button onClick={() => setNewKey(null)} className="text-xs text-[#6b8f72] mt-2 hover:text-[#a8c4ae]">
                I've saved it, dismiss
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create form */}
      <div className="card mb-6">
        <h2 className="text-sm font-medium text-[#a8c4ae] mb-3">Create new key</h2>
        <form onSubmit={create} className="flex gap-2">
          <input className="input flex-1" value={name} onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Production app, Testing" required />
          <button type="submit" className="btn-primary flex items-center gap-2 whitespace-nowrap">
            <Plus size={14} /> Create key
          </button>
        </form>
      </div>

      {/* Keys list */}
      {keys.length === 0 ? (
        <div className="card text-center py-12">
          <Key size={32} className="text-[#3a5040] mx-auto mb-3" />
          <p className="text-sm text-[#3a5040]">No API keys yet</p>
        </div>
      ) : (
        <div className="card overflow-hidden p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#1e2e22]">
                {['Name', 'Key', 'Last used', 'Created', ''].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-medium text-[#6b8f72] uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {keys.map((k) => (
                <tr key={k.id} className="table-row">
                  <td className="px-4 py-3 font-medium text-[#e8f0eb]">{k.name}</td>
                  <td className="px-4 py-3">
                    <code className="text-xs font-mono text-[#6b8f72] bg-[#0d1610] px-2 py-1 rounded">
                      {k.key_prefix}••••••••
                    </code>
                  </td>
                  <td className="px-4 py-3 text-[#6b8f72] text-xs">
                    {k.last_used_at ? new Date(k.last_used_at).toLocaleDateString() : 'Never'}
                  </td>
                  <td className="px-4 py-3 text-[#6b8f72] text-xs">
                    {new Date(k.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => revoke(k.id)} className="btn-ghost text-[#f87171] hover:text-[#f87171] flex items-center gap-1">
                      <Trash2 size={12} /> Revoke
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Usage note */}
      <div className="card mt-5 border-[#1a3050]">
        <h3 className="text-sm font-medium text-[#60a5fa] mb-2">How to use your API key</h3>
        <code className="block text-xs font-mono text-[#a8c4ae] bg-[#0d1610] px-3 py-2.5 rounded border border-[#1e2e22] whitespace-pre">{`curl -X POST https://api.wabulk.com/v1/messages/send \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "session_id": "uuid-of-your-wa-number",
    "template": "Hi {{name}}, your order is confirmed!",
    "messages": [
      { "to": "+919876543210", "vars": { "name": "Rahul" } }
    ]
  }'`}</code>
      </div>
    </div>
  );
}
