// Dynamic outbreak card image — 1200×630 (standard OG size, WhatsApp-friendly)
// Access: /api/outbreak-card/{outbreak-id}
// Used by the "Share as image" button in OutbreakDetailModal.

import { ImageResponse } from "next/og";
import { createClient } from "@supabase/supabase-js";
import { NextRequest } from "next/server";

export const runtime = "edge";

const RISK_COLOR: Record<string, string> = {
  high:   "#dc2626",
  medium: "#d97706",
  low:    "#16a34a",
};

const RISK_LABEL: Record<string, Record<string, string>> = {
  high:   { fr: "RISQUE ÉLEVÉ", en: "HIGH RISK", es: "RIESGO ALTO", ar: "خطر عالٍ", id: "RISIKO TINGGI" },
  medium: { fr: "RISQUE MODÉRÉ", en: "MEDIUM RISK", es: "RIESGO MEDIO", ar: "خطر متوسط", id: "RISIKO SEDANG" },
  low:    { fr: "RISQUE FAIBLE", en: "LOW RISK", es: "RIESGO BAJO", ar: "خطر منخفض", id: "RISIKO RENDAH" },
};

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id }   = await params;
  const VALID_LOCALES = new Set(["fr", "en", "es", "ar", "id"]);
  const rawLocale = req.nextUrl.searchParams.get("locale") ?? "en";
  const locale    = VALID_LOCALES.has(rawLocale) ? rawLocale : "en";

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: o } = await supabase
    .from("outbreaks")
    .select("disease, disease_en, country, country_en, cases, deaths, risk_level, date, is_pheic")
    .eq("id", id)
    .single();

  if (!o) {
    return new Response("Not found", { status: 404 });
  }

  const disease  = (locale === "fr" ? o.disease : null) ?? o.disease_en ?? o.disease;
  const country  = o.country_en ?? o.country;
  const color    = RISK_COLOR[o.risk_level]  ?? "#6b7280";
  // Satori (used by ImageResponse) can't shape Arabic glyphs — "lookupType: 5 -
  // substFormat: 3 is not yet supported" — fall back to English for ar, same as
  // the sibling /api/og route.
  const labelLocale = locale === "ar" ? "en" : locale;
  const riskLabel = (RISK_LABEL[o.risk_level] ?? RISK_LABEL.low)[labelLocale] ?? RISK_LABEL.low.en;
  const numLocale = locale === "ar" ? "ar-SA" : locale;
  const hasData  = o.cases > 0;
  const cfr      = hasData ? (o.deaths / o.cases * 100).toFixed(1) + "%" : "—";

  const casesLabel  = { fr: "Cas", en: "Cases", es: "Casos", id: "Kasus" }[labelLocale] ?? "Cases";
  const deathsLabel = { fr: "Décès", en: "Deaths", es: "Fallecidos", id: "Kematian" }[labelLocale] ?? "Deaths";
  const cfrLabel    = { fr: "Létalité", en: "CFR", es: "Letalidad", id: "CFR" }[labelLocale] ?? "CFR";

  return new ImageResponse(
    (
      <div
        style={{
          width: 1200, height: 630,
          display: "flex", flexDirection: "column",
          background: "#0f172a",
          fontFamily: "sans-serif",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Left color accent bar */}
        <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 8, background: color }} />

        {/* Top header */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "40px 60px 0 68px",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {/* Pulse dot */}
            <div style={{ width: 14, height: 14, borderRadius: "50%", background: color }} />
            <span style={{ color: color, fontSize: 14, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase" }}>
              {riskLabel}
            </span>
            {o.is_pheic && (
              <span style={{
                background: "#581c87", border: "1px solid #7e22ce",
                borderRadius: 99, padding: "3px 12px",
                color: "#d8b4fe", fontSize: 12, fontWeight: 700,
              }}>
                🚨 PHEIC
              </span>
            )}
          </div>
          <span style={{ color: "#475569", fontSize: 13 }}>healthwatch-global.com</span>
        </div>

        {/* Main content */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "36px 68px" }}>

          {/* Disease + Country */}
          <div style={{ display: "flex", flexDirection: "column", marginBottom: 40 }}>
            <div style={{ fontSize: 56, fontWeight: 800, color: "white", lineHeight: 1.1, marginBottom: 12 }}>
              {disease}
            </div>
            <div style={{ display: "flex", fontSize: 28, color: "#94a3b8", fontWeight: 500 }}>
              📍 {country} · {o.date}
            </div>
          </div>

          {/* Stats row */}
          <div style={{ display: "flex", gap: 24 }}>
            {[
              { label: casesLabel,  value: hasData ? o.cases.toLocaleString(numLocale) : "—", color: "#60a5fa" },
              { label: deathsLabel, value: hasData ? o.deaths.toLocaleString(numLocale) : "—", color: "#f87171" },
              { label: cfrLabel,    value: cfr,                                        color: "#fbbf24" },
            ].map(({ label, value, color: c }) => (
              <div key={label} style={{
                flex: 1, background: "rgba(255,255,255,0.05)",
                borderRadius: 16, padding: "24px",
                border: "1px solid rgba(255,255,255,0.08)",
                display: "flex", flexDirection: "column", gap: 8,
              }}>
                <span style={{ color: "#64748b", fontSize: 14, textTransform: "uppercase", letterSpacing: 1 }}>{label}</span>
                <span style={{ color: c, fontSize: 42, fontWeight: 800 }}>{value}</span>
              </div>
            ))}
          </div>

        </div>

        {/* Footer */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "20px 68px", borderTop: "1px solid rgba(255,255,255,0.06)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {/* EKG icon */}
            <svg width="28" height="16" viewBox="0 0 28 16" fill="none">
              <polyline points="0,8 4,8 6,2 9,14 12,2 15,14 18,8 28,8"
                stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span style={{ color: "#94a3b8", fontSize: 15, fontWeight: 600 }}>HealthWatch Global</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <span style={{ color: "#475569", fontSize: 13 }}>Sources: WHO · ECDC · PAHO · Africa CDC</span>
          </div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
