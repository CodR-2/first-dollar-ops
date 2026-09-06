import { Loader2, ShieldCheck, ShieldX } from 'lucide-react'
import { CHAIN } from '../lib/chain'

export type NetworkState = 'checking' | 'ok' | 'mismatch'

/**
 * Genesis-hash verification badge. Cookie Chain's identity is its genesis hash;
 * a match gets a green badge, any other hash gets a loud red banner so users
 * never mistake another SVM chain for Cookie Chain.
 */
export function NetworkBadge({ state }: { state: NetworkState }) {
  if (state === 'checking') {
    return (
      <span className="inline-flex h-11 items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3 text-xs font-medium text-cream-400">
        <Loader2 className="size-3.5 animate-spin" aria-hidden />
        Verifying network…
      </span>
    )
  }
  if (state === 'ok') {
    return (
      <span
        className="inline-flex h-11 items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 text-xs font-semibold text-emerald-300"
        title={`Genesis ${CHAIN.genesisHash}`}
      >
        <ShieldCheck className="size-4" aria-hidden />
        <span className="hidden sm:inline">Cookie Chain verified</span>
        <span className="sm:hidden">Verified</span>
      </span>
    )
  }
  return (
    <span className="inline-flex h-11 items-center gap-1.5 rounded-full border border-red-500/40 bg-red-500/10 px-3 text-xs font-semibold text-red-300">
      <ShieldX className="size-4" aria-hidden />
      Wrong network
    </span>
  )
}

export function WrongNetworkBanner({ actualHash }: { actualHash: string | null }) {
  return (
    <div role="alert" className="border-b border-red-500/30 bg-red-500/10">
      <div className="mx-auto flex max-w-6xl flex-col gap-1 px-4 py-3 text-sm sm:flex-row sm:items-center sm:gap-3">
        <span className="flex items-center gap-2 font-semibold text-red-300">
          <ShieldX className="size-4 shrink-0" aria-hidden />
          This RPC is not Cookie Chain.
        </span>
        <span className="text-red-200/80">
          Expected genesis {CHAIN.genesisHash.slice(0, 12)}…, got{' '}
          {actualHash ? `${actualHash.slice(0, 12)}…` : 'unknown'}. Point your wallet at{' '}
          <code className="rounded bg-black/30 px-1 py-0.5 font-mono text-xs">{CHAIN.rpcUrl}</code> — see{' '}
          <a href={CHAIN.walletsDoc} target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:text-red-100">
            wallet setup docs
          </a>
          .
        </span>
      </div>
    </div>
  )
}
