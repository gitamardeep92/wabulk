import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useAuthStore } from './hooks/useAuth';

import Login from './pages/Login';
import Signup from './pages/Signup';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Sessions from './pages/Sessions';
import Templates from './pages/Templates';
import Campaigns from './pages/Campaigns';
import CampaignDetail from './pages/CampaignDetail';
import ApiKeys from './pages/ApiKeys';
import Docs from './pages/Docs';
import Billing from './pages/Billing';
import Settings from './pages/Settings';

function Protected({ children }) {
  const { user, loading } = useAuthStore();
  if (loading) return (
    <div className="h-screen flex items-center justify-center bg-[#0a0f0d]">
      <div className="w-8 h-8 border-2 border-wa border-t-transparent rounded-full animate-spin" />
    </div>
  );
  return user ? children : <Navigate to="/login" replace />;
}

export default function App() {
  const init = useAuthStore((s) => s.init);
  useEffect(() => { init(); }, []);

  return (
    <BrowserRouter basename="/app">
      <Toaster
        position="top-right"
        toastOptions={{
          style: { background: '#111a14', color: '#e8f0eb', border: '1px solid #1e2e22' },
        }}
      />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/" element={<Protected><Layout /></Protected>}>
          <Route index element={<Dashboard />} />
          <Route path="sessions" element={<Sessions />} />
          <Route path="templates" element={<Templates />} />
          <Route path="campaigns" element={<Campaigns />} />
          <Route path="campaigns/:id" element={<CampaignDetail />} />
          <Route path="api-keys" element={<ApiKeys />} />
          <Route path="docs" element={<Docs />} />
          <Route path="billing" element={<Billing />} />
          <Route path="settings" element={<Settings />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
