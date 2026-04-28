'use client';

import { useEffect, useState } from 'react';
import { Shell } from '../../components/Shell';
import { Badge, Button, Card, Table } from '../../components/UI';
import { api, apiErrorMessage, paiseToInr } from '../../lib/api';

type Kind = 'HOME' | 'COMMERCIAL';
type Mounting = 'WALL' | 'COUNTERTOP' | 'UNDER_SINK';

interface Plan { id: string; name: string; durationDays: number }
interface City { id: string; name: string; state: string; isServiceable: boolean }
interface PlanCityPrice {
  id: string;
  planId: string;
  cityId: string;
  productId: string;
  monthlyPricePaise: number;
  depositPaise: number;
  plan?: Plan;
  city?: City;
}
interface Product {
  id: string;
  slug: string;
  name: string;
  kind: Kind;
  capacityLitres: number;
  technology: string;
  mounting: Mounting;
  description: string;
  imageUrl?: string | null;
  warrantyMonths: number;
  isActive: boolean;
  createdAt: string;
  prices: PlanCityPrice[];
  _count?: { bookings: number; subscriptions: number; devices: number };
}

const TECH_OPTIONS = ['RO', 'RO+UV', 'RO+UV+UF', 'RO+UV+UF+Mineral', 'UV'];

const EMPTY_FORM: Omit<Product, 'id' | 'slug' | 'createdAt' | 'prices' | '_count'> & { slug?: string } = {
  name: '',
  slug: '',
  kind: 'HOME',
  capacityLitres: 7,
  technology: 'RO+UV',
  mounting: 'COUNTERTOP',
  description: '',
  imageUrl: null,
  warrantyMonths: 12,
  isActive: true,
};

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[] | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [filter, setFilter] = useState<'ALL' | Kind>('ALL');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  async function load() {
    try {
      const [p, pl, c] = await Promise.all([
        api.get<{ data: Product[] }>('/admin/products').then((r) => r.data.data),
        api.get<{ data: Plan[] }>('/plans').then((r) => r.data.data),
        api.get<{ data: City[] }>('/cities').then((r) => r.data.data),
      ]);
      setProducts(p);
      setPlans(pl);
      setCities(c);
    } catch (e) {
      setErr(apiErrorMessage(e));
    }
  }

  useEffect(() => { void load(); }, []);

  function startCreate() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
    setErr(null);
  }

  function startEdit(p: Product) {
    setEditingId(p.id);
    setForm({
      name: p.name,
      slug: p.slug,
      kind: p.kind,
      capacityLitres: p.capacityLitres,
      technology: p.technology,
      mounting: p.mounting,
      description: p.description,
      imageUrl: p.imageUrl ?? null,
      warrantyMonths: p.warrantyMonths,
      isActive: p.isActive,
    });
    setShowForm(true);
    setErr(null);
  }

  async function submitForm() {
    setBusy(true); setErr(null);
    try {
      const payload: Record<string, unknown> = {
        name: form.name,
        kind: form.kind,
        capacityLitres: Number(form.capacityLitres),
        technology: form.technology,
        mounting: form.mounting,
        description: form.description,
        warrantyMonths: Number(form.warrantyMonths),
        isActive: form.isActive,
      };
      if (form.imageUrl && form.imageUrl.trim().length > 0) payload.imageUrl = form.imageUrl;
      if (form.slug && form.slug.trim().length > 0) payload.slug = form.slug.trim();

      if (editingId) {
        await api.patch(`/admin/products/${editingId}`, payload);
        setFlash('Product updated');
      } else {
        await api.post('/admin/products', payload);
        setFlash('Product created');
      }
      setShowForm(false);
      setForm(EMPTY_FORM);
      setEditingId(null);
      await load();
    } catch (e) {
      setErr(apiErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(p: Product) {
    setBusy(true); setErr(null);
    try {
      if (p.isActive) {
        await api.delete(`/admin/products/${p.id}`);
        setFlash(`Disabled "${p.name}"`);
      } else {
        await api.patch(`/admin/products/${p.id}`, { isActive: true });
        setFlash(`Enabled "${p.name}"`);
      }
      await load();
    } catch (e) {
      setErr(apiErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function upsertPrice(productId: string, body: { planId: string; cityId: string; monthlyPricePaise: number; depositPaise: number }) {
    setBusy(true); setErr(null);
    try {
      await api.post(`/admin/products/${productId}/pricing`, body);
      setFlash('Price saved');
      await load();
    } catch (e) {
      setErr(apiErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function removePrice(productId: string, priceId: string) {
    setBusy(true); setErr(null);
    try {
      await api.delete(`/admin/products/${productId}/pricing/${priceId}`);
      setFlash('Price removed');
      await load();
    } catch (e) {
      setErr(apiErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  const visible = !products
    ? []
    : filter === 'ALL'
    ? products
    : products.filter((p) => p.kind === filter);

  return (
    <Shell title="Products & Pricing">
      {flash ? (
        <div className="mb-4 px-4 py-2 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex justify-between">
          <span>✓ {flash}</span>
          <button onClick={() => setFlash(null)} className="text-emerald-600">✕</button>
        </div>
      ) : null}
      {err ? (
        <div className="mb-4 px-4 py-2 rounded-md bg-rose-50 border border-rose-200 text-rose-800 text-sm flex justify-between">
          <span>{err}</span>
          <button onClick={() => setErr(null)} className="text-rose-600">✕</button>
        </div>
      ) : null}

      {/* Toolbar */}
      <div className="flex items-center justify-between mb-4 gap-3">
        <div className="flex items-center gap-2">
          {(['ALL', 'HOME', 'COMMERCIAL'] as const).map((k) => (
            <button
              key={k}
              onClick={() => setFilter(k)}
              className={
                'px-3 py-1.5 rounded-md text-sm font-semibold border ' +
                (filter === k ? 'bg-brand text-white border-brand' : 'bg-white text-ink border-line hover:bg-canvas')
              }
            >
              {k === 'ALL' ? 'All' : k === 'HOME' ? 'Home' : 'Commercial'}
            </button>
          ))}
          <span className="text-xs text-ink-muted ml-2">
            {products ? `${visible.length} ${filter === 'ALL' ? 'total' : filter.toLowerCase()}` : 'Loading…'}
          </span>
        </div>
        <Button onClick={startCreate}>+ Add product</Button>
      </div>

      {/* Inline form */}
      {showForm ? (
        <Card className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold">{editingId ? 'Edit product' : 'New product'}</h2>
            <button onClick={() => { setShowForm(false); setEditingId(null); }} className="text-ink-muted hover:text-ink text-sm">
              ✕ Cancel
            </button>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Name" required>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className={inputCls}
                placeholder="AquaPure 7L"
              />
            </Field>
            <Field label="Slug" hint={editingId ? 'Used in URLs. Be careful — old URLs break.' : 'Auto-generated from name if blank.'}>
              <input
                value={form.slug ?? ''}
                onChange={(e) => setForm({ ...form, slug: e.target.value })}
                className={inputCls}
                placeholder="aquapure-7l"
              />
            </Field>

            <Field label="Use case" required>
              <select
                value={form.kind}
                onChange={(e) => setForm({ ...form, kind: e.target.value as Kind })}
                className={inputCls}
              >
                <option value="HOME">Home use</option>
                <option value="COMMERCIAL">Commercial</option>
              </select>
            </Field>
            <Field label="Capacity (L)" required>
              <input
                type="number"
                value={form.capacityLitres}
                onChange={(e) => setForm({ ...form, capacityLitres: Number(e.target.value) })}
                className={inputCls}
                min={1}
                max={1000}
              />
            </Field>

            <Field label="Technology" required>
              <select
                value={form.technology}
                onChange={(e) => setForm({ ...form, technology: e.target.value })}
                className={inputCls}
              >
                {TECH_OPTIONS.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
                <option value="__custom__">Custom…</option>
              </select>
              {form.technology === '__custom__' ? (
                <input
                  className={inputCls + ' mt-2'}
                  placeholder="e.g. RO+UV+Copper"
                  onChange={(e) => setForm({ ...form, technology: e.target.value })}
                />
              ) : null}
            </Field>
            <Field label="Mounting" required>
              <select
                value={form.mounting}
                onChange={(e) => setForm({ ...form, mounting: e.target.value as Mounting })}
                className={inputCls}
              >
                <option value="WALL">Wall mount</option>
                <option value="COUNTERTOP">Countertop</option>
                <option value="UNDER_SINK">Under sink</option>
              </select>
            </Field>

            <Field label="Warranty (months)">
              <input
                type="number"
                value={form.warrantyMonths}
                onChange={(e) => setForm({ ...form, warrantyMonths: Number(e.target.value) })}
                className={inputCls}
                min={0}
                max={120}
              />
            </Field>
            <Field label="Image URL (optional)">
              <input
                value={form.imageUrl ?? ''}
                onChange={(e) => setForm({ ...form, imageUrl: e.target.value })}
                className={inputCls}
                placeholder="https://..."
              />
            </Field>

            <div className="col-span-2">
              <Field label="Description" required hint="At least 10 characters. Shown on Product Detail page in the customer app.">
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className={inputCls + ' min-h-[100px]'}
                  placeholder="Compact 7-litre purifier with RO+UV+UF for borewell or municipal water…"
                />
              </Field>
            </div>

            <div className="col-span-2">
              <label className="inline-flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                />
                Active (visible to customers)
              </label>
            </div>
          </div>

          <div className="flex justify-end gap-2 mt-5">
            <Button variant="ghost" onClick={() => { setShowForm(false); setEditingId(null); }}>Cancel</Button>
            <Button onClick={submitForm} disabled={busy || !form.name || !form.description || form.description.length < 10}>
              {busy ? 'Saving…' : editingId ? 'Save changes' : 'Create product'}
            </Button>
          </div>
        </Card>
      ) : null}

      {/* Products table */}
      <Table
        headers={['Product', 'Use', 'Specs', 'Prices', 'Status', 'Actions']}
        empty={products ? 'No products in this filter.' : 'Loading…'}
        rows={visible.map((p) => [
          <div key="n">
            <button
              onClick={() => setExpanded(expanded === p.id ? null : p.id)}
              className="font-semibold text-ink hover:text-brand text-left"
            >
              {p.name}
            </button>
            <div className="text-xs text-ink-muted mt-0.5">/{p.slug}</div>
          </div>,
          <Badge key="k" tone={p.kind === 'HOME' ? 'info' : 'neutral'}>{p.kind}</Badge>,
          <div key="s" className="text-xs">
            <div>{p.capacityLitres}L · {p.technology}</div>
            <div className="text-ink-muted">{p.mounting.replace('_', ' ').toLowerCase()} · {p.warrantyMonths}mo warranty</div>
          </div>,
          <div key="pr" className="text-xs">
            <div className="font-semibold">{p.prices.length} pricing{p.prices.length === 1 ? '' : 's'}</div>
            <div className="text-ink-muted">
              {p.prices.length === 0 ? 'no city pricing yet' : `${new Set(p.prices.map((x) => x.cityId)).size} city × ${new Set(p.prices.map((x) => x.planId)).size} plans`}
            </div>
          </div>,
          p.isActive ? <Badge key="b" tone="success">ACTIVE</Badge> : <Badge key="b" tone="danger">DISABLED</Badge>,
          <div key="a" className="flex gap-2">
            <Button variant="ghost" onClick={() => setExpanded(expanded === p.id ? null : p.id)}>
              {expanded === p.id ? 'Hide' : 'Pricing'}
            </Button>
            <Button variant="ghost" onClick={() => startEdit(p)}>Edit</Button>
            <Button variant={p.isActive ? 'danger' : 'primary'} onClick={() => toggleActive(p)}>
              {p.isActive ? 'Disable' : 'Enable'}
            </Button>
          </div>,
        ])}
      />

      {/* Pricing manager for expanded product */}
      {expanded && products ? (
        <PricingManager
          product={products.find((p) => p.id === expanded)!}
          plans={plans}
          cities={cities}
          onUpsert={(body) => upsertPrice(expanded, body)}
          onRemove={(priceId) => removePrice(expanded, priceId)}
          busy={busy}
          onClose={() => setExpanded(null)}
        />
      ) : null}
    </Shell>
  );
}

const inputCls =
  'w-full px-3 py-2 rounded-md border border-line bg-white text-sm focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand';

function Field({ label, hint, required, children }: { label: string; hint?: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
        {label} {required ? <span className="text-rose-500">*</span> : null}
      </span>
      {children}
      {hint ? <span className="text-[11px] text-ink-muted">{hint}</span> : null}
    </label>
  );
}

function PricingManager({
  product,
  plans,
  cities,
  onUpsert,
  onRemove,
  busy,
  onClose,
}: {
  product: Product;
  plans: Plan[];
  cities: City[];
  onUpsert: (body: { planId: string; cityId: string; monthlyPricePaise: number; depositPaise: number }) => Promise<void>;
  onRemove: (priceId: string) => Promise<void>;
  busy: boolean;
  onClose: () => void;
}) {
  const [draftCity, setDraftCity] = useState(cities[0]?.id ?? '');
  const [draftPlan, setDraftPlan] = useState(plans[0]?.id ?? '');
  const [draftMonthly, setDraftMonthly] = useState('');
  const [draftDeposit, setDraftDeposit] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editMonthly, setEditMonthly] = useState('');
  const [editDeposit, setEditDeposit] = useState('');

  async function add() {
    if (!draftCity || !draftPlan) return;
    const monthly = Math.round(Number(draftMonthly) * 100);
    const deposit = Math.round(Number(draftDeposit) * 100);
    if (!Number.isFinite(monthly) || monthly < 0) return;
    if (!Number.isFinite(deposit) || deposit < 0) return;
    await onUpsert({ cityId: draftCity, planId: draftPlan, monthlyPricePaise: monthly, depositPaise: deposit });
    setDraftMonthly(''); setDraftDeposit('');
  }

  async function saveEdit(p: PlanCityPrice) {
    const monthly = Math.round(Number(editMonthly) * 100);
    const deposit = Math.round(Number(editDeposit) * 100);
    await onUpsert({ cityId: p.cityId, planId: p.planId, monthlyPricePaise: monthly, depositPaise: deposit });
    setEditingId(null);
  }

  return (
    <Card className="mt-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-bold">Pricing — {product.name}</h2>
          <p className="text-xs text-ink-muted">One row per (city × plan). Adding a duplicate combo updates the existing price.</p>
        </div>
        <button onClick={onClose} className="text-ink-muted hover:text-ink text-sm">✕ Close</button>
      </div>

      <Table
        headers={['City', 'Plan', 'Monthly', 'Deposit', 'Effective from', '']}
        empty="No pricing yet. Add the first row below."
        rows={product.prices.map((p) => {
          const isEditing = editingId === p.id;
          return [
            <div key="c" className="font-semibold">{p.city?.name}</div>,
            <div key="p">{p.plan?.name} <span className="text-ink-muted text-xs">({p.plan?.durationDays}d)</span></div>,
            isEditing ? (
              <input key="m" type="number" value={editMonthly} onChange={(e) => setEditMonthly(e.target.value)} className={inputCls + ' w-28'} />
            ) : (
              <span key="m" className="font-semibold">{paiseToInr(p.monthlyPricePaise)}</span>
            ),
            isEditing ? (
              <input key="d" type="number" value={editDeposit} onChange={(e) => setEditDeposit(e.target.value)} className={inputCls + ' w-28'} />
            ) : (
              <span key="d">{paiseToInr(p.depositPaise)}</span>
            ),
            <span key="e" className="text-xs text-ink-muted">
              {new Date(p.id ? (p as PlanCityPrice & { effectiveFrom?: string }).effectiveFrom ?? '' : '').toLocaleDateString?.('en-IN', { day: '2-digit', month: 'short' }) ?? '—'}
            </span>,
            isEditing ? (
              <div key="a" className="flex gap-1">
                <Button onClick={() => saveEdit(p)} disabled={busy}>Save</Button>
                <Button variant="ghost" onClick={() => setEditingId(null)}>Cancel</Button>
              </div>
            ) : (
              <div key="a" className="flex gap-1">
                <Button
                  variant="ghost"
                  onClick={() => {
                    setEditingId(p.id);
                    setEditMonthly(String(p.monthlyPricePaise / 100));
                    setEditDeposit(String(p.depositPaise / 100));
                  }}
                >
                  Edit
                </Button>
                <Button variant="danger" onClick={() => onRemove(p.id)} disabled={busy}>Remove</Button>
              </div>
            ),
          ];
        })}
      />

      <div className="mt-4 grid grid-cols-5 gap-2 items-end">
        <Field label="City">
          <select value={draftCity} onChange={(e) => setDraftCity(e.target.value)} className={inputCls}>
            {cities.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </Field>
        <Field label="Plan">
          <select value={draftPlan} onChange={(e) => setDraftPlan(e.target.value)} className={inputCls}>
            {plans.map((p) => (
              <option key={p.id} value={p.id}>{p.name} ({p.durationDays}d)</option>
            ))}
          </select>
        </Field>
        <Field label="Monthly (₹)">
          <input
            type="number"
            value={draftMonthly}
            onChange={(e) => setDraftMonthly(e.target.value)}
            className={inputCls}
            placeholder="599"
          />
        </Field>
        <Field label="Deposit (₹)">
          <input
            type="number"
            value={draftDeposit}
            onChange={(e) => setDraftDeposit(e.target.value)}
            className={inputCls}
            placeholder="1500"
          />
        </Field>
        <Button onClick={add} disabled={busy || !draftMonthly || !draftDeposit}>+ Add / Update</Button>
      </div>
    </Card>
  );
}
