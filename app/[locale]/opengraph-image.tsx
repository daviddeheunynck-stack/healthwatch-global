import { ImageResponse } from "next/og";
import { createClient } from "@supabase/supabase-js";

export const alt = "Epidemic surveillance — HealthWatch Global";
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

export default async function HomeOgImage() {
  const supabase = createClient(
    clean(process.env.NEXT_PUBLIC_SUPABASE_URL),
    clean(process.env.SUPABASE_SERVICE_ROLE_KEY)
  );

  const { data } = await supabase
    .from("outbreaks")
    .select("active, cases, country_en");

  const rows = (data ?? []) as { active: boolean; cases: number | null; country_en: string | null }[];

  const activeCount   = rows.filter((o) => o.active).length;
  const totalCases    = rows.reduce((s, o) => s + (o.cases ?? 0), 0);
  const countryCount  = new Set(rows.map((o) => o.country_en).filter(Boolean)).size;
  const isActive      = activeCount > 0;

  const activeStr  = String(activeCount);
  const caseStr    = totalCases > 0 ? fmt(totalCases) : "—";
  const countryStr = countryCount > 0 ? String(countryCount) : "—";
  const outbreakWord = activeCount === 1 ? "ACTIVE OUTBREAK" : "ACTIVE OUTBREAKS";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%", height: "100%",
          display: "flex", flexDirection: "column",
          backgroundColor: "#030712",
          fontFamily: "system-ui, sans-serif",
          position: "relative", overflow: "hidden",
        }}
      >
        {/* Background glow — centered */}
        <div style={{
          position: "absolute", top: -200, left: "50%",
          width: 800, height: 800, borderRadius: "50%",
          background: isActive
            ? "radial-gradient(circle, rgba(220,38,38,0.14) 0%, transparent 60%)"
            : "radial-gradient(circle, rgba(59,130,246,0.12) 0%, transparent 60%)",
          transform: "translateX(-50%)",
        }} />
        {/* Dot grid */}
        <div style={{
          position: "absolute", inset: 0,
          backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.022) 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }} />
        {/* Bottom accent line */}
        <div style={{
          position: "absolute", bottom: 0, left: 0, right: 0, height: 3,
          background: "linear-gradient(90deg, transparent, #dc2626 30%, #dc2626 70%, transparent)",
        }} />

        {/* Main content */}
        <div style={{
          display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          flex: 1, padding: "56px 72px", position: "relative", zIndex: 1,
          gap: 0,
        }}>
          {/* Logo row */}
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 40 }}>
            <div style={{
              width: 52, height: 52, borderRadius: 14,
              background: "#dc2626", display: "flex",
              alignItems: "center", justifyContent: "center",
              boxShadow: "0 0 28px rgba(220,38,38,0.45)",
            }}>
              <svg width="32" height="22" viewBox="0 0 48 32" fill="none">
                <polyline points="0,16 9,16 14,3 19,29 24,3 29,29 34,16 48,16" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
              <span style={{ fontSize: 26, fontWeight: 800, color: "#ffffff", letterSpacing: -0.5, lineHeight: 1 }}>HealthWatch</span>
              <span style={{ fontSize: 11, fontWeight: 400, color: "rgba(255,255,255,0.4)", letterSpacing: 5, textTransform: "uppercase" }}>Global</span>
            </div>
          </div>

          {/* Big stat */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 16 }}>
              <span style={{
                fontSize: 110, fontWeight: 900,
                color: isActive ? "#f87171" : "#374151",
                letterSpacing: -4, lineHeight: 1,
              }}>{activeStr}</span>
            </div>
            <span style={{
              fontSize: 22, fontWeight: 700,
              color: isActive ? "rgba(248,113,113,0.7)" : "rgba(55,65,81,0.7)",
              letterSpacing: 4, textTransform: "uppercase",
            }}>{outbreakWord}</span>
          </div>

          {/* Sources */}
          <div style={{ display: "flex", gap: 12, marginTop: 28, marginBottom: 36 }}>
            {["WHO", "ECDC", "PAHO", "Africa CDC"].map((src) => (
              <div key={src} style={{
                display: "flex", padding: "5px 14px", borderRadius: 20,
                background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)",
              }}>
                <span style={{ fontSize: 13, color: "#6b7280" }}>{src}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Stats bar at bottom */}
        <div style={{
          display: "flex", position: "relative", zIndex: 1,
          margin: "0 72px 56px",
          border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16,
          overflow: "hidden", background: "rgba(255,255,255,0.025)",
        }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "20px 0", flex: 1, borderRight: "1px solid rgba(255,255,255,0.06)", gap: 5 }}>
            <span style={{ fontSize: 38, fontWeight: 800, color: "#f3f4f6", letterSpacing: -1, lineHeight: 1 }}>{caseStr}</span>
            <span style={{ fontSize: 12, color: "#6b7280" }}>Cases tracked</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "20px 0", flex: 1, borderRight: "1px solid rgba(255,255,255,0.06)", gap: 5 }}>
            <span style={{ fontSize: 38, fontWeight: 800, color: "#f3f4f6", letterSpacing: -1, lineHeight: 1 }}>{countryStr}</span>
            <span style={{ fontSize: 12, color: "#6b7280" }}>Countries monitored</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "20px 0", flex: 1, borderRight: "1px solid rgba(255,255,255,0.06)", gap: 5 }}>
            <span style={{ fontSize: 38, fontWeight: 800, color: "#10b981", letterSpacing: -1, lineHeight: 1 }}>4</span>
            <span style={{ fontSize: 12, color: "#6b7280" }}>Official sources</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "20px 0", flex: 1, gap: 5 }}>
            <span style={{ fontSize: 38, fontWeight: 800, color: "#f59e0b", letterSpacing: -1, lineHeight: 1 }}>Free</span>
            <span style={{ fontSize: 12, color: "#6b7280" }}>To start</span>
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
