'use client';

// Every booking, newest first (GET /admin/bookings). An install booked when
// no technician was free shows as Unassigned; technicians are picked on the
// Technician jobs page, which this page links to.

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { Shell } from '../../components/Shell';
import { Badge, Button, Card, Select, Table } from '../../components/UI';
import { toast } from '../../components/Feedback';
import { api, apiErrorMessage, formatDate, formatDateTime, paiseToInr } from '../../lib/api';

interface Booking {
  id: string;
  status: string;
  createdAt: string;
  installationSlot: string | null;
  depositPaise: number;
  firstPaymentPaise: number;
  customer: { id: string; fullName: string | null; phone: string };
  product: { name: string };
  plan: { name: string };
  city: { name: string };
  latestPayment: { kind: string; status: string; amountPaise: number; createdAt: string } | null;
  subscription: { id: string; status: string; expiresAt: string } | null;
  installJob: {
    id: string;
    status: string;
    scheduledFor: string;
    technician: { employeeCode: string; fullName: string | null } | null;
  } | null;
}
interface Meta { total: number; page: number; perPage: number; counts: Record<string, number> }
interface City { id: string; name: string }

const STATUSES: { key: string; label: string }[] = [
  { key: 'PENDING_KYC', label: 'Pending KYC' },
  { key: 'PENDING_PAY', label: 'Awaiting payment' },
  { key: 'PAID', label: 'Paid' },
  { key: 'INSTALLED', label: 'Installed' },
  { key: 'CANCELLED', label: 'Cancelled' },
];
const PER_PAGE = 50;

const bookingTone = (s: string) =>
  s === 'INSTALLED' || s === 'PAID' ? 'success'
    : s === 'CANCELLED' ? 'danger'
      : s === 'PENDING_KYC' || s === 'PENDING_PAY' ? 'warning'
        : 'info';
const paymentTone = (s: string) => (s === 'SUCCESS' ? 'success' : s === 'FAILED' ? 'danger' : 'warning');
const subTone = (s: string) =>
  s === 'ACTIVE' ? 'success' : s === 'GRACE' ? 'warning' : s === 'SUSPENDED' || s === 'CLOSED' ? 'danger' : 'info';

