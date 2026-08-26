/**
 * Vérifie que les 8 price IDs Stripe existent, sont actifs, et facturent bien
 * ce que la page tarifs affiche.
 *
 * POURQUOI. Le 26/08/2026, `diagnose-stripe-path.mjs` a signalé « Price IDs
 * configurés : 4/8 ». Un price ID manquant ne casse pas le build, ne casse pas
 * le déploiement, et ne se voit nulle part — jusqu'au moment où un acheteur
 * clique. `app/api/checkout/route.ts` fait alors l'une de deux choses, et les
 * deux sont mauvaises :
 *   1. `priceRow?.[currency] || priceRow?.["eur"]` — si le prix USD manque, il
 *      RETOMBE SUR L'EUR. L'acheteur anglophone voit « $165 » sur la page et se
 *      fait débiter 149 €. Silencieux.
 *   2. Si l'EUR manque aussi : 400 « Plan ou devise invalide ». Le bouton ne
 *      fait rien.
 *
 * Ce script simule les huit combinaisons (offre × période × devise) exactement
 * comme la route de checkout les résout, et dit lesquelles marchent.
 *
 * Lecture seule. N'affiche AUCUNE clé ni AUCUN secret — la sortie est copiable
 * telle quelle. Les price IDs eux-mêmes ne sont pas des secrets (ils circulent
 * dans le navigateur), les clés ne sont jamais lues autrement que pour l'appel.
 *
 * Usage :
 *   node scripts/check-stripe-prices.mjs                # .env.local.live
 *   node scripts/check-stripe-prices.mjs .env.local     # autre fichier
 */
import { readFileSync } from "fs";
import Stripe from "stripe";

const ENV_FILE = process.argv[2] || ".env.local.live";
const BOM = String.fromCharCode(65279);
const clean = (s) => (s || "").replace(new RegExp("^" + BOM), "").trim().replace(/^"(.*)"$/, "$1");

function parseEnv(filename) {
  const raw = readFileSync(new URL(`../${filename}`, import.meta.url), "utf8");
  const vars = {};
  raw.split("\n").forEach((line) => {
    const l = line.replace(new RegExp("^" + BOM), "");
    if (!l.trim() || l.trim().startsWith("#")) return;
    const idx = l.indexOf("=");
    if (idx < 0) return;
    vars[l.slice(0, idx).trim()] = l.slice(idx + 1).trim();
  });
  return vars;
}

let vars;
try {
  vars = parseEnv(ENV_FILE);
} catch {
  console.error(`✗ Fichier ${ENV_FILE} introuvable. Passe-le en argument.`);
  process.exit(1);
}

// La clé peut venir d'un autre fichier que les price IDs. C'est le cas normal
// après un `vercel env pull` : Vercel refuse de réexporter les variables
// marquées « Sensitive », donc le fichier téléchargé contient les price IDs
// (publics, ils transitent par le navigateur) mais pas STRIPE_SECRET_KEY.
// On va alors chercher la clé dans .env.local.live, sans jamais l'afficher.
const KEY_FILE_ARG = process.argv.find((a) => a.startsWith("--key-from="));
const KEY_FILE = KEY_FILE_ARG ? KEY_FILE_ARG.slice("--key-from=".length) : ".env.local.live";

let SECRET = clean(vars["STRIPE_SECRET_KEY"]);
let secretSource = ENV_FILE;
if (!SECRET && KEY_FILE !== ENV_FILE) {
  try {
    SECRET = clean(parseEnv(KEY_FILE)["STRIPE_SECRET_KEY"]);
    if (SECRET) secretSource = KEY_FILE;
  } catch { /* fichier absent — traité juste en dessous */ }
}
if (!SECRET) {
  console.error(`✗ STRIPE_SECRET_KEY introuvable, ni dans ${ENV_FILE} ni dans ${KEY_FILE}.`);
  console.error(`  Indique le fichier qui la contient : --key-from=<fichier>`);
  process.exit(1);
}
const MODE = /_live/.test(SECRET) ? "LIVE" : /_test/.test(SECRET) ? "TEST" : "INCONNU";
const stripe = new Stripe(SECRET, { apiVersion: "2026-04-22.dahlia" });

// ── Tarifs attendus, LUS dans lib/pricing.ts ────────────────────────────────
// Jamais recopiés à la main : lib/pricing.ts se présente comme « single source
// of truth for all pricing values », donc c'est lui qui a raison. Si ce parsing
// casse un jour, le script le dit au lieu de comparer à du vide.
function readExpectedPrices() {
  const src = readFileSync(new URL("../lib/pricing.ts", import.meta.url), "utf8");
  const out = {};
  for (const cur of ["eur", "usd"]) {
    const block = new RegExp(`${cur}:\\s*\\{([\\s\\S]*?)\\n  \\}`, "m").exec(src);
    if (!block) continue;
    for (const plan of ["pro", "team"]) {
      const row = new RegExp(`${plan}:\\s*\\{([^}]*)\\}`).exec(block[1]);
      if (!row) continue;
      const monthly = /monthly:\s*(\d+)/.exec(row[1]);
      const annual = /annual:\s*(\d+)/.exec(row[1]);
      if (monthly) out[`${plan}:monthly:${cur}`] = Number(monthly[1]);
      if (annual) out[`${plan}:annual:${cur}`] = Number(annual[1]);
    }
  }
  return out;
}

