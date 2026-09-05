import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { getServiceClient } from "@/lib/supabase-service";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

// Supabase Auth treats john.doe@gmail.com, johndoe@gmail.com and
// john+trial@gmail.com as three distinct accounts, even though Gmail
// delivers all three to the same inbox — each would otherwise qualify for
// its own fresh 7-day Pro trial (activateTrial()'s idempotence guard in
// lib/activate-trial.ts only blocks reactivation on the SAME account).
// Audited 2026-08-19: not yet exploited in the real user base, but nothing
// stopped it. This treats the local part as a Gmail-style alias only for
// gmail.com/googlemail.com (the provider that actually ignores dots) and
// strips a "+tag" suffix everywhere, since that convention is universal.
function normalizeEmail(email: string): string {
  const [rawLocal, rawDomain] = email.toLowerCase().trim().split("@");
  if (!rawDomain) return email.toLowerCase().trim();
  const local = rawLocal.split("+")[0];
  if (rawDomain === "gmail.com" || rawDomain === "googlemail.com") {
    return `${local.replace(/\./g, "")}@gmail.com`;
  }
  return `${local}@${rawDomain}`;
}

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const rl = await rateLimit(`check-email-alias:${ip}`, { limit: 20, windowMs: 10 * 60 * 1000 });
  if (!rl.allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const body = await req.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email : null;
  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "Invalid email" }, { status: 400 });
  }

  const admin = getServiceClient();
  const target = normalizeEmail(email);

  // An unfiltered `.select("email")` is silently capped by PostgREST at
  // db.max_rows (1000 on Supabase's default): past that row count this check
  // would stop seeing the tail of the table and quietly permit exactly the
  // re-signups it exists to block — no error, no log, no way to notice.
  // Page through explicitly instead. `.order("id")` is required, not
  // cosmetic: `.range()` without an ORDER BY has no guaranteed row order
  // between requests, so pages could overlap or skip rows. Same .range()
  // idiom as app/api/notifications/route.ts.
  const PAGE_SIZE = 1000;
  const MAX_PAGES = 50; // 50k profiles — far above any plausible near-term size
  let alreadyRegistered = false;
  let exhausted = true;

  for (let page = 0; page < MAX_PAGES; page++) {
    const { data, error } = await admin
      .from("profiles")
      .select("email")
      .order("id")
      .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);

    if (error) {
      console.error("[check-email-alias] profiles lookup failed:", error);
      // Fail open: a lookup outage must never block a real signup over an
      // abuse check that's a soft product guard, not a security boundary.
      return NextResponse.json({ alreadyRegistered: false });
    }

    const rows = data ?? [];
    if (rows.some((p) => p.email && normalizeEmail(p.email) === target)) {
      alreadyRegistered = true;
      break;
    }
    if (rows.length < PAGE_SIZE) break;
    if (page === MAX_PAGES - 1) exhausted = false;
  }

  // Hitting the page cap means the scan was incomplete and the "not
  // registered" answer below is unproven. Still fails open (same reason as
  // the error branch above), but never silently — the whole point of the
  // pagination is that a partial scan leaves a trace.
  if (!exhausted && !alreadyRegistered) {
    Sentry.captureMessage(
      `[check-email-alias] profiles exceeds ${MAX_PAGES * PAGE_SIZE} rows — alias scan incomplete, answering "not registered" unverified`,
      "warning",
    );
  }

  return NextResponse.json({ alreadyRegistered });
}
