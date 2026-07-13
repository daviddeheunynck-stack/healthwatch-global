import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { haversineKm } from "@/lib/haversine";
import { getCountryCoords } from "@/lib/country-coords";
import { getLocalizedDisease, getLocalizedCountry } from "@/lib/outbreaks";
import * as Sentry from "@sentry/nextjs";
import { logCronRun, isRealProduction } from "@/lib/cron-monitor";
import { notifyMobile } from "@/lib/mobile-notify";

export const dynamic = "force-dynamic";

const BOM   = String.fromCharCode(65279);
const clean = (v: string | undefined) => (v || "").replace(new RegExp("^" + BOM), "").trim();

const SUPABASE_URL     = clean(process.env.NEXT_PUBLIC_SUPABASE_URL);
const SUPABASE_SERVICE = clean(process.env.SUPABASE_SERVICE_ROLE_KEY);
const CRON_SECRET      = clean(process.env.CRON_SECRET);
const BREVO_KEY        = clean(process.env.BREVO_API_KEY);
const APP_URL          = clean(process.env.NEXT_PUBLIC_APP_URL) || "https://healthwatch-global.com";

async function sendEmail(to: string, subject: string, html: string) {
  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    signal: AbortSignal.timeout(10_000),
    headers: { "api-key": BREVO_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({
      sender:      { name: "HealthWatch Global", email: "alerts@healthwatch-global.com" },
      to:          [{ email: to }],
      subject,
      htmlContent: html,
    }),
  });
  if (!res.ok) throw new Error(`Brevo error ${res.status}: ${await res.text()}`);
}

