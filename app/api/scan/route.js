// app/api/scan/route.js
//
// Server-side endpoint that wraps your existing scan() backend.
// The Zerion key lives ONLY here (server). The browser never sees it.
//
// Put your existing scan.js (and whatever it imports) inside the Next project,
// e.g. at /lib/scan.js, so this import resolves. If you don't use the "@/" path
// alias, change the import to a relative path: "../../../lib/scan.js".

// import { scan } from '@/lib/scan';
import { scan } from '../../../backend/lib/scan/scan.js';

export const runtime = 'nodejs';        // scan.js uses Node APIs / fetch
export const dynamic = 'force-dynamic'; // never cache wallet scans

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const address = searchParams.get('address');
  const apiKey = process.env.ZERION_KEY; // from .env.local, server-only

  if (!address) {
    return Response.json({ error: 'Missing ?address' }, { status: 400 });
  }
  if (!apiKey) {
    return Response.json(
      { error: 'Server is missing ZERION_KEY' },
      { status: 500 }
    );
  }

  try {
    const result = await scan(address, apiKey, {
      includeDust: true,
      minUsd: 50,
    });
    return Response.json(result);
  } catch (err) {
    // surface a clean message; log the full error on the server
    console.error('scan failed:', err);
    return Response.json(
      { error: err?.message ?? 'Scan failed' },
      { status: 502 }
    );
  }
}