"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useApp } from "../lib/store";
import BottomSheet from "../components/BottomSheet";
import { Bolt, Lock, Shield, Check, Info, Chevron } from "../components/icons";
import { inr } from "../lib/format";
import { calcFees } from "../lib/fees";

const PAN_RE = /^[A-Z]{5}[0-9]{4}[A-Z]$/;

export default function Onboarding() {
  const { state, hydrated, completeKYC, toast, bumpTooltipTaps } = useApp();
  const router = useRouter();

  const [step, setStep] = useState(0); // 0 landing · 1 PAN · 2 Aadhaar OTP · 3 processing · 4 verified
  const [pan, setPan] = useState("");
  const [otp, setOtp] = useState("");
  const [aadhaarTail, setAadhaarTail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [kyc, setKyc] = useState(null);
  const [feesSheet, setFeesSheet] = useState(false);

  useEffect(() => {
    if (hydrated && state.auth) router.replace("/dashboard");
  }, [hydrated, state.auth, router]);

  const sendOtp = () => {
    if (!PAN_RE.test(pan)) {
      setError("Enter a valid PAN — 5 letters, 4 digits, 1 letter (e.g. ABCDE1234F)");
      return;
    }
    setError("");
    setAadhaarTail(String(1000 + Math.floor(Math.random() * 9000)));
    setStep(2);
    toast("Aadhaar OTP sent via UIDAI (demo — any 6 digits work)");
  };

  const verify = async () => {
    if (!/^\d{6}$/.test(otp)) {
      setError("Enter the 6-digit Aadhaar OTP");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/kyc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pan, otp, aadhaarConsent: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "KYC verification failed");
      setKyc(data);
      setStep(3);
      setTimeout(() => setStep(4), 2200);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const finish = () => {
    completeKYC({
      name: kyc.name,
      panMasked: `${pan.slice(0, 2)}••••${pan.slice(7)}`,
      ckycId: kyc.ckycId,
      token: kyc.token,
    });
    toast("Dashboard unlocked — welcome aboard 🎉", "success");
    router.push("/dashboard");
  };

  const sampleFees = calcFees({ price: 1419.4, qty: 10, side: "sell", exchange: "NSE" });
  const FeeRow = ({ l, v, bold }) => (
    <div className={`frow${bold ? " total" : ""}`}>
      <span>{l}</span>
      <b>{inr(v)}</b>
    </div>
  );

  return (
    <div className="page">
      {/* ── Landing ─────────────────────────────────────────────── */}
      {step === 0 && (
        <>
          <div className="hero">
            <div className="hero-logo"><Bolt size={30} /></div>
            <div>
              <div className="brand" style={{ marginBottom: 10 }}>
                <b style={{ fontSize: 14, letterSpacing: 0.3 }}>INSTAINVEST</b>
                <span className="tag">BETA · DEMO</span>
              </div>
              <h2>Stocks, made <em>simple</em> and fee-transparent.</h2>
            </div>
            <p className="lead">
              KYC in 2 minutes with DigiLocker-grade verification. See every rupee of fees
              <b> before</b> you place an order.
            </p>
          </div>

          <div className="features">
            <div className="feature">
              <div className="fi"><Shield size={18} /></div>
              <div>
                <b>Instant omnichannel KYC</b>
                <div className="small">PAN + Aadhaar OTP → CKYC registry lookup → trade-ready.</div>
              </div>
            </div>
            <div className="feature">
              <div className="fi"><Bolt size={18} /></div>
              <div>
                <b>Pre-trade fee calculator</b>
                <div className="small">Brokerage, STT, exchange charges, GST — exact payout before you confirm.</div>
              </div>
            </div>
            <div className="feature">
              <div className="fi"><Info size={18} /></div>
              <div>
                <b>Contextual education</b>
                <div className="small">Market vs Limit, NSE vs BSE — explained at the exact point of action.</div>
              </div>
            </div>
          </div>

          <div className="trustrow">
            <span className="pill"><Lock size={12} /> AES-256 payload encryption</span>
            <span className="pill"><Shield size={12} /> JWT-secured gateway</span>
            <span className="pill">
              Sell ₹14,194 → <span className="up">pay ₹14,175.93 net</span>
              <button className="link-btn" onClick={() => { setFeesSheet(true); bumpTooltipTaps(); }}>why?</button>
            </span>
          </div>

          <button className="btn btn-primary" onClick={() => setStep(1)}>
            Start KYC — it takes 2 minutes <Chevron />
          </button>
          <p className="footer-note">
            Demo build · simulated exchange &amp; market feed · not investment advice
          </p>
        </>
      )}

      {/* ── Step 1: PAN ─────────────────────────────────────────── */}
      {step === 1 && (
        <>
          <div className="progress-dots"><span className="dot on" /><span className="dot" /><span className="dot" /><span className="dot" /></div>
          <div>
            <h2 style={{ fontSize: 22, letterSpacing: "-0.3px" }}>Verify your identity</h2>
            <p className="muted small" style={{ marginTop: 4 }}>Step 1 of 3 · Permanent Account Number</p>
          </div>
          <div className="field">
            <label>PAN number</label>
            <input
              className="input input-lg"
              style={{ letterSpacing: 2, textAlign: "left", maxWidth: 260 }}
              placeholder="ABCDE1234F"
              maxLength={10}
              value={pan}
              onChange={(e) => setPan(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
              autoFocus
            />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span className="hint">Used to fetch your CKYC record</span>
              <button className="link-btn muted" onClick={() => { setPan("ABCDE1234F"); setError(""); }}>Use demo PAN</button>
            </div>
          </div>
          {error && <p className="err">{error}</p>}
          <span className="pill" style={{ alignSelf: "flex-start" }}><Lock size={12} /> Encrypted with AES-256 before transmission</span>
          <button className="btn btn-primary" onClick={sendOtp} disabled={!pan}>Continue to Aadhaar OTP</button>
          <button className="link-btn muted center" style={{ width: "100%", justifyContent: "center" }} onClick={() => setStep(0)}>← Back</button>
        </>
      )}

      {/* ── Step 2: Aadhaar OTP ─────────────────────────────────── */}
      {step === 2 && (
        <>
          <div className="progress-dots"><span className="dot on" /><span className="dot on" /><span className="dot" /><span className="dot" /></div>
          <div>
            <h2 style={{ fontSize: 22, letterSpacing: "-0.3px" }}>Aadhaar OTP verification</h2>
            <p className="muted small" style={{ marginTop: 4 }}>
              Step 2 of 3 · OTP sent to Aadhaar linked mobile ·······{aadhaarTail}
            </p>
          </div>
          <div className="field">
            <label>6-digit OTP</label>
            <input
              className="input input-lg"
              placeholder="••••••"
              inputMode="numeric"
              maxLength={6}
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
              autoFocus
            />
            <span className="hint">Demo: any 6-digit OTP is accepted. Production uses UIDAI REST APIs via an authorized AUA.</span>
          </div>
          {error && <p className="err">{error}</p>}
          <span className="pill" style={{ alignSelf: "flex-start" }}><Shield size={12} /> Consent captured for UIDAI e-KYC (demo)</span>
          <button className="btn btn-primary" onClick={verify} disabled={busy || otp.length < 6}>
            {busy ? "Verifying…" : "Verify & fetch KYC record"}
          </button>
          <button className="link-btn muted center" style={{ width: "100%", justifyContent: "center" }} onClick={() => { setStep(1); setOtp(""); setError(""); }}>← Back</button>
        </>
      )}

      {/* ── Step 3: CKYC processing ─────────────────────────────── */}
      {step === 3 && (
        <>
          <div className="progress-dots"><span className="dot on" /><span className="dot on" /><span className="dot on" /><span className="dot" /></div>
          <h2 style={{ fontSize: 22 }}>Activating your account…</h2>
          <div className="listcard" style={{ padding: 18, display: "flex", flexDirection: "column", gap: 12 }}>
            <div className="step-item done"><Check size={15} /> PAN format validated</div>
            <div className="step-item done"><Check size={15} /> Aadhaar OTP verified via UIDAI</div>
            <div className="step-item"><span className="spinner" /> Searching CKYC registry by PAN…</div>
          </div>
          <p className="hint center">Backend validates KYC status instantly — no upload, no paperwork.</p>
        </>
      )}

      {/* ── Step 4: Verified ────────────────────────────────────── */}
      {step === 4 && (
        <>
          <div className="progress-dots"><span className="dot on" /><span className="dot on" /><span className="dot on" /><span className="dot on" /></div>
          <div className="success-circle"><Check size={30} /></div>
          <div className="center">
            <h2 style={{ fontSize: 24, marginTop: 8 }}>You&apos;re verified! 🎉</h2>
            <p className="muted small" style={{ marginTop: 6 }}>
              CKYC ID <b>{kyc?.ckycId}</b> · Status <b style={{ color: "var(--green-deep)" }}>VERIFIED</b>
            </p>
            <p className="muted small" style={{ marginTop: 10 }}>
              Your dashboard is unlocked. We credited 2 starter holdings (10 RELIANCE, 5 TCS) so you
              can try the transparent Sell flow right away.
            </p>
          </div>
          <button className="btn btn-primary" onClick={finish}>Go to dashboard <Chevron /></button>
        </>
      )}

      {/* Fee explainer sheet */}
      <BottomSheet open={feesSheet} onClose={() => setFeesSheet(false)} title="Every fee, before you trade">
        <p>Example: selling 10 shares of Reliance at ₹1,419.40 on NSE (delivery):</p>
        <div className="fee-card">
          <FeeRow l="Order value" v={sampleFees.turnover} bold />
          <FeeRow l="Brokerage (0.03%, max ₹20)" v={sampleFees.brokerage} />
          <FeeRow l="STT (0.1%)" v={sampleFees.stt} />
          <FeeRow l="Exchange charges (NSE)" v={sampleFees.exchangeCharges} />
          <FeeRow l="SEBI charges" v={sampleFees.sebiCharges} />
          <FeeRow l="GST (18%)" v={sampleFees.gst} />
          <FeeRow l="DP charges (CDSL)" v={sampleFees.dpCharges} />
          <div className="fdiv" />
          <FeeRow l="Total charges" v={sampleFees.totalCharges} bold />
        </div>
        <div className="proceeds"><span>Estimated Net Proceeds</span><b>{inr(sampleFees.netProceeds)}</b></div>
        <p className="hint">Exactly what will hit your bank account — shown before you confirm. No surprises at settlement.</p>
      </BottomSheet>
    </div>
  );
}
