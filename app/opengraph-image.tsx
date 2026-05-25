import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "HealthWatch Global — Real-time epidemic surveillance";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#030712",
          fontFamily: "system-ui, sans-serif",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Background glow */}
        <div
          style={{
            position: "absolute",
            top: -120,
            left: "50%",
            transform: "translateX(-50%)",
            width: 600,
            height: 600,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(220,38,38,0.15) 0%, transparent 70%)",
          }}
        />

        {/* Dot grid suggestion — subtle */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage:
              "radial-gradient(circle, rgba(255,255,255,0.03) 1px, transparent 1px)",
            backgroundSize: "32px 32px",
          }}
        />

        {/* Logo row */}
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 28 }}>
          {/* Activity icon */}
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
            <polyline
              points="22 12 18 12 15 21 9 3 6 12 2 12"
              stroke="#ef4444"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span style={{ fontSize: 42, fontWeight: 800, color: "#ffffff", letterSpacing: -1 }}>
            HealthWatch Global
          </span>
        </div>

        {/* Tagline */}
        <p
          style={{
            fontSize: 22,
            color: "#9ca3af",
            margin: 0,
            marginBottom: 48,
            maxWidth: 680,
            textAlign: "center",
            lineHeight: 1.4,
          }}
        >
          Real-time epidemic intelligence for health organizations worldwide
        </p>

        {/* Stats row */}
        <div
          style={{
            display: "flex",
            gap: 48,
            padding: "20px 48px",
            background: "rgba(255,255,255,0.04)",
            borderRadius: 16,
            border: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          {[
            { value: "195", label: "Countries" },
            { value: "5", label: "Languages" },
            { value: "24/7", label: "Live data" },
            { value: "WHO · CDC · ECDC", label: "Sources" },
          ].map(({ value, label }) => (
            <div
              key={label}
              style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}
            >
              <span style={{ fontSize: 26, fontWeight: 700, color: "#ffffff" }}>{value}</span>
              <span style={{ fontSize: 13, color: "#6b7280" }}>{label}</span>
            </div>
          ))}
        </div>

        {/* URL badge */}
        <div
          style={{
            position: "absolute",
            bottom: 32,
            right: 48,
            display: "flex",
            alignItems: "center",
            gap: 8,
            color: "#4b5563",
            fontSize: 14,
          }}
        >
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: "#22c55e",
            }}
          />
          healthwatch-global.com
        </div>
      </div>
    ),
    { ...size }
  );
}
