import { createPublicClient, http } from "viem";
import { mainnet } from "viem/chains";

const DATA_PROVIDER = "0x497a1994c46d4f6C864904A9f1fac6328Cb7C8a6";  //default public mainnet, if doesn't work use alchemy RPC instead

const ABI = [
  {
    type: "function",
    name: "getReserveTokensAddresses",
    stateMutability: "view",
    inputs: [{ name: "asset", type: "address" }],
    outputs: [
      { name: "aTokenAddress", type: "address" },
      { name: "stableDebtTokenAddress", type: "address" },
      { name: "variableDebtTokenAddress", type: "address" },
    ],
  },
];


const client = createPublicClient({
  chain: mainnet,
  transport: http(process.env.ETH_RPC_URL || "https://eth.llamarpc.com"),
});


export async function getAaveReserveTokens(underlying) {
  if (!underlying) return { aToken: null, variableDebtToken: null };
  try {
    const [aToken, , variableDebtToken] = await client.readContract({
      address: DATA_PROVIDER,
      abi: ABI,
      functionName: "getReserveTokensAddresses",
      args: [underlying],
    });
    return { aToken, variableDebtToken };
  } catch {
    return { aToken: null, variableDebtToken: null };
  }
}
