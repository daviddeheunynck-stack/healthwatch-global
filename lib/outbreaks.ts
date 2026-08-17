import { createClient } from "@supabase/supabase-js";
import { unstable_cache } from "next/cache";
import * as Sentry from "@sentry/nextjs";
import { normalizeDisease, matchEventNameTranslation } from "./disease-data";
import { findCountry, isAggregateCountry } from "./geo-data";
import { sourceStatusOf, type SourceStatus } from "./source-trust";
import type { OutbreakTrend } from "./outbreak-trend";

const BOM   = String.fromCharCode(65279);
const clean = (v: string | undefined) => (v || "").replace(new RegExp("^" + BOM), "").trim();

function getServerClient() {
  return createClient(
    clean(process.env.NEXT_PUBLIC_SUPABASE_URL),
    clean(process.env.SUPABASE_SERVICE_ROLE_KEY)
  );
}

// Retries transient fetch/socket errors against Supabase ("TypeError: terminated"
// from a keep-alive connection reused across serverless invocations — Sentry
// JAVASCRIPT-NEXTJS-1H, recurring 2026-07-13 through 07-23 despite an earlier
// single-retry fix that reused the same client/connection across attempts).
// Builds a fresh client per attempt so a retry can't land on the same dead socket.
// Short backoff between attempts (2026-07-29): a bare loop retried 3x within
// milliseconds, barely better than one attempt, against an upstream that had
// just dropped the connection — this issue's count started climbing 7x its
// historical rate that day with the loop still empty-handed.
// Widened backoff + a 4th attempt (2026-08-05): the first real `extra.attempts`
// event landed (issue recurred under a new shortId after a rebuild renamed the
// minified function — same signature, see reference_sentry_minified_function_
// name_changes_issue_shortid) and showed all 3 attempts exhausted on
// `read ECONNRESET` — a transient TLS drop that clears in seconds, not the
// ~750ms the old backoff gave it. Worst case now ~4.5s, only paid when Supabase
// is already flaking; the alternative is getOutbreaks() falling back to an
// empty outbreak list for that visitor (see its try/catch below).
const RETRY_BACKOFF_MS = [300, 1200, 3000];

