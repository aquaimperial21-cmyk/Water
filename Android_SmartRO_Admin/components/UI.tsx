import React from 'react';

/* ============================================================
   Card
   ============================================================ */
export function Card({
  children,
  className = '',
  padding = 'lg',
  variant = 'plain',
}: {
  children: React.ReactNode;
  className?: string;
  padding?: 'md' | 'lg' | 'none';
  variant?: 'plain' | 'tinted' | 'elevated';
}) {
  const pad = padding === 'none' ? '' : padding === 'md' ? 'p-5' : 'p-6';
  const skin =
    variant === 'tinted'
      ? 'bg-brand-tint border border-brand-soft'
      : variant === 'elevated'
      ? 'bg-white border border-line shadow-card'
      : 'bg-white border border-line shadow-soft';
  return <div className={`rounded-3xl ${skin} ${pad} ${className}`}>{children}</div>;
}

/* ============================================================
   Stat — KPI tile
   ============================================================ */
export function Stat({
  label,
  value,
  sub,
  trend,
  icon,
}: {
  label: string;
  value: string | number;
  sub?: string;
  trend?: 'up' | 'down' | 'flat';
  icon?: React.ReactNode;
}) {
  const trendColor = trend === 'up' ? '#27B07D' : trend === 'down' ? '#E63737' : '#657081';
  return (
    <div className="rounded-3xl bg-white border border-line shadow-soft p-5">
      <div className="flex items-start justify-between">
        <div
          className="text-[11px] font-bold uppercase tracking-[0.18em]"
          style={{ color: '#657081' }}
        >
          {label}
        </div>
        {icon ? <div style={{ color: '#23BAFB' }}>{icon}</div> : null}
      </div>
      <div
        className="mt-2 font-extrabold tabular-nums"
        style={{ color: '#151D28', fontSize: '28px', lineHeight: '34px', letterSpacing: '-0.02em' }}
      >
        {value}
      </div>
      {sub ? (
        <div className="text-[11px] mt-1 font-bold" style={{ color: trendColor }}>
          {sub}
        </div>
      ) : null}
    </div>
  );
}

/* ============================================================
   Pill — semantic chip
   ============================================================ */
export function Pill({
  children,
  tone = 'neutral',
  size = 'md',
  dot = false,
  className = '',
}: {
  children: React.ReactNode;
  tone?: 'neutral' | 'accent' | 'success' | 'warning' | 'danger' | 'ink';
  size?: 'sm' | 'md';
  dot?: boolean;
  className?: string;
}) {
  const skin: Record<string, string> = {
    neutral: 'bg-surface-warm text-ink-soft',
    accent: 'bg-brand-soft text-brand-ink',
    success: 'bg-success-soft text-success',
    warning: 'bg-warning-soft text-warning',
    danger: 'bg-danger-soft text-danger',
    ink: 'bg-ink text-canvas',
  };
  const dotColor: Record<string, string> = {
    neutral: 'bg-ink-muted',
    accent: 'bg-brand',
    success: 'bg-success',
    warning: 'bg-warning',
    danger: 'bg-danger',
    ink: 'bg-canvas',
  };
  const sz = size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-[11px]';
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full font-bold ${sz} ${skin[tone]} ${className}`}>
      {dot && <span className={`h-1.5 w-1.5 rounded-full ${dotColor[tone]}`} />}
      {children}
    </span>
  );
}

// Back-compat shim — older pages use Badge.
export function Badge({
  children,
  tone = 'neutral',
}: {
  children: React.ReactNode;
  tone?: 'success' | 'warning' | 'danger' | 'info' | 'neutral';
}) {
  const map: Record<string, 'neutral' | 'accent' | 'success' | 'warning' | 'danger'> = {
    success: 'success',
    warning: 'warning',
    danger: 'danger',
    info: 'accent',
    neutral: 'neutral',
  };
  return <Pill tone={map[tone]}>{children}</Pill>;
}

/* ============================================================
   Button
   ============================================================ */
export function Button({
  children,
  onClick,
  variant = 'primary',
  size = 'md',
  type = 'button',
  disabled,
  className = '',
  leadingIcon,
  trailingIcon,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'ghost' | 'outline' | 'danger' | 'soft';
  size?: 'sm' | 'md' | 'lg';
  type?: 'button' | 'submit';
  disabled?: boolean;
  className?: string;
  leadingIcon?: React.ReactNode;
  trailingIcon?: React.ReactNode;
}) {
  const v: Record<string, string> = {
    primary: 'bg-gradient-accent text-white shadow-glow hover:opacity-95',
    ghost: 'text-ink hover:bg-surface-warm',
    outline: 'bg-white border border-line-strong text-ink hover:border-ink-soft',
    danger: 'bg-danger text-white hover:bg-danger/90',
    soft: 'bg-brand-soft text-brand-ink hover:bg-brand-soft/80',
  };
  const sz: Record<string, string> = {
    sm: 'h-8 px-3 text-xs gap-1',
    md: 'h-10 px-4 text-sm gap-1.5',
    lg: 'h-12 px-5 text-sm gap-2',
  };
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center rounded-xl font-bold tracking-tight disabled:opacity-50 disabled:cursor-not-allowed transition-all ${v[variant]} ${sz[size]} ${className}`}
    >
      {leadingIcon}
      {children}
      {trailingIcon}
    </button>
  );
}

