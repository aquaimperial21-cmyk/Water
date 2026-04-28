'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, apiErrorMessage, setAuth } from '../../lib/api';

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState('admin@smartro.in');
  const [password, setPassword] = useState('Admin@12345');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const r = await api.post('/auth/admin/login', { email, password });
      const data = r.data.data as { accessToken: string; refreshToken: string; user: { id: string; email: string; fullName: string; kind: string } };
      if (data.user.kind !== 'ADMIN') {
        setError('This account is not an admin account.');
        return;
      }
      setAuth(data.accessToken, data.refreshToken, { ...data.user, kind: 'ADMIN' });
      router.replace('/dashboard');
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen grid place-items-center bg-canvas p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-block bg-brand text-white px-3 py-1.5 rounded-md font-extrabold text-lg tracking-tight">SmartRO</div>
          <p className="text-sm text-ink-muted mt-3">Admin Console</p>
        </div>
        <form onSubmit={onSubmit} className="bg-white border border-line rounded-xl p-8 space-y-4 shadow-sm">
          <div>
            <label className="block text-sm font-semibold mb-1.5">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-3 py-2.5 border border-line rounded-md focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1.5">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-3 py-2.5 border border-line rounded-md focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
            />
          </div>
          {error ? <div className="text-sm text-rose-600">{error}</div> : null}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-brand text-white font-semibold py-2.5 rounded-md hover:bg-brand-dark disabled:opacity-50"
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
          <p className="text-xs text-ink-muted text-center pt-2">Demo: admin@smartro.in / Admin@12345</p>
        </form>
      </div>
    </div>
  );
}
