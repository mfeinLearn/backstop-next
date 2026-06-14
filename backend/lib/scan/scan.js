import { getAaveReserveTokens } from "./aave.js";

const ZERION_BASE = "https://api.zerion.io/v1";
const CHAIN = "ethereum"; 

function categorize(p) {
  const type = p.attributes.position_type;
  const protocol = (p.attributes.protocol ?? "").toLowerCase();
  if (type === "loan") return "loan";
  if (type === "reward") return "reward";
  if (type === "staked" || type === "locked") return "staked";
  if (type === "wallet") return "dust";
  if (type === "deposit") {
    if (
      protocol.includes("uniswap") || protocol.includes("aerodrome") ||
      protocol.includes("balancer") || protocol.includes("curve")
    ) return "lp";
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
      const { aToken, variableDebtToken } = await getAaveReserveTokens(underlying.address);
      aave = { aToken, variableDebtToken };
    }

    const fi = p.attributes.fungible_info ?? {};   // <-- add

    positions.push({
      chain: CHAIN,
      protocol: p.attributes.protocol ?? "wallet",
      category,
      name: fi.name ?? null,                       // <-- add
      symbol: fi.symbol ?? null,                   // <-- add
      iconUrl: fi.icon?.url ?? null,               // <-- add
      valueUsd: p.attributes.value ?? 0,
      underlying,
      aave, // null for non-Aave positions
    });
  }

  return {
    address,
    chain: CHAIN,
    totalUsd: positions.reduce((s, p) => s + p.valueUsd, 0),
    positions,
  };
}
