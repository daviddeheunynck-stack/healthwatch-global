import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { getOutbreaks, getLocalizedDisease, getLocalizedCountry } from "@/lib/outbreaks";

export const dynamic = "force-dynamic";

const VALID_REGIONS = ["africa", "asia", "americas", "europe", "oceania"] as const;
type Region = (typeof VALID_REGIONS)[number];

const REPORT_LABELS: Record<string, {
  subtitle: string;
  activeOutbreaks: string;
  totalCases: string;
  highRisk: string;
  outbreakDetail: string;
  disease: string;
  country: string;
  cases: string;
  deaths: string;
  risk: string;
  noOutbreaks: string;
  generated: string;
  riskHigh: string;
  riskMedium: string;
  riskLow: string;
}> = {
  en: { subtitle: "Epidemiological Report", activeOutbreaks: "Active outbreaks", totalCases: "Total reported cases", highRisk: "High risk alerts", outbreakDetail: "Outbreak Detail", disease: "Disease", country: "Country", cases: "Cases", deaths: "Deaths", risk: "Risk", noOutbreaks: "No active outbreaks reported for this region.", generated: "Generated", riskHigh: "High", riskMedium: "Medium", riskLow: "Low" },
  fr: { subtitle: "Rapport épidémiologique", activeOutbreaks: "Foyers actifs", totalCases: "Cas signalés au total", highRisk: "Alertes haut risque", outbreakDetail: "Détail des foyers", disease: "Maladie", country: "Pays", cases: "Cas", deaths: "Décès", risk: "Risque", noOutbreaks: "Aucun foyer épidémique actif signalé pour cette région.", generated: "Généré le", riskHigh: "Élevé", riskMedium: "Modéré", riskLow: "Faible" },
  es: { subtitle: "Informe epidemiológico", activeOutbreaks: "Brotes activos", totalCases: "Casos totales notificados", highRisk: "Alertas de alto riesgo", outbreakDetail: "Detalle de brotes", disease: "Enfermedad", country: "País", cases: "Casos", deaths: "Fallecidos", risk: "Riesgo", noOutbreaks: "No se han notificado brotes activos en esta región.", generated: "Generado el", riskHigh: "Alto", riskMedium: "Moderado", riskLow: "Bajo" },
  ar: { subtitle: "تقرير وبائي", activeOutbreaks: "التفشيات النشطة", totalCases: "إجمالي الحالات المُبلَّغ عنها", highRisk: "تنبيهات الخطر العالي", outbreakDetail: "تفاصيل التفشي", disease: "المرض", country: "الدولة", cases: "الحالات", deaths: "الوفيات", risk: "الخطر", noOutbreaks: "لا توجد تفشيات نشطة مُبلَّغ عنها لهذه المنطقة.", generated: "تاريخ الإصدار", riskHigh: "مرتفع", riskMedium: "متوسط", riskLow: "منخفض" },
  id: { subtitle: "Laporan Epidemiologi", activeOutbreaks: "Wabah aktif", totalCases: "Total kasus dilaporkan", highRisk: "Peringatan risiko tinggi", outbreakDetail: "Detail Wabah", disease: "Penyakit", country: "Negara", cases: "Kasus", deaths: "Kematian", risk: "Risiko", noOutbreaks: "Tidak ada wabah aktif yang dilaporkan untuk wilayah ini.", generated: "Dibuat pada", riskHigh: "Tinggi", riskMedium: "Sedang", riskLow: "Rendah" },
};

