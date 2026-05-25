import { findCountry } from "./geo-data";
import { normalizeDisease } from "./disease-data";
import type { ParsedOutbreak } from "./outbreak-parser";
import { extractNumbers, assessRisk } from "./outbreak-parser";

const RELIEFWEB_API = "https://api.reliefweb.int/v2/reports";

export interface ReliefWebItem {
  id: string;
  fields: {
    title: string;
    date: { created: string };
    "body-html"?: string;
    country?: Array<{ name: string }>;
    source?: Array<{ shortname: string }>;
  };
}

export async function fetchReliefWebOutbreaks(): Promise<ReliefWebItem[]> {
  const params = new URLSearchParams({
    appname: "healthwatch-global",
    limit: "30",
    sort: "date:desc",
  });

  // Fields we want
  const fields = ["title", "date.created", "body-html", "country.name", "source.shortname"];
  fields.forEach((f) => params.append("fields[include][]", f));

  // Filter: Health theme
  params.set("filter[field]", "theme.name");
  params.set("filter[value]", "Health");

  const url = `${RELIEFWEB_API}?${params.toString()}`;

  const res = await fetch(url, {
    headers: {
      "User-Agent": "HealthWatch-Global/1.0 (contact@healthwatch-global.com)",
      "Accept": "application/json",
    },
    next: { revalidate: 0 },
  });

  if (!res.ok) throw new Error(`ReliefWeb HTTP ${res.status}`);
  const json = await res.json();
  return json.data || [];
}

// Extract disease name from a ReliefWeb report title
function extractDisease(title: string): string {
  let t = title
    .replace(/^Disease Outbreak News:\s*/i, "")
    .replace(/^WHO\s+/i, "")
    .trim();

  // Split on " - " or "–" and take the first part (disease)
  const beforeDash = t.split(/\s*[-–—]\s*/)[0].trim();

  // Remove trailing words: Outbreak, Virus, Update, situation report, colon+rest
  return beforeDash
    .replace(/:\s*.*/i, "")
    .replace(/\s+outbreak\b/gi, "")
    .replace(/\s+update\b/gi, "")
    .replace(/\s+\(\d+\)$/gi, "")
    .trim();
}

export function parseReliefWebItem(item: ReliefWebItem): ParsedOutbreak | null {
  const { title, date, "body-html": bodyHtml, country, source } = item.fields;
  if (!title) return null;

  // ── Country ────────────────────────────────────────────────────
  // ReliefWeb gives us the country directly — huge advantage over RSS parsing
  const countryNames = (country || []).map((c) => c.name);

  let geo = null;
  for (const name of countryNames) {
    geo = findCountry(name);
    if (geo) break;
  }

  // Fallback: try to extract country from title
  if (!geo) {
    const titleParts = title.split(/\s*[-–—]\s*/);
    if (titleParts.length >= 2) {
      for (let i = titleParts.length - 1; i >= 1; i--) {
        geo = findCountry(titleParts[i].replace(/:\s*.*/i, "").trim());
        if (geo) break;
      }
    }
  }

  if (!geo) return null;

  // ── Disease ────────────────────────────────────────────────────
  const rawDisease = extractDisease(title);
  if (!rawDisease || rawDisease.length < 2) return null;
  const disease = normalizeDisease(rawDisease);

  // ── Cases / Deaths ─────────────────────────────────────────────
  const plainText = (bodyHtml || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
  const { cases, deaths } = extractNumbers(plainText);

  // ── Risk level ─────────────────────────────────────────────────
  const risk_level = assessRisk(rawDisease, plainText, cases, deaths);

  // ── Date ───────────────────────────────────────────────────────
  const dateStr = date?.created
    ? new Date(date.created).toISOString().split("T")[0]
    : new Date().toISOString().split("T")[0];

  // ── Description ────────────────────────────────────────────────
  const description = plainText.trim().slice(0, 400);

  const sourceLabel = (source || []).map((s) => s.shortname).join(", ") || "ReliefWeb";

  return {
    disease: disease.name_fr,
    disease_en: disease.name_en,
    disease_ar: disease.name_ar,
    country: geo.name_fr,
    country_en: geo.name_en,
    country_ar: geo.name_ar,
    region: geo.region,
    lat: geo.lat,
    lng: geo.lng,
    cases,
    deaths,
    risk_level,
    date: dateStr,
    source: `https://reliefweb.int/node/${item.id}`,
    description,
    active: true,
  };
}
