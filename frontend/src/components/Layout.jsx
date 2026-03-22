import React, { useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Smartphone, FileText, Send,
  Key, BookOpen, CreditCard, Settings, LogOut,
  MessageSquare, Users, Menu, X, ChevronRight,
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

// Bottom tab bar items (mobile only — most used 5)
const mobileBottomNav = [
  { to: '/', icon: LayoutDashboard, label: 'Home', exact: true },
  { to: '/contacts', icon: Users, label: 'Contacts' },
  { to: '/campaigns', icon: Send, label: 'Campaigns' },
  { to: '/sessions', icon: Smartphone, label: 'Numbers' },
  { to: '/settings', icon: Settings, label: 'More' },
];

const planBadge = { free: 'badge-gray', starter: 'badge-info', pro: 'badge-warn' };

export default function Layout() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => { setDrawerOpen(false); }, [location.pathname]);

  const handleLogout = () => { logout(); navigate('/login'); };

  const SidebarContent = () => (
    <>
      <div className="flex items-center gap-2.5 h-14 px-4 border-b border-[#1c2e20] shrink-0">
        <div className="w-7 h-7 rounded-lg bg-[#25D366] flex items-center justify-center shrink-0">
          <MessageSquare size={14} className="text-[#061008]" />
        </div>
        <span className="font-semibold text-[#dce8df] text-sm tracking-tight">WaBulk</span>
        <button onClick={() => setDrawerOpen(false)} className="ml-auto btn-icon md:hidden">
          <X size={16} />
        </button>
      </div>

      <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
        {nav.map(({ to, icon: Icon, label, exact }) => (
          <NavLink key={to} to={to} end={exact}
            className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
            <Icon size={15} className="shrink-0" />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="px-2 py-2 space-y-0.5 border-t border-[#1c2e20]">
        {bottomNav.map(({ to, icon: Icon, label }) => (
          <NavLink key={to} to={to}
            className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
            <Icon size={15} className="shrink-0" />
            <span>{label}</span>
          </NavLink>
        ))}
      </div>

      <div className="border-t border-[#1c2e20] p-3">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-full bg-[#0a1f0d] border border-[#1c2e20] flex items-center justify-center text-[#25D366] text-xs font-semibold shrink-0">
            {user?.full_name?.[0]?.toUpperCase() || 'U'}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-medium text-[#a8c4ae] truncate">{user?.full_name}</div>
            <span className={`${planBadge[user?.plan] || 'badge-gray'} text-[10px] capitalize`}>{user?.plan}</span>
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
      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col w-[220px] shrink-0 border-r border-[#1c2e20] bg-[#080d09]">
        <SidebarContent />
      </aside>

      {/* Mobile drawer overlay */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setDrawerOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-[260px] flex flex-col bg-[#080d09] border-r border-[#1c2e20] shadow-2xl animate-in">
            <SidebarContent />
          </aside>
        </div>
      )}

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile top bar — with iOS safe area inset for notch/dynamic island */}
        <div className="flex items-center justify-between px-4 border-b border-[#1c2e20] bg-[#080d09] md:hidden shrink-0"
          style={{
            paddingTop: 'calc(env(safe-area-inset-top) + 10px)',
            paddingBottom: '10px',
          }}>
          <button onClick={() => setDrawerOpen(true)} className="btn-icon">
            <Menu size={20} />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-[#25D366] flex items-center justify-center">
              <MessageSquare size={12} className="text-[#061008]" />
            </div>
            <span className="font-semibold text-[#dce8df] text-sm">WaBulk</span>
          </div>
          <div className="w-8" />
        </div>

        {/* Page content — extra bottom padding on mobile for tab bar */}
        <main className="flex-1 overflow-y-auto bg-[#060c07] pb-20 md:pb-0">
          <Outlet />
        </main>

        {/* Mobile bottom tab bar — with iOS home indicator safe area */}
        <nav className="fixed bottom-0 left-0 right-0 md:hidden bg-[#080d09] border-t border-[#1c2e20] z-40"
          style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
          <div className="flex items-stretch">
            {mobileBottomNav.map(({ to, icon: Icon, label, exact }) => (
              <NavLink key={to} to={to} end={exact} className={({ isActive }) =>
                `flex-1 flex flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-medium transition-colors min-h-[52px] ${isActive ? 'text-[#25D366]' : 'text-[#3a5040]'}`
              }>
                <Icon size={20} />
                {label}
              </NavLink>
            ))}
          </div>
        </nav>
      </div>
    </div>
  );
}
