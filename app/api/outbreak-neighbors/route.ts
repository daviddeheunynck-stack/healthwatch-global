import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { haversineKm } from "@/lib/haversine";
import { getCountryCoords } from "@/lib/country-coords";

export const dynamic = "force-dynamic";

const BOM   = String.fromCharCode(65279);
const clean = (v: string | undefined) => (v || "").replace(new RegExp("^" + BOM), "").trim();

const SUPABASE_URL     = clean(process.env.NEXT_PUBLIC_SUPABASE_URL);
const SUPABASE_SERVICE = clean(process.env.SUPABASE_SERVICE_ROLE_KEY);

const RADIUS_KM = 1500;

export async function GET(req: Request) {
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

  const { data: outbreaks } = await supabase
    .from("outbreaks")
    .select("id, disease_en, country_en, cases, deaths, risk_level, date, lat, lng")
    .eq("active", true)
    .neq("country_en", countryEn);

  if (!outbreaks?.length) return NextResponse.json({ neighbors: [] });

  const neighbors = (outbreaks as {
    id: string; disease_en: string | null; country_en: string | null;
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

  return NextResponse.json({ neighbors });
}
