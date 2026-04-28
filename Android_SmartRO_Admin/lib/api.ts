'use client';

import axios from 'axios';

export const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

const ACCESS_KEY = 'smartro-admin.access';
const REFRESH_KEY = 'smartro-admin.refresh';
const USER_KEY = 'smartro-admin.user';

export interface AdminUser { id: string; email: string; fullName?: string | null; kind: 'ADMIN' }

export const api = axios.create({ baseURL: API_BASE, timeout: 15000 });

api.interceptors.request.use((cfg) => {
  if (typeof window !== 'undefined') {
    const t = localStorage.getItem(ACCESS_KEY);
    if (t) cfg.headers.Authorization = `Bearer ${t}`;
  }
  return cfg;
});

api.interceptors.response.use(
  (r) => r,
  async (err) => {
    if (err.response?.status === 401 && typeof window !== 'undefined') {
      const orig = err.config as { _retry?: boolean; headers?: Record<string, string> };
      const refresh = localStorage.getItem(REFRESH_KEY);
      if (refresh && !orig?._retry) {
        try {
          const r = await axios.post(`${API_BASE}/auth/refresh`, { refreshToken: refresh });
          localStorage.setItem(ACCESS_KEY, r.data.data.accessToken);
          localStorage.setItem(REFRESH_KEY, r.data.data.refreshToken);
          orig._retry = true;
          orig.headers = orig.headers ?? {};
          orig.headers.Authorization = `Bearer ${r.data.data.accessToken}`;
          return api.request(orig as never);
        } catch {
          clearAuth();
          if (window.location.pathname !== '/login') window.location.href = '/login';
        }
      } else if (window.location.pathname !== '/login') {
        clearAuth();
        window.location.href = '/login';
      }
    }
    return Promise.reject(err);
  }
);

export function setAuth(access: string, refresh: string, user: AdminUser) {
  localStorage.setItem(ACCESS_KEY, access);
  localStorage.setItem(REFRESH_KEY, refresh);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}
export function clearAuth() {
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
  localStorage.removeItem(USER_KEY);
}
export function getStoredUser(): AdminUser | null {
  if (typeof window === 'undefined') return null;
  const v = localStorage.getItem(USER_KEY);
  return v ? (JSON.parse(v) as AdminUser) : null;
}

export function paiseToInr(p?: number | null): string {
  if (p == null) return '—';
  return '₹' + (Math.round(p) / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 });
}

export function formatDate(s?: string | null): string {
  if (!s) return '—';
  return new Date(s).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function formatDateTime(s?: string | null): string {
  if (!s) return '—';
  return new Date(s).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export function apiErrorMessage(e: unknown): string {
  const ax = e as { response?: { data?: { error?: { message?: string } } }; message?: string };
  return ax?.response?.data?.error?.message ?? ax?.message ?? 'Something went wrong';
}
