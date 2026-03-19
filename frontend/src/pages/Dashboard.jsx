import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Send, CheckCircle2, XCircle, Zap, ArrowRight, TrendingUp } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import api from '../lib/api';
import { useAuthStore } from '../hooks/useAuth';

const PLAN_LIMITS = { free: 500, starter: 10000, pro: -1 };

const mockChartData = [
  { day: 'Mon', sent: 120 }, { day: 'Tue', sent: 340 }, { day: 'Wed', sent: 280 },
  { day: 'Thu', sent: 490 }, { day: 'Fri', sent: 620 }, { day: 'Sat', sent: 180 },
  { day: 'Sun', sent: 390 },
];

export default function Dashboard() {
  const { user } = useAuthStore();
  const [stats, setStats] = useState(null);
  const [campaigns, setCampaigns] = useState([]);

  useEffect(() => {
    api.get('/v1/messages/stats').then((r) => setStats(r.data)).catch(() => {});
    api.get('/v1/messages/campaigns?limit=5').then((r) => setCampaigns(r.data.campaigns || [])).catch(() => {});
  }, []);

  const limit = PLAN_LIMITS[user?.plan] || 500;
  const used = stats?.month_usage || 0;
  const pct = limit === -1 ? 0 : Math.min((used / limit) * 100, 100);

  const metricCards = [
    { label: 'Messages this month', value: used.toLocaleString(), icon: Send, color: 'text-wa' },
    { label: 'Delivered (30d)', value: (stats?.last_30_days?.delivered || 0).toLocaleString(), icon: CheckCircle2, color: 'text-[#4ade80]' },
    { label: 'Failed (30d)', value: (stats?.last_30_days?.failed || 0).toLocaleString(), icon: XCircle, color: 'text-[#f87171]' },
    { label: 'Total campaigns', value: (stats?.total_campaigns || 0).toLocaleString(), icon: Zap, color: 'text-[#facc15]' },
  ];

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-[#e8f0eb]">
            Good {greeting()}, {user?.full_name?.split(' ')[0]} 👋
          </h1>
          <p className="text-sm text-[#6b8f72] mt-0.5">Here's your messaging overview</p>
        </div>
        <Link to="/campaigns" className="btn-primary flex items-center gap-2">
          <Send size={14} /> New campaign
        </Link>
      </div>

      {/* Plan usage bar */}
      {user?.plan !== 'pro' && (
        <div className="card mb-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-[#a8c4ae]">
              Monthly usage — <span className="text-wa font-medium capitalize">{user?.plan}</span> plan
            </span>
            <span className="text-sm text-[#6b8f72]">
              {used.toLocaleString()} / {limit.toLocaleString()} messages
            </span>
          </div>
          <div className="h-2 bg-[#1e2e22] rounded-full overflow-hidden">
            <div
              className="h-full bg-wa rounded-full transition-all duration-700"
              style={{ width: `${pct}%`, background: pct > 85 ? '#f87171' : '#25D366' }}
            />
          </div>
          {pct > 80 && (
            <p className="text-xs text-[#f87171] mt-2 flex items-center gap-1">
              <TrendingUp size={12} /> Running low —{' '}
              <Link to="/billing" className="underline">upgrade your plan</Link>
            </p>
          )}
        </div>
      )}

      {/* Metric cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {metricCards.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="card">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs text-[#6b8f72] uppercase tracking-wide">{label}</span>
              <Icon size={16} className={color} />
            </div>
            <div className="text-2xl font-semibold text-[#e8f0eb]">{value}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Chart */}
        <div className="card lg:col-span-2">
          <h2 className="text-sm font-medium text-[#a8c4ae] mb-4">Messages sent — last 7 days</h2>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={mockChartData}>
              <defs>
                <linearGradient id="sentGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#25D366" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#25D366" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="day" tick={{ fill: '#6b8f72', fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#6b8f72', fontSize: 12 }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ background: '#111a14', border: '1px solid #1e2e22', borderRadius: 8, fontSize: 12 }}
                labelStyle={{ color: '#a8c4ae' }}
                itemStyle={{ color: '#25D366' }}
              />
              <Area type="monotone" dataKey="sent" stroke="#25D366" strokeWidth={2} fill="url(#sentGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Recent campaigns */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-medium text-[#a8c4ae]">Recent campaigns</h2>
            <Link to="/campaigns" className="text-xs text-[#6b8f72] hover:text-wa flex items-center gap-1">
              All <ArrowRight size={12} />
            </Link>
          </div>
          {campaigns.length === 0 ? (
            <div className="text-center py-8">
              <Send size={24} className="text-[#3a5040] mx-auto mb-2" />
              <p className="text-sm text-[#3a5040]">No campaigns yet</p>
              <Link to="/campaigns" className="text-xs text-wa mt-2 inline-block hover:underline">
                Send your first one →
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {campaigns.map((c) => (
                <Link key={c.id} to={`/campaigns/${c.id}`}
                  className="flex items-center justify-between hover:bg-[#0d1610] -mx-2 px-2 py-1.5 rounded-lg transition-colors">
                  <div>
                    <div className="text-sm text-[#e8f0eb] truncate max-w-[140px]">{c.name}</div>
                    <div className="text-xs text-[#6b8f72]">{c.total_recipients} recipients</div>
                  </div>
                  <StatusBadge status={c.status} />
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }) {
  const map = {
    completed: 'badge-success',
    sending: 'badge-info',
    queued: 'badge-warn',
    failed: 'badge-danger',
    cancelled: 'badge-danger',
  };
  return <span className={map[status] || 'badge-info'}>{status}</span>;
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}
