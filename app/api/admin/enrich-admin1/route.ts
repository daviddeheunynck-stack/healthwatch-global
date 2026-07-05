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
import { logCronRun } from "@/lib/cron-monitor";

export const dynamic     = "force-dynamic";
export const maxDuration = 120;

const BOM   = String.fromCharCode(65279);
const clean = (v: string | undefined) => (v ?? "").replace(new RegExp("^" + BOM), "").trim();

const SUPABASE_URL         = clean(process.env.NEXT_PUBLIC_SUPABASE_URL);
const SUPABASE_SERVICE_KEY = clean(process.env.SUPABASE_SERVICE_ROLE_KEY);
const CRON_SECRET          = clean(process.env.CRON_SECRET);

// ── Endemic defaults ──────────────────────────────────────────────────────────
// Fuzzy matchers: diseaseIncludes / countryIncludes (all lowercase, substring).
// Handles raw WHO DON variants: "Mpox (Clade Ib)", "Marburg Fever", "H5N1", etc.
// Skip rows where country is "global", "multiple", or "regional" — no province possible.
interface EndemicMatcher { disease: string[]; country: string[]; admin1: string }

const ENDEMIC_MATCHERS: EndemicMatcher[] = [
  // Mpox / Monkeypox — DRC (Clade I cluster: Nord-Kivu, South Kivu)
  { disease: ["mpox", "monkeypox"], country: ["congo"],              admin1: "Nord-Kivu Province" },
  { disease: ["mpox", "monkeypox"], country: ["germany"],            admin1: "Berlin" },

  // Ebola / Sudan virus disease — DRC & Uganda
  { disease: ["ebola", "sudan virus"],  country: ["congo"],          admin1: "Nord-Kivu Province" },
  { disease: ["ebola"],                 country: ["uganda"],         admin1: "Mubende District" },
  { disease: ["sudan virus"],           country: ["uganda"],         admin1: "Kagadi District" },

  // Marburg — Rwanda, Ghana, Tanzania, Ethiopia, Kenya
  { disease: ["marburg"],  country: ["rwanda"],                      admin1: "Kigali" },
  { disease: ["marburg"],  country: ["ghana"],                       admin1: "Ashanti Region" },
  { disease: ["marburg"],  country: ["tanzania"],                    admin1: "Kagera Region" },
  { disease: ["marburg"],  country: ["ethiopia"],                    admin1: "Oromia Region" },
  { disease: ["marburg"],  country: ["kenya"],                       admin1: "Nairobi County" },

  // Nipah — India (Kerala >90 %) and Bangladesh (Rajshahi/Faridpur)
  { disease: ["nipah"],    country: ["india"],                       admin1: "Kerala" },
  { disease: ["nipah"],    country: ["bangladesh"],                  admin1: "Rajshahi Division" },

  // Lassa fever — Nigeria, Sierra Leone, Guinea, Liberia
  { disease: ["lassa"],    country: ["nigeria"],                     admin1: "Edo State" },
  { disease: ["lassa"],    country: ["sierra leone"],                admin1: "Kenema District" },
  { disease: ["lassa"],    country: ["guinea"],                      admin1: "Guéckédou Prefecture" },
  { disease: ["lassa"],    country: ["liberia"],                     admin1: "Lofa County" },

  // Plague — Madagascar (central highlands)
  { disease: ["plague"],   country: ["madagascar"],                  admin1: "Analamanga Region" },

  // Avian Influenza — Cambodia (Kandal), Vietnam (Ha Noi area)
  { disease: ["avian influenza"],  country: ["cambodia"],            admin1: "Kandal Province" },
  { disease: ["avian influenza"],  country: ["vietnam"],             admin1: "Ha Noi" },

  // MERS-CoV — Saudi Arabia, UAE, Jordan
  { disease: ["mers"],     country: ["saudi"],                       admin1: "Riyadh Region" },
  { disease: ["mers"],     country: ["uae", "emirates"],             admin1: "Abu Dhabi" },
  { disease: ["mers"],     country: ["jordan"],                      admin1: "Amman Governorate" },

  // Rift Valley fever — Kenya, Uganda, Mauritania, Senegal
  { disease: ["rift valley"],  country: ["kenya"],                   admin1: "Wajir County" },
  { disease: ["rift valley"],  country: ["uganda"],                  admin1: "Kabale District" },
  { disease: ["rift valley"],  country: ["mauritania"],              admin1: "Hodh Ech Chargui Region" },
  { disease: ["rift valley"],  country: ["senegal"],                 admin1: "Louga Region" },

  // Meningitis / Meningococcal — Sahel belt
  { disease: ["meningitis", "meningococcal"],  country: ["niger"],   admin1: "Niamey Region" },
  { disease: ["meningitis", "meningococcal"],  country: ["burkina"], admin1: "Centre Region" },
  { disease: ["meningitis", "meningococcal"],  country: ["chad"],    admin1: "Hadjer-Lamis Region" },
  { disease: ["meningitis"],                   country: ["saudi"],   admin1: "Mecca Region" },

  // Cholera — endemic outbreak zones
  { disease: ["cholera"],  country: ["haiti"],                       admin1: "Artibonite Department" },
  { disease: ["cholera"],  country: ["yemen"],                       admin1: "Hadramawt Governorate" },
  { disease: ["cholera"],  country: ["congo"],                       admin1: "South Kivu Province" },
  { disease: ["cholera"],  country: ["somalia"],                     admin1: "Banadir Region" },
  { disease: ["cholera"],  country: ["ethiopia"],                    admin1: "Oromia Region" },
  { disease: ["cholera"],  country: ["mozambique"],                  admin1: "Nampula Province" },
  { disease: ["cholera"],  country: ["zimbabwe"],                    admin1: "Harare" },
  { disease: ["cholera"],  country: ["sudan"],                       admin1: "Khartoum State" },
  { disease: ["cholera"],  country: ["angola"],                      admin1: "Luanda Province" },

  // Yellow fever
  { disease: ["yellow fever"],  country: ["nigeria"],                admin1: "Bauchi State" },
  { disease: ["yellow fever"],  country: ["congo"],                  admin1: "Équateur Province" },
  { disease: ["yellow fever"],  country: ["ethiopia"],               admin1: "Oromia Region" },

  // Measles — conflict/vaccine-gap zones
  { disease: ["measles"],  country: ["yemen"],                       admin1: "Sana'a Governorate" },
  { disease: ["measles"],  country: ["congo"],                       admin1: "Kasaï Province" },
  { disease: ["measles"],  country: ["ethiopia"],                    admin1: "Oromia Region" },
  { disease: ["measles"],  country: ["somalia"],                     admin1: "Banadir Region" },

  // Polio / Poliomyelitis — Pakistan (KPK), Afghanistan
  { disease: ["polio"],    country: ["pakistan"],                    admin1: "Khyber Pakhtunkhwa" },
  { disease: ["polio"],    country: ["afghanistan"],                 admin1: "Kandahar Province" },
  { disease: ["polio"],    country: ["israel"],                      admin1: "Jerusalem District" },

  // Oropouche — Cuba (eastern provinces are endemic)
  { disease: ["oropouche"],  country: ["cuba"],                      admin1: "Santiago de Cuba Province" },

  // Anthrax — Thailand (northern provinces)
  { disease: ["anthrax"],  country: ["thailand"],                    admin1: "Chiang Rai Province" },

  // Rabies — Timor-Leste (Dili is main affected area)
  { disease: ["rabies"],   country: ["timor"],                       admin1: "Dili" },

  // Avian Influenza — Mexico (Jalisco is the main commercial poultry zone)
  { disease: ["avian influenza"],  country: ["mexico"],              admin1: "Jalisco" },
  // Avian Influenza H9N2 — Italy outbreaks concentrated in Veneto
  { disease: ["avian influenza"],  country: ["italy"],               admin1: "Veneto Region" },

  // Chikungunya — Brazil (2024 epicenter: Rio de Janeiro); Réunion (entire island = one zone)
  { disease: ["chikungunya"],  country: ["brazil"],                  admin1: "Rio de Janeiro State" },
  { disease: ["chikungunya"],  country: ["réunion", "reunion"],      admin1: "Saint-Denis" },

  // Cholera — Bangladesh (Dhaka cluster)
  { disease: ["cholera"],  country: ["bangladesh"],                  admin1: "Dhaka Division" },

  // Dengue — Brazil (São Paulo largest outbreak), Fiji (Central Division), Philippines (NCR)
  { disease: ["dengue"],   country: ["brazil"],                      admin1: "São Paulo State" },
  { disease: ["dengue"],   country: ["fiji"],                        admin1: "Central Division" },
  { disease: ["dengue"],   country: ["philippines"],                 admin1: "National Capital Region" },

  // Measles — Romania (Bucharest-Ilfov epicenter), Bangladesh (Dhaka)
  { disease: ["measles"],  country: ["romania"],                     admin1: "Ilfov County" },
  { disease: ["measles"],  country: ["bangladesh"],                  admin1: "Dhaka Division" },
  { disease: ["measles"],  country: ["morocco"],                     admin1: "Casablanca-Settat" },
];

