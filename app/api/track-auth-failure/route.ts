import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase-service";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { isSystemAuthError } from "@/lib/auth-failure-classify";

export const dynamic = "force-dynamic";

// Unlike /api/track, this is reachable by visitors who have no session:
// nobody has one yet at the moment their own signup/login attempt just
// failed. Rate-limited instead of auth-gated so it can't become an
// unauthenticated write oracle: generous enough for a real person retrying a
// mistyped password a few times, tight enough to bound abuse.
const RATE_LIMIT = { limit: 20, windowMs: 60 * 60 * 1000 };

const ALLOWED_FLOWS = new Set(["signup", "login"]);
const ALLOWED_METHODS = new Set(["email", "password", "otp"]);

const MAX_FIELD_LEN = 100;

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const rl = await rateLimit(`track-auth-failure:${ip}`, RATE_LIMIT);
  if (!rl.allowed) {
    return NextResponse.json({ ok: false }, { status: 429 });
  }

  const body = await req.json().catch(() => null) as
    { flow?: unknown; method?: unknown; errorCode?: unknown; emailDomain?: unknown } | null;

  const flow = body?.flow;
  const method = body?.method;
  if (typeof flow !== "string" || !ALLOWED_FLOWS.has(flow)) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  if (typeof method !== "string" || !ALLOWED_METHODS.has(method)) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const errorCode = typeof body?.errorCode === "string" && body.errorCode
    ? body.errorCode.slice(0, MAX_FIELD_LEN)
    : "unknown";

  // Domain only, never the full address: the person this fires for has no
  // account and gave no consent to be identified. See the RGPD trade-off in
  // marketing/product-ideas-log.md, 2026-08-04, idea 1.
  const emailDomain = typeof body?.emailDomain === "string" && body.emailDomain
    ? body.emailDomain.slice(0, MAX_FIELD_LEN).toLowerCase()
    : null;

  await getServiceClient().from("auth_failures").insert({
    flow,
    method,
    error_code: errorCode,
    email_domain: emailDomain,
    is_system: isSystemAuthError(errorCode),
  });

  return NextResponse.json({ ok: true });
}
