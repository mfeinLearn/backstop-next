// lib/mapScan.js
//
// Transforms the raw result from scan() into the shape the Panic Sell UI needs.
// Keeping this pure (no React, no fetch) makes it easy to test and to extend
// as you enrich what scan() returns.
//
// Your scan() result looks like:
//   { address, chain, totalUsd, positions: [
//       { category, protocol, valueUsd,
//         underlying: { address, amountWei, decimals, fungibleId },
//         aave? } ] }
//
// The UI wants, per asset: a display name, a symbol, a chain, a USD value,
// and a logo. Zerion already returns name/symbol/icon per position via
// `fungible_info`, so the cleanest fix is to pass those through in scan.js
// (see the note in the message). This mapper USES p.symbol / p.name / p.iconUrl
// / p.chain when present, and falls back gracefully when they're not — so it
// works today and gets nicer automatically once scan.js forwards them.

const usd = (n) =>
  typeof n === 'number' && isFinite(n)
    ? `$${Math.round(n).toLocaleString()}`
    : '$0';

const shortAddr = (a) =>
  !a ? null : a.startsWith('0x') ? `${a.slice(0, 6)}…${a.slice(-4)}` : `${a.slice(0, 4)}…${a.slice(-4)}`;

export function mapScanToView(result) {
  const positions = Array.isArray(result?.positions) ? result.positions : [];

  const rows = positions
    .filter((p) => Number(p?.valueUsd) > 0)
    .sort((a, b) => b.valueUsd - a.valueUsd)
    .map((p) => {
      const name = p.name ?? p.protocol ?? 'Token';
      const symbol =
        p.symbol ??
        p.protocol ??
        shortAddr(p.underlying?.address) ??
        '—';
      return {
        name,
        symbol,
        chain: p.chain ?? result.chain ?? '—',
        valueUsd: Number(p.valueUsd) || 0,
        value: usd(p.valueUsd),
        logo: p.iconUrl ?? p.logo ?? null, // null → UI shows a fallback dot
        alt: `${name} logo`,
        category: p.category,
        underlying: p.underlying ?? {},
      };
    });

  const chains = new Set(rows.map((r) => r.chain).filter((c) => c && c !== '—'));
  const totalUsd =
    typeof result?.totalUsd === 'number'
      ? result.totalUsd
      : rows.reduce((sum, r) => sum + r.valueUsd, 0);

  return {
    address: result?.address ?? null,
    addressShort: shortAddr(result?.address),
    walletCount: 1, // scan() is single-wallet; bump this if you scan several
    assetCount: rows.length,
    chainCount: chains.size || 1,
    totalUsd,
    totalLabel: usd(totalUsd),
    rows,
  };
}