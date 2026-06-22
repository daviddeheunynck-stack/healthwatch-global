import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { haversineKm } from "@/lib/haversine";
import { getCountryCoords } from "@/lib/country-coords";

export const dynamic = "force-dynamic";

const BOM   = String.fromCharCode(65279);
const clean = (v: string | undefined) => (v || "").replace(new RegExp("^" + BOM), "").trim();

const SUPABASE_URL     = clean(process.env.NEXT_PUBLIC_SUPABASE_URL);
const SUPABASE_SERVICE = clean(process.env.SUPABASE_SERVICE_ROLE_KEY);
const CRON_SECRET      = clean(process.env.CRON_SECRET);
const RESEND_KEY       = clean(process.env.RESEND_API_KEY);
const APP_URL          = clean(process.env.NEXT_PUBLIC_APP_URL) || "https://healthwatch-global.com";

const COOLDOWN_H = 6;

interface GeofenceAlert {
  id: string; user_id: string; label: string;
  lat: number; lng: number; radius_km: number;
  email: string; last_fired_at: string | null;
}
interface Outbreak {
  id: string; disease_en: string | null; country_en: string | null;
  cases: number; risk_level: string; lat: number | null; lng: number | null;
}

export async function GET(req: NextRequest) {
  if (req.headers.get("x-cron-secret") !== CRON_SECRET)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE);
  const resend   = new Resend(RESEND_KEY);

  const { data: alerts } = await supabase
    .from("geofence_alerts")
    .select("id, user_id, label, lat, lng, radius_km, email, last_fired_at");
  if (!alerts?.length) return NextResponse.json({ ok: true, fired: 0 });

  const { data: outbreaks } = await supabase
    .from("outbreaks")
    .select("id, disease_en, country_en, cases, risk_level, lat, lng")
    .eq("active", true);
  const active = (outbreaks ?? []) as Outbreak[];

  let fired = 0;

  for (const alert of alerts as GeofenceAlert[]) {
    if (alert.last_fired_at) {
      const h = (Date.now() - new Date(alert.last_fired_at).getTime()) / 3600000;
      if (h < COOLDOWN_H) continue;
    }

    const matches = active.filter((o) => {
      const outLat = o.lat ?? getCountryCoords(o.country_en ?? "")?.[0];
      const outLng = o.lng ?? getCountryCoords(o.country_en ?? "")?.[1];
      if (outLat == null || outLng == null) return false;
      return haversineKm(alert.lat, alert.lng, outLat, outLng) <= alert.radius_km;
    });

    if (!matches.length) continue;

    const rows = matches.slice(0, 8).map((o) =>
      `<tr><td style="padding:4px 8px">${o.disease_en ?? "—"}</td><td style="padding:4px 8px">${o.country_en ?? "—"}</td><td style="padding:4px 8px;text-align:right">${o.cases.toLocaleString("en")}</td><td style="padding:4px 8px;text-transform:uppercase;font-size:11px;font-weight:700;color:${o.risk_level === "high" ? "#f87171" : o.risk_level === "medium" ? "#fbbf24" : "#4ade80"}">${o.risk_level}</td></tr>`
    ).join("");

    try {
      void Promise.resolve(supabase.from("alert_notifications").insert({
        user_id:     alert.user_id,
        type:        "watchlist",
        title:       `📍 ${alert.label} — ${matches.length} outbreak${matches.length > 1 ? "s" : ""} within ${alert.radius_km}km`,
        body:        matches.slice(0, 3).map((o) => `${o.disease_en ?? "—"} (${o.country_en ?? "—"}): ${o.cases.toLocaleString("en")} cases`).join(" · "),
        outbreak_id: matches[0]?.id ?? null,
      })).catch(() => {});

      await resend.emails.send({
        from:    "HealthWatch Global <alerts@healthwatch-global.com>",
        to:      alert.email,
        subject: `[HealthWatch] Geofence alert: ${matches.length} outbreak${matches.length > 1 ? "s" : ""} near ${alert.label}`,
        html: `
<div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:24px;background:#0f172a;color:#e2e8f0;border-radius:12px">
  <p style="color:#60a5fa;font-size:17px;font-weight:700;margin:0 0 4px">HealthWatch Global — Geofence Alert</p>
  <p style="font-size:12px;color:#64748b;margin:0 0 16px">${new Date().toISOString().split("T")[0]}</p>
  <hr style="border:none;border-top:1px solid #334155;margin:0 0 16px"/>
  <p style="font-size:14px;margin:0 0 4px">
    📍 <strong style="color:#fff">${alert.label}</strong> — ${matches.length} active outbreak${matches.length > 1 ? "s" : ""} within <strong>${alert.radius_km} km</strong>
  </p>
  <p style="font-size:12px;color:#94a3b8;margin:0 0 16px">Coordinates: ${alert.lat.toFixed(4)}, ${alert.lng.toFixed(4)}</p>
  <table style="width:100%;border-collapse:collapse;font-size:13px">
    <thead><tr style="background:#1e293b;color:#94a3b8">
      <th style="padding:6px 8px;text-align:left">Disease</th>
      <th style="padding:6px 8px;text-align:left">Country</th>
      <th style="padding:6px 8px;text-align:right">Cases</th>
      <th style="padding:6px 8px;text-align:left">Risk</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <br/>
  <a href="${APP_URL}" style="display:inline-block;padding:10px 20px;background:#1d4ed8;color:#fff;text-decoration:none;border-radius:8px;font-size:14px;font-weight:600">
    View dashboard →
  </a>
  <p style="margin-top:20px;font-size:11px;color:#475569">
    This alert fires every ${COOLDOWN_H}h when outbreaks exist within your zone radius. Manage geofence alerts on your dashboard.
  </p>
</div>`,
      });

      await supabase
        .from("geofence_alerts")
        .update({ last_fired_at: new Date().toISOString() })
        .eq("id", alert.id);

      fired++;
    } catch { /* non-fatal */ }
  }

  return NextResponse.json({ ok: true, fired });
}
