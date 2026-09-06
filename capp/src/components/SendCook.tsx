import { useEffect, useRef, useState, type FormEvent } from 'react'
import {
  ArrowUpRight,
  Ban,
  CheckCircle2,
  Clock3,
  Fuel,
  Loader2,
  Send as SendIcon,
  ShieldAlert,
  Wallet,
} from 'lucide-react'
import { PublicKey } from '@solana/web3.js'
import {
  CHAIN,
  FALLBACK_FEE_LAMPORTS,
  estimateTransferFee,
  explorerTx,
  getConnection,
  pollSignatureStatus,
  type ConfirmPhase,
} from '../lib/chain'
import { readableWalletError, sendCookTransfer, type InjectedProvider } from '../lib/wallet'
import { fmtCookFromLamports, parseCookAmount } from '../lib/format'
import { toast } from './Toast'
import { Card, CardTitle, ErrorState, Pill } from './primitives'

type SendPhase = 'idle' | 'signing' | 'pending' | 'confirmed' | 'finalized'

interface SendError {
  kind: 'validation' | 'wallet' | 'rpc' | 'timeout'
  message: string
}

/**
 * Send COOK — legacy SystemProgram.transfer signed by the connected wallet
 * (Nightly first), latest blockhash from the Cookie Chain RPC, then polled via
 * getSignatureStatuses until confirmed/finalized (max ~60s).
 */
