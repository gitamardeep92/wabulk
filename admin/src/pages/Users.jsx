import React, { useEffect, useState } from 'react';
import { Search, ChevronDown } from 'lucide-react';
import api from '../lib/api';
import toast from 'react-hot-toast';

const PLANS = ['free', 'starter', 'pro'];
const STATUSES = ['active', 'suspended'];

export default function Users() {
  const [users, setUsers] = useState([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [planFilter, setPlanFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState(null); // { id, plan, status }

  const load = async () => {
    const params = new URLSearchParams({ page, limit: 50 });
    if (search) params.set('search', search);
    if (planFilter) params.set('plan', planFilter);
    if (statusFilter) params.set('status', statusFilter);
    const { data } = await api.get(`/admin-api/users?${params}`);
    setUsers(data.users);
    setTotal(data.total);
  };

  useEffect(() => { load(); }, [page, planFilter, statusFilter]);

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1);
    load();
  };

  const saveUser = async () => {
    try {
      await api.put(`/admin-api/users/${editing.id}`, { plan: editing.plan, status: editing.status });
      toast.success('User updated');
      setEditing(null);
      load();
    } catch {
      toast.error('Update failed');
    }
  };

  const planBadge = (plan) => {
    const map = { free: 'badge-gray', starter: 'badge-info', pro: 'badge-warn' };
    return <span className={map[plan] || 'badge-gray'}>{plan}</span>;
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-[#e2e8f0]">Users</h1>
          <p className="text-sm text-[#4a6582] mt-0.5">{total} total accounts</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-5">
        <form onSubmit={handleSearch} className="flex gap-2 flex-1 max-w-sm">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#2a3a4a]" />
            <input className="input pl-8" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by email..." />
          </div>
          <button type="submit" className="btn-secondary">Search</button>
        </form>
        <select className="input w-36" value={planFilter} onChange={(e) => { setPlanFilter(e.target.value); setPage(1); }}>
          <option value="">All plans</option>
          {PLANS.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <select className="input w-36" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}>
          <option value="">All statuses</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {/* Edit modal */}
      {editing && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-[#0d1520] border border-[#162030] rounded-xl p-6 w-full max-w-sm">
            <h2 className="text-base font-semibold text-[#e2e8f0] mb-1">Edit user</h2>
            <p className="text-sm text-[#4a6582] mb-4">{editing.email}</p>
            <div className="space-y-3 mb-5">
              <div>
                <label className="label">Plan</label>
                <select className="input" value={editing.plan}
                  onChange={(e) => setEditing((u) => ({ ...u, plan: e.target.value }))}>
                  {PLANS.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Status</label>
                <select className="input" value={editing.status}
                  onChange={(e) => setEditing((u) => ({ ...u, status: e.target.value }))}>
                  {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={saveUser} className="btn-primary flex-1">Save changes</button>
              <button onClick={() => setEditing(null)} className="btn-secondary flex-1">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="card overflow-hidden p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#162030]">
              {['Name', 'Email', 'Company', 'Plan', 'Status', 'Joined', 'Actions'].map((h) => (
                <th key={h} className="text-left px-4 py-3 text-xs font-medium text-[#4a6582] uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="table-row">
                <td className="px-4 py-3 font-medium text-[#e2e8f0]">{u.full_name}</td>
                <td className="px-4 py-3 text-[#94a3b8]">{u.email}</td>
                <td className="px-4 py-3 text-[#4a6582] text-xs">{u.company || '—'}</td>
                <td className="px-4 py-3">{planBadge(u.plan)}</td>
                <td className="px-4 py-3">
                  {u.status === 'active'
                    ? <span className="badge-success">active</span>
                    : <span className="badge-danger">suspended</span>}
                </td>
                <td className="px-4 py-3 text-[#4a6582] text-xs">
                  {new Date(u.created_at).toLocaleDateString('en-IN')}
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => setEditing({ ...u })}
                    className="btn-ghost text-xs flex items-center gap-1">
                    Edit <ChevronDown size={12} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {users.length === 0 && (
          <div className="text-center py-12 text-[#2a3a4a]">No users found</div>
        )}
      </div>

      {total > 50 && (
        <div className="flex justify-between items-center mt-4 text-sm text-[#4a6582]">
          <span>Page {page} · {total} total</span>
          <div className="flex gap-2">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="btn-secondary disabled:opacity-40">Prev</button>
            <button onClick={() => setPage((p) => p + 1)} disabled={page * 50 >= total} className="btn-secondary disabled:opacity-40">Next</button>
          </div>
        </div>
      )}
    </div>
  );
}
