'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Shell } from '../../../components/Shell';
import { Button, Card, EmptyState, FormField, Input, Pill, Select } from '../../../components/UI';
import { api, apiErrorMessage, formatDate } from '../../../lib/api';

interface TechFull {
  id: string;
  employeeCode: string;
  zone: string;
  status: string;
  isActive: boolean;
  whatsappNumber?: string | null;
  employmentType?: string | null;
  monthlySalaryPaise?: number | null;
  dateOfJoining?: string | null;
  dateOfBirth?: string | null;
  exitedAt?: string | null;
  aadhaarLast4?: string | null;
  panLast4?: string | null;
  bankAccountLast4?: string | null;
  bankIfsc?: string | null;
  bankName?: string | null;
  accountHolderName?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  addressCity?: string | null;
  addressState?: string | null;
  addressPincode?: string | null;
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
  emergencyContactRelation?: string | null;
  documentUrls?: string | null;
  createdAt: string;
  user: { id: string; fullName: string | null; phone: string; email: string | null; status: string };
}

type Tab = 'profile' | 'bank' | 'documents';
const TABS: { key: Tab; label: string }[] = [
  { key: 'profile', label: 'Profile' },
  { key: 'bank', label: 'Bank & ID' },
  { key: 'documents', label: 'Documents' },
];

