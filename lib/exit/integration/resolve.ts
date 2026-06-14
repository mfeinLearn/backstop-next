import { createPublicClient, http, getAddress, type Address } from 'viem';
import { mainnet } from 'viem/chains';
import { getAlchemyRpcUrl, ADDR } from '../config';
import { AAVE_DATA_PROVIDER_ABI, AAVE_RECEIPT_TOKEN_ABI, ERC20_BALANCE_ABI, UNI_V3_NPM_ABI } from '../onchain/abi';
import type { ExitLpLeg, ExitPosition, Uint } from '../flows/exit/types';
import type { ExitSweep } from '../flows/exit/sweep';
import type { ExitClaim } from '../flows/exit/claim';
import { AAVE_REWARDS_CONTROLLER } from '../flows/exit/claim';
import { isLst, isLocked } from '../flows/exit/lst';

const client = (rpc?: string) => createPublicClient({ chain: mainnet, transport: http(rpc ?? getAlchemyRpcUrl()) });

export async function resolveAaveTokens(
  underlying: Address,
  rpc?: string,
): Promise<{ aToken: Address; variableDebtToken: Address }> {
  const r = (await client(rpc).readContract({
    address: ADDR.AAVE_DATA_PROVIDER as Address,
    abi: AAVE_DATA_PROVIDER_ABI,
    functionName: 'getReserveTokensAddresses',
    args: [underlying],
  })) as readonly [Address, Address, Address];
  return { aToken: getAddress(r[0]), variableDebtToken: getAddress(r[2]) };
}

export type AaveTokenKind = 'aToken' | 'variableDebtToken';

export interface AaveTokenInfo {
  kind: AaveTokenKind;
  token: Address;
  underlying: Address;
}

export async function classifyAaveReceiptToken(token: Address, rpc?: string): Promise<AaveTokenInfo | null> {
  const c = client(rpc);
  const t = getAddress(token);
  let underlying: Address;
  try {
    underlying = getAddress(
      (await c.readContract({
        address: t,
        abi: AAVE_RECEIPT_TOKEN_ABI,
        functionName: 'UNDERLYING_ASSET_ADDRESS',
      })) as Address,
    );
  } catch {
    return null;
  }
  let reserve: { aToken: Address; variableDebtToken: Address };
  try {
    reserve = await resolveAaveTokens(underlying, rpc);
  } catch {
    return null;
  }
  if (reserve.aToken === t) return { kind: 'aToken', token: t, underlying };
  if (reserve.variableDebtToken === t) return { kind: 'variableDebtToken', token: t, underlying };
  return null;
}

export async function readDebtAmount(variableDebtToken: Address, signer: Address, rpc?: string): Promise<bigint> {
  return client(rpc).readContract({
    address: variableDebtToken,
    abi: ERC20_BALANCE_ABI,
    functionName: 'balanceOf',
    args: [signer],
  }) as Promise<bigint>;
}

export async function readErc20Balance(token: Address, holder: Address, rpc?: string): Promise<bigint> {
  try {
    return (await client(rpc).readContract({
      address: token,
      abi: ERC20_BALANCE_ABI,
      functionName: 'balanceOf',
      args: [holder],
    })) as bigint;
  } catch {
    return 0n;
  }
}

const LP_NO_DEADLINE = 9999999999n;

export async function resolveUserLps(signer: Address, rpc?: string): Promise<ExitLpLeg[]> {
  const c = client(rpc);
  const npm = ADDR.UNI_NPM as Address;
  const n = (await c.readContract({ address: npm, abi: UNI_V3_NPM_ABI, functionName: 'balanceOf', args: [signer] })) as bigint;
  const lps: ExitLpLeg[] = [];
  for (let i = 0n; i < n; i++) {
    const tokenId = (await c.readContract({ address: npm, abi: UNI_V3_NPM_ABI, functionName: 'tokenOfOwnerByIndex', args: [signer, i] })) as bigint;
    const p = (await c.readContract({ address: npm, abi: UNI_V3_NPM_ABI, functionName: 'positions', args: [tokenId] })) as readonly any[];
    const liquidity = p[7] as bigint;
    if (liquidity <= 0n) continue;
    let amount0: bigint | undefined;
    let amount1: bigint | undefined;
    try {
      const sim = await c.simulateContract({
        account: signer,
        address: npm,
        abi: UNI_V3_NPM_ABI,
        functionName: 'decreaseLiquidity',
        args: [{ tokenId, liquidity, amount0Min: 0n, amount1Min: 0n, deadline: LP_NO_DEADLINE }],
      });
      const out = sim.result as readonly [bigint, bigint];
      amount0 = out[0];
      amount1 = out[1];
    } catch {
    }
    lps.push({ tokenId, liquidity, token0: getAddress(p[2]), token1: getAddress(p[3]), amount0, amount1 });
  }
  return lps;
}

