/**
 * GET /api/cron/sync-signals — DISABLED (legal).
 *
 * This cron previously ingested pre-confirmation "signals" from ReliefWeb (API +
 * RSS fallback) into the `signals` table. ReliefWeb's terms of use permit reuse for
 * "personal, non-commercial use" only, with no right to resell, redistribute, or
 * create derivative works, over third-party copyrighted partner reports. HealthWatch
 * Global is a commercial product, so ingesting ReliefWeb breaches those terms — the
 * same legal shape as the ProMED cease-and-desist. See the legal_reliefweb_noncommercial
 * memory / ROADMAP due-diligence.
 *
 * Kept as a no-op (returns 200 + logs ok/0) so the Vercel cron endpoint stays healthy
 * and doesn't page. The DB had 0 ReliefWeb-sourced signals at disable time (2026-07-06).
 *
 * To restore an "early signals" feature, wire a legally-clean source instead — e.g. WHO
 * Disease Outbreak News, national health-ministry feeds, or another government/IGO source
 * that permits commercial reuse (each needs its own terms-of-use check per the ROADMAP).
 */
import { NextRequest, NextResponse } from "next/server";
import { logCronRun } from "@/lib/cron-monitor";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const BOM   = String.fromCharCode(65279);
const clean = (v: string | undefined) => (v || "").replace(new RegExp("^" + BOM), "").trim();

const SUPABASE_URL = clean(process.env.NEXT_PUBLIC_SUPABASE_URL);
const SUPABASE_KEY = clean(process.env.SUPABASE_SERVICE_ROLE_KEY);
const CRON_SECRET  = clean(process.env.CRON_SECRET);

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (!CRON_SECRET || auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (SUPABASE_URL && SUPABASE_KEY) {
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
    await logCronRun(supabase, "sync-signals", "ok", 0, "disabled: ReliefWeb non-commercial ToS");
  }

  return NextResponse.json({
    success: true,
    disabled: "reliefweb-non-commercial-tos",
    inserted: 0,
    note: "ReliefWeb ingestion retired for legal reasons — see legal_reliefweb_noncommercial",
  });
}