let EXPECTED = {};
try {
  EXPECTED = readExpectedPrices();
} catch (e) {
  console.log(`⚠️  lib/pricing.ts illisible (${e.message}) — les montants ne seront pas comparés.`);
}
if (Object.keys(EXPECTED).length !== 8) {
  console.log(`⚠️  ${Object.keys(EXPECTED).length}/8 tarifs lus dans lib/pricing.ts — comparaison partielle.`);
}

// ── Les 8 variables, dans l'ordre où la route de checkout les utilise ────────
const SLOTS = [
  { plan: "pro",  billing: "monthly", cur: "eur", env: "STRIPE_PRO_EUR_PRICE_ID" },
  { plan: "pro",  billing: "monthly", cur: "usd", env: "STRIPE_PRO_USD_PRICE_ID" },
  { plan: "pro",  billing: "annual",  cur: "eur", env: "STRIPE_PRO_EUR_ANNUAL_PRICE_ID" },
  { plan: "pro",  billing: "annual",  cur: "usd", env: "STRIPE_PRO_USD_ANNUAL_PRICE_ID" },
  { plan: "team", billing: "monthly", cur: "eur", env: "STRIPE_TEAM_EUR_PRICE_ID" },
  { plan: "team", billing: "monthly", cur: "usd", env: "STRIPE_TEAM_USD_PRICE_ID" },
  { plan: "team", billing: "annual",  cur: "eur", env: "STRIPE_TEAM_EUR_ANNUAL_PRICE_ID" },
  { plan: "team", billing: "annual",  cur: "usd", env: "STRIPE_TEAM_USD_ANNUAL_PRICE_ID" },
];

console.log(`\nPrice IDs lus dans : ${ENV_FILE}`);
console.log(`Clé Stripe lue dans : ${secretSource}`);
console.log(`Mode Stripe : ${MODE}`);

// ── Mode inventaire ─────────────────────────────────────────────────────────
// `vercel env pull` ne réexporte pas les variables marquées « Sensitive » : on
// peut donc se retrouver sans AUCUN price ID en main, alors que `vercel env ls`
// montre qu'ils existent bien en production. Impossible dans ce cas de vérifier
// que telle variable pointe vers tel prix — mais on peut répondre à la question
// d'à côté, qui vaut presque autant : les huit prix dont le produit a besoin
// existent-ils, actifs, au bon montant, dans ce compte Stripe ?
if (process.argv.includes("--inventory")) {
  console.log(`\n${"═".repeat(74)}\nINVENTAIRE DES PRIX RÉCURRENTS DU COMPTE\n${"═".repeat(74)}`);

  const prices = await stripe.prices.list({ limit: 100, active: true, expand: ["data.product"] });
  const recurring = prices.data.filter((p) => p.recurring);

  if (recurring.length === 0) {
    console.log("🔴 Aucun prix récurrent actif sur ce compte.");
    process.exit(1);
  }

  for (const p of recurring) {
    const amount = p.unit_amount != null ? p.unit_amount / 100 : null;
    console.log(
      `   ${String(amount ?? "?").padStart(6)} ${p.currency.toUpperCase()} / ${(p.recurring.interval + "  ").slice(0, 5)} · ${p.product?.name ?? "?"} · ${p.id}`,
    );
  }

  console.log(`\n── Ce dont le produit a besoin (d'après lib/pricing.ts) ──`);
  let missing = 0;
  for (const s of SLOTS) {
    const want = EXPECTED[`${s.plan}:${s.billing}:${s.cur}`];
    const wantInterval = s.billing === "annual" ? "year" : "month";
    const match = recurring.find(
      (p) =>
        p.currency.toLowerCase() === s.cur &&
        p.recurring.interval === wantInterval &&
        p.unit_amount === (want != null ? want * 100 : -1),
    );
    if (match) {
      console.log(`✅ ${s.plan} ${s.billing} ${s.cur.toUpperCase()} (${want}) → ${match.product?.name ?? "?"} · ${match.id}`);
    } else {
      missing++;
      console.log(`🔴 ${s.plan} ${s.billing} ${s.cur.toUpperCase()} (${want ?? "?"}) → AUCUN prix actif correspondant dans Stripe`);
    }
  }
  console.log(
    missing === 0
      ? `\n✅ Les huit prix attendus existent et sont actifs. Reste à vérifier que les variables d'environnement pointent bien dessus — ce que seul un achat réel prouvera.`
      : `\n🔴 ${missing} prix attendu(s) n'existe(nt) pas dans Stripe : ces achats ne peuvent pas aboutir, quelle que soit la configuration.`,
  );
  console.log("");
  process.exit(missing > 0 ? 1 : 0);
}

