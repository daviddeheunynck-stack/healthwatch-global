// ─── Couverture réelle des régions d'alerte ───────────────────────────────────
//
// POURQUOI CE FICHIER EXISTE
// Les alertes se règlent par continent (`user_alert_regions.region`), alors que
// les institutions raisonnent en régions OMS (AFRO, EMRO, PAHO…). Le 25/08/2026,
// l'Institut Pasteur du Maroc a demandé un accès « Afrique + EMRO » : l'EMRO
// n'existe pas dans le modèle, et rien dans l'interface ne disait où passait la
// frontière. Un acheteur ne devrait jamais avoir à deviner si l'Égypte est dans
// « Afrique » ou dans « Asie ».
//
// La réponse n'est pas d'écrire une liste de pays à la main quelque part — elle
// deviendrait fausse au premier pays ajouté, et ce serait le pire endroit du
// produit où mentir. Tout ici est DÉRIVÉ de `lib/geo-data.ts`, qui est déjà la
// source de vérité utilisée par les crons pour classer un foyer.
//
// `scripts/check-region-coverage.mjs` vérifie que la dérivation reste saine.

import { COUNTRIES } from "@/lib/geo-data";

export const ALERT_REGIONS = ["africa", "asia", "americas", "europe", "oceania"] as const;
export type AlertRegion = (typeof ALERT_REGIONS)[number];

export type CoverageLocale = "fr" | "en" | "es" | "ar" | "id";

// `COUNTRIES` sert aussi au parsing des bulletins : il contient des agrégats
// ("Africa (regional)", "EU/EEA") et des fourre-tout ("Global", "Multiple
// countries") qui ne sont pas des pays. Les montrer dans une liste de couverture
// serait un faux chiffre présenté à un épidémiologiste.
const NOT_A_COUNTRY = new Set(["Global", "Multiple countries", "EU/EEA"]);

export function isRealCountry(nameEn: string): boolean {
  return !NOT_A_COUNTRY.has(nameEn) && !/\(regional\)$/i.test(nameEn);
}

interface CoverageEntry {
  name_en: string;
  name_fr: string;
  name_ar: string;
}

// Construit une fois par processus. `COUNTRIES` contient plusieurs clés pour un
// même pays (variantes OMS : "Tanzania" / "United Republic of Tanzania",
// "Ivory Coast" / "Côte d'Ivoire") — on dédoublonne sur name_en, sinon la
// Tanzanie serait comptée deux fois.
let cache: Record<AlertRegion, CoverageEntry[]> | null = null;

function build(): Record<AlertRegion, CoverageEntry[]> {
  if (cache) return cache;

  const byRegion = {
    africa: new Map<string, CoverageEntry>(),
    asia: new Map<string, CoverageEntry>(),
    americas: new Map<string, CoverageEntry>(),
    europe: new Map<string, CoverageEntry>(),
    oceania: new Map<string, CoverageEntry>(),
  } satisfies Record<AlertRegion, Map<string, CoverageEntry>>;

  for (const geo of Object.values(COUNTRIES)) {
    if (!isRealCountry(geo.name_en)) continue;
    const bucket = byRegion[geo.region as AlertRegion];
    if (!bucket || bucket.has(geo.name_en)) continue;
    bucket.set(geo.name_en, {
      name_en: geo.name_en,
      name_fr: geo.name_fr,
      name_ar: geo.name_ar,
    });
  }

  cache = {
    africa: [...byRegion.africa.values()],
    asia: [...byRegion.asia.values()],
    americas: [...byRegion.americas.values()],
    europe: [...byRegion.europe.values()],
    oceania: [...byRegion.oceania.values()],
  };
  return cache;
}

/** Nombre de pays et territoires réellement couverts par une région d'alerte. */
export function regionCountryCount(region: AlertRegion): number {
  return build()[region].length;
}

/**
 * Noms des pays d'une région, localisés et triés selon la locale.
 * `geo-data` ne porte que fr / en / ar : es et id retombent sur l'anglais, ce
 * qui est visible mais honnête — mieux vaut un nom anglais qu'un nom inventé.
 */
export function regionCountryNames(region: AlertRegion, locale: string): string[] {
  const pick = (e: CoverageEntry) =>
    locale === "fr" ? e.name_fr : locale === "ar" ? e.name_ar : e.name_en;
  const collator = new Intl.Collator(locale === "ar" ? "ar" : locale || "en");
  return build()[region].map(pick).sort((a, b) => collator.compare(a, b));
}

/** Toutes les régions avec leur compte — pratique pour un sélecteur. */
export function allRegionCounts(): Record<AlertRegion, number> {
  const b = build();
  return {
    africa: b.africa.length,
    asia: b.asia.length,
    americas: b.americas.length,
    europe: b.europe.length,
    oceania: b.oceania.length,
  };
}

// ─── Formulation courte, pour les e-mails ─────────────────────────────────────
// Une ligne de pied de message, pas une liste : personne ne veut 54 pays dans un
// e-mail d'alerte. Le détail exhaustif est sur la page compte.

// Formulation choisie avec soin : « cet e-mail couvre », pas « vous suivez ».
// L'appelant (le cron d'alertes) ne connaît que les régions ayant produit un
// foyer dans CE lot, pas l'abonnement complet de la personne. Écrire « vous
// suivez : Afrique » à quelqu'un abonné à l'Afrique et à l'Asie serait faux —
// et se tromper sur la couverture, dans un produit dont l'argument est la
// vérification, coûterait plus cher que de ne rien dire.
const COVERAGE_NOTE: Record<CoverageLocale, (regions: string) => string> = {
  fr: (r) => `Cet e-mail couvre : ${r}.`,
  en: (r) => `This email covers: ${r}.`,
  es: (r) => `Este correo cubre: ${r}.`,
  ar: (r) => `يغطي هذا البريد: ${r}.`,
  id: (r) => `Email ini mencakup: ${r}.`,
};

const COUNTRIES_WORD: Record<CoverageLocale, (n: number) => string> = {
  fr: (n) => `${n} pays`,
  en: (n) => `${n} countries`,
  es: (n) => `${n} países`,
  ar: (n) => `${n} دولة`,
  id: (n) => `${n} negara`,
};

/**
 * "Cet e-mail couvre : Afrique (54 pays), Asie (45 pays)."
 * Rendue en pied des e-mails d'alerte pour que le destinataire sache ce que
 * couvre — et ne couvre pas — le message qu'il vient de recevoir.
 * `regions` doit être l'ensemble des régions représentées dans CET envoi.
 */
export function buildCoverageNote(
  regions: AlertRegion[],
  regionLabels: Record<string, string>,
  locale: string,
): string | undefined {
  const uniq = [...new Set(regions)].filter((r): r is AlertRegion =>
    (ALERT_REGIONS as readonly string[]).includes(r),
  );
  if (uniq.length === 0) return undefined;

  const l = (["fr", "en", "es", "ar", "id"] as const).includes(locale as CoverageLocale)
    ? (locale as CoverageLocale)
    : "en";

  const parts = uniq.map(
    (r) => `${regionLabels[r] ?? r} (${COUNTRIES_WORD[l](regionCountryCount(r))})`,
  );
  return COVERAGE_NOTE[l](parts.join(", "));
}
