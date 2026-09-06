import { useMemo, useState } from 'react'
import { Activity, Cpu, Cookie, Gauge, Layers3, Timer } from 'lucide-react'
import {
  getCurrentSlot,
  getEpochInfoLite,
  getNodeVersion,
  getPerformanceSamples,
  getSupplyLite,
  type EpochInfoLite,
  type PerfSample,
  type SupplyLite,
} from '../lib/chain'
import { fmtCookFromLamports, fmtCompact, fmtInt } from '../lib/format'
import { usePoll } from '../lib/hooks'
import { Card, CardTitle, ErrorState, RefreshButton, Skeleton } from './primitives'

/* ---------------- Slot ticker (polls every 3s) ---------------- */

function SlotTicker() {
  const slot = usePoll(() => getCurrentSlot(), 3_000, [])
  return (
    <Card className="flex flex-col justify-between">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-amber-glow">
          <Gauge className="size-4" aria-hidden />
          <h2 className="text-sm font-semibold tracking-wide uppercase">Slot</h2>
        </div>
        <span className="flex items-center gap-1.5 text-[11px] font-medium text-emerald-400">
          <span className="animate-pulse-dot inline-block size-1.5 rounded-full bg-emerald-400" aria-hidden />
          live
        </span>
      </div>
      {slot.loading ? (
        <Skeleton className="mt-4 h-9 w-40" />
      ) : slot.error ? (
        <p className="mt-4 text-xs text-red-400">{slot.error}</p>
      ) : (
        <p className="mt-3 font-mono text-3xl font-bold tracking-tight text-cream-50" aria-live="off">
          {fmtInt(slot.data)}
        </p>
      )}
      <p className="mt-1 text-[11px] text-cream-600">Polling the RPC every 3s</p>
    </Card>
  )
}

/* ---------------- TPS chart (hand-rolled inline SVG) ---------------- */

function TpsChart({ samples }: { samples: PerfSample[] }) {
  const [hover, setHover] = useState<number | null>(null)

  // samples come newest-first from the RPC; chart reads oldest → newest
  const ordered = useMemo(() => [...samples].reverse(), [samples])
  const w = 640
  const h = 200
  const padT = 14
  const padB = 26
  const padL = 44
  const padR = 10

  const values = ordered.map((s) => s.tps)
  const max = Math.max(0.001, ...values) * 1.15
  const innerW = w - padL - padR
  const innerH = h - padT - padB
  const x = (i: number) => padL + (ordered.length <= 1 ? innerW / 2 : (i / (ordered.length - 1)) * innerW)
  const y = (v: number) => padT + innerH - (v / max) * innerH

  const linePath = ordered.map((s, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(s.tps).toFixed(1)}`).join(' ')
  const areaPath = `${linePath} L${x(ordered.length - 1).toFixed(1)},${padT + innerH} L${x(0).toFixed(1)},${padT + innerH} Z`

  const gridValues = [0, max / 2, max]
  const latest = ordered[ordered.length - 1]
  const hovered = hover != null ? ordered[hover] : null

  const onMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const relX = ((e.clientX - rect.left) / rect.width) * w
    if (ordered.length < 2) return
    const idx = Math.round(((relX - padL) / innerW) * (ordered.length - 1))
    setHover(Math.max(0, Math.min(ordered.length - 1, idx)))
  }

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${w} ${h}`}
        role="img"
        aria-label={`TPS over the last ${ordered.length} performance samples. Latest ${latest ? latest.tps.toFixed(2) : '—'} transactions per second.`}
        className="w-full touch-none"
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id="tps-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#fbbf24" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#fbbf24" stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {gridValues.map((v, i) => (
          <g key={i}>
            <line x1={padL} y1={y(v)} x2={w - padR} y2={y(v)} stroke="rgba(255,255,255,0.07)" strokeWidth="1" />
            <text x={padL - 8} y={y(v) + 4} textAnchor="end" className="fill-cream-600" fontSize="10">
              {v.toFixed(v < 10 ? 1 : 0)}
            </text>
          </g>
        ))}

        {ordered.length > 1 && (
          <>
            <path d={areaPath} fill="url(#tps-fill)" />
            <path d={linePath} fill="none" stroke="#fbbf24" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
            <circle cx={x(ordered.length - 1)} cy={y(latest.tps)} r="3.5" fill="#fbbf24" stroke="#1a1410" strokeWidth="1.5" />
          </>
        )}

        {hovered && hover != null && (
          <g>
            <line x1={x(hover)} y1={padT} x2={x(hover)} y2={padT + innerH} stroke="rgba(251,191,36,0.4)" strokeDasharray="3 3" />
            <circle cx={x(hover)} cy={y(hovered.tps)} r="4.5" fill="#fde68a" stroke="#1a1410" strokeWidth="1.5" />
          </g>
        )}

        <text x={padL} y={h - 8} className="fill-cream-600" fontSize="10">
          {ordered.length > 0 ? `slot ${fmtInt(ordered[0].slot)}` : ''}
        </text>
        <text x={w - padR} y={h - 8} textAnchor="end" className="fill-cream-600" fontSize="10">
          {ordered.length > 0 ? `slot ${fmtInt(latest.slot)} · now` : ''}
        </text>
      </svg>

      {hovered && (
        <div
          className="pointer-events-none absolute top-1 rounded-lg border border-white/10 bg-cocoa-950/95 px-2.5 py-1.5 text-[11px] shadow-xl"
          style={{
            left: `${Math.min(85, Math.max(4, ((x(hover ?? 0) - padL) / innerW) * 100))}%`,
            transform: 'translateX(-50%)',
          }}
        >
          <p className="font-semibold text-amber-glow">{hovered.tps.toFixed(2)} TPS</p>
          <p className="text-cream-500">{fmtInt(hovered.numTransactions)} txs / {hovered.samplePeriodSecs}s</p>
        </div>
      )}
    </div>
  )
}

