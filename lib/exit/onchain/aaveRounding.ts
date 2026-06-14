export const AAVE_SAME_BLOCK_SKEW_WEI = 1n;

const BPS_DENOM = 10000n;
const AAVE_FLASHLOAN_PREMIUM_BPS = 5n;

export const padForAaveDebtRounding = (a: `${bigint}`): `${bigint}` =>
  (BigInt(a) + AAVE_SAME_BLOCK_SKEW_WEI).toString() as `${bigint}`;

export const aaveFlashloanPremium = (amount: `${bigint}`): `${bigint}` => {
  const a = BigInt(amount);
  const premium = (a * AAVE_FLASHLOAN_PREMIUM_BPS + (BPS_DENOM - 1n)) / BPS_DENOM;
  return premium.toString() as `${bigint}`;
};
