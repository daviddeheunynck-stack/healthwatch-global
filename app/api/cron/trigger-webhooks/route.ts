/**
 * GET /api/cron/trigger-webhooks
 *
 * Fires configured webhooks for high/medium risk outbreaks updated since
 * each webhook's last_triggered_at. Supports optional Rt threshold filter.
 * Runs every 30 minutes via Vercel Cron.
 *
 * Payload headers:
 *   X-HealthWatch-Signature: sha256=HMAC-SHA256(secret, body)
 *   X-HealthWatch-Event: outbreak.alert
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createHmac } from "crypto";
import * as Sentry from "@sentry/nextjs";
import { computeEpidemicMetrics } from "@/lib/epidemic-metrics";
import { getCountryCoords } from "@/lib/country-coords";
import { haversineKm } from "@/lib/haversine";

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
  filters: {
    regions?: string[];
    risk_levels?: string[];
    rt_threshold?: number;
    disease_thresholds?: { disease_en: string; min_cases: number }[];
    proximity?: { lat: number; lng: number; radius_km: number; label?: string };
    min_change_pct?: number;
    slack_format?: boolean;
  };
  last_triggered_at: string | null;
  last_fired_cases: Record<string, { cases: number; risk_level: string }>;
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
  lat: number | null;
  lng: number | null;
  verification_status: string;
  response_phase: string;
  updated_at: string | null;
}

function sign(secret: string, body: string): string {
  return "sha256=" + createHmac("sha256", secret).update(body).digest("hex");
}

function outbreakMatchesWebhook(o: Outbreak, w: Webhook): boolean {
  const { regions = [], risk_levels = ["high"], disease_thresholds = [], proximity } = w.filters;
  if (regions.length > 0 && !regions.includes(o.region)) return false;
  // Disease threshold bypass
  for (const dt of disease_thresholds) {
    if (o.disease_en?.toLowerCase() === dt.disease_en.toLowerCase() && o.cases >= dt.min_cases) {
      return true;
    }
  }
  // Proximity bypass: trigger if outbreak is within radius, regardless of risk_level
  if (proximity) {
    const outLat = o.lat ?? getCountryCoords(o.country_en)?.[0];
    const outLng = o.lng ?? getCountryCoords(o.country_en)?.[1];
    if (outLat != null && outLng != null) {
      if (haversineKm(proximity.lat, proximity.lng, outLat, outLng) <= proximity.radius_km) {
        return true;
      }
    }
  }
  return risk_levels.length === 0 || risk_levels.includes(o.risk_level);
}

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (!CRON_SECRET || auth !== `Bearer ${CRON_SECRET}`)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE);

  const { data: webhooks, error: wErr } = await supabase
    .from("webhooks")
    .select("id, url, secret, filters, last_triggered_at, last_fired_cases, created_at")
    .eq("active", true);

  if (wErr || !webhooks?.length)
    return NextResponse.json({ ok: true, fired: 0, note: "no active webhooks" });

  let totalFired = 0;
  const now = new Date().toISOString();

  for (const webhook of webhooks as Webhook[]) {
    const since = webhook.last_triggered_at ?? webhook.created_at;

    const { data: outbreaks } = await supabase
      .from("outbreaks")
      .select("id, disease, disease_en, country, country_en, region, risk_level, cases, deaths, date, is_pheic, lat, lng, verification_status, response_phase, updated_at")
      .eq("active", true)
      .gt("updated_at", since);

    let matches = (outbreaks ?? [])
      .filter((o) => outbreakMatchesWebhook(o as Outbreak, webhook)) as Outbreak[];

    if (matches.length === 0) continue;

    // Rt threshold: fetch snapshots and compute Rt, keep only outbreaks that exceed the threshold
    const rtMap = new Map<string, number | null>();

    if (webhook.filters.rt_threshold !== undefined) {
      const ids = matches.map((o) => o.id);

      const { data: allSnaps } = await supabase
        .from("outbreak_snapshots")
        .select("outbreak_id, snapped_at, cases")
        .in("outbreak_id", ids)
        .order("snapped_at", { ascending: true });

      const snapMap = new Map<string, { snapped_at: string; cases: number }[]>();
      for (const s of allSnaps ?? []) {
        if (!snapMap.has(s.outbreak_id)) snapMap.set(s.outbreak_id, []);
        snapMap.get(s.outbreak_id)!.push({ snapped_at: s.snapped_at, cases: s.cases });
      }

      const threshold = webhook.filters.rt_threshold;
      for (const o of matches) {
        const snaps = snapMap.get(o.id) ?? [];
        const m = computeEpidemicMetrics(snaps, o.disease_en);
        rtMap.set(o.id, m.rtEstimate);
      }

      matches = matches.filter((o) => {
        const rt = rtMap.get(o.id);
        return rt !== null && rt !== undefined && rt >= threshold;
      });

      if (matches.length === 0) continue;
    }

    // min_change_pct: skip outbreaks whose case count hasn't changed enough
    // AND whose risk_level is unchanged since the last firing
    if (webhook.filters.min_change_pct !== undefined) {
      const minPct = webhook.filters.min_change_pct;
      const prevFired = (webhook.last_fired_cases ?? {}) as Record<string, { cases: number; risk_level: string }>;
      matches = matches.filter((o) => {
        const prev = prevFired[o.id];
        if (!prev) return true;
        if (o.risk_level !== prev.risk_level) return true;
        const changePct = prev.cases > 0 ? (o.cases - prev.cases) / prev.cases * 100 : 100;
        return changePct >= minPct;
      });
      if (matches.length === 0) continue;
    }

    let lastStatus = 200;

    for (const outbreak of matches) {
      const cfr = outbreak.cases > 0
        ? parseFloat((outbreak.deaths / outbreak.cases * 100).toFixed(1))
        : null;

      const disease = outbreak.disease_en || outbreak.disease;
      const country = outbreak.country_en || outbreak.country;
      const riskEmoji = outbreak.risk_level === "high" ? "🔴" : outbreak.risk_level === "medium" ? "🟡" : "🟢";

      const payload = webhook.filters.slack_format
        ? {
            blocks: [
              {
                type: "header",
                text: { type: "plain_text", text: `${riskEmoji} Outbreak alert — ${disease}` },
              },
              {
                type: "section",
                fields: [
                  { type: "mrkdwn", text: `*Disease:*\n${disease}` },
                  { type: "mrkdwn", text: `*Country:*\n${country}` },
                  { type: "mrkdwn", text: `*Cases:*\n${outbreak.cases.toLocaleString("en")}` },
                  { type: "mrkdwn", text: `*Risk level:*\n${outbreak.risk_level.toUpperCase()}` },
                  ...(cfr !== null ? [{ type: "mrkdwn", text: `*CFR:*\n${cfr}%` }] : []),
                  ...(outbreak.is_pheic ? [{ type: "mrkdwn", text: `*PHEIC:*\n⚠ Declared` }] : []),
                ],
              },
              {
                type: "context",
                elements: [{ type: "mrkdwn", text: `HealthWatch Global · ${outbreak.date} · <https://healthwatch-global.com|View dashboard>` }],
              },
            ],
          }
        : {
            event:     "outbreak.alert",
            timestamp: now,
            data: {
              outbreak_id:  outbreak.id,
              disease,
              country,
              region:       outbreak.region,
              risk_level:   outbreak.risk_level,
              cases:        outbreak.cases,
              deaths:       outbreak.deaths,
              cfr_pct:      cfr,
              is_pheic:            outbreak.is_pheic,
              date:                outbreak.date,
              verification_status: outbreak.verification_status,
              response_phase:      outbreak.response_phase,
              rt_estimate:         rtMap.get(outbreak.id) ?? null,
            },
          };

      const body = JSON.stringify(payload);

      try {
        const res = await fetch(webhook.url, {
          method: "POST",
          headers: {
            "Content-Type":             "application/json",
            "X-HealthWatch-Signature":  sign(webhook.secret, body),
            "X-HealthWatch-Event":      "outbreak.alert",
            "X-HealthWatch-Timestamp":  String(Date.now()),
          },
          body,
          signal: AbortSignal.timeout(10_000),
        });
        lastStatus = res.status;
        totalFired++;
      } catch (err) {
        lastStatus = 0;
        Sentry.captureException(err, { tags: { cron: "trigger-webhooks", webhook_id: webhook.id, outbreak_id: outbreak.id } });
      }
    }

    const updatedFiredCases = { ...((webhook.last_fired_cases ?? {}) as Record<string, { cases: number; risk_level: string }>) };
    for (const o of matches) {
      updatedFiredCases[o.id] = { cases: o.cases, risk_level: o.risk_level };
    }

    await supabase
      .from("webhooks")
      .update({ last_triggered_at: now, last_status_code: lastStatus, last_fired_cases: updatedFiredCases })
      .eq("id", webhook.id);
  }

  return NextResponse.json({ ok: true, fired: totalFired });
}
