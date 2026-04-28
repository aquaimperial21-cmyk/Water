import React from 'react';

export function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`bg-white border border-line rounded-xl p-6 ${className}`}>{children}</div>;
}

export function Stat({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-white border border-line rounded-xl p-5">
      <div className="text-xs uppercase tracking-wide text-ink-muted font-semibold">{label}</div>
      <div className="text-2xl font-extrabold mt-2">{value}</div>
      {sub ? <div className="text-xs text-ink-muted mt-1">{sub}</div> : null}
    </div>
  );
}

export function Badge({ tone = 'neutral', children }: { tone?: 'success' | 'warning' | 'danger' | 'info' | 'neutral'; children: React.ReactNode }) {
  const cls: Record<string, string> = {
    success: 'bg-emerald-50 text-emerald-700',
    warning: 'bg-amber-50 text-amber-700',
    danger: 'bg-rose-50 text-rose-700',
    info: 'bg-brand-light text-brand',
    neutral: 'bg-slate-100 text-slate-600',
  };
  return <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold tracking-wide ${cls[tone]}`}>{children}</span>;
}

export function Button({
  children,
  onClick,
  variant = 'primary',
  type = 'button',
  disabled,
  className = '',
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'ghost' | 'danger';
  type?: 'button' | 'submit';
  disabled?: boolean;
  className?: string;
}) {
  const v: Record<string, string> = {
    primary: 'bg-brand text-white hover:bg-brand-dark',
    ghost: 'border border-line hover:bg-canvas text-ink',
    danger: 'bg-rose-600 text-white hover:bg-rose-700',
  };
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`px-4 py-2 rounded-md font-semibold text-sm disabled:opacity-50 ${v[variant]} ${className}`}
    >
      {children}
    </button>
  );
}

export function Table({ headers, rows, empty }: { headers: string[]; rows: React.ReactNode[][]; empty?: string }) {
  return (
    <div className="bg-white border border-line rounded-xl overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-canvas">
            {headers.map((h, i) => (
              <th key={i} className="text-left font-semibold text-xs uppercase tracking-wide text-ink-muted px-4 py-3">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr><td colSpan={headers.length} className="text-center text-ink-muted py-12">{empty ?? 'No data'}</td></tr>
          ) : (
            rows.map((cells, i) => (
              <tr key={i} className="border-t border-line hover:bg-canvas/60">
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
