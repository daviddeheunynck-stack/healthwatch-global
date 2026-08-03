// Daily at 06:00, hours ahead of regional-alerts and the other 10:xx sending
// crons (moved from 06:xx to 10:3x on 2026-08-03, see
// project_alert_crons_run_before_syncs_2026_08_03 in memory — this cron's own
// time didn't need to move, it already ran well before either window):
// pulls Brevo's blockedContacts list onto profiles.email_blocked_at /
// email_blocked_reason. Brevo blocks a contact (hard bounce, or its own
// List-Unsubscribe "unsubscribedViaEmail") with zero trace in our DB — found
// 2026-07-29 via two trial users whose alerts kept getting logged as sent in
// outbreak_alert_log while every actual Brevo call bounced off "blocked".
// See lib/brevo-blocklist.ts and supabase/migrations/20260729120000_email_blocked_tracking.sql.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import * as Sentry from "@sentry/nextjs";
import { logCronRun } from "@/lib/cron-monitor";
import { syncBrevoBlocklist } from "@/lib/brevo-blocklist";

export const dynamic = "force-dynamic";

const BOM   = String.fromCharCode(65279);
const clean = (v: string | undefined) => (v ?? "").replace(new RegExp("^" + BOM), "").trim();

const SUPABASE_URL         = clean(process.env.NEXT_PUBLIC_SUPABASE_URL);
const SUPABASE_SERVICE_KEY = clean(process.env.SUPABASE_SERVICE_ROLE_KEY);
const CRON_SECRET          = clean(process.env.CRON_SECRET);
const BREVO_API_KEY        = clean(process.env.BREVO_API_KEY);

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (!CRON_SECRET || auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return NextResponse.json({ error: "env:missing_supabase" }, { status: 500 });
  }
  if (!BREVO_API_KEY) {
    return NextResponse.json({ error: "env:missing_brevo" }, { status: 500 });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    const result = await syncBrevoBlocklist(supabase, BREVO_API_KEY);
    await logCronRun(supabase, "sync-brevo-blocklist", "ok", result.newlyBlocked + result.unblocked);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[sync-brevo-blocklist] failed:", message);
    Sentry.captureException(err, { tags: { cron: "sync-brevo-blocklist" } });
    await logCronRun(supabase, "sync-brevo-blocklist", "error", 0, message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