async function queryWithRetry<T>(
  buildQuery: (supabase: ReturnType<typeof getServerClient>) => PromiseLike<{ data: T; error: unknown }>,
  attempts = 4,
): Promise<{ data: T; error: unknown; attempts: number }> {
  let result: { data: T; error: unknown } | undefined;
  for (let i = 0; i < attempts; i++) {
    if (i > 0) {
      const delay = RETRY_BACKOFF_MS[i - 1] ?? RETRY_BACKOFF_MS[RETRY_BACKOFF_MS.length - 1];
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
    result = await buildQuery(getServerClient());
    if (!result.error) return { ...result, attempts: i + 1 };
  }
  return { ...result!, attempts };
}

export interface Outbreak {
  id: string;
  disease: string;
  disease_en: string | null;
  disease_ar: string | null;
  country: string;
  country_en: string | null;
  country_ar: string | null;
  region: string;
  lat: number;
  lng: number;
  cases: number;
  deaths: number | null;
  is_seed: boolean;
  risk_level: "high" | "medium" | "low";
  date: string;
  source: string;
  description:    string;
  description_fr: string | null;
  description_es: string | null;
  description_ar: string | null;
  description_id: string | null;
  active: boolean;
  source_priority: number | null; // 10=PHEIC, 5=main crons, 3=regional, 0=seed
  admin1:     string | null;
  admin1_lat: number | null;
  admin1_lng: number | null;
  is_pheic:      boolean;       // Public Health Emergency of International Concern
  is_backfill:   boolean;       // source is itself a historical/cumulative archive, not a live signal — set by the owning cron at insert time
  updated_at:    string | null; // last sync timestamp
  created_at:    string | null; // first insertion timestamp
  event_id:      string | null; // multi-country cluster linkage
  ihr_event_id:  string | null; // WHO IHR event reference (Article 6/7)
  verification_status: string; // suspected | under_investigation | confirmed | closed
  response_phase:      string; // monitoring | investigating | active_response | contained
}

// The outbreak dataset is identical for every visitor (no user-specific data),
// but the homepage and several other read routes are force-dynamic (per-request
// auth), so each request was re-querying Supabase — including a select("*") that
// pulls all columns. Cache the shared query result so cache hits skip Supabase
// entirely, cutting egress by orders of magnitude under real traffic (egress
// quota — see project_supabase_egress_quota). Data only changes when ingestion
// crons write (a few times/hour at most), so a 5-minute window keeps figures
// effectively fresh while staying well within the advertised "WHO hourly" cadence.
// On-demand invalidation is possible later via revalidateTag(OUTBREAKS_CACHE_TAG).
export const OUTBREAKS_CACHE_TAG = "outbreaks";
const OUTBREAKS_REVALIDATE = 300; // seconds — must be a statically-analyzable literal

const getLastSyncCached = unstable_cache(
  async (): Promise<string | null> => {
    const { data, error } = await queryWithRetry((supabase) =>
      supabase
        .from("outbreaks")
        .select("updated_at")
        .eq("active", true)
        .order("updated_at", { ascending: false })
        .limit(1)
        .single(),
    );
    if (error) throw error; // propagate — don't let a transient failure cache as "no sync"
    return data?.updated_at ?? null;
  },
  ["outbreaks-last-sync"],
  { tags: [OUTBREAKS_CACHE_TAG], revalidate: OUTBREAKS_REVALIDATE },
);

export async function getLastSync(): Promise<string | null> {
  try {
    return await getLastSyncCached();
  } catch {
    return null; // preserve prior lenient behavior on error (uncached)
  }
}

const getOutbreaksCached = unstable_cache(
  async (): Promise<Outbreak[]> => {
    const sixtyDaysAgo = new Date(Date.now() - 60 * 86_400_000).toISOString().split("T")[0];

    // `date.gte.sixtyDaysAgo` guards the recency fallback below: without it, a row
    // whose own reported date is years stale can be resurrected as "active" just
    // because something touched updated_at (e.g. a documentation/translation edit)
    // long after the row was deliberately archived. Found 2026-08-01: Dengue/Haiti
    // (date 2022-06-26, active=false) showed as a live "Foyer en cours" on the
    // public site after its description was edited 2026-07-28 — the fallback is
    // meant for a row that JUST went inactive before a fresh bulletin, not one
    // whose underlying event is over four years old. See isDisplayActive() below,
    // which mirrors this same guard for the disease/country/region detail pages.
    const { data, error, attempts } = await queryWithRetry((supabase) =>
      supabase
        .from("outbreaks")
        .select("*")
        .or(`active.eq.true,and(source_priority.gte.3,updated_at.gte.${sixtyDaysAgo},date.gte.${sixtyDaysAgo})`)
        .order("date", { ascending: false }),
    );

    if (error) {
      Sentry.captureException(error, {
        tags: { lib: "outbreaks", fn: "getOutbreaks" },
        extra: { attempts },
      });
      throw error; // propagate so unstable_cache does NOT cache an empty result
    }

    // Deduplicate: keep only the most recent entry per (disease, country) pair.
    // Use normalizeDisease so "Dengue" and "Dengue fever" hash to the same canonical
    // name_en ("Dengue fever"), preventing the same outbreak from appearing twice.
    const seen = new Set<string>();
    return (data || []).filter((o) => {
      const diseaseKey = normalizeDisease(o.disease_en || o.disease).name_en.toLowerCase();
      const countryKey = (o.country_en || o.country).toLowerCase();
      const key = `${diseaseKey}|${countryKey}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  },
  ["outbreaks-list"],
  { tags: [OUTBREAKS_CACHE_TAG], revalidate: OUTBREAKS_REVALIDATE },
);

export async function getOutbreaks(): Promise<Outbreak[]> {
  try {
    return await getOutbreaksCached();
  } catch (error) {
    // Uncached fallback — the next request retries instead of serving a stale
    // empty dashboard for the whole revalidate window.
    console.error("Error fetching outbreaks:", error);
    return [];
  }
}


// Structural field-sets for the localization helpers below — they each touch
// only a handful of Outbreak columns. Accepting the narrow shape (rather than
// the full Outbreak) lets cron jobs that SELECT a lean column subset (for
// efficiency — see app/api/cron/disease-alerts and watchlist-alerts) pass
// their rows straight through with real structural type-safety and no `any`;
// every existing caller already passes a full Outbreak, which trivially
// satisfies these narrower Picks too.
type LocalizedDiseaseFields = Pick<Outbreak, "disease" | "disease_en" | "disease_ar">;
type LocalizedCountryFields = Pick<Outbreak, "country" | "country_en" | "country_ar">;

export function getLocalizedDisease(outbreak: LocalizedDiseaseFields, locale: string): string {
  // Normalize through the same DISEASE_MAP the parser uses.
  // disease_en is the preferred key (English, already normalized).
  // Fallback: disease column (French for new records, English for legacy).
  // This ensures "Dengue" and "Dengue fever" resolve to the same canonical names.
  const raw = outbreak.disease_en || outbreak.disease;
  const info = normalizeDisease(raw);
  // Non-infectious "events" (food-safety recalls, toxin contaminations…) are
  // intentionally absent from DISEASE_MAP — see matchEventNameTranslation's doc comment.
  // Their headline still deserves a real translation instead of the raw-English fallback.
  const evt = matchEventNameTranslation(raw);
  if (evt) {
    if (locale === "fr") return evt.fr;
    if (locale === "ar") return outbreak.disease_ar || evt.ar;
    if (locale === "es") return evt.es;
    if (locale === "id") return evt.id;
    return info.name_en;
  }
  if (locale === "fr") return info.name_fr;
  if (locale === "ar") return outbreak.disease_ar || info.name_ar;
  if (locale === "es") return info.name_es;
  if (locale === "id") return info.name_id;
  return info.name_en;
}

// ── Description localization ──────────────────────────────────────────────────
// Returns the translated description if available in DB, otherwise falls back
// to the English description.
// Translations are populated per-source by each sync cron via MyMemory
// (see lib/translate.ts), with sync-outbreaks also running a table-wide
// backfill sweep as a safety net for any row a source cron missed.
export function getLocalizedDescription(outbreak: Outbreak, locale: string): string {
  if (locale === "fr" && outbreak.description_fr) return outbreak.description_fr;
  if (locale === "es" && outbreak.description_es) return outbreak.description_es;
  if (locale === "ar" && outbreak.description_ar) return outbreak.description_ar;
  if (locale === "id" && outbreak.description_id) return outbreak.description_id;
  return outbreak.description; // fallback to EN
}

// ── Country name translations ─────────────────────────────────────────────────
// WHO stores country names in English. Translate the full WORLD_COUNTRIES
// (lib/world-countries.ts) referential so FR / ES / ID users never see
// English country names — plus the DB aliases (DRC, DR Congo, Ivory Coast,
// Türkiye, Viet Nam, EU/EEA, Global…) that appear verbatim in outbreak rows
// but aren't canonical ISO names.
// Exported so callers that only have a plain country_en string (not a full
// outbreak row) — e.g. the travel-risk country picker — can look up a
// translation directly, via getLocalizedCountryNameFromEn() below.
export const COUNTRY_FR: Record<string, string> = {
  "Afghanistan": "Afghanistan", "Albania": "Albanie", "Algeria": "Algérie",
  "Andorra": "Andorre", "Angola": "Angola", "Antigua and Barbuda": "Antigua-et-Barbuda",
  "Argentina": "Argentine", "Armenia": "Arménie", "Australia": "Australie",
  "Austria": "Autriche", "Azerbaijan": "Azerbaïdjan", "Bahamas": "Bahamas",
  "Bahrain": "Bahreïn", "Bangladesh": "Bangladesh", "Barbados": "Barbade",
  "Belarus": "Biélorussie", "Belgium": "Belgique", "Belize": "Belize",
  "Benin": "Bénin", "Bhutan": "Bhoutan", "Bolivia": "Bolivie",
  "Bosnia and Herzegovina": "Bosnie-Herzégovine", "Botswana": "Botswana",
  "Brazil": "Brésil", "Brunei": "Brunei", "Bulgaria": "Bulgarie",
  "Burkina Faso": "Burkina Faso", "Burundi": "Burundi", "Cabo Verde": "Cap-Vert",
  "Cambodia": "Cambodge", "Cameroon": "Cameroun", "Canada": "Canada",
  "Central African Republic": "République centrafricaine", "Chad": "Tchad",
  "Chile": "Chili", "China": "Chine", "Colombia": "Colombie", "Comoros": "Comores",
  "Congo": "Congo", "Costa Rica": "Costa Rica", "Croatia": "Croatie", "Cuba": "Cuba",
  "Cyprus": "Chypre", "Czech Republic": "République tchèque",
  "Côte d'Ivoire": "Côte d'Ivoire", "Ivory Coast": "Côte d'Ivoire",
  "Democratic Republic of the Congo": "République démocratique du Congo",
  "Democratic Republic of Congo": "République démocratique du Congo",
  "DR Congo": "République démocratique du Congo",
  "DRC": "RDC", "Denmark": "Danemark", "Djibouti": "Djibouti", "Dominica": "Dominique",
  "Dominican Republic": "République dominicaine", "Ecuador": "Équateur",
  "Egypt": "Égypte", "El Salvador": "Salvador", "Equatorial Guinea": "Guinée équatoriale",
  "Eritrea": "Érythrée", "Estonia": "Estonie", "Eswatini": "Eswatini",
  "Ethiopia": "Éthiopie", "EU/EEA": "UE/EEE", "Fiji": "Fidji", "Finland": "Finlande",
  "France": "France", "Gabon": "Gabon", "Gambia": "Gambie", "Georgia": "Géorgie",
  "Germany": "Allemagne", "Ghana": "Ghana", "Global": "Mondial", "Greece": "Grèce",
  "Grenada": "Grenade", "Guatemala": "Guatemala", "Guinea": "Guinée",
  "Guinea-Bissau": "Guinée-Bissau", "Guyana": "Guyana", "Haiti": "Haïti",
  "Honduras": "Honduras", "Hungary": "Hongrie", "Iceland": "Islande", "India": "Inde",
  "Indonesia": "Indonésie", "Iran": "Iran", "Iraq": "Irak", "Ireland": "Irlande",
  "Israel": "Israël", "Italy": "Italie", "Jamaica": "Jamaïque", "Japan": "Japon",
  "Jordan": "Jordanie", "Kazakhstan": "Kazakhstan", "Kenya": "Kenya",
  "Kiribati": "Kiribati", "Kuwait": "Koweït", "Kyrgyzstan": "Kirghizistan",
  "Laos": "Laos", "Latvia": "Lettonie", "Lebanon": "Liban", "Lesotho": "Lesotho",
  "Liberia": "Libéria", "Libya": "Libye", "Liechtenstein": "Liechtenstein",
  "Lithuania": "Lituanie", "Luxembourg": "Luxembourg", "Madagascar": "Madagascar",
  "Malawi": "Malawi", "Malaysia": "Malaisie", "Maldives": "Maldives", "Mali": "Mali",
  "Malta": "Malte", "Marshall Islands": "Îles Marshall", "Mauritania": "Mauritanie",
  "Mauritius": "Maurice", "Mexico": "Mexique", "Micronesia": "Micronésie",
  "Moldova": "Moldavie", "Monaco": "Monaco", "Mongolia": "Mongolie",
  "Montenegro": "Monténégro", "Morocco": "Maroc", "Mozambique": "Mozambique",
  "Myanmar": "Myanmar", "Namibia": "Namibie", "Nauru": "Nauru", "Nepal": "Népal",
  "Netherlands": "Pays-Bas", "New Zealand": "Nouvelle-Zélande",
  "Nicaragua": "Nicaragua", "Niger": "Niger", "Nigeria": "Nigéria",
  "North Korea": "Corée du Nord", "North Macedonia": "Macédoine du Nord",
  "Norway": "Norvège", "Oman": "Oman", "Pakistan": "Pakistan", "Palau": "Palaos",
  "Palestine": "Palestine", "Panama": "Panama",
  "Papua New Guinea": "Papouasie-Nouvelle-Guinée", "Paraguay": "Paraguay",
  "Peru": "Pérou", "Philippines": "Philippines", "Poland": "Pologne",
  "Portugal": "Portugal", "Qatar": "Qatar", "Republic of the Congo": "République du Congo",
  "Romania": "Roumanie", "Russia": "Russie", "Rwanda": "Rwanda",
  "Saint Kitts and Nevis": "Saint-Christophe-et-Niévès", "Saint Lucia": "Sainte-Lucie",
  "Saint Vincent and the Grenadines": "Saint-Vincent-et-les-Grenadines",
  "Samoa": "Samoa", "San Marino": "Saint-Marin", "Sao Tome and Principe": "Sao Tomé-et-Principe",
  "Saudi Arabia": "Arabie saoudite", "Senegal": "Sénégal", "Serbia": "Serbie",
  "Seychelles": "Seychelles", "Sierra Leone": "Sierra Leone", "Singapore": "Singapour",
  "Slovakia": "Slovaquie", "Slovenia": "Slovénie", "Solomon Islands": "Îles Salomon",
  "Somalia": "Somalie", "South Africa": "Afrique du Sud", "South Korea": "Corée du Sud",
  "South Sudan": "Soudan du Sud", "Spain": "Espagne", "Sri Lanka": "Sri Lanka",
  "Sudan": "Soudan", "Suriname": "Suriname", "Sweden": "Suède", "Switzerland": "Suisse",
  "Syria": "Syrie", "Taiwan": "Taïwan", "Tajikistan": "Tadjikistan",
  "Tanzania": "Tanzanie", "Thailand": "Thaïlande", "Timor-Leste": "Timor oriental",
  "Togo": "Togo", "Tonga": "Tonga", "Trinidad and Tobago": "Trinité-et-Tobago",
  "Tunisia": "Tunisie", "Turkey": "Turquie", "Türkiye": "Turquie",
  "Turkmenistan": "Turkménistan", "Tuvalu": "Tuvalu", "Uganda": "Ouganda",
  "Ukraine": "Ukraine", "United Arab Emirates": "Émirats arabes unis",
  "United Kingdom": "Royaume-Uni", "United States": "États-Unis",
  "United States of America": "États-Unis", "Uruguay": "Uruguay",
  "Uzbekistan": "Ouzbékistan", "Vanuatu": "Vanuatu", "Venezuela": "Venezuela",
  "Viet Nam": "Viêt Nam", "Vietnam": "Viêt Nam", "Yemen": "Yémen",
  "Zambia": "Zambie", "Zimbabwe": "Zimbabwe",
};

export const COUNTRY_ES: Record<string, string> = {
  "Afghanistan": "Afganistán", "Albania": "Albania", "Algeria": "Argelia",
  "Andorra": "Andorra", "Angola": "Angola", "Antigua and Barbuda": "Antigua y Barbuda",
  "Argentina": "Argentina", "Armenia": "Armenia", "Australia": "Australia",
  "Austria": "Austria", "Azerbaijan": "Azerbaiyán", "Bahamas": "Bahamas",
  "Bahrain": "Baréin", "Bangladesh": "Bangladés", "Barbados": "Barbados",
  "Belarus": "Bielorrusia", "Belgium": "Bélgica", "Belize": "Belice",
  "Benin": "Benín", "Bhutan": "Bután", "Bolivia": "Bolivia",
  "Bosnia and Herzegovina": "Bosnia y Herzegovina", "Botswana": "Botsuana",
  "Brazil": "Brasil", "Brunei": "Brunéi", "Bulgaria": "Bulgaria",
  "Burkina Faso": "Burkina Faso", "Burundi": "Burundi", "Cabo Verde": "Cabo Verde",
  "Cambodia": "Camboya", "Cameroon": "Camerún", "Canada": "Canadá",
  "Central African Republic": "República Centroafricana", "Chad": "Chad",
  "Chile": "Chile", "China": "China", "Colombia": "Colombia", "Comoros": "Comoras",
  "Congo": "Congo", "Costa Rica": "Costa Rica", "Croatia": "Croacia", "Cuba": "Cuba",
  "Cyprus": "Chipre", "Czech Republic": "República Checa",
  "Côte d'Ivoire": "Costa de Marfil", "Ivory Coast": "Costa de Marfil",
  "Democratic Republic of the Congo": "República Democrática del Congo",
  "Democratic Republic of Congo": "República Democrática del Congo",
  "DR Congo": "República Democrática del Congo", "DRC": "RD Congo",
  "Denmark": "Dinamarca", "Djibouti": "Yibuti", "Dominica": "Dominica",
  "Dominican Republic": "República Dominicana", "Ecuador": "Ecuador",
  "Egypt": "Egipto", "El Salvador": "El Salvador",
  "Equatorial Guinea": "Guinea Ecuatorial", "Eritrea": "Eritrea",
  "Estonia": "Estonia", "Eswatini": "Esuatini", "Ethiopia": "Etiopía",
  "EU/EEA": "UE/EEE", "Fiji": "Fiyi", "Finland": "Finlandia", "France": "Francia",
  "Gabon": "Gabón", "Gambia": "Gambia", "Georgia": "Georgia", "Germany": "Alemania",
  "Ghana": "Ghana", "Global": "Global", "Greece": "Grecia", "Grenada": "Granada",
  "Guatemala": "Guatemala", "Guinea": "Guinea", "Guinea-Bissau": "Guinea-Bisáu",
  "Guyana": "Guyana", "Haiti": "Haití", "Honduras": "Honduras", "Hungary": "Hungría",
  "Iceland": "Islandia", "India": "India", "Indonesia": "Indonesia", "Iran": "Irán",
  "Iraq": "Irak", "Ireland": "Irlanda", "Israel": "Israel", "Italy": "Italia",
  "Jamaica": "Jamaica", "Japan": "Japón", "Jordan": "Jordania",
  "Kazakhstan": "Kazajistán", "Kenya": "Kenia", "Kiribati": "Kiribati",
  "Kuwait": "Kuwait", "Kyrgyzstan": "Kirguistán", "Laos": "Laos", "Latvia": "Letonia",
  "Lebanon": "Líbano", "Lesotho": "Lesoto", "Liberia": "Liberia", "Libya": "Libia",
  "Liechtenstein": "Liechtenstein", "Lithuania": "Lituania", "Luxembourg": "Luxemburgo",
  "Madagascar": "Madagascar", "Malawi": "Malaui", "Malaysia": "Malasia",
  "Maldives": "Maldivas", "Mali": "Malí", "Malta": "Malta",
  "Marshall Islands": "Islas Marshall", "Mauritania": "Mauritania",
  "Mauritius": "Mauricio", "Mexico": "México", "Micronesia": "Micronesia",
  "Moldova": "Moldavia", "Monaco": "Mónaco", "Mongolia": "Mongolia",
  "Montenegro": "Montenegro", "Morocco": "Marruecos", "Mozambique": "Mozambique",
  "Myanmar": "Myanmar", "Namibia": "Namibia", "Nauru": "Nauru", "Nepal": "Nepal",
  "Netherlands": "Países Bajos", "New Zealand": "Nueva Zelanda",
  "Nicaragua": "Nicaragua", "Niger": "Níger", "Nigeria": "Nigeria",
  "North Korea": "Corea del Norte", "North Macedonia": "Macedonia del Norte",
  "Norway": "Noruega", "Oman": "Omán", "Pakistan": "Pakistán", "Palau": "Palaos",
  "Palestine": "Palestina", "Panama": "Panamá",
  "Papua New Guinea": "Papúa Nueva Guinea", "Paraguay": "Paraguay", "Peru": "Perú",
  "Philippines": "Filipinas", "Poland": "Polonia", "Portugal": "Portugal",
  "Qatar": "Catar", "Republic of the Congo": "República del Congo",
  "Romania": "Rumania", "Russia": "Rusia", "Rwanda": "Ruanda",
  "Saint Kitts and Nevis": "San Cristóbal y Nieves", "Saint Lucia": "Santa Lucía",
  "Saint Vincent and the Grenadines": "San Vicente y las Granadinas",
  "Samoa": "Samoa", "San Marino": "San Marino",
  "Sao Tome and Principe": "Santo Tomé y Príncipe", "Saudi Arabia": "Arabia Saudita",
  "Senegal": "Senegal", "Serbia": "Serbia", "Seychelles": "Seychelles",
  "Sierra Leone": "Sierra Leona", "Singapore": "Singapur", "Slovakia": "Eslovaquia",
  "Slovenia": "Eslovenia", "Solomon Islands": "Islas Salomón", "Somalia": "Somalia",
  "South Africa": "Sudáfrica", "South Korea": "Corea del Sur",
  "South Sudan": "Sudán del Sur", "Spain": "España", "Sri Lanka": "Sri Lanka",
  "Sudan": "Sudán", "Suriname": "Surinam", "Sweden": "Suecia",
  "Switzerland": "Suiza", "Syria": "Siria", "Taiwan": "Taiwán",
  "Tajikistan": "Tayikistán", "Tanzania": "Tanzania", "Thailand": "Tailandia",
  "Timor-Leste": "Timor Oriental", "Togo": "Togo", "Tonga": "Tonga",
  "Trinidad and Tobago": "Trinidad y Tobago", "Tunisia": "Túnez",
  "Turkey": "Turquía", "Türkiye": "Turquía", "Turkmenistan": "Turkmenistán",
  "Tuvalu": "Tuvalu", "Uganda": "Uganda", "Ukraine": "Ucrania",
  "United Arab Emirates": "Emiratos Árabes Unidos", "United Kingdom": "Reino Unido",
  "United States": "Estados Unidos", "United States of America": "Estados Unidos",
  "Uruguay": "Uruguay", "Uzbekistan": "Uzbekistán", "Vanuatu": "Vanuatu",
  "Venezuela": "Venezuela", "Viet Nam": "Vietnam", "Vietnam": "Vietnam",
  "Yemen": "Yemen", "Zambia": "Zambia", "Zimbabwe": "Zimbabue",
};

export const COUNTRY_ID: Record<string, string> = {
  "Afghanistan": "Afghanistan", "Albania": "Albania", "Algeria": "Aljazair",
  "Andorra": "Andorra", "Angola": "Angola", "Antigua and Barbuda": "Antigua dan Barbuda",
  "Argentina": "Argentina", "Armenia": "Armenia", "Australia": "Australia",
  "Austria": "Austria", "Azerbaijan": "Azerbaijan", "Bahamas": "Bahama",
  "Bahrain": "Bahrain", "Bangladesh": "Bangladesh", "Barbados": "Barbados",
  "Belarus": "Belarus", "Belgium": "Belgia", "Belize": "Belize", "Benin": "Benin",
  "Bhutan": "Bhutan", "Bolivia": "Bolivia", "Bosnia and Herzegovina": "Bosnia dan Herzegovina",
  "Botswana": "Botswana", "Brazil": "Brasil", "Brunei": "Brunei",
  "Bulgaria": "Bulgaria", "Burkina Faso": "Burkina Faso", "Burundi": "Burundi",
  "Cabo Verde": "Tanjung Verde", "Cambodia": "Kamboja", "Cameroon": "Kamerun",
  "Canada": "Kanada", "Central African Republic": "Republik Afrika Tengah",
  "Chad": "Chad", "Chile": "Chili", "China": "Tiongkok", "Colombia": "Kolombia",
  "Comoros": "Komoro", "Congo": "Kongo", "Costa Rica": "Kosta Rika",
  "Croatia": "Kroasia", "Cuba": "Kuba", "Cyprus": "Siprus",
  "Czech Republic": "Republik Ceko", "Côte d'Ivoire": "Pantai Gading",
  "Ivory Coast": "Pantai Gading",
  "Democratic Republic of the Congo": "Republik Demokratik Kongo",
  "Democratic Republic of Congo": "Republik Demokratik Kongo",
  "DR Congo": "Republik Demokratik Kongo", "DRC": "RD Kongo",
  "Denmark": "Denmark", "Djibouti": "Djibouti", "Dominica": "Dominika",
  "Dominican Republic": "Republik Dominika", "Ecuador": "Ekuador", "Egypt": "Mesir",
  "El Salvador": "El Salvador", "Equatorial Guinea": "Guinea Khatulistiwa",
  "Eritrea": "Eritrea", "Estonia": "Estonia", "Eswatini": "Eswatini",
  "Ethiopia": "Etiopia", "EU/EEA": "UE/EEA", "Fiji": "Fiji", "Finland": "Finlandia",
  "France": "Prancis", "Gabon": "Gabon", "Gambia": "Gambia", "Georgia": "Georgia",
  "Germany": "Jerman", "Ghana": "Ghana", "Global": "Global", "Greece": "Yunani",
  "Grenada": "Grenada", "Guatemala": "Guatemala", "Guinea": "Guinea",
  "Guinea-Bissau": "Guinea-Bissau", "Guyana": "Guyana", "Haiti": "Haiti",
  "Honduras": "Honduras", "Hungary": "Hongaria", "Iceland": "Islandia",
  "India": "India", "Indonesia": "Indonesia", "Iran": "Iran", "Iraq": "Irak",
  "Ireland": "Irlandia", "Israel": "Israel", "Italy": "Italia",
  "Jamaica": "Jamaika", "Japan": "Jepang", "Jordan": "Yordania",
  "Kazakhstan": "Kazakhstan", "Kenya": "Kenya", "Kiribati": "Kiribati",
  "Kuwait": "Kuwait", "Kyrgyzstan": "Kirgizstan", "Laos": "Laos", "Latvia": "Latvia",
  "Lebanon": "Lebanon", "Lesotho": "Lesotho", "Liberia": "Liberia", "Libya": "Libya",
  "Liechtenstein": "Liechtenstein", "Lithuania": "Lituania", "Luxembourg": "Luksemburg",
  "Madagascar": "Madagaskar", "Malawi": "Malawi", "Malaysia": "Malaysia",
  "Maldives": "Maladewa", "Mali": "Mali", "Malta": "Malta",
  "Marshall Islands": "Kepulauan Marshall", "Mauritania": "Mauritania",
  "Mauritius": "Mauritius", "Mexico": "Meksiko", "Micronesia": "Mikronesia",
  "Moldova": "Moldova", "Monaco": "Monako", "Mongolia": "Mongolia",
  "Montenegro": "Montenegro", "Morocco": "Maroko", "Mozambique": "Mozambik",
  "Myanmar": "Myanmar", "Namibia": "Namibia", "Nauru": "Nauru", "Nepal": "Nepal",
  "Netherlands": "Belanda", "New Zealand": "Selandia Baru", "Nicaragua": "Nikaragua",
  "Niger": "Niger", "Nigeria": "Nigeria", "North Korea": "Korea Utara",
  "North Macedonia": "Makedonia Utara", "Norway": "Norwegia", "Oman": "Oman",
  "Pakistan": "Pakistan", "Palau": "Palau", "Palestine": "Palestina",
  "Panama": "Panama", "Papua New Guinea": "Papua Nugini", "Paraguay": "Paraguay",
  "Peru": "Peru", "Philippines": "Filipina", "Poland": "Polandia",
  "Portugal": "Portugal", "Qatar": "Qatar", "Republic of the Congo": "Republik Kongo",
  "Romania": "Rumania", "Russia": "Rusia", "Rwanda": "Rwanda",
  "Saint Kitts and Nevis": "Saint Kitts dan Nevis", "Saint Lucia": "Saint Lucia",
  "Saint Vincent and the Grenadines": "Saint Vincent dan Grenadines",
  "Samoa": "Samoa", "San Marino": "San Marino",
  "Sao Tome and Principe": "Sao Tome dan Principe", "Saudi Arabia": "Arab Saudi",
  "Senegal": "Senegal", "Serbia": "Serbia", "Seychelles": "Seychelles",
  "Sierra Leone": "Sierra Leone", "Singapore": "Singapura", "Slovakia": "Slowakia",
  "Slovenia": "Slovenia", "Solomon Islands": "Kepulauan Solomon", "Somalia": "Somalia",
  "South Africa": "Afrika Selatan", "South Korea": "Korea Selatan",
  "South Sudan": "Sudan Selatan", "Spain": "Spanyol", "Sri Lanka": "Sri Lanka",
  "Sudan": "Sudan", "Suriname": "Suriname", "Sweden": "Swedia",
  "Switzerland": "Swiss", "Syria": "Suriah", "Taiwan": "Taiwan",
  "Tajikistan": "Tajikistan", "Tanzania": "Tanzania", "Thailand": "Thailand",
  "Timor-Leste": "Timor Leste", "Togo": "Togo", "Tonga": "Tonga",
  "Trinidad and Tobago": "Trinidad dan Tobago", "Tunisia": "Tunisia",
  "Turkey": "Turki", "Türkiye": "Turki", "Turkmenistan": "Turkmenistan",
  "Tuvalu": "Tuvalu", "Uganda": "Uganda", "Ukraine": "Ukraina",
  "United Arab Emirates": "Uni Emirat Arab", "United Kingdom": "Inggris",
  "United States": "Amerika Serikat", "United States of America": "Amerika Serikat",
  "Uruguay": "Uruguay", "Uzbekistan": "Uzbekistan", "Vanuatu": "Vanuatu",
  "Venezuela": "Venezuela", "Viet Nam": "Vietnam", "Vietnam": "Vietnam",
  "Yemen": "Yaman", "Zambia": "Zambia", "Zimbabwe": "Zimbabwe",
};

export function getLocalizedCountry(outbreak: LocalizedCountryFields, locale: string): string {
  // The `country` column stores the French name directly (from findCountry().name_fr).
  // For FR: return it as-is. For legacy rows where country might be English, try COUNTRY_FR.
  if (locale === "fr") {
    return COUNTRY_FR[outbreak.country] ?? outbreak.country;
  }
  const en = outbreak.country_en || outbreak.country;
  if (locale === "ar") return outbreak.country_ar || en;
  if (locale === "es") return COUNTRY_ES[en] ?? en;
  if (locale === "id") return COUNTRY_ID[en] ?? en;
  return en; // en = default
}

export function getStats(outbreaks: Outbreak[]) {
  const activeOutbreaks   = outbreaks.length;
  const countriesAffected = new Set(outbreaks.map((o) => o.country)).size;
  const highRisk          = outbreaks.filter((o) => o.risk_level === "high").length;
  const alertsToday       = outbreaks.filter(
    (o) => new Date(o.date) >= new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  ).length;
  const pheicCount        = outbreaks.filter((o) => o.is_pheic).length;
  const totalCases        = outbreaks.reduce((sum, o) => sum + (o.cases || 0), 0);

  // Top priority: PHEIC first, then by case count descending
  const topOutbreak = [...outbreaks].sort((a, b) => {
    if (a.is_pheic && !b.is_pheic) return -1;
    if (!a.is_pheic && b.is_pheic) return 1;
    return (b.cases || 0) - (a.cases || 0);
  })[0] ?? null;

  return { activeOutbreaks, countriesAffected, highRisk, alertsToday, pheicCount, totalCases, topOutbreak };
}

// "~" is an internal sentinel written by backfill-admin1 (a full-text extraction
// attempt found no province) so the cron doesn't keep retrying it — never a real
// value to display or expose externally. Use this instead of a truthy check.
export function hasRealAdmin1(admin1: string | null | undefined): boolean {
  return !!admin1 && admin1 !== "~";
}

/** Returns true if the outbreak was updated or created within the last 24 hours */
export function isNewOutbreak(outbreak: Outbreak): boolean {
  const ref = outbreak.updated_at ?? outbreak.created_at;
  if (!ref) return false;
  return Date.now() - new Date(ref).getTime() < 24 * 60 * 60 * 1000;
}

// Mirrors the DB query in getOutbreaks(): active=true OR (priority>=3 AND recent).
// Use this instead of `o.active` when splitting outbreaks into active/history for
// display — prevents endemic diseases (Dengue, Cholera, H5N1) from falling into
// "history" after the data-quality cron closes resolved WHO DON events.
const SIXTY_DAYS_MS = 60 * 86_400_000;
export function isDisplayActive(o: Pick<Outbreak, "active" | "source_priority" | "updated_at" | "is_seed" | "date" | "response_phase">): boolean {
  if (o.active) return true;
  // `response_phase === "contained"` is an explicit closure signal (the responsible
  // authority declared the event over — e.g. a discharged medevac patient, an
  // outbreak declared ended after its incubation-period monitoring window), unlike
  // the generic "just hasn't had a fresh bulletin yet" case the 60-day fallback below
  // exists for. Found 2026-08-02: Ebola/Germany, Ebola/Uganda, Ebola/France and
  // Nipah/India — all closed and explicitly marked `contained` — still showed up
  // under "Active outbreaks" on their country/disease pages for up to 60 days after
  // closing. Checked before the fallback so a genuinely-contained one-off event goes
  // straight to history instead of lingering as "active".
  if (o.response_phase === "contained") return false;
  // is_seed rows (WHO GHO annual burden estimates for endemic diseases, or a historical
  // outbreak flagged as seed data) are reference/background data, not a live tracked
  // event — the recency fallback below exists to keep a DYNAMICALLY-tracked endemic
  // disease from vanishing when its row closes before a fresh bulletin arrives, not to
  // resurrect a static annual estimate just because a routine batch touch (e.g. the
  // translation backfill) bumped its updated_at. Found 2026-07-15: 32 such rows, Malaria
  // GHO estimates dominant, summed to 170M+ phantom "active" cases sitewide (Nigeria
  // 68M, DR Congo 35M, Uganda 13M...) — the Malaria disease page showed "170,144,635
  // cases / 10 foyers actifs". Never affects is_seed rows that are genuinely active=true
  // (the protected DON-linked clusters — Chikungunya, MERS-CoV, Cholera, Polio PHEIC,
  // Cereulide — already return true above via the plain `active` check).
  if (o.is_seed) return false;
  // Also require the row's own reported `date` to be recent, not just `updated_at` —
  // otherwise a row deliberately archived years ago gets resurrected as "active" the
  // moment anything touches its updated_at (a description edit, a translation
  // backfill), regardless of how stale the actual event is. Found 2026-08-01:
  // Dengue/Haiti (date 2022-06-26, active=false, explicitly archived as no-longer-
  // current) displayed as a live "Foyer en cours" after its description was edited
  // 2026-07-28 bumped updated_at into the 60-day window. Mirrors the same guard
  // added to getOutbreaksCached()'s DB query in lib/outbreaks.ts.
  if ((o.source_priority ?? 0) >= 3 && o.updated_at && o.date) {
    const now = Date.now();
    return (
      new Date(o.updated_at).getTime() >= now - SIXTY_DAYS_MS &&
      new Date(o.date).getTime() >= now - SIXTY_DAYS_MS
    );
  }
  return false;
}

type DisplayActiveRow = Pick<Outbreak, "active" | "source_priority" | "updated_at" | "disease_en" | "disease" | "country_en" | "country" | "is_seed" | "date" | "response_phase">;

// Sibling-aware wrapper around isDisplayActive(): the 60-day recency fallback exists so an
// endemic disease doesn't vanish from display when its ONLY row goes inactive before a fresh
// bulletin arrives — it was never meant to also resurrect an older, superseded row for a
// disease+country pair that already has a genuinely active=true representative. A routine
// batch touch (e.g. the translation backfill) bumping updated_at on a long-closed row is
// enough to keep it inside the 60-day window indefinitely, double-counting it on top of the
// current figure. Found 2026-07-15: the Ebola DRC disease page summed 3 superseded case-count
// snapshots (including one the current active row explicitly replaced) alongside the current
// 1,963/719, inflating displayed totals by ~76%/69% — 13 such rows across 6 disease+country
// pairs sitewide. Doesn't touch active=true rows, so it can't affect cases like avian flu/US
// where many distinct active rows legitimately coexist (one per state) under the same key.
// Keyed via normalizeDisease() rather than the raw disease_en string — mirrors
// getOutbreaksCached()'s own dedup key. Without it, e.g. an inactive "Sudan virus
// disease"/Uganda row and an active "Ebola virus disease"/Uganda row (both
// Bundibugyo-family, both normalizing to the same canonical "Ebola virus disease")
// aren't recognized as siblings, and the inactive one keeps resurrecting.
function displayActiveKey(o: DisplayActiveRow): string {
  const diseaseKey = normalizeDisease(o.disease_en || o.disease).name_en.toLowerCase();
  const countryKey = (o.country_en || o.country || "").toLowerCase();
  return `${diseaseKey}|${countryKey}`;
}

export function filterDisplayActive<T extends DisplayActiveRow>(rows: T[]): T[] {
  const activeKeys = new Set<string>();
  for (const o of rows) {
    if (o.active) activeKeys.add(displayActiveKey(o));
  }
  return rows.filter((o) => {
    if (o.active) return true;
    if (activeKeys.has(displayActiveKey(o))) return false;
    return isDisplayActive(o);
  });
}

// True when a row's "country" is actually a WHO/ECDC roll-up ("Global", "Multi-country",
// "Africa (regional)"...) rather than a real place — see isAggregateCountry() in geo-data.ts.
// Pages that sum cases/deaths per disease across rows must exclude these when real
// country-level rows exist for the same disease, otherwise a "Global situation report"
// figure (which already cumulates every country) gets added on top of its own components.
// Found 2026-07-16: Mpox summed Global (61,061) + Kenya/Burundi/Rwanda/Uganda on top,
// showing 75,587 — ~24% inflated. Same family as the Ebola/DRC fix (see
// project_ebola_drc_display_inflation_fixed_2026_07_15), different root cause: that one was
// duplicate/superseded rows, this one is a legitimate aggregate counted alongside its own detail.
export function isAggregateOutbreakRow(o: Pick<Outbreak, "country_en" | "country">): boolean {
  const geo = findCountry(o.country_en || o.country);
  return !!geo && isAggregateCountry(geo);
}

// Applies the isAggregateOutbreakRow rule above per disease: country-level rows win over
// their own aggregate when any exist, and the aggregate is kept only as a fallback when a
// disease has no country-level row at all in the given row set (e.g. MERS-CoV and Yellow
// fever, tracked in Africa only via a "Global" WHO bulletin with no country breakdown).
// A blanket "always drop aggregates" filter would silently zero those diseases out instead
// of just deduplicating them — this is why the fallback branch exists.
//
// Extracted 2026-08-12 from region/[region]/page.tsx (the only caller applying this rule
// correctly at the time) after the same un-deduped sum was found inflating region totals in
// the paid PDF/HTML report, the Pro situation digest, the Pro regional digest email, and the
// dashboard's regional-pulse widget — one inline copy would have meant five, drifting apart.
export function dedupeAggregateOutbreakRows<
  T extends Pick<Outbreak, "country_en" | "country" | "disease_en" | "disease">
>(rows: T[]): T[] {
  const byDisease = new Map<string, T[]>();
  for (const o of rows) {
    const key = normalizeDisease(o.disease_en || o.disease).name_en.toLowerCase();
    const bucket = byDisease.get(key);
    if (bucket) bucket.push(o); else byDisease.set(key, [o]);
  }
  const result: T[] = [];
  for (const bucket of byDisease.values()) {
    const countryRows = bucket.filter((o) => !isAggregateOutbreakRow(o));
    result.push(...(countryRows.length > 0 ? countryRows : bucket));
  }
  return result;
}

const STALE_DAYS = 60;

/**
 * Returns how many days since the last official update for an active outbreak,
 * or null if the outbreak is not stale (< STALE_DAYS) or not active.
 *
 * A stale active outbreak signals either resolution without a closing bulletin,
 * or a reporting gap — both meaningful for surveillance in enclosed zones.
 */
export function staleOutbreakDays(outbreak: Outbreak): number | null {
  if (!outbreak.active) return null;
  const ref = outbreak.updated_at ?? outbreak.date;
  if (!ref) return null;
  const days = Math.floor((Date.now() - new Date(ref).getTime()) / 86_400_000);
  return days >= STALE_DAYS ? days : null;
}

// Positive freshness signal — mirrors staleOutbreakDays but for the other end
// of the range: confirms to the viewer that a figure was synced recently,
// instead of only ever warning when it's old. Capped at 7 days so the badge
// stays meaningful (matches WHO DON's hourly/daily sync cadence) rather than
// firing for anything merely short of the 60-day stale threshold.
const FRESH_HOURS_CAP = 7 * 24;

export function freshOutbreakHours(outbreak: Outbreak): number | null {
  if (!outbreak.active) return null;
  const ref = outbreak.updated_at;
  if (!ref) return null;
  const hours = Math.floor((Date.now() - new Date(ref).getTime()) / 3_600_000);
  if (hours < 0 || hours > FRESH_HOURS_CAP) return null;
  return hours;
}

// Source trust classification (which publisher, and how much the badges may claim) lives
// in lib/source-trust.ts — dependency-free so scripts/check-source-trust.mjs can replay the
// live table through it. Re-exported here because every consumer imports it from
// "@/lib/outbreaks".
export type { SourceStatus };
export { sourceName } from "./source-trust";

export function sourceStatus(outbreak: Pick<Outbreak, "source">): SourceStatus {
  return sourceStatusOf(outbreak.source);
}

/** Backward-compatible alias: true when source is not a confirmed WHO DON article. */
export function isIllustrativeData(outbreak: Pick<Outbreak, "source">): boolean {
  return sourceStatus(outbreak) !== 'don';
}

/**
 * 1–10 risk score per outbreak.
 * Base from risk_level; boosted by PHEIC, trend, high CFR, active response,
 * confirmed status; reduced by stale data or containment.
 * Shown as a qualitative signal (like TrendBadge) — visible to all users.
 */
export function computeRiskScore(
  outbreak: Outbreak,
  trend?: Pick<OutbreakTrend, "direction">
): number {
  // Base: high=6, medium=4, low=2
  let score = outbreak.risk_level === "high" ? 6 : outbreak.risk_level === "medium" ? 4 : 2;

  if (outbreak.is_pheic) score += 2;

  if (trend?.direction === "up")   score += 1;
  if (trend?.direction === "down") score -= 0.5;

  if (outbreak.cases > 0 && outbreak.deaths !== null) {
    const cfr = outbreak.deaths / outbreak.cases;
    if (cfr > 0.10) score += 1;
    else if (cfr > 0.03) score += 0.5;
  }

  // Confirmed status: data verified by health authorities
  if (outbreak.verification_status === "confirmed") score += 0.5;

  // Active response: field teams deployed — confirms severity
  if (outbreak.response_phase === "active_response") score += 1;
  // Contained: spread is being limited — reduce urgency
  if (outbreak.response_phase === "contained") score -= 1;

  // Stale = may be resolving
  if (staleOutbreakDays(outbreak) !== null) score -= 0.5;

  return Math.round(Math.min(10, Math.max(1, score)));
}

