import { Coins, Layers } from 'lucide-react'
import { usePoll } from '../lib/hooks'
import {
  CHAIN,
  getBalanceLamports,
  getTokenHoldings,
  getTokenAccountOwnerMap,
  type TokenHolding,
} from '../lib/chain'
import { fmtCookFromLamports, fmtInt, truncateAddress } from '../lib/format'
import { AddressChip } from './AddressChip'
import { Card, CardTitle, EmptyState, ErrorState, RefreshButton, Skeleton } from './primitives'

/** Big COOK balance card for the viewed address. */
export function BalanceCard({ address }: { address: string }) {
  const balance = usePoll(() => getBalanceLamports(address), 15_000, [address])

  return (
    <Card>
      <CardTitle
        icon={<Coins className="size-4" aria-hidden />}
        title="COOK balance"
        hint="Native gas token"
        actions={<RefreshButton onClick={balance.refresh} busy={balance.refreshing} label="Refresh balance" />}
      />
      {balance.loading ? (
        <Skeleton className="h-12 w-56" />
      ) : balance.error ? (
        <ErrorState message={`Could not load balance: ${balance.error}`} onRetry={balance.refresh} />
      ) : (
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="font-mono text-4xl font-bold tracking-tight text-cream-50 sm:text-5xl">
              {fmtCookFromLamports(balance.data ?? 0)}
              <span className="ml-2 text-lg font-semibold text-amber-glow">COOK</span>
            </p>
            <p className="mt-1 text-xs text-cream-600">{fmtInt(balance.data ?? 0)} lamports · 9 decimals</p>
          </div>
          <div className="flex flex-col items-start gap-2 sm:items-end">
            <span className="text-xs text-cream-600">Viewing address</span>
            <AddressChip address={address} />
          </div>
        </div>
      )}
    </Card>
  )
}

function TokenRow({ holding }: { holding: TokenHolding }) {
  const amount =
    holding.uiAmount.toLocaleString('en-US', {
      maximumFractionDigits: Math.min(holding.decimals || 2, 9),
    }) ?? '0'
  return (
    <li className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.05] bg-white/[0.02] px-3 py-2.5 transition hover:border-amber-glow/25 hover:bg-amber-glow/[0.04]">
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-amber-glow/10 text-amber-glow">
          <Layers className="size-4" aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="truncate font-mono text-xs text-cream-200" title={holding.mint}>
            {truncateAddress(holding.mint, 6, 6)}
          </p>
          <p className="mt-0.5 text-[11px] text-cream-600">
            {holding.decimals} decimals · {holding.program}
          </p>
        </div>
      </div>
      <p className="shrink-0 font-mono text-sm text-cream-100">{amount}</p>
    </li>
  )
}

/** SPL token accounts (jsonParsed) for the viewed address. */
export function TokenList({ address, refreshKey }: { address: string; refreshKey?: number }) {
  const tokens = usePoll(() => getTokenHoldings(address), 60_000, [address, refreshKey ?? 0])

  return (
    <Card>
      <CardTitle
        icon={<Layers className="size-4" aria-hidden />}
        title="SPL tokens"
        actions={<RefreshButton onClick={tokens.refresh} busy={tokens.refreshing} label="Refresh token accounts" />}
      />
      {tokens.loading ? (
        <ul className="space-y-2">
          {[0, 1, 2].map((i) => (
            <li key={i}>
              <Skeleton className="h-14 w-full" />
            </li>
          ))}
        </ul>
      ) : tokens.error ? (
        <ErrorState message={`Could not load token accounts: ${tokens.error}`} onRetry={tokens.refresh} />
      ) : !tokens.data || tokens.data.length === 0 ? (
        <EmptyState title="No SPL token accounts" hint={`This address holds no ${CHAIN.name} SPL tokens`} />
      ) : (
        <>
          <p className="mb-2 text-xs text-cream-600">{fmtInt(tokens.data.length)} token account(s)</p>
          <ul className="scroll-slim max-h-96 space-y-2 overflow-y-auto pr-1">
            {tokens.data.map((h) => (
              <TokenRow key={`${h.mint}-${h.program}`} holding={h} />
            ))}
          </ul>
        </>
      )}
    </Card>
  )
}

/** Shared hook: token-account owner map used to attribute SPL transfers. */
export function useTokenOwnerMap(address: string) {
  return usePoll(() => getTokenAccountOwnerMap(address), 120_000, [address])
}
