'use client';

import { useEffect, useRef, useState } from 'react';
import { useDynamicContext } from '@dynamic-labs/sdk-react-core';
import { isEthereumWallet } from '@dynamic-labs/ethereum';
import '../app/globals.css';
import logo from '../Product/Logo_BFB.png';

const EXIT_PHASES = [
  { key: 'building', label: 'Building exit', sub: 'Quoting routes · MEV-protected', pct: 25 },
  { key: 'approving', label: 'Awaiting signature', sub: 'Confirm the exit in your wallet - one signature', pct: 50 },
  { key: 'broadcasting', label: 'Broadcasting', sub: 'Executing exit on-chain', pct: 78 },
  { key: 'mined', label: 'Mined', sub: 'Confirmed on-chain', pct: 100 },
];
const coins = [
  { sx: '-154px', sy: '14px', mx: '-96px', my: '-42px', r0: '-18deg', r1: '128deg', r2: '246deg', d: '.00s' },
  { sx: '142px', sy: '20px', mx: '96px', my: '-52px', r0: '24deg', r1: '-112deg', r2: '-226deg', d: '.03s' },
  { sx: '-116px', sy: '126px', mx: '-138px', my: '44px', r0: '38deg', r1: '186deg', r2: '344deg', d: '.06s' },
  { sx: '124px', sy: '132px', mx: '134px', my: '48px', r0: '-32deg', r1: '-194deg', r2: '-356deg', d: '.09s' },
  { sx: '-34px', sy: '240px', mx: '-88px', my: '118px', r0: '16deg', r1: '154deg', r2: '312deg', d: '.12s' },
  { sx: '42px', sy: '238px', mx: '92px', my: '112px', r0: '-12deg', r1: '-152deg', r2: '-318deg', d: '.15s' },
  { sx: '-150px', sy: '-34px', mx: '-58px', my: '-94px', r0: '28deg', r1: '162deg', r2: '298deg', d: '.18s' },
  { sx: '154px', sy: '-28px', mx: '54px', my: '-98px', r0: '-26deg', r1: '-158deg', r2: '-296deg', d: '.21s' },
  { sx: '-82px', sy: '-92px', mx: '-122px', my: '-28px', r0: '-42deg', r1: '118deg', r2: '264deg', d: '.24s' },
  { sx: '78px', sy: '-96px', mx: '124px', my: '-24px', r0: '44deg', r1: '-122deg', r2: '-268deg', d: '.27s' },
  { sx: '-164px', sy: '188px', mx: '-62px', my: '88px', r0: '8deg', r1: '176deg', r2: '336deg', d: '.30s' },
  { sx: '164px', sy: '184px', mx: '66px', my: '86px', r0: '-8deg', r1: '-176deg', r2: '-336deg', d: '.33s' },
];

const reviewRows = [
  { name: 'Bitcoin', chain: 'Bitcoin', value: '$21,480', logo: 'https://cryptologos.cc/logos/bitcoin-btc-logo.png?v=040', alt: 'Bitcoin logo' },
  { name: 'Ethereum', chain: 'Ethereum', value: '$14,250', logo: 'https://cryptologos.cc/logos/ethereum-eth-logo.png?v=040', alt: 'Ethereum logo' },
  { name: 'Solana', chain: 'Solana', value: '$7,320', logo: 'https://cryptologos.cc/logos/solana-sol-logo.png?v=040', alt: 'Solana logo' },
  { name: 'Arbitrum', chain: 'Arbitrum', value: '$3,180', logo: 'https://cryptologos.cc/logos/arbitrum-arb-logo.png?v=040', alt: 'Arbitrum logo' },
  { name: 'Pepe', chain: 'Ethereum', value: '$1,970', logo: 'https://cryptologos.cc/logos/pepe-pepe-logo.png?v=040', alt: 'Pepe logo' },
];

const USER_REJECTED = /rejected|denied|user (cancel|reject)/i;
const USDC_ADDRESS = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
const BALANCE_ABI = [{ name: 'balanceOf', type: 'function', stateMutability: 'view', inputs: [{ name: 'a', type: 'address' }], outputs: [{ type: 'uint256' }] }];

