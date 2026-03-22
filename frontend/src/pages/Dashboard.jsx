import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Send, XCircle, Zap, ArrowRight, Plus, Smartphone, Key, TrendingUp, Activity } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import api from '../lib/api';
import { useAuthStore } from '../hooks/useAuth';

const PLAN_LIMITS = { free: 500, starter: 10000, pro: -1 };

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export default function Dashboard() {
  const { user } = useAuthStore();
  const [stats, setStats] = useState(null);
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/v1/messages/stats').then(r => setStats(r.data)).catch(() => {}),
      api.get('/v1/messages/campaigns?limit=5').then(r => setCampaigns(r.data.campaigns || [])).catch(() => {}),
    ]).finally(() => setLoading(false));
  }, []);

  const limit = PLAN_LIMITS[user?.plan] || 500;
  const used = stats?.month_usage || 0;
  const pct = limit === -1 ? 5 : Math.min((used / limit) * 100, 100);

  const statusMap = {
    completed: 'badge-success', sending: 'badge-info',
    queued: 'badge-warn', failed: 'badge-danger', cancelled: 'badge-gray',
  };

  const chartData = [
    { day: 'Mon', sent: 0 }, { day: 'Tue', sent: 0 }, { day: 'Wed', sent: 0 },
    { day: 'Thu', sent: 0 }, { day: 'Fri', sent: 0 }, { day: 'Sat', sent: 0 }, { day: 'Sun', sent: 0 },
  ];

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-4 md:space-y-6 animate-in">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="page-title text-lg md:text-xl">{greeting()}, {user?.full_name?.split(' ')[0]} 👋</h1>
          <p className="page-subtitle hidden sm:block">Here's what's happening with your campaigns</p>
        </div>
        <Link to="/campaigns" className="btn-primary shrink-0 text-xs md:text-sm px-3 py-2 md:px-4 md:py-2.5">
          <Plus size={13} /> <span className="hidden sm:inline">New campaign</span><span className="sm:hidden">New</span>
        </Link>
      </div>

      {/* Usage bar */}
      {user?.plan !== 'pro' && (
        <div className="card">
          <div className="flex items-center justify-between mb-2.5">
            <div className="flex items-center gap-2 flex-wrap">
              <Activity size={13} className="text-[#5a7a62]" />
              <span className="text-xs md:text-sm font-medium text-[#a8c4ae]">Monthly usage</span>
              <span className={`${user?.plan === 'free' ? 'badge-gray' : 'badge-info'} capitalize`}>{user?.plan}</span>
            </div>
            <span className="text-xs text-[#5a7a62]">
              <span className="font-semibold text-[#dce8df]">{used.toLocaleString()}</span>
              {' '}/ {limit === -1 ? '∞' : limit.toLocaleString()}
            </span>
          </div>
          <div className="h-1.5 bg-[#1c2e20] rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all duration-700"
              style={{ width: `${pct}%`, background: pct > 85 ? '#f87171' : pct > 60 ? '#fbbf24' : '#25D366' }} />
          </div>
          {pct > 80 && (
            <div className="flex items-center justify-between mt-2">
              <p className="text-xs text-[#f87171] flex items-center gap-1"><TrendingUp size={11} /> Running low</p>
              <Link to="/billing" className="text-xs text-[#25D366] hover:underline">Upgrade →</Link>
            </div>
          )}
        </div>
      )}

      {/* Stat cards — 3 cards now (removed Delivered) */}
      <div className="grid grid-cols-3 gap-3 md:gap-4">
        {[
          {
            label: 'Messages sent',
            value: loading ? '—' : used.toLocaleString(),
            icon: Send,
            bg: 'bg-[#0a1f0d]', color: 'text-[#25D366]',
            sub: 'this month',
          },
          {
            label: 'Sent (30d)',
            value: loading ? '—' : (stats?.last_30_days?.sent || 0).toLocaleString(),
            icon: Send,
            bg: 'bg-[#051a10]', color: 'text-[#4ade80]',
            sub: 'last 30 days',
          },
          {
            label: 'Failed',
            value: loading ? '—' : (stats?.last_30_days?.failed || 0).toLocaleString(),
            icon: XCircle,
            bg: 'bg-[#150606]', color: 'text-[#f87171]',
            sub: 'last 30 days',
          },
        ].map(({ label, value, icon: Icon, bg, color, sub }) => (
          <div key={label} className="card flex flex-col gap-2 p-3 md:p-5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] md:text-xs font-semibold text-[#5a7a62] uppercase tracking-wider leading-tight">{label}</span>
              <div className={`w-7 h-7 md:w-8 md:h-8 rounded-lg flex items-center justify-center shrink-0 ${bg} ${color}`}>
                <Icon size={13} />
              </div>
            </div>
            <div>
              <div className="text-xl md:text-2xl font-semibold text-[#dce8df]">{value}</div>
              <div className="text-[10px] md:text-xs text-[#5a7a62] mt-0.5">{sub}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Campaigns stat + chart */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-5">
        <div className="card lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-[#a8c4ae]">Activity — last 7 days</h2>
            <span className="text-xs text-[#344a38]">Messages sent</span>
          </div>
          <ResponsiveContainer width="100%" height={140}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#25D366" stopOpacity={0.2} />
                  <stop offset="100%" stopColor="#25D366" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="day" tick={{ fill: '#5a7a62', fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#5a7a62', fontSize: 10 }} axisLine={false} tickLine={false} width={20} />
              <Tooltip
                contentStyle={{ background: '#0f1810', border: '1px solid #1c2e20', borderRadius: 10, fontSize: 12 }}
                labelStyle={{ color: '#a8c4ae' }} itemStyle={{ color: '#25D366' }}
              />
              <Area type="monotone" dataKey="sent" stroke="#25D366" strokeWidth={2} fill="url(#g)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="space-y-3 md:space-y-4">
          {/* Campaigns total */}
          <div className="card flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-[#0f0d00] flex items-center justify-center shrink-0">
              <Zap size={16} className="text-[#fbbf24]" />
            </div>
            <div>
              <div className="text-2xl font-semibold text-[#dce8df]">{loading ? '—' : stats?.total_campaigns || 0}</div>
              <div className="text-xs text-[#5a7a62]">Total campaigns</div>
            </div>
          </div>

          {/* Recent campaigns */}
          <div className="card">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-[#a8c4ae]">Recent campaigns</h2>
              <Link to="/campaigns" className="text-xs text-[#5a7a62] hover:text-[#25D366] transition-colors">All →</Link>
            </div>
            {campaigns.length === 0 ? (
              <div className="py-4 text-center">
                <Send size={18} className="text-[#344a38] mx-auto mb-2" />
                <p className="text-xs text-[#3a5040]">No campaigns yet</p>
                <Link to="/campaigns" className="text-xs text-[#25D366] hover:underline mt-1 inline-block">Send first →</Link>
              </div>
            ) : (
              <div className="space-y-0.5">
                {campaigns.map(c => (
                  <Link key={c.id} to={`/campaigns/${c.id}`}
                    className="flex items-center justify-between py-2 px-2 -mx-2 rounded-lg hover:bg-[#0a1209] transition-colors">
                    <div className="min-w-0 flex-1 mr-2">
                      <div className="text-xs md:text-sm text-[#dce8df] truncate">{c.name}</div>
                      <div className="text-[10px] md:text-xs text-[#5a7a62]">{c.total_recipients} recipients</div>
                    </div>
                    <span className={`${statusMap[c.status] || 'badge-gray'} shrink-0`}>{c.status}</span>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Quick start */}
          <div className="card">
            <h2 className="text-sm font-semibold text-[#a8c4ae] mb-3">Quick start</h2>
            <div className="space-y-0.5">
              {[
                { to: '/sessions', icon: Smartphone, label: 'Connect WhatsApp' },
                { to: '/campaigns', icon: Send, label: 'Send campaign' },
                { to: '/api-keys', icon: Key, label: 'Get API key' },
              ].map(({ to, icon: Icon, label }) => (
                <Link key={to} to={to} className="flex items-center gap-3 py-2 px-2 -mx-2 rounded-lg hover:bg-[#0a1209] transition-colors group">
                  <Icon size={13} className="text-[#5a7a62] group-hover:text-[#25D366] shrink-0" />
                  <span className="text-xs md:text-sm text-[#8fb898]">{label}</span>
                  <ArrowRight size={11} className="ml-auto text-[#344a38] group-hover:text-[#5a7a62]" />
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
