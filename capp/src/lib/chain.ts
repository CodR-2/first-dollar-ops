/**
 * lib/chain.ts — every Cookie Chain RPC interaction lives here.
 *
 * Cookie Chain is a Solana-Virtual-Machine community chain, so the standard
 * @solana/web3.js JSON-RPC client works by simply pointing it at the Cookie
 * Chain endpoints (verified live: solana-core 4.1.2, epoch 54).
 *
 * COOK is the native gas token with 9 decimals (lamports-style).
 * There is NO faucet on this chain — this app never promises or attempts
 * to acquire COOK; all transaction gas is paid by the connected wallet.
 */
import {
  Connection,
  PublicKey,
  SystemProgram,
  Transaction,
  type ParsedTransactionWithMeta,
  type TransactionSignature,
} from '@solana/web3.js'

/**
 * SPL Token program ids. (Newer web3.js 1.x builds no longer re-export
 * TOKEN_PROGRAM_ID / TOKEN_2022_PROGRAM_ID, so they are pinned here.)
 */
const TOKEN_PROGRAM_ID = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA')
const TOKEN_2022_PROGRAM_ID = new PublicKey('TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb')

export const CHAIN = {
  name: 'Cookie Chain',
  rpcUrl: 'https://rpc.cookiescan.io',
  wsUrl: 'wss.cookiescan.io',
  genesisHash: '9wDaBRDgArEUpvhHxGguNkwozsZh4UpGZB9o2EoEcBB2',
  explorer: 'https://cookiescan.io',
  bridge: 'https://hyperlane.cookiescan.io',
  docs: 'https://docs.cookiechain.wtf',
  walletsDoc: 'https://docs.cookiechain.wtf/wallets',
  telegram: 'https://t.me/TheCookieNetChain',
  decimals: 9,
  /** The Cookie Jar vault — a great example address to explore read-only. */
  exampleAddress: '568tU9FMksJDxjkLBjWisSA4J4C5uPH87NCCkyREwrxe',
} as const

export const LAMPORTS_PER_COOK = 1_000_000_000
/** Typical Solana-style base fee, used as a fallback and safety buffer. */
export const FALLBACK_FEE_LAMPORTS = 5_000

let connection: Connection | null = null

export function getConnection(): Connection {
  if (!connection) {
    connection = new Connection(CHAIN.rpcUrl, {
      commitment: 'confirmed',
      // Polling is used everywhere; the optional WebSocket endpoint is not required.
    })
  }
  return connection
}

/* ------------------------------------------------------------------ */
/* Network identity                                                    */
/* ------------------------------------------------------------------ */

export async function getGenesisHash(): Promise<string> {
  return getConnection().getGenesisHash()
}

/* ------------------------------------------------------------------ */
/* Account data                                                        */
/* ------------------------------------------------------------------ */

export async function getBalanceLamports(address: string): Promise<number> {
  return getConnection().getBalance(new PublicKey(address), 'confirmed')
}

export interface TokenHolding {
  mint: string
  decimals: number
  uiAmount: number
  rawAmount: string
  owner: string
  program: 'SPL' | 'SPL-2022'
}

/**
 * SPL token accounts for an owner (jsonParsed), across both the classic
 * Token program and Token-2022 when supported.
 */
export async function getTokenHoldings(address: string): Promise<TokenHolding[]> {
  const owner = new PublicKey(address)
  const conn = getConnection()

  const holdings: TokenHolding[] = []
  const programs: Array<{ id: PublicKey; label: 'SPL' | 'SPL-2022' }> = [
    { id: TOKEN_PROGRAM_ID, label: 'SPL' },
    { id: TOKEN_2022_PROGRAM_ID, label: 'SPL-2022' },
  ]

  for (const program of programs) {
    try {
      const res = await conn.getParsedTokenAccountsByOwner(owner, { programId: program.id }, 'confirmed')
      for (const { account } of res.value) {
        const info = (account.data as { parsed?: { info?: Record<string, unknown> } }).parsed?.info
        if (!info) continue
        const tokenAmount = info.tokenAmount as {
          uiAmount: number | null
          amount: string
          decimals: number
        } | null
        if (!tokenAmount) continue
        holdings.push({
          mint: String(info.mint ?? ''),
          decimals: tokenAmount.decimals ?? 0,
          uiAmount: tokenAmount.uiAmount ?? 0,
          rawAmount: tokenAmount.amount ?? '0',
          owner: String(info.owner ?? address),
          program: program.label,
        })
      }
    } catch {
      // Token-2022 may be unavailable on some SVM forks — ignore that failure only.
      if (program.label === 'SPL') throw new Error('Could not load token accounts')
    }
  }

  holdings.sort((a, b) => b.uiAmount - a.uiAmount)
  return holdings
}

