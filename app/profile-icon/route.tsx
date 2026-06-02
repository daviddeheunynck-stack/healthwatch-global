// Generates a 400×400 PNG — ideal size for Twitter/X, LinkedIn, and other social profiles.
// Access via: https://healthwatch-global.com/profile-icon

import { ImageResponse } from "next/og";

export const runtime = "edge";

export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width:          400,
          height:         400,
          display:        "flex",
          alignItems:     "center",
          justifyContent: "center",
          background:     "linear-gradient(135deg, #b91c1c 0%, #dc2626 50%, #ef4444 100%)",
          borderRadius:   0,
        }}
      >
        {/* Inner card */}
        <div
          style={{
            width:          320,
            height:         320,
            display:        "flex",
            flexDirection:  "column",
            alignItems:     "center",
            justifyContent: "center",
            gap:            24,
          }}
        >
          {/* EKG / pulse line */}
          <svg
            width="240"
            height="80"
            viewBox="0 0 240 80"
            fill="none"
          >
            <polyline
              points="0,40 40,40 60,8 80,72 100,8 120,72 140,40 200,40 220,40 240,40"
              stroke="white"
              strokeWidth="6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>

          {/* Wordmark */}
          <div
            style={{
              display:       "flex",
              flexDirection: "column",
              alignItems:    "center",
              gap:           4,
            }}
          >
            <span
              style={{
                fontSize:   36,
                fontWeight: 800,
                color:      "white",
                letterSpacing: "-1px",
                fontFamily: "sans-serif",
              }}
            >
              HealthWatch
            </span>
            <span
              style={{
                fontSize:      18,
                fontWeight:    400,
                color:         "rgba(255,255,255,0.75)",
                letterSpacing: "4px",
                fontFamily:    "sans-serif",
                textTransform: "uppercase",
              }}
            >
              Global
            </span>
          </div>
        </div>
      </div>
    ),
    {
      width:  400,
      height: 400,
    }
  );
}
