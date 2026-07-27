import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { buildDigestEmail } from "@/lib/digest-email";
import type { Outbreak } from "@/lib/outbreaks";
import * as Sentry from "@sentry/nextjs";
import { logCronRun, isRealProduction } from "@/lib/cron-monitor";

export const dynamic = "force-dynamic";

// Strip BOM (U+FEFF = char code 65279) and whitespace from env vars.
const BOM = String.fromCharCode(65279);
const clean = (val: string | undefined) =>
  (val || "").replace(new RegExp("^" + BOM), "").trim();

const BREVO_API_KEY      = clean(process.env.BREVO_API_KEY);
const SUPABASE_URL       = clean(process.env.NEXT_PUBLIC_SUPABASE_URL);
const SUPABASE_SERVICE_KEY = clean(process.env.SUPABASE_SERVICE_ROLE_KEY);

// Returns whether the email was actually sent, so callers don't count a
// skipped-for-missing-key send as a real one (found 2026-07-15 audit: sent++
// used to run unconditionally after this call regardless of the outcome).
async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  if (!BREVO_API_KEY) {
    console.warn("[weekly-digest] BREVO_API_KEY not set — skipping send");
    return false;
  }
  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    signal: AbortSignal.timeout(10_000),
    headers: {
      "api-key": BREVO_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      sender: { name: "HealthWatch Global", email: "alerts@healthwatch-global.com" },
      to: [{ email: to }],
      subject,
      htmlContent: html,
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Brevo error for ${to}: ${err}`);
  }
  return true;
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = clean(process.env.CRON_SECRET);

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error("[weekly-digest] Missing env: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    return NextResponse.json({ error: "env:missing" }, { status: 500 });
  }
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  // ── Active subscribers only ────────────────────────────────────────────────
  const { data: subscribers, error: subError } = await supabase
    .from("subscriptions")
    .select("id, email, region, locale")
    .eq("active", true);

  if (subError) {
    console.error("[weekly-digest] Failed to fetch subscribers:", subError);
    return NextResponse.json({ error: subError.message }, { status: 500 });
  }

  if (!subscribers || subscribers.length === 0) {
    console.log("[weekly-digest] No active subscribers — nothing to send.");
    await logCronRun(supabase, "weekly-digest", "ok", 0);
    return NextResponse.json({ message: "No active subscribers.", sent: 0 });
  }

  // ── High-risk active outbreaks ──────────────────────────────────────────────
  // No recency window: HWG's real sources update on wildly different cadences
  // (WHO DON vs monthly cholera bulletins vs static risk assessments), so a
  // 7-day cutoff let through only whichever single outbreak happened to get a
  // source refresh that week, starving the digest to ~1 item per send.
  // is_seed/is_backfill rows are excluded because they aren't live signals —
  // manually-curated baselines or cumulative archives (USDA APHIS's HPAI
  // crosstab, WHO GHO annual indicators) — same exclusion rule as
  // lib/reporting-lag.ts, applied here for the same reason.
  const { data: outbreaks, error: outbreakError } = await supabase
    .from("outbreaks")
    .select("*")
    .eq("active", true)
    .eq("risk_level", "high")
    .eq("is_seed", false)
    .eq("is_backfill", false)
    .order("date", { ascending: false })
    .limit(50); // safety cap before per-subscriber filtering

  if (outbreakError) {
    console.error("[weekly-digest] Failed to fetch outbreaks:", outbreakError);
    return NextResponse.json({ error: outbreakError.message }, { status: 500 });
  }

  const allOutbreaks: Outbreak[] = outbreaks ?? [];
  console.log(`[weekly-digest] ${allOutbreaks.length} high-risk active outbreaks`);

  // ── Send loop ──────────────────────────────────────────────────────────────
  let sent        = 0;
  let failed      = 0;
  let skippedNoKey = 0;

  for (const sub of subscribers) {
    try {
      const locale = sub.locale || "en";
      const region = sub.region || "allRegions";

      // Filter outbreaks to the subscriber's region preference
      const regionOutbreaks = region === "allRegions"
        ? allOutbreaks
        : allOutbreaks.filter((o) => o.region === region);

      // Cap at 8 outbreaks per email — keeps the email scannable
      const topOutbreaks = regionOutbreaks.slice(0, 8);

      const { subject, html } = buildDigestEmail(topOutbreaks, region, locale, sub.id);
      if (isRealProduction) {
        const ok = await sendEmail(sub.email, subject, html);
        if (ok) sent++; else skippedNoKey++;
      } else {
        sent++;
      }
    } catch (err) {
      console.error(`[weekly-digest] Failed to send to ${sub.email}:`, err);
      Sentry.captureException(err, { tags: { cron: "weekly-digest", sub_id: sub.id } });
      failed++;
    }

    // Throttle to stay within Brevo rate limits
    await new Promise((r) => setTimeout(r, 150));
  }

  await logCronRun(supabase, "weekly-digest", skippedNoKey > 0 ? "error" : "ok", sent);
  console.log(`[weekly-digest] Done — ${sent} sent, ${failed} failed, ${skippedNoKey} skipped (no key), ${subscribers.length} total.`);
  return NextResponse.json({ sent, failed, skippedNoKey, total: subscribers.length });
}