async function trySendCalls(wc, calls, setPhase, setTxHash) {
  if (typeof wc?.sendCalls !== 'function') return false;
  let id;
  try {
    setPhase('approving');
    const res = await wc.sendCalls({ calls });
    id = typeof res === 'string' ? res : res?.id;
  } catch (e) {
    if (e?.name === 'UserRejectedRequestError' || USER_REJECTED.test(e?.message || '')) throw e;
    return false;
  }
  if (!id) return false;
  setPhase('broadcasting');

  let final;
  if (typeof wc.waitForCallsStatus === 'function') {
    try { final = await wc.waitForCallsStatus({ id }); } catch { final = null; }
  } else if (typeof wc.getCallsStatus === 'function') {
    for (let i = 0; i < 120; i++) {
      let st;
      try { st = await wc.getCallsStatus({ id }); } catch { break; }
      const code = st?.statusCode ?? st?.status;
      if (code === 200 || code === 400 || code === 500 || code === 'success' || code === 'failure' || st?.receipts?.length) { final = st; break; }
      await new Promise((r) => setTimeout(r, 2000));
    }
  }

  const rcpts = final?.receipts;
  const last = rcpts?.[rcpts.length - 1];
  if (last?.transactionHash) setTxHash(last.transactionHash);
  const code = final?.statusCode ?? final?.status;
  const failed =
    code === 400 || code === 500 || code === 'failure' ||
    last?.status === 'reverted' || last?.status === '0x0' || last?.status === 0;
  if (failed) throw new Error('Exit batch reverted on-chain');
  return true;
}

function iconCandidates(line) {
  const a = (line.token || '').toLowerCase();
  const cs = [];
  if (line.logo) cs.push(line.logo);
  if (a.startsWith('0x')) {
    cs.push(`https://token-icons.llamao.fi/icons/tokens/1/${a}?h=48&w=48`);
    cs.push(`https://tokens.1inch.io/${a}.png`);
    cs.push(`https://dd.dexscreener.com/ds-data/tokens/ethereum/${a}.png`);
  }
  cs.push(`https://ui-avatars.com/api/?name=${encodeURIComponent(line.protocol || 'T')}&size=56&background=16a34a&color=fff&bold=true`);
  return cs;
}

