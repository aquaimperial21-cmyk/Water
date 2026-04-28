'use client';

import { useEffect, useState } from 'react';
import { Shell } from '../../components/Shell';
import { Badge, Table } from '../../components/UI';
import { api, formatDateTime, paiseToInr } from '../../lib/api';

interface Booking {
  id: string; status: string; createdAt: string;
  depositPaise: number; firstPaymentPaise: number;
  product?: { name: string }; plan?: { name: string }; city?: { name: string };
}

export default function Bookings() {
  const [items, setItems] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/admin/payments').then(() => {});
    // bookings endpoint admin variant — use customers' bookings
    Promise.all([
      api.get('/admin/customers'),
    ]).then(([customers]) => {
      const all: Booking[] = [];
      const list = customers.data.data as Array<{ id: string; fullName: string; phone: string; bookings?: Booking[] }>;
      for (const c of list) {
        for (const b of c.bookings ?? []) {
          all.push({ ...b, customerName: c.fullName, customerPhone: c.phone } as never);
        }
      }
      setItems(all.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)));
      setLoading(false);
    });
  }, []);

  const tone = (s: string) =>
    s === 'INSTALLED' || s === 'PAID' ? 'success'
      : s === 'CANCELLED' ? 'danger'
        : s === 'PENDING_KYC' || s === 'PENDING_PAY' ? 'warning'
          : 'info';

  return (
    <Shell title="Bookings">
      <Table
        headers={['Customer', 'Product', 'Plan', 'City', 'Total', 'Status', 'Created']}
        empty={loading ? 'Loading…' : 'No bookings'}
        rows={items.map((b) => [
          <span key="c">{(b as { customerName?: string }).customerName ?? '—'}<div className="text-xs text-ink-muted">{(b as { customerPhone?: string }).customerPhone ?? ''}</div></span>,
          b.product?.name ?? '—',
          b.plan?.name ?? '—',
          b.city?.name ?? '—',
          paiseToInr(b.depositPaise + b.firstPaymentPaise),
          <Badge key="s" tone={tone(b.status) as never}>{b.status}</Badge>,
          <span key="d" className="text-xs text-ink-muted">{formatDateTime(b.createdAt)}</span>,
        ])}
      />
    </Shell>
  );
}
