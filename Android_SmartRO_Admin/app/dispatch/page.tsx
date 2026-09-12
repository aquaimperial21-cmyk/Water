'use client';

// Device dispatch queue — ops view of subscriptions still awaiting a
// physical purifier, paired against warehouse devices of the matching
// product. One-click allocate calls POST /devices/admin/:serial/allocate
// which atomically binds the device to the subscription, issues a token,
// closes the open INSTALL job, and notifies the customer.

import { useCallback, useEffect, useState } from 'react';
import { Shell } from '../../components/Shell';
import { Badge, Button, Card, Select, Stat, Table } from '../../components/UI';
import { api, apiErrorMessage, formatDate } from '../../lib/api';

interface DispatchSub {
  id: string;
  productId: string;
  status: string;
  startedAt: string;
  user?: { id: string; fullName?: string | null; phone?: string };
  booking?: { id: string; city?: { name: string }; installationSlot?: string | null };
  product?: { id: string; name: string; capacityLitres: number };
  plan?: { id: string; name: string };
}
interface WarehouseDevice {
  id: string;
  serial: string;
  qr: string;
  productId: string;
  warehouse: string;
}
interface DispatchResponse {
  byProduct: Record<string, { subs: DispatchSub[]; devices: WarehouseDevice[] }>;
  subsAwaiting: number;
  devicesAvailable: number;
}

export default function DispatchPage() {
  const [data, setData] = useState<DispatchResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Per-subscription dropdown selection of the device serial to allocate.
  const [pick, setPick] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await api.get<{ data: DispatchResponse }>('/devices/admin/dispatch');
      setData(r.data.data);
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function allocate(sub: DispatchSub) {
    const serial = pick[sub.id];
    if (!serial) {
      setToast({ tone: 'danger', text: 'Pick a device first' });
      return;
    }
    setBusyId(sub.id);
    setToast(null);
    try {
      await api.post(`/devices/admin/${encodeURIComponent(serial)}/allocate`, {
        subscriptionId: sub.id,
        issueToken: true,
      });
      setToast({ tone: 'success', text: `Allocated ${serial} → ${sub.user?.fullName ?? sub.user?.phone ?? sub.id.slice(0, 8)}` });
      await load();
    } catch (e) {
      setToast({ tone: 'danger', text: apiErrorMessage(e) });
    } finally {
      setBusyId(null);
    }
  }

  const products = data ? Object.keys(data.byProduct) : [];

  return (
    <Shell title="Device dispatch" eyebrow="Operations">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Stat
          label="Subscriptions awaiting device"
          value={data?.subsAwaiting ?? '—'}
          sub="Paid subscribers with no purifier yet paired"
        />
        <Stat
          label="Warehouse devices ready"
          value={data?.devicesAvailable ?? '—'}
          sub="Untagged units matching the awaiting products"
        />
        <Stat
          label="Matched product SKUs"
          value={products.length}
          sub="Distinct products in today's queue"
        />
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

      {error ? (
        <Card>
          <div className="text-sm font-semibold text-danger">{error}</div>
          <div className="mt-3">
            <Button variant="outline" size="sm" onClick={load}>
              Retry
            </Button>
          </div>
        </Card>
      ) : loading ? (
        <Card>
          <div className="text-ink-muted">Loading dispatch queue…</div>
        </Card>
      ) : products.length === 0 ? (
        <Card>
          <div className="text-center py-12">
            <div className="text-lg font-extrabold mb-1">Inbox zero</div>
            <div className="text-sm text-ink-muted">
              No subscriptions are waiting for a device. New paid bookings will show up here.
            </div>
          </div>
        </Card>
      ) : (
        <div className="space-y-6">
          {products.map((productId) => {
            const bucket = data!.byProduct[productId]!;
            const productName = bucket.subs[0]?.product?.name ?? productId.slice(0, 8);
            const capacity = bucket.subs[0]?.product?.capacityLitres;
            const usedSerials = new Set(Object.values(pick));
            return (
              <Card key={productId}>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <div className="text-eyebrow uppercase text-ink-muted">Product</div>
                    <div className="text-base font-extrabold mt-0.5">
                      {productName}
                      {capacity ? (
                        <span className="text-ink-muted font-semibold"> · {capacity} L</span>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Badge tone="info">{bucket.subs.length} awaiting</Badge>
                    <Badge tone={bucket.devices.length >= bucket.subs.length ? 'success' : 'warning'}>
                      {bucket.devices.length} warehouse
                    </Badge>
                  </div>
                </div>

                {bucket.devices.length < bucket.subs.length ? (
                  <div className="mb-3 px-3 py-2 rounded-lg text-xs font-semibold" style={{ backgroundColor: '#FEF2E2', color: '#9A5E0B' }}>
                    Only {bucket.devices.length} warehouse units available for {bucket.subs.length} bookings.
                    Request a transfer from the closest warehouse before assigning.
                  </div>
                ) : null}

                <Table
                  headers={['Customer', 'City', 'Plan', 'Booked', 'Slot', 'Device', '']}
                  empty="—"
                  rows={bucket.subs.map((s) => {
                    const selected = pick[s.id] ?? '';
                    const availableDevices = bucket.devices.filter(
                      (d) => d.serial === selected || !usedSerials.has(d.serial)
                    );
                    return [
                      <span key="c">
                        <div className="font-semibold">{s.user?.fullName ?? '—'}</div>
                        <div className="text-xs text-ink-muted">{s.user?.phone ?? ''}</div>
                      </span>,
                      s.booking?.city?.name ?? '—',
                      s.plan?.name ?? '—',
                      <span key="b" className="text-xs">{formatDate(s.startedAt)}</span>,
                      <span key="slot" className="text-xs">
                        {s.booking?.installationSlot
                          ? formatDate(s.booking.installationSlot)
                          : <span className="text-ink-muted">not set</span>}
                      </span>,
                      <Select
                        key="dev"
                        value={selected}
                        disabled={busyId === s.id || availableDevices.length === 0}
                        onChange={(e) => setPick((p) => ({ ...p, [s.id]: e.target.value }))}
                        style={{ minWidth: 200 }}
                      >
                        <option value="">
                          {availableDevices.length === 0 ? 'No warehouse devices' : 'Select serial…'}
                        </option>
                        {availableDevices.map((d) => (
                          <option key={d.id} value={d.serial}>
                            {d.serial} · {d.warehouse}
                          </option>
                        ))}
                      </Select>,
                      <Button
                        key="act"
                        size="sm"
                        variant="primary"
                        disabled={!pick[s.id] || busyId === s.id}
                        onClick={() => void allocate(s)}
                      >
                        {busyId === s.id ? 'Allocating…' : 'Allocate'}
                      </Button>,
                    ];
                  })}
                />
              </Card>
            );
          })}
        </div>
      )}

      <div className="mt-8">
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          {loading ? 'Refreshing…' : 'Refresh queue'}
        </Button>
      </div>
    </Shell>
  );
}
