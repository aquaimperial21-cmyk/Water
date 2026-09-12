'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Shell } from '../../components/Shell';
import { Button, Card, EmptyState, Pill } from '../../components/UI';
import { api, formatDate } from '../../lib/api';

interface Tech {
  id: string;
  employeeCode: string;
  zone: string;
  status: string;
  isActive: boolean;
  whatsappNumber?: string | null;
  employmentType?: string | null;
  dateOfJoining?: string | null;
  user: { id: string; fullName: string | null; phone: string; email: string | null };
}

export default function TechniciansList() {
  const [items, setItems] = useState<Tech[] | null>(null);

  useEffect(() => {
    api.get('/admin/technicians').then((r) => setItems(r.data.data));
  }, []);

  return (
    <Shell title="Employees" eyebrow="Team">
      <div className="flex items-center justify-between mb-5">
        <div className="text-sm text-ink-muted">
          {items ? `${items.length} on the roster` : 'Loading…'}
        </div>
        <Link href="/technicians/new">
          <Button leadingIcon={<span className="text-base leading-none">＋</span>}>Add employee</Button>
        </Link>
      </div>

      {!items ? (
        <Card>
          <div className="text-ink-muted text-sm">Loading…</div>
        </Card>
      ) : items.length === 0 ? (
        <EmptyState
          title="No employees yet"
          description="Add your first technician to start assigning service tickets."
          action={
            <Link href="/technicians/new">
              <Button>Add employee</Button>
            </Link>
          }
        />
      ) : (
        <div className="rounded-3xl bg-white border border-line shadow-soft overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-surface-warm">
                <th className="text-left text-eyebrow uppercase text-ink-muted px-4 py-3">Employee</th>
                <th className="text-left text-eyebrow uppercase text-ink-muted px-4 py-3">Code</th>
                <th className="text-left text-eyebrow uppercase text-ink-muted px-4 py-3">Zone</th>
                <th className="text-left text-eyebrow uppercase text-ink-muted px-4 py-3">Type</th>
                <th className="text-left text-eyebrow uppercase text-ink-muted px-4 py-3">WhatsApp</th>
                <th className="text-left text-eyebrow uppercase text-ink-muted px-4 py-3">Joined</th>
                <th className="text-left text-eyebrow uppercase text-ink-muted px-4 py-3">Status</th>
                <th className="text-left text-eyebrow uppercase text-ink-muted px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {items.map((t, i) => (
                <tr key={t.id} className={`border-t border-line/70 hover:bg-surface-warm/60 ${i % 2 === 1 ? 'bg-surface-warm/30' : ''}`}>
                  <td className="px-4 py-3">
                    <div className="font-bold text-ink">{t.user.fullName ?? '—'}</div>
                    <div className="text-[11px] text-ink-muted">{t.user.email ?? t.user.phone}</div>
                  </td>
                  <td className="px-4 py-3 tabular-nums font-bold">{t.employeeCode}</td>
                  <td className="px-4 py-3">{t.zone}</td>
                  <td className="px-4 py-3 text-[12px]">{t.employmentType ?? '—'}</td>
                  <td className="px-4 py-3 tabular-nums text-[12px]">{t.whatsappNumber ?? '—'}</td>
                  <td className="px-4 py-3 text-[12px] text-ink-muted">{formatDate(t.dateOfJoining)}</td>
                  <td className="px-4 py-3">
                    <Pill
                      tone={t.status === 'ACTIVE' ? 'success' : t.status === 'EXITED' ? 'danger' : 'warning'}
                      size="sm"
                      dot
                    >
                      {t.status}
                    </Pill>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/technicians/${t.id}`} className="text-brand text-[12px] font-bold hover:underline">
                      Open →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Shell>
  );
}
