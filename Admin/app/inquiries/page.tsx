'use client';

// Leads, newest first (GET /inquiries). Enquiries come from the customer app
// and from the website's contact form and popup. Website enquiries have no
// pincode or account, so every field below is optional except name and phone.
// Status changes go through PATCH /inquiries/:id/status and update in place.
// Source is filtered here in the browser (the list API has no source param).

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { Shell } from '../../components/Shell';
import { Button, Card, Select, Table } from '../../components/UI';
import { toast } from '../../components/Feedback';
import { api, apiErrorMessage, formatDateTime } from '../../lib/api';

type Status = 'NEW' | 'CONTACTED' | 'PROPOSAL_SENT' | 'BOOKED' | 'LOST';
type Source = 'APP' | 'WEBSITE_CONTACT' | 'WEBSITE_POPUP';

interface Inquiry {
  id: string;
  name: string;
  phone: string;
  pincode?: string | null;
  email?: string | null;
  source?: Source | null;
  cityName?: string | null;
  city?: { id?: string; name: string } | null;
  productName?: string | null;
  product?: { name: string } | null;
  productId?: string | null;
  heardFrom?: string | null;
  notes?: string | null;
  status: Status;
  createdAt: string;
  user?: { id: string; fullName?: string | null; phone?: string } | null;
}
interface Meta { total: number; page: number; perPage: number }

const STATUSES: { key: Status; label: string }[] = [
  { key: 'NEW', label: 'New' },
  { key: 'CONTACTED', label: 'Contacted' },
  { key: 'PROPOSAL_SENT', label: 'Proposal sent' },
  { key: 'BOOKED', label: 'Booked' },
  { key: 'LOST', label: 'Lost' },
];
const STATUS_LABEL = Object.fromEntries(STATUSES.map((s) => [s.key, s.label])) as Record<string, string>;

type SourceFilter = '' | 'website' | 'app';
const PER_PAGE = 100;

const STATUS_SKIN: Record<string, string> = {
  NEW: 'bg-warning-soft text-warning border-warning/30',
  CONTACTED: 'bg-brand-soft text-brand-ink border-brand/30',
  PROPOSAL_SENT: 'bg-deep-soft text-deep border-deep/30',
  BOOKED: 'bg-success-soft text-success border-success/30',
  LOST: 'bg-danger-soft text-danger border-danger/30',
};

const SOURCE_BADGE: Record<Source, { label: string; skin: string }> = {
  WEBSITE_CONTACT: { label: 'Website form', skin: 'bg-brand-soft text-brand-ink' },
  WEBSITE_POPUP: { label: 'Website popup', skin: 'bg-deep-soft text-deep' },
  APP: { label: 'App', skin: 'bg-surface-warm text-ink-soft' },
};

// Rows created before the source column existed all came from the app.
const sourceOf = (i: Inquiry): Source => i.source ?? 'APP';
const isWebsite = (i: Inquiry) => sourceOf(i) !== 'APP';

/** Digits with the country code, e.g. "919876543210". Bare 10-digit numbers are Indian. */
function phoneDigits(phone: string): string {
  const d = phone.replace(/\D/g, '');
  return d.length === 10 ? `91${d}` : d;
}

