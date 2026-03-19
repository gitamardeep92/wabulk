import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { MessageSquare } from 'lucide-react';
import { useAuthStore } from '../hooks/useAuth';
import toast from 'react-hot-toast';

export default function Signup() {
  const [form, setForm] = useState({ email: '', password: '', full_name: '', company: '' });
  const [loading, setLoading] = useState(false);
  const { signup } = useAuthStore();
  const navigate = useNavigate();

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.password.length < 8) return toast.error('Password must be at least 8 characters');
    setLoading(true);
    try {
      await signup(form.email, form.password, form.full_name, form.company);
      toast.success('Account created! Welcome to WaBulk.');
      navigate('/');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Signup failed');
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
          <h1 className="text-lg font-semibold text-[#e8f0eb] mb-1">Start for free</h1>
          <p className="text-sm text-[#6b8f72] mb-6">500 free messages every month</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Full name</label>
              <input className="input" value={form.full_name} onChange={set('full_name')} placeholder="Rahul Sharma" required />
            </div>
            <div>
              <label className="label">Email</label>
              <input className="input" type="email" value={form.email} onChange={set('email')} placeholder="you@company.com" required />
            </div>
            <div>
              <label className="label">Company (optional)</label>
              <input className="input" value={form.company} onChange={set('company')} placeholder="Acme Pvt Ltd" />
            </div>
            <div>
              <label className="label">Password</label>
              <input className="input" type="password" value={form.password} onChange={set('password')} placeholder="Min 8 characters" required />
            </div>
            <button type="submit" disabled={loading}
              className="btn-primary w-full flex items-center justify-center gap-2 py-2.5 disabled:opacity-50">
              {loading && <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />}
              Create account
            </button>
          </form>

          <p className="text-center text-xs text-[#3a5040] mt-4">
            By signing up you agree to our terms of service.
          </p>
          <p className="text-center text-sm text-[#6b8f72] mt-3">
            Already have an account?{' '}
            <Link to="/login" className="text-wa hover:underline">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