export async function getTokenAccountOwnerMap(address: string): Promise<Record<string, string>> {
  const map: Record<string, string> = {}
  const conn = getConnection()
  const owner = new PublicKey(address)
  for (const programId of [TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID]) {
    try {
      const res = await conn.getParsedTokenAccountsByOwner(owner, { programId }, 'confirmed')
      for (const { pubkey } of res.value) map[pubkey.toBase58()] = address
    } catch {
      /* ignore */
    }
  }
  return map
}

/* ------------------------------------------------------------------ */
/* Activity                                                            */
/* ------------------------------------------------------------------ */

export type ActivityKind =
  | 'transfer-in'
  | 'transfer-out'
  | 'token-in'
  | 'token-out'
  | 'token'
  | 'account'
  | 'vote'
  | 'other'

export interface ActivityItem {
  signature: string
  slot: number
  blockTime: number | null
  /** Known up-front from the signature list (meta.err); refined on enrichment. */
  status: 'success' | 'failed'
  feeLamports?: number
  kind: ActivityKind
  /** Human amount label, e.g. "12.5 COOK". */
  amountLabel?: string
  counterparty?: string
  detail?: string
  /** Set once getTransaction enrichment has run for this item. */
  enriched?: boolean
}

export interface SignatureSummary {
  signature: string
  slot: number
  blockTime: number | null
  err: unknown
}

export async function getRecentSignatures(address: string, limit = 15): Promise<SignatureSummary[]> {
  const sigs = await getConnection().getSignaturesForAddress(new PublicKey(address), { limit }, 'confirmed')
  return sigs
    .filter((s) => s.confirmationStatus !== undefined)
    .map((s) => ({
      signature: s.signature,
      slot: s.slot,
      blockTime: s.blockTime ?? null,
      err: s.err ?? null,
    }))
}

const VOTE_PROGRAM = 'Vote111111111111111111111111111111111111111'

interface ParsedIx {
  programId: PublicKey
  parsed?: { type?: string; info?: Record<string, unknown> }
}

function lamportsOf(v: unknown): number {
  const n = typeof v === 'string' ? Number.parseInt(v, 10) : typeof v === 'number' ? v : NaN
  return Number.isFinite(n) ? n : 0
}

function tokenAmountOf(info: Record<string, unknown>): { uiAmount: number; decimals: number; mint?: string } | null {
  const ta = info.tokenAmount as { uiAmount: number | null; decimals: number } | undefined
  if (ta) return { uiAmount: ta.uiAmount ?? 0, decimals: ta.decimals ?? 0, mint: info.mint as string | undefined }
  const amt = lamportsOf(info.amount)
  if (amt > 0) return { uiAmount: amt / Math.pow(10, 6), decimals: 6 }
  return null
}

/**
 * Classify one fetched transaction from the perspective of `address`.
 * Handles System SOL transfers, SPL/Token-2022 transfers, votes, and a
 * balance-delta fallback for anything else.
 */
