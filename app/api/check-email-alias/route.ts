import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase-service";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

// Supabase Auth treats john.doe@gmail.com, johndoe@gmail.com and
// john+trial@gmail.com as three distinct accounts, even though Gmail
// delivers all three to the same inbox — each would otherwise qualify for
// its own fresh 14-day Pro trial (activateTrial()'s idempotence guard in
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
  const { data, error } = await admin.from("profiles").select("email");
  if (error) {
    console.error("[check-email-alias] profiles lookup failed:", error);
    // Fail open: a lookup outage must never block a real signup over an
    // abuse check that's a soft product guard, not a security boundary.
    return NextResponse.json({ alreadyRegistered: false });
  }

  const target = normalizeEmail(email);
  const alreadyRegistered = (data ?? []).some((p) => p.email && normalizeEmail(p.email) === target);

  return NextResponse.json({ alreadyRegistered });
}
