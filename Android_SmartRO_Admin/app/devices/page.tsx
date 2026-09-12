'use client';

// Device fleet inventory — every Device row from /admin/devices.
//
//   • Add device(s) to the warehouse (bulk-create supported)
//   • Filter by status (Warehouse / Installed / In service / Returned / Retired)
//   • Edit warehouse + firmware + retire from the row's drawer
//   • Telemetry preview for INSTALLED units (TDS, filter life, usage, leak)
//   • Deallocate an INSTALLED unit → returns it to warehouse (token nulled)
//
// Pairs with /dispatch (assignment queue). Together these are the operations
// surfaces for the device-↔-user binding the rental product depends on.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Shell } from '../../components/Shell';
import {
  Badge,
  Button,
  Card,
  Drawer,
  FormField,
  Input,
  Select,
  Stat,
  Table,
} from '../../components/UI';
import { api, apiErrorMessage, formatDateTime } from '../../lib/api';

interface Product {
  id: string;
  name: string;
  capacityLitres: number;
}
interface Device {
  id: string;
  serial: string;
  qr: string;
  productId: string;
  product?: { id: string; name: string; capacityLitres: number };
  status: 'WAREHOUSE' | 'ALLOCATED' | 'INSTALLED' | 'IN_SERVICE' | 'RETURNED' | 'RETIRED';
  warehouse: string;
  firmwareVersion?: string | null;
  wifiSsid?: string | null;
  lastHeartbeatAt?: string | null;
  lastTdsPpm?: number | null;
  filterLifePct?: number | null;
  usageLitresTotal: number;
  leakDetectedAt?: string | null;
  deviceToken?: string | null;
  subscription?: {
    id: string;
    user?: { id: string; fullName?: string | null; phone?: string };
  } | null;
}

const ONLINE_WINDOW_MS = 90 * 60 * 1000;

const STATUS_OPTIONS = ['ALL', 'WAREHOUSE', 'INSTALLED', 'IN_SERVICE', 'RETURNED', 'RETIRED'] as const;
type StatusFilter = (typeof STATUS_OPTIONS)[number];

