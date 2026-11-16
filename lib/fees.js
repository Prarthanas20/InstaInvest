// Pre-trade fee engine.
// Mirrors the transparent charge schedule from the PRD: Brokerage, STT,
// Exchange transaction charges, SEBI fees, GST, Stamp duty and CDSL DP charges.
// Schedule = Indian discount-broker equity *delivery* (CNC) rates.

export const FEE_SCHEDULE = {
  brokeragePct: 0.0003, // 0.03% of turnover
  brokerageCap: 20, // capped at ₹20 per order
  sttPct: 0.001, // 0.1% — both buy & sell (delivery)
  exchangePct: { NSE: 0.0000297, BSE: 0.0000375 },
  sebiPct: 0.000001, // ₹10 per crore
  gstPct: 0.18, // 18% on (brokerage + exchange + SEBI)
  stampDutyPct: 0.00015, // 0.015% — buy side only
  dpCharges: 15.93, // CDSL ₹13.5 + GST per scrip — sell side only
};

export const round2 = (n) => Math.round(n * 100) / 100;

export function calcFees({ price, qty, side, exchange = "NSE" }) {
  const turnover = round2(price * qty);
  const brokerage = Math.min(round2(turnover * FEE_SCHEDULE.brokeragePct), FEE_SCHEDULE.brokerageCap);
  const stt = round2(turnover * FEE_SCHEDULE.sttPct);
  const exchangeCharges = round2(turnover * (FEE_SCHEDULE.exchangePct[exchange] ?? FEE_SCHEDULE.exchangePct.NSE));
  const sebiCharges = round2(turnover * FEE_SCHEDULE.sebiPct);
  const gst = round2((brokerage + exchangeCharges + sebiCharges) * FEE_SCHEDULE.gstPct);
  const stampDuty = side === "buy" ? round2(turnover * FEE_SCHEDULE.stampDutyPct) : 0;
  const dpCharges = side === "sell" ? FEE_SCHEDULE.dpCharges : 0;
  const totalCharges = round2(brokerage + stt + exchangeCharges + sebiCharges + gst + stampDuty + dpCharges);
  return {
    turnover,
    brokerage,
    stt,
    exchangeCharges,
    sebiCharges,
    gst,
    stampDuty,
    dpCharges,
    totalCharges,
    totalDebit: side === "buy" ? round2(turnover + totalCharges) : null,
    netProceeds: side === "sell" ? round2(turnover - totalCharges) : null,
  };
}
