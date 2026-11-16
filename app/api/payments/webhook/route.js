import { NextResponse } from "next/server";

// Mock webhook receiver for the payment gateway (asynchronous callbacks per PRD).
// The gateway POSTs payment.captured here; the backend verifies it and credits
// the user's ledger balance.

export async function POST(req) {
  let b = {};
  try {
    b = await req.json();
  } catch {}

  if (b.event !== "payment.captured" || !b.paymentId) {
    return NextResponse.json({ error: "Unhandled webhook event" }, { status: 400 });
  }

  // Production: verify the gateway's HMAC signature before crediting anything.
  return NextResponse.json({
    ok: true,
    verified: true,
    paymentId: b.paymentId,
    amount: Number(b.amount) || 0,
    ledger: "credited",
  });
}
