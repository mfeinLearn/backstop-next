"use client";

import React, { useState, useEffect } from "react";

/**
 * Backstop — Agent Wind-Down / Dead-Man's Switch
 * Interactive wireframe prototype.
 *
 * Flow:
 *  1. Authenticate
 *  2. Select wallets to liquidate (toggles)
 *  2.5 Big "S" sweep button
 *  3. Validate the action (World)
 *  4. Loading + estimated time
 *  5. Copy new (safe) address — hidden private key
 */

const PALETTES = {
  dark: {
    bg: "#0B0E11",
    panel: "#14181D",
    panel2: "#191E24",
    border: "#262E36",
    text: "#E6EAEE",
    muted: "#8A97A3",
    faint: "#5B6670",
    signal: "#F5A524", // action / caution amber
    danger: "#FF5C5C",
    safe: "#3DD68C",
    onSignal: "#0B0E11", // text/icon color sitting on amber/green fills
  },
  light: {
    bg: "#FFFFFF",
    panel: "#F4F6F8",
    panel2: "#EAEEF1",
    border: "#DCE1E6",
    text: "#14181D",
    muted: "#5C6873",
    faint: "#9AA5AE",
    signal: "#E58A00",
    danger: "#E5484D",
    safe: "#1F9D63",
    onSignal: "#FFFFFF",
  },
};

// Active palette. Reassigned in-place each render from the chosen theme so all
// child components read the current colors without prop-threading.
const C = { ...PALETTES.dark };

const mono = "'SFMono-Regular', ui-monospace, 'JetBrains Mono', Menlo, monospace";
const sans = "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

const WALLETS = [
  { id: "A1", label: "Treasury — primary", addr: "0x7a3f…b91c", bal: "12.84 ETH", usd: "$41,210" },
  { id: "A2", label: "Trading agent", addr: "0x1d90…44ae", bal: "3.502 ETH", usd: "$11,240" },
  { id: "A3", label: "Gas reserve", addr: "0xf2c1…0d77", bal: "0.91 ETH", usd: "$2,920" },
  { id: "A4", label: "Yield position", addr: "0x88be…c3f0", bal: "USDC 8,400", usd: "$8,400" },
  { id: "A5", label: "Cold backup", addr: "0x04aa…1e62", bal: "1.20 ETH", usd: "$3,850" },
];

export default function BackstopWireframe() {
  const [screen, setScreen] = useState(0);
  const [theme, setTheme] = useState("dark");
  const screens = ["Auth", "Wallets", "Sweep", "Validate", "Winding down", "New address"];

  // Apply the chosen palette in-place before children render.
  Object.assign(C, PALETTES[theme]);

  return (
    <div
      style={{
        fontFamily: sans,
        background: C.bg,
        color: C.text,
        minHeight: 640,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "0 0 32px",
        transition: "background .25s ease, color .25s ease",
      }}
    >
      <TopBar screens={screens} current={screen} theme={theme} setTheme={setTheme} />

      <div style={{ width: "100%", maxWidth: 440, padding: "0 20px", flex: 1 }}>
        {screen === 0 && <AuthScreen onNext={() => setScreen(1)} />}
        {screen === 1 && <WalletsScreen onNext={() => setScreen(2)} />}
        {screen === 2 && <SweepScreen onNext={() => setScreen(3)} />}
        {screen === 3 && <ValidateScreen onNext={() => setScreen(4)} />}
        {screen === 4 && <LoadingScreen onDone={() => setScreen(5)} />}
        {screen === 5 && <AddressScreen onRestart={() => setScreen(0)} />}
      </div>
    </div>
  );
}

/* ---------- chrome ---------- */

