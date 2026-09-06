/**
 * Formatting helpers — COOK has 9 decimals (lamports-style), like SOL.
 */

export const COOK_DECIMALS = 9
const LAMPORTS = 1_000_000_000

/** Smart-trim a COOK amount: big numbers get fewer decimals, dust keeps precision. */
export function fmtCookFromLamports(lamports: number, opts?: { compact?: boolean }): string {
  if (!Number.isFinite(lamports)) return '—'
  const cook = lamports / LAMPORTS
  const abs = Math.abs(cook)
  let maxFrac = 9
  if (abs >= 1_000_000) maxFrac = 2
  else if (abs >= 1_000) maxFrac = 4
  else if (abs >= 1) maxFrac = 6
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: maxFrac,
    notation: opts?.compact ? 'compact' : 'standard',
  }).format(cook)
}

/** Grouped number for counts (slots, transactions…). */
export function fmtInt(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—'
  return new Intl.NumberFormat('en-US').format(n)
}

/** 85.59M-style compact numbers. */
export function fmtCompact(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—'
  return new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 2 }).format(n)
}

/** Middle-truncate a base58 address for chips and rows. */
export function truncateAddress(address: string, head = 4, tail = 4): string {
  if (!address) return ''
  if (address.length <= head + tail + 3) return address
  return `${address.slice(0, head)}…${address.slice(-tail)}`
}

/** Relative time for activity rows. */
export function relativeTime(unixSeconds: number | null | undefined): string {
  if (!unixSeconds) return '—'
  const diffMs = Date.now() - unixSeconds * 1000
  const s = Math.max(0, Math.floor(diffMs / 1000))
  if (s < 10) return 'just now'
  if (s < 60) return `${s}s ago`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 30) return `${d}d ago`
  const mo = Math.floor(d / 30)
  if (mo < 12) return `${mo}mo ago`
  return `${Math.floor(mo / 12)}y ago`
}

/** Absolute UTC timestamp for tooltips. */
export function fullTime(unixSeconds: number | null | undefined): string {
  if (!unixSeconds) return ''
  return new Date(unixSeconds * 1000).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

export type ParseResult = { ok: true; lamports: number } | { ok: false; error: string }

/** Parse a human COOK amount into lamports with strict validation. */
export function parseCookAmount(input: string): ParseResult {
  const trimmed = input.trim()
  if (trimmed === '') return { ok: false, error: 'Enter an amount' }
  if (!/^\d*(\.\d{0,9})?$/.test(trimmed) || trimmed === '.') {
    return { ok: false, error: 'Numbers only, up to 9 decimals' }
  }
  const value = Number.parseFloat(trimmed)
  if (!Number.isFinite(value) || value <= 0) {
    return { ok: false, error: 'Amount must be greater than 0' }
  }
  const lamports = Math.round(value * LAMPORTS)
  if (!Number.isSafeInteger(lamports) || lamports <= 0) {
    return { ok: false, error: 'Amount is too precise or too large' }
  }
  return { ok: true, lamports }
}
