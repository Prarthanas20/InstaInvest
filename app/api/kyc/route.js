import { NextResponse } from "next/server";

// Omnichannel KYC — mock of the DigiLocker/UIDAI + CKYC Registry flow (User Story 3).
// Production: PAN/Aadhaar payloads arrive AES-256 encrypted via the API gateway,
// verified with UIDAI REST APIs (authorized AUA), then matched against the CKYC registry.

const PAN_RE = /^[A-Z]{5}[0-9]{4}[A-Z]$/;

const b64url = (obj) => Buffer.from(JSON.stringify(obj)).toString("base64url");

// Shape of a stateless gateway JWT (Access Token, 30-min TTL per PRD).
function issueToken(payload) {
  const header = { alg: "ES256", typ: "JWT", kid: "instainvest-gateway-1" };
  return `${b64url(header)}.${b64url(payload)}.${b64url({ note: "demo-signature" })}`;
}

export async function POST(req) {
  let body = {};
  try {
    body = await req.json();
  } catch {}

  const pan = String(body.pan || "").toUpperCase().trim();
  const otp = String(body.otp || "").trim();

  if (!PAN_RE.test(pan)) {
    return NextResponse.json({ error: "Invalid PAN format (e.g. ABCDE1234F)" }, { status: 400 });
  }
  if (!/^[0-9]{6}$/.test(otp)) {
    return NextResponse.json({ error: "Enter the 6-digit Aadhaar OTP" }, { status: 400 });
  }

  const iat = Math.floor(Date.now() / 1000);
  return NextResponse.json({
    ok: true,
    name: "Investor",
    kycStatus: "VERIFIED",
    method: "DigiLocker / UIDAI OTP (demo)",
    ckycId: `CKYCR-${pan.slice(0, 3)}${Math.floor(1000 + Math.random() * 9000)}`,
    token: issueToken({
      sub: `${pan.slice(0, 4)}***`,
      kyc: "VERIFIED",
      scope: "trade:equity",
      iat,
      exp: iat + 1800, // 30-minute access token
    }),
    refreshTokenTtlDays: 7,
  });
}
