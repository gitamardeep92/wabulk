import React, { useEffect, useState } from 'react';
import { Users, Send, Smartphone, TrendingUp, Activity } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import api from '../lib/api';

export default function Overview() {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    api.get('/admin-api/stats').then((r) => setStats(r.data)).catch(() => {});
  }, []);

  const campaignData = stats
    ? Object.entries(stats.campaignsByStatus || {}).map(([name, value]) => ({ name, value }))
    : [];

  const statusColors = {
    completed: '#4ade80', sending: '#60a5fa',
    queued: '#facc15', failed: '#f87171', cancelled: '#94a3b8',
  };

  const cards = [
    { label: 'Total users', value: stats?.totalUsers ?? '—', icon: Users, color: 'text-[#60a5fa]', bg: 'bg-[#0a1530]' },
    { label: 'New users (30d)', value: stats?.activeUsers ?? '—', icon: Activity, color: 'text-[#4ade80]', bg: 'bg-[#0a1f10]' },
    { label: 'Messages this month', value: stats?.monthMessages?.toLocaleString() ?? '—', icon: Send, color: 'text-[#a78bfa]', bg: 'bg-[#13102a]' },
    { label: 'Connected numbers', value: stats?.connectedSessions ?? '—', icon: Smartphone, color: 'text-[#fb923c]', bg: 'bg-[#1a1005]' },
  ];

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-[#e2e8f0]">Platform overview</h1>
        <p className="text-sm text-[#4a6582] mt-0.5">
          {new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {cards.map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="card">
            <div className={`w-9 h-9 ${bg} rounded-lg flex items-center justify-center mb-3`}>
              <Icon size={17} className={color} />
            </div>
            <div className="text-2xl font-semibold text-[#e2e8f0]">{value}</div>
            <div className="text-xs text-[#4a6582] mt-0.5">{label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="card">
          <h2 className="text-sm font-medium text-[#94a3b8] mb-4">Campaigns by status (last 30d)</h2>
          {campaignData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={campaignData} barSize={32}>
                <XAxis dataKey="name" tick={{ fill: '#4a6582', fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#4a6582', fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ background: '#0d1520', border: '1px solid #162030', borderRadius: 8, fontSize: 12 }}
                  labelStyle={{ color: '#94a3b8' }}
                />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {campaignData.map((entry) => (
                    <Cell key={entry.name} fill={statusColors[entry.name] || '#60a5fa'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-48 flex items-center justify-center text-[#2a3a4a] text-sm">No data yet</div>
          )}
        </div>

        <div className="card">
          <h2 className="text-sm font-medium text-[#94a3b8] mb-4">Quick actions</h2>
          <div className="space-y-2">
            {[
              { label: 'View all users', href: '/users', desc: 'Manage plans and access' },
              { label: 'Active campaigns', href: '/campaigns', desc: 'Monitor sending status' },
              { label: 'WA sessions', href: '/sessions', desc: 'Check connection health' },
              { label: 'Edit plan limits', href: '/plan-limits', desc: 'Adjust quotas and pricing' },
            ].map((a) => (
              <a key={a.href} href={a.href}
                className="flex items-center justify-between p-3 rounded-lg border border-[#162030] hover:border-[#1e3050] hover:bg-[#0a1420] transition-colors group">
                <div>
                  <div className="text-sm font-medium text-[#e2e8f0] group-hover:text-[#60a5fa] transition-colors">{a.label}</div>
                  <div className="text-xs text-[#4a6582]">{a.desc}</div>
                </div>
                <span className="text-[#2a3a4a] group-hover:text-[#60a5fa] text-lg transition-colors">→</span>
              </a>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
