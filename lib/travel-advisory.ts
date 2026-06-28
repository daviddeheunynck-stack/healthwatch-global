/**
 * FCDO (UK gov.uk) travel advisory integration + government deep-link helpers.
 *
 * FCDO is the only government source with a real public REST API.
 * Other sources (France, Spain) are provided as deep links only.
 */

export type FcdoLevel = "do-not-travel" | "essential-only" | "high-caution" | "normal" | "unknown";

export interface FcdoAdvisory {
  level: FcdoLevel;
  levelText: string;
  url: string;
}

export interface GovLinks {
  fcdo:   string | null;
  france: string | null;
  spain:  string | null;
}

// ── Country name → FCDO slug ─────────────────────────────────────────────────
const FCDO_SLUG: Record<string, string> = {
  "Afghanistan": "afghanistan", "Algeria": "algeria", "Angola": "angola",
  "Bangladesh": "bangladesh", "Benin": "benin", "Bolivia": "bolivia",
  "Brazil": "brazil", "Burkina Faso": "burkina-faso", "Burundi": "burundi",
  "Cambodia": "cambodia", "Cameroon": "cameroon",
  "Central African Republic": "central-african-republic",
  "Chad": "chad", "China": "china", "Colombia": "colombia",
  "Democratic Republic of the Congo": "democratic-republic-congo",
  "DRC": "democratic-republic-congo",
  "Ecuador": "ecuador", "Egypt": "egypt", "El Salvador": "el-salvador",
  "Ethiopia": "ethiopia", "Gabon": "gabon", "Ghana": "ghana",
  "Guinea": "guinea", "Guinea-Bissau": "guinea-bissau",
  "Haiti": "haiti", "India": "india", "Indonesia": "indonesia",
  "Iran": "iran", "Iraq": "iraq", "Ivory Coast": "ivory-coast",
  "Kenya": "kenya", "Liberia": "liberia", "Libya": "libya",
  "Madagascar": "madagascar", "Malawi": "malawi", "Mali": "mali",
  "Mauritania": "mauritania", "Morocco": "morocco",
  "Mozambique": "mozambique", "Myanmar": "myanmar",
  "Nepal": "nepal", "Niger": "niger", "Nigeria": "nigeria",
  "Pakistan": "pakistan", "Peru": "peru", "Philippines": "philippines",
  "Republic of the Congo": "republic-of-the-congo",
  "Rwanda": "rwanda", "Senegal": "senegal", "Sierra Leone": "sierra-leone",
  "Somalia": "somalia", "South Sudan": "south-sudan", "Sudan": "sudan",
  "Syria": "syria", "Tanzania": "tanzania", "Thailand": "thailand",
  "Togo": "togo", "Tunisia": "tunisia", "Uganda": "uganda",
  "Ukraine": "ukraine", "Venezuela": "venezuela", "Vietnam": "vietnam",
  "Yemen": "yemen", "Zambia": "zambia", "Zimbabwe": "zimbabwe",
};

// ── Country name → France Diplomatie URL slug ────────────────────────────────
const FRANCE_SLUG: Record<string, string> = {
  "Afghanistan": "afghanistan", "Algeria": "algerie", "Angola": "angola",
  "Bangladesh": "bangladesh", "Benin": "benin", "Bolivia": "bolivie",
  "Brazil": "bresil", "Burkina Faso": "burkina-faso", "Burundi": "burundi",
  "Cambodia": "cambodge", "Cameroon": "cameroun",
  "Central African Republic": "republique-centrafricaine",
  "Chad": "tchad", "China": "chine", "Colombia": "colombie",
  "Democratic Republic of the Congo": "republique-democratique-du-congo",
  "DRC": "republique-democratique-du-congo",
  "Ecuador": "equateur", "Egypt": "egypte", "El Salvador": "el-salvador",
  "Ethiopia": "ethiopie", "Gabon": "gabon", "Ghana": "ghana",
  "Guinea": "guinee", "Guinea-Bissau": "guinee-bissau",
  "Haiti": "haiti", "India": "inde", "Indonesia": "indonesie",
  "Iran": "iran", "Iraq": "irak", "Ivory Coast": "cote-d-ivoire",
  "Kenya": "kenya", "Liberia": "liberia", "Libya": "libye",
  "Madagascar": "madagascar", "Malawi": "malawi", "Mali": "mali",
  "Mauritania": "mauritanie", "Morocco": "maroc",
  "Mozambique": "mozambique", "Myanmar": "birmanie-myanmar",
  "Nepal": "nepal", "Niger": "niger", "Nigeria": "nigeria",
  "Pakistan": "pakistan", "Peru": "perou", "Philippines": "philippines",
  "Republic of the Congo": "republique-du-congo",
  "Rwanda": "rwanda", "Senegal": "senegal", "Sierra Leone": "sierra-leone",
  "Somalia": "somalie", "South Sudan": "soudan-du-sud", "Sudan": "soudan",
  "Syria": "syrie", "Tanzania": "tanzanie", "Thailand": "thailande",
  "Togo": "togo", "Tunisia": "tunisie", "Uganda": "ouganda",
  "Ukraine": "ukraine", "Venezuela": "venezuela", "Vietnam": "viet-nam",
  "Yemen": "yemen", "Zambia": "zambie", "Zimbabwe": "zimbabwe",
};

// ── FCDO level detection ─────────────────────────────────────────────────────
function parseFcdoLevel(alertStatus: string): FcdoLevel {
  const s = alertStatus.toLowerCase();
  if (s.includes("advise against all travel to") && !s.includes("but essential")) return "do-not-travel";
  if (s.includes("advise against all but essential") || s.includes("essential travel only")) return "essential-only";
  if (s.length > 10) return "high-caution";
  return "normal";
}

// ── Public helpers ────────────────────────────────────────────────────────────
export function getGovLinks(countryEn: string): GovLinks {
  const fcdoSlug   = FCDO_SLUG[countryEn] ?? null;
  const franceSlug = FRANCE_SLUG[countryEn] ?? null;
  return {
    fcdo:   fcdoSlug   ? `https://www.gov.uk/foreign-travel-advice/${fcdoSlug}` : null,
    france: franceSlug ? `https://www.diplomatie.gouv.fr/fr/conseils-aux-voyageurs/conseils-par-pays-destination/${franceSlug}/` : null,
    spain:  "https://www.exteriores.gob.es/es/ServiciosAlCiudadano/Paginas/Viajeros.aspx",
  };
}

export async function fetchFcdoAdvisory(countryEn: string): Promise<FcdoAdvisory | null> {
  const slug = FCDO_SLUG[countryEn];
  if (!slug) return null;

  const apiUrl = `https://www.gov.uk/api/content/foreign-travel-advice/${slug}`;
  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 3000);
    const res = await fetch(apiUrl, {
      signal: controller.signal,
      headers: {
        "User-Agent": "HealthWatch-Global/1.0 (contact@healthwatch-global.com)",
        "Accept":     "application/json",
      },
    });
    clearTimeout(t);
    if (!res.ok) return null;

    const data = await res.json() as { details?: { alert_status?: string; summary?: string } };
    const alertStatus = (data?.details?.alert_status ?? "").replace(/<[^>]+>/g, "").trim();

    return {
      level:     alertStatus ? parseFcdoLevel(alertStatus) : "unknown",
      levelText: alertStatus.length > 220 ? alertStatus.slice(0, 220) + "…" : alertStatus,
      url:       `https://www.gov.uk/foreign-travel-advice/${slug}`,
    };
  } catch {
    return null;
  }
}