export default function DevicesPage() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<StatusFilter>('ALL');
  const [query, setQuery] = useState('');
  const [busySerial, setBusySerial] = useState<string | null>(null);
  const [toast, setToast] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<Device | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [d, p] = await Promise.all([
        api.get<{ data: Device[] }>('/admin/devices'),
        api.get<{ data: Product[] }>('/admin/products'),
      ]);
      setDevices(d.data.data);
      setProducts(p.data.data);
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function deallocate(serial: string) {
    const ok = window.confirm(
      `Deallocate ${serial}? This nulls the device token and releases the unit to the warehouse. The customer's subscription stays active but unpaired until a replacement is assigned.`
    );
    if (!ok) return;
    setBusySerial(serial);
    setToast(null);
    try {
      await api.post(`/devices/admin/${encodeURIComponent(serial)}/deallocate`, {
        reason: 'Ops UI deallocate',
      });
      setToast({ tone: 'success', text: `${serial} returned to warehouse` });
      await load();
    } catch (e) {
      setToast({ tone: 'danger', text: apiErrorMessage(e) });
    } finally {
      setBusySerial(null);
    }
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return devices.filter((d) => {
      if (filter !== 'ALL' && d.status !== filter) return false;
      if (!q) return true;
      const hay = [
        d.serial,
        d.qr,
        d.product?.name,
        d.warehouse,
        d.firmwareVersion,
        d.wifiSsid,
        d.subscription?.user?.fullName,
        d.subscription?.user?.phone,
        d.status,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }, [devices, filter, query]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { WAREHOUSE: 0, INSTALLED: 0, IN_SERVICE: 0, RETURNED: 0, RETIRED: 0 };
    devices.forEach((d) => {
      c[d.status] = (c[d.status] ?? 0) + 1;
    });
    return c;
  }, [devices]);

  const onlineInstalled = devices.filter(
    (d) =>
      d.status === 'INSTALLED' &&
      d.lastHeartbeatAt &&
      Date.now() - new Date(d.lastHeartbeatAt).getTime() < ONLINE_WINDOW_MS
  ).length;

  return (
    <Shell title="Device fleet" eyebrow="Operations · Inventory">
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
        <Stat label="Warehouse" value={counts.WAREHOUSE ?? 0} sub="Ready to allocate" />
        <Stat label="Installed" value={counts.INSTALLED ?? 0} sub="In customer homes" />
        <Stat label="Online" value={onlineInstalled} sub="Heartbeat ≤ 90 min ago" />
        <Stat label="Returned" value={counts.RETURNED ?? 0} sub="Awaiting inspection" />
        <Stat label="Retired" value={counts.RETIRED ?? 0} sub="End-of-life" />
      </div>

      {toast ? (
        <div
          className="mb-4 px-4 py-3 rounded-xl text-sm font-semibold"
          style={{
            backgroundColor: toast.tone === 'success' ? '#E7F9F2' : '#FCE9E9',
            color: toast.tone === 'success' ? '#0F7A4F' : '#9B2C2C',
          }}
        >
          {toast.text}
        </div>
      ) : null}

      <Card>
        <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
          <div className="flex gap-2 items-center flex-wrap">
            <div className="inline-flex p-1 rounded-xl border border-line bg-surface-warm">
              {STATUS_OPTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => setFilter(s)}
                  className={
                    'px-3 py-1.5 rounded-lg text-xs font-bold capitalize transition-all ' +
                    (filter === s ? 'bg-white shadow-soft text-ink' : 'text-ink-muted hover:text-ink')
                  }
                >
                  {s === 'ALL' ? 'All' : s.replace('_', ' ').toLowerCase()}
                  {s !== 'ALL' ? <span className="ml-1 text-ink-muted">{counts[s] ?? 0}</span> : null}
                </button>
              ))}
            </div>
            <Input
              placeholder="Search serial, customer, product…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              style={{ minWidth: 280 }}
            />
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={load} disabled={loading}>
              {loading ? 'Refreshing…' : 'Refresh'}
            </Button>
            <Button onClick={() => setShowAdd(true)} leadingIcon={<span className="text-base leading-none">＋</span>}>
              Add device
            </Button>
          </div>
        </div>

        {error ? (
          <div className="text-sm font-semibold text-danger py-6">{error}</div>
        ) : (
          <Table
            headers={['Serial', 'Product', 'Status', 'Customer', 'TDS', 'Filter', 'Heartbeat', '']}
            empty={loading ? 'Loading…' : 'No devices match that filter'}
            rows={filtered.map((d) => {
              const lastSeenMs = d.lastHeartbeatAt
                ? Date.now() - new Date(d.lastHeartbeatAt).getTime()
                : Infinity;
              const isOnline = d.status === 'INSTALLED' && lastSeenMs < ONLINE_WINDOW_MS;
              return [
                <span key="s">
                  <div className="font-bold tracking-wider">{d.serial}</div>
                  <div className="text-xs text-ink-muted">
                    {d.firmwareVersion ? `fw ${d.firmwareVersion}` : '—'}
                    {d.wifiSsid ? ` · ${d.wifiSsid}` : ''}
                  </div>
                </span>,
                <span key="p" className="text-xs">
                  <div>{d.product?.name ?? '—'}</div>
                  <div className="text-ink-muted">{d.warehouse}</div>
                </span>,
                <Badge key="st" tone={statusTone(d.status)}>
                  {d.status.replace('_', ' ')}
                </Badge>,
                d.subscription?.user ? (
                  <span key="c">
                    <div className="font-semibold text-xs">{d.subscription.user.fullName ?? '—'}</div>
                    <div className="text-xs text-ink-muted">{d.subscription.user.phone ?? ''}</div>
                  </span>
                ) : (
                  <span key="c" className="text-xs text-ink-muted">—</span>
                ),
                d.lastTdsPpm != null ? (
                  <span key="t" className="text-xs">
                    <span className="font-bold">{d.lastTdsPpm}</span>
                    <span className="text-ink-muted"> ppm</span>
                  </span>
                ) : (
                  <span key="t" className="text-xs text-ink-muted">—</span>
                ),
                d.filterLifePct != null ? (
                  <Badge
                    key="f"
                    tone={d.filterLifePct <= 15 ? 'warning' : d.filterLifePct <= 30 ? 'info' : 'success'}
                  >
                    {d.filterLifePct}%
                  </Badge>
                ) : (
                  <span key="f" className="text-xs text-ink-muted">—</span>
                ),
                <span key="h" className="text-xs">
                  {d.lastHeartbeatAt ? (
                    <>
                      <Badge tone={isOnline ? 'success' : 'warning'}>{isOnline ? 'Online' : 'Offline'}</Badge>
                      <div className="text-ink-muted mt-1">{formatDateTime(d.lastHeartbeatAt)}</div>
                    </>
                  ) : (
                    <Badge tone="info">Never</Badge>
                  )}
                  {d.leakDetectedAt ? (
                    <div className="mt-1">
                      <Badge tone="danger">Leak</Badge>
                    </div>
                  ) : null}
                </span>,
                <div key="a" className="flex gap-1">
                  <Button size="sm" variant="ghost" onClick={() => setEditing(d)}>
                    Edit
                  </Button>
                  {d.status === 'INSTALLED' ? (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busySerial === d.serial}
                      onClick={() => void deallocate(d.serial)}
                    >
                      {busySerial === d.serial ? '…' : 'Deallocate'}
                    </Button>
                  ) : null}
                </div>,
              ];
            })}
          />
        )}
      </Card>

      <AddDeviceDrawer
        open={showAdd}
        onClose={() => setShowAdd(false)}
        products={products}
        onSaved={async (created) => {
          setShowAdd(false);
          setToast({ tone: 'success', text: `${created} device${created === 1 ? '' : 's'} added to warehouse` });
          await load();
        }}
      />

      <EditDeviceDrawer
        device={editing}
        onClose={() => setEditing(null)}
        onSaved={async (msg) => {
          setEditing(null);
          setToast({ tone: 'success', text: msg });
          await load();
        }}
        onError={(text) => setToast({ tone: 'danger', text })}
      />
    </Shell>
  );
}

