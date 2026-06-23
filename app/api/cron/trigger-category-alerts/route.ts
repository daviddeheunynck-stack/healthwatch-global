import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { getDiseaseCategory, CATEGORY_LABELS } from "@/lib/disease-category";

export const dynamic = "force-dynamic";

const BOM   = String.fromCharCode(65279);
const clean = (v: string | undefined) => (v || "").replace(new RegExp("^" + BOM), "").trim();

const SUPABASE_URL     = clean(process.env.NEXT_PUBLIC_SUPABASE_URL);
const SUPABASE_SERVICE = clean(process.env.SUPABASE_SERVICE_ROLE_KEY);
const CRON_SECRET      = clean(process.env.CRON_SECRET);
const RESEND_KEY       = clean(process.env.RESEND_API_KEY);
const APP_URL          = clean(process.env.NEXT_PUBLIC_APP_URL) || "https://healthwatch-global.com";

const COOLDOWN_H = 6;

const COPY: Record<string, {
  subject: (catLabel: string, minCases: string) => string;
  header:  string;
  col:     [string, string, string];
  found:   (n: number) => string;
  view:    string;
  footer:  (h: number) => string;
  inAppTitle: (catLabel: string, n: number, minCases: string) => string;
  inAppBody:  (disease: string, country: string, cases: string) => string;
}> = {
  fr: {
    subject: (cat, min) => `[HealthWatch] Alerte catégorie : foyers ${cat} ≥ ${min} cas`,
    header:  "HealthWatch Global — Alerte Catégorie",
    col:     ["Maladie", "Pays", "Cas"],
    found:   (n) => `${n} foyer${n > 1 ? "s" : ""} correspondant${n > 1 ? "s" : ""} trouvé${n > 1 ? "s" : ""}`,
    view:    "Voir le tableau de bord →",
    footer:  (h) => `Cette alerte se déclenche toutes les ${h}h quand des foyers correspondants existent. Gérez vos alertes dans le tableau de bord.`,
    inAppTitle: (cat, n, min) => `Alerte ${cat} — ${n} foyer${n > 1 ? "s" : ""} ≥ ${min} cas`,
    inAppBody:  (d, c, n) => `${d} (${c}) : ${n} cas`,
  },
  en: {
    subject: (cat, min) => `[HealthWatch] Category alert: ${cat} outbreaks ≥ ${min} cases`,
    header:  "HealthWatch Global — Category Alert",
    col:     ["Disease", "Country", "Cases"],
    found:   (n) => `${n} matching outbreak${n > 1 ? "s" : ""} found`,
    view:    "View dashboard →",
    footer:  (h) => `This alert fires every ${h}h when matching outbreaks exist. Manage alerts on your dashboard.`,
    inAppTitle: (cat, n, min) => `${cat} alert — ${n} outbreak${n > 1 ? "s" : ""} ≥ ${min} cases`,
    inAppBody:  (d, c, n) => `${d} (${c}): ${n} cases`,
  },
  es: {
    subject: (cat, min) => `[HealthWatch] Alerta de categoría: brotes de ${cat} ≥ ${min} casos`,
    header:  "HealthWatch Global — Alerta de Categoría",
    col:     ["Enfermedad", "País", "Casos"],
    found:   (n) => `${n} brote${n > 1 ? "s" : ""} coincidente${n > 1 ? "s" : ""} encontrado${n > 1 ? "s" : ""}`,
    view:    "Ver panel →",
    footer:  (h) => `Esta alerta se activa cada ${h}h cuando existen brotes coincidentes. Gestione sus alertas en el panel.`,
    inAppTitle: (cat, n, min) => `Alerta ${cat} — ${n} brote${n > 1 ? "s" : ""} ≥ ${min} casos`,
    inAppBody:  (d, c, n) => `${d} (${c}): ${n} casos`,
  },
  ar: {
    subject: (cat, min) => `[HealthWatch] تنبيه فئة: تفشيات ${cat} ≥ ${min} حالة`,
    header:  "HealthWatch Global — تنبيه فئة",
    col:     ["المرض", "الدولة", "الحالات"],
    found:   (n) => `تم العثور على ${n} تفشٍّ مطابق`,
    view:    "← عرض لوحة المعلومات",
    footer:  (h) => `يُطلَق هذا التنبيه كل ${h} ساعة عند وجود تفشيات مطابقة. أدر تنبيهاتك من لوحة المعلومات.`,
    inAppTitle: (cat, n, min) => `تنبيه ${cat} — ${n} تفشٍّ ≥ ${min} حالة`,
    inAppBody:  (d, c, n) => `${d} (${c}): ${n} حالة`,
  },
  id: {
    subject: (cat, min) => `[HealthWatch] Peringatan kategori: wabah ${cat} ≥ ${min} kasus`,
    header:  "HealthWatch Global — Peringatan Kategori",
    col:     ["Penyakit", "Negara", "Kasus"],
    found:   (n) => `${n} wabah yang cocok ditemukan`,
    view:    "Lihat dasbor →",
    footer:  (h) => `Peringatan ini aktif setiap ${h} jam saat wabah yang cocok ada. Kelola peringatan di dasbor Anda.`,
    inAppTitle: (cat, n, min) => `Peringatan ${cat} — ${n} wabah ≥ ${min} kasus`,
    inAppBody:  (d, c, n) => `${d} (${c}): ${n} kasus`,
  },
};

