import { ImageResponse } from "next/og";
import { createClient } from "@supabase/supabase-js";
import { slugToCountryEn } from "@/lib/country-utils";
import { normalizeDisease } from "@/lib/disease-data";

export const alt = "Country outbreak surveillance — HealthWatch Global";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const revalidate = 3600;

const BOM   = String.fromCharCode(65279);
const clean = (v: string | undefined) => (v || "").replace(new RegExp("^" + BOM), "").trim();

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`;
  return String(n);
}

type Row = { active: boolean; cases: number | null; country_en: string | null; country: string | null; disease_en: string | null; disease: string | null };

export default async function CountryOgImage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { slug } = await params;

  const supabase = createClient(
    clean(process.env.NEXT_PUBLIC_SUPABASE_URL),
    clean(process.env.SUPABASE_SERVICE_ROLE_KEY)
  );

  const { data } = await supabase
    .from("outbreaks")
    .select("active, cases, country_en, country, disease_en, disease");

  const allRows     = data as Row[] ?? [];
  const allCountries = [...new Set(allRows.map((o) => o.country_en || o.country).filter(Boolean) as string[])];
  const countryEn   = slugToCountryEn(slug, allCountries);

  if (!countryEn) return new ImageResponse(<div style={{ display: "flex" }}>Not found</div>, { ...size });

  const outbreaks   = allRows.filter((o) => (o.country_en || o.country) === countryEn);
  const activeCount = outbreaks.filter((o) => o.active).length;
  const totalCases  = outbreaks.reduce((s, o) => s + (o.cases ?? 0), 0);
  const isActive    = activeCount > 0;

  // Top diseases (active first, max 4)
  const diseaseMap = new Map<string, { hasActive: boolean }>();
  for (const o of outbreaks) {
    const key = normalizeDisease(o.disease_en || o.disease || "").name_en;
    if (!key) continue;
    const ex = diseaseMap.get(key);
    if (ex) { if (o.active) ex.hasActive = true; }
    else diseaseMap.set(key, { hasActive: o.active });
  }
  const topDiseases = [...diseaseMap.entries()]
    .sort(([, a], [, b]) => (b.hasActive ? 1 : 0) - (a.hasActive ? 1 : 0))
    .slice(0, 4)
    .map(([name, { hasActive }]) => ({ name, hasActive }));

  const activeLabel  = activeCount === 1 ? "Active outbreak" : "Active outbreaks";
  const trackedLabel = outbreaks.length === 1 ? "Outbreak tracked" : "Outbreaks tracked";

  const stats = [
    { value: activeCount > 0 ? String(activeCount) : "—", label: activeLabel,   color: isActive ? "#f87171" : "#374151" },
    { value: totalCases > 0  ? fmt(totalCases)     : "—", label: "Total cases", color: "#f3f4f6" },
    { value: String(outbreaks.length),                     label: trackedLabel,  color: "#f3f4f6" },
  ];

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%", height: "100%",
          display: "flex", flexDirection: "column",
          backgroundColor: "#030712",
          fontFamily: "system-ui, sans-serif",
          position: "relative", overflow: "hidden",
          padding: "56px 72px",
        }}
      >
        {/* Background glow */}
        <div style={{
          position: "absolute", top: -200, right: -100,
          width: 550, height: 550, borderRadius: "50%",
          background: isActive
            ? "radial-gradient(circle, rgba(220,38,38,0.20) 0%, transparent 65%)"
            : "radial-gradient(circle, rgba(59,130,246,0.15) 0%, transparent 65%)",
        }} />
        {/* Dot grid */}
        <div style={{
          position: "absolute", inset: 0,
          backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.025) 1px, transparent 1px)",
          backgroundSize: "28px 28px",
        }} />

        {/* Top bar */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", position: "relative", zIndex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span style={{ fontSize: 20, fontWeight: 700, color: "#6b7280" }}>HealthWatch Global</span>
          </div>
          <div style={{ display: "flex", padding: "7px 16px", borderRadius: 20, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
            <span style={{ fontSize: 12, color: "#9ca3af" }}>COUNTRY PROFILE</span>
          </div>
        </div>

        {/* Country name + disease tags */}
        <div style={{ display: "flex", flexDirection: "column", flex: 1, justifyContent: "center", position: "relative", zIndex: 1, marginTop: 20 }}>
          <div style={{
            display: "flex",
            fontSize: countryEn.length > 24 ? 58 : countryEn.length > 16 ? 72 : 86,
            fontWeight: 900, color: "#ffffff",
            lineHeight: 1.05, letterSpacing: -2,
          }}>
            {countryEn}
          </div>
          {topDiseases.length > 0 && (
            <div style={{ display: "flex", gap: 10, marginTop: 20, flexWrap: "wrap" }}>
              {topDiseases.map(({ name, hasActive }) => (
                <div
                  key={name}
                  style={{
                    display: "flex", alignItems: "center", gap: 6,
                    padding: "6px 14px", borderRadius: 20,
                    background: hasActive ? "rgba(168,85,247,0.12)" : "rgba(255,255,255,0.05)",
                    border: hasActive ? "1px solid rgba(168,85,247,0.3)" : "1px solid rgba(255,255,255,0.08)",
                  }}
                >
                  {hasActive && (
                    <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#a855f7" }} />
                  )}
                  <span style={{ fontSize: 14, color: hasActive ? "#c084fc" : "#9ca3af" }}>{name}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Stats row */}
        <div style={{ display: "flex", position: "relative", zIndex: 1, marginTop: 36, border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16, overflow: "hidden", background: "rgba(255,255,255,0.025)" }}>
          {stats.map(({ value, label, color }, i) => (
            <div
              key={label}
              style={{
                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                padding: "24px 0", flex: 1,
                borderRight: i < 2 ? "1px solid rgba(255,255,255,0.06)" : "none",
                gap: 6,
              }}
            >
              <span style={{ fontSize: 46, fontWeight: 800, color, letterSpacing: -1, lineHeight: 1 }}>{value}</span>
              <span style={{ fontSize: 13, color: "#6b7280" }}>{label}</span>
            </div>
          ))}
        </div>

        {/* URL */}
        <div style={{ display: "flex", position: "absolute", bottom: 28, right: 72, zIndex: 1 }}>
          <span style={{ fontSize: 13, color: "#374151" }}>healthwatch-global.com</span>
        </div>
      </div>
    ),
    { ...size }
  );
}
