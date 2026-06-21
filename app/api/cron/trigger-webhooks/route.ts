/**
 * GET /api/cron/trigger-webhooks
 *
 * Fires configured webhooks for high/medium risk outbreaks that changed
 * since each webhook's last_triggered_at. Runs every 30 minutes via Vercel Cron.
 *
 * Payload per delivery:
 *   X-HealthWatch-Signature: sha256=HMAC-SHA256(secret, body)
 *   X-HealthWatch-Event: outbreak.alert
 *   Body: { event, data: { outbreak fields } }
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createHmac } from "crypto";

export const dynamic = "force-dynamic";

const BOM   = String.fromCharCode(65279);
const clean = (v: string | undefined) => (v || "").replace(new RegExp("^" + BOM), "").trim();

const SUPABASE_URL     = clean(process.env.NEXT_PUBLIC_SUPABASE_URL);
const SUPABASE_SERVICE = clean(process.env.SUPABASE_SERVICE_ROLE_KEY);
const CRON_SECRET      = clean(process.env.CRON_SECRET);

interface Webhook {
  id: string;
  url: string;
  secret: string;
  filters: { regions?: string[]; risk_levels?: string[] };
  last_triggered_at: string | null;
  created_at: string;
}

interface Outbreak {
  id: string;
  disease: string;
  disease_en: string | null;
  country: string;
  country_en: string | null;
  region: string;
  risk_level: string;
  cases: number;
  deaths: number;
  date: string;
  is_pheic: boolean;
  updated_at: string | null;
}

function sign(secret: string, body: string): string {
  return "sha256=" + createHmac("sha256", secret).update(body).digest("hex");
}

function outbreakMatchesWebhook(o: Outbreak, w: Webhook): boolean {
  const { regions = [], risk_levels = ["high"] } = w.filters;
  if (regions.length > 0     && !regions.includes(o.region))      return false;
  if (risk_levels.length > 0 && !risk_levels.includes(o.risk_level)) return false;
  return true;
}

export async function GET(req: NextRequest) {
  if (req.headers.get("x-cron-secret") !== CRON_SECRET)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE);

  // Load all active webhooks
  const { data: webhooks, error: wErr } = await supabase
    .from("webhooks")
    .select("id, url, secret, filters, last_triggered_at, created_at")
    .eq("active", true);

  if (wErr || !webhooks?.length)
    return NextResponse.json({ ok: true, fired: 0, note: "no active webhooks" });

  let totalFired = 0;
  const now = new Date().toISOString();

  for (const webhook of webhooks as Webhook[]) {
    const since = webhook.last_triggered_at ?? webhook.created_at;

    // Find outbreaks updated after this webhook's last trigger
    const { data: outbreaks } = await supabase
      .from("outbreaks")
      .select("id, disease, disease_en, country, country_en, region, risk_level, cases, deaths, date, is_pheic, updated_at")
      .eq("active", true)
      .gt("updated_at", since)
      .in("risk_level", ["high", "medium"]);

    const matches = (outbreaks ?? []).filter((o) => outbreakMatchesWebhook(o as Outbreak, webhook));
    if (matches.length === 0) continue;

    let lastStatus = 200;
    for (const outbreak of matches as Outbreak[]) {
      const cfr = outbreak.cases > 0
        ? parseFloat((outbreak.deaths / outbreak.cases * 100).toFixed(1))
        : null;

      const payload = {
        event: "outbreak.alert",
        timestamp: now,
        data: {
          outbreak_id: outbreak.id,
          disease:     outbreak.disease_en || outbreak.disease,
          country:     outbreak.country_en || outbreak.country,
          region:      outbreak.region,
          risk_level:  outbreak.risk_level,
          cases:       outbreak.cases,
          deaths:      outbreak.deaths,
          cfr_pct:     cfr,
          is_pheic:    outbreak.is_pheic,
          date:        outbreak.date,
        },
      };

      const body = JSON.stringify(payload);

      try {
        const res = await fetch(webhook.url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-HealthWatch-Signature": sign(webhook.secret, body),
            "X-HealthWatch-Event": "outbreak.alert",
            "X-HealthWatch-Timestamp": String(Date.now()),
          },
          body,
          signal: AbortSignal.timeout(10_000),
        });
        lastStatus = res.status;
        totalFired++;
      } catch {
        lastStatus = 0;
      }
    }

    await supabase
      .from("webhooks")
      .update({ last_triggered_at: now, last_status_code: lastStatus })
      .eq("id", webhook.id);
  }

  return NextResponse.json({ ok: true, fired: totalFired });
}
