import { create } from 'zustand';
import api from '../lib/api';

export const useAuthStore = create((set) => ({
  user: null,
  token: localStorage.getItem('wabulk_token'),
  loading: true,

  init: async () => {
    const token = localStorage.getItem('wabulk_token');
    if (!token) return set({ loading: false });
    try {
      const { data } = await api.get('/auth/me');
      set({ user: data.user, token, loading: false });
    } catch {
      localStorage.removeItem('wabulk_token');
      set({ user: null, token: null, loading: false });
    }
  },

  login: async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password });
    localStorage.setItem('wabulk_token', data.token);
    set({ user: data.user, token: data.token });
    return data.user;
  },

  signup: async (email, password, full_name, company) => {
    const { data } = await api.post('/auth/signup', { email, password, full_name, company });
    localStorage.setItem('wabulk_token', data.token);
    set({ user: data.user, token: data.token });
    return data.user;
  },

  logout: () => {
    localStorage.removeItem('wabulk_token');
    set({ user: null, token: null });
  },

  setUser: (user) => set({ user }),
}));
