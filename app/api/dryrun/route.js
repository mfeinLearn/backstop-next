import { dryRunOnchain } from '../../../backend/lib/dryrun/dryrunOnchain.js';

export const runtime = 'nodejs';
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  try {
    if (!body.scan && !body.address) {
      return Response.json({ error: 'address or scan required' }, { status: 400 });
    }
    if (!body.scan && !process.env.ALCHEMY_RPC_URL) {
      return Response.json({ error: 'ALCHEMY_RPC_URL not set on server' }, { status: 500 });
    }
    const result = await dryRunOnchain(body);
    return Response.json(result, { headers: { 'cache-control': 'no-store' } });
  } catch (e) {
    return Response.json({ error: e?.message ?? 'dryrun failed' }, { status: 502 });
  }
}