export function SendCook({
  address,
  provider,
  providerName,
  balanceLamports,
  onSent,
}: {
  /** The CONNECTED wallet address (source of funds). */
  address: string
  provider: InjectedProvider | null
  providerName: string
  balanceLamports: number | null
  onSent?: () => void
}) {
  const [recipient, setRecipient] = useState('')
  const [amount, setAmount] = useState('')
  const [recipientError, setRecipientError] = useState<string | null>(null)
  const [amountError, setAmountError] = useState<string | null>(null)
  const [phase, setPhase] = useState<SendPhase>('idle')
  const [signature, setSignature] = useState<string | null>(null)
  const [feeLamports, setFeeLamports] = useState<number | null>(null)
  const [error, setError] = useState<SendError | null>(null)
  const mounted = useRef(true)
  const sigRef = useRef<string | null>(null)

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  // Live fee estimate once the recipient parses (fee is message-size based).
  useEffect(() => {
    let valid = false
    try {
      new PublicKey(recipient.trim())
      valid = true
    } catch {
      valid = false
    }
    if (!valid) {
      setFeeLamports(null)
      return
    }
    let stale = false
    estimateTransferFee(address, new PublicKey(recipient.trim()).toBase58(), 1_000)
      .then((fee) => {
        if (!stale && mounted.current) setFeeLamports(fee)
      })
      .catch(() => {
        if (!stale && mounted.current) setFeeLamports(FALLBACK_FEE_LAMPORTS)
      })
    return () => {
      stale = true
    }
  }, [recipient, address])

  const effectiveFee = feeLamports ?? FALLBACK_FEE_LAMPORTS
  const maxSpend = balanceLamports != null ? Math.max(0, balanceLamports - effectiveFee) : null

  const validate = (): { to: string; lamports: number } | null => {
    let ok = true
    let to = ''
    setRecipientError(null)
    setAmountError(null)
    setError(null)

    const trimmedRecipient = recipient.trim()
    try {
      to = new PublicKey(trimmedRecipient).toBase58()
    } catch {
      setRecipientError('Enter a valid base58 public key')
      ok = false
    }
    if (ok && to === address) {
      setRecipientError('You are already the owner of that address')
      ok = false
    }

    const parsed = parseCookAmount(amount)
    if (!parsed.ok) {
      setAmountError(parsed.error)
      ok = false
    } else if (maxSpend != null && parsed.lamports > maxSpend) {
      setAmountError(
        `Amount plus ~${fmtCookFromLamports(effectiveFee)} COOK fee exceeds your balance (${fmtCookFromLamports(balanceLamports ?? 0)} COOK)`,
      )
      ok = false
    }
    return ok ? { to, lamports: parsed.ok ? parsed.lamports : 0 } : null
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (phase === 'signing' || phase === 'pending') return
    const valid = validate()
    if (!valid) return
    if (!provider) {
      setError({ kind: 'wallet', message: 'No connected wallet — connect Nightly (or Phantom) first' })
      return
    }

    setError(null)
    setPhase('signing')
    setSignature(null)
    sigRef.current = null
    try {
      const { signature: sig } = await sendCookTransfer({
        provider,
        from: address,
        to: valid.to,
        lamports: valid.lamports,
        connection: getConnection(),
      })
      if (!mounted.current) return
      sigRef.current = sig
      setSignature(sig)
      setPhase('pending')
      toast.info('Transaction sent', {
        description: 'Waiting for the network to confirm…',
        link: { label: 'View on cookiescan', href: explorerTx(sig) },
      })

      const result = await pollSignatureStatus(sig, {
        timeoutMs: 60_000,
        intervalMs: 2_000,
        onPhase: (p: ConfirmPhase) => {
          if (mounted.current) setPhase(p === 'finalized' ? 'finalized' : 'confirmed')
        },
      })
      if (!mounted.current) return
      if (result.err) {
        setPhase('idle')
        setError({ kind: 'rpc', message: 'The transaction failed on-chain' })
        toast.error('Transaction failed on-chain', {
          description: 'The network rejected this transaction — see the explorer for details.',
          link: { label: 'View on cookiescan', href: explorerTx(sig) },
        })
      } else {
        setPhase(result.phase === 'finalized' ? 'finalized' : 'confirmed')
        toast.success(`Transfer ${result.phase === 'finalized' ? 'finalized' : 'confirmed'} ✓`, {
          description: `${fmtCookFromLamports(valid.lamports)} COOK sent to ${valid.to.slice(0, 4)}…${valid.to.slice(-4)}`,
          link: { label: 'View on cookiescan', href: explorerTx(sig) },
        })
        setRecipient('')
        setAmount('')
        onSent?.()
      }
    } catch (err) {
      if (!mounted.current) return
      const message = readableWalletError(err)
      const aborted = (err as Error)?.message === 'aborted'
      if (aborted) {
        setError({ kind: 'timeout', message: 'Timed out after ~60s — check the signature on the explorer' })
        const sig = sigRef.current
        toast.error('Confirmation timed out', {
          description: sig
            ? 'The tx may still land — check its status on the explorer.'
            : 'No signature was returned by the wallet.',
          link: sig ? { label: 'View on cookiescan', href: explorerTx(sig) } : undefined,
        })
      } else {
        const kind: SendError['kind'] = /rpc|network|fetch/i.test(message) ? 'rpc' : 'wallet'
        setPhase('idle')
        setError({ kind, message })
        toast.error('Transfer failed', { description: message })
      }
    }
  }

  const busy = phase === 'signing' || phase === 'pending'
  const done = phase === 'confirmed' || phase === 'finalized'

  const phasePill = (() => {
    switch (phase) {
      case 'signing':
        return (
          <Pill tone="amber">
            <ShieldAlert className="size-3" aria-hidden /> Waiting for your wallet…
          </Pill>
        )
      case 'pending':
        return (
          <Pill tone="pending">
            <Loader2 className="size-3 animate-spin" aria-hidden /> Pending
          </Pill>
        )
      case 'confirmed':
        return (
          <Pill tone="success">
            <CheckCircle2 className="size-3" aria-hidden /> Confirmed
          </Pill>
        )
      case 'finalized':
        return (
          <Pill tone="success">
            <CheckCircle2 className="size-3" aria-hidden /> Finalized
          </Pill>
        )
      default:
        return null
    }
  })()

  return (
    <Card>
      <CardTitle
        icon={<SendIcon className="size-4" aria-hidden />}
        title="Send COOK"
        hint={`via ${providerName}`}
        actions={phasePill}
      />

      {!provider ? (
        <div className="flex flex-col items-start gap-3 rounded-xl border border-amber-400/20 bg-amber-400/[0.05] p-4">
          <p className="flex items-center gap-2 text-sm text-amber-200/90">
            <Wallet className="size-4 shrink-0" aria-hidden />
            Connect a wallet to send COOK — read-only mode cannot sign transactions.
          </p>
          <p className="text-xs text-cream-600">
            There is no faucet on Cookie Chain; gas is always paid by your own wallet.
          </p>
        </div>
      ) : (
        <form onSubmit={submit} noValidate className="space-y-4">
          <div>
            <label htmlFor="send-recipient" className="mb-1.5 block text-xs font-medium text-cream-400">
              Recipient address
            </label>
            <input
              id="send-recipient"
              value={recipient}
              onChange={(e) => {
                setRecipient(e.target.value)
                setRecipientError(null)
                setError(null)
              }}
              spellCheck={false}
              autoComplete="off"
              placeholder="Base58 public key…"
              aria-invalid={recipientError != null}
              aria-describedby={recipientError ? 'recipient-error' : undefined}
              className={`w-full rounded-xl border bg-cocoa-900/80 px-3 py-2.5 font-mono text-xs text-cream-100 placeholder:text-cream-700 focus:outline-none ${
                recipientError ? 'border-red-500/50' : 'border-white/10 focus:border-amber-glow/50'
              }`}
            />
            {recipientError && (
              <p id="recipient-error" role="alert" className="mt-1.5 text-xs text-red-400">
                {recipientError}
              </p>
            )}
          </div>

          <div>
            <div className="mb-1.5 flex items-baseline justify-between">
              <label htmlFor="send-amount" className="block text-xs font-medium text-cream-400">
                Amount (COOK)
              </label>
              <button
                type="button"
                onClick={() => {
                  if (maxSpend != null) {
                    setAmount((maxSpend / 1e9).toFixed(9).replace(/0+$/, '').replace(/\.$/, ''))
                    setAmountError(null)
                    setError(null)
                  }
                }}
                disabled={maxSpend == null}
                className="rounded-lg px-2 py-1 text-[11px] font-semibold text-amber-glow/90 transition hover:bg-amber-glow/10 disabled:opacity-40"
              >
                MAX
              </button>
            </div>
            <input
              id="send-amount"
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value)
                setAmountError(null)
                setError(null)
              }}
              inputMode="decimal"
              autoComplete="off"
              placeholder="0.0"
              aria-invalid={amountError != null}
              aria-describedby={amountError ? 'amount-error' : undefined}
              className={`w-full rounded-xl border bg-cocoa-900/80 px-3 py-2.5 font-mono text-sm text-cream-100 placeholder:text-cream-700 focus:outline-none ${
                amountError ? 'border-red-500/50' : 'border-white/10 focus:border-amber-glow/50'
              }`}
            />
            {amountError ? (
              <p id="amount-error" role="alert" className="mt-1.5 text-xs text-red-400">
                {amountError}
              </p>
            ) : (
              <p className="mt-1.5 text-xs text-cream-600">
                Available to spend: {maxSpend != null ? `${fmtCookFromLamports(maxSpend)} COOK` : '—'} (balance minus fee)
              </p>
            )}
          </div>

          <div className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5 text-xs text-cream-400">
            <span className="flex items-center gap-1.5">
              <Fuel className="size-3.5 text-amber-glow/80" aria-hidden />
              Estimated network fee
            </span>
            <span className="font-mono text-cream-200">
              {feeLamports != null ? `${fmtCookFromLamports(feeLamports)} COOK` : `≈ ${fmtCookFromLamports(FALLBACK_FEE_LAMPORTS)} COOK`}
            </span>
          </div>

          {error && (
            <ErrorState message={error.message} />
          )}

          {signature && (busy || done) && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
              <span className="flex items-center gap-2 font-mono text-xs text-cream-400">
                {done ? (
                  <CheckCircle2 className="size-3.5 text-emerald-400" aria-hidden />
                ) : (
                  <Clock3 className="size-3.5 text-amber-glow" aria-hidden />
                )}
                {signature.slice(0, 10)}…{signature.slice(-6)}
              </span>
              <a
                href={explorerTx(signature)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-11 items-center gap-1 rounded-lg px-2 text-xs font-medium text-amber-glow transition hover:bg-amber-glow/10"
              >
                Explorer <ArrowUpRight className="size-3" aria-hidden />
              </a>
            </div>
          )}

          <button
            type="submit"
            disabled={busy}
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-amber-glow px-4 text-sm font-semibold text-cocoa-950 shadow-lg shadow-amber-glow/15 transition hover:bg-amber-300 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
          >
            {phase === 'signing' ? (
              <>
                <Ban className="size-4" aria-hidden /> Check your wallet popup…
              </>
            ) : phase === 'pending' ? (
              <>
                <Loader2 className="size-4 animate-spin" aria-hidden /> Confirming…
              </>
            ) : done ? (
              <>
                <CheckCircle2 className="size-4" aria-hidden /> Sent — send another
              </>
            ) : (
              <>
                <SendIcon className="size-4" aria-hidden /> Sign &amp; Send
              </>
            )}
          </button>

          <p className="text-[11px] leading-relaxed text-cream-600">
            Transactions are signed by your {providerName} wallet and pay gas in COOK. Make sure your
            wallet is configured for Cookie Chain ({CHAIN.rpcUrl}) — see{' '}
            <a href={CHAIN.walletsDoc} target="_blank" rel="noreferrer" className="text-amber-glow/80 underline underline-offset-2 hover:text-amber-glow">
              wallet setup
            </a>
            .
          </p>
        </form>
      )}
    </Card>
  )
}
