import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { getOutbreaks } from "@/lib/outbreaks";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  // ── Rate limit: 20 exports / IP / hour ──────────────────────────────────────
  const ip = getClientIp(request);
  const rl = rateLimit(`export:${ip}`, { limit: 20, windowMs: 60 * 60 * 1000 });
  if (!rl.allowed) {
    return new NextResponse("Too Many Requests", {
      status: 429,
      headers: { "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)) },
    });
  }

  // ── Auth check ───────────────────────────────────────────────────────────────
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return new NextResponse("Unauthorized — please sign in", { status: 401 });
  }

  // ── Plan check ───────────────────────────────────────────────────────────────
  const { data: profile } = await supabase
    .from("profiles")
    .select("plan")
    .eq("id", user.id)
    .single();

  const plan = profile?.plan ?? "free";
  const isPaid = plan === "starter" || plan === "pro" || plan === "enterprise";

  if (!isPaid) {
    return new NextResponse("Upgrade to Pro to export data", { status: 403 });
  }

  // ── Build CSV ────────────────────────────────────────────────────────────────
  const { getIncidenceRate } = await import("@/lib/population-data");
  const outbreaks = await getOutbreaks();

  const escape = (s: string | number | null | undefined) => {
    const str = String(s ?? "");
    return str.includes(",") || str.includes('"') || str.includes("\n")
      ? `"${str.replace(/"/g, '""')}"`
      : str;
  };

  const CSV_HEADERS = [
    "id", "disease", "country", "region",
    "lat", "lng", "cases", "deaths",
    "cfr_%", "incidence_per_100k",
    "risk_level", "date", "source",
    "pheic", "corroborated", "promed_source",
  ];

  const rows = outbreaks.map((o) => {
    const cfr = o.cases > 0 ? (o.deaths / o.cases * 100).toFixed(1) : "";
    const incidence = getIncidenceRate(o.cases, o.country_en);
    return [
      escape(o.id),
      escape(o.disease_en || o.disease),
      escape(o.country_en || o.country),
      escape(o.region),
      o.lat,
      o.lng,
      o.cases,
      o.deaths,
      cfr,
      incidence !== null ? incidence.toFixed(2) : "",
      escape(o.risk_level),
      escape(o.date),
      escape(o.source),
      o.is_pheic ? "YES" : "NO",
      o.corroborated ? "YES" : "NO",
      escape(o.promed_source ?? ""),
    ];
  });

  const csv = [CSV_HEADERS.join(","), ...rows.map((r) => r.join(","))].join("\n");
  const filename = `healthwatch-outbreaks-${new Date().toISOString().split("T")[0]}.csv`;

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store, no-cache",
    },
  });
}
