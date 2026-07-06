import { findCountry } from "./geo-data";
import { normalizeDisease } from "./disease-data";
import type { ParsedOutbreak } from "./outbreak-parser";
import { extractNumbers, assessRisk } from "./outbreak-parser";

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

// DISABLED (legal) — ReliefWeb's terms permit "personal, non-commercial use" only,
// with no right to redistribute or create derivative works over third-party
// copyrighted partner reports. HealthWatch Global is a commercial product, so
// ingesting ReliefWeb breaches its ToS — the same legal shape as the ProMED C&D
// (see legal_reliefweb_noncommercial). Returns empty; never calls the ReliefWeb API.
// This module currently has no importers; kept only so the type/parse helpers below
// remain available. Do NOT restore the fetch without a written commercial licence.
export async function fetchReliefWebOutbreaks(): Promise<ReliefWebItem[]> {
  return [];
}

// Extract disease name from a ReliefWeb report title
function extractDisease(title: string): string {
  const t = title
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
  const { title, date, "body-html": bodyHtml, country } = item.fields;
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
    admin1:     null,
    admin1_lat: null,
    admin1_lng: null,
    cases,
    deaths,
    recovered: 0,
    risk_level,
    date: dateStr,
    source: `https://reliefweb.int/node/${item.id}`,
    description,
    active: true,
  };
}