function esc(s: string): string {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

const COOLDOWN_H = 6;

interface GeofenceAlert {
  id: string; user_id: string; label: string;
  lat: number; lng: number; radius_km: number;
  email: string; last_fired_at: string | null;
}
interface Outbreak {
  id: string;
  disease: string; disease_en: string | null; disease_ar: string | null;
  country: string; country_en: string | null; country_ar: string | null;
  cases: number; risk_level: string; lat: number | null; lng: number | null;
}

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (!CRON_SECRET || auth !== `Bearer ${CRON_SECRET}`)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!BREVO_KEY) return NextResponse.json({ ok: true, skipped: "BREVO_API_KEY not configured" });

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE);

  const { data: alerts } = await supabase
    .from("geofence_alerts")
    .select("id, user_id, label, lat, lng, radius_km, email, last_fired_at");
  if (!alerts?.length) {
    await logCronRun(supabase, "trigger-geofence-alerts", "ok", 0);
    return NextResponse.json({ ok: true, fired: 0 });
  }

  const alertUserIds = [...new Set((alerts as GeofenceAlert[]).map((a) => a.user_id))];
  const { data: profileLocales } = await supabase
    .from("profiles").select("id, alert_locale").in("id", alertUserIds);
  const localeMap: Record<string, string> = Object.fromEntries(
    (profileLocales ?? []).map((p: { id: string; alert_locale?: string | null }) => [p.id, p.alert_locale ?? "en"])
  );

  const { data: outbreaks } = await supabase
    .from("outbreaks")
    .select("id, disease, disease_en, disease_ar, country, country_en, country_ar, cases, risk_level, lat, lng")
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

    const locale    = localeMap[alert.user_id] ?? "en";
    const numLocale = locale === "ar" ? "ar-SA" : locale;
    const isRtl     = locale === "ar";
    const plural   = matches.length > 1;
    const emailSubject = {
      fr: `[HealthWatch] Alerte zone : ${matches.length} foyer${plural ? "s" : ""} près de ${alert.label}`,
      es: `[HealthWatch] Alerta de zona: ${matches.length} brote${plural ? "s" : ""} cerca de ${alert.label}`,
      ar: `[HealthWatch] تنبيه المنطقة: ${matches.length} تفشٍّ بالقرب من ${alert.label}`,
      id: `[HealthWatch] Peringatan zona: ${matches.length} wabah dekat ${alert.label}`,
      en: `[HealthWatch] Geofence alert: ${matches.length} outbreak${plural ? "s" : ""} near ${alert.label}`,
    }[locale] ?? `[HealthWatch] Geofence alert: ${matches.length} outbreak${plural ? "s" : ""} near ${alert.label}`;
    const emailHeader = {
      fr: "HealthWatch Global — Alerte de zone",
      es: "HealthWatch Global — Alerta de zona",
      ar: "HealthWatch Global — تنبيه المنطقة",
      id: "HealthWatch Global — Peringatan zona",
      en: "HealthWatch Global — Geofence Alert",
    }[locale] ?? "HealthWatch Global — Geofence Alert";
    const emailIntro = {
      fr: `📍 <strong style="color:#fff">${alert.label}</strong> — ${matches.length} foyer${plural ? "s" : ""} actif${plural ? "s" : ""} dans un rayon de <strong>${alert.radius_km} km</strong>`,
      es: `📍 <strong style="color:#fff">${alert.label}</strong> — ${matches.length} brote${plural ? "s" : ""} activo${plural ? "s" : ""} en un radio de <strong>${alert.radius_km} km</strong>`,
      ar: `📍 <strong style="color:#fff">${alert.label}</strong> — ${matches.length} تفشٍّ نشط في نطاق <strong>${alert.radius_km} كم</strong>`,
      id: `📍 <strong style="color:#fff">${alert.label}</strong> — ${matches.length} wabah aktif dalam radius <strong>${alert.radius_km} km</strong>`,
      en: `📍 <strong style="color:#fff">${alert.label}</strong> — ${matches.length} active outbreak${plural ? "s" : ""} within <strong>${alert.radius_km} km</strong>`,
    }[locale] ?? `📍 <strong style="color:#fff">${alert.label}</strong> — ${matches.length} active outbreak${plural ? "s" : ""} within <strong>${alert.radius_km} km</strong>`;

    const colH = ({
      fr: ["Maladie", "Pays", "Cas", "Risque"],
      es: ["Enfermedad", "País", "Casos", "Riesgo"],
      ar: ["المرض", "الدولة", "الحالات", "الخطر"],
      id: ["Penyakit", "Negara", "Kasus", "Risiko"],
      en: ["Disease", "Country", "Cases", "Risk"],
    } as Record<string, string[]>)[locale] ?? ["Disease", "Country", "Cases", "Risk"];

    const inAppTitleStr = ({
      fr: `📍 ${alert.label} — ${matches.length} foyer${plural ? "s" : ""} dans un rayon de ${alert.radius_km}km`,
      es: `📍 ${alert.label} — ${matches.length} brote${plural ? "s" : ""} a ${alert.radius_km}km`,
      ar: `📍 ${alert.label} — ${matches.length} تفشٍّ في نطاق ${alert.radius_km}كم`,
      id: `📍 ${alert.label} — ${matches.length} wabah dalam radius ${alert.radius_km}km`,
      en: `📍 ${alert.label} — ${matches.length} outbreak${plural ? "s" : ""} within ${alert.radius_km}km`,
    } as Record<string, string>)[locale] ?? `📍 ${alert.label} — ${matches.length} outbreak${plural ? "s" : ""} within ${alert.radius_km}km`;

    const viewBtn = ({
      fr: "Voir le tableau de bord →",
      es: "Ver panel →",
      ar: "← عرض لوحة المعلومات",
      id: "Lihat dasbor →",
      en: "View dashboard →",
    } as Record<string, string>)[locale] ?? "View dashboard →";

    const footerText = ({
      fr: `Cette alerte se déclenche toutes les ${COOLDOWN_H}h quand des foyers existent dans votre zone. Gérez vos alertes de zone dans le tableau de bord.`,
      es: `Esta alerta se activa cada ${COOLDOWN_H}h cuando hay brotes en su zona. Gestione las alertas de geovalla en su panel.`,
      ar: `يُطلَق هذا التنبيه كل ${COOLDOWN_H} ساعة عند وجود تفشيات في منطقتك. أدر تنبيهاتك من لوحة المعلومات.`,
      id: `Peringatan ini aktif setiap ${COOLDOWN_H} jam saat wabah ada dalam zona Anda. Kelola peringatan di dasbor Anda.`,
      en: `This alert fires every ${COOLDOWN_H}h when outbreaks exist within your zone radius. Manage geofence alerts on your dashboard.`,
    } as Record<string, string>)[locale] ?? `This alert fires every ${COOLDOWN_H}h when outbreaks exist within your zone radius. Manage geofence alerts on your dashboard.`;

    const rows = matches.slice(0, 8).map((o) =>
      `<tr><td style="padding:4px 8px">${esc(getLocalizedDisease(o, locale))}</td><td style="padding:4px 8px">${esc(getLocalizedCountry(o, locale))}</td><td style="padding:4px 8px;text-align:right">${o.cases.toLocaleString(numLocale)}</td><td style="padding:4px 8px;text-transform:uppercase;font-size:11px;font-weight:700;color:${o.risk_level === "high" ? "#f87171" : o.risk_level === "medium" ? "#fbbf24" : "#4ade80"}">${o.risk_level}</td></tr>`
    ).join("");

    try {
      // Update last_fired_at BEFORE sending — prevents re-send on cron retry
      await supabase
        .from("geofence_alerts")
        .update({ last_fired_at: new Date().toISOString() })
        .eq("id", alert.id);

      const inAppBody = matches.slice(0, 3).map((o) => `${getLocalizedDisease(o, locale)} (${getLocalizedCountry(o, locale)}): ${o.cases.toLocaleString(numLocale)}`).join(" · ");

      await supabase.from("alert_notifications").insert({
        user_id:     alert.user_id,
        type:        "geofence",
        title:       inAppTitleStr,
        body:        inAppBody,
        outbreak_id: matches[0]?.id ?? null,
      }).then(() => {}, () => {});

      await notifyMobile(supabase, alert.user_id, { title: inAppTitleStr, body: inAppBody, outbreak_id: matches[0]?.id ?? null });

      if (isRealProduction) await sendEmail(alert.email, emailSubject, `
<div dir="${isRtl ? "rtl" : "ltr"}" style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:24px;background:#0f172a;color:#e2e8f0;border-radius:12px;direction:${isRtl ? "rtl" : "ltr"};text-align:${isRtl ? "right" : "left"}">
  <p style="color:#60a5fa;font-size:17px;font-weight:700;margin:0 0 4px">${emailHeader}</p>
  <p style="font-size:12px;color:#64748b;margin:0 0 16px">${new Date().toISOString().split("T")[0]}</p>
  <hr style="border:none;border-top:1px solid #334155;margin:0 0 16px"/>
  <p style="font-size:14px;margin:0 0 4px">
    ${emailIntro}
  </p>
  <p style="font-size:12px;color:#94a3b8;margin:0 0 16px">Coordinates: ${alert.lat.toFixed(4)}, ${alert.lng.toFixed(4)}</p>
  <table style="width:100%;border-collapse:collapse;font-size:13px">
    <thead><tr style="background:#1e293b;color:#94a3b8">
      <th style="padding:6px 8px;text-align:left">${colH[0]}</th>
      <th style="padding:6px 8px;text-align:left">${colH[1]}</th>
      <th style="padding:6px 8px;text-align:right">${colH[2]}</th>
      <th style="padding:6px 8px;text-align:left">${colH[3]}</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <br/>
  <a href="${APP_URL}/${locale}" style="display:inline-block;padding:10px 20px;background:#1d4ed8;color:#fff;text-decoration:none;border-radius:8px;font-size:14px;font-weight:600">
    ${viewBtn}
  </a>
  <p style="margin-top:20px;font-size:11px;color:#475569">
    ${footerText}
  </p>
</div>`);

      fired++;
    } catch (err) {
      console.error(`[trigger-geofence-alerts] Failed for alert ${alert.id}:`, err);
      Sentry.captureException(err, { tags: { cron: "trigger-geofence-alerts", alert_id: alert.id } });
    }
  }

  await logCronRun(supabase, "trigger-geofence-alerts", "ok", fired);
  return NextResponse.json({ ok: true, fired });
}
