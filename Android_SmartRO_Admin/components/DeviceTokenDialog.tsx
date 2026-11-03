'use client';

// Shows a purifier's serial and device token so a technician can flash them
// onto the ESP32 over USB serial. Mount it only while it should be open:
//
//   {view ? <DeviceTokenDialog serial={view.serial} token={view.token} onClose={() => setView(null)} /> : null}
//
// Pass onRegenerate to offer "Generate new token". It should issue the new
// token and pass it back in through the `token` prop.

import { useEffect, useId, useRef, useState, type Ref } from 'react';
import { Button } from './UI';
import { confirmDialog, toast } from './Feedback';
import { apiErrorMessage } from '../lib/api';

type Field = 'serial' | 'token';

// navigator.clipboard only works on secure origins (https, localhost). On a
// LAN IP it is missing or throws, so fall back to a hidden textarea.
async function copyText(text: string): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // fall through
    }
  }
  const previous = document.activeElement as HTMLElement | null;
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.setAttribute('readonly', '');
  ta.setAttribute('aria-hidden', 'true');
  ta.style.position = 'fixed';
  ta.style.top = '0';
  ta.style.left = '0';
  ta.style.opacity = '0';
  ta.style.pointerEvents = 'none';
  document.body.appendChild(ta);
  ta.select();
  ta.setSelectionRange(0, text.length);
  let ok = false;
  try {
    ok = document.execCommand('copy');
  } catch {
    ok = false;
  }
  document.body.removeChild(ta);
  previous?.focus();
  return ok;
}

