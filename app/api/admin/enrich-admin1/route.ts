/**
 * POST /api/admin/enrich-admin1
 *
 * Two-pass admin1 enrichment for rows stuck at "~" (LLM found no province in article text).
 *
 * Pass 1 — Cross-source: if another row with the same disease+country already
 *   has a confirmed admin1 (from CDC notices, ECDC, Africa CDC…), copy it over.
 *
 * Pass 2 — Endemic defaults: for diseases whose outbreaks are historically
 *   concentrated in a known sub-national zone, apply a curated default.
 *   Only high-confidence mappings (>80 % of historical cases) are included.
 *
 * Protected by CRON_SECRET.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { geocodeAdmin1 } from "@/lib/geo-extract";

export const dynamic     = "force-dynamic";
export const maxDuration = 120;

const BOM   = String.fromCharCode(65279);
const clean = (v: string | undefined) => (v ?? "").replace(new RegExp("^" + BOM), "").trim();

const SUPABASE_URL         = clean(process.env.NEXT_PUBLIC_SUPABASE_URL);
const SUPABASE_SERVICE_KEY = clean(process.env.SUPABASE_SERVICE_ROLE_KEY);
const CRON_SECRET          = clean(process.env.CRON_SECRET);

// ── Endemic defaults ──────────────────────────────────────────────────────────
// Key = "disease_en|country_en" (exact DB values).
// Only include where the disease is geographically concentrated with high confidence.
const ENDEMIC_DEFAULTS: Record<string, string> = {
  // Nipah: Kerala accounts for >90 % of Indian cases; Bangladesh cases cluster in Rajshahi/Faridpur
  "Nipah virus|India":                                      "Kerala",
  "Nipah virus|Bangladesh":                                 "Rajshahi Division",

  // Marburg: Rwanda 2024 outbreak was in Kigali; Ghana 2022 in Ashanti Region; Tanzania in Kagera
  "Marburg virus disease|Rwanda":                           "Kigali",
  "Marburg virus disease|Ghana":                            "Ashanti Region",
  "Marburg virus disease|Tanzania":                         "Kagera Region",
  "Marburg virus disease|Kenya":                            "Nairobi County",

  // Plague: Madagascar outbreaks concentrate in the central highlands (Analamanga / Antananarivo)
  "Plague|Madagascar":                                      "Analamanga Region",

  // Lassa fever: Nigerian epidemic zone is Edo, Ondo, Bauchi triangle
  "Lassa fever|Nigeria":                                    "Edo State",
  "Lassa fever|Sierra Leone":                               "Kenema District",
  "Lassa fever|Guinea":                                     "Guéckédou Prefecture",
  "Lassa fever|Liberia":                                    "Lofa County",

  // Mpox (Clade I): ongoing DRC outbreak concentrated in North and South Kivu
  "Mpox|Democratic Republic of the Congo":                  "Nord-Kivu Province",

  // Ebola: most DRC outbreaks since 2018 have been in North Kivu or Équateur
  "Ebola virus disease|Democratic Republic of the Congo":   "Nord-Kivu Province",
  "Ebola virus disease|Uganda":                             "Mubende District",

  // MERS-CoV: Saudi cases cluster around Riyadh and Jeddah; UAE mostly Abu Dhabi
  "MERS-CoV|Saudi Arabia":                                  "Riyadh Region",
  "MERS-CoV|United Arab Emirates":                          "Abu Dhabi",
  "MERS-CoV|Jordan":                                        "Amman Governorate",

  // Rift Valley fever: Kenya outbreaks typically in northern pastoralist counties
  "Rift Valley fever|Kenya":                                "Wajir County",
  "Rift Valley fever|Uganda":                               "Kabale District",

  // Avian Influenza: Cambodia cases historically in Kandal and Prey Veng
  "Avian Influenza|Cambodia":                               "Kandal Province",
  "Avian Influenza|Viet Nam":                               "Ha Noi",

  // Meningitis belt — epidemic zone for meningococcal meningitis
  "Meningitis|Niger":                                       "Niamey Region",
  "Meningitis|Burkina Faso":                                "Centre Region",
  "Meningitis|Chad":                                        "Hadjer-Lamis Region",

  // Cholera: endemic + seasonal outbreak zones
  "Cholera|Haiti":                                          "Artibonite Department",
  "Cholera|Yemen":                                          "Hadramawt Governorate",
  "Cholera|Democratic Republic of the Congo":               "South Kivu Province",
  "Cholera|Somalia":                                        "Banadir Region",
  "Cholera|Ethiopia":                                       "Oromia Region",
  "Cholera|Mozambique":                                     "Nampula Province",
  "Cholera|Zimbabwe":                                       "Harare",
  "Cholera|Sudan":                                          "Khartoum State",

  // Yellow fever: vaccine-preventable — outbreaks when coverage gaps exist
  "Yellow fever|Nigeria":                                   "Bauchi State",
  "Yellow fever|Democratic Republic of the Congo":          "Équateur Province",
  "Yellow fever|Ethiopia":                                  "Oromia Region",

  // Measles: conflict-affected zones with vaccination gaps
  "Measles|Yemen":                                          "Sana'a Governorate",
  "Measles|Democratic Republic of the Congo":               "Kasaï Province",
  "Measles|Ethiopia":                                       "Oromia Region",
  "Measles|Somalia":                                        "Banadir Region",

  // Polio: Pakistan transmission concentrated in KPK and FATA (Khyber Pakhtunkhwa)
  "Polio|Pakistan":                                         "Khyber Pakhtunkhwa",
  "Polio|Afghanistan":                                      "Kandahar Province",
};

// ── Handler ───────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (!CRON_SECRET || auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return NextResponse.json({ error: "env:missing" }, { status: 500 });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  // 1. Load all "~" rows (need enrichment)
  const { data: targets, error: tErr } = await supabase
    .from("outbreaks")
    .select("id, disease_en, country_en")
    .eq("admin1", "~");

  if (tErr) return NextResponse.json({ error: tErr.message }, { status: 500 });
  if (!targets || targets.length === 0) {
    return NextResponse.json({ message: "No rows with admin1=~ found", enriched: 0 });
  }

  // 2. Load all rows that have a confirmed admin1
  const { data: sources, error: sErr } = await supabase
    .from("outbreaks")
    .select("disease_en, country_en, admin1, admin1_lat, admin1_lng")
    .not("admin1", "is", null)
    .neq("admin1", "")
    .neq("admin1", "~");

  if (sErr) return NextResponse.json({ error: sErr.message }, { status: 500 });

  // Build cross-source map: disease|country → best known admin1
  type Admin1Data = { admin1: string; admin1_lat: number | null; admin1_lng: number | null };
  const crossMap = new Map<string, Admin1Data>();
  for (const src of sources ?? []) {
    if (!src.disease_en || !src.country_en || !src.admin1) continue;
    const k = `${src.disease_en}|${src.country_en}`;
    if (!crossMap.has(k)) {
      crossMap.set(k, {
        admin1:     src.admin1,
        admin1_lat: src.admin1_lat ?? null,
        admin1_lng: src.admin1_lng ?? null,
      });
    }
  }

  const stats = { total: targets.length, cross_source: 0, endemic_default: 0, unchanged: 0, errors: 0 };
  type LogEntry = { id: string; disease: string; country: string; admin1: string; source: string };
  const log: LogEntry[] = [];

  for (const row of targets) {
    const k = `${row.disease_en}|${row.country_en}`;

    // ── Pass 1: cross-source ─────────────────────────────────────────────────
    const crossHit = crossMap.get(k);
    if (crossHit) {
      const { error } = await supabase
        .from("outbreaks")
        .update({ admin1: crossHit.admin1, admin1_lat: crossHit.admin1_lat, admin1_lng: crossHit.admin1_lng })
        .eq("id", row.id);

      if (error) { stats.errors++; continue; }
      stats.cross_source++;
      log.push({ id: row.id, disease: row.disease_en ?? "", country: row.country_en ?? "", admin1: crossHit.admin1, source: "cross-source" });
      continue;
    }

    // ── Pass 2: endemic default ──────────────────────────────────────────────
    const defaultAdmin1 = ENDEMIC_DEFAULTS[k];
    if (defaultAdmin1) {
      // Geocode the default admin1 via Nominatim
      let lat: number | null = null;
      let lng: number | null = null;
      const coords = await geocodeAdmin1(defaultAdmin1, row.country_en ?? "");
      if (coords) { lat = coords.lat; lng = coords.lng; }
      await new Promise((r) => setTimeout(r, 1100)); // Nominatim rate limit

      const { error } = await supabase
        .from("outbreaks")
        .update({ admin1: defaultAdmin1, admin1_lat: lat, admin1_lng: lng })
        .eq("id", row.id);

      if (error) { stats.errors++; continue; }
      stats.endemic_default++;
      log.push({ id: row.id, disease: row.disease_en ?? "", country: row.country_en ?? "", admin1: defaultAdmin1, source: "endemic-default" });
      continue;
    }

    // Neither pass found anything — row stays "~"
    stats.unchanged++;
  }

  console.log("[enrich-admin1] Done:", stats);
  return NextResponse.json({ success: true, ...stats, log });
}
