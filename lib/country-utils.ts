/** "Democratic Republic of the Congo" → "democratic-republic-of-the-congo" */
export function countryToSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Given a slug and a list of country_en values from the DB, return the match. */
export function slugToCountryEn(slug: string, allCountries: string[]): string | null {
  return allCountries.find((c) => countryToSlug(c) === slug) ?? null;
}

import { getLocalizedCountry } from "@/lib/outbreaks";

/**
 * Preferred display name per locale.
 * Thin wrapper around the canonical getLocalizedCountry() in lib/outbreaks.ts —
 * this used to duplicate that logic but only handled `ar`, silently falling
 * back to English for fr/es/id and never consulting the COUNTRY_FR/ES/ID maps.
 */
export function getLocalizedCountryName(
  o: { country?: string | null; country_en?: string | null; country_ar?: string | null },
  locale: string
): string {
  if (!o.country && !o.country_en) return "—";
  return getLocalizedCountry(
    { country: o.country ?? "", country_en: o.country_en ?? null, country_ar: o.country_ar ?? null },
    locale
  );
}
