import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { MessageSquare } from 'lucide-react';
import { useAuthStore } from '../hooks/useAuth';
import toast from 'react-hot-toast';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuthStore();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0f0d] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2.5 justify-center mb-8">
          <div className="w-9 h-9 rounded-xl bg-wa flex items-center justify-center">
            <MessageSquare size={18} className="text-black" />
          </div>
          <span className="text-xl font-semibold text-[#e8f0eb]">WaBulk</span>
        </div>

        <div className="card">
          <h1 className="text-lg font-semibold text-[#e8f0eb] mb-1">Welcome back</h1>
          <p className="text-sm text-[#6b8f72] mb-6">Sign in to your dashboard</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Email</label>
              <input className="input" type="email" value={email}
                onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" required />
            </div>
            <div>
              <label className="label">Password</label>
              <input className="input" type="password" value={password}
                onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required />
            </div>
            <button type="submit" disabled={loading}
              className="btn-primary w-full flex items-center justify-center gap-2 py-2.5 disabled:opacity-50">
              {loading ? <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" /> : null}
              Sign in
            </button>
          </form>

          <p className="text-center text-sm text-[#6b8f72] mt-5">
            No account?{' '}
            <Link to="/signup" className="text-wa hover:underline">Create one free</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
