import { NextResponse } from "next/server";

// Execution callback resolver — stands in for the exchange → OMS execution
// report. An order placed at time t flips from OPEN to EXECUTED after its
// declared ETA; the client's WebSocket-style poller picks it up and alerts the user.

export async function GET(req, { params }) {
  let p;
  try {
    p = JSON.parse(Buffer.from(params.id, "base64url").toString("utf8"));
  } catch {
    return NextResponse.json({ error: "Unknown order" }, { status: 404 });
  }

  const elapsed = Date.now() - p.t;
  const status = elapsed >= (p.eta || 2500) ? "EXECUTED" : "OPEN";

  return NextResponse.json({
    id: params.id,
    status,
    symbol: p.s,
    side: p.sd,
    qty: p.q,
    type: p.ty,
    exchange: p.ex,
    placedAt: p.t,
    fillPrice: p.fp,
    executionReport:
      status === "EXECUTED"
        ? "8=FIX4.4|35=8|39=2 (Filled)"
        : "8=FIX4.4|35=8|39=0 (New, resting in order book)",
  });
}
