const QUOTE_URL = "https://trade-api.gateway.uniswap.org/v1/quote";

const ETH_CHAIN_ID = 1;
const USDC = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"; 
const NATIVE = "0x0000000000000000000000000000000000000000"; 

export async function quoteToUsdc(position, apiKey) {
  const u = position.underlying || {};
  let tokenIn = u.address;

  if (!tokenIn && u.fungibleId === "eth") tokenIn = NATIVE; 
  if (!tokenIn || !u.amountWei) return null;       

  if (tokenIn.toLowerCase() === USDC.toLowerCase()) {
    return Number(u.amountWei) / 1e6;
  }
  if (!apiKey) return null;                          

  try {
    const res = await fetch(QUOTE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey },
      body: JSON.stringify({
        type: "EXACT_INPUT",
        tokenInChainId: ETH_CHAIN_ID,
        tokenOutChainId: ETH_CHAIN_ID,
        tokenIn,
        tokenOut: USDC,
        amount: String(u.amountWei),
        swapper: "0x0000000000000000000000000000000000000000",
        slippageTolerance: 0.5,
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();

    const out =
      data?.quote?.output?.amount ??
      data?.output?.amount ??
      data?.quote?.outputAmount ??
      null;
    return out ? Number(out) / 1e6 : null;
  } catch {
    return null;
  }
}