export function classifyTransaction(
  tx: ParsedTransactionWithMeta,
  address: string,
  tokenAccountOwnerMap: Record<string, string>,
): Omit<ActivityItem, 'signature' | 'slot' | 'blockTime'> {
  const meta = tx.meta
  const failed = meta?.err != null
  const fee = meta?.fee ?? 5_000
  const base = { status: (failed ? 'failed' : 'success') as 'success' | 'failed', feeLamports: fee }

  if (failed) {
    return { ...base, kind: 'other', detail: 'Transaction failed on-chain' }
  }

  const message = tx.transaction.message
  // jsonParsed gives us static account keys; versioned txs append loaded
  // writable + readonly addresses from meta — the same order pre/postBalances use.
  const staticKeys = (message as unknown as { accountKeys: Array<{ pubkey: { toBase58(): string } | string }> }).accountKeys.map(
    (k) => (typeof k.pubkey === 'string' ? k.pubkey : k.pubkey.toBase58()),
  )
  const loaded = meta?.loadedAddresses
  const keys: string[] = [
    ...staticKeys,
    ...(loaded?.writable ?? []).map((k) => k.toBase58()),
    ...(loaded?.readonly ?? []).map((k) => k.toBase58()),
  ]

  // Gather outer + inner parsed instructions, newest-inner first.
  const outer = message.instructions as unknown as ParsedIx[]
  const inner: ParsedIx[] = []
  for (const group of meta?.innerInstructions ?? []) inner.push(...(group.instructions as unknown as ParsedIx[]))
  const all: ParsedIx[] = [...outer, ...inner]

  const isTokenProgram = (p: PublicKey) =>
    p.equals(TOKEN_PROGRAM_ID) || p.equals(TOKEN_2022_PROGRAM_ID)

  let solTransfer: { kind: 'transfer-in' | 'transfer-out'; amount: number; counterparty: string } | null = null
  let tokenTransfer: {
    kind: 'token-in' | 'token-out' | 'token'
    amount: { uiAmount: number; decimals: number; mint?: string }
    counterparty?: string
  } | null = null
  let accountAction = false

  for (const ix of all) {
    const parsed = ix.parsed
    if (!parsed?.type || !parsed.info) continue
    const info = parsed.info
    const type = parsed.type

    if (isTokenProgram(ix.programId)) {
      if (tokenTransfer) continue
      if ((type === 'transfer' || type === 'transferChecked') && tokenAccountOwnerMap) {
        const amount = tokenAmountOf(info)
        if (!amount || amount.uiAmount === 0) continue
        const source = String(info.source ?? '')
        const destination = String(info.destination ?? '')
        const srcOwner = tokenAccountOwnerMap[source]
        const dstOwner = tokenAccountOwnerMap[destination]
        if (srcOwner === address) {
          tokenTransfer = { kind: 'token-out', amount, counterparty: destination || undefined }
        } else if (dstOwner === address) {
          tokenTransfer = { kind: 'token-in', amount, counterparty: source || undefined }
        } else {
          tokenTransfer = { kind: 'token', amount }
        }
      }
      continue
    }

    switch (type) {
      case 'transfer':
      case 'transferWithSeed': {
        if (solTransfer) continue
        const lamports = lamportsOf(info.lamports)
        if (lamports === 0) continue
        const source = String(info.source ?? '')
        const destination = String(info.destination ?? '')
        if (source === address) {
          solTransfer = { kind: 'transfer-out', amount: lamports, counterparty: destination }
        } else if (destination === address) {
          solTransfer = { kind: 'transfer-in', amount: lamports, counterparty: source }
        }
        break
      }
      case 'createAccount':
      case 'createAccountWithSeed':
      case 'allocate':
      case 'assign':
      case 'create':
        accountAction = true
        break
      default:
        break
    }
  }

  if (solTransfer) {
    return {
      ...base,
      kind: solTransfer.kind,
      amountLabel: `${(solTransfer.amount / LAMPORTS_PER_COOK).toLocaleString('en-US', { maximumFractionDigits: 9 })} COOK`,
      counterparty: solTransfer.counterparty || undefined,
      detail: solTransfer.kind === 'transfer-out' ? 'Sent COOK' : 'Received COOK',
    }
  }

  if (tokenTransfer) {
    const label = tokenTransfer.amount.uiAmount.toLocaleString('en-US', {
      maximumFractionDigits: Math.max(tokenTransfer.amount.decimals, 2),
    })
    const verb =
      tokenTransfer.kind === 'token-out' ? 'Sent tokens' : tokenTransfer.kind === 'token-in' ? 'Received tokens' : 'Token transfer'
    return {
      ...base,
      kind: tokenTransfer.kind,
      amountLabel: `${label} tokens`,
      counterparty: tokenTransfer.counterparty,
      detail: `${verb}${tokenTransfer.amount.mint ? ` · mint ${tokenTransfer.amount.mint.slice(0, 4)}…${tokenTransfer.amount.mint.slice(-4)}` : ''}`,
    }
  }

  if (keys.includes(VOTE_PROGRAM)) {
    return { ...base, kind: 'vote', detail: 'Validator vote' }
  }

  if (accountAction) {
    return { ...base, kind: 'account', detail: 'Account created / resized' }
  }

  // Fallback: SOL balance delta for the address.
  const idx = keys.indexOf(address)
  if (idx >= 0 && meta) {
    const delta = meta.postBalances[idx] - meta.preBalances[idx]
    if (delta > 0) {
      return {
        ...base,
        kind: 'transfer-in',
        amountLabel: `${(delta / LAMPORTS_PER_COOK).toLocaleString('en-US', { maximumFractionDigits: 9 })} COOK`,
        detail: 'Received COOK (balance change)',
      }
    }
    if (delta < 0 && Math.abs(delta) > fee) {
      return {
        ...base,
        kind: 'transfer-out',
        amountLabel: `${((Math.abs(delta) - fee) / LAMPORTS_PER_COOK).toLocaleString('en-US', { maximumFractionDigits: 9 })} COOK`,
        detail: 'Sent COOK (balance change)',
      }
    }
  }

  const program = keys[keys.length - 1]
  return { ...base, kind: 'other', detail: program ? `Interacted with ${program.slice(0, 4)}…${program.slice(-4)}` : 'Program interaction' }
}

