/**
 * Tiny dependency-free toast system.
 * `toast.success/error/info(...)` can be called from anywhere (module store);
 * mount <ToastViewport /> once at the app root.
 */
import { useEffect, useState } from 'react'
import { CheckCircle2, ExternalLink, Info, X, XCircle } from 'lucide-react'

export type ToastKind = 'success' | 'error' | 'info'

export interface ToastOptions {
  description?: string
  /** Optional on-chain link (e.g. explorer tx) rendered as a button. */
  link?: { label: string; href: string }
  timeoutMs?: number
}

interface ToastItem extends ToastOptions {
  id: number
  kind: ToastKind
  title: string
}

let nextId = 1
let items: ToastItem[] = []
const listeners = new Set<(items: ToastItem[]) => void>()

function emit() {
  for (const listener of listeners) listener([...items])
}

function push(kind: ToastKind, title: string, options?: ToastOptions) {
  const id = nextId++
  items = [{ id, kind, title, ...options }, ...items].slice(0, 4)
  emit()
  window.setTimeout(() => dismiss(id), options?.timeoutMs ?? (kind === 'error' ? 8_000 : 5_000))
}

function dismiss(id: number) {
  items = items.filter((t) => t.id !== id)
  emit()
}

export const toast = {
  success: (title: string, options?: ToastOptions) => push('success', title, options),
  error: (title: string, options?: ToastOptions) => push('error', title, options),
  info: (title: string, options?: ToastOptions) => push('info', title, options),
}

const KIND_STYLES: Record<ToastKind, { icon: typeof CheckCircle2; ring: string; iconColor: string }> = {
  success: { icon: CheckCircle2, ring: 'border-emerald-500/30', iconColor: 'text-emerald-400' },
  error: { icon: XCircle, ring: 'border-red-500/30', iconColor: 'text-red-400' },
  info: { icon: Info, ring: 'border-amber-400/30', iconColor: 'text-amber-glow' },
}

export function ToastViewport() {
  const [current, setCurrent] = useState<ToastItem[]>([])

  useEffect(() => {
    listeners.add(setCurrent)
    setCurrent([...items])
    return () => {
      listeners.delete(setCurrent)
    }
  }, [])

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-3 bottom-3 z-[100] flex flex-col items-center gap-2 sm:inset-x-auto sm:right-5 sm:bottom-5 sm:items-end"
    >
      {current.map((t) => {
        const style = KIND_STYLES[t.kind]
        const Icon = style.icon
        return (
          <div
            key={t.id}
            role={t.kind === 'error' ? 'alert' : 'status'}
            className={`animate-toast-in pointer-events-auto w-full max-w-sm rounded-2xl border ${style.ring} border-white/10 bg-cocoa-800/95 p-4 shadow-2xl shadow-black/40 backdrop-blur`}
          >
            <div className="flex items-start gap-3">
              <Icon className={`mt-0.5 size-5 shrink-0 ${style.iconColor}`} aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-cream-50">{t.title}</p>
                {t.description && <p className="mt-0.5 text-xs leading-relaxed break-words text-cream-400">{t.description}</p>}
                {t.link && (
                  <a
                    href={t.link.href}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-flex items-center gap-1 rounded-lg bg-amber-glow/10 px-2 py-1 text-xs font-medium text-amber-glow transition hover:bg-amber-glow/20"
                  >
                    {t.link.label}
                    <ExternalLink className="size-3" aria-hidden />
                  </a>
                )}
              </div>
              <button
                type="button"
                onClick={() => dismiss(t.id)}
                aria-label="Dismiss notification"
                className="-m-1 rounded-lg p-1.5 text-cream-600 transition hover:bg-white/5 hover:text-cream-300"
              >
                <X className="size-4" aria-hidden />
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
