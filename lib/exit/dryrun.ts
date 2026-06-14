import { getAddress, type Address } from 'viem';
import { ADDR, MAINNET } from './config';

export interface Payout {
  token: Address;
  amountOut?: bigint;
  amountOutMin?: bigint;
  owner: Address;
  impactBps?: number;
}

function sameAddr(a: string, b: string): boolean {
  try {
    return getAddress(a) === getAddress(b);
  } catch {
    return a.toLowerCase() === b.toLowerCase();
  }
}

export function extractPayout(result: any, signer: Address, token: Address = ADDR.USDC as Address): Payout | null {
  const produced = result?.producedResources;
  if (!produced) return null;

  const entries = Object.entries(produced) as [string, any][];
  const candidates = entries.filter(
    ([, r]) =>
      r?.kind === 'erc20' &&
      r?.chainId === MAINNET &&
      sameAddr(r?.token ?? '', token) &&
      sameAddr(r?.owner ?? '', signer),
  );
  if (candidates.length === 0) return null;

  const preferred = candidates.find(([k]) => k.endsWith('.amountOut'));
  const byAmount = [...candidates].sort(
    (a, b) => Number(b[1]?.simulated?.amountOut ?? 0n) - Number(a[1]?.simulated?.amountOut ?? 0n),
  );
  const match = (preferred ?? byAmount[0])[1];

  return {
    token: getAddress(token),
    amountOut: match.simulated?.amountOut,
    amountOutMin: match.simulated?.amountOutMin,
    owner: getAddress(signer),
    impactBps: result?.priceImpact?.impactBps,
  };
}

export function formatPayout(p: Payout | null): string {
  if (!p) return 'no USDC payout resource found in produced resources';
  const min = p.amountOutMin !== undefined ? (Number(p.amountOutMin) / 1e6).toFixed(2) : '?';
  const exp = p.amountOut !== undefined ? (Number(p.amountOut) / 1e6).toFixed(2) : '?';
  const impact = p.impactBps !== undefined ? ` | priceImpact ${(p.impactBps / 100).toFixed(2)}%` : '';
  return `you'll get >= $${min} USDC (expected ~$${exp})${impact}`;
}
