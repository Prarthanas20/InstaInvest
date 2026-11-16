import { NextResponse } from "next/server";
import { calcFees } from "../../../lib/fees";

// Authoritative pre-trade fee calculator (PRD: transparent charges before order placement).
// The client shows an instant local estimate; this endpoint confirms the exact
// breakdown when the user taps "Review Order".

export async function POST(req) {
  let b = {};
  try {
    b = await req.json();
  } catch {}

  const price = Number(b.price);
  const qty = Math.floor(Number(b.qty));
  const side = b.side === "sell" ? "sell" : "buy";
  const exchange = b.exchange === "BSE" ? "BSE" : "NSE";

  if (!(price > 0) || !(qty > 0) || !Number.isFinite(price * qty)) {
    return NextResponse.json({ error: "Enter a valid quantity and price" }, { status: 400 });
  }

  return NextResponse.json({
    source: "server",
    side,
    exchange,
    ...calcFees({ price, qty, side, exchange }),
  });
}
