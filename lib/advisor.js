// Smart Money Insights — bank statement analyzer (demo).
// Production: statements arrive read-only via the RBI Account Aggregator
// framework; here we generate a realistic 12-month statement and analyze it.

import { round2 } from "./fees";

const median = (arr) => {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
};

// ── Mock AA statement ──────────────────────────────────────────────────────
// 12 months of salary credits, rent, EMI, UPI spends — with a salary hike
// three months ago (₹58,500 → ₹66,500, ≈ +13.7%).
export function generateStatement() {
  const now = new Date();
  const N = 12;
  const months = [];
  let balance = 90000;

  for (let i = N - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const idx = N - 1 - i; // 0 = oldest
    const salary = idx >= 9 ? 66500 : 58500; // hike 3 months ago
    const rent = 19500;
    const emi = 14800;
    const spends = Math.round(9800 + Math.sin(idx * 2.1) * 1600 + Math.random() * 500);
    const otherCredits = Math.random() < 0.25 ? Math.round(Math.random() * 3000) : 0;
    balance = Math.round(balance + salary + otherCredits - rent - emi - spends);
    months.push({
      label: `${d.toLocaleString("en-IN", { month: "short" })} ${String(d.getFullYear()).slice(2)}`,
      salary,
      rent,
      emi,
      spends,
      otherCredits,
      balance,
    });
  }
  return { source: "Account Aggregator (simulated)", generatedAt: Date.now(), months };
}

// ── Analyzer ───────────────────────────────────────────────────────────────
export function analyzeStatement(statement, age) {
  const months = statement?.months || [];
  const salaries = months.filter((m) => m.salary > 0).map((m) => m.salary);

  // Salary detection + hike detection: median of last 3 vs prior months.
  const salary = salaries.length ? median(salaries.slice(-3)) : 0;
  const priorSalary =
    salaries.length >= 6
      ? median(salaries.slice(-9, -3))
      : salaries.length > 3
        ? median(salaries.slice(0, salaries.length - 3))
        : salary;
  const hikePct = priorSalary > 0 ? round2(((salary - priorSalary) / priorSalary) * 100) : 0;
  const hikeAmount = Math.max(0, salary - priorSalary);

  let hikeIndex = -1;
  for (let i = 1; i < salaries.length; i++) {
    if (salaries[i] > salaries[i - 1]) {
      hikeIndex = i;
      break;
    }
  }

  // Surplus: average monthly outflows (rent + EMI + spends) vs current salary.
  const debitMonths = months.map((m) => (m.rent || 0) + (m.emi || 0) + (m.spends || 0) + (m.otherDebits || 0));
  const avgExpenses = Math.round(debitMonths.reduce((a, b) => a + b, 0) / Math.max(1, debitMonths.length));
  const surplus = Math.max(0, salary - avgExpenses);
  const savingsRate = salary > 0 ? round2((surplus / salary) * 100) : 0;

  const liquid = months.length ? months[months.length - 1].balance : 0;
  const emergencyMonths = avgExpenses > 0 ? round2(liquid / avgExpenses) : 0;

  // Age-tuned split: classic "100 − age" equity rule with guardrails (35–80%).
  const equityPct = Math.min(80, Math.max(35, 100 - age));
  const investable = Math.max(500, Math.round((surplus * 0.5) / 500) * 500); // invest ~50% of surplus

  const equityBucket = Math.round((investable * equityPct) / 100);
  const stockBucket = Math.round((equityBucket * 0.15) / 100) * 100;
  const mfEquity = equityBucket - stockBucket;
  const debtBucket = investable - equityBucket;

  const funds = [
    {
      name: "Nifty 50 Index Fund — Direct",
      category: "Equity · Large Cap",
      amount: Math.max(500, Math.round((mfEquity * 0.5) / 100) * 100),
      why: "Ultra-low cost, market returns — the core of your equity SIP.",
    },
    {
      name: "Flexi Cap Fund — Direct",
      category: "Equity · Diversified",
      amount: Math.max(500, Math.round((mfEquity * 0.35) / 100) * 100),
      why: "Active manager rotates across market caps to chase opportunity.",
    },
    {
      name: "ELSS Tax Saver — Direct",
      category: "Equity · 80C",
      amount: Math.max(500, Math.round((mfEquity * 0.15) / 100) * 100),
      why: "Section 80C deduction with a 3-year lock-in.",
    },
    {
      name: "Short Duration Debt Fund — Direct",
      category: "Debt",
      amount: debtBucket,
      why: "Stability + liquidity for goals under 3 years.",
    },
  ].filter((f) => f.amount >= 500);

  const stocks = [
    {
      symbol: "RELIANCE",
      name: "Reliance Industries",
      amount: Math.round(stockBucket / 2 / 100) * 100,
      why: "Blue-chip compounder — energy, retail & telecom earnings.",
    },
    {
      symbol: "HDFCBANK",
      name: "HDFC Bank",
      amount: Math.round(stockBucket / 2 / 100) * 100,
      why: "Banking heavyweight — rides India's credit growth.",
    },
  ].filter((s) => s.amount >= 100);

  // Lifestyle-creep guard: suggest a step-up equal to the hike's SIP share.
  const sipStepUp = hikePct >= 8 ? Math.round((investable * (hikePct / 100)) / 500) * 500 : 0;

  return {
    salary,
    priorSalary,
    hikePct,
    hikeAmount,
    hikeIndex,
    avgExpenses,
    surplus,
    savingsRate,
    liquid,
    emergencyMonths,
    emergencyGap: Math.max(0, Math.round(6 * avgExpenses - liquid)),
    equityPct,
    investable,
    funds,
    stocks,
    sipStepUp,
    months,
  };
}
