'use client';

import { useEffect, useState } from 'react';
import { Shell } from '../../components/Shell';
import { Card, Stat } from '../../components/UI';
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

export default function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    api.get('/admin/dashboard/stats').then((r) => setStats(r.data.data));
  }, []);

  return (
    <Shell title="Dashboard">
      {!stats ? (
        <div className="text-ink-muted">Loading…</div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Stat label="Active subscriptions" value={stats.activeSubscriptions} />
            <Stat label="Open tickets" value={stats.openTickets} />
            <Stat label="New inquiries today" value={stats.newInquiriesToday} sub={`${stats.openInquiries} open total`} />
            <Stat label="Revenue this month" value={paiseToInr(stats.revenuePaiseThisMonth)} sub={`${stats.bookingsThisMonth} bookings`} />
          </div>

          <Card>
            <h2 className="text-base font-bold mb-4">Devices by status</h2>
            {Object.keys(stats.devices).length === 0 ? (
              <p className="text-ink-muted text-sm">No devices yet.</p>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {Object.entries(stats.devices).map(([k, v]) => (
                  <div key={k} className="bg-canvas rounded-lg p-4">
                    <div className="text-xs text-ink-muted font-semibold">{k}</div>
                    <div className="text-xl font-bold mt-1">{v}</div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card>
            <h2 className="text-base font-bold mb-2">Quick actions</h2>
            <ul className="text-sm space-y-2 text-ink-muted">
              <li>• Convert <a href="/inquiries" className="text-brand font-semibold">inquiries</a> to bookings as they come in</li>
              <li>• Verify pending <a href="/customers" className="text-brand font-semibold">customers</a> KYC</li>
              <li>• Assign technicians to open <a href="/tickets" className="text-brand font-semibold">tickets</a></li>
              <li>• Track <a href="/subscriptions" className="text-brand font-semibold">subscriptions</a> approaching expiry</li>
            </ul>
          </Card>
        </div>
      )}
    </Shell>
  );
}
