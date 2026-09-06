import { useEffect, useRef, useState } from 'react'
import {
  Activity as ActivityIcon,
  ArrowDownLeft,
  ArrowUpRight,
  Boxes,
  Coins,
  Repeat,
  Vote,
} from 'lucide-react'
import {
  explorerTx,
  getRecentSignatures,
  getTransactionActivity,
  type ActivityItem,
  type SignatureSummary,
} from '../lib/chain'
import { fmtCookFromLamports, fmtInt, relativeTime, fullTime } from '../lib/format'
import { usePoll } from '../lib/hooks'
import { AddressChip } from './AddressChip'
import { Card, CardTitle, EmptyState, ErrorState, ExternalLinkButton, Pill, RefreshButton, Skeleton } from './primitives'

const KIND_META: Record<
  ActivityItem['kind'],
  { icon: typeof ArrowDownLeft; classes: string; verb: string }
> = {
  'transfer-in': { icon: ArrowDownLeft, classes: 'bg-emerald-500/10 text-emerald-300', verb: 'Received' },
  'transfer-out': { icon: ArrowUpRight, classes: 'bg-amber-400/10 text-amber-glow', verb: 'Sent' },
  'token-in': { icon: Coins, classes: 'bg-emerald-500/10 text-emerald-300', verb: 'Token in' },
  'token-out': { icon: Coins, classes: 'bg-amber-400/10 text-amber-glow', verb: 'Token out' },
  token: { icon: Repeat, classes: 'bg-cream-500/10 text-cream-300', verb: 'Token transfer' },
  account: { icon: Boxes, classes: 'bg-cream-500/10 text-cream-300', verb: 'Account' },
  vote: { icon: Vote, classes: 'bg-cream-500/10 text-cream-500', verb: 'Vote' },
  other: { icon: ActivityIcon, classes: 'bg-cream-500/10 text-cream-300', verb: 'Interaction' },
}

function ActivityRow({
  summary,
  detail,
  ownerMapReady,
}: {
  summary: SignatureSummary
  detail: ActivityItem | undefined
  ownerMapReady: boolean
}) {
  const meta = detail ? KIND_META[detail.kind] : KIND_META.other
  const Icon = meta.icon
  const failed = detail ? detail.status === 'failed' : summary.err != null

  const title = (() => {
    if (!detail) return 'Loading details…'
    if (detail.kind === 'transfer-in' || detail.kind === 'transfer-out') {
      return `${meta.verb} ${detail.amountLabel ?? ''}`.trim()
    }
    if (detail.kind === 'token-in' || detail.kind === 'token-out' || detail.kind === 'token') {
      return `${meta.verb} · ${detail.amountLabel ?? 'SPL'}`
    }
    return detail.detail ?? meta.verb
  })()

  return (
    <li className="flex items-start gap-3 rounded-xl border border-white/[0.05] bg-white/[0.02] p-3 transition hover:border-amber-glow/25 hover:bg-amber-glow/[0.03]">
      <span className={`mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg ${meta.classes}`}>
        <Icon className="size-4" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <p className={`text-sm font-medium ${failed ? 'text-red-300' : 'text-cream-100'}`}>{title}</p>
          {failed ? (
            <Pill tone="fail">Failed</Pill>
          ) : detail ? (
            <Pill tone="success">Success</Pill>
          ) : (
            <Skeleton className="h-4 w-14" />
          )}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-cream-600">
          <span title={fullTime(summary.blockTime)}>{relativeTime(summary.blockTime)}</span>
          <span>slot {fmtInt(summary.slot)}</span>
          {detail?.feeLamports != null && <span>fee {fmtCookFromLamports(detail.feeLamports)} COOK</span>}
          {detail?.counterparty && (
            <span className="flex items-center gap-1">
              {detail.kind.endsWith('in') ? 'from' : 'to'}
              <AddressChip address={detail.counterparty} head={4} tail={4} className="min-h-0 !rounded-lg !px-1.5 !py-0.5 text-[10px]" />
            </span>
          )}
        </div>
        {!ownerMapReady && detail && (detail.kind === 'token-in' || detail.kind === 'token-out' || detail.kind === 'token') && (
          <p className="mt-1 text-[11px] text-cream-700">Token direction approximate — account map still loading</p>
        )}
      </div>
      <ExternalLinkButton href={explorerTx(summary.signature)} label="View transaction on cookiescan" />
    </li>
  )
}

/**
 * Activity feed: recent signatures for the viewed address, lazily enriched
 * with getTransaction to show type, amount, fee, and status.
 */
export function ActivityFeed({
  address,
  ownerMap,
  ownerMapLoading,
}: {
  address: string
  ownerMap: Record<string, string>
  ownerMapLoading: boolean
}) {
  const sigs = usePoll(() => getRecentSignatures(address, 15), 45_000, [address])
  const [details, setDetails] = useState<Record<string, ActivityItem>>({})
  const detailsRef = useRef<Record<string, ActivityItem>>({})
  const attempts = useRef<Record<string, number>>({})
  const runToken = useRef(0)

  // Lazy enrichment: fetch full transactions for rows we haven't decoded yet.
  useEffect(() => {
    const list = sigs.data
    if (!list) return
    const token = ++runToken.current

    const enrich = async () => {
      for (const summary of list) {
        if (runToken.current !== token) return
        if (detailsRef.current[summary.signature]) continue
        if ((attempts.current[summary.signature] ?? 0) >= 3) continue
        attempts.current[summary.signature] = (attempts.current[summary.signature] ?? 0) + 1
        try {
          const item = await getTransactionActivity(summary, address, ownerMap)
          if (runToken.current !== token) return
          detailsRef.current = { ...detailsRef.current, [item.signature]: item }
          setDetails(detailsRef.current)
        } catch {
          // leave un-enriched; a later poll cycle retries (up to 3 attempts)
        }
      }
    }
    void enrich()
  }, [sigs.data, address, ownerMap])

  // Reset decoded rows when the address changes.
  useEffect(() => {
    detailsRef.current = {}
    attempts.current = {}
    setDetails({})
  }, [address])

  return (
    <Card>
      <CardTitle
        icon={<ActivityIcon className="size-4" aria-hidden />}
        title="Recent activity"
        hint="last 15 transactions"
        actions={<RefreshButton onClick={sigs.refresh} busy={sigs.refreshing} label="Refresh activity" />}
      />
      {sigs.loading ? (
        <ul className="space-y-2">
          {[0, 1, 2, 3].map((i) => (
            <li key={i}>
              <Skeleton className="h-[74px] w-full" />
            </li>
          ))}
        </ul>
      ) : sigs.error ? (
        <ErrorState message={`Could not load activity: ${sigs.error}`} onRetry={sigs.refresh} />
      ) : !sigs.data || sigs.data.length === 0 ? (
        <EmptyState
          title="No transactions yet"
          hint="This address has no recent activity on Cookie Chain — once it transacts, entries appear here automatically."
        />
      ) : (
        <ul className="scroll-slim max-h-[640px] space-y-2 overflow-y-auto pr-1">
          {sigs.data.map((summary) => (
            <ActivityRow
              key={summary.signature}
              summary={summary}
              detail={details[summary.signature]}
              ownerMapReady={!ownerMapLoading}
            />
          ))}
        </ul>
      )}
    </Card>
  )
}
