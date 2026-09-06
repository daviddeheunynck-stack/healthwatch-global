import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase-server";
import { resolvedPlan } from "@/lib/resolved-plan";
import { haversineKm } from "@/lib/haversine";
import { getCountryCoords } from "@/lib/country-coords";
import * as Sentry from "@sentry/nextjs";

export const dynamic = "force-dynamic";

const BOM   = String.fromCharCode(65279);
const clean = (v: string | undefined) => (v || "").replace(new RegExp("^" + BOM), "").trim();

const SUPABASE_URL     = clean(process.env.NEXT_PUBLIC_SUPABASE_URL);
const SUPABASE_SERVICE = clean(process.env.SUPABASE_SERVICE_ROLE_KEY);

const RADIUS_KM = 1500;

export async function GET(req: Request) {
  // Paid gate. This route returns exact cases/deaths for every active
  // outbreak within 1500 km of the origin — the same figures the
  // qualitative-band mask hides from anonymous and free viewers on every
  // page — and it had no auth check at all: 81 anonymous requests (one per
  // country listed by /api/travel-risk?list=1) pulled 87 of the 96 masked
  // rows in clear. It has exactly one caller, already paid-only
  // (OutbreakDetailModal.tsx, under `if (!outbreak || !isPaid) return`), so
  // gating it like its six sibling panel routes changes no interface.
  // Found 2026-09-06, after that day's page-by-page paywall sweep.
  const auth = await createServerClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await auth
    .from("profiles")
    .select("plan, trial_ends_at, stripe_subscription_id")
    .eq("id", user.id)
    .single();

  if (!["starter", "pro", "team", "enterprise"].includes(resolvedPlan(profile)))
    return NextResponse.json({ error: "Pro plan required" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const countryEn = searchParams.get("country_en") ?? "";
  const latParam  = searchParams.get("lat");
  const lngParam  = searchParams.get("lng");

  const originCoords =
    latParam && lngParam
      ? ([parseFloat(latParam), parseFloat(lngParam)] as [number, number])
      : getCountryCoords(countryEn);

  if (!originCoords) return NextResponse.json({ neighbors: [] });

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE);

  const { data: outbreaks, error } = await supabase
    .from("outbreaks")
    .select("id, disease, disease_en, disease_ar, country, country_en, country_ar, cases, deaths, risk_level, date, lat, lng")
    .eq("active", true)
    .neq("country_en", countryEn);

  // Cached 1h (privately, see the gate above) — same fix as
  // travel-risk/outbreak-history-by-country: a failed query must not render
  // as "no nearby outbreaks" for an hour.
  if (error) {
    console.error("[outbreak-neighbors] query failed:", error.message);
    Sentry.captureException(new Error(`[outbreak-neighbors] query failed: ${error.message}`), { tags: { route: "outbreak-neighbors", country: countryEn } });
    return NextResponse.json({ error: "Failed to load nearby outbreaks" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }

  if (!outbreaks?.length) return NextResponse.json({ neighbors: [] });

  const neighbors = (outbreaks as {
    id: string;
    disease: string; disease_en: string | null; disease_ar: string | null;
    country: string; country_en: string | null; country_ar: string | null;
    cases: number; deaths: number; risk_level: string; date: string;
    lat: number; lng: number;
  }[])
    .map((o) => {
      const coords = (o.lat && o.lng)
        ? [o.lat, o.lng] as [number, number]
        : getCountryCoords(o.country_en);
      if (!coords) return null;
      const distKm = haversineKm(originCoords[0], originCoords[1], coords[0], coords[1]);
      return distKm <= RADIUS_KM ? { ...o, distKm: Math.round(distKm) } : null;
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .sort((a, b) => a.distKm - b.distKm)
    .slice(0, 10);

  // `private` since the paid gate above: a shared/CDN cache holding this
  // response would hand a paid viewer's exact figures to the next anonymous
  // request for the same country, re-opening the hole the gate just closed.
  return NextResponse.json({ neighbors }, { headers: { "Cache-Control": "private, max-age=3600" } });
}
