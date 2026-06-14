import { onchainScan } from '../../../backend/lib/scan/onchainScan.js';

export const runtime = 'nodejs';
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const address = searchParams.get('address');
  if (!address) return Response.json({ error: 'address required' }, { status: 400 });
  if (!process.env.ALCHEMY_RPC_URL) return Response.json({ error: 'ALCHEMY_RPC_URL not set on server' }, { status: 500 });
  try {
    const minUsd = Number(searchParams.get('minUsd') ?? 0);
    const result = await onchainScan(address, { minUsd });
    return Response.json(result, { headers: { 'cache-control': 'no-store' } });
  } catch (e) {
    return Response.json({ error: e?.message ?? 'scan failed' }, { status: 502 });
  }
}