export default function Bookings() {
  const [items, setItems] = useState<Booking[]>([]);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [cities, setCities] = useState<City[]>([]);
  const [status, setStatus] = useState('');
  const [cityId, setCityId] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/cities', { params: { includeAll: 'true' } })
      .then((r) => setCities(r.data.data as City[]))
      .catch(() => setCities([]));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get('/admin/bookings', {
        params: { status: status || undefined, cityId: cityId || undefined, page, perPage: PER_PAGE },
      });
      setItems(r.data.data as Booking[]);
      setMeta(r.data.meta as Meta);
    } catch (e) {
      toast.error(apiErrorMessage(e), 'Could not load bookings');
    } finally {
      setLoading(false);
    }
  }, [status, cityId, page]);

  useEffect(() => {
    void load();
  }, [load]);

  const counts = meta?.counts ?? {};
  const allCount = Object.values(counts).reduce((a, b) => a + b, 0);
  const pages = meta ? Math.max(1, Math.ceil(meta.total / meta.perPage)) : 1;
  const unassigned = items.filter((b) => b.installJob && !b.installJob.technician).length;

  function pickStatus(s: string) {
    setStatus(s);
    setPage(1);
  }

  return (
    <Shell title="Bookings" eyebrow="Operations">
      <div className="space-y-4">
        <Card className="!p-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button variant={status === '' ? 'primary' : 'ghost'} onClick={() => pickStatus('')}>
              All{meta ? ` (${allCount})` : ''}
            </Button>
            {STATUSES.map((s) => (
              <Button key={s.key} variant={status === s.key ? 'primary' : 'ghost'} onClick={() => pickStatus(s.key)}>
                {s.label}{meta ? ` (${counts[s.key] ?? 0})` : ''}
              </Button>
            ))}
            <div className="ml-auto w-[200px]">
              <Select value={cityId} onChange={(e) => { setCityId(e.target.value); setPage(1); }}>
                <option value="">All cities</option>
                {cities.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
            </div>
          </div>
        </Card>

        {unassigned > 0 ? (
          <Link
            href="/jobs"
            className="block px-4 py-3 rounded-xl text-sm font-semibold hover:underline"
            style={{ backgroundColor: '#FEF2E2', color: '#9A5E0B' }}
          >
            {unassigned === 1 ? '1 install on this page has' : `${unassigned} installs on this page have`} no technician yet. Assign on Technician jobs →
          </Link>
        ) : null}

        <Table
          headers={['Customer', 'Product · Plan', 'City', 'Amount', 'Payment', 'Status', 'Subscription', 'Install', 'Created']}
          empty={loading ? 'Loading…' : 'No bookings'}
          rows={items.map((b) => [
            <span key="c">
              <Link href={`/customers/${b.customer.id}`} className="font-semibold hover:underline">
                {b.customer.fullName ?? '—'}
              </Link>
              <div className="text-xs text-ink-muted">{b.customer.phone}</div>
            </span>,
            <span key="p">
              {b.product.name}
              <div className="text-xs text-ink-muted">{b.plan.name}</div>
            </span>,
            b.city.name,
            <span key="a" className="tabular-nums">
              {paiseToInr(b.depositPaise + b.firstPaymentPaise)}
              <div className="text-xs text-ink-muted">
                Deposit {paiseToInr(b.depositPaise)} · Rent {paiseToInr(b.firstPaymentPaise)}
              </div>
            </span>,
            b.latestPayment ? (
              <span key="pay">
                <Badge tone={paymentTone(b.latestPayment.status) as never}>{b.latestPayment.status}</Badge>
                <div className="text-xs text-ink-muted mt-1">
                  {b.latestPayment.kind} · {paiseToInr(b.latestPayment.amountPaise)}
                </div>
              </span>
            ) : (
              <span key="pay" className="text-xs text-ink-muted">No payment</span>
            ),
            <Badge key="s" tone={bookingTone(b.status) as never}>{b.status}</Badge>,
            b.subscription ? (
              <span key="sub">
                <Badge tone={subTone(b.subscription.status) as never}>{b.subscription.status}</Badge>
                <div className="text-xs text-ink-muted mt-1">Expires {formatDate(b.subscription.expiresAt)}</div>
              </span>
            ) : (
              <span key="sub" className="text-xs text-ink-muted">—</span>
            ),
            <InstallCell key="i" b={b} />,
            <span key="d" className="text-xs text-ink-muted">
              {formatDateTime(b.createdAt)}
              <div className="font-mono text-[10px]" title={b.id}>#{b.id.slice(0, 8)}</div>
            </span>,
          ])}
        />

        {meta && meta.total > meta.perPage ? (
          <div className="flex items-center justify-end gap-2 text-xs font-semibold text-ink-muted">
            <span className="mr-2">Page {meta.page} of {pages} · {meta.total} bookings</span>
            <Button variant="outline" size="sm" disabled={loading || page <= 1} onClick={() => setPage(page - 1)}>← Newer</Button>
            <Button variant="outline" size="sm" disabled={loading || page >= pages} onClick={() => setPage(page + 1)}>Older →</Button>
          </div>
        ) : null}
      </div>
    </Shell>
  );
}

function InstallCell({ b }: { b: Booking }) {
  const j = b.installJob;
  if (j) {
    return (
      <span>
        <span className="text-xs">{formatDateTime(j.scheduledFor)}</span>
        <div className="mt-1">
          {j.technician ? (
            <span className="text-xs">
              {j.technician.fullName ?? j.technician.employeeCode}
              <span className="text-ink-muted"> · {j.status}</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-2">
              <Badge tone="danger">Unassigned</Badge>
              <Link href="/jobs" className="text-brand text-[12px] font-bold hover:underline">Assign →</Link>
            </span>
          )}
        </div>
      </span>
    );
  }
  // Paid but no open install job: usually the customer hasn't picked a slot yet.
  if (b.status === 'PAID') {
    return b.installationSlot ? (
      <span className="text-xs text-warning font-semibold">Slot {formatDateTime(b.installationSlot)} · no open job</span>
    ) : (
      <span className="text-xs text-warning font-semibold">No slot picked yet</span>
    );
  }
  return <span className="text-xs text-ink-muted">—</span>;
}
