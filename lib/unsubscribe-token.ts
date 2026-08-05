import { createHmac, timingSafeEqual } from "crypto";

const BOM   = String.fromCharCode(65279);
const clean = (v: string | undefined) => (v || "").replace(new RegExp("^" + BOM), "").trim();

// Reuses the service-role key as the HMAC secret — it's already configured in every
// environment that can reach these routes, so this needs no new Vercel env var (a
// missing one would silently break every unsubscribe link in prod).
const SECRET = clean(process.env.SUPABASE_SERVICE_ROLE_KEY);

// /api/unsubscribe-signal previously trusted a bare profile UUID as its only
// credential — anyone who learned another user's UUID (exposed elsewhere by
// /api/team/members, /api/org/activity) could silently flip their display_filters.
// Signing the id with a secret only the server knows makes the link itself the
// credential, the same trust model as every other unauthenticated mutation link
// (Stripe webhooks, email unsubscribe standards).
export function signUnsubscribeToken(userId: string): string {
  return createHmac("sha256", SECRET).update(userId).digest("hex").slice(0, 32);
}

export function verifyUnsubscribeToken(userId: string, token: string): boolean {
  if (!token) return false;
  const expected = signUnsubscribeToken(userId);
  const a = Buffer.from(expected);
  const b = Buffer.from(token);
  return a.length === b.length && timingSafeEqual(a, b);
}

// Used by app/api/unsubscribe-alert/route.ts and the 3 crons that email an
// address the account owner typed in freely (country_risk_alerts,
// geofence_alerts, category_alerts). Composing kind+id into the signed
// subject means a token minted for one table's row can never verify against
// another table's row of the same id, even in principle — the 3 tables are
// separate UUID spaces, so this costs nothing and removes any doubt.
export type UnsubscribeAlertKind = "country_risk" | "geofence" | "category";

// `kind` is untyped `string` here (not UnsubscribeAlertKind): the verifying
// side (app/api/unsubscribe-alert/route.ts) parses it from an untrusted URL
// query param, so there's no literal to narrow to yet at that call site.
// buildUnsubscribeAlertUrl below keeps the literal type, since its callers
// (the 3 trigger-*-alerts crons) know their kind at compile time.
export function unsubscribeAlertTokenSubject(kind: string, id: string): string {
  return `${kind}:${id}`;
}

export function buildUnsubscribeAlertUrl(kind: UnsubscribeAlertKind, id: string, locale: string): string {
  const token = signUnsubscribeToken(unsubscribeAlertTokenSubject(kind, id));
  return `https://healthwatch-global.com/api/unsubscribe-alert?kind=${kind}&id=${id}&token=${token}&locale=${locale}`;
}
