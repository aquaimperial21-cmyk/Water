'use client';

import { useEffect, useState } from 'react';
import { Shell } from '../../components/Shell';
import { Badge, Card, Table } from '../../components/UI';
import { api, formatDate } from '../../lib/api';

interface Customer {
  id: string; phone: string; email?: string | null; fullName?: string | null; createdAt: string;
  addresses: Array<{ city?: { name: string }; pincode: string }>;
  subscriptions: Array<{ id: string; status: string; product?: { name: string } }>;
  kycRecords: Array<{ status: string }>;
}

export default function Customers() {
  const [items, setItems] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    api.get('/admin/customers').then((r) => { setItems(r.data.data); setLoading(false); });
  }, []);

  const detail = items.find((c) => c.id === selected);

  return (
    <Shell title="Customers">
      <Table
        headers={['Name', 'Phone', 'City', 'Subscriptions', 'KYC', 'Joined', '']}
        empty={loading ? 'Loading…' : 'No customers'}
        rows={items.map((c) => [
          c.fullName ?? '—',
          c.phone,
          c.addresses[0]?.city?.name ?? '—',
          c.subscriptions.length,
          c.kycRecords[0] ? <Badge key="b" tone={c.kycRecords[0].status === 'VERIFIED' ? 'success' : 'warning'}>{c.kycRecords[0].status}</Badge> : <span className="text-ink-muted text-xs">none</span>,
          <span key="d" className="text-xs">{formatDate(c.createdAt)}</span>,
          <button key="x" onClick={() => setSelected(c.id)} className="text-brand text-xs font-semibold">View</button>,
        ])}
      />

      {detail ? (
        <div className="fixed inset-0 z-50 bg-black/40 grid place-items-center p-4" onClick={() => setSelected(null)}>
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-line flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold">{detail.fullName ?? 'Customer'}</h2>
                <div className="text-sm text-ink-muted">{detail.phone} · {detail.email ?? '—'}</div>
              </div>
              <button onClick={() => setSelected(null)} className="text-2xl text-ink-muted">×</button>
            </div>
            <div className="p-6 space-y-4">
              <Card>
                <h3 className="font-bold mb-2">Addresses</h3>
                {detail.addresses.length === 0 ? <p className="text-ink-muted text-sm">None</p> :
                  detail.addresses.map((a, i) => (
                    <div key={i} className="text-sm py-1">{a.city?.name} — {a.pincode}</div>
                  ))}
              </Card>
              <Card>
                <h3 className="font-bold mb-2">Subscriptions</h3>
                {detail.subscriptions.length === 0 ? <p className="text-ink-muted text-sm">None</p> :
                  detail.subscriptions.map((s) => (
                    <div key={s.id} className="text-sm py-1 flex justify-between">
                      <span>{s.product?.name ?? '—'}</span>
                      <Badge tone={s.status === 'ACTIVE' ? 'success' : 'warning'}>{s.status}</Badge>
                    </div>
                  ))}
              </Card>
              <Card>
                <h3 className="font-bold mb-2">KYC</h3>
                {detail.kycRecords.length === 0 ? <p className="text-ink-muted text-sm">No KYC submitted</p> :
                  detail.kycRecords.map((k, i) => (
                    <div key={i} className="text-sm py-1"><Badge tone={k.status === 'VERIFIED' ? 'success' : 'warning'}>{k.status}</Badge></div>
                  ))}
              </Card>
            </div>
          </div>
        </div>
      ) : null}
    </Shell>
  );
}
