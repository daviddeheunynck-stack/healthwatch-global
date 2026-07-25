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

// org/name ride along in the confirm URL's query string (?org=...&name=...) but,
// until now, weren't part of what the token signs — only profileId+expiresAt were.
// The link's recipient legitimately controls that URL (it's their inbox), but so
// does anything downstream that can rewrite a query string: a forwarded/edited
// link, an email client's link-preview rewriter, anyone re-sharing the link with
// tweaked params. Signing them means the server writes back exactly the org/name
// that was present when the email was sent, not whatever a tampered URL claims.
function sign(profileId: string, expiresAt: number, organization: string, name: string): string {
  return createHmac("sha256", SECRET)
    .update(`${profileId}:${expiresAt}:${organization}:${name}`)
    .digest("hex")
    .slice(0, 32);
}

export function buildPilotConfirmToken(
  profileId: string,
  organization: string,
  name: string
): { token: string; expiresAt: number } {
  const expiresAt = Date.now() + PILOT_TOKEN_TTL_MS;
  return { token: sign(profileId, expiresAt, organization, name), expiresAt };
}

export function verifyPilotToken(
  profileId: string,
  expiresAt: number,
  organization: string,
  name: string,
  token: string
): boolean {
  if (!token || !expiresAt || !Number.isFinite(expiresAt)) return false;
  if (Date.now() > expiresAt) return false;
  const expected = sign(profileId, expiresAt, organization, name);
  const a = Buffer.from(expected);
  const b = Buffer.from(token);
  return a.length === b.length && timingSafeEqual(a, b);
}
