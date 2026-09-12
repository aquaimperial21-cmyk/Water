'use client';

// Lightweight technician job-ack page. No auth — opened from a WhatsApp deep
// link. Talks to the public webhook endpoint to advance the job state. The
// signed-link approach (HMAC over jobId+date) can be added later; today the
// page assumes the link itself is the secret and rate-limit is the deterrent.

import { useParams } from 'next/navigation';
import { useState } from 'react';
import axios from 'axios';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

type Action = 'EN_ROUTE' | 'IN_PROGRESS' | 'DONE';

export default function JobAck() {
  const { id } = useParams<{ id: string }>();
  const [busy, setBusy] = useState<Action | null>(null);
  const [result, setResult] = useState<{ ok: boolean; advancedTo?: string; message?: string } | null>(null);

  async function send(action: Action) {
    if (!id) return;
    setBusy(action);
    setResult(null);
    try {
      const verb = action === 'EN_ROUTE' ? 'EN_ROUTE' : action === 'IN_PROGRESS' ? 'YES' : 'DONE';
      // Phone is unknown from the page; send via the inbound webhook with a
      // synthetic envelope so the existing parsing logic kicks in.
      const r = await axios.post(`${API}/webhooks/messaging/inbound`, {
        message: { from: 'web-ack', text: `${verb} ${id}` },
      });
      const d = r.data?.data;
      setResult({ ok: !!d?.advancedTo, advancedTo: d?.advancedTo, message: d?.advancedTo ? 'Updated' : 'Could not match this job — check WhatsApp.' });
    } catch (e) {
      const msg = (e as Error).message;
      setResult({ ok: false, message: msg });
    } finally {
      setBusy(null);
    }
  }

  return (
    <main className="min-h-screen aurora-bg flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-white rounded-3xl border border-line shadow-elevated p-7">
        <div className="text-eyebrow uppercase text-ink-muted">Job acknowledgement</div>
        <h1 className="font-display text-display-md font-extrabold mt-1 text-ink">
          Update <span className="text-brand tabular-nums">#{id?.slice(-6).toUpperCase()}</span>
        </h1>
        <p className="text-sm text-ink-muted mt-2">Tap an option below — it'll update the ticket and notify the office.</p>

        <div className="mt-6 grid grid-cols-1 gap-3">
          <button
            disabled={busy !== null}
            onClick={() => send('EN_ROUTE')}
            className="h-12 rounded-xl border-2 border-warning bg-warning-soft text-warning font-bold disabled:opacity-50"
          >
            {busy === 'EN_ROUTE' ? 'Updating…' : '🛵 On my way'}
          </button>
          <button
            disabled={busy !== null}
            onClick={() => send('IN_PROGRESS')}
            className="h-12 rounded-xl border-2 border-brand bg-brand-soft text-brand-ink font-bold disabled:opacity-50"
          >
            {busy === 'IN_PROGRESS' ? 'Updating…' : '🔧 Started work'}
          </button>
          <button
            disabled={busy !== null}
            onClick={() => send('DONE')}
            className="h-12 rounded-xl bg-gradient-accent text-white font-extrabold shadow-glow disabled:opacity-50"
          >
            {busy === 'DONE' ? 'Updating…' : '✓ Mark done'}
          </button>
        </div>

        {result ? (
          <div
            className={`mt-5 rounded-xl px-4 py-3 text-sm font-bold ${
              result.ok ? 'bg-success-soft text-success border border-success/30' : 'bg-danger-soft text-danger border border-danger/30'
            }`}
          >
            {result.ok ? `Status set to ${result.advancedTo}` : result.message}
          </div>
        ) : null}

        <p className="mt-6 text-[11px] text-ink-muted">
          Or reply to the WhatsApp message directly:{' '}
          <code className="bg-surface-warm rounded px-1">DONE</code>,{' '}
          <code className="bg-surface-warm rounded px-1">EN_ROUTE</code>, or{' '}
          <code className="bg-surface-warm rounded px-1">YES</code> followed by the ticket ID.
        </p>
      </div>
    </main>
  );
}
