'use client';

import { useEffect, useMemo, useState } from 'react';
import { Shell } from '../../components/Shell';
import {
  Button,
  Card,
  Drawer,
  EmptyState,
  FormField,
  Input,
  Pill,
  Select,
  Textarea,
} from '../../components/UI';
import { api, apiErrorMessage, assetUrl, paiseToInr } from '../../lib/api';

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
  effectiveFrom?: string;
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

// Backend requires slug to match ^[a-z0-9-]+$ — strip everything else, collapse
// whitespace to single dashes, and lowercase. Empty result is fine; the API
// auto-generates from `name` when slug is omitted.
function normalizeSlug(s: string): string {
  return s
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

type FormState = {
  name: string;
  slug: string;
  kind: Kind;
  capacityLitres: number;
  technology: string;
  mounting: Mounting;
  description: string;
  imageUrl: string;
  warrantyMonths: number;
  isActive: boolean;
  // Quick-pricing for first row — only used when CREATING a product.
  priceCityId: string;
  pricePlanId: string;
  priceMonthly: string;
  priceDeposit: string;
};

const EMPTY_FORM: FormState = {
  name: '',
  slug: '',
  kind: 'HOME',
  capacityLitres: 7,
  technology: 'RO+UV',
  mounting: 'COUNTERTOP',
  description: '',
  imageUrl: '',
  warrantyMonths: 12,
  isActive: true,
  priceCityId: '',
  pricePlanId: '',
  priceMonthly: '',
  priceDeposit: '',
};

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[] | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [filter, setFilter] = useState<'ALL' | Kind>('ALL');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
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
      imageUrl: p.imageUrl ?? '',
      warrantyMonths: p.warrantyMonths,
      isActive: p.isActive,
      priceCityId: '',
      pricePlanId: '',
      priceMonthly: '',
      priceDeposit: '',
    });
    setShowForm(true);
    setErr(null);
  }

  // Upload a local file. Returns the relative URL on success.
  async function uploadProductImage(file: File): Promise<string> {
    const fd = new FormData();
    fd.append('file', file);
    const r = await api.post<{ data: { url: string } }>('/admin/uploads/products', fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return r.data.data.url;
  }

  async function submitForm() {
    setBusy(true); setErr(null);
    try {
      const payload: Record<string, unknown> = {
        name: form.name.trim(),
        kind: form.kind,
        capacityLitres: Number(form.capacityLitres),
        technology: form.technology,
        mounting: form.mounting,
        description: form.description.trim(),
        warrantyMonths: Number(form.warrantyMonths),
        isActive: form.isActive,
      };
      if (form.imageUrl.trim()) payload.imageUrl = form.imageUrl.trim();
      // Defensive — re-normalise so paste/autofill can't slip past the onChange.
      const cleanSlug = normalizeSlug(form.slug);
      if (cleanSlug.length >= 2) payload.slug = cleanSlug;

      let createdId: string | null = null;
      if (editingId) {
        await api.patch(`/admin/products/${editingId}`, payload);
        setFlash('Product updated');
      } else {
        const created = await api.post<{ data: { id: string } }>('/admin/products', payload);
        createdId = created.data.data.id;
        setFlash('Product created');
      }

      // If creating + the user filled the quick-price section, upsert the
      // first price row in the same submit so the product is immediately
      // bookable.
      if (createdId && form.priceCityId && form.pricePlanId) {
        const monthly = Math.round(Number(form.priceMonthly) * 100);
        const deposit = Math.round(Number(form.priceDeposit) * 100);
        if (Number.isFinite(monthly) && monthly > 0 && Number.isFinite(deposit) && deposit >= 0) {
          try {
            await api.post(`/admin/products/${createdId}/pricing`, {
              cityId: form.priceCityId,
              planId: form.pricePlanId,
              monthlyPricePaise: monthly,
              depositPaise: deposit,
            });
            setFlash('Product + first price created');
          } catch (e) {
            // Surface but don't block — product was created.
            setErr('Product saved but first price failed: ' + apiErrorMessage(e));
          }
        }
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
    if (!confirm(p.isActive ? `Disable "${p.name}"?` : `Enable "${p.name}"?`)) return;
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
    if (!confirm('Remove this price?')) return;
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

  const formValid = form.name.trim().length >= 2 && form.description.trim().length >= 10;

  return (
    <Shell title="Products & pricing" eyebrow="Catalog">
      {/* Toolbar — filter pills on the left, prominent Add button on the right */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div className="flex items-center gap-2 flex-wrap">
          {(['ALL', 'HOME', 'COMMERCIAL'] as const).map((k) => {
            const active = filter === k;
            return (
              <button
                key={k}
                onClick={() => setFilter(k)}
                className={
                  'px-4 py-2 rounded-xl text-[13px] font-bold transition-all border ' +
                  (active
                    ? 'bg-ink text-canvas border-ink shadow-soft'
                    : 'bg-white text-ink-soft border-line hover:border-line-strong hover:bg-surface-warm')
                }
              >
                {k === 'ALL' ? 'All products' : k === 'HOME' ? 'Home' : 'Commercial'}
              </button>
            );
          })}
          {products ? (
            <span className="text-[12px] text-ink-muted ml-2 font-bold tabular-nums">
              {visible.length} {filter === 'ALL' ? 'total' : filter.toLowerCase()}
            </span>
          ) : null}
        </div>

        {/* Big, unmissable primary action */}
        <button
          onClick={startCreate}
          className="inline-flex items-center gap-2 h-11 px-5 rounded-xl text-sm font-extrabold text-white shadow-glow transition-all hover:opacity-95"
          style={{ backgroundImage: 'linear-gradient(135deg, #23BAFB, #66D9FF)' }}
        >
          <span className="text-lg leading-none">＋</span>
          <span>Add product</span>
        </button>
      </div>

      {flash ? (
        <div className="mb-4 px-4 py-2.5 rounded-xl bg-success-soft border border-success/30 text-success text-sm font-bold flex justify-between">
          <span>✓ {flash}</span>
          <button onClick={() => setFlash(null)} aria-label="Dismiss">✕</button>
        </div>
      ) : null}
      {err ? (
        <div className="mb-4 px-4 py-2.5 rounded-xl bg-danger-soft border border-danger/30 text-danger text-sm font-bold flex justify-between">
          <span>{err}</span>
          <button onClick={() => setErr(null)} aria-label="Dismiss">✕</button>
        </div>
      ) : null}

      {/* Product grid */}
      {!products ? (
        <Card><div className="text-ink-muted text-sm">Loading products…</div></Card>
      ) : visible.length === 0 ? (
        <EmptyState
          title="No products in this filter"
          description="Add a product to get the catalog started."
          action={
            <Button onClick={startCreate} leadingIcon={<span className="text-lg leading-none">＋</span>}>
              Add product
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {visible.map((p) => (
            <Card key={p.id} padding="md" variant={p.isActive ? 'plain' : 'tinted'}>
              {/* Product image — shown when set, falls back to gradient hero */}
              <div
                className="-m-5 mb-3 aspect-[16/9] rounded-t-3xl overflow-hidden grid place-items-center"
                style={{
                  backgroundImage: p.imageUrl
                    ? undefined
                    : 'linear-gradient(135deg, #E1F6FE, #E7EFFE)',
                }}
              >
                {p.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={assetUrl(p.imageUrl)}
                    alt={p.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="text-4xl">💧</div>
                )}
              </div>

              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Pill tone={p.kind === 'HOME' ? 'accent' : 'ink'} size="sm">{p.kind}</Pill>
                    {p.isActive ? (
                      <Pill tone="success" size="sm" dot>Active</Pill>
                    ) : (
                      <Pill tone="danger" size="sm" dot>Disabled</Pill>
                    )}
                  </div>
                  <h3 className="font-extrabold text-ink text-base mt-2 leading-snug">{p.name}</h3>
                  <div className="text-[11px] text-ink-muted tabular-nums">/{p.slug}</div>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-3 gap-2 text-[11px]">
                <Spec label="Capacity" value={`${p.capacityLitres} L`} />
                <Spec label="Tech" value={p.technology} />
                <Spec label="Warranty" value={`${p.warrantyMonths} mo`} />
              </div>

              <p className="mt-3 text-[12px] text-ink-soft leading-relaxed line-clamp-2">{p.description}</p>

              <div className="mt-3 flex items-center justify-between text-[11px] text-ink-muted">
                <span className="font-bold">
                  {p.prices.length === 0
                    ? 'No pricing yet'
                    : `${p.prices.length} price row${p.prices.length === 1 ? '' : 's'}`}
                </span>
                {p._count ? (
                  <span>
                    {p._count.subscriptions} subs · {p._count.bookings} bookings
                  </span>
                ) : null}
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => setExpanded(expanded === p.id ? null : p.id)}>
                  {expanded === p.id ? 'Hide pricing' : 'Manage pricing'}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => startEdit(p)}>Edit</Button>
                <Button
                  size="sm"
                  variant={p.isActive ? 'outline' : 'soft'}
                  onClick={() => toggleActive(p)}
                  disabled={busy}
                >
                  {p.isActive ? 'Disable' : 'Enable'}
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

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

      {/* Drawer-based product form */}
      <Drawer
        open={showForm}
        onClose={() => { setShowForm(false); setEditingId(null); }}
        title={editingId ? 'Edit product' : 'New product'}
        width="wide"
      >
        {err ? (
          <div className="mb-4 px-4 py-2.5 rounded-xl bg-danger-soft border border-danger/30 text-danger text-sm font-bold">{err}</div>
        ) : null}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField label="Name" required>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="AquaPure 7L" />
          </FormField>
          <FormField
            label="Slug"
            hint={editingId ? 'URLs break if changed. Lowercase, digits, dashes only.' : 'Leave blank to auto-generate from name. Lowercase, digits, dashes only.'}
          >
            <Input
              value={form.slug}
              onChange={(e) => setForm({ ...form, slug: normalizeSlug(e.target.value) })}
              placeholder="aquapure-7l"
            />
          </FormField>

          <FormField label="Use case" required>
            <Select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as Kind })}>
              <option value="HOME">Home use</option>
              <option value="COMMERCIAL">Commercial</option>
            </Select>
          </FormField>
          <FormField label="Capacity (L)" required>
            <Input
              type="number"
              value={form.capacityLitres}
              onChange={(e) => setForm({ ...form, capacityLitres: Number(e.target.value) })}
              min={1}
              max={1000}
            />
          </FormField>

          <FormField label="Technology" required>
            <Select value={form.technology} onChange={(e) => setForm({ ...form, technology: e.target.value })}>
              {TECH_OPTIONS.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
              <option value="">Custom (type below)</option>
            </Select>
            {form.technology === '' ? (
              <Input
                className="mt-2"
                placeholder="e.g. RO+UV+Copper"
                onChange={(e) => setForm({ ...form, technology: e.target.value })}
              />
            ) : null}
          </FormField>
          <FormField label="Mounting" required>
            <Select value={form.mounting} onChange={(e) => setForm({ ...form, mounting: e.target.value as Mounting })}>
              <option value="WALL">Wall mount</option>
              <option value="COUNTERTOP">Countertop</option>
              <option value="UNDER_SINK">Under sink</option>
            </Select>
          </FormField>

          <FormField label="Warranty (months)">
            <Input
              type="number"
              value={form.warrantyMonths}
              onChange={(e) => setForm({ ...form, warrantyMonths: Number(e.target.value) })}
              min={0}
              max={120}
            />
          </FormField>
          <div className="md:col-span-2">
            <FormField label="Product image" hint="Upload from your computer or paste a URL — at most 8 MB.">
              <ProductImagePicker
                value={form.imageUrl}
                onChange={(v) => setForm({ ...form, imageUrl: v })}
                upload={uploadProductImage}
              />
            </FormField>
          </div>

          <div className="md:col-span-2">
            <FormField label="Description" required hint="At least 10 characters. Shown on Product Detail in customer app.">
              <Textarea
                rows={4}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Compact 7-litre purifier with RO+UV+UF for borewell or municipal water…"
              />
            </FormField>
          </div>

          <div className="md:col-span-2">
            <label className="inline-flex items-center gap-2 text-sm font-semibold text-ink">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                className="h-4 w-4 accent-current"
                style={{ accentColor: '#23BAFB' }}
              />
              Active — visible to customers
            </label>
          </div>
        </div>

        {/* First-price block — visible only on Create. After save, more
            (city × plan) rows can be added via Manage pricing on the card. */}
        {!editingId ? (
          <div className="mt-6 rounded-2xl border border-line bg-surface-warm/50 p-5">
            <div className="flex items-baseline justify-between flex-wrap gap-2">
              <div>
                <div
                  className="font-bold uppercase"
                  style={{ color: '#657081', fontSize: 11, letterSpacing: '0.18em' }}
                >
                  First price (optional)
                </div>
                <div className="text-sm text-ink-soft mt-1">
                  Set one (city × plan) price now so the product is bookable. You can add more pricing combos later.
                </div>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField label="City">
                <Select
                  value={form.priceCityId}
                  onChange={(e) => setForm({ ...form, priceCityId: e.target.value })}
                >
                  <option value="">Select a city…</option>
                  {cities.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                      {c.isServiceable ? '' : ' (not serviceable)'}
                    </option>
                  ))}
                </Select>
              </FormField>
              <FormField label="Plan">
                <Select
                  value={form.pricePlanId}
                  onChange={(e) => setForm({ ...form, pricePlanId: e.target.value })}
                >
                  <option value="">Select a plan…</option>
                  {plans.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} — {p.durationDays}d
                    </option>
                  ))}
                </Select>
              </FormField>
              <FormField label="Monthly price (₹)" hint="Billed every cycle">
                <Input
                  type="number"
                  value={form.priceMonthly}
                  onChange={(e) => setForm({ ...form, priceMonthly: e.target.value })}
                  placeholder="599"
                  min={0}
                />
              </FormField>
              <FormField label="Refundable deposit (₹)">
                <Input
                  type="number"
                  value={form.priceDeposit}
                  onChange={(e) => setForm({ ...form, priceDeposit: e.target.value })}
                  placeholder="1500"
                  min={0}
                />
              </FormField>
            </div>
          </div>
        ) : null}

        <div className="flex justify-end gap-3 mt-6">
          <Button variant="ghost" onClick={() => { setShowForm(false); setEditingId(null); }} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={submitForm} disabled={busy || !formValid}>
            {busy ? 'Saving…' : editingId ? 'Save changes' : 'Create product'}
          </Button>
        </div>
      </Drawer>
    </Shell>
  );
}

function Spec({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-surface-warm border border-line px-2 py-1.5">
      <div className="text-[9px] uppercase tracking-wider text-ink-muted font-bold">{label}</div>
      <div className="text-[12px] font-extrabold text-ink truncate">{value}</div>
    </div>
  );
}

/* ============================================================
   ProductImagePicker — local upload + URL fallback + preview
   ============================================================ */
function ProductImagePicker({
  value,
  onChange,
  upload,
}: {
  value: string;
  onChange: (v: string) => void;
  upload: (file: File) => Promise<string>;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [filename, setFilename] = useState<string | null>(null);

  async function onPick(file: File) {
    setBusy(true);
    setErr(null);
    setFilename(file.name);
    try {
      const url = await upload(file);
      onChange(url);
    } catch (e) {
      setErr(apiErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  const preview = assetUrl(value);

  return (
    <div className="grid grid-cols-1 md:grid-cols-[160px_1fr] gap-4 items-start">
      {/* Preview tile */}
      <div className="rounded-2xl border border-line bg-white aspect-square grid place-items-center overflow-hidden">
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="text-center px-3">
            <div className="text-3xl text-ink-muted">🖼</div>
            <div className="text-[11px] text-ink-muted mt-1 font-bold">No image yet</div>
          </div>
        )}
      </div>

      <div className="min-w-0">
        {/* Upload from disk */}
        <label
          className={
            'block cursor-pointer rounded-2xl border-2 border-dashed px-4 py-4 text-center transition-colors ' +
            (busy ? 'border-line bg-surface-warm' : 'border-line hover:border-brand bg-white')
          }
        >
          <input
            type="file"
            accept="image/*"
            className="hidden"
            disabled={busy}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void onPick(f);
              // reset so the same file can be picked again
              e.target.value = '';
            }}
          />
          <div className="text-sm font-bold text-ink">
            {busy ? 'Uploading…' : 'Click to upload from your computer'}
          </div>
          <div className="text-[11px] text-ink-muted mt-1">
            PNG, JPG, WebP or PDF · up to 8 MB
          </div>
          {filename ? (
            <div className="text-[11px] font-bold mt-2 truncate" style={{ color: '#23BAFB' }}>
              {filename}
            </div>
          ) : null}
        </label>

        {/* URL fallback */}
        <div className="mt-3">
          <div
            className="font-bold uppercase mb-1.5"
            style={{ color: '#657081', fontSize: 10, letterSpacing: '0.16em' }}
          >
            Or paste a URL
          </div>
          <Input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="/uploads/products/abc.jpg or https://…"
          />
          {value ? (
            <button
              onClick={() => {
                onChange('');
                setFilename(null);
              }}
              className="mt-2 text-[11px] font-bold"
              style={{ color: '#E63737' }}
              type="button"
            >
              Clear image
            </button>
          ) : null}
        </div>

        {err ? (
          <div className="mt-2 text-[12px] font-bold" style={{ color: '#E63737' }}>
            {err}
          </div>
        ) : null}
      </div>
    </div>
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
  const [view, setView] = useState<'list' | 'matrix'>('matrix');
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
    <Card className="mt-6" variant="elevated">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-ink-muted">Pricing manager</div>
          <h2 className="font-extrabold text-lg mt-0.5">{product.name}</h2>
          <p className="text-[12px] text-ink-muted mt-0.5">
            {view === 'matrix'
              ? 'Cities × plans matrix — edit cells inline, then Save changes commits all dirty rows.'
              : 'One row per (city × plan). Adding a duplicate combo updates the existing price.'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div
            className="inline-flex p-1 rounded-xl border border-line bg-surface-warm"
            role="tablist"
          >
            {(['matrix', 'list'] as const).map((v) => (
              <button
                key={v}
                role="tab"
                aria-selected={view === v}
                onClick={() => setView(v)}
                className={
                  'px-3 py-1.5 rounded-lg text-xs font-bold capitalize transition-all ' +
                  (view === v ? 'bg-white shadow-soft text-ink' : 'text-ink-muted hover:text-ink')
                }
              >
                {v}
              </button>
            ))}
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>Close</Button>
        </div>
      </div>

      {view === 'matrix' ? (
        <PricingMatrix
          product={product}
          plans={plans}
          cities={cities}
          onUpsert={onUpsert}
          busy={busy}
        />
      ) : null}

      {view === 'list' ? (
      <>
      <div className="rounded-2xl bg-white border border-line overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-surface-warm">
              <th className="text-left text-[11px] font-bold uppercase tracking-wider text-ink-muted px-4 py-3">City</th>
              <th className="text-left text-[11px] font-bold uppercase tracking-wider text-ink-muted px-4 py-3">Plan</th>
              <th className="text-left text-[11px] font-bold uppercase tracking-wider text-ink-muted px-4 py-3">Monthly</th>
              <th className="text-left text-[11px] font-bold uppercase tracking-wider text-ink-muted px-4 py-3">Deposit</th>
              <th className="text-left text-[11px] font-bold uppercase tracking-wider text-ink-muted px-4 py-3">Effective</th>
              <th className="text-left text-[11px] font-bold uppercase tracking-wider text-ink-muted px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {product.prices.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center text-ink-muted py-10 text-sm">
                  No pricing yet. Add the first row below.
                </td>
              </tr>
            ) : (
              product.prices.map((p, i) => {
                const isEditing = editingId === p.id;
                return (
                  <tr key={p.id} className={`border-t border-line/70 ${i % 2 === 1 ? 'bg-surface-warm/30' : ''}`}>
                    <td className="px-4 py-3 font-bold">{p.city?.name}</td>
                    <td className="px-4 py-3">
                      {p.plan?.name}{' '}
                      <span className="text-ink-muted text-[11px]">({p.plan?.durationDays}d)</span>
                    </td>
                    <td className="px-4 py-3">
                      {isEditing ? (
                        <Input type="number" value={editMonthly} onChange={(e) => setEditMonthly(e.target.value)} className="w-28" />
                      ) : (
                        <span className="font-extrabold tabular-nums">{paiseToInr(p.monthlyPricePaise)}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {isEditing ? (
                        <Input type="number" value={editDeposit} onChange={(e) => setEditDeposit(e.target.value)} className="w-28" />
                      ) : (
                        <span className="tabular-nums">{paiseToInr(p.depositPaise)}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-[12px] text-ink-muted">
                      {p.effectiveFrom
                        ? new Date(p.effectiveFrom).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
                        : '—'}
                    </td>
                    <td className="px-4 py-3">
                      {isEditing ? (
                        <div className="flex gap-1">
                          <Button size="sm" onClick={() => saveEdit(p)} disabled={busy}>Save</Button>
                          <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>Cancel</Button>
                        </div>
                      ) : (
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setEditingId(p.id);
                              setEditMonthly(String(p.monthlyPricePaise / 100));
                              setEditDeposit(String(p.depositPaise / 100));
                            }}
                          >
                            Edit
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => onRemove(p.id)} disabled={busy}>
                            Remove
                          </Button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-5 grid grid-cols-1 md:grid-cols-[1fr_1fr_1fr_1fr_auto] gap-3 items-end">
        <FormField label="City">
          <Select value={draftCity} onChange={(e) => setDraftCity(e.target.value)}>
            {cities.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </Select>
        </FormField>
        <FormField label="Plan">
          <Select value={draftPlan} onChange={(e) => setDraftPlan(e.target.value)}>
            {plans.map((p) => (
              <option key={p.id} value={p.id}>{p.name} ({p.durationDays}d)</option>
            ))}
          </Select>
        </FormField>
        <FormField label="Monthly (₹)">
          <Input type="number" value={draftMonthly} onChange={(e) => setDraftMonthly(e.target.value)} placeholder="599" />
        </FormField>
        <FormField label="Deposit (₹)">
          <Input type="number" value={draftDeposit} onChange={(e) => setDraftDeposit(e.target.value)} placeholder="1500" />
        </FormField>
        <Button
          onClick={add}
          disabled={busy || !draftMonthly || !draftDeposit}
          leadingIcon={<span className="text-base leading-none">＋</span>}
        >
          Add / update
        </Button>
      </div>
      </>
      ) : null}
    </Card>
  );
}

/* ============================================================
   PricingMatrix — cities-by-plans grid with batch save.
   Rows = plans (sorted shortest duration first).
   Cols = cities (only the ones returned by /cities — serviceable).
   Each cell shows two compact number inputs: monthly + deposit (in ₹).
   Dirty cells get a coloured outline; "Save N changes" iterates the
   dirty set and upserts one at a time. Faster than list view when
   onboarding a new city or repricing the whole product.
   ============================================================ */
type CellState = { monthlyRupees: string; depositRupees: string };
type CellMap = Record<string, CellState>;
const cellKey = (planId: string, cityId: string) => `${planId}|${cityId}`;

function PricingMatrix({
  product,
  plans,
  cities,
  onUpsert,
  busy,
}: {
  product: Product;
  plans: Plan[];
  cities: City[];
  onUpsert: (body: { planId: string; cityId: string; monthlyPricePaise: number; depositPaise: number }) => Promise<void>;
  busy: boolean;
}) {
  // Seed both `initial` (immutable baseline) and `cells` (editable) from the
  // product's current PlanCityPrice rows. Dirty detection compares the two.
  const seed = useMemo(() => {
    const map: CellMap = {};
    for (const p of product.prices) {
      map[cellKey(p.planId, p.cityId)] = {
        monthlyRupees: String(Math.round(p.monthlyPricePaise / 100)),
        depositRupees: String(Math.round(p.depositPaise / 100)),
      };
    }
    return map;
  }, [product.prices]);

  const [cells, setCells] = useState<CellMap>(seed);
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);

  // Re-seed when the underlying product reloads (e.g. after a save).
  useEffect(() => {
    setCells(seed);
  }, [seed]);

  const sortedPlans = useMemo(() => [...plans].sort((a, b) => a.durationDays - b.durationDays), [plans]);
  const sortedCities = useMemo(() => [...cities].sort((a, b) => a.name.localeCompare(b.name)), [cities]);

  function setCell(planId: string, cityId: string, patch: Partial<CellState>) {
    setCells((prev) => {
      const k = cellKey(planId, cityId);
      const existing = prev[k] ?? { monthlyRupees: '', depositRupees: '' };
      return { ...prev, [k]: { ...existing, ...patch } };
    });
  }

  function isDirty(planId: string, cityId: string): boolean {
    const k = cellKey(planId, cityId);
    const cur = cells[k];
    const base = seed[k];
    if (!cur && !base) return false;
    if (!cur) return false;
    if (!base) {
      // Newly entered — only dirty if at least one field has a value
      return cur.monthlyRupees.trim() !== '' || cur.depositRupees.trim() !== '';
    }
    return (
      (cur.monthlyRupees ?? '') !== (base.monthlyRupees ?? '') ||
      (cur.depositRupees ?? '') !== (base.depositRupees ?? '')
    );
  }

  function cellValid(c: CellState | undefined): boolean {
    if (!c) return false;
    const m = Number(c.monthlyRupees);
    const d = Number(c.depositRupees);
    return Number.isFinite(m) && m >= 0 && Number.isFinite(d) && d >= 0
      && c.monthlyRupees.trim() !== '' && c.depositRupees.trim() !== '';
  }

  const dirtyKeys = useMemo(() => {
    const out: { planId: string; cityId: string }[] = [];
    for (const plan of sortedPlans) {
      for (const city of sortedCities) {
        if (isDirty(plan.id, city.id)) out.push({ planId: plan.id, cityId: city.id });
      }
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cells, seed, sortedPlans, sortedCities]);

  // Bulk-fill a column (city) by copying its first non-empty cell down.
  function fillCityFromFirst(cityId: string) {
    let src: CellState | undefined;
    for (const plan of sortedPlans) {
      const k = cellKey(plan.id, cityId);
      const c = cells[k];
      if (c && (c.monthlyRupees || c.depositRupees)) {
        src = c;
        break;
      }
    }
    if (!src) return;
    setCells((prev) => {
      const next = { ...prev };
      for (const plan of sortedPlans) {
        next[cellKey(plan.id, cityId)] = { ...src! };
      }
      return next;
    });
  }

  async function saveAll() {
    const invalid = dirtyKeys.filter(({ planId, cityId }) => !cellValid(cells[cellKey(planId, cityId)]));
    if (invalid.length > 0) {
      alert(`${invalid.length} dirty cell(s) have invalid values. Both monthly and deposit must be ≥ 0.`);
      return;
    }
    if (dirtyKeys.length === 0) return;
    setSaving(true);
    setProgress({ done: 0, total: dirtyKeys.length });
    let i = 0;
    try {
      for (const { planId, cityId } of dirtyKeys) {
        const c = cells[cellKey(planId, cityId)]!;
        const monthly = Math.round(Number(c.monthlyRupees) * 100);
        const deposit = Math.round(Number(c.depositRupees) * 100);
        await onUpsert({ planId, cityId, monthlyPricePaise: monthly, depositPaise: deposit });
        i += 1;
        setProgress({ done: i, total: dirtyKeys.length });
      }
    } finally {
      setSaving(false);
      setProgress(null);
    }
  }

  function reset() {
    setCells(seed);
  }

  if (sortedCities.length === 0) {
    return (
      <div className="rounded-2xl border border-line bg-surface-warm/40 p-8 text-center">
        <div className="font-bold text-ink">No serviceable cities</div>
        <div className="text-[12px] text-ink-muted mt-1">
          Add cities (and mark them serviceable) before setting per-city pricing.
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="rounded-2xl border border-line bg-white overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-surface-warm">
              <th className="text-left text-[11px] font-bold uppercase tracking-wider text-ink-muted px-3 py-2 sticky left-0 bg-surface-warm">
                Plan ↓ · City →
              </th>
              {sortedCities.map((c) => (
                <th
                  key={c.id}
                  className="text-left text-[11px] font-bold uppercase tracking-wider text-ink-muted px-3 py-2 border-l border-line/70"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div>{c.name}</div>
                      <div className="text-[10px] font-semibold text-ink-muted/80">{c.state}</div>
                    </div>
                    <button
                      type="button"
                      className="text-[10px] font-semibold px-1.5 py-0.5 rounded border border-line text-ink-muted hover:bg-surface-warm"
                      onClick={() => fillCityFromFirst(c.id)}
                      title="Copy this city's first non-empty cell to every plan row"
                    >
                      fill ↓
                    </button>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedPlans.map((plan, rowIdx) => (
              <tr
                key={plan.id}
                className={`border-t border-line/70 ${rowIdx % 2 === 1 ? 'bg-surface-warm/30' : ''}`}
              >
                <td className="px-3 py-2 sticky left-0 bg-inherit">
                  <div className="font-bold">{plan.name}</div>
                  <div className="text-[11px] text-ink-muted">{plan.durationDays}d</div>
                </td>
                {sortedCities.map((city) => {
                  const k = cellKey(plan.id, city.id);
                  const c = cells[k];
                  const dirty = isDirty(plan.id, city.id);
                  const monthly = c?.monthlyRupees ?? '';
                  const deposit = c?.depositRupees ?? '';
                  const hasData = monthly !== '' || deposit !== '';
                  return (
                    <td
                      key={city.id}
                      className={`px-2 py-2 border-l border-line/70 ${dirty ? 'bg-brand-soft/40' : ''}`}
                    >
                      <div className="flex flex-col gap-1.5 min-w-[150px]">
                        <label className="flex items-center gap-1">
                          <span className="text-[10px] font-bold uppercase text-ink-muted w-12">Month</span>
                          <span className="text-ink-muted text-[12px]">₹</span>
                          <input
                            type="number"
                            inputMode="numeric"
                            value={monthly}
                            placeholder="—"
                            disabled={saving || busy}
                            onChange={(e) => setCell(plan.id, city.id, { monthlyRupees: e.target.value })}
                            className={
                              'w-full px-2 py-1 rounded-md border text-sm font-bold tabular-nums focus:outline-none ' +
                              (dirty ? 'border-brand bg-white' : 'border-line bg-white')
                            }
                          />
                        </label>
                        <label className="flex items-center gap-1">
                          <span className="text-[10px] font-bold uppercase text-ink-muted w-12">Dep</span>
                          <span className="text-ink-muted text-[12px]">₹</span>
                          <input
                            type="number"
                            inputMode="numeric"
                            value={deposit}
                            placeholder="—"
                            disabled={saving || busy}
                            onChange={(e) => setCell(plan.id, city.id, { depositRupees: e.target.value })}
                            className={
                              'w-full px-2 py-1 rounded-md border text-sm tabular-nums focus:outline-none ' +
                              (dirty ? 'border-brand bg-white' : 'border-line bg-white')
                            }
                          />
                        </label>
                        {dirty ? (
                          <span className="text-[10px] font-bold text-brand">● unsaved</span>
                        ) : !hasData ? (
                          <span className="text-[10px] text-ink-muted">no price set</span>
                        ) : null}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3 flex-wrap">
        <div className="text-[12px] text-ink-muted">
          {dirtyKeys.length === 0
            ? 'No changes yet.'
            : `${dirtyKeys.length} cell${dirtyKeys.length === 1 ? '' : 's'} pending save.`}
          {progress ? ` · Saving ${progress.done}/${progress.total}…` : ''}
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={reset} disabled={saving || dirtyKeys.length === 0}>
            Reset
          </Button>
          <Button
            onClick={() => void saveAll()}
            disabled={saving || busy || dirtyKeys.length === 0}
            leadingIcon={<span className="text-base leading-none">✓</span>}
          >
            {saving ? `Saving ${progress?.done}/${progress?.total}…` : `Save ${dirtyKeys.length} change${dirtyKeys.length === 1 ? '' : 's'}`}
          </Button>
        </div>
      </div>
    </div>
  );
}
