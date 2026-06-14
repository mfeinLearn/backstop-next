import { type AnyBindable, type FlowBuilder, type InputSchema } from '@lifi/composer-sdk';
import type { Address } from 'viem';

type Sell = (id: string, amountIn: unknown) => void;

export interface ExitAaveClaim {
  kind: 'aave';
  reward: Address;
  rewardsController: Address;
  assets: Address[];
}

export interface ExitCallClaim {
  kind: 'call';
  reward: Address;
  target: Address;
  functionSignature: string;
  bind?: Record<string, AnyBindable>;
}

export type ExitClaim = ExitAaveClaim | ExitCallClaim;

export function appendClaims<T extends InputSchema>(
  builder: FlowBuilder<T>,
  claims: readonly ExitClaim[],
  payout: Address,
  sell: Sell,
): void {
  const payoutLc = payout.toLowerCase();
  const seen = new Set<string>();
  let i = 0;
  for (const c of claims) {
    const rewardLc = c.reward.toLowerCase();
    const dedupKey = c.kind === 'aave' ? `${c.rewardsController.toLowerCase()}:${rewardLc}` : `${c.target.toLowerCase()}:${rewardLc}`;
    if (seen.has(dedupKey)) continue;
    seen.add(dedupKey);

    if (c.kind === 'aave') {
      builder.aave.claimRewards(`claim-${i}`, {
        bind: {},
        config: {
          rewardsController: c.rewardsController,
          assets: c.assets,
          reward: c.reward,
        },
      });
    } else {
      builder.core.call(`claim-${i}`, {
        bind: (c.bind ?? {}) as never,
        config: {
          target: c.target,
          functionSignature: c.functionSignature,
        },
      });
    }

    if (rewardLc !== payoutLc) {
      const bal = builder.core.balanceOf(`claim-${i}-bal`, { bind: {}, config: { token: c.reward } });
      sell(`claim-${i}-swap`, bal.balance);
    }
    i++;
  }
}

export { makeSell } from './sweep';

export const AAVE_REWARDS_CONTROLLER = '0x8164Cc65827dcFe994AB23944CBC90e0aa80bFcb' as Address;

export const REWARD_SIGS = {
  curveClaimRewards: 'function claim_rewards(address addr)',
  convexGetReward: 'function getReward(address account)',
  cometRewardsClaim: 'function claim(address comet, address src, bool shouldAccrue)',
} as const;
