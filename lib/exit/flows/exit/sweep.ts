import { resources, type AnyBindable, type FlowBuilder, type InputSchema } from '@lifi/composer-sdk';
import type { Address } from 'viem';
import { MAINNET } from '../../config';
import { DEFAULT_SLIPPAGE, ALLOWED_EXCHANGES } from './constants';

export interface ExitSweep {
  token: Address;
  slippage?: number;
  eoaBalance?: `${bigint}`;
}

type Sell = (id: string, amountIn: unknown) => void;

export type SweepInputs = Record<string, AnyBindable>;

export function appendSweeps<T extends InputSchema>(
  builder: FlowBuilder<T>,
  sweeps: readonly ExitSweep[],
  payout: Address,
  sell: Sell,
  inputs?: SweepInputs,
): void {
  const payoutLc = payout.toLowerCase();
  const seen = new Set<string>();
  let i = 0;
  for (const s of sweeps) {
    const lc = s.token.toLowerCase();
    if (lc === payoutLc || seen.has(lc)) continue;
    seen.add(lc);
    const handle = inputs?.[lc];
    if (handle !== undefined) {
      sell(`sweep-${i}-swap`, handle);
    } else {
      const bal = builder.core.balanceOf(`sweep-${i}-bal`, { bind: {}, config: { token: s.token } });
      sell(`sweep-${i}-swap`, bal.balance);
    }
    i++;
  }
}

export function makeSell<T extends InputSchema>(
  builder: FlowBuilder<T>,
  payout: Address,
  slippage: number = DEFAULT_SLIPPAGE,
): Sell {
  return (id, amountIn) =>
    builder.lifi.swap(id, {
      bind: { amountIn: amountIn as never },
      config: {
        resourceOut: resources.erc20(payout, MAINNET),
        slippage,
        exchanges: { allow: [...ALLOWED_EXCHANGES] },
      },
    });
}
