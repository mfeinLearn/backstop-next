import "dotenv/config";
import { scan } from "../scan/scan.js";
import { dryRun } from "./dryrun.js";

async function main() {
  const address = process.argv[2];
  const zerionKey = process.env.ZERION_KEY;
  const uniswapKey = process.env.UNISWAP_API_KEY; 
  if (!address) throw new Error("Usage: run-dryrun 0xADDRESS");
  if (!zerionKey) throw new Error("Set ZERION_KEY");

  const scanResult = await scan(address, zerionKey, { includeDust: true, minUsd: 50 });
  const result = await dryRun(scanResult, uniswapKey);

  const usd = (n) => `$${Math.round(n).toLocaleString()}`;

  console.log(`\nWallet: ${result.address}`);
  console.log(`Chain:  ${result.chain}`);
  console.log(`Gross:  ${usd(result.grossValueUsd)}`);
  console.log(`──────────────────────────────────────`);

  for (const l of result.lines) {
    const tag = l.kind === "debt" ? "REPAY" : "SELL ";
    const src = l.quoted ? "live quote" : "estimate";
    console.log(
      `  ${tag} [${l.category.padEnd(10)}] ${l.protocol.padEnd(12)} ` +
      `${usd(l.usdc).padStart(12)}  (${src})`
    );
  }

  console.log(`──────────────────────────────────────`);
  console.log(`  assets recovered: ${usd(result.assetsRecoveredUsdc)}`);
  console.log(`  - debt repaid:    ${usd(result.debtRepaidUsd)}`);
  console.log(`  - flashloan fee:  ${usd(result.flashloanFee)}`);
  console.log(`  - gas:            ${usd(result.gas)}`);
  console.log(`\n══════════════════════════════════════`);
  console.log(`  YOU'LL RECEIVE ≥ ${usd(result.guaranteedMinUsdc)} USDC`);
  console.log(`══════════════════════════════════════\n`);
}

main().catch((e) => { console.error(e.message); process.exit(1); });
