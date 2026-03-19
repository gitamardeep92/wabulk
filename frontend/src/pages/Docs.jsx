// Docs.jsx
import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';

function CodeBlock({ code }) {
  const [copied, setCopied] = useState(false);
  const copy = () => { navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 2000); };
  return (
    <div className="relative group">
      <pre className="bg-[#0d1610] border border-[#1e2e22] rounded-lg p-4 text-xs font-mono text-[#a8c4ae] overflow-x-auto whitespace-pre">
        {code}
      </pre>
      <button onClick={copy} className="absolute top-2 right-2 btn-ghost opacity-0 group-hover:opacity-100 transition-opacity">
        {copied ? <Check size={12} className="text-[#4ade80]" /> : <Copy size={12} />}
      </button>
    </div>
  );
}

const SEND_EXAMPLE = `curl -X POST https://api.wabulk.com/v1/messages/send \\
  -H "Authorization: Bearer wabk_live_xxxxxx" \\
  -H "Content-Type: application/json" \\
  -d '{
    "session_id": "your-wa-session-uuid",
    "template": "Hi {{name}}, your {{plan}} membership expires on {{date}}.",
    "messages": [
      {
        "to": "+919876543210",
        "vars": { "name": "Rahul", "plan": "Gold", "date": "25 Apr 2025" }
      },
      {
        "to": "+918800001234",
        "vars": { "name": "Priya", "plan": "Silver", "date": "30 Apr 2025" }
      }
    ],
    "delay_ms": 3000,
    "campaign_name": "April renewal reminders"
  }'`;

const RESPONSE_EXAMPLE = `{
  "campaign_id": "uuid-xxxx",
  "queued": 2,
  "skipped": 0,
  "message": "2 messages queued successfully"
}`;

const NODE_EXAMPLE = `const axios = require('axios');

const client = axios.create({
  baseURL: 'https://api.wabulk.com',
  headers: { Authorization: 'Bearer wabk_live_xxxxxx' }
});

// Send bulk notifications
await client.post('/v1/messages/send', {
  session_id: 'your-session-uuid',
  template: 'Hi {{name}}, order #{{order_id}} confirmed!',
  messages: users.map(u => ({
    to: u.phone,
    vars: { name: u.name, order_id: u.orderId }
  })),
  delay_ms: 3000
});`;

const PYTHON_EXAMPLE = `import requests

headers = {
    'Authorization': 'Bearer wabk_live_xxxxxx',
    'Content-Type': 'application/json'
}

payload = {
    'session_id': 'your-session-uuid',
    'template': 'Hi {{name}}, your fee of ₹{{amount}} is due on {{date}}.',
    'messages': [
        {'to': '+919876543210', 'vars': {'name': 'Rahul', 'amount': '5000', 'date': '1 May'}},
    ],
    'delay_ms': 3000
}

r = requests.post('https://api.wabulk.com/v1/messages/send',
                  json=payload, headers=headers)
print(r.json())`;