export interface ResolveOpts {
  rpc?: string;
  payoutAsset?: Address;
  slippage?: number;
  includeLp?: boolean;
  eoaPosition?: boolean;
}

export async function resolveOnchain(
  signer: Address,
  debtUnderlying: Address,
  collateralUnderlying: Address,
  opts: ResolveOpts = {},
): Promise<ExitPosition> {
  const s = getAddress(signer);
  const [{ variableDebtToken }, { aToken }] = await Promise.all([
    resolveAaveTokens(getAddress(debtUnderlying), opts.rpc),
    resolveAaveTokens(getAddress(collateralUnderlying), opts.rpc),
  ]);
  const amount = (await readDebtAmount(variableDebtToken, s, opts.rpc)).toString() as Uint;
  const eoaBalance = opts.eoaPosition
    ? ((await readErc20Balance(aToken, s, opts.rpc)).toString() as Uint)
    : undefined;
  const lp = opts.includeLp === false ? undefined : (await resolveUserLps(s, opts.rpc))[0];

  return {
    signer: s,
    proxy: s,
    collateral: { aToken, underlying: getAddress(collateralUnderlying), eoaBalance },
    debt: { underlying: getAddress(debtUnderlying), variableDebtToken, amount, onEoa: opts.eoaPosition },
    lp,
    payoutAsset: opts.payoutAsset,
    slippage: opts.slippage,
  };
}

export interface ScanRow {
  category: string;
  underlying?: { address?: string | null } | null;
  aave?: { aToken?: string | null; variableDebtToken?: string | null } | null;
  token?: string | null;
  balance?: string | bigint | null;
  protocol?: string | null;
  rewardsController?: string | null;
  assets?: (string | null)[] | null;
}
export interface ScanResult {
  address: string;
  positions: ScanRow[];
}

const SWEEPABLE_CATEGORIES = new Set(['staked', 'reward', 'dust', 'wallet']);

const RECLASSIFY_CATEGORIES = new Set(['staked', 'dust', 'wallet']);

const rowToken = (r: ScanRow): string | null => r.token ?? r.underlying?.address ?? null;

function rewardToClaim(r: ScanRow, token: Address): ExitClaim | null {
  const proto = (r.protocol ?? '').toLowerCase();
  if (proto === 'aave' || proto === 'aave-v3') {
    const assets = (r.assets ?? []).filter((a): a is string => !!a).map((a) => getAddress(a));
    if (assets.length === 0) return null;
    return {
      kind: 'aave',
      reward: token,
      rewardsController: r.rewardsController ? getAddress(r.rewardsController) : AAVE_REWARDS_CONTROLLER,
      assets,
    };
  }
  return null;
}

export type ResolvedExit = ExitPosition & { nonAtomic: ScanRow[]; deferredSweeps?: ExitSweep[]; deferredLps?: ExitLpLeg[] };

const AAVE_RESERVES_ABI = [
  { name: 'getReservesList', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'address[]' }] },
] as const;