/** Fetch + classify a single transaction (lazy, used by the activity feed). */
export async function getTransactionActivity(
  summary: SignatureSummary,
  address: string,
  tokenAccountOwnerMap: Record<string, string>,
): Promise<ActivityItem> {
  const tx = await getConnection().getParsedTransaction(summary.signature as TransactionSignature, {
    maxSupportedTransactionVersion: 0,
    commitment: 'confirmed',
  })
  const base: ActivityItem = {
    signature: summary.signature,
    slot: summary.slot,
    blockTime: summary.blockTime,
    status: summary.err != null ? 'failed' : 'success',
    kind: 'other',
    detail: summary.err != null ? 'Transaction failed on-chain' : 'Transaction',
    enriched: true,
  }
  if (!tx) {
    return { ...base, detail: 'Details unavailable (may be pruned by RPC)' }
  }
  try {
    return { ...base, ...classifyTransaction(tx, address, tokenAccountOwnerMap) }
  } catch {
    return { ...base, detail: 'Could not decode transaction details' }
  }
}

/* ------------------------------------------------------------------ */
/* Send COOK                                                           */
/* ------------------------------------------------------------------ */

export async function getLatestBlockhash() {
  return getConnection().getLatestBlockhash('confirmed')
}

/** Exact fee for a compiled SystemProgram.transfer message (falls back to 5000 lamports). */
export async function estimateTransferFee(from: string, to: string, lamports: number): Promise<number> {
  try {
    const { blockhash, lastValidBlockHeight } = await getLatestBlockhash()
    const tx = new Transaction({
      feePayer: new PublicKey(from),
      blockhash,
      lastValidBlockHeight,
    }).add(SystemProgram.transfer({ fromPubkey: new PublicKey(from), toPubkey: new PublicKey(to), lamports }))
    const fee = await getConnection().getFeeForMessage(tx.compileMessage(), 'confirmed')
    return fee.value ?? FALLBACK_FEE_LAMPORTS
  } catch {
    return FALLBACK_FEE_LAMPORTS
  }
}

export type ConfirmPhase = 'pending' | 'confirmed' | 'finalized'

export interface ConfirmResult {
  phase: 'confirmed' | 'finalized'
  err: unknown
}

