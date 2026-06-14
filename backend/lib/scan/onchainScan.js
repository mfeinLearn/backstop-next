import { getAddress } from 'viem';
import { resolveUserLps } from '../../../lib/exit/integration/resolve';

const CHAIN_LABEL = 'Ethereum';
const NETWORK = 'eth-mainnet';
const PRICES_BASE = 'https://api.g.alchemy.com/prices/v1';
const USDC = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48';
const UNI_LOGO = 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984/logo.png';

function rpcUrl() {
  const url = process.env.ALCHEMY_RPC_URL;
  if (!url) throw new Error('ALCHEMY_RPC_URL not set on server');
  return url;
}

function alchemyApiKey() {
  if (process.env.ALCHEMY_API_KEY) return process.env.ALCHEMY_API_KEY;
  const url = process.env.ALCHEMY_RPC_URL ?? '';
  const m = url.match(/\/v2\/([^/?#]+)/);
  return m ? m[1] : null;
}

async function rpc(method, params) {
  const res = await fetch(rpcUrl(), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ id: 1, jsonrpc: '2.0', method, params }),
  });
  if (!res.ok) throw new Error(`Alchemy RPC ${res.status}: ${await res.text()}`);
  const json = await res.json();
  if (json.error) throw new Error(`Alchemy RPC ${method}: ${json.error.message}`);
  return json.result;
}

async function getTokenBalances(address) {
  const result = await rpc('alchemy_getTokenBalances', [address, 'erc20']);
  const balances = result?.tokenBalances ?? [];
  return balances
    .map((b) => ({ contractAddress: b.contractAddress, tokenBalance: b.tokenBalance }))
    .filter((b) => {
      if (!b.tokenBalance) return false;
      try {
        return BigInt(b.tokenBalance) > 0n;
      } catch {
        return false;
      }
    });
}

async function getTokenMetadata(contractAddress) {
  try {
    const meta = await rpc('alchemy_getTokenMetadata', [contractAddress]);
    return { symbol: meta?.symbol ?? null, decimals: meta?.decimals ?? null, logo: meta?.logo ?? null };
  } catch {
    return { symbol: null, decimals: null, logo: null };
  }
}

function trustWalletLogo(address) {
  try {
    return `https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/${getAddress(address)}/logo.png`;
  } catch {
    return null;
  }
}

async function getPrices(addresses) {
  const apiKey = alchemyApiKey();
  if (!apiKey || addresses.length === 0) return {};
  try {
    const res = await fetch(`${PRICES_BASE}/${apiKey}/tokens/by-address`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ addresses: addresses.map((a) => ({ network: NETWORK, address: a })) }),
    });
    if (!res.ok) return {};
    const json = await res.json();
    const out = {};
    for (const entry of json?.data ?? []) {
      const usd = (entry.prices ?? []).find((p) => (p.currency ?? '').toLowerCase() === 'usd') ?? entry.prices?.[0];
      out[(entry.address ?? '').toLowerCase()] = usd?.value != null ? Number(usd.value) : 0;
    }
    return out;
  } catch {
    return {};
  }
}

function toUnits(raw, decimals) {
  try {
    const wei = BigInt(raw);
    if (decimals == null) return 0;
    return Number(wei) / 10 ** Number(decimals);
  } catch {
    return 0;
  }
}

export async function onchainScan(address, opts = {}) {
  const minUsd = opts.minUsd ?? 0;

  const balances = await getTokenBalances(address);

  const metas = await Promise.all(balances.map((b) => getTokenMetadata(b.contractAddress)));
  const prices = await getPrices(balances.map((b) => b.contractAddress));

  const positions = [];
  for (let i = 0; i < balances.length; i++) {
    const { contractAddress, tokenBalance } = balances[i];
    if (contractAddress.toLowerCase() === USDC) continue;
    const { symbol, decimals, logo } = metas[i];
    const price = prices[contractAddress.toLowerCase()] ?? 0;
    const amount = toUnits(tokenBalance, decimals);
    const value = price > 0 ? amount * price : 0;
    if (value <= 0 || value < minUsd) continue;
    positions.push({
      category: 'dust',
      token: contractAddress,
      symbol: symbol ?? null,
      balance: tokenBalance,
      amount,
      value,
      logo: logo ?? trustWalletLogo(contractAddress),
    });
  }

  try {
    const lps = await resolveUserLps(address);
    for (const lp of lps) {
      const lpTokens = [lp.token0.toLowerCase(), lp.token1.toLowerCase()];
      const [lpPrices, lpMetas] = await Promise.all([
        getPrices(lpTokens),
        Promise.all(lpTokens.map((t) => getTokenMetadata(t))),
      ]);
      let usd = 0;
      [[lp.token0, lp.amount0], [lp.token1, lp.amount1]].forEach(([tok, amt], idx) => {
        if (amt == null) return;
        const tl = tok.toLowerCase();
        const dec = lpMetas[idx]?.decimals ?? (tl === USDC ? 6 : 18);
        const px = lpPrices[tl] ?? (tl === USDC ? 1 : 0);
        usd += (Number(amt) / 10 ** dec) * px;
      });
      if (usd > 0) positions.push({ category: 'lp', token: lp.token1, symbol: 'Uniswap V3 LP', balance: '0', amount: null, value: usd, logo: UNI_LOGO });
    }
  } catch {
  }

  positions.sort((a, b) => b.value - a.value);

  return {
    address,
    chain: CHAIN_LABEL,
    totalUsd: positions.reduce((s, p) => s + p.value, 0),
    positions,
  };
}
