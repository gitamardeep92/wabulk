import React, { useEffect, useState, useRef } from 'react';
import { Smartphone, Plus, Trash2, RefreshCw, Wifi, WifiOff, QrCode, CheckCircle2, AlertCircle, Copy, Check, Phone } from 'lucide-react';
import api from '../lib/api';
import toast from 'react-hot-toast';

function CopyField({ value, label }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center gap-2 bg-[#0a1209] border border-[#1c2e20] rounded-lg px-3 py-2">
      <code className="flex-1 text-[10px] md:text-xs font-mono text-[#8fb898] break-all select-all">{value}</code>
      <button onClick={() => { navigator.clipboard.writeText(value); setCopied(true); toast.success(label || 'Copied'); setTimeout(() => setCopied(false), 2000); }} className="btn-icon shrink-0 h-6 w-6">
        {copied ? <Check size={12} className="text-[#25D366]" /> : <Copy size={12} />}
      </button>
    </div>
  );
}

export default function Sessions() {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [qrSession, setQrSession] = useState(null);
  const [connectMode, setConnectMode] = useState('qr'); // 'qr' | 'phone'
  const [phoneInput, setPhoneInput] = useState('');
  const [pairingCode, setPairingCode] = useState(null);
  const [requestingCode, setRequestingCode] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const pollRef = useRef(null);

  const load = async () => {
    try {
      const { data } = await api.get('/sessions');
      setSessions(data.sessions || []);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); return () => clearInterval(pollRef.current); }, []);

  const startSession = async () => {
    setCreating(true);
    setPairingCode(null);
    try {
      const { data } = await api.post('/sessions');
      pollStatus(data.session_id);
      load();
      if (connectMode === 'phone') {
        setQrSession({ id: data.session_id, status: 'pending', mode: 'phone' });
      } else {
        setQrSession({ id: data.session_id, qr_code: null, status: 'pending', mode: 'qr' });
        toast.success('Scan the QR with WhatsApp');
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create session');
    } finally { setCreating(false); }
  };

  const requestPairingCode = async () => {
    if (!phoneInput || !qrSession?.id) return;
    setRequestingCode(true);
    try {
      // First make sure session socket is ready (wait for it)
      await new Promise(r => setTimeout(r, 3000));
      const { data } = await api.post(`/sessions/${qrSession.id}/connect-phone`, { phone_number: phoneInput });
      setPairingCode(data.pairing_code);
      toast.success('Enter this code in WhatsApp → Linked Devices');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to get pairing code');
    } finally { setRequestingCode(false); }
  };

  const pollStatus = (sessionId) => {
    clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const { data } = await api.get(`/sessions/${sessionId}/qr`);
        setQrSession(prev => prev ? { ...prev, ...data } : data);
        if (data.status === 'connected') {
          clearInterval(pollRef.current);
          toast.success(`✓ Connected: ${data.phone_number}`);
          setQrSession(null);
          setPairingCode(null);
          setPhoneInput('');
          load();
        }
      } catch { clearInterval(pollRef.current); }
    }, 2500);
  };

  const deleteSession = async (id) => {
    try {
      await api.delete(`/sessions/${id}`);
      toast.success('Session removed');
      setSessions(s => s.filter(x => x.id !== id));
      setDeleteConfirm(null);
    } catch (err) { toast.error(err.response?.data?.error || 'Failed'); }
  };

  const cancelConnect = () => {
    clearInterval(pollRef.current);
    setQrSession(null);
    setPairingCode(null);
    setPhoneInput('');
    load();
  };

  if (loading) return <div className="p-4 md:p-6 space-y-3">{[1,2].map(i => <div key={i} className="skeleton h-20 rounded-2xl" />)}</div>;

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-4 animate-in">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="page-title">WhatsApp Numbers</h1>
          <p className="page-subtitle hidden sm:block">Connect WhatsApp numbers to send messages</p>
        </div>
        {!qrSession && (
          <button onClick={startSession} disabled={creating} className="btn-primary shrink-0 text-xs md:text-sm px-3 py-2 md:px-4 md:py-2.5">
            {creating ? <div className="w-3.5 h-3.5 border-2 border-[#061008] border-t-transparent rounded-full animate-spin" /> : <Plus size={14} />}
            Connect
          </button>
        )}
      </div>

      {/* Connect panel */}
      {!qrSession ? (
        /* Mode selector shown before creating session */
        <div className="card border-[#1a3518]">
          <p className="text-xs font-semibold text-[#5a7a62] uppercase tracking-wider mb-3">Connect method</p>
          <div className="grid grid-cols-2 gap-2 mb-4">
            {[{ v: 'qr', icon: QrCode, label: 'Scan QR code', desc: 'Scan with WhatsApp camera' },
              { v: 'phone', icon: Phone, label: 'Phone number', desc: 'Enter a pairing code in WhatsApp' }
            ].map(({ v, icon: Icon, label, desc }) => (
              <button key={v} onClick={() => setConnectMode(v)}
                className={`flex flex-col items-start gap-1 p-3 rounded-xl border text-left transition-all ${connectMode === v ? 'border-[#25D366]/40 bg-[#0a1f0d]' : 'border-[#1c2e20] hover:border-[#243828]'}`}>
                <div className="flex items-center gap-2">
                  <Icon size={14} className={connectMode === v ? 'text-[#25D366]' : 'text-[#5a7a62]'} />
                  <span className={`text-xs font-semibold ${connectMode === v ? 'text-[#25D366]' : 'text-[#a8c4ae]'}`}>{label}</span>
                </div>
                <span className="text-[10px] text-[#5a7a62]">{desc}</span>
              </button>
            ))}
          </div>
          <button onClick={startSession} disabled={creating} className="btn-primary w-full">
            {creating ? <div className="w-4 h-4 border-2 border-[#061008] border-t-transparent rounded-full animate-spin" /> : <Plus size={14} />}
            Start connection
          </button>
        </div>
      ) : (
        /* Active connection panel */
        <div className="card border-[#25D366]/20 animate-in">
          {qrSession.mode === 'qr' ? (
            /* QR mode */
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5">
              <div className="shrink-0">
                {qrSession.status === 'qr_ready' && qrSession.qr_code ? (
                  <div className="relative">
                    <img src={qrSession.qr_code} alt="QR" className="w-40 h-40 rounded-xl border border-[#1c2e20]" />
                    <span className="absolute -top-1.5 -right-1.5 badge-info text-[10px] animate-pulse">Scan now</span>
                  </div>
                ) : (
                  <div className="w-40 h-40 bg-[#0a1209] rounded-xl border border-[#1c2e20] flex flex-col items-center justify-center gap-3">
                    <QrCode size={28} className="text-[#344a38]" />
                    <div className="text-xs text-[#5a7a62]">Generating QR...</div>
                    <div className="w-5 h-5 border-2 border-[#25D366] border-t-transparent rounded-full animate-spin" />
                  </div>
                )}
              </div>
              <div className="flex-1 text-center sm:text-left">
                <div className="flex items-center justify-center sm:justify-start gap-2 mb-3">
                  <div className="w-2 h-2 rounded-full bg-[#25D366] animate-pulse" />
                  <span className="text-sm font-semibold text-[#dce8df]">Waiting for scan</span>
                </div>
                <ol className="space-y-1.5 mb-4 text-left">
                  {['Open WhatsApp on your phone', 'Tap ⋮ → Linked Devices', 'Tap "Link a Device"', 'Point camera at the QR code'].map((s, i) => (
                    <li key={i} className="flex items-center gap-2 text-xs text-[#8fb898]">
                      <span className="w-5 h-5 rounded-full bg-[#0a1f0d] border border-[#1c2e20] text-[#25D366] flex items-center justify-center shrink-0 font-medium text-[10px]">{i+1}</span>
                      {s}
                    </li>
                  ))}
                </ol>
                <button onClick={cancelConnect} className="btn-secondary text-xs px-3 py-1.5">Cancel</button>
              </div>
            </div>
          ) : (
            /* Phone number / pairing code mode */
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-2 h-2 rounded-full bg-[#25D366] animate-pulse" />
                <span className="text-sm font-semibold text-[#dce8df]">Connect via phone number</span>
              </div>

              {!pairingCode ? (
                <>
                  <div className="mb-3">
                    <label className="label">Your WhatsApp number</label>
                    <input className="input" value={phoneInput} onChange={e => setPhoneInput(e.target.value)}
                      placeholder="+919876543210" type="tel" />
                    <p className="input-hint">Enter the number you want to connect, with country code</p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={requestPairingCode} disabled={requestingCode || !phoneInput} className="btn-primary flex-1 disabled:opacity-40">
                      {requestingCode ? <div className="w-4 h-4 border-2 border-[#061008] border-t-transparent rounded-full animate-spin" /> : <Phone size={14} />}
                      Get pairing code
                    </button>
                    <button onClick={cancelConnect} className="btn-secondary">Cancel</button>
                  </div>
                </>
              ) : (
                <>
                  <div className="bg-[#0a1f0d] border border-[#1c2e20] rounded-xl p-4 mb-4 text-center">
                    <p className="text-xs text-[#5a7a62] mb-2">Enter this code in WhatsApp</p>
                    <div className="text-3xl font-bold tracking-[0.3em] text-[#25D366] font-mono">{pairingCode}</div>
                    <p className="text-xs text-[#344a38] mt-2">WhatsApp → ⋮ → Linked Devices → Link with phone number</p>
                  </div>
                  <ol className="space-y-1.5 mb-4">
                    {['Open WhatsApp on your phone', 'Tap ⋮ menu → Linked Devices', 'Tap "Link with phone number"', `Enter the code: ${pairingCode}`].map((s, i) => (
                      <li key={i} className="flex items-center gap-2 text-xs text-[#8fb898]">
                        <span className="w-5 h-5 rounded-full bg-[#0a1f0d] border border-[#1c2e20] text-[#25D366] flex items-center justify-center shrink-0 font-medium text-[10px]">{i+1}</span>
                        {s}
                      </li>
                    ))}
                  </ol>
                  <div className="flex gap-2">
                    <div className="flex items-center gap-2 text-xs text-[#25D366]">
                      <div className="w-2 h-2 rounded-full bg-[#25D366] animate-pulse" />
                      Waiting for confirmation...
                    </div>
                    <button onClick={cancelConnect} className="btn-secondary text-xs px-3 py-1.5 ml-auto">Cancel</button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* Delete confirm */}
      {deleteConfirm && (
        <div className="modal-backdrop" onClick={() => setDeleteConfirm(null)}>
          <div className="modal-box max-w-sm animate-in" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-[#150606] border border-[#3a1515] flex items-center justify-center shrink-0">
                <AlertCircle size={17} className="text-[#f87171]" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-[#dce8df]">Remove number?</h3>
                <p className="text-xs text-[#5a7a62]">{deleteConfirm.phone_number || 'This session'}</p>
              </div>
            </div>
            <p className="text-sm text-[#8fb898] mb-5">This disconnects the number permanently. You'll need to scan QR or enter code again.</p>
            <div className="flex gap-3">
              <button onClick={() => deleteSession(deleteConfirm.id)} className="btn-danger flex-1">Remove</button>
              <button onClick={() => setDeleteConfirm(null)} className="btn-secondary flex-1">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Sessions list */}
      {sessions.length === 0 ? (
        <div className="card py-12 text-center">
          <div className="w-12 h-12 rounded-2xl bg-[#0a1f0d] border border-[#1c2e20] flex items-center justify-center mx-auto mb-4">
            <Smartphone size={22} className="text-[#25D366]" />
          </div>
          <h3 className="text-[#a8c4ae] font-semibold mb-1">No numbers connected</h3>
          <p className="text-sm text-[#5a7a62]">Connect a WhatsApp number to start sending</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sessions.map(s => (
            <div key={s.id} className="card">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${s.status === 'connected' ? 'bg-[#0a1f0d] border border-[#1c2e20]' : 'bg-[#150f00] border border-[#2a2000]'}`}>
                    {s.status === 'connected' ? <Wifi size={16} className="text-[#25D366]" /> : <WifiOff size={16} className="text-[#fbbf24]" />}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-[#dce8df]">{s.phone_number || 'Pending...'}</span>
                      {s.status === 'connected' && <span className="badge-success text-[10px]"><CheckCircle2 size={9} />Connected</span>}
                      {s.status === 'pending' && <span className="badge-warn text-[10px]">Connecting...</span>}
                      {s.status === 'disconnected' && <span className="badge-danger text-[10px]">Disconnected</span>}
                    </div>
                    {s.display_name && <div className="text-xs text-[#5a7a62] truncate">{s.display_name}</div>}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {s.status === 'disconnected' && (
                    <button onClick={() => { setQrSession({ id: s.id, qr_code: null, status: 'pending', mode: connectMode }); pollStatus(s.id); }}
                      className="btn-secondary gap-1 px-2 py-1.5 text-xs">
                      <RefreshCw size={11} /> <span className="hidden sm:inline">Reconnect</span>
                    </button>
                  )}
                  <button onClick={() => setDeleteConfirm(s)} className="btn-icon text-[#f87171] hover:bg-[#150606]">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
              {s.status === 'connected' && (
                <div className="mt-3 pt-3 border-t border-[#1c2e20]">
                  <div className="flex items-center justify-between mb-1.5 flex-wrap gap-1">
                    <span className="text-[10px] font-semibold text-[#5a7a62] uppercase tracking-wide">Session ID for API</span>
                  </div>
                  <CopyField value={s.id} label="Session ID copied" />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
