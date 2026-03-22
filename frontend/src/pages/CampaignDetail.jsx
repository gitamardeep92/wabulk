import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, XCircle, Clock, Send, RefreshCw } from 'lucide-react';
import api from '../lib/api';

export default function CampaignDetail() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = () => api.get(`/v1/messages/campaigns/${id}`).then(r => { setData(r.data); setLoading(false); });

  useEffect(() => {
    load();
    const iv = setInterval(() => {
      api.get(`/v1/messages/campaigns/${id}`).then(r => setData(r.data)).catch(() => {});
    }, 5000);
    return () => clearInterval(iv);
  }, [id]);

  if (loading) return <div className="p-6 space-y-4">{[1,2].map(i => <div key={i} className="skeleton h-24 rounded-2xl" />)}</div>;
  if (!data) return <div className="p-6"><p className="text-[#5a7a62]">Campaign not found</p></div>;

  const { campaign: c, messages } = data;
  // Success rate = sent / total (no delivery tracking)
  const successRate = c.total_recipients > 0
    ? Math.round((c.sent_count / c.total_recipients) * 100) : 0;

  const statusMap = { completed: 'badge-success', sending: 'badge-info', queued: 'badge-warn', failed: 'badge-danger', cancelled: 'badge-gray' };

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-4 md:space-y-5 animate-in">
      <div className="flex items-center gap-3">
        <Link to="/campaigns" className="btn-icon"><ArrowLeft size={16} /></Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="page-title truncate">{c.name}</h1>
            <span className={statusMap[c.status] || 'badge-gray'}>{c.status}</span>
          </div>
          <p className="page-subtitle">{new Date(c.created_at).toLocaleString('en-IN')}</p>
        </div>
        {['sending', 'queued'].includes(c.status) && (
          <div className="flex items-center gap-2 text-xs text-[#25D366]">
            <div className="w-2 h-2 rounded-full bg-[#25D366] animate-pulse" />
            Live
          </div>
        )}
      </div>

      {/* Stats — 3 cards, no Delivered */}
      <div className="grid grid-cols-3 gap-3 md:gap-4">
        {[
          { label: 'Total', value: c.total_recipients, icon: Send, color: 'text-[#8fb898]' },
          { label: 'Sent', value: c.sent_count, icon: Send, color: 'text-[#25D366]' },
          { label: 'Failed', value: c.failed_count, icon: XCircle, color: 'text-[#f87171]' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="card text-center p-3 md:p-5">
            <Icon size={16} className={`${color} mx-auto mb-2`} />
            <div className="text-xl font-semibold text-[#dce8df]">{value}</div>
            <div className="text-xs text-[#5a7a62]">{label}</div>
          </div>
        ))}
      </div>

      {c.sent_count > 0 && (
        <div className="card">
          <div className="flex justify-between text-xs text-[#5a7a62] mb-2">
            <span>Success rate</span>
            <span className="font-semibold text-[#dce8df]">{successRate}%</span>
          </div>
          <div className="h-2 bg-[#1c2e20] rounded-full overflow-hidden">
            <div className="h-full bg-[#25D366] rounded-full transition-all duration-700" style={{ width: `${successRate}%` }} />
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="card overflow-hidden p-0">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#1c2e20]">
          <span className="text-sm font-semibold text-[#a8c4ae]">Messages ({messages.length})</span>
          <button onClick={load} className="btn-ghost text-xs gap-1"><RefreshCw size={11} /> Refresh</button>
        </div>
        <div className="max-h-96 overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-[#0f1810] border-b border-[#1c2e20]">
              <tr>
                {['To', 'Message', 'Status', 'Time'].map(h => <th key={h} className="table-head">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {messages.map(m => (
                <tr key={m.id} className="table-row">
                  <td className="table-cell font-mono text-xs text-[#a8c4ae]">{m.to_number}</td>
                  <td className="table-cell text-[#5a7a62] text-xs max-w-xs truncate">{m.rendered_body}</td>
                  <td className="table-cell">
                    {m.status === 'sent' && <span className="badge-success"><Send size={10} />Sent</span>}
                    {m.status === 'sending' && <span className="badge-info"><Clock size={10} />Sending</span>}
                    {m.status === 'queued' && <span className="badge-warn"><Clock size={10} />Queued</span>}
                    {m.status === 'failed' && <span className="badge-danger"><XCircle size={10} />Failed</span>}
                  </td>
                  <td className="table-cell text-xs text-[#3a5040]">
                    {m.sent_at ? new Date(m.sent_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
