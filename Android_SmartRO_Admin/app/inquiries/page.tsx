'use client';

import { useEffect, useState } from 'react';
import { Shell } from '../../components/Shell';
import { Badge, Table, Button, Card } from '../../components/UI';
import { api, apiErrorMessage, formatDateTime } from '../../lib/api';

interface Inquiry {
  id: string; name: string; phone: string; pincode: string; status: string; createdAt: string;
  city?: { name: string } | null;
}

const STATUSES = ['NEW', 'CONTACTED', 'PROPOSAL_SENT', 'BOOKED', 'LOST'] as const;

export default function Inquiries() {
  const [items, setItems] = useState<Inquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const r = await api.get('/inquiries', { params: { status: filter || undefined, perPage: 100 } });
      setItems(r.data.data);
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [filter]);

  async function changeStatus(id: string, status: string) {
    try {
      await api.patch(`/inquiries/${id}/status`, { status });
      await load();
    } catch (e) {
      alert(apiErrorMessage(e));
    }
  }

  const tone = (s: string) =>
    s === 'BOOKED' ? 'success' : s === 'LOST' ? 'danger' : s === 'NEW' ? 'warning' : 'info';

  return (
    <Shell title="Inquiries">
      <div className="space-y-4">
        <Card className="!p-3">
          <div className="flex items-center gap-2 flex-wrap">
            <Button variant={filter === '' ? 'primary' : 'ghost'} onClick={() => setFilter('')}>All</Button>
            {STATUSES.map((s) => (
              <Button key={s} variant={filter === s ? 'primary' : 'ghost'} onClick={() => setFilter(s)}>{s}</Button>
            ))}
          </div>
        </Card>

        {error ? <div className="text-sm text-rose-600">{error}</div> : null}

        <Table
          headers={['Name', 'Phone', 'City', 'Pincode', 'Status', 'Created', 'Update']}
          empty={loading ? 'Loading…' : 'No inquiries'}
          rows={items.map((i) => [
            i.name,
            i.phone,
            i.city?.name ?? '—',
            i.pincode,
            <Badge key="b" tone={tone(i.status) as never}>{i.status}</Badge>,
            <span key="d" className="text-ink-muted text-xs">{formatDateTime(i.createdAt)}</span>,
            <select
              key="s"
              value={i.status}
              onChange={(e) => changeStatus(i.id, e.target.value)}
              className="px-2 py-1 border border-line rounded text-xs bg-white"
            >
              {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>,
          ])}
        />
      </div>
    </Shell>
  );
}
