/**
 * CookieLens — Your lens into Cookie Chain
 * ============================================================
 * FEATURE MAP (product requirements at a glance):
 *
 *  1. Wallet connection (Nightly first) + display of connected address
 *     → lib/wallet.ts (Nightly → Phantom → injected detection), Header
 *       connect/disconnect, AddressChip click-to-copy. Includes a READ-ONLY
 *       lookup mode: paste ANY address to explore its dashboard without a
 *       wallet (Cookie Jar vault pre-filled as the example).
 *  2. Display connected wallet address + COOK balance + SPL token accounts
 *     → WalletPanel.tsx (BalanceCard via getBalance, TokenList via
 *       getTokenAccountsByOwner jsonParsed, both Token programs).
 *  3. Transaction execution + confirmation handling
 *     → SendCook.tsx: SystemProgram.transfer legacy tx + latest blockhash,
 *       provider.signAndSendTransaction, getSignatureStatuses polling
 *       (pending → confirmed → finalized pill, ~60s cap), full error states.
 *  4. Real-time feedback + application-specific activity views
 *     → Toast system + tx status pill + live slot ticker;
 *       ActivityFeed.tsx: getSignaturesForAddress + lazy getTransaction
 *       enrichment (type, amount, fee, success/fail, explorer links).
 *  5. Analytics / charts / dashboards
 *     → NetworkPulse.tsx: live slot ticker (3s poll), hand-rolled SVG TPS
 *       area chart from getRecentPerformanceSamples(30), epoch progress bar,
 *       COOK supply, node version, total transactions.
 *  6. Error handling and user feedback
 *     → genesis-hash network verification (green verified badge / red
 *       wrong-network banner), inline validation, toasts, skeletons,
 *       empty states, retryable error cards everywhere.
 *
 * Chain facts: RPC https://rpc.cookiescan.io · COOK 9 decimals · genesis
 * 9wDaBRDgArEUpvhHxGguNkwozsZh4UpGZB9o2EoEcBB2 · explorer cookiescan.io.
 * There is NO faucet on Cookie Chain — CookieLens never promises COOK; all
 * gas is paid by the connected user's wallet.
 * ============================================================
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Cookie, LogOut, Radio, Wallet } from 'lucide-react'
import {
  CHAIN,
  getBalanceLamports,
  getGenesisHash,
} from './lib/chain'
import {
  addressFromConnectResult,
  addressFromProvider,
  detectWallet,
  detectWalletWithRetry,
  readableWalletError,
  type DetectedWallet,
  type InjectedProvider,
} from './lib/wallet'
import { usePoll } from './lib/hooks'
import { toast, ToastViewport } from './components/Toast'
import { AddressChip } from './components/AddressChip'
import { NetworkBadge, WrongNetworkBanner, type NetworkState } from './components/NetworkBadge'
import { Hero } from './components/Hero'
import { BalanceCard, TokenList, useTokenOwnerMap } from './components/WalletPanel'
import { SendCook } from './components/SendCook'
import { ActivityFeed } from './components/ActivityFeed'
import { NetworkPulse } from './components/NetworkPulse'
import { Footer } from './components/Footer'

type Tab = 'wallet' | 'activity' | 'network'

interface ConnectedWallet {
  kind: DetectedWallet['kind']
  name: string
  provider: InjectedProvider
  address: string
}

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'wallet', label: 'Wallet' },
  { id: 'activity', label: 'Activity' },
  { id: 'network', label: 'Network Pulse' },
]

export default function App() {
  const [tab, setTab] = useState<Tab>('wallet')
  const [wallet, setWallet] = useState<ConnectedWallet | null>(null)
  const [connecting, setConnecting] = useState(false)
  const [exploreAddress, setExploreAddress] = useState<string | null>(null)
  const [networkState, setNetworkState] = useState<NetworkState>('checking')
  const [actualGenesis, setActualGenesis] = useState<string | null>(null)
  const walletRef = useRef<DetectedWallet | null>(null)

  /* ---- Network genesis verification (feature 6) ---- */
  useEffect(() => {
    let cancelled = false
    getGenesisHash()
      .then((hash) => {
        if (cancelled) return
        setActualGenesis(hash)
        setNetworkState(hash === CHAIN.genesisHash ? 'ok' : 'mismatch')
      })
      .catch(() => {
        if (!cancelled) setNetworkState('mismatch')
      })
    return () => {
      cancelled = true
    }
  }, [])

  /* ---- Silent reconnect: provider already grants a session ---- */
  useEffect(() => {
    let cancelled = false
    detectWalletWithRetry().then((detected) => {
      if (cancelled || !detected) return
      walletRef.current = detected
      const existing = addressFromProvider(detected.provider)
      if (existing) {
        setWallet({
          kind: detected.kind,
          name: detected.name,
          provider: detected.provider,
          address: existing,
        })
      }
    })
    return () => {
      cancelled = true
    }
  }, [])

  /* ---- Wallet lifecycle events ---- */
  useEffect(() => {
    if (!wallet) return
    const provider = wallet.provider
    const onAccountChanged = (pk: unknown) => {
      const next = addressFromConnectResult(pk)
      if (!next) {
        setWallet(null)
        toast.info('Wallet disconnected')
      } else if (next !== wallet.address) {
        setWallet((prev) => (prev ? { ...prev, address: next } : prev))
        toast.info('Wallet account changed', { description: `Now viewing ${next.slice(0, 4)}…${next.slice(-4)}` })
      }
    }
    const onDisconnect = () => {
      setWallet(null)
      toast.info('Wallet disconnected')
    }
    provider.on?.('accountChanged', onAccountChanged)
    provider.on?.('disconnect', onDisconnect)
    return () => {
      provider.removeListener?.('accountChanged', onAccountChanged)
      provider.removeListener?.('disconnect', onDisconnect)
    }
  }, [wallet])

  const connect = useCallback(async () => {
    if (connecting || networkState === 'mismatch') {
      if (networkState === 'mismatch') {
        toast.error('Cannot connect', {
          description: 'The RPC did not verify as Cookie Chain — check the banner above.',
        })
      }
      return
    }
    const detected = walletRef.current ?? detectWallet()
    if (!detected) {
      walletRef.current = await detectWalletWithRetry()
      const retry = walletRef.current
      if (!retry) {
        toast.error('No wallet found', {
          description: 'Install Nightly (nightly.app) and configure Cookie Chain — see docs.cookiechain.wtf/wallets.',
        })
        return
      }
    }
    const target = (walletRef.current ?? detected)!
    setConnecting(true)
    try {
      const result = await target.provider.connect()
      const address = addressFromConnectResult(result) ?? addressFromProvider(target.provider)
      if (!address) throw new Error('Wallet did not return a public key')
      setWallet({ kind: target.kind, name: target.name, provider: target.provider, address })
      toast.success(`Connected via ${target.name}`, {
        description: `${address.slice(0, 6)}…${address.slice(-4)} · Cookie Chain`,
      })
    } catch (err) {
      toast.error('Connection failed', { description: readableWalletError(err) })
    } finally {
      setConnecting(false)
    }
  }, [connecting, networkState])

  const disconnect = useCallback(async () => {
    const provider = wallet?.provider
    setWallet(null)
    try {
      await provider?.disconnect?.()
    } catch {
      /* wallet already gone — nothing to do */
    }
    toast.info('Disconnected', { description: 'Wallet session ended. Data still viewable in read-only mode.' })
  }, [wallet])

  /* ---- Viewed address: connected wallet wins; else read-only explore ---- */
  const viewAddress = wallet?.address ?? exploreAddress
  const mode: 'connected' | 'explore' | 'empty' = wallet ? 'connected' : exploreAddress ? 'explore' : 'empty'
  const balance = usePoll(viewAddress ? () => getBalanceLamports(viewAddress) : async () => 0, 15_000, [viewAddress])
  const ownerMap = useTokenOwnerMap(viewAddress ?? CHAIN.exampleAddress)

  const onExplore = (address: string) => {
    setExploreAddress(address)
    setTab('wallet')
    toast.info('Read-only explorer', {
      description: `Showing on-chain data for ${address.slice(0, 6)}…${address.slice(-4)}`,
    })
  }

  const header = useMemo(
    () => (
      <header className="sticky top-0 z-40 border-b border-white/[0.06] bg-cocoa-900/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-amber-glow/15 text-amber-glow">
              <Cookie className="size-5" aria-hidden />
            </span>
            <div className="min-w-0 leading-tight">
              <p className="truncate text-sm font-bold tracking-tight text-cream-50">
                Cookie<span className="text-amber-glow">Lens</span>
              </p>
              <p className="hidden text-[11px] text-cream-600 sm:block">Your lens into Cookie Chain</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <NetworkBadge state={networkState} />
            {wallet ? (
              <div className="flex items-center gap-2">
                <span className="hidden md:flex">
                  <AddressChip address={wallet.address} head={4} tail={4} />
                </span>
                <span className="hidden items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-medium text-emerald-300 lg:inline-flex">
                  <span className="inline-block size-1.5 rounded-full bg-emerald-400" aria-hidden />
                  {wallet.name}
                </span>
                <button
                  type="button"
                  onClick={disconnect}
                  aria-label="Disconnect wallet"
                  title="Disconnect wallet"
                  className="inline-flex size-11 items-center justify-center rounded-xl border border-white/10 text-cream-400 transition hover:border-red-500/40 hover:bg-red-500/10 hover:text-red-300"
                >
                  <LogOut className="size-4" aria-hidden />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={connect}
                disabled={connecting}
                className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-amber-glow px-3.5 text-sm font-semibold text-cocoa-950 shadow-lg shadow-amber-glow/20 transition hover:bg-amber-300 active:scale-[0.98] disabled:opacity-60"
              >
                <Wallet className="size-4" aria-hidden />
                <span className="hidden sm:inline">{connecting ? 'Connecting…' : 'Connect wallet'}</span>
                <span className="sm:hidden">{connecting ? '…' : 'Connect'}</span>
              </button>
            )}
          </div>
        </div>
      </header>
    ),
    [networkState, wallet, connecting, disconnect, connect],
  )

  return (
    <div className="flex min-h-screen flex-col bg-cocoa-900">
      {header}
      {networkState === 'mismatch' && <WrongNetworkBanner actualHash={actualGenesis} />}

      {mode === 'empty' && <Hero detected={detectWallet()} onExplore={onExplore} onConnect={connect} />}

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:py-8">
        {mode !== 'empty' && (
          <>
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs">
                {mode === 'connected' ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 font-medium text-emerald-300">
                    <Radio className="size-3" aria-hidden />
                    Connected via {wallet!.name}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1 font-medium text-amber-glow">
                    <Radio className="size-3" aria-hidden />
                    Read-only explorer
                  </span>
                )}
                <AddressChip address={viewAddress!} head={6} tail={6} />
              </div>
              {mode === 'explore' && (
                <button
                  type="button"
                  onClick={() => setExploreAddress(null)}
                  className="inline-flex min-h-11 items-center rounded-xl border border-white/10 px-3 text-xs font-medium text-cream-400 transition hover:border-amber-glow/40 hover:text-amber-glow"
                >
                  Clear address
                </button>
              )}
            </div>

            <div role="tablist" aria-label="CookieLens sections" className="mb-5 flex gap-1 rounded-2xl border border-white/[0.06] bg-cocoa-800/60 p-1 sm:mb-6">
              {TABS.map(({ id, label }) => (
                <button
                  key={id}
                  role="tab"
                  aria-selected={tab === id}
                  onClick={() => setTab(id)}
                  className={`min-h-11 flex-1 rounded-xl px-3 text-sm font-medium transition sm:flex-none sm:px-5 ${
                    tab === id
                      ? 'bg-amber-glow/15 text-amber-glow shadow-inner'
                      : 'text-cream-500 hover:bg-white/[0.04] hover:text-cream-200'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </>
        )}

        {mode === 'empty' ? (
          /* Landing state: still show Network Pulse below the hero so the
             dashboard feels alive even before any address is chosen. */
          <NetworkPulse />
        ) : (
          <div role="tabpanel" aria-label={TABS.find((t) => t.id === tab)?.label}>
            {tab === 'wallet' && (
              <div className="animate-rise-in grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-2">
                <div className="space-y-4 sm:space-y-6">
                  <BalanceCard address={viewAddress!} />
                  <TokenList address={viewAddress!} refreshKey={balance.data ?? 0} />
                </div>
                <SendCook
                  address={wallet?.address ?? viewAddress!}
                  provider={wallet?.provider ?? null}
                  providerName={wallet?.name ?? '—'}
                  balanceLamports={wallet ? (balance.data ?? null) : null}
                  onSent={() => {
                    balance.refresh()
                    ownerMap.refresh()
                  }}
                />
              </div>
            )}

            {tab === 'activity' && (
              <div className="animate-rise-in">
                <ActivityFeed
                  address={viewAddress!}
                  ownerMap={ownerMap.data ?? {}}
                  ownerMapLoading={ownerMap.loading}
                />
              </div>
            )}

            {tab === 'network' && (
              <div className="animate-rise-in">
                <NetworkPulse />
              </div>
            )}
          </div>
        )}
      </main>

      <Footer />
      <ToastViewport />
    </div>
  )
}
