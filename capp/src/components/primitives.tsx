import type { ReactNode } from 'react'
import { AlertTriangle, ExternalLink, RefreshCw } from 'lucide-react'

/** Warm skeleton block. */
export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-shimmer rounded-lg ${className}`} aria-hidden />
}

/** Card container — consistent cookie styling. */
export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <section
      className={`rounded-2xl border border-white/[0.06] bg-cocoa-700/80 p-4 shadow-lg shadow-black/20 sm:p-6 ${className}`}
    >
      {children}
    </section>
  )
}

export function CardTitle({
  icon,
  title,
  actions,
  hint,
}: {
  icon?: ReactNode
  title: string
  actions?: ReactNode
  hint?: string
}) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        {icon && <span className="text-amber-glow">{icon}</span>}
        <h2 className="text-sm font-semibold tracking-wide text-cream-100 uppercase">{title}</h2>
        {hint && <span className="text-xs text-cream-600">{hint}</span>}
      </div>
      {actions}
    </div>
  )
}

/** Refresh icon-button with spinning state. Min 44px touch target. */
export function RefreshButton({ onClick, busy, label }: { onClick: () => void; busy?: boolean; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="inline-flex size-11 items-center justify-center rounded-xl border border-white/10 text-cream-400 transition hover:border-amber-glow/40 hover:bg-amber-glow/10 hover:text-amber-glow"
    >
      <RefreshCw className={`size-4 ${busy ? 'animate-spin' : ''}`} aria-hidden />
    </button>
  )
}

/** Inline error with retry — used by every data card. */
export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-xl border border-red-500/20 bg-red-500/[0.06] p-4">
      <div className="flex items-center gap-2 text-sm text-red-300">
        <AlertTriangle className="size-4 shrink-0" aria-hidden />
        <span className="break-words">{message}</span>
      </div>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/10 px-3 text-sm font-medium text-cream-200 transition hover:border-amber-glow/40 hover:bg-amber-glow/10 hover:text-amber-glow"
        >
          <RefreshCw className="size-4" aria-hidden /> Try again
        </button>
      )}
    </div>
  )
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-dashed border-white/10 p-6 text-center">
      <p className="text-sm font-medium text-cream-300">{title}</p>
      {hint && <p className="mt-1 text-xs text-cream-600">{hint}</p>}
    </div>
  )
}

/** Small status pill. */
export function Pill({
  children,
  tone = 'neutral',
}: {
  children: ReactNode
  tone?: 'neutral' | 'success' | 'fail' | 'amber' | 'pending'
}) {
  const tones: Record<string, string> = {
    neutral: 'border-white/10 bg-white/[0.04] text-cream-300',
    success: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
    fail: 'border-red-500/30 bg-red-500/10 text-red-300',
    amber: 'border-amber-400/30 bg-amber-400/10 text-amber-glow',
    pending: 'border-amber-400/30 bg-amber-400/10 text-amber-glow',
  }
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium whitespace-nowrap ${tones[tone]}`}
    >
      {children}
    </span>
  )
}

/** External link styled as a ghost icon button. */
export function ExternalLinkButton({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      aria-label={label}
      title={label}
      className="inline-flex size-11 items-center justify-center rounded-xl border border-white/10 text-cream-400 transition hover:border-amber-glow/40 hover:bg-amber-glow/10 hover:text-amber-glow"
    >
      <ExternalLink className="size-4" aria-hidden />
    </a>
  )
}
