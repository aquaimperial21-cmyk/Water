'use client';

import { useEffect, useState } from 'react';
import { Shell } from '../../components/Shell';
import { Badge, Table } from '../../components/UI';
import { api } from '../../lib/api';

interface Tech {
  id: string; employeeCode: string; zone: string; isActive: boolean;
  user: { id: string; fullName: string; phone: string; email: string };
}

export default function Technicians() {
  const [items, setItems] = useState<Tech[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/technician').then((r) => { setItems(r.data.data); setLoading(false); });
  }, []);

  return (
    <Shell title="Technicians">
      <Table
        headers={['Employee code', 'Name', 'Phone', 'Email', 'Zone', 'Status']}
        empty={loading ? 'Loading…' : 'No technicians'}
        rows={items.map((t) => [
          <span key="c" className="font-semibold">{t.employeeCode}</span>,
          t.user.fullName,
          t.user.phone,
          <span key="e" className="text-xs text-ink-muted">{t.user.email}</span>,
          t.zone,
          <Badge key="b" tone={t.isActive ? 'success' : 'neutral'}>{t.isActive ? 'ACTIVE' : 'INACTIVE'}</Badge>,
        ])}
      />
    </Shell>
  );
}