interface CategoryAlert {
  id: string; user_id: string; disease_category: string; region: string;
  min_cases: number; email: string; last_fired_at: string | null;
}
interface Outbreak {
  id: string; disease_en: string | null; country_en: string | null;
  cases: number; risk_level: string; region: string;
}

export async function GET(req: NextRequest) {
  if (!CRON_SECRET || req.headers.get("x-cron-secret") !== CRON_SECRET)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  if (!RESEND_KEY) return NextResponse.json({ ok: true, skipped: "RESEND_API_KEY not configured" });

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE);
  const resend   = new Resend(RESEND_KEY);

  const { data: alerts } = await supabase
    .from("category_alerts")
    .select("id, user_id, disease_category, region, min_cases, email, last_fired_at");
  if (!alerts?.length) return NextResponse.json({ ok: true, fired: 0 });

  // Fetch user locales in bulk
  const userIds = [...new Set((alerts as CategoryAlert[]).map((a) => a.user_id))];
  const { data: profileLocales } = await supabase
    .from("profiles").select("id, alert_locale").in("id", userIds);
  const localeMap: Record<string, string> = Object.fromEntries(
    (profileLocales ?? []).map((p: { id: string; alert_locale?: string | null }) => [p.id, p.alert_locale ?? "en"])
  );

  const { data: outbreaks } = await supabase
    .from("outbreaks")
    .select("id, disease_en, country_en, cases, risk_level, region")
    .eq("active", true);

  const active = (outbreaks ?? []) as Outbreak[];
  let fired = 0;

  for (const alert of alerts as CategoryAlert[]) {
    // Cooldown check
    if (alert.last_fired_at) {
      const h = (Date.now() - new Date(alert.last_fired_at).getTime()) / 3600000;
      if (h < COOLDOWN_H) continue;
    }

    // Find matching outbreaks
    const matches = active.filter((o) => {
      if (o.cases < alert.min_cases) return false;
      if (alert.region !== "all" && o.region !== alert.region) return false;
      return getDiseaseCategory(o.disease_en) === alert.disease_category;
    });

    if (!matches.length) continue;

    const locale    = localeMap[alert.user_id] ?? "en";
    const numLocale = locale === "ar" ? "ar-SA" : locale;
    const lc       = COPY[locale] ?? COPY.en;
    const catLabel = (CATEGORY_LABELS[alert.disease_category as keyof typeof CATEGORY_LABELS]?.en) ?? alert.disease_category;
    const minStr   = alert.min_cases.toLocaleString(numLocale);

    const rows = matches.slice(0, 8).map((o) =>
      `<tr><td style="padding:4px 8px">${o.disease_en ?? "—"}</td><td style="padding:4px 8px">${o.country_en ?? "—"}</td><td style="padding:4px 8px;text-align:right">${o.cases.toLocaleString(numLocale)}</td></tr>`
    ).join("");

    try {
      // Log in-app notification (non-fatal)
      void Promise.resolve(supabase.from("alert_notifications").insert({
        user_id: alert.user_id,
        type:    "category_alert",
        title:   lc.inAppTitle(catLabel, matches.length, minStr),
        body:    matches.slice(0, 3).map((o) => lc.inAppBody(o.disease_en ?? "—", o.country_en ?? "—", o.cases.toLocaleString(locale))).join(" · "),
        outbreak_id: matches[0]?.id ?? null,
      })).catch(() => {});

      await resend.emails.send({
        from: "HealthWatch Global <alerts@healthwatch-global.com>",
        to:   alert.email,
        subject: lc.subject(catLabel, minStr),
        html: `
<div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:24px;background:#0f172a;color:#e2e8f0;border-radius:12px">
  <p style="color:#60a5fa;font-size:17px;font-weight:700;margin:0 0 4px">${lc.header}</p>
  <p style="font-size:12px;color:#64748b;margin:0 0 16px">${new Date().toISOString().split("T")[0]}</p>
  <hr style="border:none;border-top:1px solid #334155;margin:0 0 16px"/>
  <p style="font-size:14px;margin:0 0 4px">
    <strong style="color:#fff">${catLabel}</strong>
    ${alert.region !== "all" ? `· ${alert.region} ` : ""}
    ≥ <strong style="color:#f87171">${minStr}</strong>
  </p>
  <p style="font-size:12px;color:#94a3b8;margin:0 0 16px">${lc.found(matches.length)}</p>
  <table style="width:100%;border-collapse:collapse;font-size:13px">
    <thead><tr style="background:#1e293b;color:#94a3b8">
      <th style="padding:6px 8px;text-align:left">${lc.col[0]}</th>
      <th style="padding:6px 8px;text-align:left">${lc.col[1]}</th>
      <th style="padding:6px 8px;text-align:right">${lc.col[2]}</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <br/>
  <a href="${APP_URL}/${locale}" style="display:inline-block;padding:10px 20px;background:#1d4ed8;color:#fff;text-decoration:none;border-radius:8px;font-size:14px;font-weight:600">
    ${lc.view}
  </a>
  <p style="margin-top:20px;font-size:11px;color:#475569">${lc.footer(COOLDOWN_H)}</p>
</div>`,
      });

      await supabase
        .from("category_alerts")
        .update({ last_fired_at: new Date().toISOString() })
        .eq("id", alert.id);

      fired++;
    } catch { /* non-fatal */ }
  }

  return NextResponse.json({ ok: true, fired });
}