// Countries with no meaningful sub-national scope (skip enrichment)
const SKIP_COUNTRIES = ["global", "multiple", "regional"];

// ── Handler ───────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
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

  if (tErr) {
    await logCronRun(supabase, "enrich-admin1", "error", 0, tErr.message);
    return NextResponse.json({ error: tErr.message }, { status: 500 });
  }
  if (!targets || targets.length === 0) {
    await logCronRun(supabase, "enrich-admin1", "no_data", 0);
    return NextResponse.json({ message: "No rows with admin1=~ found", enriched: 0 });
  }

  // 2. Load all rows that have a confirmed admin1
  const { data: sources, error: sErr } = await supabase
    .from("outbreaks")
    .select("disease_en, country_en, admin1, admin1_lat, admin1_lng")
    .not("admin1", "is", null)
    .neq("admin1", "")
    .neq("admin1", "~");

  if (sErr) {
    await logCronRun(supabase, "enrich-admin1", "error", 0, sErr.message);
    return NextResponse.json({ error: sErr.message }, { status: 500 });
  }

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

    // ── Pass 2: endemic default (fuzzy match) ───────────────────────────────
    const countryLower  = (row.country_en ?? "").toLowerCase();
    const diseaseLower  = (row.disease_en ?? "").toLowerCase();

    // Skip rows where country is definitively non-localizable
    if (SKIP_COUNTRIES.some((s) => countryLower.includes(s))) {
      stats.unchanged++;
      continue;
    }

    const matcher = ENDEMIC_MATCHERS.find(
      (m) =>
        m.disease.some((d) => diseaseLower.includes(d)) &&
        m.country.some((c) => countryLower.includes(c))
    );
    const defaultAdmin1 = matcher?.admin1;
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
  await logCronRun(supabase, "enrich-admin1", "ok", stats.cross_source + stats.endemic_default);
  return NextResponse.json({ success: true, ...stats, log });
}
