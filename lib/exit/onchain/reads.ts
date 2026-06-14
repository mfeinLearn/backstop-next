import {
  createPublicClient,
  decodeFunctionResult,
  encodeFunctionData,
  http,
  type Address,
} from 'viem';
import { mainnet } from 'viem/chains';
import { ADDR, getAlchemyRpcUrl, getForkRpcUrl } from '../config';
import { AAVE_POOL_ABI, ERC20_BALANCE_ABI, MULTICALL3_ABI, UNI_V3_NPM_ABI } from './abi';

export function mainnetClient(rpcUrl?: string) {
  return createPublicClient({ chain: mainnet, transport: http(rpcUrl ?? getAlchemyRpcUrl()) });
}

export function forkReadClient() {
  return createPublicClient({ chain: mainnet, transport: http(getForkRpcUrl()) });
}

export async function readUsdcDebt(user: Address, rpcUrl?: string): Promise<bigint> {
  const client = mainnetClient(rpcUrl);
  return client.readContract({
    address: ADDR.vDebtUSDC as Address,
    abi: ERC20_BALANCE_ABI,
    functionName: 'balanceOf',
    args: [user],
  }) as Promise<bigint>;
}

export async function readAWeth(user: Address, rpcUrl?: string): Promise<bigint> {
  const client = mainnetClient(rpcUrl);
  return client.readContract({
    address: ADDR.aWETH as Address,
    abi: ERC20_BALANCE_ABI,
    functionName: 'balanceOf',
    args: [user],
  }) as Promise<bigint>;
}

export interface UserAccountData {
  totalCollateralBase: bigint;
  totalDebtBase: bigint;
  availableBorrowsBase: bigint;
  currentLiquidationThreshold: bigint;
  ltv: bigint;
  healthFactor: bigint;
}

export async function readHealthFactor(user: Address, rpcUrl?: string): Promise<UserAccountData> {
  const client = mainnetClient(rpcUrl);
  const r = (await client.readContract({
    address: ADDR.AAVE_POOL as Address,
    abi: AAVE_POOL_ABI,
    functionName: 'getUserAccountData',
    args: [user],
  })) as readonly bigint[];
  return {
    totalCollateralBase: r[0],
    totalDebtBase: r[1],
    availableBorrowsBase: r[2],
    currentLiquidationThreshold: r[3],
    ltv: r[4],
    healthFactor: r[5],
  };
}

export interface PositionSummary {
  debt: bigint;
  aWeth: bigint;
  account: UserAccountData;
}

export async function readPositionSummary(user: Address, rpcUrl?: string): Promise<PositionSummary> {
  const client = mainnetClient(rpcUrl);
  const calls = [
    {
      target: ADDR.vDebtUSDC as Address,
      allowFailure: false,
      callData: encodeFunctionData({ abi: ERC20_BALANCE_ABI, functionName: 'balanceOf', args: [user] }),
    },
    {
      target: ADDR.aWETH as Address,
      allowFailure: false,
      callData: encodeFunctionData({ abi: ERC20_BALANCE_ABI, functionName: 'balanceOf', args: [user] }),
    },
    {
      target: ADDR.AAVE_POOL as Address,
      allowFailure: false,
      callData: encodeFunctionData({ abi: AAVE_POOL_ABI, functionName: 'getUserAccountData', args: [user] }),
    },
  ];
  const res = (await client.readContract({
    address: ADDR.MULTICALL3 as Address,
    abi: MULTICALL3_ABI,
    functionName: 'aggregate3',
    args: [calls],
  })) as readonly { success: boolean; returnData: `0x${string}` }[];

  const debt = decodeFunctionResult({ abi: ERC20_BALANCE_ABI, functionName: 'balanceOf', data: res[0].returnData }) as bigint;
  const aWeth = decodeFunctionResult({ abi: ERC20_BALANCE_ABI, functionName: 'balanceOf', data: res[1].returnData }) as bigint;
  const acct = decodeFunctionResult({ abi: AAVE_POOL_ABI, functionName: 'getUserAccountData', data: res[2].returnData }) as readonly bigint[];

  return {
    debt,
    aWeth,
    account: {
      totalCollateralBase: acct[0],
      totalDebtBase: acct[1],
      availableBorrowsBase: acct[2],
      currentLiquidationThreshold: acct[3],
      ltv: acct[4],
      healthFactor: acct[5],
    },
  };
}

export interface UniV3Position {
  token0: Address;
  token1: Address;
  fee: number;
  liquidity: bigint;
  tokensOwed0: bigint;
  tokensOwed1: bigint;
}

export async function readUniV3Position(tokenId: bigint, rpcUrl?: string): Promise<UniV3Position> {
  const client = mainnetClient(rpcUrl);
  const r = (await client.readContract({
    address: ADDR.UNI_NPM as Address,
    abi: UNI_V3_NPM_ABI,
    functionName: 'positions',
    args: [tokenId],
  })) as readonly [bigint, Address, Address, Address, number, number, number, bigint, bigint, bigint, bigint, bigint];
  return {
    token0: r[2],
    token1: r[3],
    fee: r[4],
    liquidity: r[7],
    tokensOwed0: r[10],
    tokensOwed1: r[11],
  };
}
