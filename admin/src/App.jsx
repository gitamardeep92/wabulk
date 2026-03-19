import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import AdminLogin from './pages/AdminLogin';
import AdminLayout from './components/AdminLayout';
import Overview from './pages/Overview';
import Users from './pages/Users';
import Campaigns from './pages/Campaigns';
import Sessions from './pages/Sessions';
import PlanLimits from './pages/PlanLimits';
import AuditLog from './pages/AuditLog';

function Protected({ children }) {
  const token = localStorage.getItem('wabulk_admin_token');
  return token ? children : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <BrowserRouter basename="/admin">
      <Toaster
        position="top-right"
        toastOptions={{
          style: { background: '#0d1520', color: '#e2e8f0', border: '1px solid #162030' },
        }}
      />
      <Routes>
        <Route path="/login" element={<AdminLogin />} />
        <Route path="/" element={<Protected><AdminLayout /></Protected>}>
          <Route index element={<Overview />} />
          <Route path="users" element={<Users />} />
          <Route path="campaigns" element={<Campaigns />} />
          <Route path="sessions" element={<Sessions />} />
          <Route path="plan-limits" element={<PlanLimits />} />
          <Route path="audit-log" element={<AuditLog />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
