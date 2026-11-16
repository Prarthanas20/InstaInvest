# InstaInvest ⚡

**Retail Wealth & Execution Module** — a mobile-first investing demo built from the InstaInvest PRD:
high-trust onboarding, transparent pre-trade fees and bite-sized education at the exact point of action.

> **Demo only.** Simulated market data, exchange routing and depository links. Not investment advice,
> no real money moves, no real orders are routed to NSE/BSE.

## Try it (demo flow)

1. **KYC** — enter any valid-format PAN (e.g. `ABCDE1234F`) → "Use demo PAN" link fills it. Enter **any 6-digit OTP**.
   Backend "validates" instantly (mock DigiLocker/UIDAI + CKYC lookup) and unlocks the dashboard.
2. **Add funds** — UPI-style payment sheet with an async `payment.captured` webhook simulation.
3. **Trade** — pick a stock → Buy/Sell → Market/Limit → quantity → the **pre-trade fee calculator** updates live →
   **Review Order** shows the full breakdown with **Estimated Net Proceeds highlighted in green** for sells.
4. **Order lifecycle** — confirm → status `OPEN` (FIX session simulation) → execution callback → `EXECUTED`
   with a real-time toast, holdings and ledger updates.

## PRD → feature map

| PRD item | Where |
| --- | --- |
| User Story 1: transparent sell flow (Brokerage, STT, DP + green net proceeds) | Trade screen → Review Order sheet |
| User Story 2: contextual Market vs Limit education (bottom sheet) | ⓘ icons next to Market / Limit |
| User Story 3: omnichannel KYC (PAN + Aadhaar OTP → instant activation) | Landing → 3-step onboarding |
| Fee calculator (Brokerage, STT, Exchange charges, SEBI, GST, Stamp, DP) | `lib/fees.js` + `POST /api/fees` |
| NSE vs BSE contextual tooltip | Exchange selector ⓘ |
| JWT gateway, AES-256 payloads, 50 req/min rate limit | `POST /api/orders` (rate limiter), `POST /api/kyc` (token shape) |
| FIX routing & execution callbacks (OPEN → EXECUTED) | `POST /api/orders`, `GET /api/orders/[id]` |
| Payment gateway webhooks (async ledger credit) | `/api/payments`, `/api/payments/webhook` |
| WebSocket market data | Simulated 1.5s push feed in `lib/store.js` |
| **Salary-hike detection & age-based recommendations** | Insights tab — bank statement analysis (`lib/advisor.js`), `POST /api/bank` (AA simulation), `POST /api/advisor` (hike %, surplus, age-tuned fund/stock SIPs) |

## Fee schedule (equity delivery, discount-broker style)

| Charge | Rate |
| --- | --- |
| Brokerage | 0.03% of turnover, capped ₹20 |
| STT | 0.1% (both sides) |
| Exchange charges | NSE 0.00297% · BSE 0.00375% |
| SEBI | ₹10 per crore |
| GST | 18% on brokerage + exchange + SEBI |
| Stamp duty | 0.015% (buy side) |
| DP charges | ₹13.5 + GST (CDSL, sell side) |

## Stack & structure

- **Next.js 14 (App Router) + React 18**, hand-rolled CSS design system (mobile-first phone shell).
- `lib/` — fee engine, simulated market data, client ledger (localStorage), order lifecycle store.
- `app/api/*` — mock microservices: `kyc`, `fees`, `orders`, `orders/[id]`, `payments`, `payments/webhook`.

## Run locally

```bash
npm install
npm run dev      # http://localhost:3000
```

## Deploy on Vercel

```bash
npx vercel link --project instainvest
npx vercel --prod
```

No environment variables required — all external systems (UIDAI, CKYC, FIX, Razorpay, CDSL) are simulated in-code.
