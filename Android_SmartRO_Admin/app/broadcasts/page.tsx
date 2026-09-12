'use client';

import { useState } from 'react';
import { Shell } from '../../components/Shell';
import { Button, Card, FormField, Input, Pill, Select, Textarea } from '../../components/UI';
import { api, apiErrorMessage } from '../../lib/api';

interface Result {
  audience: string;
  count: number;
  sent: number;
  failed: number;
}

const AUDIENCES: { value: string; label: string; hint: string }[] = [
  { value: 'ALL', label: 'All customers', hint: 'Every active CUSTOMER user' },
  { value: 'ACTIVE_SUBSCRIBERS', label: 'Active subscribers', hint: 'Anyone with an ACTIVE subscription' },
  { value: 'EXPIRING_7D', label: 'Expiring in 7 days', hint: 'Active subs with expiry within a week' },
  { value: 'NO_SUBSCRIPTION', label: 'No subscription yet', hint: 'Customers who never bought a plan' },
];

export default function BroadcastsPage() {
  const [audience, setAudience] = useState('ACTIVE_SUBSCRIBERS');
  const [channel, setChannel] = useState<'WHATSAPP' | 'SMS'>('WHATSAPP');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [cronBusy, setCronBusy] = useState<'expiry' | 'tech' | null>(null);
  const [cronResult, setCronResult] = useState<Record<string, unknown> | null>(null);

  async function send() {
    setBusy(true);
    setErr(null);
    setResult(null);
    try {
      const r = await api.post('/admin/broadcasts', {
        audience,
        channel,
        templateKey: 'admin.broadcast.custom',
        title: title.trim(),
        body: body.trim(),
      });
      setResult(r.data.data);
    } catch (e) {
      setErr(apiErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function runCron(which: 'expiry' | 'tech') {
    setCronBusy(which);
    setCronResult(null);
    try {
      const path = which === 'expiry' ? '/admin/cron/expiry-reminders/run' : '/admin/cron/tech-schedule/run';
      const r = await api.post(path);
      setCronResult({ which, ...r.data.data });
    } catch (e) {
      setCronResult({ which, error: apiErrorMessage(e) });
    } finally {
      setCronBusy(null);
    }
  }

  const a = AUDIENCES.find((x) => x.value === audience);

  return (
    <Shell title="Broadcasts" eyebrow="Marketing">
      <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-6">
        <Card variant="elevated">
          <div className="text-eyebrow uppercase text-ink-muted">Compose</div>
          <h2 className="font-display text-title-lg font-bold mt-1">Push to customers</h2>
          <p className="text-sm text-ink-muted mt-1">
            Sends a templated message via the configured driver. With <code className="bg-surface-warm rounded px-1 text-[11px]">MESSAGING_DRIVER=stub</code>, the
            payload is logged on the backend and persisted to the Notification table — no real WhatsApp is sent until a provider is plugged in.
          </p>

          <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField label="Audience" required>
              <Select value={audience} onChange={(e) => setAudience(e.target.value)}>
                {AUDIENCES.map((x) => (
                  <option key={x.value} value={x.value}>{x.label}</option>
                ))}
              </Select>
              {a ? <div className="text-[11px] text-ink-muted mt-1">{a.hint}</div> : null}
            </FormField>
            <FormField label="Channel" required>
              <Select value={channel} onChange={(e) => setChannel(e.target.value as 'WHATSAPP' | 'SMS')}>
                <option value="WHATSAPP">WhatsApp</option>
                <option value="SMS">SMS</option>
              </Select>
            </FormField>
            <FormField label="Title (push)" required hint={`${title.length}/120`}>
              <Input maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Monsoon offer" />
            </FormField>
            <FormField label="Body" required hint={`${body.length}/2000`}>
              <Textarea rows={4} maxLength={2000} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Hi {name}, flat 15% off your next recharge — code MONSOON15. Valid till 30 Apr." />
            </FormField>
          </div>

          {err ? (
            <div className="mt-4 rounded-xl border border-danger/30 bg-danger-soft px-4 py-2.5 text-sm text-danger font-bold">{err}</div>
          ) : null}
          {result ? (
            <div className="mt-4 rounded-xl border border-success/30 bg-success-soft px-4 py-3">
              <div className="text-eyebrow uppercase text-success">Broadcast queued</div>
              <div className="text-sm font-bold mt-1 text-success">
                {result.sent} sent · {result.failed} failed · {result.count} matched audience
              </div>
            </div>
          ) : null}

          <div className="mt-5 flex justify-end gap-3">
            <Button variant="ghost" onClick={() => { setTitle(''); setBody(''); setResult(null); }} disabled={busy}>Reset</Button>
            <Button onClick={send} disabled={busy || !title.trim() || !body.trim()}>
              {busy ? 'Sending…' : 'Send broadcast'}
            </Button>
          </div>
        </Card>

        <div className="space-y-4">
          <Card>
            <div className="text-eyebrow uppercase text-ink-muted">Scheduled jobs</div>
            <h3 className="font-bold mt-1">Run cron now</h3>
            <p className="text-[12px] text-ink-muted mt-1">
              These cron jobs run automatically (09:00 / 07:30 IST). Trigger here for a smoke test or off-cycle run.
            </p>
            <div className="mt-4 space-y-2">
              <Button
                size="sm"
                variant="outline"
                className="w-full justify-between"
                onClick={() => runCron('expiry')}
                disabled={cronBusy !== null}
              >
                Recharge reminders
                {cronBusy === 'expiry' ? <Pill tone="warning" size="sm">Running…</Pill> : <span className="text-[11px] text-ink-muted">7 / 3 / 1 days</span>}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="w-full justify-between"
                onClick={() => runCron('tech')}
                disabled={cronBusy !== null}
              >
                Tech daily schedule
                {cronBusy === 'tech' ? <Pill tone="warning" size="sm">Running…</Pill> : <span className="text-[11px] text-ink-muted">WhatsApp</span>}
              </Button>
            </div>
            {cronResult ? (
              <pre className="mt-4 text-[11px] bg-surface-warm rounded-lg p-3 overflow-x-auto">{JSON.stringify(cronResult, null, 2)}</pre>
            ) : null}
          </Card>

          <Card>
            <div className="text-eyebrow uppercase text-ink-muted">Provider status</div>
            <div className="mt-2 flex items-center gap-2">
              <Pill tone="warning" dot>Stub driver</Pill>
            </div>
            <p className="text-[12px] text-ink-muted mt-2">
              Messages are persisted to the Notification table for audit. To go live, set
              <code className="bg-surface-warm rounded px-1 text-[11px] mx-1">MESSAGING_DRIVER</code>
              in the backend <code className="bg-surface-warm rounded px-1 text-[11px]">.env</code> to your provider key
              (Gupshup / MSG91 / Twilio) and add the driver file.
            </p>
          </Card>
        </div>
      </div>
    </Shell>
  );
}
