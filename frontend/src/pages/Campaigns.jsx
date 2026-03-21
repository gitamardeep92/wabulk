import React, { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Send, Plus, ChevronRight, AlertCircle, Upload, Users, FileText, Ban } from 'lucide-react';
import api from '../lib/api';
import toast from 'react-hot-toast';
import { renderTemplate, extractVariables } from '../lib/templateUtils';

const statusMap = { completed: 'badge-success', sending: 'badge-info', queued: 'badge-warn', failed: 'badge-danger', cancelled: 'badge-gray' };

function parseCsv(text) {
  const lines = text.trim().split('\n').filter(Boolean);
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
  return lines.slice(1).map(row => {
    const vals = row.split(',').map(v => v.trim());
    const obj = {};
    headers.forEach((h, i) => (obj[h] = vals[i] || ''));
    return obj;
  });
}

export default function Campaigns() {
  const [campaigns, setCampaigns] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({ session_id: '', template_id: '', campaign_name: '', custom_template: '', delay_ms: 3000 });
  const [recipientMode, setRecipientMode] = useState('csv');
  const [recipientsText, setRecipientsText] = useState('');
  const [selectedGroup, setSelectedGroup] = useState('');
  const [parsedMessages, setParsedMessages] = useState([]);
  const [sending, setSending] = useState(false);
  const [cancelConfirm, setCancelConfirm] = useState(null);
  const fileRef = useRef();

  const load = () => Promise.all([
    api.get('/v1/messages/campaigns').then(r => setCampaigns(r.data.campaigns || [])),
    api.get('/templates').then(r => setTemplates(r.data.templates || [])),
    api.get('/sessions').then(r => setSessions(r.data.sessions?.filter(s => s.status === 'connected') || [])),
    api.get('/contacts/groups').then(r => setGroups(r.data.groups || [])).catch(() => {}),
  ]).finally(() => setLoading(false));

  useEffect(() => { load(); }, []);

  const selectedTemplate = templates.find(t => t.id === form.template_id);
  const templateBody = selectedTemplate?.body || form.custom_template;
  const vars = extractVariables(templateBody);

  const handleFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => setRecipientsText(ev.target.result);
    reader.readAsText(file);
  };

  const parseRecipients = async () => {
    try {
      let messages = [];
      if (recipientMode === 'group' && selectedGroup) {
        const { data } = await api.get(`/contacts/groups/${selectedGroup}/members`);
        messages = (data.contacts || []).map(c => ({ to: c.phone, vars: { name: c.name, ...c.custom_data } }));
        if (!messages.length) return toast.error('This group has no contacts');
      } else {
        const text = recipientsText.trim();
        if (!text) return toast.error('Enter recipients data');
        if (text.startsWith('[')) {
          messages = JSON.parse(text);
        } else {
          messages = parseCsv(text).map(row => ({ to: row.to || row.phone || row.mobile || '', vars: row }));
        }
      }
      const valid = messages.filter(m => m.to && /^\+?[0-9]{7,15}$/.test(m.to.toString().replace(/\s/g, '')));
      if (!valid.length) return toast.error('No valid phone numbers found');
      setParsedMessages(valid);
      toast.success(`${valid.length} recipients ready`);
      setStep(3);
    } catch (err) { toast.error('Invalid format: ' + err.message); }
  };

  const submit = async () => {
    if (!form.session_id) return toast.error('Select a WhatsApp number');
    if (!templateBody) return toast.error('Select or write a template');
    if (!parsedMessages.length) return toast.error('Add recipients first');
    setSending(true);
    try {
      const { data } = await api.post('/v1/messages/send', {
        session_id: form.session_id, template: templateBody,
        messages: parsedMessages, delay_ms: form.delay_ms,
        campaign_name: form.campaign_name || undefined,
      });
      toast.success(`${data.queued} messages queued!`);
      setShowForm(false); setStep(1); setParsedMessages([]); setRecipientsText('');
      setForm({ session_id: '', template_id: '', campaign_name: '', custom_template: '', delay_ms: 3000 });
      load();
    } catch (err) { toast.error(err.response?.data?.error || 'Send failed'); }
    finally { setSending(false); }
  };

  const cancelCampaign = async (id) => {
    try {
      await api.delete(`/v1/messages/campaigns/${id}`);
      toast.success('Campaign cancelled');
      setCancelConfirm(null);
      load();
    } catch (err) { toast.error(err.response?.data?.error || 'Cancel failed'); }
  };

  const estimatedTime = Math.ceil((parsedMessages.length * form.delay_ms) / 60000);

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-4 md:space-y-5 animate-in">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="page-title">Campaigns</h1>
          <p className="page-subtitle hidden sm:block">Send personalized bulk notifications</p>
        </div>
        {!showForm && (
          <button onClick={() => { setShowForm(true); setStep(1); }} className="btn-primary shrink-0 text-xs md:text-sm px-3 py-2 md:px-4 md:py-2.5">
            <Plus size={14} /> <span className="hidden sm:inline">New campaign</span><span className="sm:hidden">New</span>
          </button>
        )}
      </div>

      {/* Cancel confirm */}
      {cancelConfirm && (
        <div className="modal-backdrop" onClick={() => setCancelConfirm(null)}>
          <div className="modal-box max-w-sm animate-in" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-[#150606] border border-[#3a1515] flex items-center justify-center shrink-0">
                <Ban size={16} className="text-[#f87171]" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-[#dce8df]">Cancel campaign?</h3>
                <p className="text-xs text-[#5a7a62] truncate max-w-[180px]">{cancelConfirm.name}</p>
              </div>
            </div>
            <p className="text-sm text-[#8fb898] mb-5">All queued messages will stop immediately.</p>
            <div className="flex gap-3">
              <button onClick={() => cancelCampaign(cancelConfirm.id)} className="btn-danger flex-1">Cancel campaign</button>
              <button onClick={() => setCancelConfirm(null)} className="btn-secondary flex-1">Keep sending</button>
            </div>
          </div>
        </div>
      )}

      {/* Form */}
      {showForm && (
        <div className="card border-[#25D366]/20 animate-in">
          {/* Steps */}
          <div className="flex items-center gap-2 mb-5">
            {['Setup', 'Recipients', 'Send'].map((s, i) => (
              <React.Fragment key={s}>
                <div className={`flex items-center gap-1.5 md:gap-2 text-xs font-medium ${step === i+1 ? 'text-[#25D366]' : step > i+1 ? 'text-[#4ade80]' : 'text-[#3a5040]'}`}>
                  <div className={`w-5 h-5 md:w-6 md:h-6 rounded-full flex items-center justify-center text-[10px] font-semibold border ${step === i+1 ? 'border-[#25D366] text-[#25D366] bg-[#0a1f0d]' : step > i+1 ? 'border-[#4ade80] text-[#4ade80] bg-[#051a10]' : 'border-[#1c2e20] text-[#3a5040]'}`}>
                    {step > i+1 ? '✓' : i+1}
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
                <input className="input" value={form.campaign_name} onChange={e => setForm(f => ({ ...f, campaign_name: e.target.value }))} placeholder="October renewal" />
              </div>
              <div>
                <label className="label">Send from</label>
                {sessions.length === 0 ? (
                  <div className="flex items-start gap-3 p-3 bg-[#150f00] border border-[#2a2000] rounded-xl">
                    <AlertCircle size={15} className="text-[#fbbf24] shrink-0 mt-0.5" />
                    <p className="text-sm text-[#a88a40]">No connected numbers. <Link to="/sessions" className="text-[#fbbf24] underline">Connect one →</Link></p>
                  </div>
                ) : (
                  <select className="input" value={form.session_id} onChange={e => setForm(f => ({ ...f, session_id: e.target.value }))}>
                    <option value="">Select WhatsApp number...</option>
                    {sessions.map(s => <option key={s.id} value={s.id}>{s.phone_number}{s.display_name ? ` (${s.display_name})` : ''}</option>)}
                  </select>
                )}
              </div>
              <div>
                <label className="label">Template</label>
                <select className="input mb-2" value={form.template_id} onChange={e => setForm(f => ({ ...f, template_id: e.target.value, custom_template: '' }))}>
                  <option value="">— Saved template —</option>
                  {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
                {!form.template_id && (
                  <textarea className="input font-mono text-xs h-16 resize-none"
                    value={form.custom_template} onChange={e => setForm(f => ({ ...f, custom_template: e.target.value }))}
                    placeholder="Hi {{name}}, your {{plan}} expires on {{date}}." />
                )}
                {vars.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {vars.map(v => <span key={v} className="text-[10px] font-mono text-[#25D366] bg-[#0a1f0d] border border-[#1c2e20] px-1.5 py-0.5 rounded">{`{{${v}}}`}</span>)}
                  </div>
                )}
              </div>
              <div>
                <label className="label">Delay between messages</label>
                <select className="input" value={form.delay_ms} onChange={e => setForm(f => ({ ...f, delay_ms: +e.target.value }))}>
                  <option value={2000}>2 seconds — fast</option>
                  <option value={3000}>3 seconds — recommended</option>
                  <option value={5000}>5 seconds — safe</option>
                  <option value={8000}>8 seconds — very safe</option>
                </select>
              </div>
              <div className="flex flex-col sm:flex-row gap-2 pt-1">
                <button onClick={() => setStep(2)} disabled={!form.session_id || !templateBody} className="btn-primary sm:flex-1 disabled:opacity-40">Next: Recipients →</button>
                <button onClick={() => setShowForm(false)} className="btn-secondary">Cancel</button>
              </div>
            </div>
          )}

          {/* Step 2 */}
          {step === 2 && (
            <div className="space-y-4 animate-in">
              <label className="label">How to add recipients</label>
              <div className="grid grid-cols-3 gap-2">
                {[{ v: 'csv', icon: Upload, label: 'Upload CSV' }, { v: 'group', icon: Users, label: 'Group' }, { v: 'manual', icon: FileText, label: 'Paste' }].map(({ v, icon: Icon, label }) => (
                  <button key={v} onClick={() => setRecipientMode(v)}
                    className={`flex items-center justify-center gap-1.5 md:gap-2 px-3 py-2.5 rounded-xl border text-xs md:text-sm font-medium transition-all ${recipientMode === v ? 'border-[#25D366]/40 bg-[#0a1f0d] text-[#25D366]' : 'border-[#1c2e20] text-[#5a7a62] hover:text-[#8fb898]'}`}>
                    <Icon size={13} /> {label}
                  </button>
                ))}
              </div>

              {recipientMode === 'csv' && (
                <div>
                  <div className="mb-2 p-2.5 bg-[#0a1209] rounded-xl border border-[#1c2e20] text-[10px] md:text-xs font-mono overflow-x-auto">
                    <span className="text-[#25D366]">to,{vars.join(',') || 'name'}</span><br />
                    <span className="text-[#5a7a62]">+919876543210,sample</span>
                  </div>
                  <div className="border-2 border-dashed border-[#1c2e20] rounded-xl p-5 text-center cursor-pointer hover:border-[#25D366]/30 transition-colors" onClick={() => fileRef.current?.click()}>
                    <Upload size={18} className="text-[#5a7a62] mx-auto mb-1.5" />
                    <p className="text-sm text-[#5a7a62]">{recipientsText ? <span className="text-[#4ade80]">CSV loaded ✓</span> : 'Tap to upload CSV'}</p>
                    <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleFile} />
                  </div>
                </div>
              )}

              {recipientMode === 'group' && (
                groups.length === 0 ? (
                  <div className="p-3 bg-[#150f00] border border-[#2a2000] rounded-xl flex items-start gap-2">
                    <AlertCircle size={14} className="text-[#fbbf24] shrink-0 mt-0.5" />
                    <p className="text-sm text-[#a88a40]">No groups yet. <Link to="/contacts" className="text-[#fbbf24] underline">Create one →</Link></p>
                  </div>
                ) : (
                  <select className="input" value={selectedGroup} onChange={e => setSelectedGroup(e.target.value)}>
                    <option value="">Select a group...</option>
                    {groups.map(g => <option key={g.id} value={g.id}>{g.name} ({g.contact_count})</option>)}
                  </select>
                )
              )}

              {recipientMode === 'manual' && (
                <textarea className="input h-32 resize-y font-mono text-xs leading-relaxed"
                  value={recipientsText} onChange={e => setRecipientsText(e.target.value)}
                  placeholder={`to,${vars.join(',') || 'name'}\n+919876543210,Rahul`} />
              )}

              {parsedMessages.length > 0 && (
                <p className="text-xs text-[#4ade80] flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#4ade80]" /> {parsedMessages.length} recipients ready
                </p>
              )}
              <div className="flex flex-col sm:flex-row gap-2">
                <button onClick={parseRecipients} className="btn-primary sm:flex-1">Parse recipients</button>
                <button onClick={() => setStep(1)} className="btn-secondary">← Back</button>
              </div>
            </div>
          )}

          {/* Step 3 */}
          {step === 3 && (
            <div className="space-y-4 animate-in">
              <div className="grid grid-cols-3 gap-2 md:gap-3">
                {[{ label: 'Recipients', value: parsedMessages.length }, { label: 'Delay', value: `${form.delay_ms/1000}s` }, { label: 'Est. time', value: estimatedTime < 1 ? '<1m' : `~${estimatedTime}m` }].map(({ label, value }) => (
                  <div key={label} className="bg-[#0a1209] border border-[#1c2e20] rounded-xl p-2.5 md:p-3 text-center">
                    <div className="text-lg md:text-xl font-semibold text-[#dce8df]">{value}</div>
                    <div className="text-[10px] md:text-xs text-[#5a7a62] mt-0.5">{label}</div>
                  </div>
                ))}
              </div>
              {parsedMessages[0] && (
                <div>
                  <label className="label">Preview</label>
                  <div className="bg-[#0a1209] border border-[#1c2e20] rounded-xl p-3">
                    <div className="text-xs text-[#5a7a62] mb-1.5 font-mono">To: {parsedMessages[0].to}</div>
                    <div className="text-sm text-[#dce8df] whitespace-pre-wrap">{renderTemplate(templateBody, parsedMessages[0].vars || {})}</div>
                  </div>
                </div>
              )}
              <div className="flex flex-col sm:flex-row gap-2">
                <button onClick={submit} disabled={sending} className="btn-primary sm:flex-1">
                  {sending && <div className="w-4 h-4 border-2 border-[#061008] border-t-transparent rounded-full animate-spin" />}
                  <Send size={13} /> Send {parsedMessages.length} messages
                </button>
                <button onClick={() => setStep(2)} className="btn-secondary">← Back</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="skeleton h-14 rounded-2xl" />)}</div>
      ) : campaigns.length === 0 && !showForm ? (
        <div className="card py-12 md:py-16 text-center">
          <div className="w-12 h-12 md:w-14 md:h-14 rounded-2xl bg-[#0a1f0d] border border-[#1c2e20] flex items-center justify-center mx-auto mb-4">
            <Send size={22} className="text-[#25D366]" />
          </div>
          <h3 className="text-[#a8c4ae] font-semibold mb-1">No campaigns yet</h3>
          <p className="text-sm text-[#5a7a62] mb-5">Create your first bulk notification campaign</p>
          <button onClick={() => setShowForm(true)} className="btn-primary mx-auto">Create campaign</button>
        </div>
      ) : campaigns.length > 0 && (
        /* Mobile: cards, Desktop: table */
        <>
          {/* Mobile card list */}
          <div className="space-y-3 md:hidden">
            {campaigns.map(c => (
              <div key={c.id} className="card">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-[#dce8df] truncate">{c.name}</div>
                    <div className="text-xs text-[#5a7a62] mt-0.5">{new Date(c.created_at).toLocaleDateString('en-IN')}</div>
                  </div>
                  <span className={`${statusMap[c.status] || 'badge-gray'} shrink-0`}>{c.status}</span>
                </div>
                <div className="flex items-center gap-3 text-xs text-[#5a7a62] mb-3">
                  <span>{c.total_recipients} total</span>
                  <span className="text-[#25D366]">{c.sent_count} sent</span>
                  <span className="text-[#4ade80]">{c.delivered_count} delivered</span>
                  {c.failed_count > 0 && <span className="text-[#f87171]">{c.failed_count} failed</span>}
                </div>
                <div className="flex items-center gap-2">
                  {['queued','sending'].includes(c.status) && (
                    <button onClick={() => setCancelConfirm(c)} className="btn-ghost text-[#f87171] hover:text-[#f87171] text-xs gap-1">
                      <Ban size={11} /> Cancel
                    </button>
                  )}
                  <Link to={`/campaigns/${c.id}`} className="btn-ghost text-xs ml-auto">Details <ChevronRight size={11} /></Link>
                </div>
              </div>
            ))}
          </div>
          {/* Desktop table */}
          <div className="card overflow-hidden p-0 hidden md:block">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-[#1c2e20]">
                  <tr>{['Campaign','Recipients','Sent','Delivered','Failed','Status','Date',''].map(h => <th key={h} className="table-head">{h}</th>)}</tr>
                </thead>
                <tbody>
                  {campaigns.map(c => (
                    <tr key={c.id} className="table-row">
                      <td className="table-cell font-medium text-[#dce8df] max-w-[150px] truncate">{c.name}</td>
                      <td className="table-cell text-[#8fb898]">{c.total_recipients}</td>
                      <td className="table-cell text-[#8fb898]">{c.sent_count}</td>
                      <td className="table-cell text-[#4ade80]">{c.delivered_count}</td>
                      <td className="table-cell text-[#f87171]">{c.failed_count}</td>
                      <td className="table-cell"><span className={statusMap[c.status] || 'badge-gray'}>{c.status}</span></td>
                      <td className="table-cell text-[#5a7a62] text-xs">{new Date(c.created_at).toLocaleDateString('en-IN')}</td>
                      <td className="table-cell">
                        <div className="flex items-center gap-1">
                          {['queued','sending'].includes(c.status) && (
                            <button onClick={() => setCancelConfirm(c)} className="btn-ghost text-[#f87171] hover:text-[#f87171] text-xs gap-1"><Ban size={10} /> Cancel</button>
                          )}
                          <Link to={`/campaigns/${c.id}`} className="btn-ghost text-xs">Details <ChevronRight size={11} /></Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
