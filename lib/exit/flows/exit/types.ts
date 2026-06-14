import type { Address } from 'viem';
import type { ExitSweep } from './sweep';
import type { ExitClaim } from './claim';

export type Uint = `${bigint}`;

export interface ExitCollateral {
  aToken: Address;
  underlying: Address;
  eoaBalance?: Uint;
}

export interface ExitDebt {
  underlying: Address;
  variableDebtToken: Address;
  amount: Uint;
  onEoa?: boolean;
}

export interface ExitLpLeg {
  tokenId: bigint;
  liquidity: bigint;
  token0: Address;
  token1: Address;
  amount0?: bigint;
  amount1?: bigint;
}

export interface ExitPosition {
  signer: Address;
  proxy: Address;
  collateral?: ExitCollateral;
  debt?: ExitDebt;
  payoutAsset?: Address;
  lp?: ExitLpLeg;
  sweeps?: ExitSweep[];
  claims?: ExitClaim[];
  slippage?: number;
}
