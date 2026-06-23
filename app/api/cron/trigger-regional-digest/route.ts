import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

export const dynamic    = "force-dynamic";
export const maxDuration = 300;

const SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/^﻿/, "").trim();
const SUPABASE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").replace(/^﻿/, "").trim();
const APP_URL      = (process.env.NEXT_PUBLIC_APP_URL ?? "https://healthwatch-global.com").replace(/^﻿/, "").trim();

const REGION_LABELS: Record<string, Record<string, string>> = {
  africa:   { fr: "Afrique",    en: "Africa",   es: "África",    ar: "أفريقيا",      id: "Afrika"  },
  asia:     { fr: "Asie",       en: "Asia",      es: "Asia",      ar: "آسيا",          id: "Asia"    },
  americas: { fr: "Amériques",  en: "Americas",  es: "Américas",  ar: "الأمريكتين",    id: "Amerika" },
  europe:   { fr: "Europe",     en: "Europe",    es: "Europa",    ar: "أوروبا",        id: "Eropa"   },
  oceania:  { fr: "Océanie",    en: "Oceania",   es: "Oceanía",   ar: "أوقيانوسيا",    id: "Oseania" },
};

const COPY: Record<string, {
  subject:  (region: string) => string;
  header:   (region: string) => string;
  active:   string;
  colH:     [string, string, string, string, string];
  view:     string;
  footer:   string;
}> = {
  fr: {
    subject:  (r) => `[HealthWatch] Digest hebdomadaire — ${r}`,
    header:   (r) => `Foyers actifs — ${r} · Semaine du ${new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "long" })}`,
    active:   "foyer(s) actif(s)",
    colH:     ["Maladie", "Pays", "Cas", "Risque", "Date"],
    view:     "Voir le tableau de bord →",
    footer:   "Vous recevez cet email parce que vous avez configuré un digest régional. Gérez vos préférences dans le tableau de bord.",
  },
  en: {
    subject:  (r) => `[HealthWatch] Weekly digest — ${r}`,
    header:   (r) => `Active outbreaks — ${r} · Week of ${new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long" })}`,
    active:   "active outbreak(s)",
    colH:     ["Disease", "Country", "Cases", "Risk", "Date"],
    view:     "View dashboard →",
    footer:   "You receive this email because you configured a regional digest. Manage preferences in your dashboard.",
  },
  es: {
    subject:  (r) => `[HealthWatch] Digest semanal — ${r}`,
    header:   (r) => `Brotes activos — ${r} · Semana del ${new Date().toLocaleDateString("es-ES", { day: "numeric", month: "long" })}`,
    active:   "brote(s) activo(s)",
    colH:     ["Enfermedad", "País", "Casos", "Riesgo", "Fecha"],
    view:     "Ver panel →",
    footer:   "Recibes este email porque configuraste un digest regional. Gestiona tus preferencias en el panel.",
  },
  ar: {
    subject:  (r) => `[HealthWatch] الملخص الأسبوعي — ${r}`,
    header:   (r) => `التفشيات النشطة — ${r}`,
    active:   "تفشٍّ نشط",
    colH:     ["المرض", "الدولة", "الحالات", "الخطر", "التاريخ"],
    view:     "عرض لوحة المعلومات ←",
    footer:   "تلقيت هذا البريد لأنك قمت بإعداد ملخص إقليمي. أدر تفضيلاتك من لوحة المعلومات.",
  },
  id: {
    subject:  (r) => `[HealthWatch] Digest mingguan — ${r}`,
    header:   (r) => `Wabah aktif — ${r} · Minggu ${new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long" })}`,
    active:   "wabah aktif",
    colH:     ["Penyakit", "Negara", "Kasus", "Risiko", "Tanggal"],
    view:     "Lihat dasbor →",
    footer:   "Anda menerima email ini karena mengatur digest regional. Kelola preferensi di dasbor Anda.",
  },
};

