// CampaignDetail.jsx
import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, XCircle, Clock, Send } from 'lucide-react';
import api from '../lib/api';

export default function CampaignDetail() {
  const { id } = useParams();
  const [data, setData] = useState(null);

  useEffect(() => {
    api.get(`/v1/messages/campaigns/${id}`).then((r) => setData(r.data));
    const iv = setInterval(() => {
      api.get(`/v1/messages/campaigns/${id}`).then((r) => setData(r.data));
    }, 5000);
    return () => clearInterval(iv);
  }, [id]);

  if (!data) return <div className="p-6"><div className="card h-48 animate-pulse" /></div>;

  const { campaign: c, messages } = data;
  const deliveryRate = c.sent_count ? Math.round((c.delivered_count / c.sent_count) * 100) : 0;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <Link to="/campaigns" className="btn-ghost flex items-center gap-2 mb-5 w-fit">
        <ArrowLeft size={14} /> Back to campaigns
      </Link>

      <div className="flex items-start justify-between mb-5">
        <div>
          <h1 className="text-xl font-semibold text-[#e8f0eb]">{c.name}</h1>
          <p className="text-sm text-[#6b8f72] mt-0.5">{new Date(c.created_at).toLocaleString()}</p>
        </div>
        <StatusBadge s={c.status} />
      </div>

      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total', value: c.total_recipients, icon: Send, color: 'text-[#a8c4ae]' },
          { label: 'Sent', value: c.sent_count, icon: Send, color: 'text-wa' },
          { label: 'Delivered', value: c.delivered_count, icon: CheckCircle2, color: 'text-[#4ade80]' },
          { label: 'Failed', value: c.failed_count, icon: XCircle, color: 'text-[#f87171]' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="card text-center">
            <Icon size={18} className={`${color} mx-auto mb-2`} />
            <div className="text-xl font-semibold text-[#e8f0eb]">{value}</div>
            <div className="text-xs text-[#6b8f72]">{label}</div>
          </div>
        ))}
      </div>

      {c.sent_count > 0 && (
        <div className="card mb-5">
          <div className="flex justify-between text-xs text-[#6b8f72] mb-1.5">
            <span>Delivery rate</span><span>{deliveryRate}%</span>
          </div>
          <div className="h-2 bg-[#1e2e22] rounded-full overflow-hidden">
            <div className="h-full bg-wa rounded-full" style={{ width: `${deliveryRate}%` }} />
          </div>
        </div>
      )}

      <div className="card overflow-hidden p-0">
        <div className="px-4 py-3 border-b border-[#1e2e22]">
          <span className="text-sm font-medium text-[#a8c4ae]">Messages ({messages.length})</span>
        </div>
        <div className="max-h-96 overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-[#111a14]">
              <tr className="border-b border-[#1e2e22]">
                {['To', 'Message', 'Status', 'Sent at'].map((h) => (
                  <th key={h} className="text-left px-4 py-2.5 text-xs font-medium text-[#6b8f72]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {messages.map((m) => (
                <tr key={m.id} className="table-row">
                  <td className="px-4 py-2.5 font-mono text-xs text-[#a8c4ae]">{m.to_number}</td>
                  <td className="px-4 py-2.5 text-[#6b8f72] text-xs max-w-xs truncate">{m.rendered_body}</td>
                  <td className="px-4 py-2.5"><MsgStatus s={m.status} /></td>
                  <td className="px-4 py-2.5 text-xs text-[#3a5040]">
                    {m.sent_at ? new Date(m.sent_at).toLocaleTimeString() : '—'}
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

function StatusBadge({ s }) {
  const map = { completed: 'badge-success', sending: 'badge-info', queued: 'badge-warn', failed: 'badge-danger', cancelled: 'badge-danger' };
  return <span className={map[s] || 'badge-info'}>{s}</span>;
}
function MsgStatus({ s }) {
  if (s === 'delivered') return <span className="text-[#4ade80] flex items-center gap-1 text-xs"><CheckCircle2 size={12} />delivered</span>;
  if (s === 'sent') return <span className="text-wa text-xs flex items-center gap-1"><Send size={12} />sent</span>;
  if (s === 'failed') return <span className="text-[#f87171] text-xs flex items-center gap-1"><XCircle size={12} />failed</span>;
  return <span className="text-[#6b8f72] text-xs flex items-center gap-1"><Clock size={12} />{s}</span>;
}
