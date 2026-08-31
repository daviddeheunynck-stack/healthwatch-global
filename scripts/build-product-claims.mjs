// Génère marketing/qa/product-claims.json : ce qu'un post ou un message a le
// droit d'affirmer sur HealthWatch Global lui-même.
//
// Pendant du registre de faits épidémiologiques. Même principe, autre matière :
// `claimable-facts.json` répond « ce chiffre de flambée est-il vrai ? »,
// celui-ci répond « cette affirmation sur le produit est-elle vraie ? ».
//
// Le registre n'est pas rédigé à la main : il est **extrait des sources qui font
// foi**, pour qu'il ne puisse pas dériver du produit réel.
//   - lib/pricing.ts        source unique des prix, par construction
//   - messages/*.json       la copie publique du site : ce qu'il affiche déjà
//                           est citable, mot pour mot
//   - table outbreaks       la couverture réellement en ligne
//   - product-claims.manual.json  ce qui n'est encore nulle part (fonctionnalité
//                           livrée du jour, date de sortie) — tenu par David
//
// Usage :
//   node scripts/build-product-claims.mjs                 # prod (.env.local.live)
//   node scripts/build-product-claims.mjs .env.local      # projet dev
//
// Node >= 22.18 (importe pricing.ts directement via le type stripping natif).

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { dirname } from "path";
import { PRICES, PRICE_DISPLAY } from "../lib/pricing.ts";

const OUT = "marketing/qa/product-claims.json";
const MANUAL = "marketing/qa/product-claims.manual.json";
const LOCALES = ["fr", "en", "es", "ar", "id"];

const envFile = process.argv[2] ?? ".env.local.live";

// ── 1. Prix : lib/pricing.ts est la source unique, on n'en recopie rien ──────
const priceNumbers = [];
for (const [currency, plans] of Object.entries(PRICES)) {
  for (const [plan, values] of Object.entries(plans)) {
    for (const [period, value] of Object.entries(values)) {
      priceNumbers.push({
        value,
        label: `${plan} ${period} (${currency.toUpperCase()})`,
        provenance: "lib/pricing.ts",
      });
    }
  }
}
const priceStrings = [...new Set(Object.values(PRICE_DISPLAY).flatMap((d) => Object.values(d)))];

// ── 2. Copie publique du site : ce qui est déjà affiché est citable ──────────
const flatten = (obj, prefix = "") =>
  Object.entries(obj).flatMap(([k, v]) =>
    typeof v === "object" && v !== null ? flatten(v, `${prefix}${k}.`) : [[`${prefix}${k}`, String(v)]]
  );

const siteCopy = [];
for (const locale of LOCALES) {
  const path = `messages/${locale}.json`;
  if (!existsSync(path)) continue;
  for (const [key, text] of flatten(JSON.parse(readFileSync(path, "utf-8")))) {
    siteCopy.push({ locale, key, text });
  }
}

// Tout nombre présent dans la copie publique est citable : il est déjà affiché.
const copyNumbers = [];
for (const { locale, key, text } of siteCopy) {
  for (const m of text.matchAll(/\d[\d  .,]*\d|\d+/g)) {
    const v = Number(m[0].replace(/[\s  .,]/g, ""));
    if (Number.isFinite(v)) copyNumbers.push({ value: v, label: `${key} (${locale})`, provenance: `messages/${locale}.json` });
  }
}