export async function resolveAavePositionOnchain(
  signer: Address,
  rpc?: string,
): Promise<{ collateral: NonNullable<ExitPosition['collateral']>; debt: NonNullable<ExitPosition['debt']> } | null> {
  const c = client(rpc);
  const s = getAddress(signer);
  let reserves: readonly Address[];
  try {
    reserves = (await c.readContract({
      address: ADDR.AAVE_POOL as Address,
      abi: AAVE_RESERVES_ABI,
      functionName: 'getReservesList',
    })) as readonly Address[];
  } catch {
    return null;
  }
  if (reserves.length === 0) return null;

  const tokenAddrs = await c.multicall({
    allowFailure: true,
    contracts: reserves.map((u) => ({
      address: ADDR.AAVE_DATA_PROVIDER as Address,
      abi: AAVE_DATA_PROVIDER_ABI,
      functionName: 'getReserveTokensAddresses' as const,
      args: [u] as const,
    })),
  });
  const legs = reserves
    .map((u, i) => {
      const r = tokenAddrs[i];
      if (r.status !== 'success') return null;
      const [aToken, , vDebt] = r.result as readonly [Address, Address, Address];
      return { underlying: getAddress(u), aToken: getAddress(aToken), vDebt: getAddress(vDebt) };
    })
    .filter((x): x is { underlying: Address; aToken: Address; vDebt: Address } => x !== null);
  if (legs.length === 0) return null;

  const bals = await c.multicall({
    allowFailure: true,
    contracts: legs.flatMap((t) => [
      { address: t.aToken, abi: ERC20_BALANCE_ABI, functionName: 'balanceOf' as const, args: [s] as const },
      { address: t.vDebt, abi: ERC20_BALANCE_ABI, functionName: 'balanceOf' as const, args: [s] as const },
    ]),
  });

  let bestColl: { aToken: Address; underlying: Address; bal: bigint } | null = null;
  let bestDebt: { variableDebtToken: Address; underlying: Address; bal: bigint } | null = null;
  for (let i = 0; i < legs.length; i++) {
    const t = legs[i];
    const aRes = bals[i * 2];
    const dRes = bals[i * 2 + 1];
    const aBal = aRes?.status === 'success' ? (aRes.result as bigint) : 0n;
    const dBal = dRes?.status === 'success' ? (dRes.result as bigint) : 0n;
    if (aBal > 0n && (!bestColl || aBal > bestColl.bal)) bestColl = { aToken: t.aToken, underlying: t.underlying, bal: aBal };
    if (dBal > 0n && (!bestDebt || dBal > bestDebt.bal)) bestDebt = { variableDebtToken: t.vDebt, underlying: t.underlying, bal: dBal };
  }

  if (!bestColl || !bestDebt) return null;
  return {
    collateral: { aToken: bestColl.aToken, underlying: bestColl.underlying, eoaBalance: bestColl.bal.toString() as Uint },
    debt: { underlying: bestDebt.underlying, variableDebtToken: bestDebt.variableDebtToken, amount: bestDebt.bal.toString() as Uint, onEoa: true },
  };
}

