import { createHmac, timingSafeEqual } from "crypto";

const BOM   = String.fromCharCode(65279);
const clean = (v: string | undefined) => (v || "").replace(new RegExp("^" + BOM), "").trim();

// Reuses the service-role key as the HMAC secret — already configured in every
// environment that can reach these routes, same pattern as lib/unsubscribe-token.ts.
const SECRET = clean(process.env.SUPABASE_SERVICE_ROLE_KEY);

// /api/pilot previously activated the 35-day Pro trial straight from an
// unauthenticated POST keyed only on a submitted email address — anyone who
// knew a registered user's email could trigger it on their behalf. The token
// makes the emailed link itself the credential: only whoever controls that
// inbox can complete activation. Expiry (unlike the permanent unsubscribe
// token) bounds how long a leaked/forwarded link stays exploitable.
const PILOT_TOKEN_TTL_MS = 72 * 3600_000;

function sign(profileId: string, expiresAt: number): string {
  return createHmac("sha256", SECRET).update(`${profileId}:${expiresAt}`).digest("hex").slice(0, 32);
}

export function buildPilotConfirmToken(profileId: string): { token: string; expiresAt: number } {
  const expiresAt = Date.now() + PILOT_TOKEN_TTL_MS;
  return { token: sign(profileId, expiresAt), expiresAt };
}

export function verifyPilotToken(profileId: string, expiresAt: number, token: string): boolean {
  if (!token || !expiresAt || !Number.isFinite(expiresAt)) return false;
  if (Date.now() > expiresAt) return false;
  const expected = sign(profileId, expiresAt);
  const a = Buffer.from(expected);
  const b = Buffer.from(token);
  return a.length === b.length && timingSafeEqual(a, b);
}
