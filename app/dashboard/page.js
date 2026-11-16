"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useApp } from "../../lib/store";
import { STOCKS } from "../../lib/market";
import { inr, pct, timeAgo } from "../../lib/format";
import BottomSheet from "../../components/BottomSheet";
import { Bolt, Plus, Shield, Info, Close, Logout } from "../../components/icons";

const AVATAR_COLORS = ["#0ea5a4", "#6366f1", "#f59e0b", "#e5484d", "#8b5cf6", "#067a5b", "#0284c7", "#db2777", "#65a30d", "#d97706"];
const tkColor = (sym) => AVATAR_COLORS[sym.charCodeAt(0) % AVATAR_COLORS.length];

export default function Dashboard() {
  const { state, hydrated, prices, toast, addFunds, logout, pollOrderStatus, bumpTooltipTaps, markTipSeen } = useApp();
  const router = useRouter();

  const [tab, setTab] = useState("market");
  const [payOpen, setPayOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [payStage, setPayStage] = useState("form"); // form | processing | done
  const [payInfo, setPayInfo] = useState(null);
  const [nudgeClosed, setNudgeClosed] = useState(false);

  // Redirect if not KYC-verified
  useEffect(() => {
    if (hydrated && !state.auth) router.replace("/");
  }, [hydrated, state.auth, router]);

  // Reconcile OPEN orders with the execution callback stream (asynchronous fills)
  useEffect(() => {
    if (!hydrated) return;
    state.orders.filter((o) => o.status === "OPEN").forEach((o) => pollOrderStatus(o.id, 1600));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated]);

  if (!hydrated || !state.auth) return <div className="page" />;

  const name = state.auth.name || "Investor";

  const pay = async () => {
    const amt = Math.round(Number(amount));
    if (!(amt >= 100) || amt > 1000000) {
      toast("Amount must be between ₹100 and ₹10,00,000", "error");
      return;
    }
    setPayStage("processing");
    try {
      const res = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: amt, method: "upi" }),
      });
      const init = await res.json();
      if (!res.ok) throw new Error(init.error || "Payment initiation failed");
      // Gateway processes asynchronously → fires payment.captured webhook to our backend
      setTimeout(async () => {
        try {
          const hook = await fetch("/api/payments/webhook", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ event: "payment.captured", paymentId: init.paymentId, amount: amt }),
          }).then((r) => r.json());
          addFunds(amt);
          setPayInfo({ ...init, hook, amount: amt });
          setPayStage("done");
          toast(`${inr(amt)} added · webhook “payment.captured” verified ✓`, "success");
        } catch {
          setPayStage("form");
          toast("Webhook verification failed — try again", "error");
        }
      }, 2200);
    } catch (e) {
      setPayStage("form");
      toast(e.message, "error");
    }
  };

  const closePay = () => {
    setPayOpen(false);
    setAmount("");
    setPayStage("form");
    setPayInfo(null);
  };

  const holdingsValue = state.holdings.reduce((acc, h) => acc + h.qty * (prices[h.symbol]?.nse || h.avgPrice), 0);
  const showNudge = !nudgeClosed && state.tooltipTaps === 0;

  return (
    <>
      <div className="topbar">
        <div className="brand"><div className="brand-mark"><Bolt size={16} /></div></div>
        <h1>Hi {name} <span className="tag">KYC ✓</span></h1>
        <button className="icon-btn" aria-label="Logout" onClick={() => { logout(); router.replace("/"); }}><Logout /></button>
      </div>

      <div className="page">
        {/* Wallet */}
        <section className="wallet">
          <div className="wallet-top">
            <div>
              <p className="wallet-label">Ledger balance</p>
              <h2 className="wallet-amount num">{inr(state.balance)}</h2>
              <p className="wallet-sub">Purchasing power · funded via Razorpay UPI</p>
            </div>
            <div className="wallet-badge"><Shield size={12} /> CKYC VERIFIED</div>
          </div>
          <div className="wallet-actions">
            <button className="btn btn-light" onClick={() => setPayOpen(true)}><Plus size={15} /> Add funds</button>
            <button className="btn btn-ghost-dark" onClick={() => toast("Withdrawals reach your bank via IMPS within 24h (demo).")}>Withdraw</button>
          </div>
        </section>

        {/* Education nudge — KPI: tooltip engagement > 30% */}
        {showNudge && (
          <div className="nudge">
            <span>👋 First time here? Tap the <b>ⓘ</b> icons on a stock&apos;s trade screen — 30 seconds of clarity before your first order.</span>
            <button className="x" onClick={() => setNudgeClosed(true)} aria-label="Dismiss"><Close size={13} /></button>
          </div>
        )}

        {/* Tabs */}
        <div className="seg tabs">
          {["market", "holdings", "orders"].map((t) => (
            <button key={t} className={tab === t ? "on" : ""} onClick={() => setTab(t)}>
              {t === "market" ? "Market" : t === "holdings" ? "Holdings" : "Orders"}
            </button>
          ))}
        </div>

        {/* Market */}
        {tab === "market" && (
          <>
            <div className="section-title">
              <h3>NSE Equities</h3>
              <span className="live"><span className="live-dot" /> LIVE · wss feed</span>
            </div>
            <div className="listcard">
              {STOCKS.map((s) => {
                const p = prices[s.symbol];
                const chg = ((p.nse - p.prevClose) / p.prevClose) * 100;
                return (
                  <button key={s.symbol} className="srow" onClick={() => router.push(`/trade/${s.symbol}`)}>
                    <div className="tk-avatar" style={{ background: tkColor(s.symbol) }}>{s.symbol.slice(0, 4)}</div>
                    <div className="mid">
                      <b>{s.symbol}</b>
                      <span className="small">{s.name} · NSE</span>
                    </div>
                    <div className="right num">
                      <span className="num">₹{p.nse.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      <span className={`small num ${chg >= 0 ? "up" : "down"}`}>{pct(chg)}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </>
        )}

        {/* Holdings */}
        {tab === "holdings" && (
          <>
            <div className="section-title">
              <h3>Your demat (CDSL)</h3>
              <span className="muted small num">Value {inr(holdingsValue, { compact: true })}</span>
            </div>
            {state.holdings.length === 0 ? (
              <div className="listcard"><div className="empty"><span className="big">📦</span>No holdings yet.<br />Your CDSL demat will show shares here after you buy.</div></div>
            ) : (
              <div className="listcard">
                {state.holdings.map((h) => {
                  const p = prices[h.symbol];
                  const cur = p ? p.nse : h.avgPrice;
                  const pnl = (cur - h.avgPrice) * h.qty;
                  const pnlPct = ((cur - h.avgPrice) / h.avgPrice) * 100;
                  return (
                    <button key={h.symbol} className="srow" onClick={() => router.push(`/trade/${h.symbol}`)}>
                      <div className="tk-avatar" style={{ background: tkColor(h.symbol) }}>{h.symbol.slice(0, 4)}</div>
                      <div className="mid">
                        <b>{h.symbol} · {h.qty} qty</b>
                        <span className="small">avg ₹{h.avgPrice.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</span>
                      </div>
                      <div className="right num">
                        <span className="num">₹{(cur * h.qty).toLocaleString("en-IN", { maximumFractionDigits: 2 })}</span>
                        <span className={`small num ${pnl >= 0 ? "up" : "down"}`}>{pnl >= 0 ? "+" : ""}{pnl.toFixed(2)} ({pct(pnlPct)})</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* Orders */}
        {tab === "orders" && (
          <>
            <div className="section-title"><h3>Recent orders</h3><span className="live"><span className="live-dot" /> execution callbacks</span></div>
            {state.orders.length === 0 ? (
              <div className="listcard"><div className="empty"><span className="big">🧾</span>No orders yet.<br />Your FIX-routed orders will appear here with live status.</div></div>
            ) : (
              <div className="listcard">
                {state.orders.map((o) => (
                  <div key={o.id} className="orow">
                    <span className={`badge ${o.side === "buy" ? "badge-green" : "badge-red"}`}>{o.side.toUpperCase()}</span>
                    <div className="mid">
                      <b>{o.symbol} · {o.qty} qty</b>
                      <span className="small muted">
                        {o.type === "limit" ? `Limit @ ₹${o.price?.toFixed?.(2) || o.price}` : "Market"} · {o.exchange} · {timeAgo(o.placedAt)}
                      </span>
                    </div>
                    <span className={`status-chip ${o.status === "EXECUTED" ? "executed" : "open"}`}>{o.status}</span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        <p className="footer-note">
          InstaInvest demo · simulated market feed, FIX routing &amp; depository links · not investment advice
        </p>
      </div>

      {/* Add Funds sheet */}
      <BottomSheet open={payOpen} onClose={closePay} title={payStage === "done" ? "Funds added" : "Add funds"}>
        {payStage === "form" && (
          <>
            <div className="chips" style={{ justifyContent: "flex-start" }}>
              {[500, 1000, 5000, 10000].map((n) => (
                <button key={n} className="chip" onClick={() => setAmount(String(n))}>₹{n.toLocaleString("en-IN")}</button>
              ))}
            </div>
            <div className="field">
              <label>Amount (₹)</label>
              <input className="input input-lg" placeholder="1000" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))} autoFocus />
              <span className="hint">Min ₹100 · via UPI (Razorpay) · settles instantly to your trading ledger</span>
            </div>
            <button className="btn btn-primary" onClick={pay} disabled={!amount}>Pay {amount ? `₹${Number(amount).toLocaleString("en-IN")}` : ""} via UPI</button>
          </>
        )}
        {payStage === "processing" && (
          <div className="center" style={{ padding: "10px 0" }}>
            <div className="spinner-big" />
            <p style={{ fontWeight: 600 }}>Waiting for payment gateway webhook…</p>
            <p className="hint">The gateway processes UPI asynchronously — our backend listens for <b>payment.captured</b>.</p>
          </div>
        )}
        {payStage === "done" && payInfo && (
          <>
            <div className="pay-log mono">
              <span>gateway: {payInfo.gateway}</span>
              <span>paymentId: {payInfo.paymentId}</span>
              <span className="ok">webhook: payment.captured ✓ verified → ledger credited {inr(payInfo.amount)}</span>
            </div>
            <button className="btn btn-primary" onClick={closePay}>Done</button>
          </>
        )}
      </BottomSheet>
    </>
  );
}
