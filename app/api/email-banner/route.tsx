// Email footer banner — 600×140px, fits standard email width.
// Access: https://healthwatch-global.com/api/email-banner
// Paste into Gmail signature as an image, or use the HTML signature below it.

import { ImageResponse } from "next/og";

export const runtime = "edge";

export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 600,
          height: 140,
          display: "flex",
          alignItems: "center",
          background: "#0f172a",
          position: "relative",
          overflow: "hidden",
          padding: "0 36px",
        }}
      >
        {/* Left red accent bar */}
        <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 6, background: "#dc2626" }} />

        {/* Logo block */}
        <div style={{ display: "flex", alignItems: "center", gap: 16, flex: 1 }}>
          {/* Icon */}
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 12,
              background: "#dc2626",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg width="34" height="22" viewBox="0 0 44 30" fill="none">
              <polyline
                points="0,15 8,15 13,3 18,27 23,3 28,27 33,15 44,15"
                stroke="white"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>

          {/* Name + tagline */}
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: 26, fontWeight: 800, color: "white", letterSpacing: "-0.5px", fontFamily: "sans-serif" }}>
              HealthWatch Global
            </span>
            <span style={{ fontSize: 14, color: "#94a3b8", fontFamily: "sans-serif" }}>
              Real-time epidemic surveillance · WHO official data
            </span>
          </div>
        </div>

        {/* Right — URL pill */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            background: "rgba(220,38,38,0.15)",
            border: "1px solid rgba(220,38,38,0.3)",
            borderRadius: 999,
            padding: "8px 16px",
          }}
        >
          <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#dc2626" }} />
          <span style={{ fontSize: 14, color: "#e2e8f0", fontFamily: "sans-serif", fontWeight: 600 }}>
            healthwatch-global.com
          </span>
        </div>

        {/* Bottom red line accent */}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: 2,
            background: "linear-gradient(90deg, #dc2626, transparent)",
          }}
        />
      </div>
    ),
    { width: 600, height: 140 }
  );
}
