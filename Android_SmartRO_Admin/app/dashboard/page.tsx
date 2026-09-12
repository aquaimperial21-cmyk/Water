'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Shell } from '../../components/Shell';
import { Card, Pill, Stat } from '../../components/UI';
import { api, paiseToInr } from '../../lib/api';

interface Stats {
  activeSubscriptions: number;
  newInquiriesToday: number;
  openInquiries: number;
  bookingsThisMonth: number;
  openTickets: number;
  revenuePaiseThisMonth: number;
  devices: Record<string, number>;
}

const SHORTCUTS: { href: string; label: string; sub: string; icon: string }[] = [
  { href: '/inquiries', label: 'Inquiries', sub: 'Convert leads', icon: 'M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z' },
  { href: '/tickets', label: 'Service tickets', sub: 'Assign technicians', icon: 'M21 16V8.5a2.5 2.5 0 0 0-5 0V16M3 16h18M5 9h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-9a2 2 0 0 1 2-2z' },
  { href: '/customers', label: 'Customers', sub: 'Verify KYC, devices', icon: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z' },
  { href: '/banners', label: 'Banners', sub: 'Push offers', icon: 'M11 4 8 9l-5 .73 3.6 3.51L5.78 18 11 15.27 16.22 18l-.82-4.76L19 9.73 14 9z' },
  { href: '/broadcasts', label: 'Broadcasts', sub: 'WhatsApp & SMS', icon: 'M3 11l18-8-8 18-2-7-8-3z' },
  { href: '/technicians', label: 'Employees', sub: 'Onboard & manage', icon: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M10 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z' },
];

const DEVICE_TONES: Record<string, 'success' | 'accent' | 'warning' | 'neutral' | 'danger'> = {
  INSTALLED: 'success',
  ALLOCATED: 'accent',
  IN_SERVICE: 'warning',
  WAREHOUSE: 'neutral',
  RETURNED: 'neutral',
  RETIRED: 'danger',
};

export default function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    api.get('/admin/dashboard/stats').then((r) => setStats(r.data.data));
  }, []);

  return (
    <Shell title="Operations dashboard" eyebrow="Today at a glance">
      {!stats ? (
        <div className="text-ink-muted">Loading…</div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Stat
              label="Active subscriptions"
              value={stats.activeSubscriptions}
              sub="Customers with running plans"
            />
            <Stat
              label="Open tickets"
              value={stats.openTickets}
              sub="Awaiting technician action"
              trend={stats.openTickets > 5 ? 'up' : 'flat'}
            />
            <Stat
              label="New inquiries today"
              value={stats.newInquiriesToday}
              sub={`${stats.openInquiries} in pipeline`}
              trend={stats.newInquiriesToday > 0 ? 'up' : 'flat'}
            />
            <Stat
              label="Revenue this month"
              value={paiseToInr(stats.revenuePaiseThisMonth)}
              sub={`${stats.bookingsThisMonth} bookings`}
              trend="up"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-6">
            <Card variant="elevated">
              <div className="text-eyebrow uppercase text-ink-muted">Fleet</div>
              <h2 className="font-display text-title-lg font-bold mt-1">Devices by status</h2>
              {Object.keys(stats.devices).length === 0 ? (
                <p className="text-ink-muted text-sm mt-3">No devices yet.</p>
              ) : (
                <div className="mt-4 grid grid-cols-2 md:grid-cols-3 gap-3">
                  {Object.entries(stats.devices).map(([k, v]) => (
                    <div key={k} className="rounded-2xl border border-line bg-surface-warm/40 p-4">
                      <div className="flex items-center justify-between">
                        <div className="text-eyebrow uppercase text-ink-muted">{k}</div>
                        <Pill tone={DEVICE_TONES[k] ?? 'neutral'} size="sm" dot>
                          live
                        </Pill>
                      </div>
                      <div className="font-display text-display-md font-extrabold mt-2 text-ink tabular-nums">{v}</div>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <Card>
              <div className="text-eyebrow uppercase text-ink-muted">Shortcuts</div>
              <h2 className="font-display text-title-lg font-bold mt-1">Jump to</h2>
              <div className="mt-4 grid grid-cols-2 gap-2">
                {SHORTCUTS.map((s) => (
                  <Link
                    key={s.href}
                    href={s.href}
                    className="group flex flex-col gap-1.5 rounded-2xl border border-line bg-white hover:border-brand hover:bg-brand-tint p-3.5 transition-all"
                  >
                    <div className="h-8 w-8 grid place-items-center rounded-xl bg-brand-soft text-brand-ink group-hover:bg-brand group-hover:text-white transition-colors">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                        <path d={s.icon} />
                      </svg>
                    </div>
                    <div>
                      <div className="text-sm font-bold text-ink">{s.label}</div>
                      <div className="text-[11px] text-ink-muted">{s.sub}</div>
                    </div>
                  </Link>
                ))}
              </div>
            </Card>
          </div>
        </div>
      )}
    </Shell>
  );
}
