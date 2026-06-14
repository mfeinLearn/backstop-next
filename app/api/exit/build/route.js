import { encodeFunctionData, erc20Abi, getAddress, maxUint256 } from 'viem';
import { onchainScan } from '../../../../backend/lib/scan/onchainScan.js';
import { getSdk } from '../../../../lib/exit/lifi';
import { resolveFromScan } from '../../../../lib/exit/integration/resolve';
import { buildExitFlow, buildSweepOnlyFlow, buildLpExitFlow } from '../../../../lib/exit/flows/exit/index';
import { extractPayout } from '../../../../lib/exit/dryrun';

const UNI_NPM = '0xC36442b4a4522E871399CD717aBDD847Ab11FE88';
const SET_APPROVAL_FOR_ALL_ABI = [
  { name: 'setApprovalForAll', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'operator', type: 'address' }, { name: 'approved', type: 'bool' }], outputs: [] },
];

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

function toJsonSafe(v) {
  if (typeof v === 'bigint') return v.toString();
  if (Array.isArray(v)) return v.map(toJsonSafe);
  if (v && typeof v === 'object') {
    const out = {};
    for (const [k, val] of Object.entries(v)) out[k] = toJsonSafe(val);
    return out;
  }
  return v;
}

const NO_POSITION_RE = /scan has no (loan|collateral) position/i;

export async function POST(req) {
  const body = await req.json().catch(() => ({}));

  let scanResult = body.scan;
  if (!scanResult) {
    if (!body.address) return Response.json({ error: 'address or scan required' }, { status: 400 });
    if (!process.env.ALCHEMY_RPC_URL) return Response.json({ error: 'ALCHEMY_RPC_URL not set on server' }, { status: 500 });
    try {
      scanResult = await onchainScan(body.address, { minUsd: 0 });
    } catch (e) {
      return Response.json({ error: e?.message ?? 'scan failed' }, { status: 502 });
    }
  }

  let position;
  try {
    position = await resolveFromScan(scanResult);
  } catch (e) {
    const msg = e?.message ?? 'could not resolve position';
    if (NO_POSITION_RE.test(msg)) {
      return Response.json({ error: 'no actionable Aave position to exit', detail: msg }, { status: 422 });
    }
    return Response.json({ error: msg }, { status: 502 });
  }

  let result;
  try {
    const sdk = getSdk();
    const { request } = buildExitFlow(sdk, position);
    result = await sdk.client.compile(request);
  } catch (e) {
    return Response.json({ error: e?.message ?? 'compile failed', status: 'error' }, { status: 502 });
  }

  const okStatus = result && (result.status === 'success' || result.status === 'partial');
  if (!okStatus || !result.transactionRequest?.to) {
    return Response.json(
      { error: 'composer compile did not succeed', status: result?.status ?? 'unknown', detail: result?.error ?? result?.message },
      { status: 502 },
    );
  }

  const payout = extractPayout(result, position.signer);
  const tr = result.transactionRequest ?? {};
  const proxy = result.userProxy;
  const approvals = (result.approvals ?? []).map((ap) => ({
    spender: ap.spender ?? ap.transactionRequest?.to,
    transactionRequest: {
      to: ap.transactionRequest?.to,
      data: ap.transactionRequest?.data,
      value: ap.transactionRequest?.value ?? '0',
    },
  }));

  if (proxy && position.collateral?.aToken && position.collateral?.eoaBalance != null) {
    approvals.unshift({
      spender: getAddress(proxy),
      transactionRequest: {
        to: getAddress(position.collateral.aToken),
        data: encodeFunctionData({ abi: erc20Abi, functionName: 'approve', args: [getAddress(proxy), maxUint256] }),
        value: '0',
      },
    });
  }

  const pricedTokens = new Set(
    (scanResult.positions ?? [])
      .filter((p) => Number(p.value ?? 0) > 0)
      .map((p) => (p.token ?? '').toLowerCase()),
  );
  const sweepList = (position.deferredSweeps ?? []).filter((s) => pricedTokens.has(s.token.toLowerCase()));

  let sweepTr = null;
  if (proxy && sweepList.length) {
    try {
      const sdk = getSdk();
      const sweepPos = { signer: position.signer, proxy: position.signer, sweeps: sweepList, payoutAsset: position.payoutAsset };
      const { request: sweepReq } = buildSweepOnlyFlow(sdk, sweepPos);
      const sweepResult = await sdk.client.compile(sweepReq);
      if (sweepResult?.transactionRequest?.to && (sweepResult.status === 'success' || sweepResult.status === 'partial')) {
        const st = sweepResult.transactionRequest;
        sweepTr = { to: st.to, data: st.data, value: st.value ?? '0', gasLimit: st.gasLimit };
        for (const ap of sweepResult.approvals ?? []) {
          approvals.push({
            spender: ap.spender ?? ap.transactionRequest?.to,
            transactionRequest: { to: ap.transactionRequest?.to, data: ap.transactionRequest?.data, value: ap.transactionRequest?.value ?? '0' },
          });
        }
        for (const s of sweepList) {
          approvals.push({
            spender: getAddress(proxy),
            transactionRequest: {
              to: getAddress(s.token),
              data: encodeFunctionData({ abi: erc20Abi, functionName: 'approve', args: [getAddress(proxy), maxUint256] }),
              value: '0',
            },
          });
        }
      }
    } catch {
      sweepTr = null;
    }
  }

  let lpTr = null;
  if (proxy && position.deferredLps?.length) {
    try {
      const sdk = getSdk();
      const lpInput = { signer: position.signer, lp: position.deferredLps[0], payoutAsset: position.payoutAsset };
      const { request: lpReq } = buildLpExitFlow(sdk, lpInput, proxy);
      const lpResult = await sdk.client.compile(lpReq);
      if (lpResult?.transactionRequest?.to && (lpResult.status === 'success' || lpResult.status === 'partial')) {
        const lt = lpResult.transactionRequest;
        lpTr = { to: lt.to, data: lt.data, value: lt.value ?? '0', gasLimit: lt.gasLimit };
        for (const ap of lpResult.approvals ?? []) {
          approvals.push({
            spender: ap.spender ?? ap.transactionRequest?.to,
            transactionRequest: { to: ap.transactionRequest?.to, data: ap.transactionRequest?.data, value: ap.transactionRequest?.value ?? '0' },
          });
        }
        approvals.push({
          spender: getAddress(proxy),
          transactionRequest: {
            to: getAddress(UNI_NPM),
            data: encodeFunctionData({ abi: SET_APPROVAL_FOR_ALL_ABI, functionName: 'setApprovalForAll', args: [getAddress(proxy), true] }),
            value: '0',
          },
        });
      }
    } catch {
      lpTr = null;
    }
  }

  const seenAp = new Set();
  const dedupApprovals = approvals.filter((ap) => {
    const k = `${(ap.transactionRequest?.to ?? '').toLowerCase()}-${(ap.spender ?? '').toLowerCase()}`;
    if (seenAp.has(k)) return false;
    seenAp.add(k);
    return true;
  });

  return Response.json(
    toJsonSafe({
      proxy,
      status: result.status,
      payout,
      approvals: dedupApprovals,
      transactionRequest: {
        to: tr.to,
        data: tr.data,
        value: tr.value ?? '0',
        gasLimit: tr.gasLimit,
      },
      sweepTransactionRequest: sweepTr,
      lpTransactionRequest: lpTr,
    }),
    { headers: { 'cache-control': 'no-store' } },
  );
}