function TopBar({ screens, current, theme, setTheme }) {
  return (
    <div
      style={{
        width: "100%",
        borderBottom: `1px solid ${C.border}`,
        padding: "16px 20px",
        display: "flex",
        flexDirection: "column",
        gap: 12,
        marginBottom: 28,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <Sigil size={18} />
        <span style={{ fontFamily: mono, fontWeight: 700, letterSpacing: 1, fontSize: 13 }}>
          BACKSTOP
        </span>
        <span style={{ marginLeft: "auto", fontSize: 11, color: C.faint, fontFamily: mono }}>
          dead-man&apos;s switch
        </span>
        <button
          className="bs-btn"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          aria-label={theme === "dark" ? "Switch to light background" : "Switch to dark background"}
          title={theme === "dark" ? "Light background" : "Dark background"}
          style={{
            all: "unset",
            cursor: "pointer",
            width: 30,
            height: 30,
            borderRadius: 8,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            border: `1px solid ${C.border}`,
            background: C.panel,
            color: C.muted,
          }}
        >
          {theme === "dark" ? <SunGlyph /> : <MoonGlyph />}
        </button>
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        {screens.map((_, i) => (
          <div
            key={i}
            style={{
              flex: 1,
              height: 3,
              borderRadius: 2,
              background: i <= current ? C.signal : C.border,
              transition: "background .25s ease",
            }}
          />
        ))}
      </div>
    </div>
  );
}

function Nav() { return null; } // removed: bottom Back/Skip bar

/* ---------- screen 1: auth ---------- */

function AuthScreen({ onNext }) {
  return (
    <div className="bs-fade" style={{ textAlign: "center", paddingTop: 40 }}>
      <Sigil size={64} ring />
      <h1 style={{ fontSize: 26, margin: "28px 0 10px", fontWeight: 700 }}>Authenticate</h1>
      <p style={{ color: C.muted, fontSize: 14, lineHeight: 1.5, maxWidth: 300, margin: "0 auto 36px" }}>
        Connect your wallet so Backstop can locate and wind down your agent&apos;s wallets.
      </p>
      <PrimaryBtn onClick={onNext}>
        <FoxGlyph /> Connect to MetaMask
      </PrimaryBtn>
      <p style={{ color: C.faint, fontSize: 12, marginTop: 18, fontFamily: mono }}>
        wallet signature · no funds moved yet
      </p>
    </div>
  );
}

/* ---------- screen 2: wallets ---------- */

function WalletsScreen({ onNext }) {
  const [sel, setSel] = useState({ A1: true, A2: true, A3: false, A4: true, A5: false });
  const count = Object.values(sel).filter(Boolean).length;
  const total = WALLETS.filter((w) => sel[w.id]).reduce((n) => n + 1, 0);
  const toggle = (id) => setSel((s) => ({ ...s, [id]: !s[id] }));

  return (
    <div className="bs-fade">
      <h2 style={{ fontSize: 18, fontWeight: 700, margin: "8px 0 6px" }}>Wallets found</h2>
      <p style={{ color: C.muted, fontSize: 13.5, lineHeight: 1.5, marginBottom: 22 }}>
        These are the wallets we detected for this agent. Select the ones you want to liquidate.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {WALLETS.map((w) => (
          <button
            key={w.id}
            className="bs-row bs-btn"
            onClick={() => toggle(w.id)}
            style={{
              all: "unset",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 14,
              padding: "12px 14px",
              borderRadius: 12,
              border: `1px solid ${sel[w.id] ? C.signal : C.border}`,
              background: sel[w.id] ? "rgba(245,165,36,0.06)" : C.panel,
            }}
          >
            <span
              style={{
                fontFamily: mono,
                fontSize: 13,
                fontWeight: 700,
                color: sel[w.id] ? C.signal : C.muted,
                width: 24,
              }}
            >
              {w.id}
            </span>
            <span style={{ display: "flex", flexDirection: "column", flex: 1, gap: 3 }}>
              <span style={{ fontSize: 13.5, fontWeight: 600 }}>{w.label}</span>
              <span style={{ fontFamily: mono, fontSize: 11, color: C.faint }}>
                {w.addr} · {w.bal}
              </span>
            </span>
            <span style={{ fontFamily: mono, fontSize: 12, color: C.muted }}>{w.usd}</span>
            <Toggle on={sel[w.id]} />
          </button>
        ))}
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginTop: 22,
          fontSize: 13,
        }}
      >
        <span style={{ color: C.muted }}>
          <strong style={{ color: C.text }}>{count}</strong> selected
        </span>
        <PrimaryBtn small disabled={count === 0} onClick={onNext}>
          Continue
        </PrimaryBtn>
      </div>
    </div>
  );
}

function Toggle({ on }) {
  return (
    <span
      style={{
        width: 40,
        height: 23,
        borderRadius: 12,
        background: on ? C.signal : C.border,
        position: "relative",
        flexShrink: 0,
        transition: "background .18s ease",
      }}
    >
      <span
        style={{
          position: "absolute",
          top: 2,
          left: on ? 19 : 2,
          width: 19,
          height: 19,
          borderRadius: "50%",
          background: on ? "#0B0E11" : C.faint,
          transition: "left .18s ease",
        }}
      />
    </span>
  );
}