console.log(`\n${"═".repeat(74)}\n1. LES 8 VARIABLES\n${"═".repeat(74)}`);

const configured = {};
for (const s of SLOTS) {
  const id = clean(vars[s.env]);
  configured[`${s.plan}:${s.billing}:${s.cur}`] = id || null;
  if (!id) {
    console.log(`🔴 ABSENT   ${s.env}`);
    continue;
  }

  let info = null;
  try {
    info = await stripe.prices.retrieve(id, { expand: ["product"] });
  } catch (e) {
    console.log(`🔴 ERREUR   ${s.env}  (${id})`);
    console.log(`            ${e?.message ?? e}`);
    configured[`${s.plan}:${s.billing}:${s.cur}`] = null; // inutilisable
    continue;
  }

  const amount = info.unit_amount != null ? info.unit_amount / 100 : null;
  const cur = (info.currency || "").toLowerCase();
  const interval = info.recurring?.interval ?? "—";
  const expected = EXPECTED[`${s.plan}:${s.billing}:${s.cur}`];

  const problems = [];
  if (!info.active) problems.push("prix INACTIF dans Stripe");
  if (cur !== s.cur) problems.push(`devise ${cur.toUpperCase()} au lieu de ${s.cur.toUpperCase()}`);
  const wantInterval = s.billing === "annual" ? "year" : "month";
  if (interval !== wantInterval) problems.push(`période « ${interval} » au lieu de « ${wantInterval} »`);
  if (expected != null && amount != null && amount !== expected) {
    problems.push(`facture ${amount} au lieu des ${expected} affichés par lib/pricing.ts`);
  }

  console.log(
    `${problems.length ? "🔴" : "✅"} ${problems.length ? "PROBLÈME" : "OK      "} ${s.env}`,
  );
  console.log(
    `            ${amount ?? "?"} ${cur.toUpperCase()} / ${interval} · ${info.product?.name ?? "?"} · ${info.livemode ? "livemode" : "TEST mode"}`,
  );
  for (const p of problems) console.log(`            └─ ${p}`);
}

// ── 2. Les 8 achats possibles, résolus comme le fait la route ────────────────
// app/api/checkout/route.ts : getCurrency(locale) → "usd" si locale === "en",
// "eur" sinon ; puis `priceRow?.[currency] || priceRow?.["eur"]`.
console.log(`\n${"═".repeat(74)}\n2. CE QUI SE PASSE QUAND QUELQU'UN CLIQUE\n${"═".repeat(74)}`);

const LOCALES = [
  { locale: "en", cur: "usd", who: "locale EN" },
  { locale: "fr", cur: "eur", who: "locale FR/ES/AR/ID" },
];

let broken = 0;
let silentFallback = 0;

for (const l of LOCALES) {
  for (const plan of ["pro", "team"]) {
    for (const billing of ["monthly", "annual"]) {
      const wanted = configured[`${plan}:${billing}:${l.cur}`];
      const eurFallback = configured[`${plan}:${billing}:eur`];
      const label = `${l.who} · ${plan} ${billing === "annual" ? "annuel" : "mensuel"}`;

      if (wanted) {
        console.log(`✅ ${label} — facturé en ${l.cur.toUpperCase()}`);
      } else if (eurFallback) {
        silentFallback++;
        const shown = EXPECTED[`${plan}:${billing}:${l.cur}`];
        const charged = EXPECTED[`${plan}:${billing}:eur`];
        console.log(`🟠 ${label} — prix ${l.cur.toUpperCase()} absent, REPLI SILENCIEUX SUR L'EUR`);
        if (shown != null && charged != null) {
          console.log(
            shown === charged
              ? `            la page affiche ${shown} ${l.cur.toUpperCase()}, le débit sera de ${charged} EUR (même nombre, devise différente)`
              : `            🔴 la page affiche ${shown} ${l.cur.toUpperCase()}, le débit sera de ${charged} EUR`,
          );
        }
      } else {
        broken++;
        console.log(`🔴 ${label} — AUCUN prix configuré : la route répond 400, le bouton ne fait rien.`);
      }
    }
  }
}

console.log(`\n${"═".repeat(74)}\nVERDICT\n${"═".repeat(74)}`);
console.log(`Achats impossibles (400)        : ${broken}/8`);
console.log(`Achats à devise silencieusement changée : ${silentFallback}/8`);
console.log(
  broken === 0 && silentFallback === 0
    ? "\n✅ Les huit chemins d'achat sont configurés et cohérents."
    : "\n⚠️  Voir ci-dessus — chaque ligne non verte est une vente qui échoue ou qui débite autre chose que le prix affiché.",
);
console.log("");

process.exit(broken > 0 ? 1 : 0);
