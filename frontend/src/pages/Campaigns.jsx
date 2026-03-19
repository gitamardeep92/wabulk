import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Send, Plus, ChevronRight, Users, CheckCircle2, XCircle } from 'lucide-react';
import api from '../lib/api';
import toast from 'react-hot-toast';
import { renderTemplate, extractVariables } from '../lib/templateUtils';

export default function Campaigns() {
  const [campaigns, setCampaigns] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    session_id: '', template_id: '', campaign_name: '',
    custom_template: '', delay_ms: 3000,
  });
  const [recipientsText, setRecipientsText] = useState('');
  const [parsedMessages, setParsedMessages] = useState([]);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    api.get('/v1/messages/campaigns').then((r) => setCampaigns(r.data.campaigns || []));
    api.get('/templates').then((r) => setTemplates(r.data.templates || []));
    api.get('/sessions').then((r) => setSessions(r.data.sessions?.filter((s) => s.status === 'connected') || []));
  }, []);

  const selectedTemplate = templates.find((t) => t.id === form.template_id);
  const templateBody = selectedTemplate?.body || form.custom_template;
  const vars = extractVariables(templateBody);

  // Parse recipients CSV/JSON input
  const parseRecipients = () => {
    try {
      const lines = recipientsText.trim().split('\n').filter(Boolean);
      if (!lines.length) return toast.error('No recipients entered');

      // Try JSON array first
      let messages = [];
      if (recipientsText.trim().startsWith('[')) {
        messages = JSON.parse(recipientsText);
      } else {
        // CSV: first line is header (to, name, plan, ...)
        const [headerLine, ...rows] = lines;
        const headers = headerLine.split(',').map((h) => h.trim());
        messages = rows.map((row) => {
          const vals = row.split(',').map((v) => v.trim());
          const obj = {};
          headers.forEach((h, i) => (obj[h] = vals[i] || ''));
          return { to: obj.to || obj.phone || obj.number, vars: obj };
        });
      }

      const valid = messages.filter((m) => m.to && /\+?[0-9]{7,15}/.test(m.to));
      if (!valid.length) return toast.error('No valid phone numbers found');
      setParsedMessages(valid);
      toast.success(`${valid.length} recipients parsed`);
      setStep(3);
    } catch (err) {
      toast.error('Invalid format. Use CSV with header row or JSON array.');
    }
  };

  const submit = async () => {
    if (!form.session_id) return toast.error('Select a WhatsApp number');
    if (!templateBody) return toast.error('Select or write a template');
    if (!parsedMessages.length) return toast.error('No recipients');

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
      const r = await api.get('/v1/messages/campaigns');
      setCampaigns(r.data.campaigns || []);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Send failed');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-[#e8f0eb]">Campaigns</h1>
          <p className="text-sm text-[#6b8f72] mt-0.5">Send bulk notifications to your users</p>
        </div>
        <button onClick={() => { setShowForm(true); setStep(1); }} className="btn-primary flex items-center gap-2">
          <Plus size={14} /> New campaign
        </button>
      </div>

      {/* Multi-step form */}
      {showForm && (
        <div className="card mb-6 border-wa/20">
          {/* Steps indicator */}
          <div className="flex items-center gap-3 mb-6">
            {['Setup', 'Recipients', 'Preview & Send'].map((s, i) => (
              <React.Fragment key={s}>
                <div className={`flex items-center gap-2 text-sm ${step === i + 1 ? 'text-wa' : step > i + 1 ? 'text-[#4ade80]' : 'text-[#3a5040]'}`}>
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium border ${
                    step === i + 1 ? 'border-wa text-wa' : step > i + 1 ? 'border-[#4ade80] text-[#4ade80]' : 'border-[#2a3a2f] text-[#3a5040]'
                  }`}>
                    {step > i + 1 ? '✓' : i + 1}
                  </div>
                  {s}
                </div>
                {i < 2 && <div className="flex-1 h-px bg-[#1e2e22]" />}
              </React.Fragment>
            ))}
          </div>

          {/* Step 1: Setup */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <label className="label">Campaign name (optional)</label>
                <input className="input" value={form.campaign_name}
                  onChange={(e) => setForm((f) => ({ ...f, campaign_name: e.target.value }))}
                  placeholder="October membership renewal" />
              </div>
              <div>
                <label className="label">WhatsApp number to send from</label>
                {sessions.length === 0 ? (
                  <div className="text-sm text-[#f87171] bg-[#1a0d0d] border border-[#3a1a1a] rounded-lg px-3 py-2.5">
                    No connected numbers. <Link to="/sessions" className="underline">Connect one first →</Link>
                  </div>
                ) : (
                  <select className="input" value={form.session_id}
                    onChange={(e) => setForm((f) => ({ ...f, session_id: e.target.value }))}>
                    <option value="">Select number...</option>
                    {sessions.map((s) => (
                      <option key={s.id} value={s.id}>{s.phone_number} {s.display_name ? `(${s.display_name})` : ''}</option>
                    ))}
                  </select>
                )}
              </div>
              <div>
                <label className="label">Template</label>
                <select className="input mb-2" value={form.template_id}
                  onChange={(e) => setForm((f) => ({ ...f, template_id: e.target.value, custom_template: '' }))}>
                  <option value="">— Select a saved template —</option>
                  {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
                <p className="text-xs text-[#3a5040] mb-1">Or write a custom template:</p>
                <textarea className="input h-20 resize-none font-mono text-xs"
                  value={form.custom_template} disabled={!!form.template_id}
                  onChange={(e) => setForm((f) => ({ ...f, custom_template: e.target.value }))}
                  placeholder="Hi {{name}}, your {{plan}} expires on {{date}}" />
              </div>
              <div>
                <label className="label">Delay between messages</label>
                <select className="input" value={form.delay_ms}
                  onChange={(e) => setForm((f) => ({ ...f, delay_ms: +e.target.value }))}>
                  <option value={2000}>2 seconds (fast)</option>
                  <option value={3000}>3 seconds (recommended)</option>
                  <option value={5000}>5 seconds (safe)</option>
                  <option value={8000}>8 seconds (very safe)</option>
                </select>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setStep(2)} disabled={!form.session_id || !templateBody}
                  className="btn-primary disabled:opacity-40">Next: Add recipients</button>
                <button onClick={() => setShowForm(false)} className="btn-secondary">Cancel</button>
              </div>
            </div>
          )}

          {/* Step 2: Recipients */}
          {step === 2 && (
            <div className="space-y-4">
              <div>
                <label className="label">Recipients</label>
                <p className="text-xs text-[#6b8f72] mb-2">
                  Paste as CSV (first row = headers, must include <code className="text-wa">to</code> column) or as a JSON array.
                  {vars.length > 0 && <> Variables needed: <span className="text-wa">{vars.join(', ')}</span></>}
                </p>
                <div className="text-xs font-mono text-[#3a5040] bg-[#0d1610] px-3 py-2 rounded border border-[#1e2e22] mb-2">
                  {`to,${vars.join(',')}`}{'\n'}
                  {`+919876543210,${vars.map((v) => `sample_${v}`).join(',')}`}
                </div>
                <textarea className="input h-40 resize-none font-mono text-xs"
                  value={recipientsText} onChange={(e) => setRecipientsText(e.target.value)}
                  placeholder={`to,name,plan\n+919876543210,Rahul,Gold\n+918800001234,Priya,Silver`} />
              </div>
              {parsedMessages.length > 0 && (
                <p className="text-sm text-[#4ade80]">✓ {parsedMessages.length} recipients ready</p>
              )}
              <div className="flex gap-2">
                <button onClick={parseRecipients} className="btn-primary">Parse recipients</button>
                <button onClick={() => setStep(1)} className="btn-secondary">Back</button>
              </div>
            </div>
          )}

          {/* Step 3: Preview */}
          {step === 3 && (
            <div className="space-y-4">
              <div>
                <label className="label">Preview (first recipient)</label>
                {parsedMessages[0] && (
                  <div className="bg-[#0d1610] border border-[#1e2e22] rounded-lg p-3">
                    <div className="text-xs text-[#6b8f72] mb-1">To: {parsedMessages[0].to}</div>
                    <div className="text-sm text-[#e8f0eb] font-mono whitespace-pre-wrap">
                      {renderTemplate(templateBody, parsedMessages[0].vars || {})}
                    </div>
                  </div>
                )}
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-[#0d1610] border border-[#1e2e22] rounded-lg p-3 text-center">
                  <div className="text-lg font-semibold text-[#e8f0eb]">{parsedMessages.length}</div>
                  <div className="text-xs text-[#6b8f72]">Recipients</div>
                </div>
                <div className="bg-[#0d1610] border border-[#1e2e22] rounded-lg p-3 text-center">
                  <div className="text-lg font-semibold text-[#e8f0eb]">{(form.delay_ms / 1000)}s</div>
                  <div className="text-xs text-[#6b8f72]">Delay</div>
                </div>
                <div className="bg-[#0d1610] border border-[#1e2e22] rounded-lg p-3 text-center">
                  <div className="text-lg font-semibold text-[#e8f0eb]">
                    ~{Math.ceil((parsedMessages.length * form.delay_ms) / 60000)}m
                  </div>
                  <div className="text-xs text-[#6b8f72]">Est. duration</div>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={submit} disabled={sending}
                  className="btn-primary flex items-center gap-2 disabled:opacity-40">
                  {sending && <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />}
                  <Send size={14} /> Send {parsedMessages.length} messages
                </button>
                <button onClick={() => setStep(2)} className="btn-secondary">Back</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Campaigns table */}
      {campaigns.length === 0 && !showForm ? (
        <div className="card text-center py-16">
          <Send size={40} className="text-[#3a5040] mx-auto mb-3" />
          <h3 className="text-[#a8c4ae] font-medium mb-1">No campaigns yet</h3>
          <p className="text-sm text-[#3a5040] mb-4">Create your first bulk notification campaign</p>
        </div>
      ) : (
        <div className="card overflow-hidden p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#1e2e22]">
                {['Campaign', 'Sent', 'Delivered', 'Failed', 'Status', 'Date', ''].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-medium text-[#6b8f72] uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {campaigns.map((c) => (
                <tr key={c.id} className="table-row">
                  <td className="px-4 py-3 font-medium text-[#e8f0eb]">{c.name}</td>
                  <td className="px-4 py-3 text-[#a8c4ae]">{c.sent_count}</td>
                  <td className="px-4 py-3 text-[#4ade80]">{c.delivered_count}</td>
                  <td className="px-4 py-3 text-[#f87171]">{c.failed_count}</td>
                  <td className="px-4 py-3"><StatusBadge s={c.status} /></td>
                  <td className="px-4 py-3 text-[#6b8f72] text-xs">{new Date(c.created_at).toLocaleDateString()}</td>
                  <td className="px-4 py-3">
                    <Link to={`/campaigns/${c.id}`} className="btn-ghost flex items-center gap-1">
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

function StatusBadge({ s }) {
  const map = { completed: 'badge-success', sending: 'badge-info', queued: 'badge-warn', failed: 'badge-danger', cancelled: 'badge-danger' };
  return <span className={map[s] || 'badge-info'}>{s}</span>;
}
