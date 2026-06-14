# Backend - Exit Button

The off-chain engine behind Exit Button. Reads a wallet's DeFi positions, prices
a guaranteed exit payout, and (next) assembles the unwind bundle.

```
SCAN  →  DRY-RUN  →  BUNDLE  →  SIGN & SEND
 ↑ done    ↑ done     ↑ next
```

## Setup

```bash
npm install            # viem, dotenv
cp .env.example .env   # then fill in the keys below
```

`.env`:
```
ZERION_KEY=...          # Zerion API (positions)        dashboard.zerion.io
ETH_RPC_URL=...         # Ethereum RPC (Aave reads)      alchemy.com
UNISWAP_API_KEY=...     # Uniswap Trading API (quotes)   developers.uniswap.org
```

---

## `lib/scan/` — read everything a wallet holds

Pulls all Ethereum DeFi positions from Zerion, normalizes them into six exit
categories, and enriches each with the on-chain data the unwind will need.

| File | Role |
|------|------|
| `scan.js` | Zerion fetch (paginated, ethereum-only) + normalizer |
| `aave.js` | on-chain read of Aave aToken / variableDebtToken per underlying |
| `run-scan.js` | CLI: `node lib/scan/run-scan.js 0xADDRESS` |

**Categories:** `loan`, `collateral`, `lp`, `staked`, `reward`, `dust`.

Each position is enriched with:
- `underlying.address` — the token's Ethereum contract (resolved from the
  fungible id via `/v1/fungibles/{id}` when Zerion omits it)
- `underlying.amountWei` — exact base-unit amount (`quantity.int`)
- `underlying.decimals`, `underlying.fungibleId`
- `aave.aToken` / `aave.variableDebtToken` — for loan/collateral positions,
  read on-chain from Aave's Protocol Data Provider

**Output** (`ScanResult`): `{ address, chain, totalUsd, positions[] }`.

```bash
node lib/scan/run-scan.js 0xWalletAddress
```

---

## `lib/dryrun/` — what you'll actually walk away with

Consumes a scan result and computes the **guaranteed-minimum USDC** the user
receives after the full unwind. Read-only — no execution, no gas.

| File | Role |
|------|------|
| `dryrun.js` | nets assets vs debt, applies fees → the hero number |
| `uniswap-quote.js` | real per-asset USDC quotes via the Uniswap Trading API |
| `run-dryrun.js` | CLI: `node lib/dryrun/run-dryrun.js 0xADDRESS` |

**The math (per position):**
```
assets (collateral, lp, staked, reward, dust)  → sell  → + USDC
loan                                            → repay → − USDC

guaranteed_min = assets_recovered − debt − flashloan_fee − gas
```

Assets are priced with a **live Uniswap quote** where liquidity exists, falling
back to a conservative slippage haircut otherwise. The number is a floor, not an
estimate — it already accounts for real slippage and the debt that must be repaid.

```bash
node lib/dryrun/run-dryrun.js 0xWalletAddress
```

> Note: illiquid wrapper tokens (Pendle SY, LSTs, etc.) have no direct Uniswap
> route and can't be cleanly quoted. Demo wallets should hold liquid assets
> (WETH, USDC, major tokens) for a believable payout figure.

---

## Notes

- Quotes and on-chain reads are **free** (no gas) — only the final SIGN & SEND
  executes and costs gas.
- Secrets live in `.env` (gitignored). Each contributor supplies their own keys.
