import { useEffect, useRef, useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { truncateAddress } from '../lib/format'

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    // Fallback for sandboxed iframes / older browsers
    try {
      const ta = document.createElement('textarea')
      ta.value = text
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      const ok = document.execCommand('copy')
      document.body.removeChild(ta)
      return ok
    } catch {
      return false
    }
  }
}

interface AddressChipProps {
  address: string
  /** Longest label allowed before truncation kicks in (chars at each end). */
  head?: number
  tail?: number
  className?: string
}

/** Click-to-copy address with visible "Copied" feedback. */
export function AddressChip({ address, head = 4, tail = 4, className = '' }: AddressChipProps) {
  const [copied, setCopied] = useState(false)
  const timer = useRef<number | undefined>(undefined)

  useEffect(() => () => window.clearTimeout(timer.current), [])

  const onCopy = async () => {
    const ok = await copyText(address)
    if (ok) {
      setCopied(true)
      window.clearTimeout(timer.current)
      timer.current = window.setTimeout(() => setCopied(false), 1_600)
    }
  }

  return (
    <button
      type="button"
      onClick={onCopy}
      title={`${address} — click to copy`}
      aria-label={`Copy address ${address}`}
      className={`inline-flex min-h-11 max-w-full items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.03] px-2.5 font-mono text-xs text-cream-200 transition hover:border-amber-glow/40 hover:bg-amber-glow/10 ${className}`}
    >
      <span className="truncate">{truncateAddress(address, head, tail)}</span>
      {copied ? (
        <Check className="size-3.5 shrink-0 text-emerald-400" aria-hidden />
      ) : (
        <Copy className="size-3.5 shrink-0 text-cream-600" aria-hidden />
      )}
      <span className="sr-only" role="status">
        {copied ? 'Copied to clipboard' : ''}
      </span>
    </button>
  )
}

export { copyText }
