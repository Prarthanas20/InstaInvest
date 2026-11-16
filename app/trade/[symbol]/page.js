"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useApp } from "../../../lib/store";
import { STOCKS } from "../../../lib/market";
import { calcFees, round2 } from "../../../lib/fees";
import { inr, pct, timeAgo } from "../../../lib/format";
import BottomSheet from "../../../components/BottomSheet";
import { Back, Info, Plus, Minus, Shield } from "../../../components/icons";

export default function TradePage() {
  const params = useParams();
  const router = useRouter();
  const symbol = String(params?.symbol || "").toUpperCase();
  const stock = STOCKS.find((s) => s.symbol === symbol);

  const { state, hydrated, prices, toast, submitOrder, bumpTooltipTaps, markTipSeen } = useApp();

  const [side, setSide] = useState("buy");
  const [orderType, setOrderType] = useState("market");
  const [exchange, setExchange] = useState("NSE");
  const [qty, setQty] = useState("");
  const [limitPrice, setLimitPrice] = useState("");
  const [sheet, setSheet] = useState(null); // market | limit | exchange | fees
  const [review, setReview] = useState(null); // server-verified fee breakdown
  const [verifying, setVerifying] = useState(false);
  const [placing, setPlacing] = useState(false);

  useEffect(() => {
    if (hydrated && !state.auth) router.replace("/");
  }, [hydrated, state.auth, router]);

  const p = prices[symbol];
  const price = p ? (exchange === "NSE" ? p.nse : p.bse) : 0;
  const chg = p ? ((price - p.prevClose) / p.prevClose) * 100 : 0;

  const numQty = parseInt(qty, 10) || 0;
  const effPrice = orderType === "limit" ? parseFloat(limitPrice) || 0 : price;
  const fees = useMemo(
    () => (effPrice > 0 && numQty > 0 ? calcFees({ price: effPrice, qty: numQty, side, exchange }) : null),
    [effPrice, numQty, side, exchange]
  );

  const ownedQty = state.holdings.find((h) => h.symbol === symbol)?.qty || 0;
  const insufficient = side === "buy" && fees && fees.totalDebit > state.balance;
  const overSell = side === "sell" && numQty > ownedQty;
  const canReview = !!fees && !insufficient && !overSell && (orderType === "market" || effPrice > 0);

  const openSheet = (which) => {
    setSheet(which);
    bumpTooltipTaps();
  };

  const toggleOrderType = (t) => {
    setOrderType(t);
    if (t === "limit" && !limitPrice && price) setLimitPrice(price.toFixed(2));
  };

  const maxBuyQty = Math.max(0, Math.floor(state.balance / (price || 1)));
  const setMax = () => setQty(String(side === "sell" ? ownedQty : Math.min(maxBuyQty, 9999)));

  // "Review Order" → authoritative server-side fee breakdown (pre-trade calculator)
  const openReview = async () => {
    setVerifying(true);
    try {
      const res = await fetch("/api/fees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ price: effPrice, qty: numQty, side, exchange }),
      });
      const data = await res.json();
      setReview(res.ok ? data : fees);
    } catch {
      setReview(fees);
    } finally {
      setVerifying(false);
    }
  };

  const confirmOrder = async () => {
    if (!review) return;
    setPlacing(true);
    try {
      await submitOrder({
        symbol,
        side,
        qty: numQty,
        type: orderType,
        price: effPrice,
        exchange,
        fees: review,
        totalDebit: review.totalDebit,
        netProceeds: review.netProceeds,
      });
      toast(`Order sent to ${exchange} via FIX session · status OPEN`, "info");
      setReview(null);
      setQty("");
      markTipSeen(`traded-${symbol}`);
    } catch (e) {
      toast(e.message, "error");
    } finally {
      setPlacing(false);
    }
  };

  const Row = ({ l, v, bold }) => (
    <div className={`frow${bold ? " total" : ""}`}>
      <span>{l}</span>
      <b>{inr(v)}</b>
    </div>
  );

  if (!stock) {
    return (
      <div className="page">
        <div className="listcard"><div className="empty"><span className="big">🔍</span>Symbol not found.<br /><button className="link-btn" onClick={() => router.push("/dashboard")}>← Back to dashboard</button></div></div>
      </div>
    );
  }

  return (
    <>
      <div className="topbar">
        <button className="icon-btn" aria-label="Back" onClick={() => router.push("/dashboard")}><Back /></button>
        <div className="top-title">
          {stock.symbol}
          <div className="small">{stock.name}</div>
        </div>
        <button className="icon-btn" aria-label="Fee explainer" onClick={() => openSheet("fees")}><Info size={16} /></button>
      </div>

      <div className="page">
        {/* Live price */}
        <div className="price-block">
          <div>
            <div className="big num">₹{price.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            <span className={`chg num ${chg >= 0 ? "up" : "down"}`}>{pct(chg)} today</span>
          </div>
          <div style={{ textAlign: "right" }}>
            <span className="live"><span className="live-dot" /> LIVE</span>
            <div className="hint">simulated wss feed · 1.5s ticks</div>
            {exchange === "BSE" && p && <div className="hint">NSE ₹{p.nse.toFixed(2)}</div>}
          </div>
        </div>

        {/* Exchange selector + education (User Story: NSE vs BSE) */}
        <div className="exch-row">
          <div className="seg small">
            {["NSE", "BSE"].map((ex) => (
              <button key={ex} className={exchange === ex ? "on" : ""} onClick={() => setExchange(ex)}>{ex}</button>
            ))}
          </div>
          <button className="link-btn muted" onClick={() => openSheet("exchange")}><Info size={13} /> NSE vs BSE?</button>
        </div>

        {/* Buy / Sell */}
        <div className="seg buy-sell">
          <button className={side === "buy" ? "on buy" : ""} onClick={() => setSide("buy")}>Buy</button>
          <button className={side === "sell" ? "on sell" : ""} onClick={() => setSide("sell")}>Sell</button>
        </div>

        {/* Order type + contextual education (User Story 2) */}
        {state.tooltipTaps === 0 && !state.seenTips[`tip-${symbol}`] && (
          <div className="tip-bubble">
            <span>💡 <b>First trade?</b> Market = instant execution at the live price. Limit = you name your price. Tap any <b>ⓘ</b> to learn more.</span>
            <button className="btn-tip-close" onClick={() => markTipSeen(`tip-${symbol}`)}>Got it</button>
          </div>
        )}
        <div className="exch-row">
          <div className="seg" style={{ flex: 1 }}>
            <button className={orderType === "market" ? "on" : ""} onClick={() => toggleOrderType("market")}>
              Market
              <span className="mini-info" role="button" tabIndex={0} aria-label="What is a Market order?" onClick={(e) => { e.stopPropagation(); openSheet("market"); }} onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); openSheet("market"); } }}><Info size={13} /></span>
            </button>
            <button className={orderType === "limit" ? "on" : ""} onClick={() => toggleOrderType("limit")}>
              Limit
              <span className="mini-info" role="button" tabIndex={0} aria-label="What is a Limit order?" onClick={(e) => { e.stopPropagation(); openSheet("limit"); }} onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); openSheet("limit"); } }}><Info size={13} /></span>
            </button>
          </div>
        </div>

        {/* Limit price */}
        {orderType === "limit" && (
          <div className="field">
            <label>Limit price (₹)</label>
            <input className="input" inputMode="decimal" value={limitPrice} onChange={(e) => setLimitPrice(e.target.value.replace(/[^\d.]/g, ""))} placeholder={price ? price.toFixed(2) : "0.00"} />
            <span className="hint">Order rests in the exchange order book until your price is reached.</span>
          </div>
        )}

        {/* Quantity */}
        <div className="field">
          <label>Quantity</label>
          <div className="qty-row">
            <div className="stepper">
              <button aria-label="Decrease" onClick={() => setQty(String(Math.max(0, numQty - 1)))}><Minus /></button>
              <input className="qty-input" inputMode="numeric" value={qty} onChange={(e) => setQty(e.target.value.replace(/\D/g, ""))} placeholder="0" />
              <button aria-label="Increase" onClick={() => setQty(String(numQty + 1))}><Plus /></button>
            </div>
            <div className="chips">
              {[1, 5, 10].map((n) => <button key={n} className="chip" onClick={() => setQty(String(n))}>{n}</button>)}
              <button className="chip" onClick={setMax}>MAX</button>
            </div>
          </div>
          {side === "buy" && <span className="hint num">Balance {inr(state.balance)} · max {maxBuyQty} qty</span>}
          {side === "sell" && <span className="hint num">You hold {ownedQty} {symbol} <Shield size={11} /> CDSL TPIN pre-authorized</span>}
        </div>

        {insufficient && <p className="err">Insufficient ledger balance — add funds from the dashboard.</p>}
        {overSell && <p className="err">You only hold {ownedQty} shares.</p>}

        {/* Pre-trade fee calculator (PRD: transparent fees before order placement) */}
        {fees && (
          <div className="fee-card">
            <div className="fee-card-head"><span>Pre-trade fee estimate</span><button className="link-btn" onClick={() => openSheet("fees")}>How it works</button></div>
            <Row l="Order value" v={fees.turnover} bold />
            <Row l="Brokerage (0.03%, max ₹20)" v={fees.brokerage} />
            <Row l="STT (0.1%)" v={fees.stt} />
            <Row l="Exchange + SEBI charges" v={round2(fees.exchangeCharges + fees.sebiCharges)} />
            <Row l="GST (18%)" v={fees.gst} />
            {side === "buy" ? <Row l="Stamp duty (0.015%)" v={fees.stampDuty} /> : <Row l="DP charges (CDSL)" v={fees.dpCharges} />}
            <div className="fdiv" />
            <div className="frow total">
              <span>{side === "buy" ? "Est. total debit" : "Est. net proceeds"}</span>
              <b className={side === "sell" ? "up" : ""}>{inr(side === "buy" ? fees.totalDebit : fees.netProceeds)}</b>
            </div>
          </div>
        )}

        <button className="btn btn-primary" onClick={openReview} disabled={!canReview || verifying}>
          {verifying ? "Verifying with risk engine…" : "Review Order"}
        </button>

        {/* Recent orders for this symbol (live OPEN → EXECUTED) */}
        {state.orders.length > 0 && (
          <div className="listcard">
            {state.orders.filter((o) => o.symbol === symbol).slice(0, 3).map((o) => (
              <div key={o.id} className="orow">
                <span className={`badge ${o.side === "buy" ? "badge-green" : "badge-red"}`}>{o.side.toUpperCase()}</span>
                <div className="mid">
                  <b>{o.qty} qty · {o.type === "limit" ? "Limit" : "Market"}</b>
                  <span className="small muted">{timeAgo(o.placedAt)}{o.status === "EXECUTED" ? ` · filled @ ₹${o.fillPrice}` : ""}</span>
                </div>
                <span className={`status-chip ${o.status === "EXECUTED" ? "executed" : "open"}`}>{o.status}</span>
              </div>
            ))}
          </div>
        )}

        <p className="footer-note">Demo build · simulated exchange routing · not investment advice</p>
      </div>

      {/* ── Contextual education sheets ─────────────────────────── */}
      <BottomSheet open={sheet === "market"} onClose={() => setSheet(null)} title="Market order">
        <p>A market order executes <b>immediately</b> at the best available current price on the exchange.</p>
        <p>You get <b>certainty of execution</b>, not of price. Best when you simply want in or out now.</p>
        <div className="callout">Tip: in fast-moving stocks the final fill can differ slightly from the on-screen price (slippage).</div>
        <button className="btn btn-primary" onClick={() => setSheet(null)}>Got it</button>
      </BottomSheet>

      <BottomSheet open={sheet === "limit"} onClose={() => setSheet(null)} title="Limit order">
        <p className="callout">Set your own price. The order executes only if the stock reaches this price or better.</p>
        <p>Use it when you have a target entry/exit. The order sits in the exchange&apos;s order book until it matches — and can stay unfilled if the price never reaches yours.</p>
        <button className="btn btn-primary" onClick={() => setSheet(null)}>Got it</button>
      </BottomSheet>

      <BottomSheet open={sheet === "exchange"} onClose={() => setSheet(null)} title="NSE vs BSE">
        <p>Both are India&apos;s national exchanges and both list {stock.symbol}. Their prices differ by a few paise.</p>
        <p><b>NSE</b> usually has higher liquidity and tighter spreads, so most retail orders route there. Either choice is safe.</p>
        <button className="btn btn-primary" onClick={() => setSheet(null)}>Got it</button>
      </BottomSheet>

      <BottomSheet open={sheet === "fees"} onClose={() => setSheet(null)} title="How fees are calculated">
        <p>InstaInvest shows every charge <b>before</b> you confirm — the same schedule our order engine applies:</p>
        <div className="fee-card">
          <div className="frow"><span><b>Brokerage</b> · 0.03% of order value, capped at ₹20</span></div>
          <div className="frow"><span><b>STT</b> · 0.1% on delivery (both sides) — govt tax</span></div>
          <div className="frow"><span><b>Exchange charges</b> · NSE 0.00297% · BSE 0.00375%</span></div>
          <div className="frow"><span><b>SEBI charges</b> · ₹10 per crore (0.0001%)</span></div>
          <div className="frow"><span><b>GST</b> · 18% on brokerage + exchange + SEBI</span></div>
          <div className="frow"><span><b>Stamp duty</b> · 0.015%, buy side only</span></div>
          <div className="frow"><span><b>DP charges</b> · CDSL ₹13.5 + GST per scrip on sells</span></div>
        </div>
        <button className="btn btn-primary" onClick={() => setSheet(null)}>Got it</button>
      </BottomSheet>

      {/* ── Review Order modal (User Story 1: transparent sell flow) ── */}
      <BottomSheet open={!!review} onClose={() => setReview(null)} title="Review order">
        {review && (
          <>
            <div className="review-head">
              <span className={`badge ${side === "buy" ? "badge-green" : "badge-red"}`}>{side.toUpperCase()}</span>
              <b>{numQty} × {symbol}</b>
              <span className="tag">{exchange}</span>
              <span className="tag">{orderType === "limit" ? `Limit ₹${limitPrice}` : `Market ₹${price.toFixed(2)}`}</span>
            </div>
            <div className="fee-card">
              <Row l="Order value" v={review.turnover} bold />
              <Row l="Brokerage" v={review.brokerage} />
              <Row l="STT" v={review.stt} />
              <Row l={`Exchange charges (${exchange})`} v={review.exchangeCharges} />
              <Row l="SEBI charges" v={review.sebiCharges} />
              <Row l="GST (18%)" v={review.gst} />
              {side === "buy" && <Row l="Stamp duty" v={review.stampDuty} />}
              {side === "sell" && <Row l="DP charges (CDSL)" v={review.dpCharges} />}
              <div className="fdiv" />
              <Row l="Total charges" v={review.totalCharges} bold />
            </div>
            {side === "sell" ? (
              <div className="proceeds"><span>Estimated Net Proceeds</span><b>{inr(review.netProceeds)}</b></div>
            ) : (
              <div className="proceeds buy"><span>Estimated total debit</span><b>{inr(review.totalDebit)}</b></div>
            )}
            {side === "sell" && <p className="hint center ok-line">CDSL TPIN pre-authorized ✓ · e-DIS on file</p>}
            <p className="hint center">Server-verified breakdown · prices may differ slightly at execution · payout lands T+1.</p>
            <button className="btn btn-primary" onClick={confirmOrder} disabled={placing}>
              {placing ? "Routing to exchange…" : `Confirm ${side} order`}
            </button>
          </>
        )}
      </BottomSheet>
    </>
  );
}
