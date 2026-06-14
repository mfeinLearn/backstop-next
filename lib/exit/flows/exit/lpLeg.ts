import { encodeFunctionData, maxUint128, type Address } from 'viem';
import { type FlowBuilder, type InputSchema } from '@lifi/composer-sdk';
import { ADDR } from '../../config';
import { UNI_V3_NPM_ABI } from '../../onchain/abi';
import { NO_DEADLINE } from './constants';
import type { ExitLpLeg } from './types';

type Sell = (id: string, amountIn: unknown) => void;

export function addLpLeg<T extends InputSchema>(
  builder: FlowBuilder<T>,
  lp: ExitLpLeg,
  proxy: Address,
  payout: Address,
  sell: Sell,
): void {
  const decreaseData = encodeFunctionData({
    abi: UNI_V3_NPM_ABI,
    functionName: 'decreaseLiquidity',
    args: [{ tokenId: lp.tokenId, liquidity: lp.liquidity, amount0Min: 0n, amount1Min: 0n, deadline: NO_DEADLINE }],
  });

  const collectData = encodeFunctionData({
    abi: UNI_V3_NPM_ABI,
    functionName: 'collect',
    args: [{ tokenId: lp.tokenId, recipient: proxy, amount0Max: maxUint128, amount1Max: maxUint128 }],
  });

  builder.core.rawCall('lp-decrease', {
    bind: {},
    config: { target: ADDR.UNI_NPM, calldata: decreaseData, callType: 'Call' },
  });

  builder.core.rawCall('lp-collect', {
    bind: {},
    config: { target: ADDR.UNI_NPM, calldata: collectData, callType: 'Call' },
  });

  const freed = [
    { id: 'lp-t0', token: lp.token0 },
    { id: 'lp-t1', token: lp.token1 },
  ] as const;

  for (const { id, token } of freed) {
    const bal = builder.core.balanceOf(`${id}-bal`, {
      bind: {},
      config: { token },
    });
    if (token.toLowerCase() === payout.toLowerCase()) continue;
    sell(`${id}-swap`, bal.balance);
  }
}
