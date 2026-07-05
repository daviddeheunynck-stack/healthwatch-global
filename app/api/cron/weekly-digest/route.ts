import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { buildDigestEmail } from "@/lib/digest-email";
import type { Outbreak } from "@/lib/outbreaks";
import * as Sentry from "@sentry/nextjs";
import { logCronRun } from "@/lib/cron-monitor";
import { sendBrevoEmail } from "@/lib/email";

export const dynamic = "force-dynamic";

// Strip BOM (U+FEFF = char code 65279) and whitespace from env vars.
const BOM = String.fromCharCode(65279);
const clean = (val: string | undefined) =>
  (val || "").replace(new RegExp("^" + BOM), "").trim();

const SUPABASE_URL       = clean(process.env.NEXT_PUBLIC_SUPABASE_URL);
const SUPABASE_SERVICE_KEY = clean(process.env.SUPABASE_SERVICE_ROLE_KEY);

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

  // ── High-risk outbreaks from the past 7 days ───────────────────────────────
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data: outbreaks, error: outbreakError } = await supabase
    .from("outbreaks")
    .select("*")
    .eq("active", true)
    .eq("risk_level", "high")
    .gte("date", sevenDaysAgo)
    .order("date", { ascending: false })
    .limit(50); // safety cap before per-subscriber filtering

  if (outbreakError) {
    console.error("[weekly-digest] Failed to fetch outbreaks:", outbreakError);
    return NextResponse.json({ error: outbreakError.message }, { status: 500 });
  }

  const allOutbreaks: Outbreak[] = outbreaks ?? [];
  console.log(`[weekly-digest] ${allOutbreaks.length} high-risk outbreaks in the past 7 days`);

  // ── Send loop ──────────────────────────────────────────────────────────────
  let sent   = 0;
  let failed = 0;

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
      await sendBrevoEmail({ to: sub.email, subject, html });
      sent++;
    } catch (err) {
      console.error(`[weekly-digest] Failed to send to ${sub.email}:`, err);
      Sentry.captureException(err, { tags: { cron: "weekly-digest", sub_id: sub.id } });
      failed++;
    }

    // Throttle to stay within Brevo rate limits
    await new Promise((r) => setTimeout(r, 150));
  }

  await logCronRun(supabase, "weekly-digest", "ok", sent);
  console.log(`[weekly-digest] Done — ${sent} sent, ${failed} failed, ${subscribers.length} total.`);
  return NextResponse.json({ sent, failed, total: subscribers.length });
}
