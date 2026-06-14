import { resources, type Bindable, type FlowBuilder, type InputSchema } from '@lifi/composer-sdk';
import { MAINNET, ADDR } from '../../config';
import { aaveFlashloanPremium, padForAaveDebtRounding } from '../../onchain/aaveRounding';
import { DEFAULT_SLIPPAGE, ALLOWED_EXCHANGES } from './constants';
import { addLpLeg } from './lpLeg';
import { appendClaims } from './claim';
import { appendSweeps, type SweepInputs } from './sweep';
import type { ExitPosition, Uint } from './types';

export type ExitInputs = InputSchema & { debtFlashloan: ReturnType<typeof resources.erc20> };

export interface AppendExitOpts {
  sweepInputs?: SweepInputs;
}

export function appendExitOps<T extends ExitInputs>(
  builder: FlowBuilder<T>,
  position: ExitPosition,
  opts: AppendExitOpts = {},
): { paddedPrincipal: Uint } {
  const debt = position.debt;
  const collateral = position.collateral;
  if (!debt || !collateral) {
    throw new Error('appendExitOps requires both debt and collateral; use buildSweepOnlyFlow for no-debt positions');
  }
  const payout = position.payoutAsset ?? debt.underlying;
  const slippage = position.slippage ?? DEFAULT_SLIPPAGE;
  const DEBT_ACCRUAL_BUFFER_BPS = 5n;
  const paddedPrincipal = debt.onEoa
    ? ((BigInt(debt.amount) + (BigInt(debt.amount) * DEBT_ACCRUAL_BUFFER_BPS) / 10000n + 1n).toString() as Uint)
    : padForAaveDebtRounding(debt.amount);

  const sellToPayout = (id: string, amountIn: unknown): void => {
    builder.lifi.swap(id, {
      bind: { amountIn: amountIn as never },
      config: {
        resourceOut: resources.erc20(payout, MAINNET),
        slippage,
        exchanges: { allow: [...ALLOWED_EXCHANGES] },
      },
    });
  };

  const debtFlashloan = builder.inputs.debtFlashloan as Bindable<'resource'>;

  if (debt.onEoa) {
    builder.aave.repay('repay', {
      bind: { assetIn: debtFlashloan, onBehalfOf: builder.context.sender },
      config: { pool: ADDR.AAVE_POOL, mode: 'exact' },
    });
  } else {
    builder.aave.repay('repay', {
      bind: { assetIn: debtFlashloan, onBehalfOf: builder.context.executionAddress },
      config: { pool: ADDR.AAVE_POOL, mode: 'max' },
    });
  }

  if (collateral.eoaBalance) {
    const eoaABal = builder.core.balanceOf('eoa-a-bal', {
      bind: {},
      config: { token: collateral.aToken, owner: position.signer },
    });
    builder.core.call('pull-collateral', {
      bind: {
        from: builder.context.sender,
        to: builder.context.executionAddress,
        amount: eoaABal.balance,
      },
      config: {
        target: collateral.aToken,
        functionSignature: 'function transferFrom(address from, address to, uint256 amount)',
      },
    });
  }

  const aBal = builder.core.balanceOf('a-bal', { bind: {}, config: { token: collateral.aToken } });

  const withdraw = builder.lifi.zap('withdraw', {
    bind: { amountIn: aBal.balance },
    config: { resourceOut: resources.erc20(collateral.underlying, MAINNET) },
  });

  sellToPayout('sell', withdraw.amountOut);

  if (position.lp) addLpLeg(builder, position.lp, position.proxy, payout, sellToPayout);

  appendClaims(builder, position.claims ?? [], payout, sellToPayout);
  appendSweeps(builder, position.sweeps ?? [], payout, sellToPayout, opts.sweepInputs);

  const payoutBal = builder.core.balanceOf('payout-bal', {
    bind: {},
    config: { token: payout },
  });

  builder.lifi.flashloanRepay('repay-fl', {
    bind: { funds: payoutBal.balance },
    config: { leg: 'debtFlashloan', fee: aaveFlashloanPremium(paddedPrincipal) },
  });

  return { paddedPrincipal };
}
