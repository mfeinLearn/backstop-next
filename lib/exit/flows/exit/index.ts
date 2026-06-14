import { materialisers, resources, type AnyBindable, type ComposeSdk } from '@lifi/composer-sdk';
import { encodeFunctionData, getAddress, type Address } from 'viem';
import { ADDR, MAINNET } from '../../config';
import { DEFAULT_SLIPPAGE } from './constants';
import { appendExitOps } from './flow';
import { appendClaims } from './claim';
import { addLpLeg } from './lpLeg';
import { appendSweeps, makeSell, type SweepInputs } from './sweep';
import type { ExitLpLeg, ExitPosition, Uint } from './types';

const ERC721_TRANSFER_ABI = [
  { name: 'transferFrom', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'from', type: 'address' }, { name: 'to', type: 'address' }, { name: 'tokenId', type: 'uint256' }], outputs: [] },
] as const;

export { appendExitOps } from './flow';
export type { ExitInputs } from './flow';
export { appendSweeps, makeSell } from './sweep';
export type { ExitSweep } from './sweep';
export { appendClaims } from './claim';
export type { ExitClaim, ExitAaveClaim, ExitCallClaim } from './claim';
export type { ExitPosition, ExitCollateral, ExitDebt, ExitLpLeg, Uint } from './types';

export function buildExitFlow(sdk: ComposeSdk, position: ExitPosition) {
  if (!position.debt) return buildSweepOnlyFlow(sdk, position);

  const pullCollateral = position.collateral?.eoaBalance != null;

  const builder = sdk.flow(MAINNET, {
    name: 'exit',
    inputs: { debtFlashloan: resources.erc20(position.debt.underlying, MAINNET) },
  });

  const { paddedPrincipal } = appendExitOps(builder, position);

  const flow = builder.build();
  const request = sdk.request(flow, {
    signer: position.signer,
    inputs: { debtFlashloan: materialisers.flashloan({ providerKind: 'aave-v3', amount: paddedPrincipal }) },
    sweepTo: builder.context.sender,
    simulationPolicy: pullCollateral ? 'allow-revert' : 'strict',
    ...(pullCollateral
      ? { assumptions: { 'sell.amountIn': BigInt(position.collateral!.eoaBalance!) } as never }
      : {}),
  });

  return { flow, request };
}

export interface SweepOnlyOpts {
  sweepDeposits?: Record<string, Uint>;
}

export function buildSweepOnlyFlow(sdk: ComposeSdk, position: ExitPosition, opts: SweepOnlyOpts = {}) {
  const payout = position.payoutAsset ?? getAddress(ADDR.USDC);
  const slippage = position.slippage ?? DEFAULT_SLIPPAGE;
  const deposits: Record<string, Uint> = { ...(opts.sweepDeposits ?? {}) };
  for (const s of position.sweeps ?? []) {
    const lc = s.token.toLowerCase();
    if (s.eoaBalance != null && BigInt(s.eoaBalance) > 0n && deposits[lc] == null) deposits[lc] = s.eoaBalance;
  }
  const depositKeys = Object.keys(deposits).map((k) => k.toLowerCase());

  const inputDecls: Record<string, ReturnType<typeof resources.erc20>> = {};
  for (const lc of depositKeys) inputDecls[`sweepin_${lc}`] = resources.erc20(getAddress(lc), MAINNET);

  const builder = sdk.flow(MAINNET, { name: 'sweep-only', inputs: inputDecls });
  const sell = makeSell(builder, payout, slippage);

  const sweepInputs: SweepInputs = {};
  for (const lc of depositKeys) {
    sweepInputs[lc] = (builder.inputs as Record<string, AnyBindable>)[`sweepin_${lc}`];
  }

  appendClaims(builder, position.claims ?? [], payout, sell);
  appendSweeps(builder, position.sweeps ?? [], payout, sell, sweepInputs);

  const reqInputs: Record<string, ReturnType<typeof materialisers.directDeposit>> = {};
  for (const lc of depositKeys) reqInputs[`sweepin_${lc}`] = materialisers.directDeposit({ amount: deposits[lc] });

  const flow = builder.build();
  const request = sdk.request(flow, {
    signer: position.signer,
    inputs: reqInputs,
    sweepTo: builder.context.sender,
    simulationPolicy: 'strict',
  });

  return { flow, request };
}

export interface LpExitInput {
  signer: Address;
  lp: ExitLpLeg;
  payoutAsset?: Address;
  slippage?: number;
}

export function buildLpExitFlow(sdk: ComposeSdk, input: LpExitInput, proxy: Address) {
  const payout = input.payoutAsset ?? getAddress(ADDR.USDC);
  const slippage = input.slippage ?? DEFAULT_SLIPPAGE;
  const lp = input.lp;

  const builder = sdk.flow(MAINNET, { name: 'lp-exit', inputs: {} });
  const sell = makeSell(builder, payout, slippage);

  const xferData = encodeFunctionData({ abi: ERC721_TRANSFER_ABI, functionName: 'transferFrom', args: [input.signer, getAddress(proxy), lp.tokenId] });
  builder.core.rawCall('lp-pull', { bind: {}, config: { target: ADDR.UNI_NPM, calldata: xferData, callType: 'Call' } });

  addLpLeg(builder, lp, getAddress(proxy), payout, sell);

  const payoutLc = payout.toLowerCase();
  const assumptions: Record<string, bigint> = {};
  if (lp.token0.toLowerCase() !== payoutLc && lp.amount0 != null) assumptions['lp-t0-swap.amountIn'] = lp.amount0;
  if (lp.token1.toLowerCase() !== payoutLc && lp.amount1 != null) assumptions['lp-t1-swap.amountIn'] = lp.amount1;

  const flow = builder.build();
  const request = sdk.request(flow, {
    signer: input.signer,
    inputs: {},
    sweepTo: builder.context.sender,
    simulationPolicy: 'allow-revert',
    assumptions: assumptions as never,
  });

  return { flow, request };
}
