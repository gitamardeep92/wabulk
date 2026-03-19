import React, { useState, useEffect } from 'react';
import api from '../lib/api';
import { useAuthStore } from '../hooks/useAuth';
import toast from 'react-hot-toast';

export default function Settings() {
  const { user, setUser } = useAuthStore();
  const [profile, setProfile] = useState({ full_name: '', company: '' });
  const [webhook, setWebhook] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user) setProfile({ full_name: user.full_name || '', company: user.company || '' });
    api.get('/webhooks').then((r) => setWebhook(r.data.webhooks?.[0]?.url || '')).catch(() => {});
  }, [user]);

  const saveProfile = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { data } = await api.put('/auth/profile', profile);
      setUser(data.user);
      toast.success('Profile updated');
    } catch {
      toast.error('Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const saveWebhook = async (e) => {
    e.preventDefault();
    try {
      await api.post('/webhooks', { url: webhook });
      toast.success('Webhook saved');
    } catch {
      toast.error('Failed to save webhook');
    }
  };

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-[#e8f0eb]">Settings</h1>
        <p className="text-sm text-[#6b8f72] mt-0.5">Manage your account and notification preferences</p>
      </div>

      <div className="card">
        <h2 className="text-sm font-medium text-[#a8c4ae] mb-4">Profile</h2>
        <form onSubmit={saveProfile} className="space-y-3">
          <div>
            <label className="label">Full name</label>
            <input className="input" value={profile.full_name}
              onChange={(e) => setProfile((p) => ({ ...p, full_name: e.target.value }))} />
          </div>
          <div>
            <label className="label">Company</label>
            <input className="input" value={profile.company}
              onChange={(e) => setProfile((p) => ({ ...p, company: e.target.value }))}
              placeholder="Optional" />
          </div>
          <div>
            <label className="label">Email</label>
            <input className="input" value={user?.email || ''} disabled className="input opacity-50 cursor-not-allowed" />
          </div>
          <button type="submit" disabled={saving} className="btn-primary disabled:opacity-50">
            {saving ? 'Saving...' : 'Save profile'}
          </button>
        </form>
      </div>

      <div className="card">
        <h2 className="text-sm font-medium text-[#a8c4ae] mb-1">Delivery webhook</h2>
        <p className="text-sm text-[#6b8f72] mb-4">
          We'll POST delivery status updates to this URL when messages are delivered or fail.
        </p>
        <form onSubmit={saveWebhook} className="space-y-3">
          <div>
            <label className="label">Callback URL</label>
            <input className="input" type="url" value={webhook}
              onChange={(e) => setWebhook(e.target.value)}
              placeholder="https://yourapp.com/webhooks/wabulk" />
          </div>
          <div className="text-xs text-[#3a5040] font-mono bg-[#0d1610] border border-[#1e2e22] rounded-lg px-3 py-2">
            {`POST { "message_id": "...", "status": "delivered", "to": "+91...", "campaign_id": "..." }`}
          </div>
          <button type="submit" className="btn-primary">Save webhook</button>
        </form>
      </div>

      <div className="card border-[#3a1a1a]">
        <h2 className="text-sm font-medium text-[#f87171] mb-2">Danger zone</h2>
        <p className="text-sm text-[#6b8f72] mb-3">
          Deleting your account will remove all sessions, campaigns, and data permanently.
        </p>
        <button className="btn-secondary text-[#f87171] border-[#3a1a1a] hover:bg-[#1a0d0d]">
          Delete account
        </button>
      </div>
    </div>
  );
}
