import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { MessageSquare } from 'lucide-react';
import { useAuthStore } from '../hooks/useAuth';
import toast from 'react-hot-toast';

function AuthLayout({ children, title, sub }) {
  return (
    <div className="min-h-screen bg-[#060c07] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2.5 justify-center mb-8">
          <div className="w-9 h-9 rounded-xl bg-[#25D366] flex items-center justify-center">
            <MessageSquare size={17} className="text-[#061008]" />
          </div>
          <span className="text-lg font-semibold text-[#dce8df]">WaBulk</span>
        </div>
        <div className="card">
          <h1 className="text-base font-semibold text-[#dce8df] mb-1">{title}</h1>
          <p className="text-sm text-[#5a7a62] mb-6">{sub}</p>
          {children}
        </div>
      </div>
    </div>
  );
}

export function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuthStore();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout title="Welcome back" sub="Sign in to your WaBulk dashboard">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="label">Email address</label>
          <input className="input" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@company.com" required autoFocus />
        </div>
        <div>
          <label className="label">Password</label>
          <input className="input" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Your password" required />
        </div>
        <button type="submit" disabled={loading} className="btn-primary w-full py-2.5 mt-2">
          {loading && <div className="w-4 h-4 border-2 border-[#061008] border-t-transparent rounded-full animate-spin" />}
          Sign in
        </button>
      </form>
      <p className="text-center text-sm text-[#5a7a62] mt-5">
        No account? <Link to="/signup" className="text-[#25D366] hover:underline">Create one free</Link>
      </p>
    </AuthLayout>
  );
}

export function Signup() {
  const [form, setForm] = useState({ email: '', password: '', full_name: '', company: '' });
  const [loading, setLoading] = useState(false);
  const { signup } = useAuthStore();
  const navigate = useNavigate();
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.password.length < 8) return toast.error('Password must be at least 8 characters');
    setLoading(true);
    try {
      await signup(form.email, form.password, form.full_name, form.company);
      toast.success('Account created! Welcome to WaBulk.');
      navigate('/');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Signup failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout title="Create your account" sub="500 free messages every month, no card required">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="label">Full name</label>
          <input className="input" value={form.full_name} onChange={set('full_name')} placeholder="Rahul Sharma" required autoFocus />
        </div>
        <div>
          <label className="label">Email address</label>
          <input className="input" type="email" value={form.email} onChange={set('email')} placeholder="you@company.com" required />
        </div>
        <div>
          <label className="label">Company <span className="text-[#344a38] normal-case font-normal">(optional)</span></label>
          <input className="input" value={form.company} onChange={set('company')} placeholder="Acme Pvt Ltd" />
        </div>
        <div>
          <label className="label">Password</label>
          <input className="input" type="password" value={form.password} onChange={set('password')} placeholder="Minimum 8 characters" required />
        </div>
        <button type="submit" disabled={loading} className="btn-primary w-full py-2.5">
          {loading && <div className="w-4 h-4 border-2 border-[#061008] border-t-transparent rounded-full animate-spin" />}
          Create account
        </button>
      </form>
      <p className="text-center text-xs text-[#344a38] mt-4">By signing up you agree to our terms of service.</p>
      <p className="text-center text-sm text-[#5a7a62] mt-3">
        Already have an account? <Link to="/login" className="text-[#25D366] hover:underline">Sign in</Link>
      </p>
    </AuthLayout>
  );
}