export function DeviceTokenDialog({
  serial,
  token,
  onClose,
  onRegenerate,
  title = 'Device token',
}: {
  serial: string;
  token: string;
  onClose: () => void;
  onRegenerate?: () => Promise<void>;
  title?: string;
}) {
  const titleId = useId();
  const warningId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const tokenCopyRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  // True while the confirm dialog sits on top, so its keys aren't handled twice.
  const confirmingRef = useRef(false);
  const [copied, setCopied] = useState<Field | null>(null);
  const [regenerating, setRegenerating] = useState(false);

  useEffect(() => {
    onCloseRef.current = onClose;
  });

  // Focus the token's Copy button on open; hand focus back to the trigger on close.
  useEffect(() => {
    const trigger = document.activeElement as HTMLElement | null;
    tokenCopyRef.current?.focus();
    return () => {
      if (trigger && trigger !== document.body && trigger.isConnected) trigger.focus();
    };
  }, []);

  // Escape closes; Tab stays inside the dialog.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (confirmingRef.current || !panelRef.current) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (e.key !== 'Tab') return;
      const focusables = Array.from(
        panelRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')
      );
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const current = document.activeElement;
      if (e.shiftKey && (current === first || !panelRef.current.contains(current))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (current === last || !panelRef.current.contains(current))) {
        e.preventDefault();
        first.focus();
      }
    }
    document.addEventListener('keydown', onKeyDown, true);
    return () => document.removeEventListener('keydown', onKeyDown, true);
  }, []);

  // "Copied" fades back to "Copy" after a moment.
  useEffect(() => {
    if (!copied) return;
    const t = window.setTimeout(() => setCopied(null), 2000);
    return () => window.clearTimeout(t);
  }, [copied]);

  // A new token hasn't been copied yet.
  useEffect(() => {
    setCopied(null);
  }, [token]);

  async function copy(field: Field) {
    const ok = await copyText(field === 'serial' ? serial : token);
    if (ok) setCopied(field);
    else toast.error('Select the text and press Ctrl+C to copy it.', 'Could not copy');
  }

  async function regenerate() {
    if (!onRegenerate || regenerating) return;
    confirmingRef.current = true;
    const ok = await confirmDialog({
      title: `Generate a new token for ${serial}?`,
      message:
        'The current token stops working straight away. The purifier stays cut off until a technician flashes the new token onto it.',
      confirmLabel: 'Generate new token',
      destructive: true,
    });
    confirmingRef.current = false;
    if (!ok) return;
    setRegenerating(true);
    try {
      await onRegenerate();
      tokenCopyRef.current?.focus();
    } catch (e) {
      toast.error(apiErrorMessage(e), 'Could not generate a new token');
    } finally {
      setRegenerating(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4 animate-fade-in">
      <div className="absolute inset-0 bg-ink/40" onClick={onClose} aria-hidden />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={warningId}
        className="relative w-full max-w-lg rounded-3xl bg-white border border-line shadow-elevated p-6 animate-slide-up"
      >
        <div className="flex items-start gap-4">
          <div className="h-11 w-11 shrink-0 grid place-items-center rounded-full bg-brand-soft text-brand-dark">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <circle cx="7.5" cy="15.5" r="4.5" />
              <path d="m10.7 12.3 9.8-9.8" />
              <path d="m16 7 3 3" />
              <path d="m19 4 2 2" />
            </svg>
          </div>
          <div className="min-w-0 flex-1 pt-1">
            <h2 id={titleId} className="font-display text-title-md font-bold text-ink break-words">
              {title}
            </h2>
            <p className="mt-1 text-body-sm text-ink-muted">Flash both onto the purifier&apos;s ESP32 over USB serial.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="-mr-2 -mt-2 h-8 w-8 shrink-0 grid place-items-center rounded-full text-ink-muted hover:bg-surface-warm hover:text-ink"
            aria-label="Close"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden>
              <line x1="6" y1="6" x2="18" y2="18" />
              <line x1="18" y1="6" x2="6" y2="18" />
            </svg>
          </button>
        </div>

        <div className="mt-5 space-y-4">
          <CopyField label="Serial" value={serial} copied={copied === 'serial'} onCopy={() => void copy('serial')} />
          <CopyField
            label="Token"
            value={token}
            copied={copied === 'token'}
            onCopy={() => void copy('token')}
            buttonRef={tokenCopyRef}
          />
        </div>

        <div
          id={warningId}
          className="mt-5 flex gap-3 rounded-2xl bg-warning-soft px-4 py-3 text-body-sm text-ink-soft"
        >
          <svg className="mt-0.5 shrink-0 text-warning" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          <div>
            Anyone with this token can pose as this purifier, so don&apos;t send it in screenshots or chat.
            Generating a new token cuts the purifier off until the new one is flashed.
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-end gap-2">
          {onRegenerate ? (
            <Button variant="outline" onClick={() => void regenerate()} disabled={regenerating} className="mr-auto">
              {regenerating ? 'Generating…' : 'Generate new token'}
            </Button>
          ) : null}
          <Button variant="primary" onClick={onClose}>
            Close
          </Button>
        </div>

        <span className="sr-only" role="status" aria-live="polite">
          {copied === 'serial' ? 'Serial copied' : copied === 'token' ? 'Token copied' : ''}
        </span>
      </div>
    </div>
  );
}

function CopyField({
  label,
  value,
  copied,
  onCopy,
  buttonRef,
}: {
  label: string;
  value: string;
  copied: boolean;
  onCopy: () => void;
  buttonRef?: Ref<HTMLButtonElement>;
}) {
  return (
    <div>
      <div className="text-eyebrow uppercase text-ink-muted">
        {label}
      </div>
      <div className="mt-1.5 flex items-stretch gap-2">
        <code
          className="min-w-0 flex-1 rounded-xl border border-line bg-surface-sunken px-3.5 py-2.5 font-mono text-sm text-ink break-all select-all"
        >
          {value}
        </code>
        <button
          ref={buttonRef}
          type="button"
          onClick={onCopy}
          className={`inline-flex min-w-[88px] shrink-0 items-center justify-center gap-1.5 rounded-xl border px-3 text-xs font-bold tracking-tight transition-all ${
            copied
              ? 'border-success bg-success-soft text-success'
              : 'border-line-strong bg-white text-ink hover:border-ink-soft'
          }`}
        >
          {copied ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M20 6 9 17l-5-5" />
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <rect x="9" y="9" width="12" height="12" rx="2" />
              <path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1" />
            </svg>
          )}
          {copied ? 'Copied' : 'Copy'}
          <span className="sr-only"> {label.toLowerCase()}</span>
        </button>
      </div>
    </div>
  );
}
