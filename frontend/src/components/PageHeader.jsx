import React from 'react';

export default function PageHeader({ title, subtitle, action }) {
  return (
    <div className="flex items-center justify-between mb-7">
      <div>
        <h1 className="page-title">{title}</h1>
        {subtitle && <p className="page-subtitle">{subtitle}</p>}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}
