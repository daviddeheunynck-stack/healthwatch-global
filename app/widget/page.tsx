// Embeddable outbreak widget — designed for iframe embedding on partner sites
// URL: /widget?locale=fr&region=africa&theme=dark
// Copy-paste embed code: <iframe src="https://healthwatch-global.com/widget" ...></iframe>

import { createClient } from "@supabase/supabase-js";

const BOM   = String.fromCharCode(65279);
const clean = (v: string | undefined) => (v || "").replace(new RegExp("^" + BOM), "").trim();

const RISK_COLOR: Record<string, string> = {
  high: "#ef4444", medium: "#f59e0b", low: "#22c55e",
};

const LABEL: Record<string, {
  title: string; active: string; high: string; medium: string; low: string;
  pheic: string; poweredBy: string; viewAll: string; updated: string;
}> = {
  fr: { title: "Foyers actifs", active: "foyers actifs", high: "Élevé", medium: "Modéré", low: "Faible", pheic: "PHEIC", poweredBy: "HealthWatch Global", viewAll: "Voir tout →", updated: "4 sources officielles" },
  en: { title: "Active outbreaks", active: "active outbreaks", high: "High", medium: "Medium", low: "Low", pheic: "PHEIC", poweredBy: "HealthWatch Global", viewAll: "View all →", updated: "4 official sources" },
  es: { title: "Brotes activos", active: "brotes activos", high: "Alto", medium: "Medio", low: "Bajo", pheic: "PHEIC", poweredBy: "HealthWatch Global", viewAll: "Ver todo →", updated: "4 fuentes oficiales" },
  ar: { title: "التفشيات النشطة", active: "تفشيات نشطة", high: "عالٍ", medium: "متوسط", low: "منخفض", pheic: "PHEIC", poweredBy: "HealthWatch Global", viewAll: "← عرض الكل", updated: "4 مصادر رسمية" },
  id: { title: "Wabah Aktif", active: "wabah aktif", high: "Tinggi", medium: "Sedang", low: "Rendah", pheic: "PHEIC", poweredBy: "HealthWatch Global", viewAll: "Lihat semua →", updated: "4 sumber resmi" },
};

export const dynamic = "force-dynamic";