function TpsCard() {
  const perf = usePoll(() => getPerformanceSamples(30), 30_000, [])
  const latestNonVote = perf.data?.length ? perf.data[perf.data.length - 1].nonVoteTps : null

  return (
    <Card>
      <CardTitle
        icon={<Activity className="size-4" aria-hidden />}
        title="Network TPS"
        hint="last 30 performance samples"
        actions={<RefreshButton onClick={perf.refresh} busy={perf.refreshing} label="Refresh performance samples" />}
      />
      {perf.loading ? (
        <Skeleton className="h-[200px] w-full" />
      ) : perf.error ? (
        <ErrorState message={`Could not load performance samples: ${perf.error}`} onRetry={perf.refresh} />
      ) : perf.data && perf.data.length > 0 ? (
        <>
          <TpsChart samples={perf.data} />
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-cream-600">
            <span>Includes validator vote transactions</span>
            {latestNonVote != null && (
              <span>
                non-vote TPS now: <span className="font-mono text-cream-300">{latestNonVote.toFixed(2)}</span>
              </span>
            )}
          </div>
        </>
      ) : (
        <p className="text-sm text-cream-500">No performance samples available.</p>
      )}
    </Card>
  )
}

/* ---------------- Epoch progress ---------------- */

function EpochCard({ epoch }: { epoch: EpochInfoLite | null }) {
  if (!epoch) return null
  const pct = Math.min(100, (epoch.slotIndex / epoch.slotsInEpoch) * 100)
  const remaining = epoch.slotsInEpoch - epoch.slotIndex
  return (
    <Card>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-amber-glow">
          <Timer className="size-4" aria-hidden />
          <h2 className="text-sm font-semibold tracking-wide uppercase">Epoch {fmtInt(epoch.epoch)}</h2>
        </div>
        <span className="font-mono text-xs text-cream-400">{pct.toFixed(1)}%</span>
      </div>
      <div
        className="mt-4 h-3 w-full overflow-hidden rounded-full bg-cocoa-950"
        role="progressbar"
        aria-valuenow={Math.round(pct)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Epoch ${epoch.epoch} progress`}
      >
        <div
          className="h-full rounded-full bg-gradient-to-r from-caramel to-amber-glow transition-[width] duration-700"
          style={{ width: `${pct}%` }}
        />
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
        <div>
          <dt className="text-cream-600">Slot in epoch</dt>
          <dd className="font-mono text-cream-200">
            {fmtInt(epoch.slotIndex)} / {fmtInt(epoch.slotsInEpoch)}
          </dd>
        </div>
        <div>
          <dt className="text-cream-600">Slots remaining</dt>
          <dd className="font-mono text-cream-200">{fmtInt(remaining)}</dd>
        </div>
        <div>
          <dt className="text-cream-600">Total transactions</dt>
          <dd className="font-mono text-cream-200">{fmtCompact(epoch.transactionCount)}</dd>
        </div>
        <div>
          <dt className="text-cream-600">Block height</dt>
          <dd className="font-mono text-cream-200">{fmtCompact(epoch.blockHeight)}</dd>
        </div>
      </dl>
    </Card>
  )
}

/* ---------------- Supply + version ---------------- */

function SupplyCard({ supply }: { supply: SupplyLite | null }) {
  return (
    <Card>
      <div className="flex items-center gap-2 text-amber-glow">
        <Cookie className="size-4" aria-hidden />
        <h2 className="text-sm font-semibold tracking-wide uppercase">COOK supply</h2>
      </div>
      {supply == null ? (
        <Skeleton className="mt-4 h-9 w-48" />
      ) : (
        <>
          <p className="mt-3 font-mono text-3xl font-bold tracking-tight text-cream-50">
            {fmtCookFromLamports(supply.circulating, { compact: true })}
            <span className="ml-2 text-sm font-semibold text-amber-glow">circulating</span>
          </p>
          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
            <div>
              <dt className="text-cream-600">Total</dt>
              <dd className="font-mono text-cream-200">{fmtCookFromLamports(supply.total, { compact: true })}</dd>
            </div>
            <div>
              <dt className="text-cream-600">Non-circulating</dt>
              <dd className="font-mono text-cream-200">{fmtCookFromLamports(supply.nonCirculating, { compact: true })}</dd>
            </div>
          </dl>
        </>
      )}
    </Card>
  )
}

function VersionCard({ version }: { version: string | null }) {
  return (
    <Card className="flex flex-col justify-between">
      <div className="flex items-center gap-2 text-amber-glow">
        <Cpu className="size-4" aria-hidden />
        <h2 className="text-sm font-semibold tracking-wide uppercase">Node</h2>
      </div>
      {version == null ? (
        <Skeleton className="mt-4 h-9 w-32" />
      ) : (
        <p className="mt-3 font-mono text-2xl font-bold text-cream-50">v{version}</p>
      )}
      <p className="mt-1 flex items-center gap-1.5 text-[11px] text-cream-600">
        <Layers3 className="size-3" aria-hidden /> solana-core · SVM compatible
      </p>
    </Card>
  )
}

/* ---------------- Composite ---------------- */

export function NetworkPulse() {
  const epoch = usePoll(getEpochInfoLite, 30_000, [])
  const supply = usePoll(getSupplyLite, 60_000, [])
  const version = usePoll(getNodeVersion, null, [])

  const hasError = epoch.error && supply.error && version.error

  return (
    <div className="space-y-4 sm:space-y-6">
      {hasError ? (
        <Card>
          <ErrorState
            message={`Cookie Chain RPC is unreachable right now: ${epoch.error ?? supply.error ?? version.error}`}
            onRetry={() => {
              epoch.refresh()
              supply.refresh()
              version.refresh()
            }}
          />
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-4">
            <SlotTicker />
            <EpochCard epoch={epoch.data} />
            <SupplyCard supply={supply.data} />
            <VersionCard version={version.data} />
          </div>
          <TpsCard />
        </>
      )}
    </div>
  )
}
