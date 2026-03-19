import React, { useEffect, useState, useRef } from 'react';
import { Smartphone, Plus, Trash2, RefreshCw, Wifi, WifiOff, QrCode, CheckCircle2, AlertCircle } from 'lucide-react';
import api from '../lib/api';
import toast from 'react-hot-toast';

export default function Sessions() {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [qrSession, setQrSession] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const pollRef = useRef(null);

  const load = async () => {
    try {
      const { data } = await api.get('/sessions');
      setSessions(data.sessions || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    return () => clearInterval(pollRef.current);
  }, []);

  const createSession = async () => {
    setCreating(true);
    try {
      const { data } = await api.post('/sessions');
      toast.success('Scan the QR code with your WhatsApp');
      pollQr(data.session_id);
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create session');
    } finally {
      setCreating(false);
    }
  };

  const pollQr = (sessionId) => {
    clearInterval(pollRef.current);
    setQrSession({ id: sessionId, qr_code: null, status: 'pending' });
    pollRef.current = setInterval(async () => {
      try {
        const { data } = await api.get(`/sessions/${sessionId}/qr`);
        setQrSession(data);
        if (data.status === 'connected') {
          clearInterval(pollRef.current);
          toast.success(`Connected: ${data.phone_number}`);
          setQrSession(null);
          load();
        }
      } catch {
        clearInterval(pollRef.current);
      }
    }, 2500);
  };

  const deleteSession = async (id) => {
    try {
      await api.delete(`/sessions/${id}`);
      toast.success('Session disconnected');
      setSessions(s => s.filter(x => x.id !== id));
      setDeleteConfirm(null);
    } catch {
      toast.error('Failed to disconnect');
    }
  };

  if (loading) return <PageSkeleton />;

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-5 animate-in">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="page-title">WhatsApp Numbers</h1>
          <p className="page-subtitle">Connect your business WhatsApp accounts to start sending</p>
        </div>
        <button onClick={createSession} disabled={creating} className="btn-primary">
          {creating ? <div className="w-4 h-4 border-2 border-[#061008] border-t-transparent rounded-full animate-spin" /> : <Plus size={15} />}
          Connect number
        </button>
      </div>

      {/* QR Scanner */}
      {qrSession && (
        <div className="card border-[#25D366]/20 animate-in">
          <div className="flex items-start gap-5">
            <div className="shrink-0">
              {qrSession.status === 'qr_ready' && qrSession.qr_code ? (
                <div className="relative">
                  <img src={qrSession.qr_code} alt="QR Code" className="w-44 h-44 rounded-xl border border-[#1c2e20]" />
                  <div className="absolute -top-1.5 -right-1.5">
                    <span className="badge-info text-[10px] animate-pulse">Scan now</span>
                  </div>
                </div>
              ) : (
                <div className="w-44 h-44 bg-[#0a1209] rounded-xl border border-[#1c2e20] flex flex-col items-center justify-center gap-3">
                  <QrCode size={28} className="text-[#344a38]" />
                  <div className="text-xs text-[#5a7a62]">Generating...</div>
                  <div className="w-5 h-5 border-2 border-[#25D366] border-t-transparent rounded-full animate-spin" />
                </div>
              )}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-2 h-2 rounded-full bg-[#25D366] animate-pulse" />
                <span className="text-sm font-semibold text-[#dce8df]">Waiting for scan</span>
              </div>
              <ol className="space-y-2 mb-4">
                {['Open WhatsApp on your phone', 'Go to Settings → Linked Devices', 'Tap "Link a Device"', 'Point camera at the QR code'].map((s, i) => (
                  <li key={i} className="flex items-center gap-3 text-sm text-[#8fb898]">
                    <span className="w-5 h-5 rounded-full bg-[#0a1f0d] border border-[#1c2e20] text-[#25D366] text-xs flex items-center justify-center shrink-0 font-medium">{i + 1}</span>
                    {s}
                  </li>
                ))}
              </ol>
              <button onClick={() => { clearInterval(pollRef.current); setQrSession(null); load(); }}
                className="btn-secondary text-xs px-3 py-1.5">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm modal */}
      {deleteConfirm && (
        <div className="modal-backdrop" onClick={() => setDeleteConfirm(null)}>
          <div className="modal-box max-w-sm animate-in" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-[#150606] border border-[#3a1515] flex items-center justify-center">
                <AlertCircle size={18} className="text-[#f87171]" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-[#dce8df]">Disconnect number</h3>
                <p className="text-xs text-[#5a7a62]">{deleteConfirm.phone_number || 'This session'}</p>
              </div>
            </div>
            <p className="text-sm text-[#8fb898] mb-5">This will disconnect the WhatsApp number and stop all pending messages. You'll need to scan QR again to reconnect.</p>
            <div className="flex gap-3">
              <button onClick={() => deleteSession(deleteConfirm.id)} className="btn-danger flex-1">Disconnect</button>
              <button onClick={() => setDeleteConfirm(null)} className="btn-secondary flex-1">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Sessions list */}
      {sessions.length === 0 && !qrSession ? (
        <div className="card py-16 text-center">
          <div className="w-14 h-14 rounded-2xl bg-[#0a1f0d] border border-[#1c2e20] flex items-center justify-center mx-auto mb-4">
            <Smartphone size={24} className="text-[#25D366]" />
          </div>
          <h3 className="text-[#a8c4ae] font-semibold mb-1">No numbers connected</h3>
          <p className="text-sm text-[#5a7a62] mb-5 max-w-xs mx-auto">Connect a WhatsApp Business number to start sending notifications to your users.</p>
          <button onClick={createSession} className="btn-primary mx-auto">Connect your first number</button>
        </div>
      ) : (
        <div className="space-y-3">
          {sessions.map(s => (
            <div key={s.id} className="card flex items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${s.status === 'connected' ? 'bg-[#0a1f0d] border border-[#1c2e20]' : 'bg-[#150f00] border border-[#2a2000]'}`}>
                  {s.status === 'connected'
                    ? <Wifi size={18} className="text-[#25D366]" />
                    : <WifiOff size={18} className="text-[#fbbf24]" />
                  }
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-[#dce8df]">{s.phone_number || 'Pending...'}</span>
                    {s.status === 'connected' && (
                      <span className="badge-success"><CheckCircle2 size={10} />Connected</span>
                    )}
                    {s.status === 'pending' && <span className="badge-warn">Pending scan</span>}
                    {s.status === 'disconnected' && <span className="badge-danger">Disconnected</span>}
                  </div>
                  <div className="text-xs text-[#5a7a62] mt-0.5">
                    {s.display_name && <span className="mr-2">{s.display_name}</span>}
                    {s.connected_at && `Connected ${new Date(s.connected_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {s.status === 'disconnected' && (
                  <button onClick={() => pollQr(s.id)} className="btn-secondary gap-1.5 px-3 py-1.5 text-xs">
                    <RefreshCw size={12} /> Reconnect
                  </button>
                )}
                <button onClick={() => setDeleteConfirm(s)} className="btn-icon text-[#f87171] hover:text-[#f87171] hover:bg-[#150606]">
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {sessions.length > 0 && (
        <p className="text-xs text-[#344a38] text-center">
          Sessions are stored securely and survive server restarts. Scan QR once and stay connected.
        </p>
      )}
    </div>
  );
}

function PageSkeleton() {
  return (
    <div className="p-6 max-w-4xl mx-auto space-y-4">
      <div className="skeleton h-8 w-48" />
      {[1, 2].map(i => <div key={i} className="skeleton h-20 w-full rounded-2xl" />)}
    </div>
  );
}
