import { ImageResponse } from "next/og";
import { createClient } from "@supabase/supabase-js";
import { slugToDisease, normalizeDisease } from "@/lib/disease-data";

export const alt = "Disease outbreak surveillance — HealthWatch Global";
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

export default async function DiseaseOgImage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { slug } = await params;
  const info = slugToDisease(slug);
  if (!info) {
    return new ImageResponse(
      <div style={{ display: "flex", width: "100%", height: "100%", backgroundColor: "#030712" }}>
        <span style={{ color: "#fff", fontSize: 40 }}>Not found</span>
      </div>,
      { ...size }
    );
  }

  const supabase = createClient(
    clean(process.env.NEXT_PUBLIC_SUPABASE_URL),
    clean(process.env.SUPABASE_SERVICE_ROLE_KEY)
  );

  const { data } = await supabase
    .from("outbreaks")
    .select("active, cases, country_en, country, disease_en, disease");

  const outbreaks = (data as Row[] ?? []).filter(
    (o) => normalizeDisease(o.disease_en || o.disease || "").name_en === info.name_en
  );

  const activeCount  = outbreaks.filter((o) => o.active).length;
  const totalCases   = outbreaks.reduce((s, o) => s + (o.cases ?? 0), 0);
  const countryCount = new Set(outbreaks.map((o) => o.country_en || o.country).filter(Boolean)).size;
  const isActive     = activeCount > 0;
  const name         = info.name_en;

  // Pre-compute all strings to avoid multi-expression JSX text nodes
  const badgeText    = isActive ? `${activeCount} ACTIVE ${activeCount === 1 ? "OUTBREAK" : "OUTBREAKS"}` : "NO ACTIVE OUTBREAKS";
  const caseStr      = totalCases > 0 ? fmt(totalCases) : "—";
  const countryStr   = countryCount > 0 ? String(countryCount) : "—";
  const activeStr    = activeCount > 0 ? String(activeCount) : "—";
  const activeLabel  = activeCount === 1 ? "Active outbreak" : "Active outbreaks";
  const countryLabel = countryCount === 1 ? "Country affected" : "Countries affected";
  const nameSize     = name.length > 28 ? 54 : name.length > 18 ? 68 : 82;

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
          position: "absolute", top: -200, left: -100, width: 600, height: 600, borderRadius: "50%",
          background: isActive
            ? "radial-gradient(circle, rgba(220,38,38,0.22) 0%, transparent 65%)"
            : "radial-gradient(circle, rgba(99,102,241,0.18) 0%, transparent 65%)",
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
          {isActive ? (
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 18px", borderRadius: 24, background: "rgba(220,38,38,0.12)", border: "1px solid rgba(220,38,38,0.35)" }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#ef4444" }} />
              <span style={{ fontSize: 13, fontWeight: 700, color: "#f87171" }}>{badgeText}</span>
            </div>
          ) : (
            <div style={{ display: "flex", padding: "8px 18px", borderRadius: 24, background: "rgba(75,85,99,0.2)", border: "1px solid rgba(75,85,99,0.3)" }}>
              <span style={{ fontSize: 13, color: "#6b7280" }}>{badgeText}</span>
            </div>
          )}
        </div>

        {/* Disease name + subtitle */}
        <div style={{ display: "flex", flexDirection: "column", flex: 1, justifyContent: "center", position: "relative", zIndex: 1, marginTop: 24 }}>
          <div style={{ display: "flex", fontSize: nameSize, fontWeight: 900, color: "#ffffff", lineHeight: 1.05, letterSpacing: -2 }}>
            {name}
          </div>
          <div style={{ display: "flex", fontSize: 20, color: "#6b7280", marginTop: 14 }}>
            Epidemic intelligence · WHO & ECDC data
          </div>
        </div>

        {/* Stats */}
        <div style={{ display: "flex", position: "relative", zIndex: 1, marginTop: 40, border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16, overflow: "hidden", background: "rgba(255,255,255,0.025)" }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "26px 0", flex: 1, borderRight: "1px solid rgba(255,255,255,0.06)", gap: 6 }}>
            <span style={{ fontSize: 46, fontWeight: 800, color: isActive ? "#f87171" : "#374151", letterSpacing: -1, lineHeight: 1 }}>{activeStr}</span>
            <span style={{ fontSize: 13, color: "#6b7280" }}>{activeLabel}</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "26px 0", flex: 1, borderRight: "1px solid rgba(255,255,255,0.06)", gap: 6 }}>
            <span style={{ fontSize: 46, fontWeight: 800, color: "#f3f4f6", letterSpacing: -1, lineHeight: 1 }}>{caseStr}</span>
            <span style={{ fontSize: 13, color: "#6b7280" }}>Total cases</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "26px 0", flex: 1, gap: 6 }}>
            <span style={{ fontSize: 46, fontWeight: 800, color: "#f3f4f6", letterSpacing: -1, lineHeight: 1 }}>{countryStr}</span>
            <span style={{ fontSize: 13, color: "#6b7280" }}>{countryLabel}</span>
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
