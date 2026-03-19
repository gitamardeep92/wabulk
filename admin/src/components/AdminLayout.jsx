import React from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import {
  Shield, LayoutDashboard, Users, Send,
  Smartphone, CreditCard, ScrollText, LogOut,
} from 'lucide-react';

const nav = [
  { to: '/', icon: LayoutDashboard, label: 'Overview', exact: true },
  { to: '/users', icon: Users, label: 'Users' },
  { to: '/campaigns', icon: Send, label: 'Campaigns' },
  { to: '/sessions', icon: Smartphone, label: 'WA Sessions' },
  { to: '/plan-limits', icon: CreditCard, label: 'Plan Limits' },
  { to: '/audit-log', icon: ScrollText, label: 'Audit Log' },
];

export default function AdminLayout() {
  const navigate = useNavigate();
  const logout = () => { localStorage.removeItem('wabulk_admin_token'); navigate('/login'); };

  return (
    <div className="flex h-screen overflow-hidden bg-[#07090a]">
      <aside className="w-56 flex flex-col border-r border-[#162030] bg-[#060a10]">
        <div className="flex items-center gap-2.5 px-4 py-5 border-b border-[#162030]">
          <div className="w-8 h-8 rounded-lg bg-[#3b82f6] flex items-center justify-center">
            <Shield size={15} className="text-white" />
          </div>
          <div>
            <div className="text-sm font-semibold text-[#e2e8f0]">WaBulk</div>
            <div className="text-[10px] text-[#4a6582] uppercase tracking-wider">Admin Panel</div>
          </div>
        </div>

        <nav className="flex-1 px-2 py-4 space-y-0.5 overflow-y-auto">
          {nav.map(({ to, icon: Icon, label, exact }) => (
            <NavLink
              key={to}
              to={to}
              end={exact}
              className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
            >
              <Icon size={15} className="flex-shrink-0" />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-[#162030] p-3">
          <button onClick={logout}
            className="flex items-center gap-2 text-sm text-[#4a6582] hover:text-[#f87171] transition-colors w-full px-2 py-1.5">
            <LogOut size={14} /> Sign out
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}
