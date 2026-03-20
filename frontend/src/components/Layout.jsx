import React, { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Smartphone, FileText, Send,
  Key, BookOpen, CreditCard, Settings, LogOut,
  MessageSquare, ChevronLeft, ChevronRight, Users,
} from 'lucide-react';
import { useAuthStore } from '../hooks/useAuth';

const nav = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard', exact: true },
  { to: '/sessions', icon: Smartphone, label: 'WA Numbers' },
  { to: '/contacts', icon: Users, label: 'Contacts' },
  { to: '/templates', icon: FileText, label: 'Templates' },
  { to: '/campaigns', icon: Send, label: 'Campaigns' },
  { to: '/api-keys', icon: Key, label: 'API Keys' },
  { to: '/docs', icon: BookOpen, label: 'Docs' },
];

const bottomNav = [
  { to: '/billing', icon: CreditCard, label: 'Billing' },
  { to: '/settings', icon: Settings, label: 'Settings' },
];

const planBadge = { free: 'badge-gray', starter: 'badge-info', pro: 'badge-warn' };

export default function Layout() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-[#060c07]">
      {/* Sidebar */}
      <aside className={`flex flex-col shrink-0 border-r border-[#1c2e20] bg-[#080d09] transition-all duration-200 ${collapsed ? 'w-[60px]' : 'w-[220px]'}`}>
        {/* Logo */}
        <div className={`flex items-center border-b border-[#1c2e20] h-14 px-4 ${collapsed ? 'justify-center' : 'gap-2.5'}`}>
          <div className="w-7 h-7 rounded-lg bg-[#25D366] flex items-center justify-center shrink-0">
            <MessageSquare size={14} className="text-[#061008]" />
          </div>
          {!collapsed && <span className="font-semibold text-[#dce8df] text-sm tracking-tight">WaBulk</span>}
          {!collapsed && (
            <button onClick={() => setCollapsed(true)} className="ml-auto btn-icon">
              <ChevronLeft size={14} />
            </button>
          )}
          {collapsed && (
            <button onClick={() => setCollapsed(false)} className="absolute left-[46px] top-4 btn-icon bg-[#0f1810] border border-[#1c2e20] rounded-full z-10">
              <ChevronRight size={12} />
            </button>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
          {nav.map(({ to, icon: Icon, label, exact }) => (
            <NavLink key={to} to={to} end={exact}
              className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''} ${collapsed ? 'justify-center px-0' : ''}`}
              title={collapsed ? label : undefined}>
              <Icon size={15} className="shrink-0" />
              {!collapsed && <span>{label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* Bottom nav */}
        <div className="px-2 py-2 space-y-0.5 border-t border-[#1c2e20]">
          {bottomNav.map(({ to, icon: Icon, label }) => (
            <NavLink key={to} to={to}
              className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''} ${collapsed ? 'justify-center px-0' : ''}`}
              title={collapsed ? label : undefined}>
              <Icon size={15} className="shrink-0" />
              {!collapsed && <span>{label}</span>}
            </NavLink>
          ))}
        </div>

        {/* User */}
        <div className={`border-t border-[#1c2e20] p-3 ${collapsed ? 'flex justify-center' : ''}`}>
          {!collapsed ? (
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-full bg-[#0a1f0d] border border-[#1c2e20] flex items-center justify-center text-[#25D366] text-xs font-semibold shrink-0">
                {user?.full_name?.[0]?.toUpperCase() || 'U'}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium text-[#a8c4ae] truncate leading-tight">{user?.full_name}</div>
                <span className={`${planBadge[user?.plan] || 'badge-gray'} text-[10px] capitalize mt-0.5`}>{user?.plan}</span>
              </div>
              <button onClick={() => { logout(); navigate('/login'); }} className="btn-icon shrink-0" title="Sign out">
                <LogOut size={13} />
              </button>
            </div>
          ) : (
            <button onClick={() => { logout(); navigate('/login'); }} className="btn-icon" title="Sign out">
              <LogOut size={15} />
            </button>
          )}
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-y-auto bg-[#060c07]">
        <Outlet />
      </main>
    </div>
  );
}
