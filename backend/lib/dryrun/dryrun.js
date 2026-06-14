import { quoteToUsdc } from "./uniswap-quote.js";


const DEFAULTS = {
  assumedSlippageBps: 50,   // 0.50% fallback when a live quote isn't available
  flashloanFeeBps: 5,       // 0.05% Aave V3 flashloan fee on repaid debt
  gasUsd: 8,                // rough gas for the exit tx
};

const bps = (v, b) => v * (b / 10_000);
const ASSET = new Set(["collateral", "lp", "staked", "reward", "dust"]);

export async function dryRun(scan, apiKey, opts = {}) {
  const cfg = { ...DEFAULTS, ...opts };

  let assetsUsdc = 0;    
  let debtUsd = 0;        
  const lines = [];       

  for (const p of scan.positions) {
    if (p.category === "loan") {
      debtUsd += p.valueUsd;
      lines.push({ ...summary(p), kind: "debt", usdc: -p.valueUsd, quoted: false });
      continue;
    }
    if (!ASSET.has(p.category)) continue;


    const quoted = await quoteToUsdc(p, apiKey);
    const usdc =
      quoted ?? p.valueUsd - bps(p.valueUsd, cfg.assumedSlippageBps);

    assetsUsdc += usdc;
    lines.push({ ...summary(p), kind: "asset", usdc, quoted: quoted != null });
  }

  const flashloanFee = bps(debtUsd, cfg.flashloanFeeBps);
  const guaranteedMinUsdc = assetsUsdc - debtUsd - flashloanFee - cfg.gasUsd;

  return {
    address: scan.address,
    chain: scan.chain,
    grossValueUsd: scan.totalUsd,
    assetsRecoveredUsdc: assetsUsdc,
    debtRepaidUsd: debtUsd,
    flashloanFee,
    gas: cfg.gasUsd,
    guaranteedMinUsdc,  
    lines,
    assumptions: cfg,
  };
}

function summary(p) {
  return {
    protocol: p.protocol,
    category: p.category,
    valueUsd: p.valueUsd,
    token: p.underlying?.address ?? p.underlying?.fungibleId ?? "—",
  };
}
