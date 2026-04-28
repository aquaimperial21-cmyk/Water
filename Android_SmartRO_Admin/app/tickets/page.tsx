'use client';

import { useEffect, useState } from 'react';
import { Shell } from '../../components/Shell';
import { Badge, Table, Button, Card } from '../../components/UI';
import { api, apiErrorMessage, formatDateTime } from '../../lib/api';

interface Tech { id: string; employeeCode: string; zone: string; user: { fullName: string } }
interface Ticket {
  id: string; category: string; description: string; status: string; priority: string;
  slaDueAt?: string; createdAt: string;
  user: { id: string; fullName: string; phone: string };
  device?: { serial: string } | null;
  technician?: { id: string; employeeCode: string } | null;
}

const STATUSES = ['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED', 'REOPENED'] as const;

export default function Tickets() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [techs, setTechs] = useState<Tech[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('OPEN');

  async function load() {
    setLoading(true);
    const [t, te] = await Promise.all([
      api.get('/tickets').then((r) => r.data.data as Ticket[]),
      api.get('/technician').then((r) => r.data.data as Tech[]),
    ]);
    setTickets(t);
    setTechs(te);
    setLoading(false);
  }

  useEffect(() => { void load(); }, []);

  async function assign(ticketId: string, technicianId: string) {
    if (!technicianId) return;
    try {
      await api.patch(`/tickets/${ticketId}`, {
        technicianId,
        scheduledFor: new Date(Date.now() + 4 * 3600 * 1000).toISOString(),
      });
      await load();
    } catch (e) { alert(apiErrorMessage(e)); }
  }

  async function changeStatus(ticketId: string, status: string) {
    try {
      await api.patch(`/tickets/${ticketId}`, { status });
      await load();
    } catch (e) { alert(apiErrorMessage(e)); }
  }

  const tone = (s: string) =>
    s === 'RESOLVED' || s === 'CLOSED' ? 'success'
      : s === 'OPEN' || s === 'REOPENED' ? 'warning'
        : s === 'IN_PROGRESS' ? 'info'
          : 'neutral';

  const visible = filter === 'ALL' ? tickets : tickets.filter((t) => t.status === filter);

  return (
    <Shell title="Service Tickets">
      <div className="space-y-4">
        <Card className="!p-3">
          <div className="flex flex-wrap gap-2">
            <Button variant={filter === 'ALL' ? 'primary' : 'ghost'} onClick={() => setFilter('ALL')}>All</Button>
            {STATUSES.map((s) => (
              <Button key={s} variant={filter === s ? 'primary' : 'ghost'} onClick={() => setFilter(s)}>{s}</Button>
            ))}
          </div>
        </Card>
        <Table
          headers={['Category', 'Customer', 'Description', 'Priority', 'Status', 'Assigned to', 'SLA', 'Action']}
          empty={loading ? 'Loading…' : 'No tickets'}
          rows={visible.map((t) => [
            <span key="c" className="font-semibold">{t.category}</span>,
            <span key="u">{t.user.fullName}<div className="text-xs text-ink-muted">{t.user.phone}</div></span>,
            <span key="d" className="text-xs text-ink-muted line-clamp-2 block max-w-xs">{t.description}</span>,
            <Badge key="p" tone={t.priority === 'HIGH' ? 'danger' : t.priority === 'MEDIUM' ? 'warning' : 'neutral'}>{t.priority}</Badge>,
            <Badge key="s" tone={tone(t.status) as never}>{t.status}</Badge>,
            <select
              key="t"
              defaultValue={t.technician?.id ?? ''}
              onChange={(e) => assign(t.id, e.target.value)}
              className="px-2 py-1 border border-line rounded text-xs bg-white max-w-[140px]"
            >
              <option value="">— Assign —</option>
              {techs.map((tc) => (
                <option key={tc.id} value={tc.id}>{tc.employeeCode} · {tc.zone}</option>
              ))}
            </select>,
            <span key="sl" className="text-xs text-ink-muted">{t.slaDueAt ? formatDateTime(t.slaDueAt) : '—'}</span>,
            <select
              key="x"
              value={t.status}
              onChange={(e) => changeStatus(t.id, e.target.value)}
              className="px-2 py-1 border border-line rounded text-xs bg-white"
            >
              {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>,
          ])}
        />
      </div>
    </Shell>
  );
}