export async function resolveFromScan(scan: ScanResult, opts: ResolveOpts = {}): Promise<ResolvedExit> {
  const signer = getAddress(scan.address);
  const loan = scan.positions.find((p) => p.category === 'loan');
  const coll = scan.positions.find((p) => p.category === 'collateral');

  let debt: ExitPosition['debt'];
  let collateral: ExitPosition['collateral'];

  if (loan?.underlying?.address && coll?.underlying?.address) {
    const debtUnderlying = getAddress(loan.underlying.address);
    const collUnderlying = getAddress(coll.underlying.address);
    const variableDebtToken = loan.aave?.variableDebtToken
      ? getAddress(loan.aave.variableDebtToken)
      : (await resolveAaveTokens(debtUnderlying, opts.rpc)).variableDebtToken;
    const aToken = coll.aave?.aToken
      ? getAddress(coll.aave.aToken)
      : (await resolveAaveTokens(collUnderlying, opts.rpc)).aToken;
    const amount = (await readDebtAmount(variableDebtToken, signer, opts.rpc)).toString() as Uint;
    debt = { underlying: debtUnderlying, variableDebtToken, amount };
    collateral = { aToken, underlying: collUnderlying };
  }

  const reclassified = new Set<string>();
  if (!debt && !collateral) {
    let bestColl: { aToken: Address; underlying: Address; bal: bigint } | null = null;
    let bestDebt: { variableDebtToken: Address; underlying: Address; bal: bigint } | null = null;
    for (const row of scan.positions) {
      if (!RECLASSIFY_CATEGORIES.has(row.category)) continue;
      const tokStr = rowToken(row);
      if (!tokStr) continue;
      const token = getAddress(tokStr);
      const info = await classifyAaveReceiptToken(token, opts.rpc);
      if (!info) continue;
      reclassified.add(token.toLowerCase());
      const bal = await readErc20Balance(token, signer, opts.rpc);
      if (bal <= 0n) continue;
      if (info.kind === 'aToken') {
        if (!bestColl || bal > bestColl.bal) bestColl = { aToken: info.token, underlying: info.underlying, bal };
      } else if (!bestDebt || bal > bestDebt.bal) {
        bestDebt = { variableDebtToken: info.token, underlying: info.underlying, bal };
      }
    }
    if (bestColl && bestDebt) {
      collateral = { aToken: bestColl.aToken, underlying: bestColl.underlying, eoaBalance: bestColl.bal.toString() as Uint };
      debt = {
        underlying: bestDebt.underlying,
        variableDebtToken: bestDebt.variableDebtToken,
        amount: bestDebt.bal.toString() as Uint,
        onEoa: true,
      };
    }
  }

  if (!debt || !collateral) {
    const onchain = await resolveAavePositionOnchain(signer, opts.rpc);
    if (onchain) {
      collateral = onchain.collateral;
      debt = onchain.debt;
      reclassified.add(onchain.collateral.aToken.toLowerCase());
      reclassified.add(onchain.debt.variableDebtToken.toLowerCase());
    }
  }

  const sweeps: ExitSweep[] = [];
  const claims: ExitClaim[] = [];
  const nonAtomic: ScanRow[] = [];
  const sweepSeen = new Set<string>();

  for (const row of scan.positions) {
    if (!SWEEPABLE_CATEGORIES.has(row.category)) continue;
    const tokStr = rowToken(row);
    if (!tokStr) continue;
    const token = getAddress(tokStr);
    const tokenLc = token.toLowerCase();

    if (reclassified.has(tokenLc)) continue;

    if (tokenLc === (opts.payoutAsset ?? getAddress(ADDR.USDC)).toLowerCase()) continue;

    if (isLocked(token)) {
      nonAtomic.push(row);
      continue;
    }

    if (row.category === 'reward') {
      const claim = rewardToClaim(row, token);
      if (claim) {
        claims.push(claim);
        continue;
      }
    }

    const cached = row.balance != null ? BigInt(row.balance) : null;
    const bal = cached ?? (await readErc20Balance(token, signer, opts.rpc));
    if (bal <= 0n) continue;

    void isLst(token);
    if (!sweepSeen.has(tokenLc)) {
      sweepSeen.add(tokenLc);
      sweeps.push({ token, slippage: opts.slippage, eoaBalance: bal.toString() as Uint });
    }
  }

  let deferredSweeps: ExitSweep[] | undefined;
  if (debt?.onEoa) {
    deferredSweeps = sweeps.filter((s) => s.eoaBalance != null && BigInt(s.eoaBalance) > 0n).map((s) => ({ ...s }));
    for (const c of claims) nonAtomic.push({ category: 'deferred', token: 'reward' in c ? c.reward : null });
    sweeps.length = 0;
    claims.length = 0;
  }

  const lps = opts.includeLp === false ? [] : await resolveUserLps(signer, opts.rpc);
  const lp = debt?.onEoa ? undefined : lps[0];
  const deferredLps = debt?.onEoa ? lps : [];

  const actionable = !!debt || !!lp || deferredLps.length > 0 || sweeps.length > 0 || claims.length > 0;
  if (!actionable) {
    throw new Error('scan has nothing actionable: no loan/collateral, no LP, no sweepable balances, no claimable rewards');
  }

  return {
    signer,
    proxy: signer,
    collateral,
    debt,
    lp,
    sweeps: sweeps.length > 0 ? sweeps : undefined,
    claims: claims.length > 0 ? claims : undefined,
    nonAtomic,
    deferredSweeps: deferredSweeps && deferredSweeps.length > 0 ? deferredSweeps : undefined,
    deferredLps: deferredLps.length > 0 ? deferredLps : undefined,
    payoutAsset: opts.payoutAsset,
    slippage: opts.slippage,
  };
}
