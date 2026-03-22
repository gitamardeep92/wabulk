import React, { useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Smartphone, FileText, Send, Key,
  BookOpen, CreditCard, Settings, LogOut, MessageSquare,
  Users, Menu, X, ChevronLeft, ChevronRight,
} from 'lucide-react';
import { useAuthStore } from '../hooks/useAuth';

const mainNav = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard', exact: true },
  { to: '/sessions', icon: Smartphone, label: 'Numbers' },
  { to: '/contacts', icon: Users, label: 'Contacts' },
  { to: '/campaigns', icon: Send, label: 'Campaigns' },
  { to: '/templates', icon: FileText, label: 'Templates' },
];

const sidebarNav = [
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
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);

  const handleLogout = () => { logout(); navigate('/login'); };

  return (
    <div className="flex h-screen overflow-hidden bg-[#060c07]">

      {/* ── Desktop sidebar ── */}
      <aside className={`hidden md:flex flex-col shrink-0 border-r border-[#1c2e20] bg-[#080d09] transition-all duration-200 ${collapsed ? 'w-[60px]' : 'w-[220px]'}`}>
        {/* Logo */}
        <div className={`flex items-center border-b border-[#1c2e20] h-14 px-3 ${collapsed ? 'justify-center' : 'gap-2.5'}`}>
          <div className="w-7 h-7 rounded-lg bg-[#25D366] flex items-center justify-center shrink-0">
            <MessageSquare size={14} className="text-[#061008]" />
          </div>
          {!collapsed && <span className="font-semibold text-[#dce8df] text-sm tracking-tight">WaBulk</span>}
          {!collapsed && (
            <button onClick={() => setCollapsed(true)} className="ml-auto btn-icon">
              <ChevronLeft size={14} />
            </button>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
          {sidebarNav.map(({ to, icon: Icon, label, exact }) => (
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
                <div className="text-xs font-medium text-[#a8c4ae] truncate">{user?.full_name}</div>
                <span className={`${planBadge[user?.plan] || 'badge-gray'} text-[10px] capitalize`}>{user?.plan}</span>
              </div>
              <button onClick={handleLogout} className="btn-icon shrink-0"><LogOut size={13} /></button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <button onClick={() => setCollapsed(false)} className="btn-icon">
                <ChevronRight size={14} />
              </button>
              <button onClick={handleLogout} className="btn-icon"><LogOut size={13} /></button>
            </div>
          )}
        </div>
      </aside>

      {/* ── Main area ── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile top bar */}
        <div className="flex items-center justify-between h-14 px-4 border-b border-[#1c2e20] bg-[#080d09] md:hidden shrink-0 safe-top">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-[#25D366] flex items-center justify-center">
              <MessageSquare size={14} className="text-[#061008]" />
            </div>
            <span className="font-semibold text-[#dce8df] text-sm">WaBulk</span>
          </div>
          <div className="flex items-center gap-2">
            <NavLink to="/settings" className={({ isActive }) => `btn-icon ${isActive ? 'text-[#25D366]' : ''}`}>
              <Settings size={18} />
            </NavLink>
          </div>
        </div>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto bg-[#060c07] pb-20 md:pb-0">
          <Outlet />
        </main>

        {/* ── Mobile bottom nav (app-style) ── */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-[#080d09] border-t border-[#1c2e20] safe-bottom z-40">
          <div className="flex items-center justify-around px-1 py-1">
            {mainNav.map(({ to, icon: Icon, label, exact }) => (
              <NavLink key={to} to={to} end={exact}
                className={({ isActive }) =>
                  `flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl transition-all min-w-[56px] ${
                    isActive ? 'text-[#25D366]' : 'text-[#5a7a62]'
                  }`
                }>
                {({ isActive }) => (
                  <>
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all ${isActive ? 'bg-[#0a1f0d]' : ''}`}>
                      <Icon size={18} />
                    </div>
                    <span className="text-[10px] font-medium leading-none">{label}</span>
                  </>
                )}
              </NavLink>
            ))}
            {/* More menu for extra items */}
            <NavLink to="/api-keys"
              className={({ isActive }) =>
                `flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl transition-all min-w-[56px] ${
                  isActive ? 'text-[#25D366]' : 'text-[#5a7a62]'
                }`
              }>
              {({ isActive }) => (
                <>
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all ${isActive ? 'bg-[#0a1f0d]' : ''}`}>
                    <Key size={18} />
                  </div>
                  <span className="text-[10px] font-medium leading-none">API Keys</span>
                </>
              )}
            </NavLink>
          </div>
        </nav>
      </div>
    </div>
  );
}
