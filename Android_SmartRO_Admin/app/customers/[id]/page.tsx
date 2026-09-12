'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Shell } from '../../../components/Shell';
import { Card, Pill, Button, EmptyState } from '../../../components/UI';
import { api, formatDate, formatDateTime, paiseToInr } from '../../../lib/api';

interface Detail {
  id: string;
  phone: string;
  email?: string | null;
  fullName?: string | null;
  createdAt: string;
  addresses: Array<{ id: string; line1: string; line2?: string | null; city?: { name: string }; pincode: string; isDefault: boolean }>;
  subscriptions: Array<{
    id: string;
    status: string;
    startedAt: string;
    expiresAt: string;
    lockInUntil: string;
    product?: { name: string; technology: string; capacityLitres: number };
    plan?: { name: string; durationDays: number };
    device?: { id: string; serial: string; status: string; lastHeartbeatAt?: string | null; firmwareVersion?: string | null; wifiSsid?: string | null };
    booking?: { addressId?: string | null; city?: { name: string } };
    installAddress?: { line1: string; line2?: string | null; pincode: string; city?: { name: string }; lat?: number | null; lng?: number | null } | null;
    deviceOnline: boolean;
  }>;
  kycRecords: Array<{ id: string; status: string; aadhaarLast4: string; pan: string; selfieUrl?: string | null; createdAt: string }>;
  bookings: Array<{ id: string; status: string; createdAt: string; depositPaise: number; firstPaymentPaise: number; product?: { name: string }; plan?: { name: string }; city?: { name: string } }>;
  tickets: Array<{ id: string; category: string; description: string; status: string; priority: string; createdAt: string; technician?: { user?: { fullName?: string | null } | null } | null }>;
  payments: Array<{ id: string; kind: string; status: string; amountPaise: number; createdAt: string; invoice?: { number: string } | null }>;
}

type Tab = 'profile' | 'devices' | 'subs' | 'tickets' | 'payments' | 'docs';

const TABS: { key: Tab; label: string }[] = [
  { key: 'profile', label: 'Profile' },
  { key: 'devices', label: 'Devices & location' },
  { key: 'subs', label: 'Subscriptions' },
  { key: 'tickets', label: 'Tickets' },
  { key: 'payments', label: 'Payments' },
  { key: 'docs', label: 'Documents' },
];

function mapsLink(line: string, city?: string, pin?: string) {
  const q = encodeURIComponent([line, city, pin].filter(Boolean).join(', '));
  return `https://www.google.com/maps/search/?api=1&query=${q}`;
}

