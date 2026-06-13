// Data-access layer for wallets.
//
// This is a MOCK: it reads from a static JSON file in /public and adds a small
// artificial delay so loading states behave like a real request. When the real
// API exists, swap the fetch URL below (e.g. the deployed endpoint) and keep
// the same `json.data` shape — nothing else has to change.

const MOCK_URL = "/mock/wallets.json";

export async function fetchWallets() {
  // simulate network latency
  await new Promise((resolve) => setTimeout(resolve, 600));

  const res = await fetch(MOCK_URL);
  if (!res.ok) throw new Error("failed to load wallets");
  const json = await res.json();
  return json.data;
}