import React from 'react';

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'gold' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
};
export function Button({ variant = 'primary', size = 'md', loading, className = '', children, disabled, ...rest }: ButtonProps) {
  return (
    <button
      className={`btn btn-${size} btn-${variant} ${className}`}
      disabled={disabled || loading}
      {...rest}
    >
      {loading && <Spinner className="w-4 h-4" />}
      {children}
    </button>
  );
}

export function Card({ className = '', children }: { className?: string; children: React.ReactNode }) {
  return <div className={`card p-5 ${className}`}>{children}</div>;
}

export function Spinner({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-20" />
      <path d="M22 12a10 10 0 0 1-10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export function Chip({ variant = 'ok', children }: { variant?: 'ok' | 'gray' | 'warn' | 'gold'; children: React.ReactNode }) {
  return <span className={`chip chip-${variant}`}>{children}</span>;
}

export function ProgressBar({ value }: { value: number }) {
  return (
    <div className="h-2 w-full rounded-full bg-line overflow-hidden">
      <div className="h-full rounded-full bg-brand-600 transition-all" style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </div>
  );
}

export function StatCard({ label, value, hint, onClick }: { label: string; value: React.ReactNode; hint?: string; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`card p-5 text-right transition ${onClick ? 'hover:shadow-pop hover:-translate-y-0.5 cursor-pointer' : 'cursor-default'}`}
    >
      <div className="text-3xl font-extrabold text-brand-700">{value}</div>
      <div className="mt-1 text-sm text-muted">{label}</div>
      {hint && <div className="mt-0.5 text-xs text-muted/80">{hint}</div>}
    </button>
  );
}

export function EmptyState({ title, hint, action }: { title: string; hint?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-16 h-16 rounded-2xl bg-brand-50 text-brand-300 flex items-center justify-center text-4xl select-none">◎</div>
      <div className="mt-4 font-semibold text-ink">{title}</div>
      {hint && <div className="mt-1.5 text-sm text-muted max-w-xs leading-relaxed">{hint}</div>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse-soft rounded-xl bg-line/70 ${className}`} />;
}

export function TextField({
  label, error, ...rest
}: React.InputHTMLAttributes<HTMLInputElement> & { label?: string; error?: string }) {
  return (
    <label className="block">
      {label && <div className="mb-1.5 text-sm font-medium">{label}</div>}
      <input className={`input ${error ? 'border-danger focus:border-danger focus:ring-danger/15' : ''}`} {...rest} />
      {error && <div className="mt-1 text-xs text-danger">{error}</div>}
    </label>
  );
}

export function Toggle({ checked, onChange, labels }: { checked: boolean; onChange: (v: boolean) => void; labels?: [string, string] }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`relative h-8 w-32 rounded-full text-xs font-medium transition ${checked ? 'bg-brand-600 text-white' : 'bg-line text-muted'}`}
    >
      <span className="relative z-10 flex h-full items-center justify-between px-3">
        <span className={checked ? 'opacity-100' : 'opacity-40'}>{labels?.[0] ?? 'نعم'}</span>
        <span className={!checked ? 'opacity-100' : 'opacity-40'}>{labels?.[1] ?? 'لا'}</span>
      </span>
    </button>
  );
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-line">
      <div>
        <h1 className="text-xl font-extrabold text-ink">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-muted">{subtitle}</p>}
      </div>
      {action && <div className="flex flex-wrap gap-2">{action}</div>}
    </div>
  );
}

export function Modal({ open, onClose, title, children, footer }: {
  open: boolean; onClose: () => void; title: string; children: React.ReactNode; footer?: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative card w-full max-w-lg p-0 animate-in shadow-pop">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h3 className="text-base font-bold">{title}</h3>
          <button onClick={onClose} className="rounded-lg p-1 text-muted hover:bg-line hover:text-ink text-lg leading-none">✕</button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex flex-wrap justify-start gap-2 border-t border-line px-5 py-4">{footer}</div>}
      </div>
    </div>
  );
}
