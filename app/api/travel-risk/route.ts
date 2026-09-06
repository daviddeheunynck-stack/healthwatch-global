import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import * as Sentry from "@sentry/nextjs";
import { fetchFcdoAdvisory, getGovLinks } from "@/lib/travel-advisory";
import { findCountry } from "@/lib/geo-data";
import {
  getOutbreaks, pickFeaturedDiseases, isFreeFeaturedRow,
  magnitudeBand, cfrSeverityBand, type CfrSeverityBand,
} from "@/lib/outbreaks";

export const dynamic = "force-dynamic";

const BOM   = String.fromCharCode(65279);
const clean = (v: string | undefined) => (v || "").replace(new RegExp("^" + BOM), "").trim();

const SUPABASE_URL     = clean(process.env.NEXT_PUBLIC_SUPABASE_URL);
const SUPABASE_SERVICE = clean(process.env.SUPABASE_SERVICE_ROLE_KEY);

interface ActiveOutbreak {
  id: string;
  disease: string; disease_en: string | null; disease_ar: string | null;
  region: string;
  cases: number | null;
  deaths: number | null;
  risk_level: string;
  date: string;
  is_pheic: boolean;
}

// What actually leaves this route per outbreak: the real figures only for a
// region's free showcase disease, a qualitative band otherwise.
interface TravelOutbreak extends ActiveOutbreak {
  is_free_featured: boolean;
  cases_band: number | null;
  deaths_band: number | null;
  cfr_band: CfrSeverityBand | null;
}

function aggregateRisk(outbreaks: ActiveOutbreak[]): "none" | "low" | "medium" | "high" | "critical" {
  if (!outbreaks.length) return "none";
  if (outbreaks.some((o) => o.is_pheic)) return "critical";
  if (outbreaks.some((o) => o.risk_level === "high")) return "high";
  if (outbreaks.some((o) => o.risk_level === "medium")) return "medium";
  return "low";
}

