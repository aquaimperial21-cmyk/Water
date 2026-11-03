'use client';

// In-app feedback: toasts + confirm dialog. Replaces window.alert / confirm.
//
//   toast.success(message, title?)   → number (toast id)
//   toast.error(message, title?)
//   toast.info(message, title?)
//   toast.warning(message, title?)
//   toast.dismiss(id)
//
//   if (!(await confirmDialog({ title, message, confirmLabel, destructive }))) return;
//
// Both are plain functions backed by a module-level store, so they work from
// any event handler without hooks. <FeedbackProvider> (mounted once in
// app/layout.tsx) renders whatever the store holds.

import React, { useEffect, useId, useRef, useState, useSyncExternalStore } from 'react';
import { Button } from './UI';

/* ============================================================
   Store
   ============================================================ */

type Tone = 'success' | 'error' | 'info' | 'warning';

interface ToastItem {
  id: number;
  tone: Tone;
  message: string;
  title?: string;
  duration: number;
}

export interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
}

interface ConfirmRequest {
  id: number;
  opts: ConfirmOptions;
  resolve: (ok: boolean) => void;
  returnFocus: HTMLElement | null; // whatever had focus when the dialog was requested
}

interface FeedbackState {
  toasts: ToastItem[]; // newest first
  confirms: ConfirmRequest[]; // FIFO; the head is the open dialog
}

const MAX_TOASTS = 3;
const EMPTY: FeedbackState = { toasts: [], confirms: [] };

let state: FeedbackState = EMPTY;
let nextId = 1;
const listeners = new Set<() => void>();

