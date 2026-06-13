'use client';

import { useEffect, useState } from 'react';
import '../app/globals.css';

const assets = ['BTC', 'ETH', 'SOL', 'ARB', 'PEPE'];
const states = ['Queued', 'Transfering', 'Receiving tokens', 'Swapped'];

const reviewRows = [
  { name: 'Bitcoin', chain: 'Bitcoin', value: '$21,480', logo: 'https://cryptologos.cc/logos/bitcoin-btc-logo.png?v=040', alt: 'Bitcoin logo' },
  { name: 'Ethereum', chain: 'Ethereum', value: '$14,250', logo: 'https://cryptologos.cc/logos/ethereum-eth-logo.png?v=040', alt: 'Ethereum logo' },
  { name: 'Solana', chain: 'Solana', value: '$7,320', logo: 'https://cryptologos.cc/logos/solana-sol-logo.png?v=040', alt: 'Solana logo' },
  { name: 'Arbitrum', chain: 'Arbitrum', value: '$3,180', logo: 'https://cryptologos.cc/logos/arbitrum-arb-logo.png?v=040', alt: 'Arbitrum logo' },
  { name: 'Pepe', chain: 'Ethereum', value: '$1,970', logo: 'https://cryptologos.cc/logos/pepe-pepe-logo.png?v=040', alt: 'Pepe logo' },
];

function StatusBadge({ status }) {
  if (status === 'Swapped') {
    return (
      <span className="stat done">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M20 6 9 17l-5-5" /></svg>
        Swapped
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

  const next = () => setStep((s) => Math.min(s + 1, 3));
  const reset = () => setStep(0);

  useEffect(() => {
    if (step !== 2) return;
    setTick(0);
    let current = 0;
    const timer = setInterval(() => {
      current += 1;
      setTick(current);
      if (Math.floor(current / states.length) >= assets.length) {
        clearInterval(timer);
        window.setTimeout(() => setStep(3), 550);
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
          <span className="ext-ico"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" /></svg></span>
          <span className="ext-name">Panic Sell</span>
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

        <section className={`screen${step === 2 ? ' active' : ''}`} data-screen="2">
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
              return (
                <div className="trow" style={i === assets.length - 1 ? { borderBottom: 'none' } : undefined} key={asset}>
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

        <section className={`screen${step === 3 ? ' active' : ''}`} data-screen="3">
          <div className="checkwrap">
            <div className="check"><img className="usdc-logo" src="https://cryptologos.cc/logos/usd-coin-usdc-logo.png?v=040" alt="USDC logo" /></div>
            <span className="check-badge"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg></span>
          </div>
          <div style={{ textAlign: 'center' }}>
            <p className="h">You&apos;re in cash</p>
            <p className="sub">Everything converted in 38s</p>
          </div>
          <div style={{ textAlign: 'center', marginTop: '20px' }}>
            <p className="bignum display" style={{ fontSize: '36px', color: 'var(--green-deep)' }}>$47,974</p>
            <p className="dest" style={{ marginTop: '7px' }}><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ verticalAlign: '-1px' }}><rect x="2" y="6" width="20" height="13" rx="2" /><path d="M16 12h.01" /></svg> USDC in wallet1 · 0x7a…3f</p>
          </div>
          <div className="summary" style={{ marginTop: '20px' }}>
            <div className="srow"><span className="k">Assets sold</span><span className="v">5 / 5</span></div>
            <div className="srow"><span className="k">Realised slippage</span><span className="v">0.04%</span></div>
            <div className="srow"><span className="k">Total fees</span><span className="v">$22</span></div>
          </div>
          <button className="cta ghost" type="button" style={{ marginTop: 'auto' }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1z" /><path d="M8 7h8M8 11h6" /></svg>View txns</button>
        </section>
      </div>

      <div className="prototype-controls" aria-label="Prototype progress">
        {[0, 1, 2, 3].map((i) => (
          <span className={`step-dot${i === step ? ' active' : ''}`} key={i} />
        ))}
        <button className="reset" type="button" onClick={reset}>Reset</button>
      </div>
    </main>
  );
}