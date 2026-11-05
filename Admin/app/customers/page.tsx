'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Shell } from '../../components/Shell';
import { Card, EmptyState, Input, Pill, Select } from '../../components/UI';
import { api, formatDate } from '../../lib/api';

interface Customer {
  id: string; phone: string; email?: string | null; fullName?: string | null; createdAt: string;
  addresses: Array<{ city?: { id: string; name: string }; pincode: string }>;
  subscriptions: Array<{ id: string; status: string; expiresAt: string; product?: { name: string } }>;
  kycRecords: Array<{ status: string }>;
}

function daysUntil(d: string) {
  return Math.ceil((new Date(d).getTime() - Date.now()) / 86400000);
}

export default function Customers() {
  const [items, setItems] = useState<Customer[] | null>(null);
  const [q, setQ] = useState('');
  const [city, setCity] = useState<string>('');
  const [kyc, setKyc] = useState<string>('');

  useEffect(() => {
    api.get('/admin/customers').then((r) => setItems(r.data.data));
  }, []);

  const cities = useMemo(() => {
    const set = new Map<string, string>();
    items?.forEach((c) => c.addresses.forEach((a) => a.city && set.set(a.city.id, a.city.name)));
    return Array.from(set, ([id, name]) => ({ id, name }));
  }, [items]);

  const filtered = useMemo(() => {
    if (!items) return [];
    return items.filter((c) => {
      if (q) {
        const needle = q.toLowerCase();
        if (
          !(c.fullName ?? '').toLowerCase().includes(needle) &&
          !(c.phone ?? '').includes(needle) &&
          !(c.email ?? '').toLowerCase().includes(needle)
        )
          return false;
      }
      if (city && !c.addresses.some((a) => a.city?.id === city)) return false;
      if (kyc) {
        const k = c.kycRecords[0]?.status ?? 'NONE';
        if (kyc === 'NONE' && k !== 'NONE') return false;
        if (kyc !== 'NONE' && k !== kyc) return false;
      }
      return true;
    });
  }, [items, q, city, kyc]);

  return (
    <Shell title="Customers" eyebrow="Manage">
      <Card padding="md" className="mb-6">
        <div className="grid grid-cols-1 md:grid-cols-[1fr_220px_180px] gap-3">
          <Input
            placeholder="Search by name, phone or email…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <Select value={city} onChange={(e) => setCity(e.target.value)}>
            <option value="">All cities</option>
            {cities.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </Select>
          <Select value={kyc} onChange={(e) => setKyc(e.target.value)}>
            <option value="">Any KYC status</option>
            <option value="VERIFIED">KYC verified</option>
            <option value="PENDING">KYC pending</option>
            <option value="REJECTED">KYC rejected</option>
            <option value="NONE">No KYC submitted</option>
          </Select>
        </div>
      </Card>

      {!items ? (
        <Card>
          <div className="text-ink-muted text-sm">Loading customers…</div>
        </Card>
      ) : filtered.length === 0 ? (
        <EmptyState title="No matching customers" description="Try a different filter." />
      ) : (
        <div className="rounded-3xl bg-white border border-line shadow-soft overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-surface-warm">
                <th className="text-left text-eyebrow uppercase text-ink-muted px-4 py-3">Customer</th>
                <th className="text-left text-eyebrow uppercase text-ink-muted px-4 py-3">Phone</th>
                <th className="text-left text-eyebrow uppercase text-ink-muted px-4 py-3">City</th>
                <th className="text-left text-eyebrow uppercase text-ink-muted px-4 py-3">Active plan</th>
                <th className="text-left text-eyebrow uppercase text-ink-muted px-4 py-3">KYC</th>
                <th className="text-left text-eyebrow uppercase text-ink-muted px-4 py-3">Joined</th>
                <th className="text-left text-eyebrow uppercase text-ink-muted px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((c, i) => {
                const sub = c.subscriptions.find((s) => s.status === 'ACTIVE') ?? c.subscriptions[0];
                const days = sub ? daysUntil(sub.expiresAt) : null;
                const k = c.kycRecords[0]?.status;
                return (
                  <tr key={c.id} className={`border-t border-line/70 hover:bg-surface-warm/60 ${i % 2 === 1 ? 'bg-surface-warm/30' : ''}`}>
                    <td className="px-4 py-3">
                      <div className="font-bold text-ink">{c.fullName ?? '—'}</div>
                      <div className="text-[11px] text-ink-muted">{c.email ?? 'no email'}</div>
                    </td>
                    <td className="px-4 py-3 tabular-nums">{c.phone}</td>
                    <td className="px-4 py-3">
                      {c.addresses[0]?.city?.name ?? <span className="text-ink-muted">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      {sub ? (
                        <div>
                          <div className="font-bold text-ink text-[13px]">{sub.product?.name ?? '—'}</div>
                          <div className="text-[11px] text-ink-muted">
                            {sub.status} ·{' '}
                            {days != null ? (
                              <span className={days < 7 ? 'text-warning font-bold' : 'text-ink-muted'}>
                                {days}d left
                              </span>
                            ) : (
                              '—'
                            )}
                          </div>
                        </div>
                      ) : (
                        <span className="text-ink-muted text-[12px]">No plan</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {k ? (
                        <Pill tone={k === 'VERIFIED' ? 'success' : k === 'REJECTED' ? 'danger' : 'warning'} size="sm" dot>
                          {k}
                        </Pill>
                      ) : (
                        <span className="text-ink-muted text-[11px]">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-[12px] text-ink-muted">{formatDate(c.createdAt)}</td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/customers/${c.id}`}
                        className="text-brand text-[12px] font-bold hover:underline"
                      >
                        View →
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Shell>
  );
}