export default async function WidgetPage({
  searchParams,
}: {
  searchParams: Promise<{ locale?: string; region?: string; theme?: string; limit?: string }>;
}) {
  const sp        = await searchParams;
  const VALID_LOCALES = new Set(["fr", "en", "es", "ar", "id"]);
  const locale    = VALID_LOCALES.has(sp.locale ?? "") ? (sp.locale as string) : "en";
  const region    = sp.region as string | undefined;
  const isDark    = (sp.theme ?? "dark") !== "light";
  const maxItems  = Math.min(parseInt(sp.limit ?? "5", 10), 10);
  const l         = LABEL[locale] ?? LABEL.en;
  const isRtl     = locale === "ar";

  const supabase = createClient(
    clean(process.env.NEXT_PUBLIC_SUPABASE_URL),
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  let query = supabase
    .from("outbreaks")
    .select("id, disease, disease_en, disease_ar, country, country_en, cases, deaths, risk_level, is_pheic")
    .eq("active", true)
    .order("is_pheic", { ascending: false })
    .order("cases", { ascending: false })
    .limit(maxItems);

  if (region && region !== "all") {
    query = query.eq("region", region);
  }

  const { data: outbreaks } = await query;
  const RISK_ORDER: Record<string, number> = { high: 0, medium: 1, low: 2 };
  const items = (outbreaks ?? []).sort((a, b) => {
    const pd = (b.is_pheic ? 1 : 0) - (a.is_pheic ? 1 : 0);
    if (pd !== 0) return pd;
    return (RISK_ORDER[a.risk_level] ?? 3) - (RISK_ORDER[b.risk_level] ?? 3);
  });

  const bg      = isDark ? "#0f172a" : "#ffffff";
  const text     = isDark ? "#f1f5f9" : "#1e293b";
  const subtext  = isDark ? "#94a3b8" : "#64748b";
  const border   = isDark ? "#334155" : "#e2e8f0";
  const headerBg = isDark ? "#1e293b" : "#f1f5f9";

  // Row shape mirrors the `.select(...)` above — derived rather than
  // hand-typed so it can't drift from the query.
  type WidgetOutbreakRow = NonNullable<typeof outbreaks>[number];
  const disease = (o: WidgetOutbreakRow) =>
    (locale === "ar" ? o.disease_ar : locale === "fr" ? o.disease : null) ?? o.disease_en ?? o.disease ?? "—";
  const country = (o: WidgetOutbreakRow) => o.country_en ?? o.country ?? "—";

  // `l` is a fixed-shape label record (no index signature — title/active/...
  // are meaningfully distinct from high/medium/low). risk_level comes back
  // as a plain `string` from the row, so an equality chain is what narrows
  // it to the literal union that's actually safe to index `l` with.
  const riskLabel = (level: string) =>
    level === "high" || level === "medium" || level === "low" ? l[level] : null;

  return (
    <html lang={locale} dir={isRtl ? "rtl" : "ltr"}>
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <title>HealthWatch Global Widget</title>
        <style>{`
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { background: ${bg}; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 13px; }
          .widget { border: 1px solid ${border}; border-radius: 12px; overflow: hidden; width: 100%; }
          .header { background: ${headerBg}; padding: 10px 14px; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid ${border}; }
          .header-left { display: flex; align-items: center; gap: 8px; }
          .dot { width: 8px; height: 8px; border-radius: 50%; background: #ef4444; animation: pulse 2s infinite; }
          @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }
          .title { font-weight: 700; color: ${text}; font-size: 13px; }
          .count { background: #ef4444; color: white; font-size: 11px; font-weight: 700; padding: 2px 7px; border-radius: 99px; }
          .list { }
          .item { padding: 10px 14px; border-bottom: 1px solid ${border}; display: flex; align-items: center; gap: 10px; }
          .item:last-child { border-bottom: none; }
          .risk-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
          .item-info { flex: 1; min-width: 0; }
          .item-disease { color: ${text}; font-weight: 600; font-size: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
          .item-country { color: ${subtext}; font-size: 11px; }
          .item-right { text-align: right; flex-shrink: 0; }
          .cases { color: ${text}; font-weight: 700; font-size: 12px; }
          .pheic { font-size: 9px; font-weight: 700; color: #a855f7; background: #faf5ff; padding: 1px 5px; border-radius: 3px; border: 1px solid #d8b4fe; }
          .footer { background: ${headerBg}; padding: 8px 14px; display: flex; align-items: center; justify-content: space-between; border-top: 1px solid ${border}; }
          .branding { display: flex; align-items: center; gap: 6px; text-decoration: none; }
          .ekg { color: #ef4444; font-size: 14px; }
          .brand-name { color: ${subtext}; font-size: 11px; font-weight: 600; }
          .view-all { color: #ef4444; font-size: 11px; font-weight: 600; text-decoration: none; }
          .view-all:hover { text-decoration: underline; }
          .updated { color: ${subtext}; font-size: 10px; }
        `}</style>
      </head>
      <body>
        <div className="widget">
          {/* Header */}
          <div className="header">
            <div className="header-left">
              <div className="dot" />
              <span className="title">{l.title}</span>
              <span className="count">{items.length}</span>
            </div>
            <span className="updated">{l.updated}</span>
          </div>

          {/* List */}
          <div className="list">
            {items.map((o) => (
              <div key={o.id} className="item">
                <div className="risk-dot" style={{ background: RISK_COLOR[o.risk_level] ?? "#6b7280" }} />
                <div className="item-info">
                  <div className="item-disease">
                    {disease(o)}
                    {o.is_pheic && <span className="pheic" style={{ marginLeft: 4 }}>PHEIC</span>}
                  </div>
                  <div className="item-country">{country(o)}</div>
                </div>
                <div className="item-right">
                  {o.cases > 0 && <div className="cases">{o.cases.toLocaleString(locale === "ar" ? "ar-SA" : locale)}</div>}
                  <div style={{ color: RISK_COLOR[o.risk_level], fontSize: 10, fontWeight: 600 }}>
                    {riskLabel(o.risk_level) ?? o.risk_level}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="footer">
            <a
              href={`https://healthwatch-global.com/${locale}`}
              target="_blank"
              rel="noopener noreferrer"
              className="branding"
            >
              <span className="ekg">~/~</span>
              <span className="brand-name">{l.poweredBy}</span>
            </a>
            <a
              href={`https://healthwatch-global.com/${locale}`}
              target="_blank"
              rel="noopener noreferrer"
              className="view-all"
            >
              {l.viewAll}
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}
