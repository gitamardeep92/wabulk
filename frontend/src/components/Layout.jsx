import React, { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Smartphone, FileText, Send,
  Key, BookOpen, CreditCard, Settings, LogOut,
  MessageSquare, ChevronLeft, ChevronRight,
} from 'lucide-react';
import { useAuthStore } from '../hooks/useAuth';

const nav = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard', exact: true },
  { to: '/sessions', icon: Smartphone, label: 'WA Numbers' },
  { to: '/templates', icon: FileText, label: 'Templates' },
  { to: '/campaigns', icon: Send, label: 'Campaigns' },
  { to: '/api-keys', icon: Key, label: 'API Keys' },
  { to: '/docs', icon: BookOpen, label: 'API Docs' },
  { to: '/billing', icon: CreditCard, label: 'Billing' },
  { to: '/settings', icon: Settings, label: 'Settings' },
];

const planColors = {
  free: 'text-[#6b8f72] border-[#1e2e22]',
  starter: 'text-[#60a5fa] border-[#1a3050]',
  pro: 'text-[#facc15] border-[#3a2f00]',
};

export default function Layout() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);

  const handleLogout = () => { logout(); navigate('/login'); };

  return (
    <div className="flex h-screen overflow-hidden bg-[#0a0f0d]">
      {/* Sidebar */}
      <aside
        className={`flex flex-col border-r border-[#1e2e22] bg-[#080d0a] transition-all duration-200 ${collapsed ? 'w-16' : 'w-56'}`}
      >
        {/* Logo */}
        <div className="flex items-center gap-2.5 px-4 py-5 border-b border-[#1e2e22]">
          <div className="w-8 h-8 rounded-lg bg-wa flex items-center justify-center flex-shrink-0">
            <MessageSquare size={16} className="text-black" />
          </div>
          {!collapsed && (
            <span className="font-semibold text-[#e8f0eb] text-sm tracking-tight">WaBulk</span>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="ml-auto text-[#3a5040] hover:text-[#6b8f72] transition-colors"
          >
            {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-2 py-4 space-y-0.5 overflow-y-auto">
          {nav.map(({ to, icon: Icon, label, exact }) => (
            <NavLink
              key={to}
              to={to}
              end={exact}
              className={({ isActive }) =>
                `sidebar-link ${isActive ? 'active' : ''} ${collapsed ? 'justify-center px-0' : ''}`
              }
              title={collapsed ? label : undefined}
            >
              <Icon size={16} className="flex-shrink-0" />
              {!collapsed && <span>{label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* User */}
        <div className="border-t border-[#1e2e22] p-3">
          {!collapsed ? (
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-[#0d2016] border border-[#1a4a2a] flex items-center justify-center text-wa text-xs font-medium">
                {user?.full_name?.[0]?.toUpperCase() || 'U'}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium text-[#a8c4ae] truncate">{user?.full_name}</div>
                <div className={`text-[10px] capitalize border rounded px-1 inline-block ${planColors[user?.plan] || planColors.free}`}>
                  {user?.plan}
                </div>
              </div>
              <button onClick={handleLogout} className="text-[#3a5040] hover:text-[#f87171] transition-colors">
                <LogOut size={14} />
              </button>
            </div>
          ) : (
            <button onClick={handleLogout} className="w-full flex justify-center text-[#3a5040] hover:text-[#f87171] transition-colors py-1">
              <LogOut size={16} />
            </button>
          )}
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}
