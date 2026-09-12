'use client';

import { useEffect, useState } from 'react';
import { Shell } from '../../components/Shell';
import { Button, Card, Drawer, EmptyState, FormField, Input, Pill, Select, Textarea } from '../../components/UI';
import { api, apiErrorMessage, formatDate } from '../../lib/api';

interface Banner {
  id: string;
  title: string;
  body?: string | null;
  imageUrl?: string | null;
  ctaLabel?: string | null;
  ctaTarget?: string | null;
  audience: string;
  startsAt: string;
  endsAt: string;
  priority: number;
  isActive: boolean;
  createdAt: string;
}

interface FormState {
  title: string;
  body: string;
  imageUrl: string;
  ctaLabel: string;
  ctaTarget: string;
  audience: string;
  startsAt: string;
  endsAt: string;
  priority: string;
  isActive: boolean;
}

const empty: FormState = {
  title: '', body: '', imageUrl: '', ctaLabel: 'Browse', ctaTarget: '',
  audience: 'ALL', startsAt: '', endsAt: '', priority: '0', isActive: true,
};

function isoLocal(d: string) {
  if (!d) return '';
  const dd = new Date(d);
  return isNaN(dd.getTime()) ? '' : dd.toISOString().slice(0, 16);
}

export default function BannersPage() {
  const [items, setItems] = useState<Banner[] | null>(null);
  const [editing, setEditing] = useState<Banner | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<FormState>(empty);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function reload() {
    const r = await api.get('/banners/admin/list');
    setItems(r.data.data);
  }
  useEffect(() => { reload(); }, []);

  function openNew() {
    const now = new Date();
    const in30 = new Date(now.getTime() + 30 * 86400000);
    setForm({
      ...empty,
      startsAt: now.toISOString().slice(0, 16),
      endsAt: in30.toISOString().slice(0, 16),
    });
    setCreating(true);
    setEditing(null);
    setErr(null);
  }

  function openEdit(b: Banner) {
    setEditing(b);
    setCreating(false);
    setErr(null);
    setForm({
      title: b.title,
      body: b.body ?? '',
      imageUrl: b.imageUrl ?? '',
      ctaLabel: b.ctaLabel ?? '',
      ctaTarget: b.ctaTarget ?? '',
      audience: b.audience,
      startsAt: isoLocal(b.startsAt),
      endsAt: isoLocal(b.endsAt),
      priority: String(b.priority),
      isActive: b.isActive,
    });
  }

  async function save() {
    setBusy(true);
    setErr(null);
    try {
      const body = {
        title: form.title.trim(),
        body: form.body.trim() || null,
        imageUrl: form.imageUrl.trim() || null,
        ctaLabel: form.ctaLabel.trim() || null,
        ctaTarget: form.ctaTarget.trim() || null,
        audience: form.audience,
        startsAt: new Date(form.startsAt).toISOString(),
        endsAt: new Date(form.endsAt).toISOString(),
        priority: Number(form.priority || 0),
        isActive: form.isActive,
      };
      if (editing) {
        await api.patch(`/banners/admin/${editing.id}`, body);
      } else {
        await api.post('/banners/admin', body);
      }
      await reload();
      setEditing(null);
      setCreating(false);
    } catch (e) {
      setErr(apiErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function archive(b: Banner) {
    if (!confirm(`Archive banner "${b.title}"?`)) return;
    await api.delete(`/banners/admin/${b.id}`);
    await reload();
  }

  const open = creating || !!editing;

  return (
    <Shell title="Banners & offers" eyebrow="Marketing">
      <div className="flex items-center justify-between mb-5">
        <div className="text-sm text-ink-muted">{items ? `${items.length} banners` : 'Loading…'}</div>
        <Button onClick={openNew} leadingIcon={<span className="text-base leading-none">＋</span>}>
          New banner
        </Button>
      </div>

      {!items ? (
        <Card><div className="text-ink-muted text-sm">Loading…</div></Card>
      ) : items.length === 0 ? (
        <EmptyState
          title="No banners yet"
          description="Create your first offer banner to push to the customer app."
          action={<Button onClick={openNew}>Create banner</Button>}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {items.map((b) => (
            <Card key={b.id} padding="md" variant={b.isActive ? 'plain' : 'tinted'}>
              <BannerPreview b={b} />
              <div className="mt-3 flex items-center justify-between flex-wrap gap-2">
                <div className="text-[11px] text-ink-muted">
                  {formatDate(b.startsAt)} → {formatDate(b.endsAt)} · audience: {b.audience}
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="ghost" onClick={() => openEdit(b)}>Edit</Button>
                  {b.isActive ? (
                    <Button size="sm" variant="outline" onClick={() => archive(b)}>Archive</Button>
                  ) : null}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Drawer open={open} onClose={() => { setEditing(null); setCreating(false); }} title={editing ? 'Edit banner' : 'New banner'} width="wide">
        {err ? <div className="mb-4 rounded-xl border border-danger/30 bg-danger-soft px-4 py-2.5 text-sm text-danger font-bold">{err}</div> : null}
        <div className="grid grid-cols-1 gap-4">
          <FormField label="Title" required>
            <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Monsoon offer — flat 15% off" />
          </FormField>
          <FormField label="Body">
            <Textarea rows={3} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} placeholder="Use code MONSOON15 at checkout." />
          </FormField>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField label="Image URL">
              <Input value={form.imageUrl} onChange={(e) => setForm({ ...form, imageUrl: e.target.value })} placeholder="/uploads/monsoon.jpg" />
            </FormField>
            <FormField label="CTA label">
              <Input value={form.ctaLabel} onChange={(e) => setForm({ ...form, ctaLabel: e.target.value })} placeholder="Browse plans" />
            </FormField>
            <FormField label="CTA target" hint="product:slug | plan:id | url:https://…">
              <Input value={form.ctaTarget} onChange={(e) => setForm({ ...form, ctaTarget: e.target.value })} placeholder="product:aqua-pure-7l" />
            </FormField>
            <FormField label="Audience">
              <Select value={form.audience} onChange={(e) => setForm({ ...form, audience: e.target.value })}>
                <option value="ALL">All customers</option>
                <option value="HOME">Home customers</option>
                <option value="COMMERCIAL">Office customers</option>
                <option value="EXPIRING">Expiring within 7 days</option>
              </Select>
            </FormField>
            <FormField label="Starts at" required>
              <Input type="datetime-local" value={form.startsAt} onChange={(e) => setForm({ ...form, startsAt: e.target.value })} />
            </FormField>
            <FormField label="Ends at" required>
              <Input type="datetime-local" value={form.endsAt} onChange={(e) => setForm({ ...form, endsAt: e.target.value })} />
            </FormField>
            <FormField label="Priority" hint="Higher renders first">
              <Input type="number" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} />
            </FormField>
            <FormField label="Active">
              <Select value={form.isActive ? '1' : '0'} onChange={(e) => setForm({ ...form, isActive: e.target.value === '1' })}>
                <option value="1">Active</option>
                <option value="0">Archived</option>
              </Select>
            </FormField>
          </div>

          <div className="border-t border-line pt-5">
            <div className="text-eyebrow uppercase text-ink-muted mb-3">Live preview</div>
            <BannerPreview
              b={{
                id: 'preview',
                title: form.title || 'Banner title',
                body: form.body,
                imageUrl: form.imageUrl,
                ctaLabel: form.ctaLabel,
                ctaTarget: form.ctaTarget,
                audience: form.audience,
                startsAt: form.startsAt,
                endsAt: form.endsAt,
                priority: 0,
                isActive: form.isActive,
                createdAt: new Date().toISOString(),
              } as Banner}
            />
          </div>

          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={() => { setEditing(null); setCreating(false); }} disabled={busy}>Cancel</Button>
            <Button onClick={save} disabled={busy || !form.title || !form.startsAt || !form.endsAt}>
              {busy ? 'Saving…' : editing ? 'Save changes' : 'Publish banner'}
            </Button>
          </div>
        </div>
      </Drawer>
    </Shell>
  );
}

function BannerPreview({ b }: { b: Banner }) {
  return (
    <div className="rounded-2xl bg-gradient-deep p-5 text-white shadow-glow relative overflow-hidden">
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-[0.18em] text-white/80">{b.audience}</div>
          <div className="font-display text-title-md font-extrabold mt-1">{b.title || 'Banner title'}</div>
          {b.body ? <div className="text-[12px] text-white/90 mt-1 max-w-md">{b.body}</div> : null}
          {b.ctaLabel ? (
            <div className="mt-4 inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-white/15 border border-white/30 text-[12px] font-bold">
              {b.ctaLabel} →
            </div>
          ) : null}
        </div>
        {!b.isActive ? <Pill tone="ink" size="sm">Archived</Pill> : null}
      </div>
    </div>
  );
}