/**
 * Poll getSignatureStatuses until the signature reaches `confirmed`, then keep
 * going until `finalized` or the timeout. Returns the last observed state.
 */
export async function pollSignatureStatus(
  signature: string,
  opts?: {
    timeoutMs?: number
    intervalMs?: number
    onPhase?: (phase: ConfirmPhase) => void
    shouldAbort?: () => boolean
  },
): Promise<ConfirmResult> {
  const timeoutMs = opts?.timeoutMs ?? 60_000
  const intervalMs = opts?.intervalMs ?? 2_000
  const started = Date.now()
  let lastErr: unknown = null
  let reported: ConfirmPhase | null = null

  while (Date.now() - started < timeoutMs) {
    if (opts?.shouldAbort?.()) throw new Error('aborted')
    try {
      const res = await getConnection().getSignatureStatuses([signature], { searchTransactionHistory: true })
      const status = res.value[0]
      if (status?.err) return { phase: 'confirmed', err: status.err }
      const cs = status?.confirmationStatus
      if (cs === 'finalized') {
        opts?.onPhase?.('finalized')
        return { phase: 'finalized', err: null }
      }
      if (cs === 'confirmed' && reported !== 'confirmed' && reported !== 'finalized') {
        reported = 'confirmed'
        opts?.onPhase?.('confirmed')
      }
    } catch (err) {
      lastErr = err // transient RPC hiccup — keep polling until timeout
    }
    await new Promise((r) => setTimeout(r, intervalMs))
  }
  if (lastErr) throw lastErr
  return { phase: reported === 'confirmed' ? 'confirmed' : 'confirmed', err: null }
}

/* ------------------------------------------------------------------ */
/* Network pulse                                                       */
/* ------------------------------------------------------------------ */

export interface PerfSample {
  slot: number
  tps: number
  nonVoteTps: number
  samplePeriodSecs: number
  numTransactions: number
}

export async function getPerformanceSamples(num = 30): Promise<PerfSample[]> {
  const samples = await getConnection().getRecentPerformanceSamples(num)
  return samples.map((s) => ({
    slot: s.slot,
    tps: s.numTransactions / s.samplePeriodSecs,
    nonVoteTps: ((s as { numNonVoteTransactions?: number }).numNonVoteTransactions ?? 0) / s.samplePeriodSecs,
    samplePeriodSecs: s.samplePeriodSecs,
    numTransactions: s.numTransactions,
  }))
}

export interface EpochInfoLite {
  absoluteSlot: number
  epoch: number
  slotIndex: number
  slotsInEpoch: number
  transactionCount: number
  blockHeight: number
}

export async function getEpochInfoLite(): Promise<EpochInfoLite> {
  const e = await getConnection().getEpochInfo()
  return {
    absoluteSlot: e.absoluteSlot ?? 0,
    epoch: e.epoch ?? 0,
    slotIndex: e.slotIndex ?? 0,
    slotsInEpoch: e.slotsInEpoch ?? 0,
    transactionCount: e.transactionCount ?? 0,
    blockHeight: e.blockHeight ?? 0,
  }
}

export interface SupplyLite {
  circulating: number
  total: number
  nonCirculating: number
}

export async function getSupplyLite(): Promise<SupplyLite> {
  const s = await getConnection().getSupply('confirmed')
  return {
    circulating: s.value.circulating ?? 0,
    total: s.value.total ?? 0,
    nonCirculating: s.value.nonCirculating ?? 0,
  }
}

export async function getNodeVersion(): Promise<string> {
  const v = await getConnection().getVersion()
  return v['solana-core'] ?? JSON.stringify(v)
}

export async function getCurrentSlot(): Promise<number> {
  return getConnection().getSlot('confirmed')
}

/* ------------------------------------------------------------------ */
/* Links                                                               */
/* ------------------------------------------------------------------ */

export function explorerTx(signature: string): string {
  return `${CHAIN.explorer}/tx/${signature}`
}

export function explorerAccount(address: string): string {
  return `${CHAIN.explorer}/account/${address}`
}