const RECOMMENDATIONS: Record<string, { en: string; fr: string; es: string; ar: string; id: string }> = {
  none:     { en: "No active outbreaks detected. Standard travel health precautions apply.", fr: "Aucun foyer actif détecté. Précautions habituelles de santé voyage.", es: "Sin brotes activos. Precauciones estándar de salud para viajeros.", ar: "لا تفشيات نشطة. تطبق احتياطات السفر الصحية العادية.", id: "Tidak ada wabah aktif. Tindakan pencegahan kesehatan perjalanan standar berlaku." },
  low:      { en: "Low-risk outbreaks present. Monitor situation and ensure routine vaccinations are up to date.", fr: "Foyers à faible risque. Surveiller la situation et vérifier les vaccinations.", es: "Focos de bajo riesgo. Monitorear la situación y verificar vacunas.", ar: "تفشيات منخفضة المخاطر. راقب الوضع وتأكد من التطعيمات الروتينية.", id: "Wabah risiko rendah. Pantau situasi dan pastikan vaksinasi rutin terkini." },
  medium:   { en: "Moderate risk. Brief travellers on outbreak-specific precautions and consider medical kit.", fr: "Risque modéré. Informer les voyageurs et envisager un kit médical.", es: "Riesgo moderado. Informar a los viajeros sobre precauciones específicas.", ar: "خطر معتدل. أبلغ المسافرين بالاحتياطات المحددة.", id: "Risiko sedang. Beri informasi kepada pelancong tentang tindakan pencegahan." },
  high:     { en: "High risk. Non-essential travel should be reconsidered. Medical pre-travel consultation required.", fr: "Risque élevé. Reconsidérer les voyages non essentiels. Consultation médicale préalable requise.", es: "Riesgo alto. Reconsiderar viajes no esenciales. Consulta médica previa requerida.", ar: "خطر مرتفع. إعادة النظر في السفر غير الضروري. استشارة طبية قبل السفر مطلوبة.", id: "Risiko tinggi. Pertimbangkan kembali perjalanan tidak penting. Konsultasi medis wajib." },
  critical: { en: "CRITICAL — Active PHEIC. Avoid all non-essential travel. Coordinate with security and medical teams.", fr: "CRITIQUE — USPPI en cours. Éviter tout voyage non essentiel. Coordonner avec les équipes sécurité et médicales.", es: "CRÍTICO — ESPII activa. Evitar viajes no esenciales. Coordinar con equipos de seguridad.", ar: "حرج — طوارئ صحية دولية نشطة. تجنب السفر غير الضروري.", id: "KRITIS — KKMMD aktif. Hindari perjalanan tidak penting." },
};

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const locale    = searchParams.get("locale") ?? "en";

  // ?list=1 → return distinct countries that have active outbreaks
  if (searchParams.get("list") === "1") {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE);
    const { data } = await supabase
      .from("outbreaks")
      .select("country_en")
      .eq("active", true)
      .not("country_en", "is", null)
      .order("country_en");
    const countries = [...new Set((data ?? []).map((r) => r.country_en as string))].sort();
    return NextResponse.json({ countries }, { headers: { "Cache-Control": "public, max-age=3600, s-maxage=3600" } });
  }

  const countryEn = searchParams.get("country_en") ?? "";
  if (!countryEn) return NextResponse.json({ error: "country_en required" }, { status: 400 });

  // The country picker (and free-text input) work with canonical ISO English
  // names (e.g. "Democratic Republic of the Congo"), but outbreak rows store
  // the shorter WHO-DON-style alias in country_en (e.g. "DR Congo"). Without
  // resolving through the same alias table the ingestion pipeline already
  // uses (lib/geo-data.ts findCountry — DRC, Ivory Coast, Türkiye, Viet Nam…),
  // an exact-match query against the raw picker value silently returns zero
  // rows for any aliased country, producing a false "no active outbreaks"
  // reassurance on a health/safety decision surface. Found 2026-08-02: picking
  // "Democratic Republic of the Congo" returned risk="none" while the DB's
  // "DR Congo" row was an active Ebola PHEIC with 3,605 cases.
  // Scoped to the outbreaks query only — fetchFcdoAdvisory/getGovLinks below
  // key their own lookup tables by the canonical ISO name (and "DRC"), not by
  // this DB alias, so they keep receiving the original `countryEn` untouched.
  const dbCountryEn = findCountry(countryEn)?.name_en ?? countryEn;

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE);

  const [{ data: outbreaks, error }, fcdo, allActive] = await Promise.all([
    supabase
      .from("outbreaks")
      .select("id, disease, disease_en, disease_ar, region, cases, deaths, risk_level, date, is_pheic")
      .eq("active", true)
      .eq("country_en", dbCountryEn)
      .order("risk_level", { ascending: true }),
    fetchFcdoAdvisory(countryEn),
    // Only used to decide which disease is a region's free showcase, so it
    // is deliberately NOT part of the health/safety path above: getOutbreaks
    // returns [] on failure (it degrades rather than throwing), which yields
    // an empty featured map, which masks EVERY row. The mask fails closed;
    // the risk verdict keeps its own query and its own 503.
    getOutbreaks(),
  ]);

  // A failed query previously fell through `outbreaks ?? []` into
  // aggregateRisk([]) === "none", so a transient Supabase error (including
  // the recurring "TypeError: terminated" egress errors already seen in
  // production) produced a real "No active outbreaks detected — standard
  // precautions apply" travel advisory, cached `public`/`s-maxage=3600` —
  // broadcasting a false all-clear to every visitor checking that country
  // for up to an hour. This is a health/safety decision surface, not just a
  // data widget: fail loudly instead, and never cache the failure.
  if (error) {
    console.error(`[travel-risk] outbreaks query failed for ${countryEn}:`, error.message);
    Sentry.captureException(new Error(`[travel-risk] query failed: ${error.message}`), {
      tags: { route: "travel-risk", country: countryEn },
    });
    return NextResponse.json(
      { error: "temporarily_unavailable" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  const active = (outbreaks ?? []) as ActiveOutbreak[];
  const risk   = aggregateRisk(active);
  const lang   = locale in RECOMMENDATIONS.none ? locale : "en";

  // This page is public and its response is cached `public` for an hour, so
  // it carries the same mask as the disease/country/region hub pages — the
  // same output for every visitor, with a paid viewer's real figures filled
  // in client-side afterwards (RealStatsProvider → /api/outbreak-stats).
  // Until 2026-09-06 the route returned exact cases/deaths with no auth of
  // any kind: `?list=1` names the 80 countries holding an active row, so 81
  // anonymous requests recovered 96 of 96 masked rows in clear — including
  // the Ebola/DR Congo figures that fd646a97 had closed on /compare that
  // morning. Only the per-outbreak figures are masked: the risk verdict,
  // the recommendation, the FCDO advisory and the government links are not
  // numbers and stay exactly as they were.
  const featuredDiseaseByRegion = pickFeaturedDiseases(allActive.filter((o) => o.active));
  const masked: TravelOutbreak[] = active.map((o) => {
    const featured = isFreeFeaturedRow(o, featuredDiseaseByRegion);
    const cases  = o.cases ?? 0;
    const deaths = o.deaths;
    return {
      ...o,
      cases:  featured ? o.cases  : 0,
      deaths: featured ? o.deaths : null,
      is_free_featured: featured,
      cases_band:  featured ? null : magnitudeBand(cases),
      deaths_band: featured ? null : (deaths === null ? null : magnitudeBand(deaths)),
      cfr_band:    featured ? null : cfrSeverityBand(cases, deaths),
    };
  });

  return NextResponse.json({
    country_en: countryEn,
    risk,
    outbreaks: masked,
    recommendation: RECOMMENDATIONS[risk][lang as keyof typeof RECOMMENDATIONS["none"]],
    fcdo:     fcdo ?? null,
    govLinks: getGovLinks(countryEn),
    checked_at: new Date().toISOString(),
  }, { headers: { "Cache-Control": "public, max-age=3600, s-maxage=3600" } });
}
