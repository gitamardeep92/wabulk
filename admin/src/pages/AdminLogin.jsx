import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield } from 'lucide-react';
import api from '../lib/api';
import toast from 'react-hot-toast';

export default function AdminLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await api.post('/admin-api/login', { email, password });
      localStorage.setItem('wabulk_admin_token', data.token);
      navigate('/');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#07090a] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-3 justify-center mb-8">
          <div className="w-10 h-10 rounded-xl bg-[#3b82f6] flex items-center justify-center">
            <Shield size={20} className="text-white" />
          </div>
          <div>
            <div className="text-lg font-semibold text-[#e2e8f0]">WaBulk Admin</div>
            <div className="text-xs text-[#4a6582]">Restricted access</div>
          </div>
        </div>

        <div className="card">
          <h1 className="text-base font-semibold text-[#e2e8f0] mb-5">Administrator login</h1>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Admin email</label>
              <input className="input" type="email" value={email}
                onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div>
              <label className="label">Password</label>
              <input className="input" type="password" value={password}
                onChange={(e) => setPassword(e.target.value)} required />
            </div>
            <button type="submit" disabled={loading}
              className="btn-primary w-full flex items-center justify-center gap-2 py-2.5 disabled:opacity-50">
              {loading && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
              Sign in
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
