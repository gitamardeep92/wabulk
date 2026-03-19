import React from 'react';

export default function Billing() {
  const plans = [
    { name: 'Free', price: '₹0', period: '/month', msgs: '500 messages', sessions: '1 number',
      features: ['API access', 'Basic templates', 'Community support'], cta: 'Current plan', highlight: false },
    { name: 'Starter', price: '₹999', period: '/month', msgs: '10,000 messages', sessions: '3 numbers',
      features: ['Webhooks & receipts', 'Scheduled campaigns', 'Media messages', 'Email support'], cta: 'Upgrade', highlight: true },
    { name: 'Pro', price: '₹3,999', period: '/month', msgs: 'Unlimited messages', sessions: '10 numbers',
      features: ['Everything in Starter', 'Priority support', 'Custom sender name', 'Dedicated manager'], cta: 'Upgrade', highlight: false },
  ];

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-[#e8f0eb]">Billing & Plans</h1>
        <p className="text-sm text-[#6b8f72] mt-0.5">Upgrade to send more messages</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {plans.map((p) => (
          <div key={p.name} className={`card flex flex-col ${p.highlight ? 'border-wa/50' : ''}`}>
            {p.highlight && <div className="text-xs text-wa font-medium mb-2">Most popular</div>}
            <div className="text-base font-semibold text-[#e8f0eb] mb-1">{p.name}</div>
            <div className="text-2xl font-semibold text-[#e8f0eb]">
              {p.price}<span className="text-sm font-normal text-[#6b8f72]">{p.period}</span>
            </div>
            <div className="text-sm text-wa mt-1 mb-3">{p.msgs}</div>
            <div className="text-xs text-[#6b8f72] mb-1">{p.sessions}</div>
            <div className="flex-1 space-y-1.5 mb-5 mt-3">
              {p.features.map((f) => (
                <div key={f} className="flex items-center gap-2 text-sm text-[#a8c4ae]">
                  <span className="text-[#4ade80]">✓</span> {f}
                </div>
              ))}
            </div>
            <button className={p.highlight ? 'btn-primary' : 'btn-secondary'}>{p.cta}</button>
          </div>
        ))}
      </div>
      <p className="text-xs text-[#3a5040] mt-6 text-center">
        Payments via Razorpay. Contact us for custom enterprise pricing.
      </p>
    </div>
  );
}