function statusTone(s: string): 'success' | 'warning' | 'danger' | 'info' | 'neutral' {
  if (s === 'INSTALLED') return 'success';
  if (s === 'WAREHOUSE') return 'info';
  if (s === 'IN_SERVICE') return 'warning';
  if (s === 'RETIRED') return 'danger';
  if (s === 'RETURNED') return 'warning';
  return 'neutral';
}

// ─────────────────────────── Add Device drawer ───────────────────────────

function AddDeviceDrawer({
  open,
  onClose,
  products,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  products: Product[];
  onSaved: (created: number) => Promise<void>;
}) {
  const [productId, setProductId] = useState('');
  const [warehouse, setWarehouse] = useState('Pune-W1');
  const [count, setCount] = useState('1');
  const [firmwareVersion, setFirmwareVersion] = useState('');
  const [customSerial, setCustomSerial] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (open && !productId && products[0]) setProductId(products[0].id);
    if (!open) {
      setErr(null);
      setCount('1');
      setCustomSerial('');
      setFirmwareVersion('');
    }
  }, [open, productId, products]);

  async function submit() {
    setErr(null);
    if (!productId) {
      setErr('Pick a product');
      return;
    }
    const n = Math.max(1, Math.min(50, parseInt(count, 10) || 1));
    setBusy(true);
    try {
      const body: Record<string, unknown> = {
        productId,
        warehouse,
        count: n,
      };
      if (n === 1 && customSerial.trim()) body.serial = customSerial.trim();
      if (firmwareVersion.trim()) body.firmwareVersion = firmwareVersion.trim();
      const r = await api.post<{ data: { created: { serial: string }[] } }>('/admin/devices', body);
      await onSaved(r.data.data.created.length);
    } catch (e) {
      setErr(apiErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Drawer open={open} onClose={onClose} title="Add device to warehouse" width="narrow">
      <div className="space-y-4">
        <FormField label="Product">
          <Select value={productId} onChange={(e) => setProductId(e.target.value)}>
            <option value="">Select a product…</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </FormField>

        <FormField label="Warehouse">
          <Input value={warehouse} onChange={(e) => setWarehouse(e.target.value)} placeholder="Pune-W1" />
        </FormField>

        <FormField label="Quantity (bulk-create)" hint="1–50 units at a time. Serials and QR codes auto-increment.">
          <Input
            type="number"
            min={1}
            max={50}
            value={count}
            onChange={(e) => setCount(e.target.value)}
          />
        </FormField>

        {parseInt(count, 10) === 1 ? (
          <FormField
            label="Custom serial (optional)"
            hint="Leave blank to auto-generate SR-<productCode>-<seq>."
          >
            <Input
              value={customSerial}
              onChange={(e) => setCustomSerial(e.target.value.toUpperCase())}
              placeholder="SR-AP-000200"
            />
          </FormField>
        ) : null}

        <FormField label="Firmware version (optional)">
          <Input
            value={firmwareVersion}
            onChange={(e) => setFirmwareVersion(e.target.value)}
            placeholder="1.4.2"
          />
        </FormField>

        {err ? (
          <div className="px-3 py-2 rounded-lg text-xs font-semibold" style={{ backgroundColor: '#FCE9E9', color: '#9B2C2C' }}>
            {err}
          </div>
        ) : null}

        <div className="flex gap-2 justify-end">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={() => void submit()} disabled={busy || !productId}>
            {busy ? 'Creating…' : `Add ${parseInt(count, 10) || 1} device${(parseInt(count, 10) || 1) === 1 ? '' : 's'}`}
          </Button>
        </div>
      </div>
    </Drawer>
  );
}

// ─────────────────────────── Edit Device drawer ───────────────────────────

function EditDeviceDrawer({
  device,
  onClose,
  onSaved,
  onError,
}: {
  device: Device | null;
  onClose: () => void;
  onSaved: (msg: string) => Promise<void>;
  onError: (msg: string) => void;
}) {
  const [warehouse, setWarehouse] = useState('');
  const [firmwareVersion, setFirmwareVersion] = useState('');
  const [qr, setQr] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (device) {
      setWarehouse(device.warehouse);
      setFirmwareVersion(device.firmwareVersion ?? '');
      setQr(device.qr);
    }
  }, [device]);

  if (!device) return null;

  async function saveBasic() {
    if (!device) return;
    setBusy(true);
    try {
      const patch: Record<string, unknown> = {};
      if (warehouse !== device.warehouse) patch.warehouse = warehouse;
      if (qr !== device.qr) patch.qr = qr;
      if ((firmwareVersion || null) !== (device.firmwareVersion || null)) patch.firmwareVersion = firmwareVersion;
      if (Object.keys(patch).length === 0) {
        await onSaved('No changes');
        return;
      }
      await api.patch(`/admin/devices/${encodeURIComponent(device.serial)}`, patch);
      await onSaved(`${device.serial} updated`);
    } catch (e) {
      onError(apiErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function retire() {
    if (!device) return;
    if (device.subscription) {
      onError('Deallocate the device before retiring it.');
      return;
    }
    if (!window.confirm(`Retire ${device.serial}? This is terminal — the unit can no longer be allocated.`)) return;
    setBusy(true);
    try {
      await api.patch(`/admin/devices/${encodeURIComponent(device.serial)}`, { status: 'RETIRED' });
      await onSaved(`${device.serial} retired`);
    } catch (e) {
      onError(apiErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Drawer open={Boolean(device)} onClose={onClose} title={device.serial} width="narrow">
      <div className="space-y-4">
        <div className="px-3 py-2 rounded-lg text-xs" style={{ backgroundColor: '#F4F1EA', color: '#3C4858' }}>
          <div className="font-bold">{device.product?.name ?? '—'}</div>
          <div className="text-ink-muted">
            Status: {device.status} · QR {device.qr}
          </div>
          {device.subscription?.user ? (
            <div className="text-ink-muted mt-1">
              Paired with {device.subscription.user.fullName ?? device.subscription.user.phone}
            </div>
          ) : null}
        </div>

        <FormField label="Warehouse">
          <Input value={warehouse} onChange={(e) => setWarehouse(e.target.value)} />
        </FormField>

        <FormField label="QR code">
          <Input value={qr} onChange={(e) => setQr(e.target.value.toUpperCase())} />
        </FormField>

        <FormField label="Firmware version">
          <Input value={firmwareVersion} onChange={(e) => setFirmwareVersion(e.target.value)} placeholder="1.4.2" />
        </FormField>

        <div className="flex gap-2 justify-end pt-2">
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
          <Button onClick={() => void saveBasic()} disabled={busy}>
            {busy ? 'Saving…' : 'Save changes'}
          </Button>
        </div>

        {device.status !== 'RETIRED' && !device.subscription ? (
          <div className="border-t border-line pt-4">
            <div className="text-eyebrow uppercase text-ink-muted text-xs font-bold mb-2">Danger zone</div>
            <Button variant="danger" size="sm" onClick={() => void retire()} disabled={busy}>
              Retire device
            </Button>
            <div className="text-[11px] text-ink-muted mt-1">
              Use when the unit is permanently end-of-life. Cannot be undone via the UI.
            </div>
          </div>
        ) : null}
      </div>
    </Drawer>
  );
}
