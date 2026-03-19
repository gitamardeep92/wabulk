import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Send, Plus, ChevronRight, Users, CheckCircle2, XCircle, Clock, AlertCircle } from 'lucide-react';
import api from '../lib/api';
import toast from 'react-hot-toast';
import { renderTemplate, extractVariables } from '../lib/templateUtils';

const statusMap = {
  completed: 'badge-success', sending: 'badge-info',
  queued: 'badge-warn', failed: 'badge-danger', cancelled: 'badge-gray',
};

export default function Campaigns() {
  const [campaigns, setCampaigns] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({ session_id: '', template_id: '', campaign_name: '', custom_template: '', delay_ms: 3000 });
  const [recipientsText, setRecipientsText] = useState('');
  const [parsedMessages, setParsedMessages] = useState([]);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    Promise.all([
      api.get('/v1/messages/campaigns').then(r => setCampaigns(r.data.campaigns || [])),
      api.get('/templates').then(r => setTemplates(r.data.templates || [])),
      api.get('/sessions').then(r => setSessions(r.data.sessions?.filter(s => s.status === 'connected') || [])),
    ]).finally(() => setLoading(false));
  }, []);

  const selectedTemplate = templates.find(t => t.id === form.template_id);
  const templateBody = selectedTemplate?.body || form.custom_template;
  const vars = extractVariables(templateBody);

  const parseRecipients = () => {
    try {
      const lines = recipientsText.trim().split('\n').filter(Boolean);
      if (!lines.length) return toast.error('No data entered');
      let messages = [];
      if (recipientsText.trim().startsWith('[')) {
        messages = JSON.parse(recipientsText);
      } else {
        const [header, ...rows] = lines;
        const headers = header.split(',').map(h => h.trim());
        if (!headers.includes('to')) return toast.error('CSV must have a "to" column in header row');
        messages = rows.map(row => {
          const vals = row.split(',').map(v => v.trim());
          const obj = {};
          headers.forEach((h, i) => (obj[h] = vals[i] || ''));
          return { to: obj.to, vars: obj };
        });
      }
      const valid = messages.filter(m => m.to && /^\+?[0-9]{7,15}$/.test(m.to.replace(/\s/g, '')));
      if (!valid.length) return toast.error('No valid phone numbers found. Make sure numbers are in +91XXXXXXXXXX format');
      setParsedMessages(valid);
      toast.success(`${valid.length} recipient${valid.length > 1 ? 's' : ''} ready`);
      setStep(3);
    } catch {
      toast.error('Invalid format. Use CSV with header row or JSON array.');
    }
  };

  const submit = async () => {
    if (!form.session_id) return toast.error('Select a WhatsApp number');
    if (!templateBody) return toast.error('Select or write a template');
    if (!parsedMessages.length) return toast.error('Add recipients first');
    setSending(true);
    try {
      const { data } = await api.post('/v1/messages/send', {
        session_id: form.session_id,
        template: templateBody,
        messages: parsedMessages,
        delay_ms: form.delay_ms,
        campaign_name: form.campaign_name || undefined,
      });
      toast.success(`${data.queued} messages queued!`);
      setShowForm(false);
      setStep(1);
      setParsedMessages([]);
      setRecipientsText('');
      setForm({ session_id: '', template_id: '', campaign_name: '', custom_template: '', delay_ms: 3000 });
      const r = await api.get('/v1/messages/campaigns');
      setCampaigns(r.data.campaigns || []);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Send failed');
    } finally {
      setSending(false);
    }
  };

  const estimatedTime = Math.ceil((parsedMessages.length * form.delay_ms) / 60000);

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-5 animate-in">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="page-title">Campaigns</h1>
          <p className="page-subtitle">Send personalized bulk notifications to your users</p>
        </div>
        {!showForm && (
          <button onClick={() => { setShowForm(true); setStep(1); }} className="btn-primary">
            <Plus size={15} /> New campaign
          </button>
        )}
      </div>

      {/* Campaign form */}
      {showForm && (
        <div className="card border-[#25D366]/20 animate-in">
          {/* Steps */}
          <div className="flex items-center gap-2 mb-6">
            {['Setup', 'Recipients', 'Review & Send'].map((s, i) => (
              <React.Fragment key={s}>
                <div className={`flex items-center gap-2 text-xs font-medium ${step === i + 1 ? 'text-[#25D366]' : step > i + 1 ? 'text-[#4ade80]' : 'text-[#3a5040]'}`}>
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-semibold border ${step === i + 1 ? 'border-[#25D366] text-[#25D366] bg-[#0a1f0d]' : step > i + 1 ? 'border-[#4ade80] text-[#4ade80] bg-[#051a10]' : 'border-[#1c2e20] text-[#3a5040]'}`}>
                    {step > i + 1 ? '✓' : i + 1}
                  </div>
                  <span className="hidden sm:block">{s}</span>
                </div>
                {i < 2 && <div className="flex-1 h-px bg-[#1c2e20]" />}
              </React.Fragment>
            ))}
          </div>

          {/* Step 1 */}
          {step === 1 && (
            <div className="space-y-4 animate-in">
              <div>
                <label className="label">Campaign name <span className="text-[#344a38] normal-case font-normal">(optional)</span></label>
                <input className="input" value={form.campaign_name}
                  onChange={e => setForm(f => ({ ...f, campaign_name: e.target.value }))}
                  placeholder="October membership renewal" />
              </div>
              <div>
                <label className="label">Send from</label>
                {sessions.length === 0 ? (
                  <div className="flex items-center gap-3 p-3 bg-[#150f00] border border-[#2a2000] rounded-xl">
                    <AlertCircle size={16} className="text-[#fbbf24] shrink-0" />
                    <p className="text-sm text-[#a88a40]">No connected numbers. <Link to="/sessions" className="text-[#fbbf24] underline">Connect one first →</Link></p>
                  </div>
                ) : (
                  <select className="input" value={form.session_id}
                    onChange={e => setForm(f => ({ ...f, session_id: e.target.value }))}>
                    <option value="">Select WhatsApp number...</option>
                    {sessions.map(s => <option key={s.id} value={s.id}>{s.phone_number}{s.display_name ? ` (${s.display_name})` : ''}</option>)}
                  </select>
                )}
              </div>
              <div>
                <label className="label">Message template</label>
                <select className="input mb-2" value={form.template_id}
                  onChange={e => setForm(f => ({ ...f, template_id: e.target.value, custom_template: '' }))}>
                  <option value="">— Use a saved template —</option>
                  {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
                {!form.template_id && (
                  <>
                    <p className="text-xs text-[#5a7a62] mb-1.5">Or write a custom template:</p>
                    <textarea className="input font-mono text-xs h-20 resize-none"
                      value={form.custom_template}
                      onChange={e => setForm(f => ({ ...f, custom_template: e.target.value }))}
                      placeholder="Hi {{name}}, your {{plan}} expires on {{date}}." />
                  </>
                )}
                {vars.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    <span className="text-xs text-[#5a7a62]">Variables:</span>
                    {vars.map(v => <span key={v} className="text-xs font-mono text-[#25D366] bg-[#0a1f0d] border border-[#1c2e20] px-1.5 py-0.5 rounded">{`{{${v}}}`}</span>)}
                  </div>
                )}
              </div>
              <div>
                <label className="label">Delay between messages</label>
                <select className="input" value={form.delay_ms}
                  onChange={e => setForm(f => ({ ...f, delay_ms: +e.target.value }))}>
                  <option value={2000}>2 seconds — fast</option>
                  <option value={3000}>3 seconds — recommended</option>
                  <option value={5000}>5 seconds — safe</option>
                  <option value={8000}>8 seconds — very safe</option>
                </select>
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setStep(2)} disabled={!form.session_id || !templateBody} className="btn-primary disabled:opacity-40">
                  Next: Add recipients →
                </button>
                <button onClick={() => setShowForm(false)} className="btn-secondary">Cancel</button>
              </div>
            </div>
          )}

          {/* Step 2 */}
          {step === 2 && (
            <div className="space-y-4 animate-in">
              <div>
                <label className="label">Recipients</label>
                <div className="mb-3 p-3 bg-[#0a1209] rounded-xl border border-[#1c2e20]">
                  <p className="text-xs text-[#5a7a62] mb-2 font-semibold uppercase tracking-wider">CSV format</p>
                  <code className="text-xs font-mono text-[#25D366]">to,{vars.join(',') || 'name'}</code>
                  <br />
                  <code className="text-xs font-mono text-[#5a7a62]">+919876543210,{vars.map(v => `sample_${v}`).join(',') || 'Rahul'}</code>
                </div>
                <textarea className="input h-40 resize-y font-mono text-xs leading-relaxed"
                  value={recipientsText}
                  onChange={e => setRecipientsText(e.target.value)}
                  placeholder={`to,${vars.join(',') || 'name'}\n+919876543210,${vars.map(v => `sample_${v}`).join(',') || 'Rahul'}\n+918800001234,${vars.map(v => `sample_${v}`).join(',') || 'Priya'}`} />
                {parsedMessages.length > 0 && (
                  <p className="text-xs text-[#4ade80] mt-1.5 flex items-center gap-1">
                    <CheckCircle2 size={12} /> {parsedMessages.length} recipients ready
                  </p>
                )}
              </div>
              <div className="flex gap-3">
                <button onClick={parseRecipients} className="btn-primary">Parse recipients</button>
                <button onClick={() => setStep(1)} className="btn-secondary">← Back</button>
              </div>
            </div>
          )}

          {/* Step 3 */}
          {step === 3 && (
            <div className="space-y-4 animate-in">
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'Recipients', value: parsedMessages.length },
                  { label: 'Delay', value: `${form.delay_ms / 1000}s` },
                  { label: 'Est. time', value: estimatedTime < 1 ? '<1 min' : `~${estimatedTime}m` },
                ].map(({ label, value }) => (
                  <div key={label} className="bg-[#0a1209] border border-[#1c2e20] rounded-xl p-3 text-center">
                    <div className="text-xl font-semibold text-[#dce8df]">{value}</div>
                    <div className="text-xs text-[#5a7a62] mt-0.5">{label}</div>
                  </div>
                ))}
              </div>
              {parsedMessages[0] && (
                <div>
                  <label className="label">Preview (first recipient)</label>
                  <div className="bg-[#0a1209] border border-[#1c2e20] rounded-xl p-4">
                    <div className="text-xs text-[#5a7a62] mb-2 font-mono">To: {parsedMessages[0].to}</div>
                    <div className="text-sm text-[#dce8df] whitespace-pre-wrap font-mono">
                      {renderTemplate(templateBody, parsedMessages[0].vars || {})}
                    </div>
                  </div>
                </div>
              )}
              <div className="flex gap-3">
                <button onClick={submit} disabled={sending} className="btn-primary flex-1">
                  {sending && <div className="w-4 h-4 border-2 border-[#061008] border-t-transparent rounded-full animate-spin" />}
                  <Send size={14} /> Send {parsedMessages.length} messages
                </button>
                <button onClick={() => setStep(2)} className="btn-secondary">← Back</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Campaigns table */}
      {loading ? (
        <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="skeleton h-14 rounded-2xl" />)}</div>
      ) : campaigns.length === 0 && !showForm ? (
        <div className="card py-16 text-center">
          <div className="w-14 h-14 rounded-2xl bg-[#0a1f0d] border border-[#1c2e20] flex items-center justify-center mx-auto mb-4">
            <Send size={24} className="text-[#25D366]" />
          </div>
          <h3 className="text-[#a8c4ae] font-semibold mb-1">No campaigns yet</h3>
          <p className="text-sm text-[#5a7a62] mb-5">Create your first bulk notification campaign</p>
          <button onClick={() => setShowForm(true)} className="btn-primary mx-auto">Create first campaign</button>
        </div>
      ) : campaigns.length > 0 && (
        <div className="card overflow-hidden p-0">
          <table className="w-full text-sm">
            <thead className="border-b border-[#1c2e20]">
              <tr>
                {['Campaign', 'Recipients', 'Sent', 'Delivered', 'Failed', 'Status', 'Date', ''].map(h => (
                  <th key={h} className="table-head">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {campaigns.map(c => (
                <tr key={c.id} className="table-row">
                  <td className="table-cell font-medium text-[#dce8df]">{c.name}</td>
                  <td className="table-cell text-[#8fb898]">{c.total_recipients}</td>
                  <td className="table-cell text-[#8fb898]">{c.sent_count}</td>
                  <td className="table-cell text-[#4ade80]">{c.delivered_count}</td>
                  <td className="table-cell text-[#f87171]">{c.failed_count}</td>
                  <td className="table-cell"><span className={statusMap[c.status] || 'badge-gray'}>{c.status}</span></td>
                  <td className="table-cell text-[#5a7a62] text-xs">{new Date(c.created_at).toLocaleDateString('en-IN')}</td>
                  <td className="table-cell">
                    <Link to={`/campaigns/${c.id}`} className="btn-ghost text-xs">
                      Details <ChevronRight size={12} />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
