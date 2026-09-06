# 🍪 CookieLens — Your lens into Cookie Chain

CookieLens is a polished, single-page **Cookie Chain** dashboard: connect a wallet (Nightly first), inspect any address read-only, send COOK, watch live activity, and read the network's pulse — all client-side, straight from the chain's own RPC.

**Live:** deployed as a static build (see the repo's GitHub Pages link) · **Chain:** Cookie Chain (Solana Virtual Machine, solana-core 4.1.2) · **Gas token:** COOK (9 decimals)

## Features

| # | Feature | Where |
|---|---------|-------|
| 1 | **Wallet connection** — Nightly (required) detected first, then Phantom, then any injected Solana provider; connected address shown with click-to-copy | Header + `src/lib/wallet.ts` |
| 2 | **Read-only explorer** — paste ANY Cookie Chain address (or one-click the Cookie Jar vault example) to view its dashboard without a wallet | `src/components/Hero.tsx` |
| 3 | **COOK balance + SPL tokens** — native balance in COOK/lamports plus parsed token accounts (classic SPL **and** Token-2022) | `src/components/WalletPanel.tsx` |
| 4 | **Send COOK** — recipient + amount with full validation (base58 pubkey, amount ≤ balance − fee), live fee estimate, legacy `SystemProgram.transfer` with latest blockhash, `signAndSendTransaction`, then `getSignatureStatuses` polling (pending → confirmed → finalized, ~60 s cap) and explorer link | `src/components/SendCook.tsx` |
| 5 | **Activity feed** — last 15 signatures, lazily enriched with `getTransaction` to show type (transfer in/out, token, vote, program), decodable amounts, fee, success/fail badge, relative time, explorer links | `src/components/ActivityFeed.tsx` |
| 6 | **Network Pulse** — live slot ticker (3 s poll), hand-rolled inline-SVG TPS area chart from `getRecentPerformanceSamples(30)` with hover tooltips, epoch progress bar, COOK supply, node version, total transactions | `src/components/NetworkPulse.tsx` |
| 7 | **Network verification** — on load the app checks the RPC genesis hash against Cookie Chain's `9wDaBRDgArEUpvhHxGguNkwozsZh4UpGZB9o2EoEcBB2` and shows a green "Cookie Chain verified" badge (red banner + guidance on mismatch) | `src/components/NetworkBadge.tsx` |
| 8 | **Error handling everywhere** — inline validation, toast notifications, skeleton loaders, empty states, retryable error cards, wallet rejection / insufficient funds / RPC / timeout paths | throughout |

## Tech

- **Vite + React 19 + TypeScript** (strict), built with [Bun](https://bun.sh)
- **Tailwind CSS 4** (`@tailwindcss/vite`) — warm cookie theme (dark chocolate / cream / amber), responsive from 375 px to 1280 px+
- **@solana/web3.js 1.x** — the only chain dependency; no wallet-adapter, no chart libs (the TPS chart is hand-rolled SVG)
- **lucide-react** icons; tiny dependency-free toast system
- `vite.config.ts` sets **`base: './'`** so the same build works on GitHub Pages subpaths and `/capp/` locally

## Run it

```bash
bun install
bun run dev       # local dev server
bun run build     # type-checks then emits dist/ (relative asset paths)
bun run preview   # serve the production build
```

The app is fully static — it talks only to `https://rpc.cookiescan.io` from the browser (CORS is open).

## Using Cookie Chain with Nightly

Cookie Chain is an SVM chain, so any Solana-style wallet works **if pointed at the Cookie Chain RPC**:

1. Install [Nightly](https://nightly.app) (Chrome/extension or desktop).
2. Follow the official wallet setup guide: **https://docs.cookiechain.wtf/wallets** — add a custom network with the RPC `https://rpc.cookiescan.io` (WebSocket `wss.cookiescan.io`).
3. Fund gas with COOK. **There is no faucet** — get COOK via the Hyperlane bridge (**https://hyperlane.cookiescan.io**), a DEX swap, or a direct transfer. CookieLens never promises or acquires COOK for you; all gas is paid by your own wallet.
4. Open CookieLens, click **Connect wallet**, approve Nightly, and you're live.

Without a wallet you can still explore any address read-only — try the Cookie Jar vault: `568tU9FMksJDxjkLBjWisSA4J4C5uPH87NCCkyREwrxe`.

## Cookie Chain quick links

- RPC: `https://rpc.cookiescan.io` · WS: `wss.cookiescan.io`
- Explorer: https://cookiescan.io (tx: `https://cookiescan.io/tx/<signature>`)
- Bridge: https://hyperlane.cookiescan.io
- Docs: https://docs.cookiechain.wtf
- Telegram: https://t.me/TheCookieNetChain

## Project layout

```
src/
  App.tsx                 # shell, tabs, wallet state, FEATURE MAP comment
  lib/
    chain.ts              # ALL RPC helpers (genesis check, balance, tokens,
                          #  signature/tx fetch + classification, send + polling,
                          #  perf samples, epoch, supply, version)
    wallet.ts             # Nightly-first provider detection + transfer flow
    hooks.ts              # tiny polling hook
    format.ts             # COOK formatting, address truncation, time
  components/             # Hero, WalletPanel, SendCook, ActivityFeed,
                          #  NetworkPulse, NetworkBadge, Toast, primitives
```

---

Built for the Cookie Chain community · docs.cookiechain.wtf
