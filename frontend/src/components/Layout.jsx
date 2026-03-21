import React, { useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Smartphone, FileText, Send,
  Key, BookOpen, CreditCard, Settings, LogOut,
  MessageSquare, Users, Menu, X,
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
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Close mobile nav on route change
  useEffect(() => { setMobileOpen(false); }, [location.pathname]);

  const handleLogout = () => { logout(); navigate('/login'); };

  const SidebarContent = () => (
    <>
      {/* Logo */}
      <div className="flex items-center gap-2.5 h-14 px-4 border-b border-[#1c2e20] shrink-0">
        <div className="w-7 h-7 rounded-lg bg-[#25D366] flex items-center justify-center shrink-0">
          <MessageSquare size={14} className="text-[#061008]" />
        </div>
        <span className="font-semibold text-[#dce8df] text-sm tracking-tight">WaBulk</span>
        {/* Close button on mobile */}
        <button onClick={() => setMobileOpen(false)} className="ml-auto btn-icon md:hidden">
          <X size={16} />
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
        {nav.map(({ to, icon: Icon, label, exact }) => (
          <NavLink key={to} to={to} end={exact}
            className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
            <Icon size={15} className="shrink-0" />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Bottom nav */}
      <div className="px-2 py-2 space-y-0.5 border-t border-[#1c2e20]">
        {bottomNav.map(({ to, icon: Icon, label }) => (
          <NavLink key={to} to={to}
            className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
            <Icon size={15} className="shrink-0" />
            <span>{label}</span>
          </NavLink>
        ))}
      </div>

      {/* User */}
      <div className="border-t border-[#1c2e20] p-3">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-full bg-[#0a1f0d] border border-[#1c2e20] flex items-center justify-center text-[#25D366] text-xs font-semibold shrink-0">
            {user?.full_name?.[0]?.toUpperCase() || 'U'}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-medium text-[#a8c4ae] truncate leading-tight">{user?.full_name}</div>
            <span className={`${planBadge[user?.plan] || 'badge-gray'} text-[10px] capitalize mt-0.5`}>{user?.plan}</span>
          </div>
          <button onClick={handleLogout} className="btn-icon shrink-0" title="Sign out">
            <LogOut size={13} />
          </button>
        </div>
      </div>
    </>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-[#060c07]">

      {/* ── Desktop sidebar (hidden on mobile) ── */}
      <aside className="hidden md:flex flex-col w-[220px] shrink-0 border-r border-[#1c2e20] bg-[#080d09]">
        <SidebarContent />
      </aside>

      {/* ── Mobile sidebar overlay ── */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          {/* Drawer */}
          <aside className="absolute left-0 top-0 bottom-0 w-[260px] flex flex-col bg-[#080d09] border-r border-[#1c2e20] shadow-2xl animate-in">
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* ── Main content ── */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Mobile top bar */}
        <div className="flex items-center justify-between h-14 px-4 border-b border-[#1c2e20] bg-[#080d09] md:hidden shrink-0">
          <button onClick={() => setMobileOpen(true)} className="btn-icon">
            <Menu size={20} />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-[#25D366] flex items-center justify-center">
              <MessageSquare size={12} className="text-[#061008]" />
            </div>
            <span className="font-semibold text-[#dce8df] text-sm">WaBulk</span>
          </div>
          <div className="w-8" /> {/* spacer */}
        </div>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto bg-[#060c07]">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
