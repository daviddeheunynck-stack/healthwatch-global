import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const BOM   = String.fromCharCode(65279);
const clean = (v: string | undefined) => (v || "").replace(new RegExp("^" + BOM), "").trim();

const SUPABASE_URL     = clean(process.env.NEXT_PUBLIC_SUPABASE_URL);
const SUPABASE_SERVICE = clean(process.env.SUPABASE_SERVICE_ROLE_KEY);

interface ActiveOutbreak {
  id: string;
  disease_en: string | null;
  cases: number;
  deaths: number;
  risk_level: string;
  date: string;
  is_pheic: boolean;
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

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE);

  const { data: outbreaks } = await supabase
    .from("outbreaks")
    .select("id, disease_en, cases, deaths, risk_level, date, is_pheic")
    .eq("active", true)
    .eq("country_en", countryEn)
    .order("risk_level", { ascending: true });

  const active = (outbreaks ?? []) as ActiveOutbreak[];
  const risk   = aggregateRisk(active);
  const lang   = locale in RECOMMENDATIONS.none ? locale : "en";

  return NextResponse.json({
    country_en: countryEn,
    risk,
    outbreaks: active,
    recommendation: RECOMMENDATIONS[risk][lang as keyof typeof RECOMMENDATIONS["none"]],
    checked_at: new Date().toISOString(),
  });
}
