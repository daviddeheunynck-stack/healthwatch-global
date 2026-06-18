// OG image — 1200×630px (standard Open Graph / Twitter Card)
// Access via: https://healthwatch-global.com/api/og
// Supports ?locale=fr|en|es|ar|id for localized taglines

import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";

export const runtime = "edge";

// Note: Satori (used by ImageResponse) only supports Latin-based scripts without
// a custom font. Arabic is not rendered — fall back to English for ar locale.
const TAGLINES: Record<string, { line1: string; line2: string }> = {
  en: { line1: "Epidemic surveillance for epidemiologists", line2: "WHO · ECDC · PAHO · Africa CDC · Free to start" },
  fr: { line1: "Surveillance épidémique pour épidémiologistes", line2: "OMS · ECDC · PAHO · Africa CDC · Gratuit" },
  es: { line1: "Vigilancia epidémica para epidemiólogos", line2: "OMS · ECDC · PAHO · Africa CDC · Gratis" },
  ar: { line1: "Epidemic surveillance for epidemiologists", line2: "WHO · ECDC · PAHO · Africa CDC · Free to start" },
  id: { line1: "Pemantauan wabah untuk epidemiolog", line2: "WHO · ECDC · PAHO · Africa CDC · Gratis" },
};

export async function GET(req: NextRequest) {
  const locale = req.nextUrl.searchParams.get("locale") ?? "en";
  const t = TAGLINES[locale] ?? TAGLINES.en;

  // Materialise the image so we can attach long-lived cache headers.
  // The image is purely static per-locale — no runtime data — so we can
  // cache aggressively on the Vercel CDN (s-maxage) and browser (max-age).
  const img = new ImageResponse(
    (
      <div
        style={{
          width:          1200,
          height:         630,
          display:        "flex",
          flexDirection:  "column",
          alignItems:     "center",
          justifyContent: "center",
          background:     "#0f172a",
          position:       "relative",
          overflow:       "hidden",
        }}
      >
        {/* Background dot grid */}
        {Array.from({ length: 10 }).map((_, col) =>
          Array.from({ length: 7 }).map((_, row) => (
            <div
              key={`${col}-${row}`}
              style={{
                position:     "absolute",
                width:        3,
                height:       3,
                borderRadius: "50%",
                background:   "rgba(220,38,38,0.12)",
                left:         col * 125 + 50,
                top:          row * 95 + 30,
              }}
            />
          ))
        )}

        {/* Red radial glow — top center */}
        <div
          style={{
            position:     "absolute",
            top:          -200,
            left:         "50%",
            transform:    "translateX(-50%)",
            width:        800,
            height:       800,
            borderRadius: "50%",
            background:   "radial-gradient(circle, rgba(220,38,38,0.10) 0%, transparent 65%)",
          }}
        />

        {/* EKG line — background decorative */}
        <div style={{ position: "absolute", top: 60, right: 60, display: "flex" }}>
          <svg width="320" height="80" viewBox="0 0 320 80" fill="none">
            <polyline
              points="0,40 50,40 70,40 85,8 100,72 115,8 130,72 145,40 200,40 230,40 320,40"
              stroke="rgba(220,38,38,0.20)"
              strokeWidth="6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <polyline
              points="0,40 50,40 70,40 85,8 100,72 115,8 130,72 145,40 200,40 230,40 320,40"
              stroke="rgba(220,38,38,0.55)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <circle cx="200" cy="40" r="5" fill="#dc2626" />
            <circle cx="200" cy="40" r="10" fill="rgba(220,38,38,0.25)" />
          </svg>
        </div>

        {/* Center content */}
        <div
          style={{
            display:        "flex",
            flexDirection:  "column",
            alignItems:     "center",
            gap:            32,
            padding:        "0 80px",
          }}
        >
          {/* Logo row */}
          <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
            {/* Icon */}
            <div
              style={{
                width:          80,
                height:         80,
                borderRadius:   20,
                background:     "#dc2626",
                display:        "flex",
                alignItems:     "center",
                justifyContent: "center",
                boxShadow:      "0 0 40px rgba(220,38,38,0.4)",
              }}
            >
              <svg width="48" height="32" viewBox="0 0 48 32" fill="none">
                <polyline
                  points="0,16 9,16 14,3 19,29 24,3 29,29 34,16 48,16"
                  stroke="white"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>

            {/* Name */}
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <span
                style={{
                  fontSize:      56,
                  fontWeight:    800,
                  color:         "white",
                  fontFamily:    "sans-serif",
                  letterSpacing: "-1.5px",
                  lineHeight:    1,
                }}
              >
                HealthWatch
              </span>
              <span
                style={{
                  fontSize:      20,
                  fontWeight:    400,
                  color:         "rgba(255,255,255,0.45)",
                  fontFamily:    "sans-serif",
                  letterSpacing: "7px",
                  textTransform: "uppercase",
                }}
              >
                Global
              </span>
            </div>
          </div>

          {/* Tagline */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
            <span
              style={{
                fontSize:   30,
                fontWeight: 600,
                color:      "rgba(255,255,255,0.90)",
                fontFamily: "sans-serif",
                textAlign:  "center",
              }}
            >
              {t.line1}
            </span>
            <span
              style={{
                fontSize:   20,
                color:      "rgba(255,255,255,0.45)",
                fontFamily: "sans-serif",
                textAlign:  "center",
              }}
            >
              {t.line2}
            </span>
          </div>

          {/* Stats row */}
          <div style={{ display: "flex", gap: 16, marginTop: 8 }}>
            {[
              { value: "LIVE", label: "Outbreaks",       color: "#dc2626" },
              { value: "4",    label: "Official sources", color: "#10b981" },
              { value: "5",    label: "Languages",       color: "#3b82f6" },
              { value: "Free", label: "To start",        color: "#f59e0b" },
            ].map(({ value, label, color }) => (
              <div
                key={label}
                style={{
                  display:        "flex",
                  flexDirection:  "column",
                  alignItems:     "center",
                  background:     "rgba(255,255,255,0.04)",
                  border:         "1px solid rgba(255,255,255,0.08)",
                  borderRadius:   14,
                  padding:        "12px 24px",
                  gap:            4,
                  minWidth:       100,
                }}
              >
                <span style={{ fontSize: 24, fontWeight: 700, color, fontFamily: "sans-serif" }}>
                  {value}
                </span>
                <span style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", fontFamily: "sans-serif" }}>
                  {label}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* URL badge — bottom */}
        <div
          style={{
            position:      "absolute",
            bottom:        40,
            display:       "flex",
            alignItems:    "center",
            gap:           10,
            background:    "rgba(220,38,38,0.12)",
            border:        "1px solid rgba(220,38,38,0.25)",
            borderRadius:  999,
            padding:       "8px 24px",
          }}
        >
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#dc2626" }} />
          <span style={{ fontSize: 16, color: "rgba(255,255,255,0.6)", fontFamily: "sans-serif" }}>
            healthwatch-global.com
          </span>
        </div>

        {/* Bottom red line */}
        <div
          style={{
            position:   "absolute",
            bottom:     0,
            left:       0,
            right:      0,
            height:     3,
            background: "linear-gradient(90deg, transparent, #dc2626 30%, #dc2626 70%, transparent)",
          }}
        />
      </div>
    ),
    { width: 1200, height: 630 }
  );

  // Buffer the PNG, then re-wrap with cache headers.
  // Cold-start on the edge can be 4-6s; after CDN caches this, TTFB ≈ 20ms.
  const buf = await img.arrayBuffer();
  return new Response(buf, {
    status: 200,
    headers: {
      "Content-Type":  "image/png",
      // CDN caches for 7 days, browsers for 1 hour, stale-while-revalidate for 30 days.
      "Cache-Control": "public, max-age=3600, s-maxage=604800, stale-while-revalidate=2592000",
    },
  });
}