export default function TechnicianDetail() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const [tech, setTech] = useState<TechFull | null>(null);
  const [tab, setTab] = useState<Tab>('profile');
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<TechFull>>({});
  const [docLabel, setDocLabel] = useState('');
  const [docUrl, setDocUrl] = useState('');

  async function reload() {
    if (!id) return;
    const r = await api.get(`/admin/technicians/${id}`);
    setTech(r.data.data);
    setForm(r.data.data);
  }
  useEffect(() => { reload(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [id]);

  async function save() {
    if (!tech) return;
    setBusy(true);
    setErr(null);
    try {
      const body: Record<string, unknown> = {};
      const f = form;
      ([
        'fullName', 'phone', 'email', 'whatsappNumber', 'zone', 'employmentType', 'monthlySalaryPaise',
        'bankIfsc', 'bankName', 'accountHolderName',
        'addressLine1', 'addressLine2', 'addressCity', 'addressState', 'addressPincode',
        'emergencyContactName', 'emergencyContactPhone', 'emergencyContactRelation',
      ] as const).forEach((k) => {
        const value = (f as Record<string, unknown>)[k];
        if (value !== undefined && value !== null) body[k] = value;
      });
      // user-level
      if (form.user?.fullName !== undefined) body.fullName = form.user.fullName;
      if (form.user?.phone !== undefined) body.phone = form.user.phone;
      if (form.user?.email !== undefined) body.email = form.user.email;
      await api.patch(`/admin/technicians/${tech.id}`, body);
      await reload();
      setEditing(false);
    } catch (e) {
      setErr(apiErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function setStatus(status: 'ACTIVE' | 'ON_LEAVE' | 'SUSPENDED' | 'EXITED') {
    if (!tech) return;
    if (!confirm(`Set status to ${status}?`)) return;
    setBusy(true);
    try {
      await api.patch(`/admin/technicians/${tech.id}`, { status });
      await reload();
    } catch (e) {
      alert(apiErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function addDocument() {
    if (!tech || !docLabel.trim() || !docUrl.trim()) return;
    setBusy(true);
    try {
      await api.post(`/admin/technicians/${tech.id}/documents`, { label: docLabel, url: docUrl });
      setDocLabel('');
      setDocUrl('');
      await reload();
    } catch (e) {
      alert(apiErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  if (!tech) {
    return (
      <Shell title="Employee" eyebrow="Team">
        <div className="text-ink-muted text-sm">Loading…</div>
      </Shell>
    );
  }

  const docs: Array<{ label: string; url: string; uploadedAt: string }> = (() => {
    try { return tech.documentUrls ? JSON.parse(tech.documentUrls) : []; } catch { return []; }
  })();

  const initial = (tech.user.fullName ?? tech.user.phone).slice(0, 1).toUpperCase();

  return (
    <Shell title={tech.user.fullName ?? tech.employeeCode} eyebrow="Employee">
      <Card variant="elevated" className="mb-6">
        <div className="flex items-start gap-5 flex-wrap">
          <div className="h-20 w-20 rounded-full bg-gradient-deep grid place-items-center text-white font-extrabold text-3xl shadow-glow shrink-0">
            {initial}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <h2 className="font-display text-display-md font-extrabold text-ink">{tech.user.fullName ?? '—'}</h2>
              <Pill tone={tech.status === 'ACTIVE' ? 'success' : tech.status === 'EXITED' ? 'danger' : 'warning'} dot>
                {tech.status}
              </Pill>
              {tech.employmentType ? <Pill tone="accent">{tech.employmentType}</Pill> : null}
            </div>
            <div className="text-ink-muted text-sm mt-1.5 tabular-nums">
              {tech.employeeCode} · {tech.zone}
            </div>
            <div className="text-[12px] text-ink-muted mt-0.5">
              {tech.user.phone}
              {tech.user.email ? ` · ${tech.user.email}` : ''}
              {tech.dateOfJoining ? ` · joined ${formatDate(tech.dateOfJoining)}` : ''}
            </div>
          </div>
          <div className="flex flex-col gap-2 shrink-0">
            {!editing ? (
              <Button onClick={() => setEditing(true)}>Edit profile</Button>
            ) : (
              <>
                <Button onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save changes'}</Button>
                <Button variant="ghost" onClick={() => { setEditing(false); setForm(tech); }} disabled={busy}>Cancel</Button>
              </>
            )}
            <Button variant="outline" onClick={() => router.back()}>Back</Button>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {(['ACTIVE', 'ON_LEAVE', 'SUSPENDED', 'EXITED'] as const).map((s) => (
            <Button
              key={s}
              size="sm"
              variant={tech.status === s ? 'primary' : 'outline'}
              onClick={() => setStatus(s)}
              disabled={busy || tech.status === s}
            >
              Mark {s}
            </Button>
          ))}
        </div>
      </Card>

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

      {err ? (
        <div className="mb-4 rounded-xl border border-danger/30 bg-danger-soft px-4 py-2.5 text-sm text-danger font-bold">{err}</div>
      ) : null}

      {tab === 'profile' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <div className="text-eyebrow uppercase text-ink-muted">Personal</div>
            <div className="mt-3 space-y-3">
              <FormField label="Full name">
                {editing ? (
                  <Input value={form.user?.fullName ?? ''} onChange={(e) => setForm({ ...form, user: { ...(form.user ?? tech.user), fullName: e.target.value } })} />
                ) : (
                  <div className="text-sm font-bold">{tech.user.fullName ?? '—'}</div>
                )}
              </FormField>
              <FormField label="Phone">
                {editing ? (
                  <Input value={form.user?.phone ?? ''} onChange={(e) => setForm({ ...form, user: { ...(form.user ?? tech.user), phone: e.target.value } })} />
                ) : (
                  <div className="text-sm tabular-nums">{tech.user.phone}</div>
                )}
              </FormField>
              <FormField label="Email">
                {editing ? (
                  <Input value={form.user?.email ?? ''} onChange={(e) => setForm({ ...form, user: { ...(form.user ?? tech.user), email: e.target.value } })} />
                ) : (
                  <div className="text-sm">{tech.user.email ?? '—'}</div>
                )}
              </FormField>
              <FormField label="WhatsApp number">
                {editing ? (
                  <Input value={form.whatsappNumber ?? ''} onChange={(e) => setForm({ ...form, whatsappNumber: e.target.value })} />
                ) : (
                  <div className="text-sm tabular-nums">{tech.whatsappNumber ?? '—'}</div>
                )}
              </FormField>
              <FormField label="Date of birth">
                <div className="text-sm">{formatDate(tech.dateOfBirth)}</div>
              </FormField>
            </div>
          </Card>
          <Card>
            <div className="text-eyebrow uppercase text-ink-muted">Role</div>
            <div className="mt-3 space-y-3">
              <FormField label="Employee code">
                <div className="text-sm font-bold tabular-nums">{tech.employeeCode}</div>
              </FormField>
              <FormField label="Zone">
                {editing ? (
                  <Input value={form.zone ?? ''} onChange={(e) => setForm({ ...form, zone: e.target.value })} />
                ) : (
                  <div className="text-sm">{tech.zone}</div>
                )}
              </FormField>
              <FormField label="Employment type">
                {editing ? (
                  <Select value={form.employmentType ?? ''} onChange={(e) => setForm({ ...form, employmentType: e.target.value })}>
                    <option value="PROBATION">Probation</option>
                    <option value="PERMANENT">Permanent</option>
                    <option value="CONTRACT">Contract</option>
                  </Select>
                ) : (
                  <div className="text-sm">{tech.employmentType ?? '—'}</div>
                )}
              </FormField>
              <FormField label="Monthly salary (₹)">
                {editing ? (
                  <Input
                    type="number"
                    value={form.monthlySalaryPaise != null ? String(Math.round(Number(form.monthlySalaryPaise) / 100)) : ''}
                    onChange={(e) => setForm({ ...form, monthlySalaryPaise: e.target.value ? Math.round(Number(e.target.value) * 100) : null })}
                  />
                ) : (
                  <div className="text-sm tabular-nums font-bold">
                    {tech.monthlySalaryPaise != null ? '₹' + (tech.monthlySalaryPaise / 100).toLocaleString('en-IN') : '—'}
                  </div>
                )}
              </FormField>
              <FormField label="Date of joining">
                <div className="text-sm">{formatDate(tech.dateOfJoining)}</div>
              </FormField>
            </div>
          </Card>

          <Card className="md:col-span-2">
            <div className="text-eyebrow uppercase text-ink-muted">Address</div>
            <div className="mt-3 space-y-3">
              <FormField label="Line 1">
                {editing ? <Input value={form.addressLine1 ?? ''} onChange={(e) => setForm({ ...form, addressLine1: e.target.value })} /> : <div className="text-sm">{tech.addressLine1 ?? '—'}</div>}
              </FormField>
              <FormField label="Line 2">
                {editing ? <Input value={form.addressLine2 ?? ''} onChange={(e) => setForm({ ...form, addressLine2: e.target.value })} /> : <div className="text-sm">{tech.addressLine2 ?? '—'}</div>}
              </FormField>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField label="City">{editing ? <Input value={form.addressCity ?? ''} onChange={(e) => setForm({ ...form, addressCity: e.target.value })} /> : <div className="text-sm">{tech.addressCity ?? '—'}</div>}</FormField>
                <FormField label="State">{editing ? <Input value={form.addressState ?? ''} onChange={(e) => setForm({ ...form, addressState: e.target.value })} /> : <div className="text-sm">{tech.addressState ?? '—'}</div>}</FormField>
                <FormField label="Pincode">{editing ? <Input value={form.addressPincode ?? ''} onChange={(e) => setForm({ ...form, addressPincode: e.target.value })} /> : <div className="text-sm tabular-nums">{tech.addressPincode ?? '—'}</div>}</FormField>
              </div>
            </div>
          </Card>

          <Card className="md:col-span-2">
            <div className="text-eyebrow uppercase text-ink-muted">Emergency contact</div>
            <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-4">
              <FormField label="Name">{editing ? <Input value={form.emergencyContactName ?? ''} onChange={(e) => setForm({ ...form, emergencyContactName: e.target.value })} /> : <div className="text-sm">{tech.emergencyContactName ?? '—'}</div>}</FormField>
              <FormField label="Phone">{editing ? <Input value={form.emergencyContactPhone ?? ''} onChange={(e) => setForm({ ...form, emergencyContactPhone: e.target.value })} /> : <div className="text-sm tabular-nums">{tech.emergencyContactPhone ?? '—'}</div>}</FormField>
              <FormField label="Relation">{editing ? <Input value={form.emergencyContactRelation ?? ''} onChange={(e) => setForm({ ...form, emergencyContactRelation: e.target.value })} /> : <div className="text-sm">{tech.emergencyContactRelation ?? '—'}</div>}</FormField>
            </div>
          </Card>
        </div>
      ) : null}

      {tab === 'bank' ? (
        <Card>
          <Pill tone="warning" size="sm" className="mb-3">
            Aadhaar / PAN / bank account stored as one-way hash — only the last 4 digits are visible after save.
          </Pill>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
            <FormField label="Aadhaar (last 4)">
              <div className="text-sm tabular-nums font-bold">{tech.aadhaarLast4 ? `••••${tech.aadhaarLast4}` : '—'}</div>
            </FormField>
            <FormField label="PAN (last 4)">
              <div className="text-sm tabular-nums font-bold">{tech.panLast4 ? `••••${tech.panLast4}` : '—'}</div>
            </FormField>
            <FormField label="Bank account (last 4)">
              <div className="text-sm tabular-nums font-bold">{tech.bankAccountLast4 ? `••••${tech.bankAccountLast4}` : '—'}</div>
            </FormField>
            <FormField label="IFSC">
              {editing ? <Input value={form.bankIfsc ?? ''} onChange={(e) => setForm({ ...form, bankIfsc: e.target.value.toUpperCase() })} /> : <div className="text-sm tabular-nums">{tech.bankIfsc ?? '—'}</div>}
            </FormField>
            <FormField label="Bank name">
              {editing ? <Input value={form.bankName ?? ''} onChange={(e) => setForm({ ...form, bankName: e.target.value })} /> : <div className="text-sm">{tech.bankName ?? '—'}</div>}
            </FormField>
            <FormField label="Account holder name">
              {editing ? <Input value={form.accountHolderName ?? ''} onChange={(e) => setForm({ ...form, accountHolderName: e.target.value })} /> : <div className="text-sm">{tech.accountHolderName ?? '—'}</div>}
            </FormField>
          </div>
        </Card>
      ) : null}

      {tab === 'documents' ? (
        <div className="space-y-4">
          <Card padding="md">
            <div className="text-eyebrow uppercase text-ink-muted mb-3">Add a document</div>
            <div className="grid grid-cols-1 md:grid-cols-[200px_1fr_auto] gap-3 items-end">
              <FormField label="Label">
                <Input value={docLabel} onChange={(e) => setDocLabel(e.target.value)} placeholder="e.g. Aadhaar copy" />
              </FormField>
              <FormField label="URL">
                <Input value={docUrl} onChange={(e) => setDocUrl(e.target.value)} placeholder="https://… or /uploads/…" />
              </FormField>
              <Button onClick={addDocument} disabled={busy || !docLabel || !docUrl}>Add</Button>
            </div>
          </Card>

          {docs.length === 0 ? (
            <EmptyState title="No documents on file" description="Upload identity proof, address proof, bank passbook etc." />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {docs.map((d, i) => (
                <Card key={i} padding="md">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-bold text-ink">{d.label}</div>
                      <div className="text-[11px] text-ink-muted mt-0.5">Uploaded {formatDate(d.uploadedAt)}</div>
                    </div>
                    <a href={d.url} target="_blank" rel="noreferrer" className="text-brand text-[12px] font-bold hover:underline whitespace-nowrap">
                      Open ↗
                    </a>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      ) : null}

      <div className="mt-8 text-[12px] text-ink-muted">
        <Link href="/technicians" className="hover:text-ink">← Back to roster</Link>
      </div>
    </Shell>
  );
}