/* ---------- screen 2.5: big S sweep button ---------- */

function SweepScreen({ onNext }) {
  const [armed, setArmed] = useState(false);
  return (
    <div className="bs-fade" style={{ textAlign: "center", paddingTop: 24 }}>
      <p style={{ color: C.muted, fontSize: 13.5, marginBottom: 4 }}>Ready to wind down</p>
      <h2 style={{ fontSize: 20, fontWeight: 700, margin: "0 0 32px" }}>
        Press to start the sweep
      </h2>

      <div style={{ position: "relative", width: 220, height: 220, margin: "0 auto" }}>
        {!armed && (
          <>
            <Ring delay={0} />
            <Ring delay={0.9} />
          </>
        )}
        <button
          className="bs-btn"
          onClick={() => {
            setArmed(true);
            setTimeout(onNext, 480);
          }}
          aria-label="Start sweep"
          style={{
            all: "unset",
            cursor: "pointer",
            position: "absolute",
            inset: 30,
            borderRadius: "50%",
            background: armed
              ? `radial-gradient(circle at 50% 35%, ${C.safe}, #1f7a4d)`
              : `radial-gradient(circle at 50% 35%, ${C.signal}, #b9760f)`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: `0 0 0 1px ${C.bg}, 0 0 40px ${armed ? "rgba(61,214,140,.5)" : "rgba(245,165,36,.45)"}`,
          }}
        >
          <span
            style={{
              fontFamily: mono,
              fontSize: 84,
              fontWeight: 800,
              color: "#0B0E11",
              lineHeight: 1,
            }}
          >
            {armed ? "✓" : "S"}
          </span>
        </button>
      </div>

      <p style={{ color: C.faint, fontSize: 12, marginTop: 30, fontFamily: mono }}>
        S = sweep · liquidates &amp; consolidates selected wallets
      </p>
    </div>
  );
}

function Ring({ delay }) {
  return (
    <span
      style={{
        position: "absolute",
        inset: 30,
        borderRadius: "50%",
        border: `2px solid ${C.signal}`,
        animation: `pulseRing 2s ease-out ${delay}s infinite`,
      }}
    />
  );
}

/* ---------- screen 3: validate ---------- */

function ValidateScreen({ onNext }) {
  const [checked, setChecked] = useState(false);
  return (
    <div className="bs-fade" style={{ paddingTop: 16 }}>
      <h2 style={{ fontSize: 18, fontWeight: 700, margin: "8px 0 6px" }}>Validate this action</h2>
      <p style={{ color: C.muted, fontSize: 13.5, lineHeight: 1.5, marginBottom: 22 }}>
        This is irreversible. Confirm your identity with World to authorize the sweep.
      </p>

      <div
        style={{
          border: `1px solid ${C.border}`,
          background: C.panel,
          borderRadius: 12,
          padding: 16,
          marginBottom: 18,
        }}
      >
        <Line label="Action" value="Liquidate 3 wallets" />
        <Line label="Network" value="Base Sepolia" />
        <Line label="Settle to" value="USDC → new safe address" last />
      </div>

      <button
        className="bs-row bs-btn"
        onClick={() => setChecked((c) => !c)}
        style={{
          all: "unset",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "14px 16px",
          borderRadius: 12,
          width: "100%",
          boxSizing: "border-box",
          border: `1px solid ${checked ? C.safe : C.border}`,
          background: checked ? "rgba(61,214,140,0.07)" : C.panel,
          marginBottom: 20,
        }}
      >
        <WorldGlyph />
        <span style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <span style={{ fontSize: 13.5, fontWeight: 600 }}>Verify with World</span>
          <span style={{ fontSize: 11.5, color: C.faint }}>
            {checked ? "Proof of personhood confirmed" : "Tap to scan / confirm"}
          </span>
        </span>
        <span style={{ marginLeft: "auto", color: checked ? C.safe : C.faint, fontFamily: mono }}>
          {checked ? "verified ✓" : "—"}
        </span>
      </button>

      <PrimaryBtn full danger disabled={!checked} onClick={onNext}>
        Validate &amp; wind down
      </PrimaryBtn>
    </div>
  );
}

