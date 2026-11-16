"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useApp } from "../lib/store";
import { inr } from "../lib/format";
import BottomSheet from "./BottomSheet";
import { Shield, Bolt, Plus, Minus, Chevron } from "./icons";

export default function InsightsPanel() {
  const { state, toast, linkBank, setProfile, startSip, stopSip } = useApp();
  const router = useRouter();

  const [consentOpen, setConsentOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [draftAge, setDraftAge] = useState(27);
  const [ageEditing, setAgeEditing] = useState(false);

  const age = state.profile?.age;
  const bank = state.bank;

  const runAnalysis = async (statementOverride, ageOverride) => {
    const statement = statementOverride || bank?.statement;
    if (!statement) return;
    setAnalyzing(true);
    try {
      const res = await fetch("/api/advisor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ statement, age: ageOverride ?? age }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Analysis failed");
      setAnalysis(data);
    } catch (e) {
      toast(e.message, "error");
    } finally {
      setAnalyzing(false);
    }
  };

  // Auto-analyze after a reload when statement + age already exist
  useEffect(() => {
    if (bank?.statement && age && !analysis && !analyzing) runAnalysis();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bank, age]);

  const connect = async () => {
    setSyncing(true);
    setConsentOpen(false);
    try {
      const res = await fetch("/api/bank", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ consent: true, scopes: ["salary_credits", "recurring_debits", "masked_balances"] }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Sync failed");
      linkBank({ accountLabel: data.accountLabel, consentId: data.consentId, statement: data.statement, syncedAt: Date.now() });
      toast(`Synced ${data.statement.months.length} months · ${data.accountLabel}`, "success");
      if (age) await runAnalysis(data.statement, age);
    } catch (e) {
      toast(e.message, "error");
    } finally {
      setSyncing(false);
    }
  };

  const applyAge = async (val) => {
    setProfile({ age: val });
    setAgeEditing(false);
    await runAnalysis(null, val);
  };

  const beginSip = () => {
    startSip({
      id: Math.random().toString(36).slice(2),
      amount: analysis.investable,
      stepUp: analysis.sipStepUp || 0,
      funds: analysis.funds.map((f) => ({ name: f.name, amount: f.amount })),
      stocks: analysis.stocks.map((s) => ({ symbol: s.symbol, amount: s.amount })),
      debitDay: 5,
      startedAt: Date.now(),
    });
    toast(`SIP mandate registered · ${inr(analysis.investable)}/mo auto-debit on the 5th (demo)`, "success");
  };

  const maxSal = analysis ? Math.max(...analysis.months.map((m) => m.salary)) : 0;
  const outflowPct = analysis && analysis.salary ? Math.round((analysis.avgExpenses / analysis.salary) * 100) : 0;
  const surplusPct = 100 - outflowPct;

  return (
    <>
      <div className="section-title">
        <h3>Smart Money Insights</h3>
        <span className="tag">AA · DEMO</span>
      </div>

      {/* ── Not connected yet ─────────────────────────────────── */}
      {!bank && (
        <div className="fee-card" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div className="fi" style={{ width: 44, height: 44 }}><Shield size={20} /></div>
          <div>
            <b style={{ fontSize: 15.5 }}>Connect your bank statement</b>
            <p className="hint" style={{ marginTop: 4 }}>
              We detect your salary, flag hikes (e.g. a salary increase) and size your
              investable surplus — then tune mutual fund / stock SIPs to your age.
            </p>
          </div>
          <div className="trustrow">
            <span className="pill"><Shield size={11} /> Read-only, RBI AA framework</span>
            <span className="pill"><Shield size={11} /> AES-256 encrypted</span>
          </div>
          <button className="btn btn-primary" onClick={() => setConsentOpen(true)} disabled={syncing}>
            {syncing ? "Syncing…" : "Connect bank (demo)"}
          </button>
        </div>
      )}

      {/* ── Synced: salary detection card ─────────────────────── */}
      {bank && (
        <div className="fee-card">
          <div className="fee-card-head"><span>Detected salary</span><span className="tag">{bank.accountLabel}</span></div>
          <div className="price-block">
            <div>
              <div className="big num">{inr(analysis?.salary || 0)}</div>
              <span className="hint">monthly employer credit · median of last 3 months</span>
            </div>
          </div>
          {/* Salary timeline with hike highlight */}
          {analysis && (
            <div className="sal-chart" style={{ marginTop: 12 }}>
              {analysis.months.map((m, i) => (
                <div key={i} className="sal-col">
                  <div className={`sal-bar${i >= analysis.hikeIndex && analysis.hikeIndex > 0 ? " hike" : ""}`} style={{ height: `${Math.max(8, Math.round((m.salary / maxSal) * 100))}%` }} />
                  <span className="sal-label">{m.label}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Hike banner ───────────────────────────────────────── */}
      {analysis && analysis.hikePct > 0 && (
        <div className="hike-banner">
          <span>
            🎉 <b>Salary hike detected: +{analysis.hikePct.toFixed(1)}%</b> (+{inr(analysis.hikeAmount)}/mo).
            {analysis.sipStepUp > 0 && <> Direct <b>{inr(analysis.sipStepUp)}/mo</b> of it into a SIP instead of lifestyle creep.</>}
          </span>
        </div>
      )}

      {/* ── Cashflow breakdown ────────────────────────────────── */}
      {analysis && (
        <div className="fee-card">
          <div className="fee-card-head"><span>Monthly cashflow</span><span className="tag">12-MO AVG</span></div>
          <div className="flow-row"><span>Inflow</span><div className="flow-track"><div className="flow-fill in" style={{ width: "100%" }} /></div><b className="num">{inr(analysis.salary, { compact: true })}</b></div>
          <div className="flow-row"><span>Outflow</span><div className="flow-track"><div className="flow-fill out" style={{ width: `${outflowPct}%` }} /></div><b className="num">{inr(analysis.avgExpenses, { compact: true })}</b></div>
          <div className="flow-row"><span>Surplus</span><div className="flow-track"><div className="flow-fill sur" style={{ width: `${surplusPct}%` }} /></div><b className="num up">{inr(analysis.surplus, { compact: true })}</b></div>
          <div className="proceeds" style={{ marginTop: 8 }}>
            <span>Recommended monthly SIP (50% of surplus)</span>
            <b>{inr(analysis.investable)}</b>
          </div>
          <p className="hint center">Savings rate {analysis.savingsRate}% · liquid buffer {analysis.emergencyMonths} months of expenses</p>
        </div>
      )}

      {/* ── Age tuner ─────────────────────────────────────────── */}
      {bank && (!age || ageEditing) && (
        <div className="fee-card center" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <b>Set your age</b>
          <p className="hint">Your equity share follows the classic “100 − age” rule with guardrails (35–80%).</p>
          <div className="stepper" style={{ maxWidth: 190, margin: "0 auto" }}>
            <button aria-label="Decrease age" onClick={() => setDraftAge(Math.max(18, draftAge - 1))}><Minus /></button>
            <div className="qty-input num" style={{ fontSize: 22 }}>{draftAge}</div>
            <button aria-label="Increase age" onClick={() => setDraftAge(Math.min(80, draftAge + 1))}><Plus /></button>
          </div>
          <button className="btn btn-primary" style={{ maxWidth: 240, margin: "0 auto" }} onClick={() => applyAge(draftAge)}>
            {analyzing ? "Analyzing…" : "Apply & build my plan"} <Chevron />
          </button>
        </div>
      )}

      {bank && age && !ageEditing && analysis && (
        <div className="exch-row">
          <span className="muted small">Age {age} · equity {analysis.equityPct}% / debt {100 - analysis.equityPct}%</span>
          <button className="link-btn muted" onClick={() => { setDraftAge(age); setAgeEditing(true); }}>change age</button>
        </div>
      )}

      {analyzing && !analysis && <div className="center"><div className="spinner-big" /><p className="hint">Scanning 12 months of cashflow…</p></div>}

      {/* ── Recommendations ───────────────────────────────────── */}
      {analysis && (
        <>
          <div className="split-bar">
            <div className="split-eq" style={{ width: `${analysis.equityPct}%` }}><span>Equity {analysis.equityPct}%</span></div>
            <div className="split-debt" style={{ width: `${100 - analysis.equityPct}%` }}><span>Debt {100 - analysis.equityPct}%</span></div>
          </div>

          {analysis.emergencyMonths < 6 && analysis.emergencyGap > 0 && (
            <div className="nudge">
              <span>⚠️ Your buffer covers only <b>{analysis.emergencyMonths} months</b>. Consider parking {inr(analysis.emergencyGap, { compact: true })} in a liquid fund to reach 6 months first.</span>
            </div>
          )}

          <div className="section-title"><h3>Recommended SIP plan</h3><span className="muted small num">{inr(analysis.investable)}/mo</span></div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {analysis.funds.map((f) => (
              <div key={f.name} className="fund-card">
                <div className="fund-top"><b>{f.name}</b><span className="badge badge-green">{f.category}</span></div>
                <div className="fund-amt num">{inr(f.amount)}<span className="muted small">/mo · {Math.round((f.amount / analysis.investable) * 100)}% of plan</span></div>
                <p className="hint">{f.why}</p>
              </div>
            ))}
          </div>

          {analysis.stocks.length > 0 && (
            <>
              <div className="section-title"><h3>Direct stocks (optional)</h3><span className="muted small">~15% of equity</span></div>
              <div className="listcard">
                {analysis.stocks.map((s, i) => (
                  <div key={s.symbol} className="orow">
                    <div className="tk-avatar" style={{ background: i === 0 ? "#067a5b" : "#0ea5a4" }}>{s.symbol.slice(0, 4)}</div>
                    <div className="mid">
                      <b>{s.symbol}</b>
                      <span className="small muted">{s.why}</span>
                    </div>
                    <div className="right num">
                      <span className="num">{inr(s.amount)}/mo</span>
                      <button className="link-btn" onClick={() => router.push(`/trade/${s.symbol}`)}>view chart →</button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          <button className="btn btn-primary" onClick={beginSip}>
            <Bolt size={15} /> Start SIP {inr(analysis.investable)}/mo
          </button>
          <p className="hint center">Algorithmic plan (demo) — not SEBI-registered investment advice. Review annually or after every hike.</p>
        </>
      )}

      {/* ── Active SIPs ───────────────────────────────────────── */}
      {state.sips.length > 0 && (
        <>
          <div className="section-title"><h3>Active SIPs</h3><span className="live"><span className="live-dot" /> auto-debit on</span></div>
          <div className="listcard">
            {state.sips.map((sip) => (
              <div key={sip.id} className="orow">
                <span className="badge badge-green">SIP</span>
                <div className="mid">
                  <b>{inr(sip.amount)}/mo</b>
                  <span className="small muted">{sip.funds.length} funds · debit day {sip.debitDay}{sip.stepUp > 0 ? ` · step-up ${inr(sip.stepUp)}` : ""}</span>
                </div>
                <button className="link-btn muted" onClick={() => { stopSip(sip.id); toast("SIP mandate cancelled (demo)"); }}>stop</button>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ── Consent sheet ─────────────────────────────────────── */}
      <BottomSheet open={consentOpen} onClose={() => setConsentOpen(false)} title="Consent — bank statement access">
        <p>InstaInvest will fetch <b>read-only</b> data via the RBI Account Aggregator framework (simulated):</p>
        <div className="fee-card">
          <div className="frow"><span>Salary credits · last 12 months</span></div>
          <div className="frow"><span>Recurring debits — rent, EMIs, UPI spends</span></div>
          <div className="frow"><span>Closing balances (masked)</span></div>
        </div>
        <div className="callout">Encrypted in transit (AES-256). Never sold, never shared. Revoke anytime.</div>
        <button className="btn btn-primary" onClick={connect} disabled={syncing}>{syncing ? "Fetching statement…" : "Allow & sync"}</button>
      </BottomSheet>
    </>
  );
}
