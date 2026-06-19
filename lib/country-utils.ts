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

/** Preferred display name per locale (falls back to country_en then country) */
export function getLocalizedCountryName(
  o: { country?: string | null; country_en?: string | null; country_ar?: string | null },
  locale: string
): string {
  if (locale === "ar" && o.country_ar) return o.country_ar;
  return o.country_en ?? o.country ?? "—";
}