function timeAgo(iso: string, now: number): string {
  const sec = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (sec < 60) return 'just now';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day}d ago`;
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function exactTime(iso: string): string {
  return new Date(iso).toLocaleString('en-IN', {
    weekday: 'short', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

export default function Inquiries() {
  const [items, setItems] = useState<Inquiry[]>([]);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [status, setStatus] = useState<Status | ''>('');
  const [source, setSource] = useState<SourceFilter>('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newCount, setNewCount] = useState<number | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  // Keep "5m ago" honest while the page stays open.
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(t);
  }, []);

  const loadNewCount = useCallback(async () => {
    try {
      const r = await api.get('/inquiries', { params: { status: 'NEW', perPage: 1 } });
      setNewCount((r.data.meta as Meta | undefined)?.total ?? null);
    } catch {
      setNewCount(null);
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await api.get('/inquiries', { params: { status: status || undefined, page, perPage: PER_PAGE } });
      const rows = (r.data.data as Inquiry[]) ?? [];
      setItems([...rows].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
      setMeta((r.data.meta as Meta | undefined) ?? null);
      setNow(Date.now());
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [status, page]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void loadNewCount();
  }, [loadNewCount]);

  function refresh() {
    void load();
    void loadNewCount();
  }

  function pickStatus(s: Status | '') {
    setStatus(s);
    setPage(1);
  }

  async function changeStatus(inq: Inquiry, next: Status) {
    if (next === inq.status) return;
    const prev = inq.status;
    setBusyId(inq.id);
    try {
      await api.patch(`/inquiries/${inq.id}/status`, { status: next });
      setItems((list) => list.map((x) => (x.id === inq.id ? { ...x, status: next } : x)));
      setNewCount((n) => (n == null ? n : n + (next === 'NEW' ? 1 : 0) - (prev === 'NEW' ? 1 : 0)));
      toast.success(`${inq.name} marked ${STATUS_LABEL[next] ?? next}`, 'Inquiry updated');
    } catch (e) {
      toast.error(apiErrorMessage(e), 'Could not update inquiry');
    } finally {
      setBusyId(null);
    }
  }

  const shown = items.filter((i) => (source === 'website' ? isWebsite(i) : source === 'app' ? !isWebsite(i) : true));
  const pages = meta ? Math.max(1, Math.ceil(meta.total / meta.perPage)) : 1;

  return (
    <Shell title="Inquiries" eyebrow="Leads">
      <div className="space-y-4">
        {newCount != null ? (
          newCount > 0 ? (
            <button
              type="button"
              onClick={() => pickStatus('NEW')}
              className="w-full text-left px-4 py-3 rounded-xl text-sm font-semibold hover:underline"
              style={{ backgroundColor: '#FEF2E2', color: '#9A5E0B' }}
            >
              <span className="tabular-nums font-extrabold">{newCount}</span>{' '}
              {newCount === 1 ? 'new enquiry is' : 'new enquiries are'} waiting for a call back.
              {status !== 'NEW' ? ' Show only new →' : ''}
            </button>
          ) : (
            <div className="px-4 py-3 rounded-xl text-sm font-semibold bg-success-soft text-success">
              No new enquiries. Everyone has been contacted.
            </div>
          )
        ) : null}

        <Card className="!p-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button variant={status === '' ? 'primary' : 'ghost'} onClick={() => pickStatus('')}>All</Button>
            {STATUSES.map((s) => (
              <Button key={s.key} variant={status === s.key ? 'primary' : 'ghost'} onClick={() => pickStatus(s.key)}>
                {s.label}
                {s.key === 'NEW' && newCount ? ` (${newCount})` : ''}
              </Button>
            ))}
            <div className="ml-auto flex items-center gap-2">
              <div className="w-[170px]">
                <Select value={source} onChange={(e) => setSource(e.target.value as SourceFilter)} aria-label="Source">
                  <option value="">All sources</option>
                  <option value="website">Website</option>
                  <option value="app">App</option>
                </Select>
              </div>
              <Button variant="outline" onClick={refresh} disabled={loading}>Refresh</Button>
            </div>
          </div>
        </Card>

        {error ? <div className="text-sm text-danger font-semibold">{error}</div> : null}

        <Table
          headers={['Lead', 'Contact', 'City', 'Product', 'Heard from', 'Message', 'Received', 'Status']}
          empty={
            loading
              ? 'Loading…'
              : source && items.length > 0
                ? `No ${source === 'app' ? 'app' : 'website'} enquiries on this page`
                : 'No inquiries'
          }
          rows={shown.map((i) => [
            <LeadCell key="l" i={i} />,
            <ContactCell key="c" i={i} />,
            <CityCell key="city" i={i} />,
            <span key="p" className="text-sm">{i.productName ?? i.product?.name ?? <Dash />}</span>,
            <span key="h" className="text-sm">{i.heardFrom ?? <Dash />}</span>,
            <MessageCell key={`m-${i.id}`} text={i.notes} />,
            <span key="t" className="text-xs text-ink-muted whitespace-nowrap cursor-default" title={exactTime(i.createdAt)}>
              {timeAgo(i.createdAt, now)}
              <div className="text-[10px]">{formatDateTime(i.createdAt)}</div>
            </span>,
            <select
              key="s"
              value={i.status}
              disabled={busyId === i.id}
              onChange={(e) => void changeStatus(i, e.target.value as Status)}
              aria-label={`Status for ${i.name}`}
              className={`px-2 py-1 border rounded-lg text-xs font-bold disabled:opacity-50 ${STATUS_SKIN[i.status] ?? 'bg-white border-line'}`}
            >
              {STATUSES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
            </select>,
          ])}
        />

        {meta && meta.total > meta.perPage ? (
          <div className="flex items-center justify-end gap-2 text-xs font-semibold text-ink-muted">
            <span className="mr-2">Page {meta.page} of {pages} · {meta.total} inquiries</span>
            <Button variant="outline" size="sm" disabled={loading || page <= 1} onClick={() => setPage(page - 1)}>← Newer</Button>
            <Button variant="outline" size="sm" disabled={loading || page >= pages} onClick={() => setPage(page + 1)}>Older →</Button>
          </div>
        ) : null}
      </div>
    </Shell>
  );
}

function Dash() {
  return <span className="text-ink-muted">—</span>;
}

function SourceBadge({ source }: { source: Source }) {
  const b = SOURCE_BADGE[source] ?? SOURCE_BADGE.APP;
  return (
    <span className={`inline-flex items-center rounded-full font-bold px-2 py-0.5 text-[10px] whitespace-nowrap ${b.skin}`}>
      {b.label}
    </span>
  );
}

function LeadCell({ i }: { i: Inquiry }) {
  return (
    <span className="block min-w-[140px]">
      <SourceBadge source={sourceOf(i)} />
      <div className="font-semibold mt-1">{i.name}</div>
      {i.user ? (
        <Link href={`/customers/${i.user.id}`} className="text-[12px] text-brand font-bold hover:underline">
          App account →
        </Link>
      ) : null}
    </span>
  );
}

function ContactCell({ i }: { i: Inquiry }) {
  const digits = phoneDigits(i.phone);
  return (
    <span className="block min-w-[150px]">
      <a href={`tel:+${digits}`} className="font-semibold tabular-nums whitespace-nowrap hover:underline">
        {i.phone}
      </a>
      <div className="mt-1 flex items-center gap-2 text-[12px] font-bold">
        <a href={`tel:+${digits}`} className="text-brand hover:underline">Call</a>
        <a
          href={`https://wa.me/${digits}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-success hover:underline"
        >
          WhatsApp
        </a>
      </div>
      {i.email ? (
        <a href={`mailto:${i.email}`} className="block mt-1 text-[12px] text-ink-muted hover:underline break-all">
          {i.email}
        </a>
      ) : null}
    </span>
  );
}