function Line({ label, value, last }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        padding: "8px 0",
        borderBottom: last ? "none" : `1px solid ${C.border}`,
        fontSize: 13,
      }}
    >
      <span style={{ color: C.muted }}>{label}</span>
      <span style={{ fontFamily: mono, color: C.text }}>{value}</span>
    </div>
  );
}

/* ---------- screen 4: loading ---------- */

function LoadingScreen({ onDone }) {
  const steps = [
    "Revoking agent permissions",
    "Liquidating positions",
    "Consolidating to safe wallet",
    "Recording proof on Hedera HCS",
  ];
  const [step, setStep] = useState(0);
  const [secs, setSecs] = useState(180);

  useEffect(() => {
    const t = setInterval(() => setSecs((s) => (s > 0 ? s - 4 : 0)), 120);
    const s = setInterval(() => setStep((p) => Math.min(steps.length - 1, p + 1)), 1100);
    const done = setTimeout(onDone, 4600);
    return () => {
      clearInterval(t);
      clearInterval(s);
      clearTimeout(done);
    };
    // eslint-disable-next-line
  }, []);

  const mm = String(Math.floor(secs / 60)).padStart(1, "0");
  const ss = String(secs % 60).padStart(2, "0");

  return (
    <div className="bs-fade" style={{ textAlign: "center", paddingTop: 36 }}>
      <div style={{ position: "relative", width: 150, height: 150, margin: "0 auto 30px" }}>
        <svg width="150" height="150" viewBox="0 0 150 150" style={{ animation: "spin 1.6s linear infinite" }}>
          <circle cx="75" cy="75" r="64" fill="none" stroke={C.border} strokeWidth="6" />
          <circle
            cx="75"
            cy="75"
            r="64"
            fill="none"
            stroke={C.signal}
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray="120 402"
          />
        </svg>
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <span style={{ fontFamily: mono, fontSize: 30, fontWeight: 700 }}>
            {mm}:{ss}
          </span>
          <span style={{ fontSize: 11, color: C.faint, marginTop: 2 }}>est. time left</span>
        </div>
      </div>

      <h2 style={{ fontSize: 18, fontWeight: 700, margin: "0 0 6px" }}>Winding down…</h2>
      <p style={{ color: C.muted, fontSize: 13, marginBottom: 24 }}>Keep this window open.</p>

      <div style={{ textAlign: "left", maxWidth: 300, margin: "0 auto", display: "flex", flexDirection: "column", gap: 12 }}>
        {steps.map((s, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <StepDot state={i < step ? "done" : i === step ? "active" : "todo"} />
            <span
              style={{
                fontSize: 13,
                color: i <= step ? C.text : C.faint,
                animation: i === step ? "blink 1.1s ease infinite" : "none",
              }}
            >
              {s}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function StepDot({ state }) {
  const map = {
    done: { bg: C.safe, content: "✓", color: "#0B0E11" },
    active: { bg: C.signal, content: "", color: "#0B0E11" },
    todo: { bg: C.border, content: "", color: C.faint },
  };
  const s = map[state];
  return (
    <span
      style={{
        width: 18,
        height: 18,
        borderRadius: "50%",
        background: s.bg,
        flexShrink: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 11,
        fontWeight: 700,
        color: s.color,
      }}
    >
      {s.content}
    </span>
  );
}

/* ---------- screen 5: copy new address ---------- */

function AddressScreen({ onRestart }) {
  const KEY = "0x9f4Ac2e7B1d83a06F5cE21b994D7e0A3cB6f128e";
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);

  const copy = () => {
    try {
      navigator.clipboard?.writeText(KEY);
    } catch (e) {
      /* clipboard unavailable in some sandboxes */
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const masked = "•".repeat(10) + KEY.slice(-6);

  return (
    <div className="bs-fade" style={{ paddingTop: 24 }}>
      <div style={{ textAlign: "center", marginBottom: 28 }}>
        <span
          style={{
            display: "inline-flex",
            width: 56,
            height: 56,
            borderRadius: "50%",
            background: "rgba(61,214,140,0.12)",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 26,
            color: C.safe,
          }}
        >
          ✓
        </span>
        <h2 style={{ fontSize: 20, fontWeight: 700, margin: "16px 0 6px" }}>Wind-down complete</h2>
        <p style={{ color: C.muted, fontSize: 13.5, lineHeight: 1.5, maxWidth: 300, margin: "0 auto" }}>
          Funds are in a fresh wallet. Copy your new private key and store it somewhere safe — this is the
          only time it&apos;s shown.
        </p>
      </div>

      <label style={{ fontSize: 12, color: C.muted, fontFamily: mono }}>NEW PRIVATE KEY</label>
      <div
        style={{
          marginTop: 8,
          display: "flex",
          alignItems: "center",
          gap: 10,
          border: `1px solid ${C.border}`,
          background: C.panel,
          borderRadius: 12,
          padding: "12px 14px",
        }}
      >
        <span
          style={{
            fontFamily: mono,
            fontSize: 12.5,
            flex: 1,
            wordBreak: "break-all",
            color: revealed ? C.text : C.faint,
            letterSpacing: revealed ? 0 : 1.5,
          }}
        >
          {revealed ? KEY : masked}
        </span>
        <IconBtn label={revealed ? "Hide key" : "Reveal key"} onClick={() => setRevealed((r) => !r)}>
          {revealed ? <EyeOff /> : <Eye />}
        </IconBtn>
        <IconBtn label="Copy key" active={copied} onClick={copy}>
          <CopyGlyph />
        </IconBtn>
      </div>

      <div style={{ minHeight: 20, marginTop: 8 }}>
        {copied && (
          <span style={{ fontSize: 12, color: C.safe, fontFamily: mono }}>✓ Copied to clipboard</span>
        )}
      </div>

      <div
        style={{
          display: "flex",
          gap: 10,
          alignItems: "flex-start",
          background: C.panel2,
          border: `1px solid ${C.border}`,
          borderRadius: 12,
          padding: "12px 14px",
          marginTop: 16,
          marginBottom: 24,
        }}
      >
        <span style={{ color: C.signal }}>⚠</span>
        <span style={{ fontSize: 12.5, color: C.muted, lineHeight: 1.5 }}>
          Anyone with this key controls the funds. Backstop does not keep a copy.
        </span>
      </div>

      <GhostBtn full onClick={onRestart}>
        Done — run another wind-down
      </GhostBtn>
    </div>
  );
}

/* ---------- shared bits ---------- */

function PrimaryBtn({ children, onClick, disabled, small, full, danger }) {
  return (
    <button
      className="bs-btn"
      onClick={onClick}
      disabled={disabled}
      style={{
        all: "unset",
        cursor: disabled ? "not-allowed" : "pointer",
        boxSizing: "border-box",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        padding: small ? "10px 18px" : "14px 24px",
        width: full ? "100%" : "auto",
        borderRadius: 12,
        fontSize: 14,
        fontWeight: 600,
        color: "#0B0E11",
        background: disabled ? C.border : danger ? C.danger : C.signal,
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {children}
    </button>
  );
}

function GhostBtn({ children, onClick, disabled, full }) {
  return (
    <button
      className="bs-btn"
      onClick={onClick}
      disabled={disabled}
      style={{
        all: "unset",
        cursor: disabled ? "default" : "pointer",
        boxSizing: "border-box",
        textAlign: "center",
        padding: "11px 16px",
        width: full ? "100%" : "auto",
        borderRadius: 12,
        fontSize: 13,
        fontWeight: 600,
        color: disabled ? C.faint : C.muted,
        border: `1px solid ${C.border}`,
        background: "transparent",
        opacity: disabled ? 0.45 : 1,
      }}
    >
      {children}
    </button>
  );
}

function IconBtn({ children, onClick, label, active }) {
  return (
    <button
      className="bs-btn"
      onClick={onClick}
      aria-label={label}
      title={label}
      style={{
        all: "unset",
        cursor: "pointer",
        width: 34,
        height: 34,
        borderRadius: 9,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: active ? C.safe : C.panel2,
        border: `1px solid ${active ? C.safe : C.border}`,
        color: active ? "#0B0E11" : C.muted,
      }}
    >
      {children}
    </button>
  );
}

function Sigil({ size = 24, ring }) {
  return (
    <span style={{ position: "relative", display: "inline-flex" }}>
      {ring && (
        <span
          style={{
            position: "absolute",
            inset: -10,
            borderRadius: "50%",
            border: `2px solid ${C.signal}`,
            opacity: 0.3,
          }}
        />
      )}
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <rect x="2" y="2" width="20" height="20" rx="6" stroke={C.signal} strokeWidth="2" />
        <path d="M8 9.5c0-1.4 1.4-2 4-2s4 .8 4 2-1.4 1.9-4 2.5S8 13 8 14.5s1.4 2 4 2 4-.6 4-2" stroke={C.signal} strokeWidth="2" strokeLinecap="round" />
      </svg>
    </span>
  );
}

/* tiny inline glyphs */
const LockGlyph = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><rect x="4" y="10" width="16" height="11" rx="2" fill="#0B0E11" /><path d="M8 10V7a4 4 0 1 1 8 0v3" stroke="#0B0E11" strokeWidth="2" /></svg>
);
const FoxGlyph = () => (
  <span
    style={{
      display: "inline-flex",
      width: 22,
      height: 22,
      borderRadius: 6,
      background: "#FFFFFF",
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0,
    }}
  >
    <svg width="16" height="16" viewBox="0 0 40 37" fill="none">
      {/* ears + helmet top */}
      <path d="M37.5 1 22.4 12.1l2.8-6.6L37.5 1Z" fill="#E2761B" stroke="#E2761B" strokeWidth="0.5" strokeLinejoin="round" />
      <path d="M2.5 1l14.9 11.2-2.6-6.7L2.5 1Z" fill="#E4761B" stroke="#E4761B" strokeWidth="0.5" strokeLinejoin="round" />
      <path d="M32 26.6l-4 6.1 8.6 2.4 2.4-8.4-7 -.1Z" fill="#E4761B" stroke="#E4761B" strokeWidth="0.5" strokeLinejoin="round" />
      <path d="M1 26.7l2.4 8.4 8.6-2.4-4-6.1-7 .1Z" fill="#E4761B" stroke="#E4761B" strokeWidth="0.5" strokeLinejoin="round" />
      {/* eyes/mid facets */}
      <path d="M11.5 16.1l-2.3 3.6 8.5.4-.3-9.2-5.9 5.2Z" fill="#E4761B" stroke="#E4761B" strokeWidth="0.5" strokeLinejoin="round" />
      <path d="M28.5 16.1l-6-5.3-.2 9.3 8.5-.4-2.3-3.6Z" fill="#E4761B" stroke="#E4761B" strokeWidth="0.5" strokeLinejoin="round" />
      <path d="M12 32.7l5.2-2.5-4.5-3.5-.7 6Z" fill="#E4761B" stroke="#E4761B" strokeWidth="0.5" strokeLinejoin="round" />
      <path d="M22.8 30.2l5.1 2.5-.6-6-4.5 3.5Z" fill="#E4761B" stroke="#E4761B" strokeWidth="0.5" strokeLinejoin="round" />
      {/* snout / cream highlights */}
      <path d="M27.9 32.7l-5.1-2.5.4 3.3-.05 1.4 4.75-2.2Z" fill="#D7C1B3" stroke="#D7C1B3" strokeWidth="0.5" strokeLinejoin="round" />
      <path d="M12 32.7l4.8 2.2-.03-1.4.37-3.3-5.14 2.5Z" fill="#D7C1B3" stroke="#D7C1B3" strokeWidth="0.5" strokeLinejoin="round" />
      <path d="M16.9 24.7l-4.3-1.3 3-1.4 1.3 2.7Z" fill="#233447" stroke="#233447" strokeWidth="0.5" strokeLinejoin="round" />
      <path d="M23.1 24.7l1.3-2.7 3.05 1.4-4.35 1.3Z" fill="#233447" stroke="#233447" strokeWidth="0.5" strokeLinejoin="round" />
      <path d="M12 32.7l.74-6.1-4.74.1L12 32.7Z" fill="#CD6116" stroke="#CD6116" strokeWidth="0.5" strokeLinejoin="round" />
      <path d="M27.26 26.6L28 32.7l4-6-4.74-.1Z" fill="#CD6116" stroke="#CD6116" strokeWidth="0.5" strokeLinejoin="round" />
      <path d="M30.8 19.7l-8.5.4.79 4.6 1.3-2.7 3.05 1.4 3.36-3.7Z" fill="#CD6116" stroke="#CD6116" strokeWidth="0.5" strokeLinejoin="round" />
      <path d="M12.6 23.4l3-1.4 1.3 2.7.8-4.6-8.5-.4 3.4 3.7Z" fill="#CD6116" stroke="#CD6116" strokeWidth="0.5" strokeLinejoin="round" />
      <path d="M9.2 19.7l3.57 6.96.12-3.26L9.2 19.7Z" fill="#E4751F" stroke="#E4751F" strokeWidth="0.5" strokeLinejoin="round" />
      <path d="M30.8 19.7l-3.74 3.7.12 3.26L30.8 19.7Z" fill="#E4751F" stroke="#E4751F" strokeWidth="0.5" strokeLinejoin="round" />
      <path d="M17.7 20.1l-.8 4.6 1 5.2.23-6.86-.43-2.94Z" fill="#E4751F" stroke="#E4751F" strokeWidth="0.5" strokeLinejoin="round" />
      <path d="M22.3 20.1l-.42 2.93.22 6.87 1.01-5.2-.81-4.6Z" fill="#E4751F" stroke="#E4751F" strokeWidth="0.5" strokeLinejoin="round" />
      <path d="M23.11 24.7l-1.01 5.2.72.5 4.5-3.5.12-3.26-4.33 1.06Z" fill="#F6851B" stroke="#F6851B" strokeWidth="0.5" strokeLinejoin="round" />
      <path d="M12.6 23.4l.12 3.26 4.5 3.5.72-.5-1.01-5.2-4.33-1.06Z" fill="#F6851B" stroke="#F6851B" strokeWidth="0.5" strokeLinejoin="round" />
      <path d="M23.2 35l.05-1.4-.38-.33h-5.74l-.36.33.04 1.4-4.81-2.3 1.68 1.38 3.4 2.37h5.84l3.42-2.37 1.68-1.38L23.2 35Z" fill="#C0AD9E" stroke="#C0AD9E" strokeWidth="0.5" strokeLinejoin="round" />
      <path d="M22.8 30.2l-.72-.5h-4.16l-.72.5-.37 3.3.36-.33h5.74l.38.33-.51-3.3Z" fill="#161616" stroke="#161616" strokeWidth="0.5" strokeLinejoin="round" />
      <path d="M38.1 12.8 39.4 6.4 37.5 1 22.8 11.9l5.7 4.7 8 2.3 1.78-2.05-.77-.56 1.22-1.1-.94-.72 1.23-.93-.82-.04Z" fill="#763D16" stroke="#763D16" strokeWidth="0.5" strokeLinejoin="round" />
      <path d="M.6 6.4l1.3 6.4-.83.61 1.24.93-.94.72 1.22 1.1-.77.56 1.78 2.05 8-2.3 5.7-4.7L2.5 1 .6 6.4Z" fill="#763D16" stroke="#763D16" strokeWidth="0.5" strokeLinejoin="round" />
      <path d="M36.5 18.9l-8-2.3 2.3 3.1-3.36 3.7 4.42-.06h6.6l-1.96-4.44Z" fill="#F6851B" stroke="#F6851B" strokeWidth="0.5" strokeLinejoin="round" />
      <path d="M11.5 16.6l-8 2.3-1.94 4.44h6.58l4.41.06-3.36-3.7 2.31-3.1Z" fill="#F6851B" stroke="#F6851B" strokeWidth="0.5" strokeLinejoin="round" />
      <path d="M22.8 11.9l.78-9.2L24.7 5.5 22.8 11.9Z" fill="#F6851B" stroke="#F6851B" strokeWidth="0.5" strokeLinejoin="round" />
      <path d="M17.2 11.9 15.3 5.5l1.12-2.8.78 9.2Z" fill="#F6851B" stroke="#F6851B" strokeWidth="0.5" strokeLinejoin="round" />
    </svg>
  </span>
);
const SunGlyph = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.4 1.4M17.6 17.6 19 19M19 5l-1.4 1.4M6.4 17.6 5 19" /></svg>
);
const MoonGlyph = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z" fill="currentColor" /></svg>
);
const WorldGlyph = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke={C.muted} strokeWidth="2" /><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18" stroke={C.muted} strokeWidth="1.4" /></svg>
);
const Eye = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" stroke="currentColor" strokeWidth="2" /><circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" /></svg>
);
const EyeOff = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none"><path d="M3 3l18 18M10.6 10.7a3 3 0 0 0 4.2 4.2M9.4 5.2A9.8 9.8 0 0 1 12 5c6.5 0 10 7 10 7a16 16 0 0 1-3 3.6M6.1 6.2A16 16 0 0 0 2 12s3.5 7 10 7a9.6 9.6 0 0 0 3-.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
);
const CopyGlyph = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><rect x="9" y="9" width="11" height="11" rx="2" stroke="currentColor" strokeWidth="2" /><path d="M5 15V5a2 2 0 0 1 2-2h8" stroke="currentColor" strokeWidth="2" /></svg>
);
