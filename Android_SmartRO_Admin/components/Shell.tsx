'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { AdminUser, clearAuth, getStoredUser } from '../lib/api';
import { WaterDropMark } from './WaterDropMark';

const NAV: Array<{ href: string; label: string; icon: string; group?: string }> = [
  { href: '/dashboard', label: 'Dashboard', icon: 'M3 12l9-9 9 9M5 10v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V10' },
  { href: '/inquiries', label: 'Inquiries', icon: 'M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z' },
  { href: '/bookings', label: 'Bookings', icon: 'M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2M9 4h6v4H9z' },
  { href: '/subscriptions', label: 'Subscriptions', icon: 'M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 6v4l3 3' },
  { href: '/dispatch', label: 'Device dispatch', icon: 'M16 3h5v5M8 21H3v-5M21 3l-7.5 7.5M3 21l7.5-7.5' },
  { href: '/devices', label: 'Paired devices', icon: 'M9 3h6l1 4H8zM5 7h14l-1 13H6zM10 11v6M14 11v6' },
  { href: '/products', label: 'Products', icon: 'M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z' },
  { href: '/customers', label: 'Customers', icon: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75' },
  { href: '/tickets', label: 'Service tickets', icon: 'M21 16V8.5a2.5 2.5 0 0 0-5 0V16M3 16h18M5 9h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-9a2 2 0 0 1 2-2z' },
  { href: '/technicians', label: 'Employees', icon: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M10 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM18 7v6M21 10h-6' },
  { href: '/banners', label: 'Banners & offers', icon: 'M11 4 8 9l-5 .73 3.6 3.51L5.78 18 11 15.27 16.22 18l-.82-4.76L19 9.73 14 9z' },
  { href: '/broadcasts', label: 'Broadcasts', icon: 'M3 11l18-8-8 18-2-7-8-3z' },
];

export function Shell({ children, title, eyebrow }: { children: React.ReactNode; title: string; eyebrow?: string }) {
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
    <div className="min-h-screen flex aurora-bg">
      <aside className="w-64 m-4 bg-white/80 backdrop-blur-2xl border border-white/60 rounded-3xl shadow-card flex flex-col sticky top-4 self-start max-h-[calc(100vh-2rem)]">
        <div className="p-5 border-b border-line/70">
          <div className="flex items-center gap-2.5">
            <WaterDropMark size={32} />
            <div>
              <div className="font-display font-extrabold text-lg leading-none tracking-tight">
                Imperial<span className="text-brand">Aqua</span>
              </div>
              <div className="text-[10px] uppercase tracking-[0.18em] text-ink-muted mt-1">Admin console</div>
            </div>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {NAV.map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + '/');
            return (
              <Link
                key={item.href}
                href={item.href}
                className={
                  'group relative flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all ' +
                  (active
                    ? 'text-white bg-gradient-accent shadow-glow'
                    : 'text-ink-soft hover:text-ink hover:bg-surface-warm')
                }
              >
                {active && (
                  <span
                    aria-hidden
                    className="absolute inset-x-2 top-1 h-1/2 rounded-t-lg opacity-50 pointer-events-none"
                    style={{ background: 'linear-gradient(to bottom, hsl(0 0% 100% / 0.35), transparent)' }}
                  />
                )}
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={active ? 2.4 : 2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="shrink-0 relative"
                >
                  <path d={item.icon} />
                </svg>
                <span className="relative">{item.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="p-4 border-t border-line/70">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-gradient-deep grid place-items-center text-white font-extrabold text-sm shrink-0 shadow-soft">
              {(user.fullName ?? user.email ?? '?').slice(0, 1).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[10px] uppercase tracking-wider text-ink-muted">Signed in as</div>
              <div className="text-sm font-bold truncate">{user.fullName ?? user.email}</div>
            </div>
          </div>
          <button
            onClick={logout}
            className="mt-3 w-full text-xs font-bold px-3 py-2 rounded-lg border border-line hover:border-line-strong hover:bg-surface-warm transition-colors"
          >
            Sign out
          </button>
        </div>
      </aside>

      <main className="flex-1 min-w-0">
        {/* Page header — solid white card so the title can never blend into the
            aurora gradient. Inline styles for size + colour so the headline
            is rendered correctly even if a Tailwind class is purged. */}
        <div className="px-4 pt-4">
          <header
            className="rounded-2xl border flex items-center justify-between gap-4 px-6 py-5"
            style={{ backgroundColor: '#FFFFFF', borderColor: '#E6E2DB' }}
          >
            <div className="min-w-0">
              {eyebrow ? (
                <div
                  className="font-bold uppercase"
                  style={{ color: '#657081', fontSize: 11, letterSpacing: '0.18em' }}
                >
                  {eyebrow}
                </div>
              ) : null}
              <h1
                className="font-extrabold tracking-tight"
                style={{
                  color: '#151D28',
                  fontSize: 28,
                  lineHeight: '34px',
                  marginTop: eyebrow ? 4 : 0,
                  letterSpacing: '-0.02em',
                }}
              >
                {title}
              </h1>
            </div>
            <div className="shrink-0">
              <span
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full font-bold uppercase"
                style={{
                  backgroundColor: '#E7F9F2',
                  color: '#27B07D',
                  fontSize: 11,
                  letterSpacing: '0.06em',
                }}
              >
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ backgroundColor: '#27B07D' }}
                />
                production v1.0
              </span>
            </div>
          </header>
        </div>

        <div className="px-8 pt-6 pb-12">{children}</div>
      </main>
    </div>
  );
}