function setState(next: FeedbackState) {
  state = next;
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const getSnapshot = () => state;
const getServerSnapshot = () => EMPTY;

// ~4s for routine messages, ~6s for errors, plus reading time for long text.
function durationFor(tone: Tone, text: string) {
  const base = tone === 'error' ? 6000 : 4000;
  const extra = Math.max(0, text.length - 80) * 40;
  return Math.min(base + extra, 12000);
}

function pushToast(tone: Tone, message: string, title?: string): number {
  const id = nextId++;
  const item: ToastItem = {
    id,
    tone,
    message,
    title,
    duration: durationFor(tone, `${title ?? ''} ${message}`),
  };
  setState({ ...state, toasts: [item, ...state.toasts].slice(0, MAX_TOASTS) });
  return id;
}

function dismissToast(id: number) {
  if (!state.toasts.some((t) => t.id === id)) return;
  setState({ ...state, toasts: state.toasts.filter((t) => t.id !== id) });
}

export const toast = {
  success: (message: string, title?: string) => pushToast('success', message, title),
  error: (message: string, title?: string) => pushToast('error', message, title),
  info: (message: string, title?: string) => pushToast('info', message, title),
  warning: (message: string, title?: string) => pushToast('warning', message, title),
  dismiss: dismissToast,
};

/** Opens the in-app confirm dialog. Resolves true on confirm; false on cancel, Escape or backdrop click. */
export function confirmDialog(opts: ConfirmOptions): Promise<boolean> {
  const returnFocus = typeof document !== 'undefined' ? (document.activeElement as HTMLElement | null) : null;
  return new Promise<boolean>((resolve) => {
    setState({ ...state, confirms: [...state.confirms, { id: nextId++, opts, resolve, returnFocus }] });
  });
}

// Settles a confirm exactly once: a second call for the same id is a no-op.
function settleConfirm(id: number, ok: boolean) {
  const req = state.confirms.find((c) => c.id === id);
  if (!req) return;
  const remaining = state.confirms.filter((c) => c.id !== id);
  setState({ ...state, confirms: remaining });
  // Hand focus back to the trigger, unless another queued dialog is about to take it.
  if (remaining.length === 0 && req.returnFocus?.isConnected) req.returnFocus.focus();
  req.resolve(ok);
}

/* ============================================================
   Provider
   ============================================================ */

export function FeedbackProvider({ children }: { children: React.ReactNode }) {
  const { toasts, confirms } = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const active = confirms[0];
  return (
    <>
      {children}
      {toasts.length > 0 ? (
        <div className="pointer-events-none fixed top-4 right-4 z-[60] flex w-[min(380px,calc(100vw-2rem))] flex-col gap-2">
          {toasts.map((t) => (
            <ToastCard key={t.id} item={t} />
          ))}
        </div>
      ) : null}
      {active ? <ConfirmDialogView key={active.id} request={active} /> : null}
    </>
  );
}

/* ============================================================
   Toast
   ============================================================ */

const TONE_SKIN: Record<Tone, string> = {
  success: 'bg-success-soft text-success',
  error: 'bg-danger-soft text-danger',
  warning: 'bg-warning-soft text-warning',
  info: 'bg-brand-soft text-brand-dark',
};

function ToneIcon({ tone }: { tone: Tone }) {
  const common = {
    width: 16,
    height: 16,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2.6,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  };
  if (tone === 'success') {
    return (
      <svg {...common}>
        <path d="M20 6 9 17l-5-5" />
      </svg>
    );
  }
  if (tone === 'error') {
    return (
      <svg {...common}>
        <line x1="7" y1="7" x2="17" y2="17" />
        <line x1="17" y1="7" x2="7" y2="17" />
      </svg>
    );
  }
  if (tone === 'warning') {
    return (
      <svg {...common}>
        <line x1="12" y1="6" x2="12" y2="13" />
        <line x1="12" y1="18" x2="12.01" y2="18" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <line x1="12" y1="11" x2="12" y2="18" />
      <line x1="12" y1="6" x2="12.01" y2="6" />
    </svg>
  );
}

function ToastCard({ item }: { item: ToastItem }) {
  // Hovering or focusing the toast pauses its countdown so long messages can be read.
  const [paused, setPaused] = useState(false);
  const remaining = useRef(item.duration);

  useEffect(() => {
    if (paused) return;
    const startedAt = Date.now();
    const timer = window.setTimeout(() => dismissToast(item.id), Math.max(remaining.current, 1000));
    return () => {
      window.clearTimeout(timer);
      remaining.current -= Date.now() - startedAt;
    };
  }, [paused, item.id]);

  const isError = item.tone === 'error';
  return (
    <div
      role={isError ? 'alert' : 'status'}
      aria-live={isError ? 'assertive' : 'polite'}
      aria-atomic="true"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      className="pointer-events-auto flex items-start gap-3 rounded-2xl bg-white border border-line shadow-elevated p-4 animate-fade-in"
    >
      <div className={`mt-0.5 h-8 w-8 shrink-0 grid place-items-center rounded-full ${TONE_SKIN[item.tone]}`}>
        <ToneIcon tone={item.tone} />
      </div>
      <div className="min-w-0 flex-1 pt-1">
        {item.title ? <div className="text-sm font-bold text-ink">{item.title}</div> : null}
        <div
          className={`text-body-sm break-words whitespace-pre-line ${
            item.title ? 'mt-0.5 text-ink-muted' : 'text-ink-soft'
          }`}
        >
          {item.message}
        </div>
      </div>
      <button
        type="button"
        onClick={() => dismissToast(item.id)}
        className="-mr-1 -mt-1 h-7 w-7 shrink-0 grid place-items-center rounded-full text-ink-muted hover:bg-surface-warm hover:text-ink"
        aria-label="Dismiss notification"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden>
          <line x1="6" y1="6" x2="18" y2="18" />
          <line x1="18" y1="6" x2="6" y2="18" />
        </svg>
      </button>
    </div>
  );
}

/* ============================================================
   Confirm dialog
   ============================================================ */

function ConfirmDialogView({ request }: { request: ConfirmRequest }) {
  const { id, opts } = request;
  const titleId = useId();
  const messageId = useId();
  const panelRef = useRef<HTMLDivElement>(null);

  // Escape cancels and Tab stays inside the dialog. The confirm button takes
  // focus on open via autoFocus; settleConfirm hands it back on close.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        settleConfirm(id, false);
        return;
      }
      if (e.key !== 'Tab' || !panelRef.current) return;
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
  }, [id]);

  const destructive = Boolean(opts.destructive);
  return (
    <div className="fixed inset-0 z-[70] grid place-items-center p-4 animate-fade-in">
      <div className="absolute inset-0 bg-ink/40" onClick={() => settleConfirm(id, false)} aria-hidden />
      <div
        ref={panelRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={opts.message ? messageId : undefined}
        className="relative w-full max-w-md rounded-3xl bg-white border border-line shadow-elevated p-6 animate-slide-up"
      >
        <div className="flex items-start gap-4">
          <div
            className={`h-11 w-11 shrink-0 grid place-items-center rounded-full ${
              destructive ? 'bg-danger-soft text-danger' : 'bg-brand-soft text-brand-dark'
            }`}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              {destructive ? (
                <>
                  <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </>
              ) : (
                <>
                  <circle cx="12" cy="12" r="9.5" />
                  <path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </>
              )}
            </svg>
          </div>
          <div className="min-w-0 flex-1 pt-1">
            <h2 id={titleId} className="font-display text-title-md font-bold text-ink break-words">
              {opts.title}
            </h2>
            {opts.message ? (
              <p id={messageId} className="mt-1.5 text-body-sm text-ink-muted break-words whitespace-pre-line">
                {opts.message}
              </p>
            ) : null}
          </div>
        </div>
        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <Button variant="outline" onClick={() => settleConfirm(id, false)}>
            {opts.cancelLabel ?? 'Cancel'}
          </Button>
          <Button variant={destructive ? 'danger' : 'primary'} onClick={() => settleConfirm(id, true)} autoFocus>
            {opts.confirmLabel ?? 'Confirm'}
          </Button>
        </div>
      </div>
    </div>
  );
}
