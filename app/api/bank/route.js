import { NextResponse } from "next/server";
import { generateStatement } from "../../../lib/advisor";

// Bank connect — mock of the RBI Account Aggregator (AA) flow.
// Production: the user consents in the AA app, the FIP pushes an encrypted,
// read-only statement to our backend. Nothing write-access, nothing stored raw.

export async function POST(req) {
  let b = {};
  try {
    b = await req.json();
  } catch {}

  if (!b.consent) {
    return NextResponse.json({ error: "User consent required before data fetch" }, { status: 403 });
  }

  const statement = generateStatement();

  return NextResponse.json({
    ok: true,
    accountLabel: "HDFC Bank ••4821",
    consentId: `AA-${Math.random().toString(36).slice(2, 10).toUpperCase()}`,
    framework: "RBI Account Aggregator (simulated)",
    fetchedAt: Date.now(),
    statement,
  });
}
