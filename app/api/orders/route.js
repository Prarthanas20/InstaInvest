import { NextResponse } from "next/server";
import { round2 } from "../../../lib/fees";

// Order placement — mock OMS front door.
// Production: the API gateway enforces JWT auth + AES-256 payloads and routes
// the order to the exchange over a FIX session (not REST). Here we return an
// OPEN ack with the FIX tag payload we would emit.

// PRD: gateway rate limit — max 50 order requests per minute per user.
// Serverless note: this in-memory limiter is per-instance; a real deployment
// enforces this at the API gateway edge.
const WINDOW_MS = 60_000;
const MAX_REQ = 50;
const hits = new Map();

function rateLimited(key) {
  const now = Date.now();
  const recent = (hits.get(key) || []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(key, recent);
  return recent.length > MAX_REQ;
}

export async function POST(req) {
  const ip = (req.headers.get("x-forwarded-for") || "local").split(",")[0].trim();
  if (rateLimited(ip)) {
    return NextResponse.json(
      { error: "Rate limit exceeded (50 orders/min). Please slow down." },
      { status: 429 }
    );
  }

  let b = {};
  try {
    b = await req.json();
  } catch {}

  const symbol = String(b.symbol || "").toUpperCase();
  const side = b.side === "sell" ? "sell" : "buy";
  const type = b.type === "limit" ? "limit" : "market";
  const exchange = b.exchange === "BSE" ? "BSE" : "NSE";
  const qty = Math.floor(Number(b.qty));
  const price = Number(b.price);

  if (!symbol || !(qty > 0) || !(price > 0)) {
    return NextResponse.json({ error: "Invalid order payload" }, { status: 400 });
  }

  // Market orders fill with tiny slippage; limit orders fill only at the limit price.
  const slippage = Math.random() * 0.0006;
  const fillPrice =
    type === "limit" ? round2(price) : round2(price * (1 + (side === "buy" ? slippage : -slippage)));

  const placedAt = Date.now();
  const ETA_MS = 2500; // time in the exchange order book before the execution callback

  // The order id carries its own state so any serverless instance can resolve
  // status deterministically (mirrors the async OPEN → EXECUTED callback flow).
  const payload = { s: symbol, sd: side, q: qty, ty: type, ex: exchange, fp: fillPrice, t: placedAt, eta: ETA_MS };
  const orderId = Buffer.from(JSON.stringify(payload)).toString("base64url");

  return NextResponse.json({
    orderId,
    status: "OPEN",
    placedAt,
    etaMs: ETA_MS,
    fillPrice,
    venue: exchange,
    routing: `FIX 4.4 · 8=FIX4.4|35=D|55=${symbol}|54=${side === "buy" ? 1 : 2}|38=${qty}|39=0`,
  });
}
