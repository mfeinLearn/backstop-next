import "dotenv/config";
import { scan } from "./scan.js";

async function main() {
  const address = process.argv[2];
  const apiKey = process.env.ZERION_KEY;
  if (!address) throw new Error("Usage: run-scan 0xADDRESS");
  if (!apiKey) throw new Error("Set ZERION_KEY");

  const result = await scan(address, apiKey, { includeDust: true, minUsd: 0 });

  console.log(`\nWallet: ${result.address}`);
  console.log(`Chain:  ${result.chain}`);
  console.log(`Total:  $${Math.round(result.totalUsd).toLocaleString()}\n`);

  for (const p of result.positions) {
    const v = `$${Math.round(p.valueUsd).toLocaleString()}`;
    console.log(`[${p.category.padEnd(10)}] ${p.protocol.padEnd(14)} ${v}`);
    console.log(`     underlying: ${p.underlying.address ?? "—"}`);
    console.log(`     amount wei: ${p.underlying.amountWei ?? "—"}  decimals: ${p.underlying.decimals ?? "—"}`);
    console.log(`     fungible id: ${p.underlying.fungibleId ?? "—"}`);
    if (p.aave) {
      console.log(`     aToken:           ${p.aave.aToken ?? "—"}`);
      console.log(`     variableDebtToken:${p.aave.variableDebtToken ?? "—"}`);
    }
    console.log();
  }

  // also dump raw JSON for piping into DRY-RUN / BUILD later
  console.log("--- JSON ---");
  console.log(JSON.stringify(result, null, 2));
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