export async function GET(req: NextRequest) {
  const cronSecret = (process.env.CRON_SECRET ?? "").replace(/^﻿/, "").trim();
  const authHeader = req.headers.get("authorization");
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`)
    return new Response("Unauthorized", { status: 401 });

  const resendKey = (process.env.RESEND_API_KEY ?? "").replace(/^﻿/, "").trim();
  if (!resendKey) return new Response(JSON.stringify({ ok: true, skipped: "RESEND_API_KEY not configured" }), { status: 200 });

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  const resend   = new Resend(resendKey);

  // Pro users with a specific region preference
  const { data: users } = await supabase
    .from("profiles")
    .select("id, email, alert_locale, digest_region")
    .in("plan", ["pro", "team", "enterprise"])
    .not("digest_region", "eq", "all")
    .not("email", "is", null);

  if (!users?.length) return Response.json({ fired: 0 });

  // Fetch all active outbreaks once (avoids N+1)
  const { data: outbreaks } = await supabase
    .from("outbreaks")
    .select("id, disease_en, country_en, cases, deaths, risk_level, is_pheic, date, region")
    .eq("active", true)
    .order("cases", { ascending: false });

  const active = outbreaks ?? [];
  let fired = 0;

  for (const user of users as Array<{ id: string; email: string; alert_locale?: string | null; digest_region: string }>) {
    const locale       = user.alert_locale ?? "en";
    const digestRegion = user.digest_region;
    const lc           = COPY[locale] ?? COPY.en;
    const regionLabel  = REGION_LABELS[digestRegion]?.[locale] ?? digestRegion;

    const regional = active.filter((o) => o.region === digestRegion).slice(0, 10);
    if (!regional.length) continue;

    const highCount = regional.filter((o) => o.risk_level === "high").length;
    const pheicList = regional.filter((o) => o.is_pheic);

    const rows = regional.map((o) => {
      const riskColor = o.risk_level === "high" ? "#f87171" : o.risk_level === "medium" ? "#fbbf24" : "#4ade80";
      return `<tr>
        <td style="padding:4px 8px;border-bottom:1px solid #1e293b">${o.disease_en ?? "—"}${o.is_pheic ? ' <span style="color:#f87171;font-size:10px">PHEIC</span>' : ""}</td>
        <td style="padding:4px 8px;border-bottom:1px solid #1e293b">${o.country_en ?? "—"}</td>
        <td style="padding:4px 8px;border-bottom:1px solid #1e293b;text-align:right">${o.cases.toLocaleString(locale)}</td>
        <td style="padding:4px 8px;border-bottom:1px solid #1e293b;font-weight:700;font-size:11px;color:${riskColor}">${o.risk_level.toUpperCase()}</td>
        <td style="padding:4px 8px;border-bottom:1px solid #1e293b;color:#94a3b8">${o.date}</td>
      </tr>`;
    }).join("");

    const subject  = lc.subject(regionLabel);
    const dashUrl  = `${APP_URL}/${locale}?region=${digestRegion}`;

    const html = `
<div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:24px;background:#0f172a;color:#e2e8f0;border-radius:12px">
  <p style="color:#60a5fa;font-size:16px;font-weight:700;margin:0 0 4px">HealthWatch Global</p>
  <p style="font-size:13px;color:#94a3b8;margin:0 0 16px">${lc.header(regionLabel)}</p>
  <hr style="border:none;border-top:1px solid #334155;margin:0 0 12px"/>
  <p style="font-size:12px;color:#64748b;margin:0 0 12px">
    ${regional.length} ${lc.active}${highCount > 0 ? ` · <span style="color:#f87171;font-weight:700">${highCount} HIGH</span>` : ""}
    ${pheicList.length > 0 ? ` · <span style="color:#c084fc;font-weight:700">🚨 ${pheicList.length} PHEIC</span>` : ""}
  </p>
  <table style="width:100%;border-collapse:collapse;font-size:12px">
    <thead><tr style="background:#1e293b;color:#94a3b8">
      <th style="padding:6px 8px;text-align:left">${lc.colH[0]}</th>
      <th style="padding:6px 8px;text-align:left">${lc.colH[1]}</th>
      <th style="padding:6px 8px;text-align:right">${lc.colH[2]}</th>
      <th style="padding:6px 8px;text-align:left">${lc.colH[3]}</th>
      <th style="padding:6px 8px;text-align:left">${lc.colH[4]}</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <br/>
  <a href="${dashUrl}" style="display:inline-block;padding:10px 20px;background:#1d4ed8;color:#fff;text-decoration:none;border-radius:8px;font-size:13px;font-weight:600">
    ${lc.view}
  </a>
  <p style="margin-top:20px;font-size:11px;color:#475569">${lc.footer}</p>
</div>`;

    try {
      await resend.emails.send({
        from:    "HealthWatch Global <digest@healthwatch-global.com>",
        to:      user.email,
        subject,
        html,
      });
      fired++;
    } catch { /* non-fatal */ }
  }

  return Response.json({ fired });
}
