/**
 * lib/wallet.ts — Solana-style injected wallet detection + transfer flow.
 *
 * Nightly is the primary target wallet, so it is detected first
 * (window.nightly.solana). Phantom and generic injected providers are handled
 * as graceful fallbacks. No wallet-adapter packages — this app only needs
 * connect / disconnect / signAndSendTransaction.
 */
import {
  Connection,
  PublicKey,
  SystemProgram,
  Transaction,
  type TransactionSignature,
} from '@solana/web3.js'

export type WalletKind = 'nightly' | 'phantom' | 'injected'

export interface InjectedProvider {
  isNightly?: boolean
  isPhantom?: boolean
  connect(...args: unknown[]): Promise<unknown>
  disconnect?(): Promise<void>
  publicKey?: PublicKey | null
  signAndSendTransaction(transaction: Transaction, options?: unknown): Promise<{ signature: string } | string>
  on?(event: 'accountChanged' | 'disconnect' | 'connect', handler: (...args: unknown[]) => void): void
  removeListener?(event: 'accountChanged' | 'disconnect' | 'connect', handler: (...args: unknown[]) => void): void
}

export interface DetectedWallet {
  kind: WalletKind
  name: string
  provider: InjectedProvider
}

declare global {
  interface Window {
    nightly?: { solana?: InjectedProvider }
    phantom?: { solana?: InjectedProvider }
    solana?: InjectedProvider
  }
}

/**
 * Detection order per spec: Nightly → Phantom → generic injected (window.solana).
 * Returns null when no Solana-style provider is injected.
 */
export function detectWallet(): DetectedWallet | null {
  if (typeof window === 'undefined') return null
  const nightly = window.nightly?.solana
  if (nightly) return { kind: 'nightly', name: 'Nightly', provider: nightly }
  const phantom = window.phantom?.solana
  if (phantom) return { kind: 'phantom', name: 'Phantom', provider: phantom }
  const injected = window.solana
  if (injected) {
    const name = injected.isNightly ? 'Nightly' : injected.isPhantom ? 'Phantom' : 'Injected wallet'
    return { kind: 'injected', name, provider: injected }
  }
  return null
}

/** Wallets inject asynchronously — poll briefly before giving up. */
export async function detectWalletWithRetry(timeoutMs = 1_500): Promise<DetectedWallet | null> {
  const started = Date.now()
  for (;;) {
    const wallet = detectWallet()
    if (wallet) return wallet
    if (Date.now() - started >= timeoutMs) return null
    await new Promise((r) => setTimeout(r, 120))
  }
}

/** Normalize whatever a provider returns from connect() into a base58 address. */
export function addressFromConnectResult(result: unknown): string | null {
  const candidate =
    result && typeof result === 'object' && 'publicKey' in (result as Record<string, unknown>)
      ? (result as { publicKey: unknown }).publicKey
      : result
  if (!candidate) return null
  if (typeof candidate === 'string') return candidate
  if (typeof (candidate as { toString?: unknown }).toString === 'function') {
    return (candidate as { toString(): string }).toString()
  }
  return null
}

export function addressFromProvider(provider: InjectedProvider): string | null {
  const pk = provider.publicKey
  if (!pk) return null
  if (typeof pk === 'string') return pk
  try {
    return (pk as PublicKey).toString()
  } catch {
    return null
  }
}

export class WalletRejectedError extends Error {
  constructor() {
    super('You rejected the request in your wallet')
    this.name = 'WalletRejectedError'
  }
}

export function isRejection(err: unknown): boolean {
  const e = err as { code?: unknown; message?: string }
  if (e?.code === 4001) return true
  const msg = (e?.message ?? '').toLowerCase()
  return msg.includes('rejected') || msg.includes('denied') || msg.includes('declined')
}

export function readableWalletError(err: unknown): string {
  if (isRejection(err)) return 'You rejected the request in your wallet'
  const e = err as { message?: string; code?: number }
  const msg = e?.message ?? String(err ?? 'Unknown error')
  if (/insufficient|0x1\b/i.test(msg)) return 'Insufficient funds in the sending wallet'
  if (/blockhash|block hash/i.test(msg)) return 'Blockhash expired — please try again'
  if (/failed to fetch|networkerror|network error/i.test(msg)) return 'Network error reaching the Cookie Chain RPC'
  return msg.length > 180 ? `${msg.slice(0, 180)}…` : msg
}

/**
 * Build + sign + send a legacy SystemProgram.transfer.
 * The wallet pays gas and signs; we hand back the signature for polling.
 */
export async function sendCookTransfer(args: {
  provider: InjectedProvider
  from: string
  to: string
  lamports: number
  connection: Connection
}): Promise<{ signature: string; blockhash: string }> {
  const fromPubkey = new PublicKey(args.from)
  const toPubkey = new PublicKey(args.to)
  const { blockhash, lastValidBlockHeight } = await args.connection.getLatestBlockhash('confirmed')

  const transaction = new Transaction({ feePayer: fromPubkey, blockhash, lastValidBlockHeight }).add(
    SystemProgram.transfer({ fromPubkey, toPubkey, lamports: args.lamports }),
  )

  let result: { signature: string } | string
  try {
    result = await args.provider.signAndSendTransaction(transaction)
  } catch (err) {
    if (isRejection(err)) throw new WalletRejectedError()
    throw err
  }
  const signature =
    typeof result === 'string' ? result : result?.signature ?? (result as { txid?: string })?.txid
  if (!signature) throw new Error('Wallet did not return a transaction signature')
  return { signature: signature as TransactionSignature, blockhash }
}
