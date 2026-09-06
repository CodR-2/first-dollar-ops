import { useState, type FormEvent } from 'react'
import { ArrowRight, Cookie, Download, Search, Wallet } from 'lucide-react'
import { PublicKey } from '@solana/web3.js'
import { CHAIN } from '../lib/chain'
import type { DetectedWallet } from '../lib/wallet'

/**
 * Hero / read-only lookup.
 * Anyone can paste ANY Cookie Chain address and explore that wallet's
 * dashboard without connecting — this powers demos on machines without a
 * wallet. The Cookie Jar vault is offered as the example address.
 */
export function Hero({
  detected,
  onExplore,
  onConnect,
}: {
  detected: DetectedWallet | null
  onExplore: (address: string) => void
  onConnect: () => void
}) {
  const [value, setValue] = useState('')
  const [error, setError] = useState<string | null>(null)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const candidate = value.trim()
    if (!candidate) {
      setError('Paste an address, or explore the example below')
      return
    }
    try {
      new PublicKey(candidate)
      setError(null)
      onExplore(candidate)
    } catch {
      setError('That is not a valid base58 public key')
    }
  }

  return (
    <section className="animate-rise-in border-b border-white/[0.06] bg-gradient-to-b from-cocoa-850 to-cocoa-900">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:py-14">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-400/25 bg-amber-400/10 px-3 py-1 text-xs font-medium text-amber-glow">
              <Cookie className="size-3.5" aria-hidden />
              Live on Cookie Chain · epoch-synchronized
            </div>
            <h1 className="mt-4 text-3xl font-bold tracking-tight text-cream-50 sm:text-4xl">
              Your lens into <span className="text-amber-glow">Cookie&nbsp;Chain</span>
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-cream-400 sm:text-base">
              Wallet dashboards, live network analytics, and a COOK transfer station —
              all client-side, straight from the chain&apos;s own RPC. Connect with Nightly,
              or explore any address read-only below.
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-3">
              {detected ? (
                <button
                  type="button"
                  onClick={onConnect}
                  className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-amber-glow px-4 text-sm font-semibold text-cocoa-950 shadow-lg shadow-amber-glow/20 transition hover:bg-amber-300 active:scale-[0.98]"
                >
                  <Wallet className="size-4" aria-hidden />
                  Connect {detected.name}
                </button>
              ) : (
                <a
                  href="https://nightly.app"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-amber-glow px-4 text-sm font-semibold text-cocoa-950 shadow-lg shadow-amber-glow/20 transition hover:bg-amber-300 active:scale-[0.98]"
                >
                  <Download className="size-4" aria-hidden />
                  Install Nightly
                </a>
              )}
              <a
                href={CHAIN.docs}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-11 items-center rounded-xl border border-white/10 px-4 text-sm font-medium text-cream-300 transition hover:border-amber-glow/40 hover:text-amber-glow"
              >
                Chain docs
              </a>
            </div>
            {!detected && (
              <p className="mt-3 max-w-md text-xs leading-relaxed text-cream-600">
                No Solana wallet detected in this browser. Nightly is the wallet required by
                Cookie Chain — after installing, add the Cookie Chain network with the custom RPC
                from the{' '}
                <a href={CHAIN.walletsDoc} target="_blank" rel="noreferrer" className="text-amber-glow/80 underline underline-offset-2 hover:text-amber-glow">
                  wallet setup guide
                </a>
                .
              </p>
            )}
          </div>

          <form
            onSubmit={submit}
            className="w-full max-w-md rounded-2xl border border-white/[0.06] bg-cocoa-700/80 p-4 shadow-xl shadow-black/30 sm:p-5"
            aria-labelledby="explore-heading"
          >
            <h2 id="explore-heading" className="text-sm font-semibold text-cream-100">
              Explore any address — no wallet needed
            </h2>
            <p className="mt-1 text-xs text-cream-600">
              Balance, tokens, and activity for any Cookie Chain account, read-only.
            </p>
            <label htmlFor="explore-input" className="sr-only">
              Cookie Chain address
            </label>
            <div className="mt-3 flex items-center gap-2 rounded-xl border border-white/10 bg-cocoa-900/80 px-3 transition focus-within:border-amber-glow/50">
              <Search className="size-4 shrink-0 text-cream-600" aria-hidden />
              <input
                id="explore-input"
                value={value}
                onChange={(e) => {
                  setValue(e.target.value)
                  setError(null)
                }}
                spellCheck={false}
                autoComplete="off"
                placeholder={`Try ${CHAIN.exampleAddress}`}
                aria-invalid={error != null}
                aria-describedby={error ? 'explore-error' : undefined}
                className="min-h-11 w-full bg-transparent py-2 font-mono text-xs text-cream-100 placeholder:text-cream-700 focus:outline-none"
              />
              <button
                type="submit"
                aria-label="Explore address"
                className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-amber-glow/15 text-amber-glow transition hover:bg-amber-glow/30"
              >
                <ArrowRight className="size-4" aria-hidden />
              </button>
            </div>
            {error && (
              <p id="explore-error" role="alert" className="mt-2 text-xs text-red-400">
                {error}
              </p>
            )}
            <button
              type="button"
              onClick={() => {
                setValue(CHAIN.exampleAddress)
                setError(null)
                onExplore(CHAIN.exampleAddress)
              }}
              className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-white/10 text-xs font-medium text-cream-300 transition hover:border-amber-glow/40 hover:bg-amber-glow/5 hover:text-amber-glow"
            >
              <Cookie className="size-3.5" aria-hidden />
              Explore the Cookie Jar vault (example)
            </button>
          </form>
        </div>
      </div>
    </section>
  )
}
