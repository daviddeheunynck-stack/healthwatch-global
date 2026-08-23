import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { buildDigestEmail } from "@/lib/digest-email";
import type { Outbreak } from "@/lib/outbreaks";
import * as Sentry from "@sentry/nextjs";
import { logCronRun, isRealProduction, claimWeeklyDigestSend, claimWeeklyAddress, currentWeekOf } from "@/lib/cron-monitor";
import { getWeeklySuppressionSet } from "@/lib/mail-suppression";
import { sendBrevoEmail } from "@/lib/brevo-send";

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
async function sendEmail(to: string, subject: string, html: string, unsubscribeUrl?: string): Promise<boolean> {
  if (!BREVO_API_KEY) {
    console.warn("[weekly-digest] BREVO_API_KEY not set — skipping send");
    return false;
  }
  await sendBrevoEmail({ to, subject, html, apiKey: BREVO_API_KEY, unsubscribeUrl });
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

  // Defensive wrapper: an uncaught exception anywhere before or between the
  // fetches/loop below (only the per-subscriber send has a local try/catch)
  // used to propagate straight out — bare 500, no Sentry event, logCronRun
  // never reached. Same root cause as the sync-outbreaks incident of
  // 2026-07-29.
  try {
    return await runWeeklyDigest(req, supabase);
  } catch (err) {
    console.error("[weekly-digest] uncaught exception:", err);
    Sentry.captureException(err, { tags: { cron: "weekly-digest" } });
    await logCronRun(supabase, "weekly-digest", "error", 0,
      err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

async function runWeeklyDigest(_req: NextRequest, supabase: SupabaseClient) {
  // ── Active subscribers only ────────────────────────────────────────────────
  const { data: subscribers, error: subError } = await supabase
    .from("subscriptions")
    .select("id, email, region, locale")
    .eq("active", true);

  if (subError) {
    console.error("[weekly-digest] Failed to fetch subscribers:", subError);
    Sentry.captureException(subError, { tags: { cron: "weekly-digest" } });
    await logCronRun(supabase, "weekly-digest", "error", 0, subError.message);
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
    Sentry.captureException(outbreakError, { tags: { cron: "weekly-digest" } });
    await logCronRun(supabase, "weekly-digest", "error", 0, outbreakError.message);
    return NextResponse.json({ error: outbreakError.message }, { status: 500 });
  }

  const allOutbreaks: Outbreak[] = outbreaks ?? [];
  console.log(`[weekly-digest] ${allOutbreaks.length} high-risk active outbreaks`);

  // subscriptions.email is a free-text newsletter address, not a profiles row.
  // Was matched against the Brevo blocklist alone, which is why an in-product
  // unsubscribe (display_filters.no_weekly_signal, written by weekly-signal's
  // own unsubscribe link) never stopped this digest. Now the union of all four
  // opt-out signals — see lib/weekly-mail-suppression.ts.
  const { emails: suppressionSet, degraded: suppressionDegraded } =
    await getWeeklySuppressionSet(supabase);

  // ── Send loop ──────────────────────────────────────────────────────────────
  let sent        = 0;
  let failed      = 0;
  let skippedNoKey = 0;
  let blockedSkipped = 0;
  let alreadySent  = 0;
  let claimedElsewhere = 0;
  let claimDegraded = false;

  // One claim per (subscriber, calendar week): see claimWeeklyDigestSend's
  // doc in lib/cron-monitor.ts. Computed once per run so every subscriber in
  // this invocation shares the same week key.
  const weekOf = currentWeekOf();

  for (const sub of subscribers) {
    if (suppressionSet.has((sub.email ?? "").trim().toLowerCase())) { blockedSkipped++; continue; }

    // Cross-route claim on the ADDRESS. Two things fall out of this: a reader
    // who already received the sitrep or the regional digest earlier this
    // morning is skipped here, and two `subscriptions` rows sharing one address
    // no longer produce two digests — the old claim below is keyed on sub.id,
    // which never noticed that case.
    const addressClaim = await claimWeeklyAddress(supabase, sub.email ?? "", weekOf, "weekly-digest");
    if (addressClaim.degraded) claimDegraded = true;
    if (!addressClaim.granted) { claimedElsewhere++; continue; }

    // Claim before send, not after: a second invocation racing this one
    // must see the claim already taken, not an empty log it can still win.
    const claimed = await claimWeeklyDigestSend(supabase, sub.id, weekOf);
    if (!claimed) { alreadySent++; continue; }
    try {
      const locale = sub.locale || "en";
      const region = sub.region || "allRegions";

      // Filter outbreaks to the subscriber's region preference
      const regionOutbreaks = region === "allRegions"
        ? allOutbreaks
        : allOutbreaks.filter((o) => o.region === region);

      // Cap at 8 outbreaks per email — keeps the email scannable
      const topOutbreaks = regionOutbreaks.slice(0, 8);

      const { subject, html, unsubUrl } = buildDigestEmail(topOutbreaks, region, locale, sub.id);
      if (isRealProduction) {
        const ok = await sendEmail(sub.email, subject, html, unsubUrl);
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

  // Was only checking skippedNoKey — `failed`, incremented per-subscriber in
  // the catch above, was tracked but never consulted here, so a genuine send
  // failure still logged "ok".
  const degradedNote = [
    suppressionDegraded ? "liste de suppression incomplète (une source en échec)" : null,
    claimDegraded ? "verrou hebdomadaire indisponible — envois non dédupliqués entre routes" : null,
    failed > 0 ? `${failed} envoi(s) en échec` : null,
  ].filter(Boolean).join(" · ");
  await logCronRun(
    supabase,
    "weekly-digest",
    skippedNoKey > 0 || failed > 0 || suppressionDegraded || claimDegraded ? "error" : "ok",
    sent,
    degradedNote || undefined,
  );
  console.log(`[weekly-digest] Done, ${sent} sent, ${failed} failed, ${skippedNoKey} skipped (no key), ${blockedSkipped} suppressed, ${claimedElsewhere} claimed by a higher-priority mailer, ${alreadySent} already sent this week, ${subscribers.length} total.`);
  return NextResponse.json({ sent, failed, skippedNoKey, blockedSkipped, claimedElsewhere, alreadySent, total: subscribers.length });
}
