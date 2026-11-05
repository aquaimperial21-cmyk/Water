'use client';

// Technician visits: installs, services, filter changes, pickups. An install
// booked when no technician was free shows as Unassigned until one is picked
// here (PATCH /admin/jobs/:id, audited). Only ACTIVE technicians are offered.

import { useCallback, useEffect, useState } from 'react';
import { Shell } from '../../components/Shell';
import { Badge, Button, Card, Table } from '../../components/UI';
import { toast } from '../../components/Feedback';
import { api, apiErrorMessage, formatDateTime } from '../../lib/api';

interface Person { id: string; fullName?: string | null; phone?: string }
interface Tech { id: string; employeeCode: string; zone: string; status: string; user?: { fullName?: string | null } | null }
interface Job {
  id: string;
  type: string;
  status: string;
  scheduledFor: string;
  technicianId: string | null;
  technician: Tech | null;
  booking: { id: string; city?: { name: string } | null; user?: Person } | null;
  ticket: { id: string; category: string; user?: Person } | null;
}

type View = 'open' | 'unassigned' | 'all';
const VIEWS: { key: View; label: string }[] = [
  { key: 'open', label: 'Open' },
  { key: 'unassigned', label: 'Unassigned' },
  { key: 'all', label: 'All' },
];
const OPEN = ['SCHEDULED', 'EN_ROUTE', 'IN_PROGRESS'];

const techLabel = (t: Tech) => `${t.user?.fullName ?? t.employeeCode} · ${t.zone}`;

export default function Jobs() {
  const [view, setView] = useState<View>('open');
  const [jobs, setJobs] = useState<Job[]>([]);
  const [techs, setTechs] = useState<Tech[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [j, t] = await Promise.all([
        api.get(`/admin/jobs?view=${view}`).then((r) => r.data.data as Job[]),
        api.get('/admin/technicians').then((r) => r.data.data as Tech[]),
      ]);
      // Unassigned first; otherwise keep the server's date order.
      setJobs([...j].sort((a, b) => Number(a.technicianId !== null) - Number(b.technicianId !== null)));
      setTechs(t.filter((x) => x.status === 'ACTIVE'));
    } catch (e) {
      toast.error(apiErrorMessage(e), 'Could not load jobs');
    } finally {
      setLoading(false);
    }
  }, [view]);

  useEffect(() => {
    void load();
  }, [load]);

  async function assign(job: Job, technicianId: string) {
    if (!technicianId || technicianId === job.technicianId) return;
    setBusyId(job.id);
    try {
      await api.patch(`/admin/jobs/${job.id}`, { technicianId });
      const t = techs.find((x) => x.id === technicianId);
      toast.success(`${job.type} job assigned to ${t ? techLabel(t) : 'technician'}`, 'Technician assigned');
      await load();
    } catch (e) {
      toast.error(apiErrorMessage(e), 'Could not assign technician');
    } finally {
      setBusyId(null);
    }
  }

  const tone = (s: string) =>
    s === 'DONE' ? 'success' : s === 'CANCELLED' ? 'neutral' : s === 'SCHEDULED' ? 'warning' : 'info';

  const unassignedCount = jobs.filter((j) => !j.technicianId && OPEN.includes(j.status)).length;

  return (
    <Shell title="Technician jobs" eyebrow="Operations">
      <div className="space-y-4">
        <Card className="!p-3">
          <div className="flex flex-wrap items-center gap-2">
            {VIEWS.map((v) => (
              <Button key={v.key} variant={view === v.key ? 'primary' : 'ghost'} onClick={() => setView(v.key)}>
                {v.label}
              </Button>
            ))}
            <div className="ml-auto pr-2 text-xs font-semibold text-ink-muted">
              {loading ? 'Loading…' : unassignedCount > 0 ? `${unassignedCount} waiting for a technician` : ''}
            </div>
          </div>
        </Card>

        {techs.length === 0 && !loading ? (
          <div className="px-4 py-3 rounded-xl text-sm font-semibold" style={{ backgroundColor: '#FEF2E2', color: '#9A5E0B' }}>
            No active technicians. Add one under Employees (or set one back to Active) to assign these jobs.
          </div>
        ) : null}

        <Table
          headers={['Type', 'Customer', 'City', 'Scheduled', 'Status', 'Technician', 'Assign']}
          empty={loading ? 'Loading…' : view === 'unassigned' ? 'Every open job has a technician' : 'No jobs'}
          rows={jobs.map((j) => {
            const customer = j.booking?.user ?? j.ticket?.user;
            const open = OPEN.includes(j.status);
            // Keep the current technician selectable even if no longer active.
            const options = j.technician && !techs.some((t) => t.id === j.technician!.id) ? [j.technician, ...techs] : techs;
            return [
              <span key="t" className="font-semibold">
                {j.type}
                {j.ticket ? <div className="text-xs text-ink-muted font-normal">Ticket · {j.ticket.category}</div> : null}
              </span>,
              <span key="c">
                {customer?.fullName ?? '—'}
                <div className="text-xs text-ink-muted">{customer?.phone ?? ''}</div>
              </span>,
              j.booking?.city?.name ?? '—',
              <span key="d" className="text-xs">{formatDateTime(j.scheduledFor)}</span>,
              <Badge key="s" tone={tone(j.status) as never}>{j.status}</Badge>,
              j.technician ? (
                <span key="tech">
                  {j.technician.user?.fullName ?? '—'}
                  <div className="text-xs text-ink-muted">{j.technician.employeeCode} · {j.technician.zone}</div>
                </span>
              ) : (
                <Badge key="tech" tone="danger">Unassigned</Badge>
              ),
              open ? (
                <select
                  key="a"
                  value={j.technicianId ?? ''}
                  disabled={busyId === j.id || options.length === 0}
                  onChange={(e) => void assign(j, e.target.value)}
                  className="px-2 py-1 border border-line rounded text-xs bg-white max-w-[200px]"
                >
                  {j.technicianId ? null : <option value="">— Assign —</option>}
                  {options.map((t) => (
                    <option key={t.id} value={t.id} disabled={t.status !== 'ACTIVE'}>
                      {techLabel(t)}{t.status !== 'ACTIVE' ? ` (${t.status})` : ''}
                    </option>
                  ))}
                </select>
              ) : (
                <span key="a" className="text-xs text-ink-muted">—</span>
              ),
            ];
          })}
        />
      </div>
    </Shell>
  );
}