/* ============================================================
   Table — back-compat with existing pages
   ============================================================ */
export function Table({
  headers,
  rows,
  empty,
}: {
  headers: string[];
  rows: React.ReactNode[][];
  empty?: string;
}) {
  return (
    <div className="bg-white border border-line rounded-3xl overflow-hidden shadow-soft">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-surface-warm">
            {headers.map((h, i) => (
              <th
                key={i}
                className="text-left text-eyebrow uppercase text-ink-muted px-4 py-3"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={headers.length} className="text-center text-ink-muted py-12">
                {empty ?? 'No data'}
              </td>
            </tr>
          ) : (
            rows.map((cells, i) => (
              <tr
                key={i}
                className={`border-t border-line/70 hover:bg-surface-warm/60 ${i % 2 === 1 ? 'bg-surface-warm/30' : ''}`}
              >
                {cells.map((c, j) => (
                  <td key={j} className="px-4 py-3 align-middle">{c}</td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

/* ============================================================
   FormField — label + input row
   ============================================================ */
export function FormField({
  label,
  hint,
  required,
  error,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="flex items-baseline justify-between">
        <span className="text-eyebrow uppercase text-ink-muted">
          {label}
          {required ? <span className="text-danger ml-0.5">*</span> : null}
        </span>
        {hint && !error ? <span className="text-[10px] text-ink-muted">{hint}</span> : null}
        {error ? <span className="text-[10px] text-danger font-bold">{error}</span> : null}
      </div>
      <div className="mt-1.5">{children}</div>
    </label>
  );
}

/* ============================================================
   Input + Select — primitive styled to match the customer app
   ============================================================ */
export const inputClass =
  'w-full h-11 px-3.5 rounded-xl bg-white border border-line focus:border-brand focus:ring-4 focus:ring-brand/15 outline-none text-sm font-medium text-ink placeholder:text-ink-muted/60 transition-all';

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${inputClass} ${props.className ?? ''}`} />;
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`${inputClass} ${props.className ?? ''}`} />;
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={`w-full px-3.5 py-3 rounded-xl bg-white border border-line focus:border-brand focus:ring-4 focus:ring-brand/15 outline-none text-sm font-medium text-ink placeholder:text-ink-muted/60 transition-all ${props.className ?? ''}`}
    />
  );
}

/* ============================================================
   EmptyState
   ============================================================ */
export function EmptyState({
  title,
  description,
  action,
  icon,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <div className="rounded-3xl bg-white border border-line shadow-soft p-10 text-center">
      {icon ? <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-full bg-brand-soft text-brand-ink">{icon}</div> : null}
      <div className="font-display text-title-md font-bold text-ink">{title}</div>
      {description ? <div className="text-body-sm text-ink-muted mt-1.5 max-w-md mx-auto">{description}</div> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

/* ============================================================
   Drawer — slide-in side panel for detail views
   ============================================================ */
export function Drawer({
  open,
  onClose,
  title,
  children,
  width = 'wide',
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  width?: 'narrow' | 'wide';
}) {
  if (!open) return null;
  const w = width === 'wide' ? 'w-[min(640px,92vw)]' : 'w-[min(420px,92vw)]';
  return (
    <div className="fixed inset-0 z-50 animate-fade-in">
      <div className="absolute inset-0 bg-ink/40" onClick={onClose} />
      <aside
        className={`absolute right-0 top-0 bottom-0 ${w} bg-canvas shadow-elevated flex flex-col animate-slide-up`}
      >
        <header className="flex items-center justify-between px-6 py-4 border-b border-line bg-white/80 backdrop-blur">
          <div className="font-display text-title-md font-bold text-ink">{title}</div>
          <button
            onClick={onClose}
            className="h-8 w-8 grid place-items-center rounded-full hover:bg-surface-warm text-ink-muted"
            aria-label="Close"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
              <line x1="6" y1="6" x2="18" y2="18" />
              <line x1="18" y1="6" x2="6" y2="18" />
            </svg>
          </button>
        </header>
        <div className="flex-1 overflow-y-auto p-6">{children}</div>
      </aside>
    </div>
  );
}

/* ============================================================
   FileDrop — small file picker tile
   ============================================================ */
export function FileDrop({
  label,
  hint,
  onFile,
  fileName,
  accept = 'image/*',
}: {
  label: string;
  hint?: string;
  onFile: (file: File) => void;
  fileName?: string | null;
  accept?: string;
}) {
  return (
    <label className="block cursor-pointer">
      <div className="rounded-2xl border-2 border-dashed border-line hover:border-brand bg-white px-5 py-6 text-center transition-colors">
        <div className="text-sm font-bold text-ink">{label}</div>
        {hint ? <div className="text-[11px] text-ink-muted mt-1">{hint}</div> : null}
        {fileName ? (
          <div className="text-[11px] text-brand font-bold mt-2 truncate">{fileName}</div>
        ) : null}
        <input
          type="file"
          accept={accept}
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onFile(f);
          }}
        />
      </div>
    </label>
  );
}
