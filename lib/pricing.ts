// Single source of truth for all pricing values.
// When prices change, update ONLY this file.

export const PRICES = {
  eur: {
    pro:  { monthly: 29,  annual: 249,  annualSavings: 99  },
    team: { monthly: 149, annual: 1290, annualSavings: 498 },
  },
  // USD used on the checkout page for the EN locale only (Stripe price IDs are USD)
  usd: {
    pro:  { monthly: 49,  annual: 468,  annualSavings: 120 },
    team: { monthly: 165, annual: 1425, annualSavings: 555 },
  },
} as const;

// Locale-formatted display strings (symbol position & thousands separator vary by locale)
// EN uses USD on PricingCards (actual checkout); all other components use EUR even for EN.
export const PRICE_DISPLAY = {
  fr: {
    proMonthly:        "29 €",
    proAnnual:         "249 €",
    proAnnualSavings:  "99 €",
    teamMonthly:       "149 €",
    teamAnnual:        "1 290 €",
    teamAnnualSavings: "498 €",
  },
  // EN checkout uses USD — used by PricingCards only
  en: {
    proMonthly:        "$49",
    proAnnual:         "$468",
    proAnnualSavings:  "$120",
    teamMonthly:       "$165",
    teamAnnual:        "$1,425",
    teamAnnualSavings: "$555",
  },
  // EN marketing copy (FreePlanBanner, UpgradeModal, LandingPage, etc.) uses EUR
  en_eur: {
    proMonthly:        "€29",
    proAnnual:         "€249",
    proAnnualSavings:  "€99",
    teamMonthly:       "€149",
    teamAnnual:        "€1,290",
    teamAnnualSavings: "€498",
  },
  es: {
    proMonthly:        "€29",
    proAnnual:         "€249",
    proAnnualSavings:  "€99",
    teamMonthly:       "€149",
    teamAnnual:        "€1.290",
    teamAnnualSavings: "€498",
  },
  ar: {
    proMonthly:        "€29",
    proAnnual:         "€249",
    proAnnualSavings:  "99 €",
    teamMonthly:       "€149",
    teamAnnual:        "€1.290",
    teamAnnualSavings: "498 €",
  },
  id: {
    proMonthly:        "€29",
    proAnnual:         "€249",
    proAnnualSavings:  "€99",
    teamMonthly:       "€149",
    teamAnnual:        "€1.290",
    teamAnnualSavings: "€498",
  },
} as const;

export type PricingLocale = keyof typeof PRICE_DISPLAY;

/** For PricingCards (checkout): EN → USD, all others → EUR */
export function getPriceDisplay(locale: string) {
  return PRICE_DISPLAY[(locale as PricingLocale)] ?? PRICE_DISPLAY.en;
}

/** For marketing copy: always EUR regardless of locale */
export function getMarketingPriceDisplay(locale: string) {
  if (locale === "en") return PRICE_DISPLAY.en_eur;
  return PRICE_DISPLAY[(locale as PricingLocale)] ?? PRICE_DISPLAY.en_eur;
}
