"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { STOCKS, initialPrices, tickPrice, clampAroundPrevClose, roundPrice } from "./market";
import { round2 } from "./fees";

const STORAGE_KEY = "instainvest.state.v1";
const TICK_MS = 1500;

// Demo demat (CDSL) holdings credited right after KYC so the Sell flow can be
// experienced end-to-end without a real depository transfer.
const seedHoldings = [
  { symbol: "RELIANCE", qty: 10, avgPrice: 1352.4, source: "CDSL transfer" },
  { symbol: "TCS", qty: 5, avgPrice: 3060.15, source: "CDSL transfer" },
];

const emptyState = {
  auth: null, // { name, panMasked, ckycId, token }
  balance: 0,
  holdings: [],
  orders: [],
  tooltipTaps: 0,
  seenTips: {},
  bank: null, // { accountLabel, consentId, statement, syncedAt }
  profile: null, // { age }
  sips: [], // { id, amount, stepUp, funds, stocks, debitDay, startedAt }
};

const AppCtx = createContext(null);
export const useApp = () => useContext(AppCtx);

export function AppProvider({ children }) {
  const [state, setState] = useState(emptyState);
  const [hydrated, setHydrated] = useState(false);
  const [prices, setPrices] = useState(initialPrices);
  const [toasts, setToasts] = useState([]);

  // hydrate from localStorage (client-side ledger for the demo)
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) setState((s) => ({ ...s, ...JSON.parse(raw) }));
    } catch {}
    setHydrated(true);
  }, []);

  // persist
  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {}
  }, [state, hydrated]);

  // Simulated market WebSocket: push a tick to every subscriber every 1.5s.
  useEffect(() => {
    const id = setInterval(() => {
      setPrices((prev) => {
        const next = {};
        for (const s of STOCKS) {
          const cur = prev[s.symbol];
          const nse = roundPrice(clampAroundPrevClose(tickPrice(cur.nse), cur.prevClose));
          next[s.symbol] = { ...cur, nse, bse: roundPrice(nse * 1.0004) };
        }
        return next;
      });
    }, TICK_MS);
    return () => clearInterval(id);
  }, []);

  const toast = useCallback((message, type = "info") => {
    const id = Math.random().toString(36).slice(2);
    setToasts((t) => [...t, { id, message, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4500);
  }, []);

  const completeKYC = useCallback(
    (auth) =>
      setState((s) => ({
        ...s,
        auth,
        holdings: s.holdings.length ? s.holdings : seedHoldings,
      })),
    []
  );

  const logout = useCallback(() => {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {}
    setState(emptyState);
  }, []);

  const addFunds = useCallback(
    (amount) => setState((s) => ({ ...s, balance: round2(s.balance + amount) })),
    []
  );

  // ── Smart Money Insights ──
  const linkBank = useCallback(
    (bank) => setState((s) => ({ ...s, bank })),
    []
  );

  const setProfile = useCallback(
    (profile) => setState((s) => ({ ...s, profile: { ...(s.profile || {}), ...profile } })),
    []
  );

  const startSip = useCallback(
    (sip) => setState((s) => ({ ...s, sips: [sip, ...s.sips] })),
    []
  );

  const stopSip = useCallback(
    (id) => setState((s) => ({ ...s, sips: s.sips.filter((x) => x.id !== id) })),
    []
  );

  const bumpTooltipTaps = useCallback(
    () => setState((s) => ({ ...s, tooltipTaps: s.tooltipTaps + 1 })),
    []
  );

  const markTipSeen = useCallback(
    (key) => setState((s) => ({ ...s, seenTips: { ...s.seenTips, [key]: true } })),
    []
  );

  const upsertOrder = useCallback(
    (order) => setState((s) => ({ ...s, orders: [order, ...s.orders].slice(0, 50) })),
    []
  );

  // Applies an execution report to the local ledger: holdings + balance + status.
  const applyExecution = useCallback(({ orderId, fillPrice }) => {
    setState((s) => {
      const order = s.orders.find((o) => o.id === orderId);
      if (!order || order.status !== "OPEN") return s; // idempotent guard
      let holdings = s.holdings;
      let balance = s.balance;
      if (order.side === "buy") {
        const ex = holdings.find((h) => h.symbol === order.symbol);
        if (ex) {
          const qty = ex.qty + order.qty;
          holdings = holdings.map((h) =>
            h.symbol === order.symbol
              ? { ...h, qty, avgPrice: round2((h.avgPrice * h.qty + fillPrice * order.qty) / qty) }
              : h
          );
        } else {
          holdings = [...holdings, { symbol: order.symbol, qty: order.qty, avgPrice: fillPrice, source: "Buy order" }];
        }
        balance = round2(balance - (order.totalDebit ?? 0));
      } else {
        holdings = holdings
          .map((h) => (h.symbol === order.symbol ? { ...h, qty: h.qty - order.qty } : h))
          .filter((h) => h.qty > 0);
        balance = round2(balance + (order.netProceeds ?? 0));
      }
      return {
        ...s,
        holdings,
        balance,
        orders: s.orders.map((o) =>
          o.id === orderId ? { ...o, status: "EXECUTED", fillPrice, executedAt: Date.now() } : o
        ),
      };
    });
  }, []);

  // Polls an OPEN order until the exchange execution callback flips it to EXECUTED.
  const pollOrderStatus = useCallback(
    (orderId, delayMs = 2000) => {
      setTimeout(async () => {
        try {
          const res = await fetch(`/api/orders/${orderId}`);
          const data = await res.json();
          if (data.status === "EXECUTED") {
            applyExecution({ orderId, fillPrice: data.fillPrice });
            toast(`⚡ ${data.symbol} ${String(data.side).toUpperCase()} · ${data.qty} @ ₹${data.fillPrice} — order executed`, "success");
          } else {
            pollOrderStatus(orderId, delayMs);
          }
        } catch {
          pollOrderStatus(orderId, delayMs);
        }
      }, delayMs);
    },
    [applyExecution, toast]
  );

  // Places an order: POST /api/orders → status OPEN → execution callback → EXECUTED.
  const submitOrder = useCallback(
    async (draft) => {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Order rejected");
      const order = {
        id: data.orderId,
        symbol: draft.symbol,
        side: draft.side,
        qty: draft.qty,
        type: draft.type,
        price: draft.price,
        exchange: draft.exchange,
        status: "OPEN",
        placedAt: Date.now(),
        fees: draft.fees,
        totalDebit: draft.totalDebit ?? null,
        netProceeds: draft.netProceeds ?? null,
      };
      upsertOrder(order);
      pollOrderStatus(data.orderId, data.etaMs || 2500);
      return order;
    },
    [upsertOrder, pollOrderStatus]
  );

  const value = {
    state,
    hydrated,
    prices,
    toasts,
    toast,
    completeKYC,
    logout,
    addFunds,
    linkBank,
    setProfile,
    startSip,
    stopSip,
    bumpTooltipTaps,
    markTipSeen,
    submitOrder,
    pollOrderStatus,
  };

  return (
    <AppCtx.Provider value={value}>
      {children}
      <div className="toast-stack" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.type}`}>
            {t.message}
          </div>
        ))}
      </div>
    </AppCtx.Provider>
  );
}