// ── 3. Couverture réelle, depuis la base ────────────────────────────────────
let coverage = null;
try {
  const env = readFileSync(envFile, "utf-8");
  const getEnv = (k) => {
    const m = env.match(new RegExp(`^${k}=(.*)$`, "m"));
    return m ? m[1].replace(/^﻿/, "").replace(/[\r\n]+$/, "").trim().replace(/^["']|["']$/g, "") : "";
  };
  const url = getEnv("NEXT_PUBLIC_SUPABASE_URL");
  const key = getEnv("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new Error(`${envFile} sans URL/clé Supabase`);

  const res = await fetch(
    `${url}/rest/v1/outbreaks?select=disease_en,country_en,source,active,source_priority,updated_at,source_confirmed_at,date,is_seed&limit=5000`,
    { headers: { apikey: key, Authorization: `Bearer ${key}` } }
  );
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  const rows = await res.json();

  const sixtyDaysAgo = new Date(Date.now() - 60 * 86_400_000).toISOString().split("T")[0];

  // Même filtre que build-claimable-facts.mjs, `is_seed` compris. C'est le point
  // qui manquait au premier run du 24/08 : la couverture annonçait 131 foyers
  // quand le registre de faits n'en jugeait que 105 citables, les 26 autres
  // étant de la donnée de peuplement. Un post qui aurait revendiqué 131 aurait
  // été indéfendable devant quelqu'un qui ouvre le site et vérifie.
  // Péremption du tampon depuis le 2026-08-31, même règle et même motif que
  // build-claimable-facts.mjs et lib/source-confirmed.ts : `>= date` ne
  // s'annule que si `date` avance, donc jamais quand le cron qui devait le
  // faire avancer est en panne. 60 j = CONFIRMATION_MAX_AGE_DAYS = STALE_DAYS.
  const CONFIRMATION_MAX_AGE_MS = 60 * 86_400_000;
  const isConfirmedCurrent = (o) =>
    Boolean(o.source_confirmed_at) &&
    Boolean(o.date) &&
    new Date(o.source_confirmed_at).getTime() >= new Date(o.date).getTime() &&
    Date.now() - new Date(o.source_confirmed_at).getTime() <= CONFIRMATION_MAX_AGE_MS;
  const freshness = (o) => {
    const dates = [o.updated_at];
    if (isConfirmedCurrent(o)) dates.push(o.source_confirmed_at);
    const valid = dates.filter(Boolean);
    return valid.length ? valid.sort().at(-1) : "";
  };

  const displayed = rows.filter(
    (o) =>
      o.is_seed !== true &&
      (o.active === true ||
        ((o.source_priority ?? 0) >= 3 && freshness(o) >= sixtyDaysAgo && (o.date ?? "") >= sixtyDaysAgo))
  );
  const seedsExcluded = rows.filter((o) => o.is_seed === true).length;
  const host = (s) => {
    try {
      return new URL(s).hostname.replace(/^www\./, "");
    } catch {
      return null;
    }
  };
  coverage = {
    displayedOutbreaks: displayed.length,
    activeOutbreaks: rows.filter((o) => o.active === true && o.is_seed !== true).length,
    seedsExcluded,
    countries: [...new Set(displayed.map((o) => o.country_en).filter(Boolean))].sort(),
    diseases: [...new Set(displayed.map((o) => o.disease_en).filter(Boolean))].sort(),
    sourceHosts: [...new Set(displayed.map((o) => host(o.source)).filter(Boolean))].sort(),
  };
} catch (e) {
  console.error(`Couverture non récupérée (${e.message}).`);
  console.error(`Le registre est écrit sans elle : aucun post ne pourra affirmer un chiffre de couverture.`);
}

const coverageNumbers = coverage
  ? [
      { value: coverage.displayedOutbreaks, label: "foyers affichés et vérifiés (hors seed)", provenance: "table outbreaks" },
      { value: coverage.activeOutbreaks, label: "foyers actifs vérifiés (hors seed)", provenance: "table outbreaks" },
      { value: coverage.countries.length, label: "pays couverts", provenance: "table outbreaks" },
      { value: coverage.diseases.length, label: "maladies couvertes", provenance: "table outbreaks" },
    ]
  : [];

// ── 4. Ajouts manuels : ce qui n'est encore nulle part ───────────────────────
let manual = { claims: [], numbers: [] };
if (existsSync(MANUAL)) {
  manual = JSON.parse(readFileSync(MANUAL, "utf-8"));
  // Les entrées d'exemple du fichier livré ne sont pas des faits : sans ce
  // filtre, elles deviendraient citables telles quelles.
  manual.claims = (manual.claims ?? []).filter((c) => !c._example);
  manual.numbers = (manual.numbers ?? []).filter((n) => !n._example);
  const stale = (manual.claims ?? []).filter((c) => c.expiresOn && c.expiresOn < new Date().toISOString().slice(0, 10));
  if (stale.length > 0) {
    console.error(`\n/!\\  ${stale.length} claim(s) manuelle(s) expirée(s), retirée(s) du registre :`);
    for (const c of stale) console.error(`     ${c.expiresOn}  ${c.text}`);
    console.error(`     Les prolonger dans ${MANUAL} si elles sont toujours vraies, ou les supprimer.`);
  }
  manual.claims = (manual.claims ?? []).filter((c) => !c.expiresOn || c.expiresOn >= new Date().toISOString().slice(0, 10));
}

// ── Écriture ────────────────────────────────────────────────────────────────
const numbers = [...priceNumbers, ...copyNumbers, ...coverageNumbers, ...(manual.numbers ?? [])];

const payload = {
  generatedAt: new Date().toISOString(),
  envFile,
  prices: PRICES,
  priceStrings,
  coverage,
  siteCopy,
  manualClaims: manual.claims ?? [],
  numbers,
};

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(payload, null, 2) + "\n");

console.log(`${OUT} écrit.`);
console.log(`  ${siteCopy.length} chaînes de copie publique sur ${LOCALES.length} locales`);
console.log(`  ${priceStrings.length} formats de prix, ${priceNumbers.length} valeurs tarifaires`);
console.log(`  ${(manual.claims ?? []).length} claim(s) manuelle(s) en vigueur`);
if (coverage) {
  console.log(
    `  couverture citable : ${coverage.displayedOutbreaks} foyers, ${coverage.countries.length} pays, ${coverage.diseases.length} maladies, ${coverage.sourceHosts.length} hôtes source`
  );
  if (coverage.seedsExcluded > 0) {
    console.log(
      `  ${coverage.seedsExcluded} ligne(s) is_seed exclue(s) de la couverture : non vérifiées, donc non revendicables (audit du 2026-06-15).`
    );
  }
}
console.log(`  ${numbers.length} nombres citables au total`);
