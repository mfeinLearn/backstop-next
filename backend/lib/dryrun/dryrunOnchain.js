import { onchainScan } from '../scan/onchainScan.js';
import { resolveFromScan } from '../../../lib/exit/integration/resolve';

const USDC = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48';
const FLASHLOAN_FEE_BPS = 5;
const GAS_USD = 1.5;
const SLIPPAGE_BPS = 100;

function isDebtSymbol(symbol) {
  const s = (symbol ?? '').toLowerCase();
  return s.startsWith('variabledebt') || s.startsWith('stabledebt');
}

function isCollateralSymbol(symbol) {
  return /^aeth/i.test(symbol ?? '');
}

const WETH_LOGO = 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2/logo.png';
const UNI_LOGO = 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984/logo.png';

const WETH = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2';
const DECIMALS = { [USDC]: 6, [WETH.toLowerCase()]: 18 };

function priceOf(addr, scan) {
  const a = (addr ?? '').toLowerCase();
  if (a === USDC) return 1;
  for (const p of scan.positions ?? []) {
    if ((p.token ?? '').toLowerCase() === a && p.amount > 0 && p.value > 0) return p.value / p.amount;
  }
  if (a === WETH.toLowerCase()) {
    for (const p of scan.positions ?? []) {
      if (isCollateralSymbol(p.symbol) && p.amount > 0 && p.value > 0) return p.value / p.amount;
    }
  }
  return 0;
}

function lpUsd(lp, scan) {
  let usd = 0;
  for (const [tok, amt] of [[lp.token0, lp.amount0], [lp.token1, lp.amount1]]) {
    if (amt == null) continue;
    const dec = DECIMALS[(tok ?? '').toLowerCase()] ?? 18;
    usd += (Number(amt) / 10 ** dec) * priceOf(tok, scan);
  }
  return usd;
}

function assetLine(p) {
  if (p.category === 'lp') {
    return { kind: 'asset', protocol: 'Uniswap V3 LP', category: 'liquidity position', usdc: p.value, quoted: true, logo: p.logo ?? UNI_LOGO, token: p.token };
  }
  if (isCollateralSymbol(p.symbol)) {
    return { kind: 'asset', protocol: 'Aave WETH', category: 'Aave v3 collateral', usdc: p.value, amount: p.amount, symbol: 'aWETH', quoted: true, logo: WETH_LOGO, token: WETH };
  }
  return { kind: 'asset', protocol: p.symbol ?? 'TOKEN', category: 'token', usdc: p.value, amount: p.amount, symbol: p.symbol ?? 'TOKEN', quoted: true, logo: p.logo ?? null, token: p.token };
}

export async function dryRunOnchain(input) {
  let scan = input?.scan;
  if (!scan) {
    if (!input?.address) throw new Error('address or scan required');
    scan = await onchainScan(input.address, { minUsd: 0 });
  }

  let pos = null;
  try {
    pos = await resolveFromScan(scan);
  } catch {
    pos = null;
  }
  const debtRepaidUsd = pos?.debt?.amount ? Number(pos.debt.amount) / 1e6 : 0;

  const lines = [];
  let assetSum = 0;
  for (const p of scan.positions ?? []) {
    if (!(p.value > 0)) continue;
    if ((p.token ?? '').toLowerCase() === USDC) continue;
    if (isDebtSymbol(p.symbol)) continue;
    lines.push(assetLine(p));
    assetSum += p.value;
  }

  lines.push({ kind: 'debt', protocol: 'USDC debt', category: 'aave', usdc: debtRepaidUsd, amount: debtRepaidUsd, symbol: 'USDC' });

  const flashloanFee = debtRepaidUsd * (FLASHLOAN_FEE_BPS / 10_000);
  const gas = GAS_USD;
  const slippageUsd = assetSum * (SLIPPAGE_BPS / 10_000);
  const guaranteedMinUsdc = assetSum - slippageUsd - debtRepaidUsd - flashloanFee - gas;

  return { lines, assetsUsd: assetSum, slippageUsd, debtRepaidUsd, flashloanFee, gas, guaranteedMinUsdc };
}