export default function CustomerDetail() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<Detail | null>(null);
  const [tab, setTab] = useState<Tab>('profile');

  useEffect(() => {
    if (!id) return;
    api.get(`/admin/customers/${id}`).then((r) => setData(r.data.data));
  }, [id]);

  if (!data) {
    return (
      <Shell title="Customer" eyebrow="Customers">
        <div className="text-ink-muted text-sm">Loading…</div>
      </Shell>
    );
  }

  const initial = (data.fullName ?? data.phone).slice(0, 1).toUpperCase();
  const activeSub = data.subscriptions.find((s) => s.status === 'ACTIVE') ?? data.subscriptions[0];

  return (
    <Shell title={data.fullName ?? 'Customer'} eyebrow="Customers">
      {/* Header card */}
      <Card variant="elevated" padding="lg" className="mb-6">
        <div className="flex items-start gap-5">
          <div className="h-20 w-20 rounded-full bg-gradient-deep grid place-items-center text-white font-extrabold text-3xl shadow-glow shrink-0">
            {initial}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <h2 className="font-display text-display-md font-extrabold text-ink">{data.fullName ?? 'Customer'}</h2>
              {data.kycRecords[0]?.status === 'VERIFIED' ? <Pill tone="success" dot>KYC verified</Pill> : null}
              {activeSub ? <Pill tone="accent" dot>{activeSub.product?.name ?? 'Active'}</Pill> : <Pill tone="warning">No plan</Pill>}
            </div>
            <div className="text-ink-muted text-sm mt-1.5 tabular-nums">{data.phone} · {data.email ?? 'no email'}</div>
            <div className="text-[12px] text-ink-muted mt-0.5">Joined {formatDate(data.createdAt)}</div>
          </div>
          <Button variant="outline" onClick={() => router.back()}>Back</Button>
        </div>
      </Card>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1 border-b border-line mb-5">
        {TABS.map((t) => {
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`relative px-4 py-3 text-sm font-bold transition-colors ${active ? 'text-ink' : 'text-ink-muted hover:text-ink'}`}
            >
              {t.label}
              {active ? <span className="absolute inset-x-3 bottom-0 h-0.5 bg-brand rounded-full" /> : null}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      {tab === 'profile' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <div className="text-eyebrow uppercase text-ink-muted">Personal</div>
            <div className="mt-3 space-y-1.5 text-sm">
              <Row k="Full name" v={data.fullName ?? '—'} />
              <Row k="Phone" v={<span className="tabular-nums">{data.phone}</span>} />
              <Row k="Email" v={data.email ?? '—'} />
              <Row k="Joined" v={formatDate(data.createdAt)} />
            </div>
          </Card>
          <Card>
            <div className="text-eyebrow uppercase text-ink-muted">KYC</div>
            {data.kycRecords[0] ? (
              <div className="mt-3 space-y-1.5 text-sm">
                <Row
                  k="Status"
                  v={
                    <Pill tone={data.kycRecords[0].status === 'VERIFIED' ? 'success' : data.kycRecords[0].status === 'REJECTED' ? 'danger' : 'warning'} size="sm" dot>
                      {data.kycRecords[0].status}
                    </Pill>
                  }
                />
                <Row k="Aadhaar (last 4)" v={<span className="tabular-nums font-bold">••••{data.kycRecords[0].aadhaarLast4}</span>} />
                <Row k="PAN" v={<span className="tabular-nums font-bold">{data.kycRecords[0].pan}</span>} />
                <Row k="Submitted" v={formatDate(data.kycRecords[0].createdAt)} />
              </div>
            ) : (
              <div className="mt-3 text-sm text-ink-muted">No KYC submitted yet.</div>
            )}
          </Card>
          <Card className="md:col-span-2">
            <div className="text-eyebrow uppercase text-ink-muted">Saved addresses</div>
            {data.addresses.length === 0 ? (
              <div className="mt-3 text-sm text-ink-muted">No saved addresses.</div>
            ) : (
              <div className="mt-3 space-y-2">
                {data.addresses.map((a) => (
                  <div key={a.id} className="rounded-xl border border-line p-3 bg-surface-warm/40 flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-bold text-ink">{a.line1}{a.line2 ? `, ${a.line2}` : ''}</div>
                      <div className="text-[12px] text-ink-muted">{a.city?.name} · {a.pincode}</div>
                    </div>
                    <a
                      href={mapsLink(a.line1, a.city?.name, a.pincode)}
                      target="_blank"
                      rel="noreferrer"
                      className="text-brand text-[12px] font-bold hover:underline whitespace-nowrap"
                    >
                      Open in Maps ↗
                    </a>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      ) : null}

      {tab === 'devices' ? (
        data.subscriptions.length === 0 ? (
          <EmptyState title="No devices installed" description="This customer doesn't have an active subscription yet." />
        ) : (
          <div className="space-y-4">
            {data.subscriptions.map((s) => {
              const addr = s.installAddress;
              const lastSeen = s.device?.lastHeartbeatAt ? formatDateTime(s.device.lastHeartbeatAt) : 'never';
              return (
                <Card key={s.id} variant="elevated">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div>
                      <div className="text-eyebrow uppercase text-ink-muted">Device</div>
                      <div className="font-display text-title-md font-bold mt-1 text-ink">
                        {s.device?.serial ?? '— not assigned —'}
                      </div>
                      <div className="text-[12px] text-ink-muted mt-0.5">{s.product?.name} · {s.product?.technology} · {s.product?.capacityLitres}L</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Pill tone={s.status === 'ACTIVE' ? 'success' : 'warning'} dot>{s.status}</Pill>
                      <Pill tone={s.deviceOnline ? 'success' : 'neutral'} dot>{s.deviceOnline ? 'Online' : 'Offline'}</Pill>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="rounded-2xl border border-line p-4 bg-surface-warm/40">
                      <div className="text-eyebrow uppercase text-ink-muted">Install location</div>
                      {addr ? (
                        <>
                          <div className="text-sm font-bold mt-2">{addr.line1}{addr.line2 ? `, ${addr.line2}` : ''}</div>
                          <div className="text-[12px] text-ink-muted">{addr.city?.name} · {addr.pincode}</div>
                          <a
                            href={mapsLink(addr.line1, addr.city?.name, addr.pincode)}
                            target="_blank"
                            rel="noreferrer"
                            className="text-brand text-[12px] font-bold hover:underline mt-2 inline-block"
                          >
                            Open in Google Maps ↗
                          </a>
                        </>
                      ) : (
                        <div className="text-sm text-ink-muted mt-2">Address not on file.</div>
                      )}
                    </div>
                    <div className="rounded-2xl border border-line p-4 bg-surface-warm/40 space-y-1.5 text-sm">
                      <div className="text-eyebrow uppercase text-ink-muted mb-2">Hardware</div>
                      <Row k="Firmware" v={s.device?.firmwareVersion ?? '—'} />
                      <Row k="Wi-Fi SSID" v={s.device?.wifiSsid ?? '—'} />
                      <Row k="Last heartbeat" v={lastSeen} />
                      <Row k="Plan expires" v={formatDate(s.expiresAt)} />
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )
      ) : null}

      {tab === 'subs' ? (
        data.subscriptions.length === 0 ? (
          <EmptyState title="No subscriptions" />
        ) : (
          <div className="rounded-3xl bg-white border border-line shadow-soft overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-surface-warm">
                  <Th>Product</Th><Th>Plan</Th><Th>Status</Th><Th>Started</Th><Th>Expires</Th><Th>Lock-in</Th>
                </tr>
              </thead>
              <tbody>
                {data.subscriptions.map((s) => (
                  <tr key={s.id} className="border-t border-line/70">
                    <Td>{s.product?.name ?? '—'}</Td>
                    <Td>{s.plan?.name ?? '—'} <span className="text-ink-muted text-[11px]">· {s.plan?.durationDays}d</span></Td>
                    <Td><Pill tone={s.status === 'ACTIVE' ? 'success' : 'warning'} size="sm" dot>{s.status}</Pill></Td>
                    <Td>{formatDate(s.startedAt)}</Td>
                    <Td>{formatDate(s.expiresAt)}</Td>
                    <Td>{formatDate(s.lockInUntil)}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : null}

      {tab === 'tickets' ? (
        data.tickets.length === 0 ? (
          <EmptyState title="No service tickets" description="This customer hasn't raised any tickets." />
        ) : (
          <div className="space-y-2.5">
            {data.tickets.map((t) => (
              <Card key={t.id} padding="md">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Pill tone={t.status === 'RESOLVED' || t.status === 'CLOSED' ? 'success' : t.status === 'OPEN' ? 'warning' : 'accent'} size="sm" dot>{t.status}</Pill>
                      <Pill tone={t.priority === 'HIGH' ? 'danger' : t.priority === 'MEDIUM' ? 'warning' : 'neutral'} size="sm">{t.priority}</Pill>
                      <span className="text-[11px] text-ink-muted font-bold tabular-nums">#{t.id.slice(-6).toUpperCase()}</span>
                    </div>
                    <div className="font-bold text-ink mt-1.5">{t.category}</div>
                    <p className="text-[13px] text-ink-soft mt-1 line-clamp-2">{t.description}</p>
                    {t.technician?.user?.fullName ? (
                      <div className="text-[11px] text-ink-muted mt-1.5">Assigned to {t.technician.user.fullName}</div>
                    ) : null}
                  </div>
                  <div className="text-[11px] text-ink-muted whitespace-nowrap">{formatDate(t.createdAt)}</div>
                </div>
              </Card>
            ))}
          </div>
        )
      ) : null}

      {tab === 'payments' ? (
        data.payments.length === 0 ? (
          <EmptyState title="No payments" />
        ) : (
          <div className="rounded-3xl bg-white border border-line shadow-soft overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-surface-warm">
                  <Th>Date</Th><Th>Type</Th><Th>Status</Th><Th>Amount</Th><Th>Invoice</Th>
                </tr>
              </thead>
              <tbody>
                {data.payments.map((p) => (
                  <tr key={p.id} className="border-t border-line/70">
                    <Td>{formatDate(p.createdAt)}</Td>
                    <Td>{p.kind}</Td>
                    <Td>
                      <Pill tone={p.status === 'SUCCESS' ? 'success' : p.status === 'FAILED' ? 'danger' : 'warning'} size="sm" dot>
                        {p.status}
                      </Pill>
                    </Td>
                    <Td><span className="font-bold tabular-nums">{paiseToInr(p.amountPaise)}</span></Td>
                    <Td className="text-ink-muted">{p.invoice?.number ?? '—'}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : null}

      {tab === 'docs' ? (
        data.kycRecords.length === 0 ? (
          <EmptyState title="No documents" description="No KYC documents uploaded yet." />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {data.kycRecords.map((k) => (
              <Card key={k.id}>
                <div className="flex items-center justify-between">
                  <div className="text-eyebrow uppercase text-ink-muted">KYC submission</div>
                  <Pill tone={k.status === 'VERIFIED' ? 'success' : k.status === 'REJECTED' ? 'danger' : 'warning'} size="sm" dot>{k.status}</Pill>
                </div>
                <div className="mt-3 space-y-1.5 text-sm">
                  <Row k="Aadhaar (last 4)" v={<span className="tabular-nums font-bold">••••{k.aadhaarLast4}</span>} />
                  <Row k="PAN" v={<span className="tabular-nums font-bold">{k.pan}</span>} />
                  <Row k="Submitted" v={formatDate(k.createdAt)} />
                </div>
                {k.selfieUrl ? (
                  <a href={k.selfieUrl} target="_blank" rel="noreferrer" className="mt-3 inline-block text-brand text-sm font-bold hover:underline">
                    View selfie ↗
                  </a>
                ) : null}
              </Card>
            ))}
          </div>
        )
      ) : null}

      <div className="mt-8 text-[12px] text-ink-muted">
        <Link href="/customers" className="hover:text-ink">← Back to all customers</Link>
      </div>
    </Shell>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-ink-muted">{k}</span>
      <span className="text-ink font-semibold text-right">{v}</span>
    </div>
  );
}
function Th({ children }: { children: React.ReactNode }) {
  return <th className="text-left text-eyebrow uppercase text-ink-muted px-4 py-3">{children}</th>;
}
function Td({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-4 py-3 align-middle ${className}`}>{children}</td>;
}
