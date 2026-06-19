import { ImageResponse } from "next/og";
import { createClient } from "@supabase/supabase-js";

export const alt = "Disease outbreaks by country — HealthWatch Global";
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

export default async function CountriesIndexOgImage() {
  const supabase = createClient(
    clean(process.env.NEXT_PUBLIC_SUPABASE_URL),
    clean(process.env.SUPABASE_SERVICE_ROLE_KEY)
  );

  const { data } = await supabase
    .from("outbreaks")
    .select("active, cases, country_en");

  const rows = (data ?? []) as { active: boolean; cases: number | null; country_en: string | null }[];

  const totalCases      = rows.reduce((s, o) => s + (o.cases ?? 0), 0);
  const allCountries    = new Set(rows.map((o) => o.country_en).filter(Boolean) as string[]);
  const activeCountries = new Set(rows.filter((o) => o.active).map((o) => o.country_en).filter(Boolean) as string[]);

  const countryCount  = allCountries.size;
  const activeCount   = activeCountries.size;
  const isActive      = activeCount > 0;

  const activeStr   = activeCount > 0 ? String(activeCount) : "—";
  const caseStr     = totalCases > 0 ? fmt(totalCases) : "—";
  const countryStr  = countryCount > 0 ? String(countryCount) : "—";
  const activeLabel = activeCount === 1 ? "Country with active outbreak" : "Countries with active outbreak";

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
        {/* Glow */}
        <div style={{
          position: "absolute", top: -150, right: -80,
          width: 500, height: 500, borderRadius: "50%",
          background: isActive
            ? "radial-gradient(circle, rgba(220,38,38,0.18) 0%, transparent 65%)"
            : "radial-gradient(circle, rgba(59,130,246,0.14) 0%, transparent 65%)",
        }} />
        {/* Grid */}
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
            <span style={{ fontSize: 12, color: "#9ca3af" }}>COUNTRY INDEX</span>
          </div>
        </div>

        {/* Title */}
        <div style={{ display: "flex", flexDirection: "column", flex: 1, justifyContent: "center", position: "relative", zIndex: 1, marginTop: 20 }}>
          <div style={{ display: "flex", fontSize: 86, fontWeight: 900, color: "#ffffff", lineHeight: 1.05, letterSpacing: -2 }}>
            Countries
          </div>
          <div style={{ display: "flex", fontSize: 20, color: "#6b7280", marginTop: 14 }}>
            Global outbreak coverage · WHO & ECDC & PAHO & Africa CDC
          </div>
        </div>

        {/* Stats */}
        <div style={{ display: "flex", position: "relative", zIndex: 1, marginTop: 40, border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16, overflow: "hidden", background: "rgba(255,255,255,0.025)" }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "26px 0", flex: 1, borderRight: "1px solid rgba(255,255,255,0.06)", gap: 6 }}>
            <span style={{ fontSize: 46, fontWeight: 800, color: isActive ? "#f87171" : "#374151", letterSpacing: -1, lineHeight: 1 }}>{activeStr}</span>
            <span style={{ fontSize: 13, color: "#6b7280" }}>{activeLabel}</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "26px 0", flex: 1, borderRight: "1px solid rgba(255,255,255,0.06)", gap: 6 }}>
            <span style={{ fontSize: 46, fontWeight: 800, color: "#f3f4f6", letterSpacing: -1, lineHeight: 1 }}>{countryStr}</span>
            <span style={{ fontSize: 13, color: "#6b7280" }}>Countries tracked</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "26px 0", flex: 1, gap: 6 }}>
            <span style={{ fontSize: 46, fontWeight: 800, color: "#f3f4f6", letterSpacing: -1, lineHeight: 1 }}>{caseStr}</span>
            <span style={{ fontSize: 13, color: "#6b7280" }}>Total cases tracked</span>
          </div>
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
