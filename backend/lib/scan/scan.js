import { getAaveReserveTokens } from "./aave.js";

const ZERION_BASE = "https://api.zerion.io/v1";
const CHAIN = "ethereum"; 

const AAVE_COLLATERAL_PREFIX = "aEth";                 // e.g. aEthWETH, aEthUSDC
const AAVE_VARIABLE_DEBT_PREFIX = "variableDebtEth";   // e.g. variableDebtEthUSDC
const AAVE_STABLE_DEBT_PREFIX = "stableDebtEth";

function categorize(p) {
  const type = p.attributes.position_type;
  const protocol = (p.attributes.protocol ?? "").toLowerCase();
  const symbol = p.attributes.fungible_info?.symbol ?? "";

  // 1. Debt tokens -> loan. Checked first; these are unambiguous.
  if (
    symbol.startsWith(AAVE_VARIABLE_DEBT_PREFIX) ||
    symbol.startsWith(AAVE_STABLE_DEBT_PREFIX)
  ) {
    return "loan";
  }

  // 2. aTokens -> collateral. The "aEth" prefix is specific to Aave V3 on
  //    mainnet, so it won't collide with normal tokens like AAVE or aUSD.
  if (symbol.startsWith(AAVE_COLLATERAL_PREFIX)) {
    return "collateral";
  }

  // 3. Otherwise fall back to Zerion's own position_type.
  if (type === "loan") return "loan";
  if (type === "reward") return "reward";
  if (type === "staked" || type === "locked") return "staked";

  if (type === "deposit") {
    if (
      protocol.includes("uniswap") || protocol.includes("aerodrome") ||
      protocol.includes("balancer") || protocol.includes("curve")
    ) {
      return "lp";
    }
    return "collateral";
  }

  return "dust";
}

function chainOf(p) {
  return p.relationships?.chain?.data?.id ?? "unknown";
}

function fungibleIdOf(p) {
  return p.relationships?.fungible?.data?.id ?? null;
}


function ethImpl(p) {
  const impls = p.attributes.fungible_info?.implementations ?? [];
  return impls.find((i) => i.chain_id === CHAIN) ?? null;
}

const auth = (apiKey) => "Basic " + Buffer.from(`${apiKey}:`).toString("base64");


async function resolveFungible(fungibleId, apiKey) {
  if (!fungibleId) return null;
  try {
    const res = await fetch(`${ZERION_BASE}/fungibles/${fungibleId}`, {
      headers: { Authorization: auth(apiKey), accept: "application/json" },
    });
    if (!res.ok) return null;
    const json = await res.json();
    const impls = json?.data?.attributes?.implementations ?? [];
    return impls.find((i) => i.chain_id === CHAIN) ?? null;
  } catch {
    return null;
  }
}

// Fetch ethereum positions from Zerion (paginated).
async function fetchZerion(address, apiKey, complexOnly) {
  const filter = complexOnly ? "only_complex" : "no_filter";
  let url =
    `${ZERION_BASE}/wallets/${address}/positions/` +
    `?currency=usd&filter[positions]=${filter}` +
    `&filter[chain_ids]=${CHAIN}&sort=-value&page[size]=100`;

  const all = [];
  let guard = 0;
  while (url && guard < 20) {
    const res = await fetch(url, {
      headers: { Authorization: auth(apiKey), accept: "application/json" },
    });
    if (!res.ok) throw new Error(`Zerion ${res.status}: ${await res.text()}`);
    const json = await res.json();
    all.push(...json.data);
    url = json.links?.next;
    guard++;
  }
  return { data: all };
}

// Main entry
export async function scan(address, apiKey, opts = {}) {
  const includeDust = opts.includeDust ?? true;
  const minUsd = opts.minUsd ?? 0;

  const raw = await fetchZerion(address, apiKey, !includeDust);

  const ethRows = raw.data
    .filter((p) => chainOf(p) === CHAIN)
    .filter((p) => (p.attributes.value ?? 0) >= minUsd);

  const positions = [];
  for (const p of ethRows) {
    const category = categorize(p);

    const fungibleId = fungibleIdOf(p);
    let impl = ethImpl(p);
    if (!impl) impl = await resolveFungible(fungibleId, apiKey); // fallback

    const underlying = {
      address: impl?.address ?? null,
      decimals: impl?.decimals ?? null,
      amountWei: p.attributes.quantity?.int ?? null, // base units
      fungibleId,
    };


    let aave = null;
    if (category === "loan" || category === "collateral") {
      const symbol = p.attributes.fungible_info?.symbol ?? "";

      // If the position's token IS already an Aave token (aEth.../variableDebt...),
      // we already hold the address — no lookup needed.
      if (symbol.startsWith("aEth")) {
        aave = { aToken: underlying.address, variableDebtToken: null };
      } else if (symbol.startsWith("variableDebtEth") || symbol.startsWith("stableDebtEth")) {
        aave = { aToken: null, variableDebtToken: underlying.address };
      } else {
        // Normal case: we have the underlying, look up its Aave tokens on-chain.
        const { aToken, variableDebtToken } = await getAaveReserveTokens(underlying.address);
        aave = { aToken, variableDebtToken };
      }
    }

    positions.push({
      chain: CHAIN,
      protocol: p.attributes.protocol ?? "wallet",
      category,
      valueUsd: p.attributes.value ?? 0,
      underlying,
      aave, 
    });
  }

  return {
    address,
    chain: CHAIN,
    totalUsd: positions.reduce((s, p) => s + p.valueUsd, 0),
    positions,
  };
}
