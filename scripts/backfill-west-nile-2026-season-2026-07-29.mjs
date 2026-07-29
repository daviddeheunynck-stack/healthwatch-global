// linkedin-hwg-content-proposal 2026-07-29 — backfill des 5 pays manquants de la
// saison West Nile 2026.
//
// Repéré le 25/07 ([[project_west_nile_2026_season_missing_rows_2026_07_25]]) puis
// reconfirmé le 29/07 (préparation du post MWF) : la base HWG n'avait qu'une ligne
// West Nile active, France (1 cas, source Santé publique France). L'ECDC en
// annonçait déjà 6 pays au 25/07 ; au 29/07 le trou n'avait toujours pas bougé.
//
// Source primaire lue en session le 29/07 via le Browser pane (le domaine avait été
// refusé par le classifier de claude-in-chrome le 25/07, mais se charge normalement
// ici, contenu HTML statique, pas de rendu JS nécessaire pour le tableau principal) :
// https://wnv-weekly.ecdc.europa.eu/ — "Week 30, 2026. Produced on 23 July 2026 at
// 09:45, based on data submitted up until and including 22 July 2026."
// "The six countries have reported 81 locally acquired human cases of WNV
// infection: Italy has reported 46, Greece 21, North Macedonia five, Romania five,
// Spain three and France one case." Recoupé par le CDTR ECDC semaine 30 (PDF) pour
// le décompte de zones touchées par pays (Italie 20, Grèce 6, Roumanie 4, Macédoine
// du Nord 2, Espagne 2, France 1) et par un article Euronews du 23/07 citant l'EODY
// (Grèce) pour le détail national grec.
//
// `deaths` volontairement laissé NULL pour les 5 pays : ce rapport hebdomadaire
// ECDC (produit pour la sécurité transfusionnelle, pas une synthèse épidémiologique
// complète) ne recense que les cas, jamais les décès. Le seul chiffre de décès vu
// (0 pour la Grèce, via l'EODY citée par Euronews) n'est pas lu sur un document EODY
// primaire (PDF EODY bloqué en 403 à la récupération directe) : laissé non renseigné
// plutôt que d'écrire un chiffre non vérifié mot pour mot contre sa source primaire
// ([[feedback_verify_against_primary_source]]). `deaths` est nullable dans le schéma
// (déjà utilisé ainsi par la ligne Fièvre jaune/Global).
//
// is_backfill=false : la source ECDC est un produit hebdomadaire vivant de la
// saison en cours, pas une archive historique — ce n'est que son ingestion par HWG
// qui est tardive (cf. définition dans lib/outbreaks.ts). Même convention que
// sync-ecdc-threats pour toutes les lignes sourcées ECDC (source_priority=5).
import { readFileSync } from "fs";

const env = readFileSync(".env.local.live", "utf-8");
function getEnv(key) {
  const m = env.match(new RegExp(`^${key}=(.*)$`, "m"));
  if (!m) return "";
  return m[1].replace(/^﻿/, "").replace(/[\r\n]+$/, "").trim().replace(/^"(.*)"$/, "$1");
}
const SUPABASE_URL = getEnv("NEXT_PUBLIC_SUPABASE_URL");
const SERVICE_KEY = getEnv("SUPABASE_SERVICE_ROLE_KEY");
if (!SUPABASE_URL.includes("tqznwmpkokdzrszysbcm")) throw new Error("Pas la prod — arrêt.");

const SOURCE = "https://wnv-weekly.ecdc.europa.eu/";
const DATE = "2026-07-22"; // "as at 22 July" — date des données du rapport ECDC
const DISEASE_FR = "Fièvre du Nil occidental";
const DISEASE_EN = "West Nile fever";
const DISEASE_AR = "حمى غرب النيل";

const COUNTRIES = [
  {
    country_en: "Italy", country_fr: "Italie", country_ar: "إيطاليا",
    lat: 41.9, lng: 12.6, cases: 46, areas: 20,
  },
  {
    country_en: "Greece", country_fr: "Grèce", country_ar: "اليونان",
    lat: 39.1, lng: 21.8, cases: 21, areas: 6,
  },
  {
    country_en: "North Macedonia", country_fr: "Macédoine du Nord", country_ar: "مقدونيا الشمالية",
    lat: 41.6, lng: 21.7, cases: 5, areas: 2,
  },
  {
    country_en: "Romania", country_fr: "Roumanie", country_ar: "رومانيا",
    lat: 45.9, lng: 24.9, cases: 5, areas: 4,
  },
  {
    country_en: "Spain", country_fr: "Espagne", country_ar: "إسبانيا",
    lat: 40.5, lng: -3.7, cases: 3, areas: 2,
  },
];

// Garde-fou : aucune ligne active ne doit déjà exister pour ces pays (éviter un doublon).
const check = await fetch(
  `${SUPABASE_URL}/rest/v1/outbreaks?disease_en=eq.${encodeURIComponent(DISEASE_EN)}&active=eq.true&select=id,country_en`,
  { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } }
);
const existingActive = await check.json();
const targetSet = new Set(COUNTRIES.map((c) => c.country_en));
const conflicts = existingActive.filter((r) => targetSet.has(r.country_en));
if (conflicts.length > 0) {
  console.error("ARRÊT : ligne(s) active(s) déjà existante(s) pour", conflicts.map((c) => c.country_en).join(", "));
  process.exit(1);
}

for (const c of COUNTRIES) {
  const description =
    `West Nile virus, 2026 European transmission season: ${c.cases} locally acquired human case` +
    `${c.cases === 1 ? "" : "s"} reported in ${c.country_en} as at 22 July 2026, across ${c.areas} affected area` +
    `${c.areas === 1 ? "" : "s"}. Season total across six European countries: 81 cases in 35 affected areas ` +
    `(Italy 46, Greece 21, North Macedonia 5, Romania 5, Spain 3, France 1). ` +
    `Source: ECDC, Surveillance of West Nile Virus infections in humans in Europe, weekly report, week 30, produced 23 July 2026.`;

  const body = {
    disease: DISEASE_FR,
    disease_en: DISEASE_EN,
    disease_ar: DISEASE_AR,
    country: c.country_fr,
    country_en: c.country_en,
    country_ar: c.country_ar,
    region: "europe",
    lat: c.lat,
    lng: c.lng,
    cases: c.cases,
    deaths: null,
    risk_level: "medium",
    date: DATE,
    source: SOURCE,
    description,
    active: true,
    is_seed: false,
    is_backfill: false,
    source_priority: 5,
    first_seen_at: DATE,
  };

  const res = await fetch(`${SUPABASE_URL}/rest/v1/outbreaks`, {
    method: "POST",
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify(body),
  });
  const out = await res.json();
  if (!res.ok) {
    console.error(`ÉCHEC ${c.country_en}`, res.status, JSON.stringify(out));
    process.exit(1);
  }
  const [row] = out;
  console.log(`OK inserted: ${row.disease_en} / ${row.country_en} — ${row.cases} cases, id=${row.id}`);
}
