// Simulated market data.
// In production this arrives over a persistent wss:// WebSocket pushed by the
// market-data service (ticks streamed to the client, never polled).

export const STOCKS = [
  { symbol: "RELIANCE", name: "Reliance Industries", prevClose: 1419.4 },
  { symbol: "TCS", name: "Tata Consultancy Services", prevClose: 3146.0 },
  { symbol: "HDFCBANK", name: "HDFC Bank", prevClose: 1762.35 },
  { symbol: "INFY", name: "Infosys", prevClose: 1612.8 },
  { symbol: "TATAMOTORS", name: "Tata Motors", prevClose: 754.6 },
  { symbol: "SBIN", name: "State Bank of India", prevClose: 871.15 },
  { symbol: "ITC", name: "ITC Ltd", prevClose: 468.9 },
  { symbol: "LT", name: "Larsen & Toubro", prevClose: 3654.0 },
  { symbol: "BHARTIARTL", name: "Bharti Airtel", prevClose: 1974.5 },
  { symbol: "ZOMATO", name: "Zomato Ltd", prevClose: 268.4 },
];

const round2 = (n) => Math.round(n * 100) / 100;

// symbol -> { nse, bse, prevClose }
export function initialPrices() {
  const map = {};
  for (const s of STOCKS) {
    map[s.symbol] = {
      nse: round2(s.prevClose * 1.0006),
      bse: round2(s.prevClose * 1.001),
      prevClose: s.prevClose,
    };
  }
  return map;
}

// Small random-walk tick for a single venue price.
export function tickPrice(p) {
  const drift = (Math.random() - 0.48) * 0.0016; // mild upward bias
  return p * (1 + drift);
}

export const clampAroundPrevClose = (p, prevClose) => {
  const lo = prevClose * 0.97;
  const hi = prevClose * 1.03;
  return Math.min(hi, Math.max(lo, p));
};

export const roundPrice = round2;