export function Settings() {
  const { user, setUser } = useAuthStore();
  const [profile, setProfile] = useState({ full_name: user?.full_name || '', company: user?.company || '' });
  const [saving, setSaving] = useState(false);

  const saveProfile = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { data } = await (await import('../lib/api')).default.put('/auth/profile', profile);
      setUser(data.user);
      toast.success('Profile updated');
    } catch { toast.error('Update failed'); }
    finally { setSaving(false); }
  };

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-5 animate-in">
      <div><h1 className="page-title">Settings</h1><p className="page-subtitle">Manage your account preferences</p></div>
      <div className="card">
        <h2 className="text-sm font-semibold text-[#a8c4ae] mb-4">Profile</h2>
        <form onSubmit={saveProfile} className="space-y-4">
          <div><label className="label">Full name</label><input className="input" value={profile.full_name} onChange={e => setProfile(p => ({ ...p, full_name: e.target.value }))} /></div>
          <div><label className="label">Company</label><input className="input" value={profile.company} onChange={e => setProfile(p => ({ ...p, company: e.target.value }))} placeholder="Optional" /></div>
          <div><label className="label">Email</label><input className="input opacity-50 cursor-not-allowed" value={user?.email || ''} disabled /></div>
          <button type="submit" disabled={saving} className="btn-primary">
            {saving && <div className="w-4 h-4 border-2 border-[#061008] border-t-transparent rounded-full animate-spin" />}
            Save changes
          </button>
        </form>
      </div>
      <div className="card border-[#3a1515]">
        <h2 className="text-sm font-semibold text-[#f87171] mb-2">Danger zone</h2>
        <p className="text-sm text-[#5a7a62] mb-3">Permanently delete your account, all sessions, and data.</p>
        <button className="btn-danger text-sm">Delete account</button>
      </div>
    </div>
  );
}

export function Billing() {
  const { user } = useAuthStore();
  const plans = [
    { name: 'Free', price: '₹0', period: '/month', msgs: '500 messages', sessions: '1 number', features: ['API access', 'Message templates', 'Campaign dashboard'], current: user?.plan === 'free' },
    { name: 'Starter', price: '₹999', period: '/month', msgs: '10,000 messages', sessions: '3 numbers', features: ['Delivery webhooks', 'Scheduled sending', 'Email support'], highlight: true, current: user?.plan === 'starter' },
    { name: 'Pro', price: '₹3,999', period: '/month', msgs: 'Unlimited', sessions: '10 numbers', features: ['Everything in Starter', 'Priority support', 'Dedicated manager'], current: user?.plan === 'pro' },
  ];
  return (
    <div className="p-6 max-w-4xl mx-auto space-y-5 animate-in">
      <div><h1 className="page-title">Billing & Plans</h1><p className="page-subtitle">Upgrade to send more messages</p></div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {plans.map(p => (
          <div key={p.name} className={`card flex flex-col ${p.highlight ? 'border-[#25D366]/30' : ''}`}>
            {p.highlight && <span className="badge-success mb-2 self-start">Most popular</span>}
            <div className="text-base font-semibold text-[#dce8df] mb-1">{p.name}</div>
            <div className="text-2xl font-semibold text-[#dce8df] mb-1">{p.price}<span className="text-sm font-normal text-[#5a7a62]">{p.period}</span></div>
            <div className="text-sm text-[#25D366] mb-1">{p.msgs}</div>
            <div className="text-xs text-[#5a7a62] mb-4">{p.sessions}</div>
            <div className="flex-1 space-y-2 mb-5">
              {p.features.map(f => <div key={f} className="flex items-center gap-2 text-sm text-[#8fb898]"><span className="text-[#4ade80] shrink-0">✓</span>{f}</div>)}
            </div>
            <button className={p.current ? 'btn-secondary opacity-60 cursor-default' : p.highlight ? 'btn-primary' : 'btn-secondary'}>
              {p.current ? 'Current plan' : `Upgrade to ${p.name}`}
            </button>
          </div>
        ))}
      </div>
      <p className="text-xs text-[#344a38] text-center">Payments via Razorpay. Contact us for custom enterprise pricing.</p>
    </div>
  );
}