function CityCell({ i }: { i: Inquiry }) {
  const primary = i.city?.name ?? i.cityName ?? i.pincode ?? null;
  if (!primary) return <Dash />;
  const typedOnly = !i.city && Boolean(i.cityName);
  return (
    <span className="text-sm" title={typedOnly ? 'As typed by the customer (not one of our cities)' : undefined}>
      {primary}
      {i.pincode && primary !== i.pincode ? <div className="text-xs text-ink-muted tabular-nums">{i.pincode}</div> : null}
    </span>
  );
}

const MESSAGE_PREVIEW = 90;

function MessageCell({ text }: { text?: string | null }) {
  const [open, setOpen] = useState(false);
  const t = text?.trim();
  if (!t) return <Dash />;
  const long = t.length > MESSAGE_PREVIEW || t.includes('\n');
  return (
    <span className="block max-w-[280px] min-w-[160px] text-[13px] text-ink-soft">
      <span className={open ? 'whitespace-pre-line break-words' : 'break-words'}>
        {open || !long ? t : `${t.replace(/\s+/g, ' ').slice(0, MESSAGE_PREVIEW).trimEnd()}…`}
      </span>
      {long ? (
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="ml-1 text-[12px] font-bold text-brand hover:underline"
        >
          {open ? 'Less' : 'More'}
        </button>
      ) : null}
    </span>
  );
}
