// Twitter/X banner — 1500×500px
// Access via: https://healthwatch-global.com/api/twitter-banner

import { ImageResponse } from "next/og";

export const runtime = "edge";

export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width:          1500,
          height:         500,
          display:        "flex",
          alignItems:     "center",
          justifyContent: "space-between",
          background:     "#0f172a",
          position:       "relative",
          overflow:       "hidden",
          padding:        "0 100px",
        }}
      >
        {/* Background grid dots */}
        {Array.from({ length: 12 }).map((_, col) =>
          Array.from({ length: 5 }).map((_, row) => (
            <div
              key={`${col}-${row}`}
              style={{
                position:        "absolute",
                width:           3,
                height:          3,
                borderRadius:    "50%",
                background:      "rgba(220,38,38,0.15)",
                left:            col * 130 + 40,
                top:             row * 110 + 30,
              }}
            />
          ))
        )}

        {/* Red glow left */}
        <div
          style={{
            position:     "absolute",
            left:         -100,
            top:          "50%",
            transform:    "translateY(-50%)",
            width:        500,
            height:       500,
            borderRadius: "50%",
            background:   "radial-gradient(circle, rgba(220,38,38,0.12) 0%, transparent 70%)",
          }}
        />

        {/* Left — branding */}
        <div
          style={{
            display:        "flex",
            flexDirection:  "column",
            gap:            20,
            zIndex:         1,
          }}
        >
          {/* Logo row */}
          <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
            {/* Icon */}
            <div
              style={{
                width:          72,
                height:         72,
                borderRadius:   16,
                background:     "#dc2626",
                display:        "flex",
                alignItems:     "center",
                justifyContent: "center",
              }}
            >
              <svg width="44" height="30" viewBox="0 0 44 30" fill="none">
                <polyline
                  points="0,15 8,15 13,3 18,27 23,3 28,27 33,15 44,15"
                  stroke="white"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>

            {/* Name */}
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <span style={{ fontSize: 42, fontWeight: 800, color: "white", fontFamily: "sans-serif", letterSpacing: "-1px" }}>
                HealthWatch
              </span>
              <span style={{ fontSize: 18, fontWeight: 400, color: "rgba(255,255,255,0.5)", fontFamily: "sans-serif", letterSpacing: "6px", textTransform: "uppercase" }}>
                Global
              </span>
            </div>
          </div>

          {/* Tagline */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <span style={{ fontSize: 26, fontWeight: 600, color: "rgba(255,255,255,0.9)", fontFamily: "sans-serif" }}>
              Daily epidemic surveillance
            </span>
            <span style={{ fontSize: 18, color: "rgba(255,255,255,0.45)", fontFamily: "sans-serif" }}>
              WHO official data · 5 languages · Free to start
            </span>
          </div>

          {/* URL badge */}
          <div
            style={{
              display:       "flex",
              alignItems:    "center",
              gap:           10,
              background:    "rgba(220,38,38,0.15)",
              border:        "1px solid rgba(220,38,38,0.3)",
              borderRadius:  999,
              padding:       "8px 20px",
              width:         "fit-content",
              marginTop:     8,
            }}
          >
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#dc2626" }} />
            <span style={{ fontSize: 16, color: "rgba(255,255,255,0.7)", fontFamily: "sans-serif" }}>
              healthwatch-global.com
            </span>
          </div>
        </div>

        {/* Right — EKG visualization */}
        <div
          style={{
            display:        "flex",
            flexDirection:  "column",
            alignItems:     "flex-end",
            gap:            16,
            zIndex:         1,
          }}
        >
          {/* Large EKG line */}
          <svg width="520" height="120" viewBox="0 0 520 120" fill="none">
            {/* Glow effect */}
            <polyline
              points="0,60 80,60 110,60 130,10 155,110 180,10 205,110 230,60 310,60 340,60 370,60 520,60"
              stroke="rgba(220,38,38,0.3)"
              strokeWidth="8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {/* Main line */}
            <polyline
              points="0,60 80,60 110,60 130,10 155,110 180,10 205,110 230,60 310,60 340,60 370,60 520,60"
              stroke="#dc2626"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {/* Pulse dot */}
            <circle cx="310" cy="60" r="6" fill="#dc2626" />
            <circle cx="310" cy="60" r="12" fill="rgba(220,38,38,0.25)" />
          </svg>

          {/* Stats pills */}
          <div style={{ display: "flex", gap: 12 }}>
            {[
              { label: "Outbreaks", value: "Live", color: "#dc2626" },
              { label: "Languages", value: "5", color: "#3b82f6" },
              { label: "Sources", value: "4 official", color: "#10b981" },
            ].map(({ label, value, color }) => (
              <div
                key={label}
                style={{
                  display:       "flex",
                  flexDirection: "column",
                  alignItems:    "center",
                  background:    "rgba(255,255,255,0.04)",
                  border:        "1px solid rgba(255,255,255,0.08)",
                  borderRadius:  12,
                  padding:       "10px 20px",
                  gap:           4,
                }}
              >
                <span style={{ fontSize: 22, fontWeight: 700, color, fontFamily: "sans-serif" }}>{value}</span>
                <span style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", fontFamily: "sans-serif" }}>{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom red line accent */}
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
    { width: 1500, height: 500 }
  );
}
