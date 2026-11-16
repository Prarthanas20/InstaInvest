import { NextResponse } from "next/server";
import { analyzeStatement } from "../../../lib/advisor";

// Advisory engine — analyzes the (simulated) AA statement: detects the salary,
// flags hikes vs the prior period, computes investable surplus and generates
// an age-tuned mutual fund / stock allocation plan.
//
// Demo disclaimer: algorithmic output, not SEBI-registered investment advice.

export async function POST(req) {
  let b = {};
  try {
    b = await req.json();
  } catch {}

  const age = Number(b.age);
  if (!(age >= 18 && age <= 80)) {
    return NextResponse.json({ error: "Age must be between 18 and 80" }, { status: 400 });
  }
  if (!b.statement?.months?.length) {
    return NextResponse.json({ error: "No bank statement available — connect a bank first" }, { status: 400 });
  }

  return NextResponse.json({ source: "server", age, ...analyzeStatement(b.statement, age) });
}
