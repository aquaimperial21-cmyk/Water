'use client';

import { useEffect, useState } from 'react';
import { Shell } from '../../components/Shell';
import { Badge, Table } from '../../components/UI';
import { api, formatDate } from '../../lib/api';

interface Subscription {
  id: string; status: string; expiresAt: string; lockInUntil: string; startedAt: string;
  product?: { name: string }; plan?: { name: string }; device?: { serial: string } | null;
  user?: { id: string; fullName: string; phone: string };
}

export default function Subscriptions() {
  const [items, setItems] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/subscriptions').then((r) => { setItems(r.data.data); setLoading(false); });
  }, []);

  const tone = (s: string) =>
    s === 'ACTIVE' ? 'success' : s === 'GRACE' ? 'warning' : s === 'SUSPENDED' || s === 'CLOSED' ? 'danger' : 'info';

  return (
    <Shell title="Subscriptions">
      <Table
        headers={['Customer', 'Product', 'Plan', 'Device', 'Started', 'Expires', 'Status']}
        empty={loading ? 'Loading…' : 'No subscriptions'}
        rows={items.map((s) => [
          <span key="c">{s.user?.fullName ?? '—'}<div className="text-xs text-ink-muted">{s.user?.phone}</div></span>,
          s.product?.name ?? '—',
          s.plan?.name ?? '—',
          s.device?.serial ?? <span className="text-ink-muted text-xs">unassigned</span>,
          <span key="d" className="text-xs">{formatDate(s.startedAt)}</span>,
          <span key="e" className="text-xs">{formatDate(s.expiresAt)}</span>,
          <Badge key="b" tone={tone(s.status) as never}>{s.status}</Badge>,
        ])}
      />
    </Shell>
  );
}
