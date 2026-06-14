function req(k: string): string {
  const v = process.env[k];
  if (!v) throw new Error(`missing env ${k}`);
  return v;
}

export const getLifiApiKey = (): string => req('LIFI_API_KEY');
export const getLifiComposerBaseUrl = (): string => req('LIFI_COMPOSER_BASE_URL');
export const getAlchemyRpcUrl = (): string => req('ALCHEMY_RPC_URL');
export const getForkRpcUrl = (): string => process.env.FORK_RPC_URL ?? 'http://127.0.0.1:8545';

export const MAINNET = 1;

export const ADDR = {
  USDC: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  WETH: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
  AAVE_POOL: '0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2',
  AAVE_DATA_PROVIDER: '0x497a1994c46d4f6C864904A9f1fac6328Cb7C8a6',
  aWETH: '0x4d5F47FA6A74757f35C14fD3a6Ef8E3C9BC514E8',
  vDebtUSDC: '0x72E95b8931767C79bA4EeE721354d6E99a61D004',
  UNI_NPM: '0xC36442b4a4522E871399CD717aBDD847Ab11FE88',
  UNI_V2_ROUTER: '0x7a250d5630B4cF539739dF2C5dACb4c659F2488D',
  MULTICALL3: '0xcA11bde05977b3631167028862bE2a173976CA11',
  LIFI_DIAMOND: '0x1231DEB6f5749EF6cE6943a275A1D3E7486F4EaE',
} as const;
