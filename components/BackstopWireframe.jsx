'use client';

import { useEffect, useState } from 'react';
import '../app/globals.css';
import logo from '../Product/Logo_BFB.png';

const assets = ['BTC', 'ETH', 'SOL', 'ARB', 'PEPE'];
const states = ['Queued', 'Transfering', 'Receiving tokens', 'Swapped'];
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

// Per-chain block explorer, keyed by the `chain` field on reviewRows.
const explorers = {
  Bitcoin: { name: 'mempool.space', tx: (h) => `https://mempool.space/tx/${h}` },
  Ethereum: { name: 'Etherscan', tx: (h) => `https://etherscan.io/tx/${h}` },
  Solana: { name: 'Solscan', tx: (h) => `https://solscan.io/tx/${h}` },
  Arbitrum: { name: 'Arbiscan', tx: (h) => `https://arbiscan.io/tx/${h}` },
};

// Aligned to reviewRows order: BTC, ETH, SOL, ARB, PEPE (on Ethereum).
// `full` hashes are placeholders — swap in real tx hashes from your swap flow.
// Note the differing formats: BTC has no 0x prefix, Solana sigs are base58, EVM chains are 0x-hex.
const txns = [
  { full: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', short: 'e3b0…b855' },
  { full: '0x5f1d8c3a9b2e7f04c6a1d8e3b9f72c50a4e1d7b8c3f6a9027e5b1d4c8a3f60e29', short: '0x5f1d…0e29' },
  { full: '5KtPn1LGuxhFiwjxErkxTb7XxtLVYUBe6Cn33ej7ATNVyorhg7v8tFy7akMNXAB7p', short: '5KtP…AB7p' },
  { full: '0x9a4f2c8e1b7d3056f9c2a8e4b1d7036c5a9e2f8b4d1c70639e5a2b8d4f1c70a36', short: '0x9a4f…0a36' },
  { full: '0xc1b8a4f2e7d309561c8a4f2e7d309c561a8f4e2d7b309c5618a4f2e7d3095c61b', short: '0xc1b8…5c61' },
];

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
  const [step, setStep] = useState(0);
  const [tick, setTick] = useState(0);

  const next = () => setStep((s) => Math.min(s + 1, 4));

  useEffect(() => {
    if (step !== 2) return;
    setTick(0);
    let current = 0;
    const timer = setInterval(() => {
      current += 1;
      setTick(current);
      if (Math.floor(current / states.length) >= assets.length) {
        clearInterval(timer);
        window.setTimeout(() => setStep(3), 1200);
      }
    }, 700);
    return () => clearInterval(timer);
  }, [step]);

  const routeIndex = Math.floor(tick / states.length);
  const routePhase = tick % states.length;
  const complete = Math.min(routeIndex, assets.length);
  const fillWidth = `${(complete / assets.length) * 100}%`;
  const barText = `${complete} of 5 converted`;

  return (
    <main className="wrap">
      <div className="popup">
        <div className="pophead">
          <img className="brand-logo" src={logo.src} alt="BFG" />
          <span className="ext-tools"><span className="dot" /><span className="dot" /><span className="dot" /></span>
        </div>

        <section className={`screen${step === 0 ? ' active' : ''}`} data-screen="0">
          <div style={{ textAlign: 'center', marginTop: '8px' }}>
            <p className="lbl">Total exposed</p>
            <p className="bignum display" style={{ fontSize: '42px', marginTop: '10px' }}>$48,200</p>
          </div>
          <div className="chips">
            <span className="chip"><img className="wallet-logo" src="https://upload.wikimedia.org/wikipedia/commons/3/36/MetaMask_Fox.svg" alt="" />wallet1 · 0x7a…3f</span>
            <span className="chip"><img className="wallet-logo" src="https://upload.wikimedia.org/wikipedia/commons/3/36/MetaMask_Fox.svg" alt="" />wallet2 · 0x12…9c</span>
          </div>
          <p className="meta">2 wallets · 5 assets · 4 chains</p>
          <button className="panic" type="button" onClick={next}>
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
          <p className="sub">Selling 5 assets across 4 chains</p>
          <div style={{ marginTop: '10px' }}>
            {reviewRows.map((row, i) => (
              <div className="arow" style={i === reviewRows.length - 1 ? { borderBottom: 'none' } : undefined} key={row.name}>
                <div className="tok">
                  <span className="badge"><img className="token-logo" src={row.logo} alt={row.alt} /></span>
                  <div>
                    <div className="nm">{row.name}</div>
                    <div className="ch">{row.chain}</div>
                  </div>
                </div>
                <span className="val">{row.value}</span>
              </div>
            ))}
          </div>
          <div className="summary">
            <div className="srow"><span className="k">Est. slippage</span><span className="v">~0.05%</span></div>
            <div className="srow"><span className="k">Network + route fees</span><span className="v">$24</span></div>
            <div className="srow tot"><span className="k">You receive</span><span className="v">≈ $47,974 USDC</span></div>
          </div>
          <p className="dest">↓ deposited to wallet1 · 0x7a…3f</p>
          <button className="cta" type="button" onClick={next}>Confirm sell-off</button>
        </section>

        <section className={`screen route-screen${step === 2 ? ' active' : ''}`} data-screen="2">
          <div className="routehead">
            <div className="ring"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="6" cy="19" r="3" /><circle cx="18" cy="5" r="3" /><path d="M9 19h6a3 3 0 0 0 3-3V8" /></svg></div>
            <p className="h">Routing through Li.Fi</p>
            <p className="sub">Finding safest exits · MEV-protected</p>
          </div>
          <div>
            {assets.map((asset, i) => {
              let status = 'Queued';
              if (i < routeIndex) status = 'Swapped';
              if (i === routeIndex) status = states[routePhase];
              const celebrate = tick > 0 && routePhase === 0 && i === routeIndex - 1;
              return (
                <div className={`trow${celebrate ? ' celebrate' : ''}`} style={i === assets.length - 1 ? { borderBottom: 'none' } : undefined} key={asset}>
                  <span className="lab">Swap {asset} → USDC</span>
                  <StatusBadge status={status} />
                </div>
              );
            })}
          </div>
          <div className="bar">
            <div className="track"><div className="fill" style={{ width: fillWidth }} /></div>
            <p className="bartext">{barText}</p>
          </div>
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
            <p className="sub">Everything converted in 38s</p>
          </div>
          <div style={{ textAlign: 'center', marginTop: '20px' }}>
            <p className="bignum display" style={{ fontSize: '36px', color: 'var(--ink)' }}>$47,974</p>
            <p className="dest" style={{ marginTop: '7px' }}><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ verticalAlign: '-1px' }}><rect x="2" y="6" width="20" height="13" rx="2" /><path d="M16 12h.01" /></svg> USDC in wallet1 · 0x7a…3f</p>
          </div>
          <div className="summary" style={{ marginTop: '20px' }}>
            <div className="srow"><span className="k">Assets sold</span><span className="v">5 / 5</span></div>
            <div className="srow"><span className="k">Realised slippage</span><span className="v">0.04%</span></div>
            <div className="srow"><span className="k">Total fees</span><span className="v">$22</span></div>
          </div>
          <button className="cta ghost" type="button" style={{ marginTop: 'auto' }} onClick={next}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1z" /><path d="M8 7h8M8 11h6" /></svg>View txns</button>
        </section>

        <section className={`screen txns-screen${step === 4 ? ' active' : ''}`} data-screen="4">
          <p className="h">Transactions</p>
          <p className="sub">5 swaps · routed via Li.Fi · confirmed on-chain</p>
          <div style={{ marginTop: '10px' }}>
            {reviewRows.map((row, i) => {
              const ex = explorers[row.chain];
              const href = ex ? ex.tx(txns[i].full) : undefined;
              return (
                <a
                  className="arow"
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={i === reviewRows.length - 1 ? { borderBottom: 'none' } : undefined}
                  key={row.name}
                >
                  <div className="tok">
                    <span className="badge"><img className="token-logo" src={row.logo} alt={row.alt} /></span>
                    <div>
                      <div className="nm">{row.name} → USDC</div>
                      <div className="ch">{ex ? ex.name : row.chain} · {txns[i].short}</div>
                    </div>
                  </div>
                  <span className="val val-link">
                    {row.value}
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M7 17 17 7M7 7h10v10" /></svg>
                  </span>
                </a>
              );
            })}
          </div>
          <div className="summary">
            <div className="srow"><span className="k">Confirmations</span><span className="v">5 / 5</span></div>
            <div className="srow"><span className="k">Settlement time</span><span className="v">~38s</span></div>
            <div className="srow tot"><span className="k">Total received</span><span className="v">$47,974 USDC</span></div>
          </div>
          <p className="dest" style={{ marginTop: '12px' }}>↗ View full route on Li.Fi explorer</p>
          <button className="cta ghost" type="button" style={{ marginTop: 'auto' }} onClick={() => setStep(3)}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
            Back to summary
          </button>
        </section>
      </div>
      <div className="prototype-controls" aria-label="Prototype progress">
        {[0, 1, 2, 3, 4].map((index) => (
          <span className={`step-dot${step === index ? ' active' : ''}`} key={index} />
        ))}
        <button className="reset" type="button" onClick={() => setStep(0)}>Reset</button>
      </div>
    </main>
  );
}
