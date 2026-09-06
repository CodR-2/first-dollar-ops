# 🍪 CookieLens — Your lens into Cookie Chain

CookieLens is a fast, single-page dashboard for **Cookie Chain**: connect a wallet (Nightly first), inspect any address read-only, send COOK, follow live activity, and read the network's pulse — all client-side, straight from the chain's own RPC. No servers, no tracking, no accounts.

**Live app:** https://codr-2.github.io/first-dollar-ops/

## Why

Cookie Chain is a young community-run SVM network. Its block explorer shows raw chain data, but there was no friendly "home screen" for everyday users: a place to see your balance and tokens, follow what your address has been doing, watch the network breathe, and move a little COOK — from any browser, with zero setup.

## Features

- **Wallet connection** — Nightly detected first (fully supported on Cookie Chain), then Phantom and any injected Solana-style provider
- **Read-only explorer** — paste *any* Cookie Chain address to see its dashboard without a wallet (one-click example: the Cookie Jar community vault)
- **Balances** — native COOK (9 decimals) plus parsed SPL & Token-2022 token accounts
- **Send COOK** — validated transfer composer with live fee estimate, pending → confirmed → finalized status tracking, and explorer deep-links
- **Activity feed** — your last 15 transactions, decoded: transfers in/out, fees, success/fail, relative time
- **Network Pulse** — live slot ticker, epoch progress, COOK supply, node version, and a hand-rolled SVG TPS chart (votes included *and* excluded)
- **Wrong-network protection** — verifies the RPC genesis hash against Cookie Chain before you transact

## Run it

```bash
cd capp
bun install
bun run dev       # local dev server
bun run build     # type-checks then emits dist/ (relative asset paths)
bun run preview   # serve the production build
```

## Connecting a wallet to Cookie Chain

1. Install [Nightly](https://nightly.app) (or any Solana-compatible wallet with custom network support)
2. In the wallet's network settings, add a custom SVM network:
   - **RPC:** `https://rpc.cookiescan.io`
   - **WebSocket:** `wss.cookiescan.io`
3. Open CookieLens, hit **Connect wallet**, and you're in

## Cookie Chain quick facts

| | |
|---|---|
| RPC | `https://rpc.cookiescan.io` |
| WebSocket | `wss.cookiescan.io` |
| Explorer | [cookiescan.io](https://cookiescan.io) |
| Docs | [docs.cookiechain.wtf](https://docs.cookiechain.wtf) |
| Bridge | [hyperlane.cookiescan.io](https://hyperlane.cookiescan.io) |
| Gas token | COOK (9 decimals, lamports-style) |

CookieLens is fully static — every query goes from your browser directly to the Cookie Chain RPC. There is nothing in the middle.

## License

[MIT](./LICENSE)