const REGION_LABELS: Record<string, Record<string, string>> = {
  africa:   { en: "Africa",   fr: "Afrique",   es: "África",    ar: "أفريقيا",       id: "Afrika"  },
  asia:     { en: "Asia",     fr: "Asie",      es: "Asia",      ar: "آسيا",          id: "Asia"    },
  americas: { en: "Americas", fr: "Amériques", es: "Américas",  ar: "الأمريكتان",    id: "Amerika" },
  europe:   { en: "Europe",   fr: "Europe",    es: "Europa",    ar: "أوروبا",        id: "Eropa"   },
  oceania:  { en: "Oceania",  fr: "Océanie",   es: "Oceanía",   ar: "أوقيانوسيا",   id: "Oseania" },
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ region: string }> }
) {
  const { region } = await params;

  if (!VALID_REGIONS.includes(region as Region)) {
    return new NextResponse("Invalid region", { status: 400 });
  }

  // ── Auth check ──────────────────────────────────────────────────────────────
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return new NextResponse("Unauthorized — please sign in", { status: 401 });
  }

  // ── Plan check ──────────────────────────────────────────────────────────────
  const { data: profile } = await supabase
    .from("profiles")
    .select("plan")
    .eq("id", user.id)
    .single();

  const plan = profile?.plan ?? "free";
  const isPaid = plan === "starter" || plan === "pro" || plan === "enterprise";

  if (!isPaid) {
    return new NextResponse(
      "Forbidden — upgrade to Pro to download reports",
      { status: 403 }
    );
  }

  // ── Generate report ─────────────────────────────────────────────────────────
  const locale = request.nextUrl.searchParams.get("locale") ?? "en";
  const rl = REPORT_LABELS[locale] ?? REPORT_LABELS.en;
  const outbreaks = await getOutbreaks();
  const regionOutbreaks = outbreaks.filter((o) => o.region === region);
  const totalCases = regionOutbreaks.reduce((sum, o) => sum + o.cases, 0);
  const highRisk = regionOutbreaks.filter((o) => o.risk_level === "high").length;
  const regionLabel =
    REGION_LABELS[region]?.[locale] ?? REGION_LABELS[region]?.en ?? region;
  const dateStr = new Date().toLocaleDateString(locale === "ar" ? "ar-SA" : locale, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const fileDate = new Date().toISOString().split("T")[0];

  const diseases = regionOutbreaks.map((o) => ({
    name: getLocalizedDisease(o, locale),
    country: getLocalizedCountry(o, locale),
    cases: o.cases,
    deaths: o.deaths,
    risk: o.risk_level,
  }));

  const html = `<!DOCTYPE html>
<html lang="${locale}" dir="${locale === "ar" ? "rtl" : "ltr"}">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>HealthWatch Global — ${regionLabel} Epidemiological Report</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #111; background: #fff; padding: 40px; }
    header { display: flex; align-items: center; justify-content: space-between; border-bottom: 3px solid #dc2626; padding-bottom: 16px; margin-bottom: 28px; }
    .brand { display: flex; align-items: center; gap: 10px; }
    .brand-dot { width: 12px; height: 12px; background: #dc2626; border-radius: 50%; }
    .brand-name { font-size: 18px; font-weight: 800; color: #111; letter-spacing: -0.3px; }
    .report-meta { text-align: right; }
    .report-meta .region { font-size: 22px; font-weight: 700; color: #111; }
    .report-meta .date { font-size: 12px; color: #6b7280; margin-top: 2px; }
    .stats { display: flex; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; margin-bottom: 28px; }
    .stat { flex: 1; padding: 16px 20px; border-right: 1px solid #e5e7eb; }
    .stat:last-child { border-right: none; }
    .stat-value { font-size: 28px; font-weight: 800; color: #111; }
    .stat-value.red { color: #dc2626; }
    .stat-label { font-size: 11px; color: #6b7280; margin-top: 3px; text-transform: uppercase; letter-spacing: 0.5px; }
    h2 { font-size: 14px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #6b7280; margin-bottom: 12px; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th { text-align: left; padding: 8px 12px; background: #f9fafb; border-bottom: 1px solid #e5e7eb; font-weight: 600; color: #374151; font-size: 11px; text-transform: uppercase; letter-spacing: 0.4px; }
    td { padding: 9px 12px; border-bottom: 1px solid #f3f4f6; color: #374151; }
    tr:last-child td { border-bottom: none; }
    .risk-badge { display: inline-block; padding: 2px 8px; border-radius: 9999px; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.4px; }
    .risk-high   { background: #fef2f2; color: #dc2626; }
    .risk-medium { background: #fffbeb; color: #d97706; }
    .risk-low    { background: #f0fdf4; color: #16a34a; }
    footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #e5e7eb; display: flex; justify-content: space-between; font-size: 11px; color: #9ca3af; }
    @media print {
      body { padding: 20px; }
      @page { margin: 1.5cm; size: A4; }
    }
  </style>
</head>
<body>
  <header>
    <div class="brand">
      <div class="brand-dot"></div>
      <span class="brand-name">HealthWatch Global</span>
    </div>
    <div class="report-meta">
      <div class="region">${regionLabel}</div>
      <div class="date">${rl.subtitle} · ${dateStr}</div>
    </div>
  </header>

  <div class="stats">
    <div class="stat">
      <div class="stat-value">${regionOutbreaks.length}</div>
      <div class="stat-label">${rl.activeOutbreaks}</div>
    </div>
    <div class="stat">
      <div class="stat-value">${totalCases.toLocaleString()}</div>
      <div class="stat-label">${rl.totalCases}</div>
    </div>
    <div class="stat">
      <div class="stat-value red">${highRisk}</div>
      <div class="stat-label">${rl.highRisk}</div>
    </div>
  </div>

  ${
    diseases.length > 0
      ? `<h2>${rl.outbreakDetail}</h2>
  <table>
    <thead>
      <tr>
        <th>${rl.disease}</th>
        <th>${rl.country}</th>
        <th>${rl.cases}</th>
        <th>${rl.deaths}</th>
        <th>${rl.risk}</th>
      </tr>
    </thead>
    <tbody>
      ${diseases
        .map(
          (d) => `<tr>
        <td><strong>${d.name}</strong></td>
        <td>${d.country}</td>
        <td>${d.cases.toLocaleString()}</td>
        <td>${d.deaths.toLocaleString()}</td>
        <td><span class="risk-badge risk-${d.risk}">${d.risk === "high" ? rl.riskHigh : d.risk === "medium" ? rl.riskMedium : rl.riskLow}</span></td>
      </tr>`
        )
        .join("\n      ")}
    </tbody>
  </table>`
      : `<p style='color:#9ca3af;font-size:13px;margin-top:8px'>${rl.noOutbreaks}</p>`
  }

  <footer>
    <span>Source: WHO · CDC · ECDC · ProMED — healthwatch-global.com</span>
    <span>${rl.generated} ${dateStr} · ${plan.charAt(0).toUpperCase() + plan.slice(1)}</span>
  </footer>
</body>
</html>`;

  return new NextResponse(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Disposition": `attachment; filename="healthwatch-${region}-${fileDate}.html"`,
      "Cache-Control": "no-store, no-cache",
    },
  });
}
