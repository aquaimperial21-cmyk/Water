'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { AdminUser, clearAuth, getStoredUser } from '../lib/api';

const NAV: Array<{ href: string; label: string; icon: string }> = [
  { href: '/dashboard', label: 'Dashboard', icon: '📊' },
  { href: '/inquiries', label: 'Inquiries', icon: '📥' },
  { href: '/bookings', label: 'Bookings', icon: '🛒' },
  { href: '/subscriptions', label: 'Subscriptions', icon: '💧' },
  { href: '/customers', label: 'Customers', icon: '👥' },
  { href: '/tickets', label: 'Tickets', icon: '🎫' },
  { href: '/technicians', label: 'Technicians', icon: '🔧' },
];

export function Shell({ children, title }: { children: React.ReactNode; title: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<AdminUser | null>(null);

  useEffect(() => {
    const u = getStoredUser();
    if (!u) {
      router.replace('/login');
    } else {
      setUser(u);
    }
  }, [router]);

  function logout() {
    clearAuth();
    router.replace('/login');
  }

  if (!user) {
    return <div className="min-h-screen grid place-items-center text-ink-muted">Loading…</div>;
  }

  return (
    <div className="min-h-screen flex bg-canvas">
      <aside className="w-60 bg-white border-r border-line flex flex-col">
        <div className="p-5 border-b border-line">
          <div className="text-xl font-extrabold text-brand tracking-tight">SmartRO</div>
          <div className="text-xs text-ink-muted">Admin Console</div>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {NAV.map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + '/');
            return (
              <Link
                key={item.href}
                href={item.href}
                className={
                  'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium ' +
                  (active ? 'bg-brand text-white' : 'text-ink hover:bg-canvas')
                }
              >
                <span>{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="p-3 border-t border-line">
          <div className="text-xs text-ink-muted">Signed in as</div>
          <div className="text-sm font-semibold truncate">{user.fullName ?? user.email}</div>
          <button onClick={logout} className="mt-3 w-full text-xs px-3 py-1.5 rounded-md border border-line hover:bg-canvas">
            Sign out
          </button>
        </div>
      </aside>
      <main className="flex-1 min-w-0">
        <header className="bg-white border-b border-line px-8 py-4 flex items-center justify-between">
          <h1 className="text-xl font-bold">{title}</h1>
          <div className="text-xs text-ink-muted">v0.1.0 prototype</div>
        </header>
        <div className="p-8">{children}</div>
      </main>
    </div>
  );
}
