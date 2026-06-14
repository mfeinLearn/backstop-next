import { getAddress, type Address } from 'viem';

export const LST = {
  stETH: '0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84',
  wstETH: '0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0',
  rETH: '0xae78736Cd615f374D3085123A210448E74Fc6393',
  cbETH: '0xBe9895146f7AF43049ca1c1AE358B0541Ea49704',
  sfrxETH: '0xac3E018457B222d93114458476f3E3416Abbe38F',
  frxETH: '0x5E8422345238F34275888049021821E8E08CAa1f',
} as const;

export const LST_SET = new Set(Object.values(LST).map((a) => a.toLowerCase()));

export const isLst = (token: string): boolean => LST_SET.has(token.toLowerCase());

export const LOCKED = {
  unstETH_NFT: '0x889edC2eDab5f40e902b864aD4d7AdE8E412F9B1',
  veCRV: '0x5f3b5DfEb7B28CDbD7FAba78963EE202a494e2A2',
  vlCVX: '0x72a19342e8F1838460eBFCCEf09F6585e32db86E',
  fraxRedemptionQueue: '0x82bA8da44Cd5261762e629dd5c605b17715727bd',
} as const;

export const LOCKED_SET = new Set(Object.values(LOCKED).map((a) => a.toLowerCase()));

export const isLocked = (token: string): boolean => LOCKED_SET.has(token.toLowerCase());

export const lstAddr = (k: keyof typeof LST): Address => getAddress(LST[k]);
