import Link from "next/link";
import { Activity, AlertTriangle } from "lucide-react";

export default function RootNotFound() {
  return (
    <html lang="en">
      <body style={{ margin: 0, backgroundColor: "#030712", fontFamily: "system-ui, sans-serif" }}>
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "24px",
            color: "#f9fafb",
            padding: "24px",
            textAlign: "center",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
            <Activity color="#ef4444" width={28} height={28} />
            <span style={{ fontWeight: 700, fontSize: "18px", color: "#f9fafb" }}>HealthWatch Global</span>
          </div>
          <AlertTriangle color="#ef4444" width={56} height={56} />
          <div>
            <h1 style={{ fontSize: "48px", fontWeight: 800, margin: 0, color: "#ffffff" }}>404</h1>
            <p style={{ color: "#9ca3af", marginTop: "8px", fontSize: "16px" }}>Page not found</p>
          </div>
          <Link
            href="/en"
            style={{
              backgroundColor: "#dc2626",
              color: "#ffffff",
              padding: "10px 28px",
              borderRadius: "8px",
              textDecoration: "none",
              fontWeight: 600,
              fontSize: "14px",
            }}
          >
            Back to dashboard
          </Link>
        </div>
      </body>
    </html>
  );
}
