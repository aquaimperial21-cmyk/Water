/**
 * In-app messages: toasts and confirm dialogs.
 *
 * Use these instead of `Alert.alert` / `window.alert` / `window.confirm`.
 * They render through <MessageHost /> (mounted once in App.tsx), so they
 * look the same on Android, iOS and web, and can be called from anywhere
 * (event handlers, async callbacks, utils) without hooks.
 *
 *   toast.success('Ticket raised', 'A technician will reach out shortly.');
 *   toast.error('Could not save', apiErrorMessage(e));
 *   const ok = await confirmAction({ title: 'Cancel plan?', destructive: true });
 *   await showDialog({ title: 'Payment failed', message: '…' }); // OK-only, must be acknowledged
 */

export type MessageTone = 'success' | 'error' | 'warning' | 'info';

export type ToastMessage = {
  id: number;
  tone: MessageTone;
  title: string;
  message?: string;
  /** Milliseconds before it hides on its own. */
  duration: number;
};

export type ConfirmRequest = {
  id: number;
  title: string;
  message?: string;
  confirmLabel: string;
  cancelLabel: string;
  destructive: boolean;
  /** OK-only dialog (no cancel button). */
  acknowledgeOnly: boolean;
};

export type ConfirmOptions = {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
};

type Snapshot = { toasts: ToastMessage[]; confirm: ConfirmRequest | null };

const MAX_TOASTS = 3;

let nextId = 1;
let toasts: ToastMessage[] = [];
const confirmQueue: Array<{ req: ConfirmRequest; resolve: (ok: boolean) => void }> = [];
let snapshot: Snapshot = { toasts, confirm: null };
const listeners = new Set<() => void>();

function emit() {
  snapshot = { toasts, confirm: confirmQueue[0]?.req ?? null };
  listeners.forEach((l) => l());
}

/** Longer text and errors stay up longer, so people can finish reading. */
function durationFor(tone: MessageTone, title: string, message?: string) {
  const chars = title.length + (message?.length ?? 0);
  const base = tone === 'error' || tone === 'warning' ? 4500 : 3000;
  return Math.min(base + chars * 35, 9000);
}

function show(tone: MessageTone, title: string, message?: string): void {
  const item: ToastMessage = { id: nextId++, tone, title, message, duration: durationFor(tone, title, message) };
  // Same text already on screen (double tap, retry loop): replace it, don't stack it.
  const rest = toasts.filter((t) => !(t.title === title && t.message === message));
  toasts = [item, ...rest].slice(0, MAX_TOASTS);
  emit();
}

export const toast = {
  success: (title: string, message?: string): void => show('success', title, message),
  error: (title: string, message?: string): void => show('error', title, message),
  warning: (title: string, message?: string): void => show('warning', title, message),
  info: (title: string, message?: string): void => show('info', title, message),
};

/** In-app confirm dialog. Resolves true on confirm; false on cancel, back button or backdrop tap. */
export function confirmAction(opts: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => {
    confirmQueue.push({
      req: {
        id: nextId++,
        title: opts.title,
        message: opts.message,
        confirmLabel: opts.confirmLabel ?? 'OK',
        cancelLabel: opts.cancelLabel ?? 'Cancel',
        destructive: !!opts.destructive,
        acknowledgeOnly: false,
      },
      resolve,
    });
    emit();
  });
}

/**
 * OK-only dialog for outcomes people must read before moving on
 * (money moved / may have moved). Everything else should be a toast.
 */
export function showDialog(opts: { title: string; message?: string; okLabel?: string }): Promise<void> {
  return new Promise((resolve) => {
    confirmQueue.push({
      req: {
        id: nextId++,
        title: opts.title,
        message: opts.message,
        confirmLabel: opts.okLabel ?? 'OK',
        cancelLabel: '',
        destructive: false,
        acknowledgeOnly: true,
      },
      resolve: () => resolve(),
    });
    emit();
  });
}

/* ---- Used by <MessageHost /> only ---- */

export function subscribeMessages(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getMessagesSnapshot(): Snapshot {
  return snapshot;
}

export function dismissToast(id: number): void {
  if (!toasts.some((t) => t.id === id)) return;
  toasts = toasts.filter((t) => t.id !== id);
  emit();
}

/** Settles the open dialog once; later calls for the same id are ignored. */
export function settleConfirm(id: number, ok: boolean): void {
  const head = confirmQueue[0];
  if (!head || head.req.id !== id) return;
  confirmQueue.shift();
  emit();
  head.resolve(ok);
}