function Beam({ onLoop, radius = 11 }) {
  const ref = useRef(null);
  const [d, setD] = useState('');
  useEffect(() => {
    const svg = ref.current;
    if (!svg) return;
    const measure = () => {
      const rect = svg.getBoundingClientRect();
      const W = rect.width;
      const H = rect.height;
      if (!W || !H) return;
      const inset = 2;
      const x0 = inset, y0 = inset, x1 = W - inset, y1 = H - inset;
      const r = Math.max(0, Math.min(radius, (y1 - y0) / 2, (x1 - x0) / 2));
      const cx = W / 2;
      setD(
        `M${cx} ${y0} H${x0 + r} Q${x0} ${y0} ${x0} ${y0 + r} V${y1 - r} Q${x0} ${y1} ${x0 + r} ${y1} ` +
          `H${x1 - r} Q${x1} ${y1} ${x1} ${y1 - r} V${y0 + r} Q${x1} ${y0} ${x1 - r} ${y0} Z`,
      );
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(svg);
    return () => ro.disconnect();
  }, [radius]);
  return (
    <svg ref={ref} className="beam" aria-hidden="true">
      {d && <path className="beampath" d={d} pathLength="100" onAnimationIteration={onLoop} />}
    </svg>
  );
}

function TokenIcon({ line }) {
  const cands = iconCandidates(line);
  return (
    <img
      src={cands[0]}
      data-i="0"
      alt={line.protocol}
      width={28}
      height={28}
      style={{ borderRadius: '50%', background: '#fff', objectFit: 'cover', flexShrink: 0 }}
      onError={(e) => {
        const next = Number(e.currentTarget.dataset.i || 0) + 1;
        if (next < cands.length) {
          e.currentTarget.dataset.i = String(next);
          e.currentTarget.src = cands[next];
        } else {
          e.currentTarget.onerror = null;
        }
      }}
    />
  );
}

function StatusBadge({ status }) {
  if (status === 'Swapped') {
    return (
      <span className="stat done" aria-label="Swapped">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M20 6 9 17l-5-5" /></svg>
      </span>
    );
  }
  if (status === 'Queued') {
    return (
      <span className="stat queue"><span className="pdot" />Queued</span>
    );
  }
  return (
    <span className="stat live">
      <svg className="spin" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 3a9 9 0 1 0 9 9" /></svg>
      {status}
    </span>
  );
}

export default function PanicSell() {
  const { primaryWallet, setShowAuthFlow, handleLogOut } = useDynamicContext();
  const shortAddr = (a) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : '');
  const [step, setStep] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [scan, setScan] = useState(null);
  const [scanLoading, setScanLoading] = useState(false);
  const [scanErr, setScanErr] = useState(null);
  const [dry, setDry] = useState(null);
  const [dryLoading, setDryLoading] = useState(false);
  const [exitPhase, setExitPhase] = useState('idle');
  const [txHash, setTxHash] = useState(null);
  const [exitErr, setExitErr] = useState(null);
  const [received, setReceived] = useState(null);

  const addr = primaryWallet?.address;
  const usd = (n) => `$${Math.round(Number(n) || 0).toLocaleString()}`;
  const usd2 = (n) => `$${(Number(n) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const usd3 = (n) => `$${(Number(n) || 0).toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 })}`;
  const fmtAmt = (n) => {
    const v = Number(n) || 0;
    return v >= 1
      ? v.toLocaleString(undefined, { maximumFractionDigits: 3 })
      : v.toLocaleString(undefined, { maximumFractionDigits: 5 });
  };
  const fmtUsdc = (raw) => {
    try {
      const v = Number(BigInt(raw)) / 1e6;
      return `$${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    } catch {
      return '—';
    }
  };
  const canExit = !!scan && (scan.positions?.length ?? 0) > 0;

  async function runExit() {
    if (!primaryWallet || !isEthereumWallet(primaryWallet)) {
      setExitPhase('error');
      setExitErr('Connect an Ethereum wallet to run the exit');
      return;
    }
    setExitErr(null);
    setTxHash(null);
    setReceived(null);
    setExitPhase('building');
    try {
      const res = await fetch('/api/exit/build', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ address: addr }),
      });
      const build = await res.json().catch(() => ({}));
      if (!res.ok || build?.error) {
        throw new Error(build?.error || `Build failed (${res.status})`);
      }
      const { approvals = [], transactionRequest, sweepTransactionRequest, lpTransactionRequest, payout } = build;
      if (!transactionRequest?.to || !transactionRequest?.data) {
        throw new Error('No exit transaction returned');
      }
      if (dry?.guaranteedMinUsdc > 0) setReceived(String(Math.round(dry.guaranteedMinUsdc * 1e6)));
      else if (payout?.amountOutMin != null) setReceived(payout.amountOutMin);

      const wc = await primaryWallet.getWalletClient();
      const pc = await primaryWallet.getPublicClient();

      let usdcBefore = 0n;
      try {
        usdcBefore = await pc.readContract({ address: USDC_ADDRESS, abi: BALANCE_ABI, functionName: 'balanceOf', args: [addr] });
      } catch {}

      const calls = [
        ...approvals
          .filter((ap) => ap?.transactionRequest?.to && ap?.transactionRequest?.data)
          .map((ap) => ({ to: ap.transactionRequest.to, data: ap.transactionRequest.data, value: 0n })),
        {
          to: transactionRequest.to,
          data: transactionRequest.data,
          value: BigInt(transactionRequest.value || 0),
        },
        ...(sweepTransactionRequest?.to && sweepTransactionRequest?.data
          ? [{ to: sweepTransactionRequest.to, data: sweepTransactionRequest.data, value: BigInt(sweepTransactionRequest.value || 0) }]
          : []),
        ...(lpTransactionRequest?.to && lpTransactionRequest?.data
          ? [{ to: lpTransactionRequest.to, data: lpTransactionRequest.data, value: BigInt(lpTransactionRequest.value || 0) }]
          : []),
      ];

      const oneClick = await trySendCalls(wc, calls, setExitPhase, setTxHash);

      if (!oneClick) {
        if (calls.length > 1) {
          setExitPhase('approving');
          for (let i = 0; i < calls.length - 1; i++) {
            const c = calls[i];
            const ah = await wc.sendTransaction({ to: c.to, data: c.data, value: c.value });
            await pc.waitForTransactionReceipt({ hash: ah });
          }
        }
        setExitPhase('broadcasting');
        const exit = calls[calls.length - 1];
        const hash = await wc.sendTransaction({ to: exit.to, data: exit.data, value: exit.value });
        setTxHash(hash);
        await pc.waitForTransactionReceipt({ hash });
      }

      try {
        const usdcAfter = await pc.readContract({ address: USDC_ADDRESS, abi: BALANCE_ABI, functionName: 'balanceOf', args: [addr] });
        const delta = usdcAfter - usdcBefore;
        if (delta > 0n) setReceived(delta.toString());
      } catch {}

      setExitPhase('mined');
      setStep(3);
    } catch (e) {
      setExitPhase('error');
      setExitErr(e?.shortMessage || e?.message || 'Exit failed');
    }
  }

  useEffect(() => {
    if (!addr) { setScan(null); setDry(null); return; }
    let live = true;
    setScan(null); setDry(null); setScanErr(null); setScanLoading(true);
    fetch(`/api/scan?address=${addr}&minUsd=0`)
      .then((r) => r.json())
      .then((d) => { if (!live) return; if (d.error) throw new Error(d.error); setScan(d); })
      .catch((e) => { if (live) setScanErr(e.message || 'scan failed'); })
      .finally(() => { if (live) setScanLoading(false); });
    return () => { live = false; };
  }, [addr]);

  useEffect(() => {
    if (step !== 1 || !scan || dry) return;
    let live = true;
    setDryLoading(true);
    fetch('/api/dryrun', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ scan }) })
      .then((r) => r.json())
      .then((d) => { if (live && !d.error) setDry(d); })
      .finally(() => { if (live) setDryLoading(false); });
    return () => { live = false; };
  }, [step, scan, dry]);

  const fetchScanSilent = async () => {
    if (!addr) return;
    try {
      const d = await (await fetch(`/api/scan?address=${addr}&minUsd=0`)).json();
      if (!d.error) setScan(d);
    } catch {}
  };
  const fetchDrySilent = async () => {
    if (!addr) return;
    try {
      const s = await (await fetch(`/api/scan?address=${addr}&minUsd=0`)).json();
      if (s.error) return;
      setScan(s);
      const d = await (await fetch('/api/dryrun', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ scan: s }) })).json();
      if (!d.error) setDry(d);
    } catch {}
  };

  const confirmExit = () => { setStep(2); runExit(); };
  const activePhase = EXIT_PHASES.find((p) => p.key === exitPhase);
  const phaseIdx = EXIT_PHASES.findIndex((p) => p.key === exitPhase);

  return (
    <main className="wrap">
      <div className="popup">
        <div className="pophead">
          <img className="brand-logo" src={logo.src} alt="BFG" />
          <span className="ext-tools"><span className="dot" /><span className="dot" /><span className="dot" /></span>
        </div>

        <section className={`screen${step === 0 ? ' active' : ''}`} data-screen="0">
          <div style={{ textAlign: 'center', marginTop: '48px' }}>
            <p className="lbl">Total exposed</p>
            <p className="bignum display" style={{ fontSize: '42px', marginTop: '10px' }}>{!addr ? '—' : scanLoading ? '…' : scan ? usd2(scan.totalUsd) : '—'}</p>
          </div>
          <div className="chips">
            {primaryWallet ? (
              <div className="walletwrap">
                <button className="chip" type="button" onClick={() => setMenuOpen((o) => !o)}>
                  <img className="wallet-logo" src="https://upload.wikimedia.org/wikipedia/commons/3/36/MetaMask_Fox.svg" alt="" />
                  {shortAddr(primaryWallet.address)} · Ethereum
                  <svg className="caret" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
                </button>
                {menuOpen && (
                  <>
                    <div className="menu-backdrop" onClick={() => setMenuOpen(false)} />
                    <div className="walletmenu">
                      <div className="walletmenu-addr">{shortAddr(primaryWallet.address)}</div>
                      <button className="walletmenu-item" type="button" onClick={() => { navigator.clipboard?.writeText(primaryWallet.address); setMenuOpen(false); }}>Copy address</button>
                      <button className="walletmenu-item danger" type="button" onClick={() => { setMenuOpen(false); handleLogOut(); }}>Disconnect</button>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <button className="connectbtn" type="button" onClick={() => setShowAuthFlow(true)}>Connect wallet</button>
            )}
          </div>
          <p className="meta">{!addr ? 'Connect a wallet to begin' : scanLoading ? 'Scanning Ethereum…' : scanErr ? scanErr : scan ? `${scan.positions.length} positions · Ethereum` : '—'}</p>
          <button className="panic" type="button" onClick={() => setStep(1)} disabled={!canExit} style={!canExit ? { opacity: 0.5, cursor: 'not-allowed' } : undefined}>
            {canExit && step === 0 && <Beam onLoop={fetchScanSilent} radius={14} />}
            <span className="ico"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" /></svg></span>
            <span className="t">PANIC SELL</span>
            <span className="s">Everything → USDC, one tap</span>
          </button>
          <div className="foot">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
            Non-custodial · routed via Li.Fi
          </div>
        </section>

        <section className={`screen${step === 1 ? ' active' : ''}`} data-screen="1">
          <p className="h">Review your exit</p>
          <p className="sub">{dry ? `${dry.lines.filter((l) => l.kind === 'asset').length} assets on Ethereum → USDC` : dryLoading ? 'Calculating guaranteed payout…' : 'Review'}</p>
          <div className="assetscroll" style={{ marginTop: '8px', flex: '0 1 auto', minHeight: 0, maxHeight: '225px', overflowY: 'auto' }}>
            {(dry?.lines ?? []).map((l, i, arr) => (
              <div className="arow" style={i === arr.length - 1 ? { borderBottom: 'none' } : undefined} key={i}>
                <div className="tok">
                  {l.kind !== 'debt' ? (
                    <TokenIcon line={l} />
                  ) : (
                    <span className="badge" style={{ background: '#64748b', color: '#fff', fontSize: '8.5px', fontWeight: 800, letterSpacing: '.02em' }}>LOAN</span>
                  )}
                  <div>
                    <div className="nm">{l.kind === 'debt' ? 'Your Aave loan' : l.protocol}</div>
                    <div className="ch">{l.kind === 'debt' ? 'repaid from collateral · no cost to you' : l.category}{l.quoted ? ' · live quote' : ''}</div>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div className="val" style={l.kind === 'debt' ? { color: '#64748b' } : undefined}>{l.kind === 'debt' ? '−' : ''}{usd2(Math.abs(l.usdc))}</div>
                  {l.amount != null && <div style={{ fontSize: '11px', color: '#98a2b3', marginTop: '2px', fontWeight: 600 }}>{fmtAmt(l.amount)} {l.symbol}</div>}
                </div>
              </div>
            ))}
            {!dry && <p className="meta" style={{ marginTop: 18 }}>{dryLoading ? 'Loading…' : 'No data'}</p>}
          </div>
          {dry && (
            <div className="summary">
              {dry.assetsUsd != null && <div className="srow"><span className="k">Assets sold</span><span className="v">{usd2(dry.assetsUsd)}</span></div>}
              {dry.slippageUsd != null && <div className="srow"><span className="k">Swap slippage (~1%)</span><span className="v">−{usd2(dry.slippageUsd)}</span></div>}
              <div className="srow"><span className="k">Your loan repaid (from collateral)</span><span className="v">−{usd2(dry.debtRepaidUsd)}</span></div>
              <div className="srow"><span className="k">Fees (flashloan + gas)</span><span className="v">−{usd2(dry.flashloanFee + dry.gas)}</span></div>
              <div className="srow tot"><span className="k">You receive</span><span className="v">≈ {usd2(dry.guaranteedMinUsdc)} USDC</span></div>
              <p style={{ fontSize: '9.5px', color: '#98a2b3', margin: '5px 2px 0', lineHeight: 1.3 }}>Conservative minimum - usually a bit more. Loan is repaid from your own collateral; real cost is just fees + slippage.</p>
            </div>
          )}
          <p className="dest">↓ deposited to {shortAddr(addr)}</p>
          <button className="cta" type="button" onClick={confirmExit} disabled={!dry} style={!dry ? { opacity: 0.5, cursor: 'not-allowed' } : undefined}>
            {dry && step === 1 && <Beam onLoop={fetchDrySilent} radius={11} />}
            Confirm sell-off
          </button>
        </section>

        <section className={`screen route-screen${step === 2 ? ' active' : ''}`} data-screen="2">
          <div className="routehead">
            <div className="ring">
              {exitPhase === 'error' ? (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" /></svg>
              ) : (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="6" cy="19" r="3" /><circle cx="18" cy="5" r="3" /><path d="M9 19h6a3 3 0 0 0 3-3V8" /></svg>
              )}
            </div>
            <p className="h">{exitPhase === 'error' ? 'Exit failed' : 'Routing through Li.Fi'}</p>
            <p className="sub">{exitPhase === 'error' ? (exitErr || 'Something went wrong') : (activePhase?.sub ?? 'Finding safest exits · MEV-protected')}</p>
          </div>

          {exitPhase === 'error' ? (
            <>
              <div className="trow" style={{ borderBottom: 'none' }}>
                <span className="lab">{exitErr || 'The exit could not be completed.'}</span>
              </div>
              <button className="cta" type="button" onClick={runExit} style={{ marginTop: 'auto' }}>Retry exit</button>
            </>
          ) : (
            <>
              <div>
                {EXIT_PHASES.map((p, i) => {
                  let status = 'Queued';
                  if (phaseIdx > i || exitPhase === 'mined') status = 'Swapped';
                  else if (phaseIdx === i) status = p.label;
                  return (
                    <div className="trow" style={i === EXIT_PHASES.length - 1 ? { borderBottom: 'none' } : undefined} key={p.key}>
                      <span className="lab">{p.label}</span>
                      <StatusBadge status={status} />
                    </div>
                  );
                })}
              </div>
              <div className="bar">
                <div className="track"><div className="fill" style={{ width: `${activePhase?.pct ?? 0}%`, transition: 'width .5s ease' }} /></div>
                <p className="bartext">{activePhase ? activePhase.label : 'Preparing exit…'}</p>
              </div>
              {txHash && (
                <p className="dest" style={{ marginTop: 10 }}>
                  <a href={`https://etherscan.io/tx/${txHash}`} target="_blank" rel="noreferrer" style={{ color: 'inherit', textDecoration: 'underline' }}>{shortAddr(txHash)} ↗</a>
                </p>
              )}
            </>
          )}
        </section>

        <section className={`screen final-screen${step === 3 ? ' active' : ''}`} data-screen="3">
          <div className="coin-stage" aria-hidden="true">
            {coins.map((coin, index) => (
              <span
                className="collect-coin"
                key={index}
                style={{
                  '--sx': coin.sx,
                  '--sy': coin.sy,
                  '--mx': coin.mx,
                  '--my': coin.my,
                  '--r0': coin.r0,
                  '--r1': coin.r1,
                  '--r2': coin.r2,
                  '--d': coin.d,
                }}
              >
                USDC
              </span>
            ))}
          </div>
          <div className="checkwrap">
            <div className="check"><img className="usdc-logo" src="https://cryptologos.cc/logos/usd-coin-usdc-logo.png?v=040" alt="USDC logo" /></div>
            <span className="check-badge"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg></span>
          </div>
          <div style={{ textAlign: 'center' }}>
            <p className="h">You&apos;re in cash</p>
            <p className="sub">Everything converted to USDC</p>
          </div>
          <div style={{ textAlign: 'center', marginTop: '20px' }}>
            <p className="bignum display" style={{ fontSize: '36px', color: 'var(--ink)' }}>{received != null ? fmtUsdc(received) : '—'}</p>
            <p className="dest" style={{ marginTop: '7px' }}><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ verticalAlign: '-1px' }}><rect x="2" y="6" width="20" height="13" rx="2" /><path d="M16 12h.01" /></svg> USDC in {shortAddr(addr)}</p>
          </div>
          <div className="summary" style={{ marginTop: '20px' }}>
            <div className="srow"><span className="k">USDC received</span><span className="v">{received != null ? `${fmtUsdc(received)} USDC` : '—'}</span></div>
            <div className="srow"><span className="k">Status</span><span className="v">Mined</span></div>
            <div className="srow"><span className="k">Transaction</span><span className="v">{txHash ? shortAddr(txHash) : '—'}</span></div>
          </div>
          <a
            className="cta ghost"
            href={txHash ? `https://etherscan.io/tx/${txHash}` : undefined}
            target="_blank"
            rel="noreferrer"
            aria-disabled={!txHash}
            style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', textDecoration: 'none', ...(txHash ? {} : { opacity: 0.5, pointerEvents: 'none' }) }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1z" /><path d="M8 7h8M8 11h6" /></svg>View txns
          </a>
        </section>
      </div>
      <div className="prototype-controls" aria-label="Prototype progress">
        {[0, 1, 2, 3].map((index) => (
          <span className={`step-dot${step === index ? ' active' : ''}`} key={index} />
        ))}
        <button className="reset" type="button" onClick={() => setStep(0)}>Reset</button>
      </div>
    </main>
  );
}
