import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useAuthStore } from './hooks/useAuth';

import { Login, Signup, Settings, Billing, Docs } from './pages/Login';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Sessions from './pages/Sessions';
import Templates from './pages/Templates';
import Campaigns from './pages/Campaigns';
import CampaignDetail from './pages/CampaignDetail';
import ApiKeys from './pages/ApiKeys';

function Protected({ children }) {
  const { user, loading } = useAuthStore();
  if (loading) return (
    <div className="h-screen flex items-center justify-center bg-[#060c07]">
      <div className="w-7 h-7 border-2 border-[#25D366] border-t-transparent rounded-full animate-spin" />
    </div>
  );
  return user ? children : <Navigate to="/login" replace />;
}

export default function App() {
  const init = useAuthStore(s => s.init);
  useEffect(() => { init(); }, []);

  return (
    <BrowserRouter basename="/app">
      <Toaster position="top-right" toastOptions={{
        style: { background: '#0f1810', color: '#dce8df', border: '1px solid #1c2e20', fontSize: '13px' },
        success: { iconTheme: { primary: '#25D366', secondary: '#061008' } },
      }} />
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
