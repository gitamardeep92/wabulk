import React, { useEffect, useState, useRef } from 'react';
import { Smartphone, Plus, Trash2, RefreshCw, Wifi, WifiOff, QrCode } from 'lucide-react';
import api from '../lib/api';
import toast from 'react-hot-toast';

export default function Sessions() {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [qrSession, setQrSession] = useState(null); // { id, qr_code, status }
  const pollRef = useRef(null);

  const load = async () => {
    try {
      const { data } = await api.get('/sessions');
      setSessions(data.sessions);
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
      toast.success('WhatsApp session started. Scan the QR code.');
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
    if (!confirm('Disconnect this WhatsApp number?')) return;
    await api.delete(`/sessions/${id}`);
    toast.success('Session disconnected');
    load();
  };

  if (loading) return <PageLoader />;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-[#e8f0eb]">WhatsApp Numbers</h1>
          <p className="text-sm text-[#6b8f72] mt-0.5">Connect your business WhatsApp accounts</p>
        </div>
        <button onClick={createSession} disabled={creating} className="btn-primary flex items-center gap-2">
          {creating ? <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" /> : <Plus size={14} />}
          Connect number
        </button>
      </div>

      {/* QR Modal */}
      {qrSession && (
        <div className="card mb-6 border-wa/30">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0">
              {qrSession.status === 'qr_ready' && qrSession.qr_code ? (
                <img src={qrSession.qr_code} alt="QR Code" className="w-40 h-40 rounded-lg border border-[#1e2e22]" />
              ) : (
                <div className="w-40 h-40 bg-[#0d1610] rounded-lg border border-[#1e2e22] flex flex-col items-center justify-center gap-2">
                  <QrCode size={32} className="text-[#3a5040]" />
                  <span className="text-xs text-[#3a5040]">Generating QR...</span>
                  <div className="w-4 h-4 border-2 border-wa border-t-transparent rounded-full animate-spin" />
                </div>
              )}
            </div>
            <div>
              <h3 className="font-medium text-[#e8f0eb] mb-1 flex items-center gap-2">
                <QrCode size={16} className="text-wa" /> Scan to connect
              </h3>
              <ol className="text-sm text-[#6b8f72] space-y-1.5 list-decimal list-inside">
                <li>Open WhatsApp on your phone</li>
                <li>Go to Settings → Linked Devices</li>
                <li>Tap "Link a Device"</li>
                <li>Scan the QR code on the left</li>
              </ol>
              <button onClick={() => { clearInterval(pollRef.current); setQrSession(null); load(); }}
                className="btn-ghost mt-3 text-[#f87171] hover:text-[#f87171]">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sessions list */}
      {sessions.length === 0 ? (
        <div className="card text-center py-16">
          <Smartphone size={40} className="text-[#3a5040] mx-auto mb-3" />
          <h3 className="text-[#a8c4ae] font-medium mb-1">No numbers connected</h3>
          <p className="text-sm text-[#3a5040] mb-4">Connect a WhatsApp Business number to start sending</p>
          <button onClick={createSession} className="btn-primary">Connect your first number</button>
        </div>
      ) : (
        <div className="space-y-3">
          {sessions.map((s) => (
            <div key={s.id} className="card flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  s.status === 'connected' ? 'bg-[#0d2016]' : 'bg-[#1a1500]'
                }`}>
                  <Smartphone size={18} className={s.status === 'connected' ? 'text-wa' : 'text-[#6b8f72]'} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-[#e8f0eb]">
                      {s.phone_number || 'Pending...'}
                    </span>
                    {s.status === 'connected'
                      ? <span className="badge-success"><span className="w-1.5 h-1.5 rounded-full bg-current" />Connected</span>
                      : s.status === 'pending'
                      ? <span className="badge-warn">Pending</span>
                      : <span className="badge-danger"><WifiOff size={10} />Disconnected</span>
                    }
                  </div>
                  {s.display_name && (
                    <div className="text-xs text-[#6b8f72]">{s.display_name}</div>
                  )}
                  <div className="text-xs text-[#3a5040]">
                    Connected {s.connected_at ? new Date(s.connected_at).toLocaleDateString() : '—'}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {s.status === 'disconnected' && (
                  <button onClick={() => pollQr(s.id)} className="btn-secondary flex items-center gap-1.5">
                    <RefreshCw size={12} /> Reconnect
                  </button>
                )}
                <button onClick={() => deleteSession(s.id)} className="btn-ghost text-[#f87171] hover:text-[#f87171]">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PageLoader() {
  return (
    <div className="p-6 space-y-4">
      {[1, 2, 3].map((i) => (
        <div key={i} className="card h-20 animate-pulse bg-[#111a14]" />
      ))}
    </div>
  );
}
