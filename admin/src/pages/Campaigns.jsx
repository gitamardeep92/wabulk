import React, { useEffect, useState } from 'react';
import api from '../lib/api';
import toast from 'react-hot-toast';

// ─── Campaigns ───────────────────────────────────────────────
export function Campaigns() {
  const [campaigns, setCampaigns] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);

  const load = () =>
    api.get(`/admin-api/campaigns?page=${page}&limit=50`)
      .then((r) => { setCampaigns(r.data.campaigns); setTotal(r.data.total); });

  useEffect(() => { load(); }, [page]);

  const cancel = async (id) => {
    if (!confirm('Cancel this campaign? Queued messages will be marked failed.')) return;
    await api.put(`/admin-api/campaigns/${id}/cancel`);
    toast.success('Campaign cancelled');
    load();
  };

  const statusBadge = (s) => {
    const m = { completed: 'badge-success', sending: 'badge-info', queued: 'badge-warn', failed: 'badge-danger', cancelled: 'badge-gray' };
    return <span className={m[s] || 'badge-gray'}>{s}</span>;
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-[#e2e8f0]">All campaigns</h1>
        <p className="text-sm text-[#4a6582] mt-0.5">{total} total</p>
      </div>
      <div className="card overflow-hidden p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#162030]">
              {['Campaign', 'User', 'WA number', 'Sent', 'Delivered', 'Failed', 'Status', 'Date', ''].map((h) => (
                <th key={h} className="text-left px-4 py-3 text-xs font-medium text-[#4a6582] uppercase">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {campaigns.map((c) => (
              <tr key={c.id} className="table-row">
                <td className="px-4 py-3 font-medium text-[#e2e8f0] max-w-[140px] truncate">{c.name}</td>
                <td className="px-4 py-3 text-[#4a6582] text-xs">{c.users?.email}</td>
                <td className="px-4 py-3 text-[#4a6582] text-xs font-mono">{c.wa_sessions?.phone_number || '—'}</td>
                <td className="px-4 py-3 text-[#94a3b8]">{c.sent_count}</td>
                <td className="px-4 py-3 text-[#4ade80]">{c.delivered_count}</td>
                <td className="px-4 py-3 text-[#f87171]">{c.failed_count}</td>
                <td className="px-4 py-3">{statusBadge(c.status)}</td>
                <td className="px-4 py-3 text-[#4a6582] text-xs">{new Date(c.created_at).toLocaleDateString('en-IN')}</td>
                <td className="px-4 py-3">
                  {['queued', 'sending'].includes(c.status) && (
                    <button onClick={() => cancel(c.id)} className="btn-ghost text-[#f87171] hover:text-[#f87171] text-xs">Cancel</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {campaigns.length === 0 && <div className="text-center py-12 text-[#2a3a4a]">No campaigns</div>}
      </div>
      {total > 50 && (
        <div className="flex justify-between mt-4 text-sm text-[#4a6582]">
          <span>Page {page}</span>
          <div className="flex gap-2">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="btn-secondary disabled:opacity-40">Prev</button>
            <button onClick={() => setPage((p) => p + 1)} disabled={page * 50 >= total} className="btn-secondary disabled:opacity-40">Next</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Sessions ────────────────────────────────────────────────
export function Sessions() {
  const [sessions, setSessions] = useState([]);

  useEffect(() => {
    api.get('/admin-api/sessions').then((r) => setSessions(r.data.sessions));
  }, []);

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-[#e2e8f0]">WhatsApp sessions</h1>
        <p className="text-sm text-[#4a6582] mt-0.5">{sessions.length} sessions across all users</p>
      </div>
      <div className="card overflow-hidden p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#162030]">
              {['User', 'Phone number', 'Display name', 'Status', 'Connected', 'Created'].map((h) => (
                <th key={h} className="text-left px-4 py-3 text-xs font-medium text-[#4a6582] uppercase">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sessions.map((s) => (
              <tr key={s.id} className="table-row">
                <td className="px-4 py-3 text-xs text-[#4a6582]">{s.users?.email}</td>
                <td className="px-4 py-3 font-mono text-xs text-[#94a3b8]">{s.phone_number || '—'}</td>
                <td className="px-4 py-3 text-[#94a3b8]">{s.display_name || '—'}</td>
                <td className="px-4 py-3">
                  {s.status === 'connected'
                    ? <span className="badge-success">connected</span>
                    : s.status === 'pending'
                    ? <span className="badge-warn">pending</span>
                    : <span className="badge-danger">disconnected</span>}
                </td>
                <td className="px-4 py-3 text-xs text-[#4a6582]">
                  {s.connected_at ? new Date(s.connected_at).toLocaleDateString('en-IN') : '—'}
                </td>
                <td className="px-4 py-3 text-xs text-[#4a6582]">
                  {new Date(s.created_at).toLocaleDateString('en-IN')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {sessions.length === 0 && <div className="text-center py-12 text-[#2a3a4a]">No sessions</div>}
      </div>
    </div>
  );
}

// ─── PlanLimits ──────────────────────────────────────────────
export function PlanLimits() {
  const [limits, setLimits] = useState([]);
  const [editing, setEditing] = useState(null);

  const load = () => api.get('/admin-api/plan-limits').then((r) => setLimits(r.data.limits));
  useEffect(() => { load(); }, []);

  const save = async () => {
    try {
      await api.put(`/admin-api/plan-limits/${editing.plan}`, editing);
      toast.success(`${editing.plan} plan updated`);
      setEditing(null);
      load();
    } catch {
      toast.error('Failed to update');
    }
  };

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-[#e2e8f0]">Plan limits</h1>
        <p className="text-sm text-[#4a6582] mt-0.5">Edit quotas and pricing for each plan</p>
      </div>

      {editing && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-[#0d1520] border border-[#162030] rounded-xl p-6 w-full max-w-sm">
            <h2 className="text-base font-semibold text-[#e2e8f0] mb-4 capitalize">{editing.plan} plan</h2>
            <div className="space-y-3 mb-5">
              {[
                { key: 'monthly_messages', label: 'Monthly messages (-1 = unlimited)' },
                { key: 'max_sessions', label: 'Max WA numbers' },
                { key: 'api_calls_per_minute', label: 'API calls per minute' },
                { key: 'price_inr', label: 'Price (₹/month)' },
              ].map(({ key, label }) => (
                <div key={key}>
                  <label className="label">{label}</label>
                  <input className="input" type="number" value={editing[key]}
                    onChange={(e) => setEditing((l) => ({ ...l, [key]: +e.target.value }))} />
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <button onClick={save} className="btn-primary flex-1">Save</button>
              <button onClick={() => setEditing(null)} className="btn-secondary flex-1">Cancel</button>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {limits.map((l) => (
          <div key={l.plan} className="card">
            <div className="flex items-center justify-between mb-3">
              <span className="text-base font-semibold text-[#e2e8f0] capitalize">{l.plan}</span>
              <button onClick={() => setEditing({ ...l })} className="btn-secondary text-xs">Edit</button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Monthly messages', value: l.monthly_messages === -1 ? 'Unlimited' : l.monthly_messages.toLocaleString() },
                { label: 'Max sessions', value: l.max_sessions },
                { label: 'API calls/min', value: l.api_calls_per_minute },
                { label: 'Price', value: `₹${l.price_inr}/mo` },
                { label: 'Scheduled sending', value: l.scheduled_sending ? '✓' : '✗' },
                { label: 'Webhooks', value: l.webhooks ? '✓' : '✗' },
              ].map(({ label, value }) => (
                <div key={label} className="bg-[#0a1420] border border-[#162030] rounded-lg px-3 py-2">
                  <div className="text-xs text-[#4a6582]">{label}</div>
                  <div className="text-sm font-medium text-[#e2e8f0] mt-0.5">{value}</div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── AuditLog ────────────────────────────────────────────────
export function AuditLog() {
  const [logs, setLogs] = useState([]);

  useEffect(() => {
    api.get('/admin-api/logs').then((r) => setLogs(r.data.logs));
  }, []);

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-[#e2e8f0]">Audit log</h1>
        <p className="text-sm text-[#4a6582] mt-0.5">Last 100 admin actions</p>
      </div>
      <div className="card overflow-hidden p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#162030]">
              {['Admin', 'Action', 'Target', 'Details', 'Time'].map((h) => (
                <th key={h} className="text-left px-4 py-3 text-xs font-medium text-[#4a6582] uppercase">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {logs.map((l) => (
              <tr key={l.id} className="table-row">
                <td className="px-4 py-3 text-xs text-[#94a3b8]">{l.admin_email}</td>
                <td className="px-4 py-3">
                  <span className="badge-info font-mono text-[10px]">{l.action}</span>
                </td>
                <td className="px-4 py-3 text-xs text-[#4a6582] font-mono">
                  {l.target_type && `${l.target_type}:${l.target_id?.slice(0, 8)}...`}
                </td>
                <td className="px-4 py-3 text-xs text-[#4a6582] max-w-[200px] truncate">
                  {l.details ? JSON.stringify(l.details) : '—'}
                </td>
                <td className="px-4 py-3 text-xs text-[#2a3a4a]">
                  {new Date(l.created_at).toLocaleString('en-IN')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {logs.length === 0 && <div className="text-center py-12 text-[#2a3a4a]">No audit logs yet</div>}
      </div>
    </div>
  );
}

export default Campaigns;
