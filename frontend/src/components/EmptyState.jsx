import React from 'react';

export default function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="card flex flex-col items-center justify-center py-16 text-center">
      <div className="w-14 h-14 rounded-2xl bg-[#0a1209] border border-[#1c2e20] flex items-center justify-center mb-4">
        <Icon size={22} className="text-[#344a38]" />
      </div>
      <h3 className="font-semibold text-[#8fb898] mb-1">{title}</h3>
      <p className="text-sm text-[#3a5040] max-w-xs mb-5">{description}</p>
      {action}
    </div>
  );
}