export function Docs() {
  return (
    <div className="p-6 max-w-3xl mx-auto space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-[#e8f0eb]">API Documentation</h1>
        <p className="text-sm text-[#6b8f72] mt-0.5">Integrate WaBulk into any application in minutes</p>
      </div>

      {[
        { title: 'Authentication', body: 'Pass your API key as a Bearer token in all requests. Get your key from the API Keys page.', code: null },
        { title: 'Send bulk messages', body: 'POST /v1/messages/send — Send personalized notifications to multiple recipients.', code: SEND_EXAMPLE },
        { title: 'Response', body: 'A successful request returns a campaign ID you can use to track delivery.', code: RESPONSE_EXAMPLE },
        { title: 'Node.js example', body: null, code: NODE_EXAMPLE },
        { title: 'Python example', body: null, code: PYTHON_EXAMPLE },
      ].map(({ title, body, code }) => (
        <div key={title} className="card">
          <h2 className="text-sm font-medium text-[#a8c4ae] mb-2">{title}</h2>
          {body && <p className="text-sm text-[#6b8f72] mb-3">{body}</p>}
          {code && <CodeBlock code={code} />}
        </div>
      ))}

      <div className="card">
        <h2 className="text-sm font-medium text-[#a8c4ae] mb-3">Rate limits</h2>
        <table className="w-full text-sm">
          <thead><tr className="border-b border-[#1e2e22]">
            {['Plan', 'Msgs/min', 'Msgs/month'].map(h => <th key={h} className="text-left px-2 py-2 text-xs text-[#6b8f72]">{h}</th>)}
          </tr></thead>
          <tbody>
            {[['Free','10','500'],['Starter','100','10,000'],['Pro','1,000','Unlimited']].map(([plan,...rest]) => (
              <tr key={plan} className="border-b border-[#1e2e22]">
                <td className="px-2 py-2 capitalize text-[#e8f0eb]">{plan}</td>
                {rest.map(v => <td key={v} className="px-2 py-2 text-[#6b8f72]">{v}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Billing.jsx
export function Billing() {
  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-[#e8f0eb]">Billing & Plans</h1>
        <p className="text-sm text-[#6b8f72] mt-0.5">Upgrade to send more messages</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {[
          { name: 'Free', price: '₹0', period: '/month', msgs: '500 messages', sessions: '1 number', features: ['API access', 'Basic templates', 'Community support'], cta: 'Current plan', highlight: false },
          { name: 'Starter', price: '₹999', period: '/month', msgs: '10,000 messages', sessions: '3 numbers', features: ['Webhooks & receipts', 'Scheduled campaigns', 'Media messages', 'Email support'], cta: 'Upgrade', highlight: true },
          { name: 'Pro', price: '₹3,999', period: '/month', msgs: 'Unlimited messages', sessions: '10 numbers', features: ['Everything in Starter', 'Priority support', 'Custom sender name', 'Dedicated manager'], cta: 'Upgrade', highlight: false },
        ].map((p) => (
          <div key={p.name} className={`card flex flex-col ${p.highlight ? 'border-wa/50' : ''}`}>
            {p.highlight && <div className="text-xs text-wa font-medium mb-2">Most popular</div>}
            <div className="text-base font-semibold text-[#e8f0eb] mb-1">{p.name}</div>
            <div className="text-2xl font-semibold text-[#e8f0eb]">{p.price}<span className="text-sm font-normal text-[#6b8f72]">{p.period}</span></div>
            <div className="text-sm text-wa mt-1 mb-3">{p.msgs}</div>
            <div className="text-xs text-[#6b8f72] mb-1">{p.sessions}</div>
            <div className="flex-1 space-y-1.5 mb-5 mt-3">
              {p.features.map((f) => (
                <div key={f} className="flex items-center gap-2 text-sm text-[#a8c4ae]">
                  <span className="text-[#4ade80]">✓</span> {f}
                </div>
              ))}
            </div>
            <button className={p.highlight ? 'btn-primary' : 'btn-secondary'}>
              {p.cta}
            </button>
          </div>
        ))}
      </div>
      <p className="text-xs text-[#3a5040] mt-6 text-center">
        Payments via Razorpay. Contact us for custom enterprise pricing.
      </p>
    </div>
  );
}

// Settings.jsx
export function Settings() {
  const [form, setForm] = useState({ full_name: '', company: '', webhook_url: '' });
  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-[#e8f0eb]">Settings</h1>
        <p className="text-sm text-[#6b8f72] mt-0.5">Manage your account and preferences</p>
      </div>
      <div className="card">
        <h2 className="text-sm font-medium text-[#a8c4ae] mb-4">Profile</h2>
        <div className="space-y-3">
          <div><label className="label">Full name</label><input className="input" placeholder="Rahul Sharma" /></div>
          <div><label className="label">Company</label><input className="input" placeholder="Acme Pvt Ltd" /></div>
          <button className="btn-primary">Save changes</button>
        </div>
      </div>
      <div className="card">
        <h2 className="text-sm font-medium text-[#a8c4ae] mb-4">Webhook</h2>
        <p className="text-sm text-[#6b8f72] mb-3">Receive delivery status callbacks at your URL.</p>
        <div><label className="label">Callback URL</label><input className="input" placeholder="https://yourapp.com/webhooks/wabulk" /></div>
        <button className="btn-primary mt-3">Save webhook</button>
      </div>
    </div>
  );
}

export default Docs;
