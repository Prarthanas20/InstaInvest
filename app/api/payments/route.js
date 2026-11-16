import { NextResponse } from "next/server";

// Fund addition — mock of the Razorpay/PayU initiation (User flow: Add funds).
// Production: REST initiation here, then an async payment.captured webhook
// credits the user's ledger and pushes a notification.

export async function POST(req) {
  let b = {};
  try {
    b = await req.json();
  } catch {}

  const amount = Math.round(Number(b.amount));
  if (!(amount >= 100) || amount > 1_000_000) {
    return NextResponse.json({ error: "Amount must be between ₹100 and ₹10,00,000" }, { status: 400 });
  }

  const method = b.method === "netbanking" ? "netbanking" : "upi";

  return NextResponse.json({
    ok: true,
    paymentId: `pay_${Math.random().toString(36).slice(2, 12)}`,
    gateway: method === "upi" ? "Razorpay · UPI" : "PayU · Netbanking",
    status: "INITIATED",
    amount,
  });
}