function CodeBlock({ code }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="relative group">
      <pre className="bg-[#0a1209] border border-[#1c2e20] rounded-xl p-4 text-xs font-mono text-[#8fb898] overflow-x-auto whitespace-pre leading-relaxed">{code}</pre>
      <button onClick={() => { navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
        className="absolute top-2.5 right-2.5 btn-icon opacity-0 group-hover:opacity-100 transition-opacity bg-[#0f1810] border border-[#1c2e20]">
        {copied ? <CheckCircle2 size={13} className="text-[#25D366]" /> : <Copy size={13} />}
      </button>
    </div>
  );
}

import { CheckCircle2, Copy } from 'lucide-react';

export function Docs() {
  const sections = [
    {
      title: 'Step 1 — Get your API key',
      desc: 'Go to API Keys in the sidebar and create a key. Pass it as a Bearer token in every request.',
      code: `Authorization: Bearer wabk_live_xxxxxxxxxxxxxxxx`
    },
    {
      title: 'Step 2 — Get your Session ID',
      desc: 'The session_id tells the API which WhatsApp number to send from. Go to WA Numbers in the sidebar, connect your number by scanning a QR code, then copy the Session ID shown under your connected number. Each connected number has a unique session_id.',
      code: `// Session ID looks like this:
"session_id": "3f7c2e1a-9b4d-4f8a-bc23-1234567890ab"

// Find it on the WA Numbers page after connecting your WhatsApp`
    },
    {
      title: 'Step 3 — Send bulk messages',
      desc: 'POST /v1/messages/send — send personalized messages to multiple recipients at once.',
      code: `curl -X POST https://wabulk-api.onrender.com/v1/messages/send \\
  -H "Authorization: Bearer wabk_live_xxxx" \\
  -H "Content-Type: application/json" \\
  -d '{
    "session_id": "your-session-id-from-wa-numbers-page",
    "template": "Hi {{name}}, your {{plan}} expires on {{date}}.",
    "messages": [
      { "to": "+919876543210", "vars": { "name": "Rahul", "plan": "Gold", "date": "25 Apr" } },
      { "to": "+918800001234", "vars": { "name": "Priya", "plan": "Silver", "date": "30 Apr" } }
    ],
    "delay_ms": 3000
  }'`
    },
    {
      title: 'Response',
      desc: 'A successful request returns a campaign ID you can use to track delivery.',
      code: `{
  "campaign_id": "uuid",
  "queued": 2,
  "message": "2 messages queued successfully"
}`
    },
    { title: 'Node.js', desc: null, code: `const axios = require('axios');
const client = axios.create({
  baseURL: 'https://wabulk-api.onrender.com',
  headers: { Authorization: 'Bearer wabk_live_xxxx' }
});

await client.post('/v1/messages/send', {
  session_id: 'uuid',
  template: 'Hi {{name}}, order confirmed!',
  messages: users.map(u => ({ to: u.phone, vars: { name: u.name } })),
  delay_ms: 3000
});` },
    { title: 'Python', desc: null, code: `import requests

r = requests.post('https://wabulk-api.onrender.com/v1/messages/send',
  headers={'Authorization': 'Bearer wabk_live_xxxx'},
  json={
    'session_id': 'uuid',
    'template': 'Hi {{name}}, your fee is due.',
    'messages': [{'to': '+919876543210', 'vars': {'name': 'Rahul'}}]
  }
)` },
  ];

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-5 animate-in">
      <div><h1 className="page-title">API Documentation</h1><p className="page-subtitle">Integrate WaBulk into any application in minutes</p></div>
      {sections.map(s => (
        <div key={s.title} className="card">
          <h2 className="text-sm font-semibold text-[#a8c4ae] mb-2">{s.title}</h2>
          {s.desc && <p className="text-sm text-[#5a7a62] mb-3">{s.desc}</p>}
          <CodeBlock code={s.code} />
        </div>
      ))}
      <div className="card">
        <h2 className="text-sm font-semibold text-[#a8c4ae] mb-3">Rate limits by plan</h2>
        <table className="w-full text-sm">
          <thead><tr className="border-b border-[#1c2e20]">{['Plan','Per minute','Per month'].map(h => <th key={h} className="table-head">{h}</th>)}</tr></thead>
          <tbody>
            {[['Free','10 msg','500'],['Starter','100 msg','10,000'],['Pro','1,000 msg','Unlimited']].map(([p,...r]) => (
              <tr key={p} className="table-row">
                <td className="table-cell font-medium text-[#dce8df] capitalize">{p}</td>
                {r.map(v => <td key={v} className="table-cell text-[#5a7a62]">{v}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default Login;
