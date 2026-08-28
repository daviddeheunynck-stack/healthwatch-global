// Routine matinale HealthWatch Global — voir .claude/scheduled-tasks/morning-don-check/SKILL.md pour la procédure complète.
// Ce script couvre les étapes 1-5 (fetch DON, pull DB, scan doublons/périmé/gel/traductions,
// cadence hebdo des lignes manuelles). La vérification contre la source primaire (WebFetch/WebSearch),
// les corrections ciblées et le récap restent pilotés par l'agent.
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

const h = { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` };

// Faux positifs connus des heuristiques ci-dessous — voir SKILL.md section 4.
// Grippe aviaire US : une ligne par État (source APHIS), pas des doublons du même événement.
const DUP_SCAN_EXCLUDE = new Set(["avian influenza|united states"]);
// Seeds polio PK/AF gardés actifs à dessein (PHEIC), date 2023-01-01 structurelle — pas des résidus périmés.
const SUSPICIOUS_DATE_EXCLUDE_IDS = new Set([
  "ab4cd321-0aa6-4598-86ac-b0a04d346465", // Polio Pakistan
  "b0f473be-a367-464e-ab32-3cdc43aa7815", // Polio Afghanistan
]);
// Faux positifs connus du scan "incidents de rattrapage" (section 4g) — lignes manuelles
// fraîchement créées quelques jours après leur date "as of" source (délai normal de session,
// pas un retard de pipeline ni un flag is_seed/is_backfill oublié). Comme le décalage
// created_at↔date ne bouge jamais tant que la ligne n'est pas retouchée, ces lignes
// resignaleraient indéfiniment sans cette liste.
const CATCHUP_EXCLUDE_IDS = new Set([
  "d9d8b75c-f7ac-4fc9-af3b-d4d41582c70c", // Dengue Vanuatu — source datée 10/08, ligne créée 18/08 (session)
]);
// Table de référence des clusters de seeds légitimes (mise à jour 2026-07-20, total=25).
// Sert à diffier "le compte a-t-il changé" plutôt qu'à re-justifier ligne par ligne chaque matin.
// Comptes = seeds ACTIFS attendus par cluster. Baissés le 2026-07-17 après les
// audits source_priority=3 : les lignes retirées ont été désactivées (pas
// supprimées), elles gardent is_seed=true et ne comptent plus ici.
//   Chikungunya 21→7  : 14 pays clôturés (RRA v2 + NY State Global Health Update)
//   MERS-CoV     2→1  : France désactivée (aucun cas depuis le cluster déc. 2025)
//   Choléra      5→4  : Tchad désactivé (absent de la Table 1 de l'Epi Update #38)
//   Diphtérie   1→0  : cluster retiré le 2026-07-20. Le fix c3a1d4d (19/07) a
//     délibérément remis is_seed=FALSE sur Diphtérie/Haïti (le true était le
//     résidu de la collision GHO/PAHO, pas une protection voulue). La ligne
//     Haïti reste active, sourcée PAHO, mise à jour par sync-paho-alerts —
//     ce n'est plus un seed. Voir project_diphtheria_haiti_source_priority_collision.
const KNOWN_SEED_CLUSTERS = [
  // 2026-07-28 : Réunion désactivée (épidémie 2025 déclarée terminée le 24/06/2025, SpF ne
  // compte que 48 cas cumulés 2026) — cluster 7 -> 6. Cf. audit fraîcheur du 28/07.
  // 2026-07-29 : Singapour désactivée — 6 -> 5. Oubliée par le ménage du 17/07 ET par
  // l'audit du 28/07 : sa donnée est un compteur 2025 (33 cas au 06/12/2025) alors que
  // ses 15 pairs datés 2025 étaient déjà clôturés. La même RRA OMS ne donne que 5 cas en
  // 2026, liés au voyage, sans transmission locale soutenue. Les 5 restants (Bolivie,
  // Brésil, Cuba, Maurice, Mayotte) sont tous datés 2026. Invisible au QC quotidien car
  // le contrôle de fraîcheur saute les lignes is_seed — d'où l'intérêt de ce compte ici.
  // 2026-08-01 : cluster élargi 5 -> 8. Le refresh du 01/08 (PAHO/NY DOH 30/07) a mis à
  // jour Brésil/Bolivie/Maurice/Mayotte et découvert que l'Argentine (11 986 cas) n'avait
  // aucune ligne, tandis que Suriname (7 484) et Guyane française (1 053) existaient mais
  // inactives à cases=0 (créées depuis des pages CDC Travel Notice génériques sans
  // chiffre réel) — les trois dépassaient pourtant Cuba (1 457), suivie comme active.
  // Réactivées/insérées avec is_seed=true + source_priority=10, alignées sur le reste du
  // cluster. Cf. fix-chikungunya-argentina-suriname-frenchguiana-2026-08-01.mjs.
  { label: "Chikungunya (DON581, multi-pays)", diseaseMatch: /chikungunya/i, expectedCount: 8 },
  { label: "MERS-CoV (DON591)", diseaseMatch: /mers-cov/i, expectedCount: 1 },
  { label: "Choléra (DON579, multi-pays)", diseaseMatch: /cholera/i, expectedCount: 4 },
  { label: "Polio PHEIC (Afghanistan/Pakistan/Palestine)", diseaseMatch: /polio/i, expectedCount: 3 },
  { label: "Cereulide / lait infantile (DON596, multi-pays)", diseaseMatch: /cereulide/i, expectedCount: 10 },
];

async function fetchJson(url, opts) {
  const res = await fetch(url, opts);
  if (!res.ok) throw new Error(`${url}: ${res.status} ${await res.text()}`);
  return res.json();
}

// --- 1. DON récents (<90 jours) ---
const donRes = await fetchJson(
  "https://www.who.int/api/news/diseaseoutbreaknews?sf_culture=en&$format=json&$orderby=PublicationDateAndTime%20desc&$top=40"
);
const donItems = (donRes.value || donRes).map((d) => ({
  title: d.Title,
  date: (d.PublicationDateAndTime || "").slice(0, 10),
  url: d.ItemDefaultUrl || d.UrlName,
}));
const cutoff = new Date(Date.now() - 90 * 864e5).toISOString().slice(0, 10);
const recentDons = donItems.filter((i) => i.date >= cutoff);

console.log(`=== DON récents (<90j): ${recentDons.length} ===`);
recentDons.forEach((i) => console.log(`${i.date} | ${i.title} | ${i.url}`));

// --- 2. Foyers actifs en DB ---
const active = await fetchJson(
  // `source_confirmed_at` ajouté le 2026-08-24 : depuis cette date les crons de sync
  // l'écrivent eux-mêmes sur chaque `skip: "unchanged"` (source relue, rien de plus
  // récent que `date`) — cf. lib/source-confirmed.ts. C'est la moitié manquante du
  // calcul d'ancienneté : `updated_at` dit quand la ligne a été ÉCRITE, celle-ci dit
  // quand elle a été VÉRIFIÉE. La section 6 en bas de fichier les combine.
  `${SUPABASE_URL}/rest/v1/outbreaks?active=eq.true&select=id,disease,disease_en,country,country_en,region,cases,deaths,date,active,is_seed,source,source_priority,updated_at,source_confirmed_at&order=updated_at.asc`,
  { headers: h }
);
console.log(`\n=== Foyers actifs: ${active.length} ===`);

// --- 3. Rapprochement DON du jour <-> DB (par mot-clé maladie) ---
const donKeywords = [...new Set(recentDons.flatMap((d) => d.title.toLowerCase().match(/[a-zàâäéèêëïîôöùûüç]{4,}/g) || []))];
console.log("\n=== Lignes actives potentiellement liées aux DON récents (à vérifier contre who.int) ===");
for (const o of active) {
  const key = `${o.disease_en || o.disease || ""} ${o.disease || ""}`.toLowerCase();
  if (donKeywords.some((k) => key.includes(k) && k.length > 5)) {
    console.log(
      `[${o.id}] ${o.disease_en || o.disease} | ${o.country_en || o.country} | cases=${o.cases} deaths=${o.deaths} | date=${(o.date || "").slice(0, 10)} | seed=${o.is_seed} | src=${(o.source || "").slice(0, 60)}`
    );
  }
}

// --- 4a. is_seed=true AND active=true, comparé à la table de référence ---
const seeds = active.filter((o) => o.is_seed);
const expectedSeedTotal = KNOWN_SEED_CLUSTERS.reduce((n, c) => n + c.expectedCount, 0);
console.log(`\n=== is_seed=true AND active=true: ${seeds.length} (référence: ${expectedSeedTotal}) ===`);
const unclassified = [...seeds];
for (const cluster of KNOWN_SEED_CLUSTERS) {
  const matched = seeds.filter((o) => cluster.diseaseMatch.test(o.disease_en || o.disease || ""));
  const status = matched.length === cluster.expectedCount ? "OK" : "⚠️ ÉCART";
  console.log(`  ${status} ${cluster.label}: ${matched.length}/${cluster.expectedCount}`);
  for (const m of matched) {
    const idx = unclassified.indexOf(m);
    if (idx >= 0) unclassified.splice(idx, 1);
  }
}
if (unclassified.length) {
  console.log("  ⚠️ Seeds non classés (nouveaux ou résidus potentiels — vérifier manuellement) :");
  unclassified.forEach((o) =>
    console.log(`    [${o.id}] ${o.disease_en || o.disease} | ${o.country_en || o.country} | date=${(o.date || "").slice(0, 10)} | src=${(o.source || "").slice(0, 60)}`)
  );
} else {
  console.log("  Aucun seed hors des clusters connus.");
}

// --- 4b. Doublons (même disease_en+country_en, 2+ actifs), hors faux positifs connus ---
console.log("\n=== Doublons potentiels (même disease_en+country_en, 2+ actifs) ===");
const byKey = new Map();
for (const o of active) {
  const k = `${(o.disease_en || o.disease || "").toLowerCase()}|${(o.country_en || o.country || "").toLowerCase()}`;
  if (DUP_SCAN_EXCLUDE.has(k)) continue;
  if (!byKey.has(k)) byKey.set(k, []);
  byKey.get(k).push(o);
}
let dupFound = false;
for (const [k, rows] of byKey) {
  if (rows.length > 1) {
    dupFound = true;
    console.log(`DUP: ${k}`);
    rows.forEach((o) =>
      console.log(`   [${o.id}] date=${(o.date || "").slice(0, 10)} seed=${o.is_seed} prio=${o.source_priority} src=${(o.source || "").slice(0, 50)}`)
    );
  }
}
if (!dupFound) console.log("Aucun.");

// --- 4c. Dates suspectes (1er janvier), hors faux positifs connus ---
console.log("\n=== Dates suspectes (1er janvier) ===");
const suspicious = active.filter((o) => /-01-01$/.test((o.date || "").slice(0, 10)) && !SUSPICIOUS_DATE_EXCLUDE_IDS.has(o.id));
if (suspicious.length) {
  suspicious.forEach((o) =>
    console.log(`[${o.id}] ${o.disease_en || o.disease} | ${o.country_en || o.country} | date=${(o.date || "").slice(0, 10)} seed=${o.is_seed} | src=${(o.source || "").slice(0, 50)}`)
  );
} else {
  console.log("Aucune (hors faux positifs connus : seeds polio PK/AF).");
}

// --- 4d. Lignes gelées à source_priority=10 et non couvertes par un cluster de seeds connu ---
// prio=10 bloque toute écriture de cron (guards `.lte(source_priority, N)` partout) — légitime
// pour les seeds de clusters (déjà suivis en 4a), mais un résidu is_seed=false à prio=10 signifie
// qu'une ligne s'est figée sans que personne ne le sache (vécu : Ebola/RDC 16-17/07, Ebola/France
// et Ebola/Allemagne jusqu'au 23/07, Choléra/Tchad jusqu'au 22/07). Cadence hebdo (>7j) comme la
// section 5 : ne jamais déverrouiller sans vérifier pourquoi la ligne a été mise à ce niveau, voir
// SKILL.md section "5 bis" pour la procédure (pas de fetch pré-construit, recherche au cas par cas).
// Vérification faite, source inchangée → aucune écriture, donc `updated_at` ne bouge pas et la
// ligne se re-signale tous les matins indéfiniment. Exactement le même trou que celui déjà comblé
// pour la section 5 (MANUAL_ROW_CHECKED) et les clusters (CLUSTER_EDITION_CHECKED) — il manquait
// ici, constaté le 16/08 sur Choléra/RCA (vérifiée ce jour-là, rien de plus récent que le bilan
// du 05/08 déjà en base, donc rien à écrire, mais la ligne serait ressortie "9j — À VÉRIFIER" le
// lendemain). Même garde-fou que les deux autres maps : ne bumper une date qu'après avoir
// réellement consulté la source primaire, jamais pour faire taire une ligne.
const FROZEN_ROW_CHECKED = {
  // Diphterie/Australie : verifiee le 28/08 au Browser pane (page de listing de la collection).
  // Le premier lien reste « Epidemiological update – 10 August 2026 », soit exactement l'edition
  // deja en base : rien de nouveau, rien a ecrire. La serie est bimensuelle depuis le 31/07 (27/07
  // -> 10/08), donc l'edition attendue vers le 24/08 a 4 jours de retard — pas encore concluant,
  // mais a resurveiller. ⚠️ Ne pas sonder les URL de dates candidates en rafale : quatre HEAD
  // successifs ont declenche l'anti-bot Akamai (« Access denied »), et le 403 renvoye au passage
  // n'etait PAS le signe d'une page existante mais non publiee — les dates voisines repondaient
  // 404 dans le meme souffle. Relire la page de listing suffit.
  "e856b352-747b-4db0-b0d1-c9e55f6c53aa": "2026-08-28",
  // Cholera/Tchad : verifie le 28/08. WebSearch « Tchad cholera SITREP MSPP bilan cas deces aout
  // 2026 » : aucun SITREP n°036/2026 ni aucun national posterieur au n°035 (484/21, arrete au
  // 16/08, deja en base). Tous les resultats se referment sur des documents deja traites — le
  // n°035 relaye par tchadinfos le 19/08, les bilans anterieurs 239/13 et 75/8, et le SITREP 035
  // de 2025 (collision de millesime documentee dans source-checks.md). Rien a ecrire.
  "06541c4a-6b67-4c2c-a44e-818ba7621d76": "2026-08-28",
  // Choléra/RCA : vérifié le 16/08. Le bilan le plus récent publiable reste 720 cas / 46 décès
  // arrêté au 05/08 (Africa24, déjà cité en base). Rien de plus récent : la couverture RCA se
  // limite à la chronologie déjà connue (197 cas / 24 décès à la déclaration du 26/06, puis
  // 436/37 au 14/07, puis 720/46 au 05/08). Le communiqué UNICEF du 12/08 sur l'Afrique de
  // l'Ouest/Centre ne chiffre pas la RCA (déjà écarté le 15/08 pour la même raison). Rien à écrire.
  "d2db38cc-f638-456a-bc7b-0d48f904b408": "2026-08-16",
  // Choléra/Tanzanie : vérifié le 18/08. Rien de plus récent que le WER 101-31 déjà cité en base
  // (113 cas / 2 décès, cumul 1er janvier-28 juin 2026, aucun cas dans les 28 derniers jours).
  // L'aperçu mensuel choléra de l'ECDC (arrêté au 27/07) confirme explicitement l'absence de
  // données neuves : « Since 22 June 2026, no updates have been reported by: Congo, Ethiopia,
  // Namibia, Nigeria, Rwanda, South Sudan, United Republic of Tanzania, Zambia and Zimbabwe. »
  // Rien à écrire.
  // Revérifiée le 26/08 : toujours aucune édition plus récente de l'update choléra mensuel. Le WER
  // a publié depuis le 101-32 (« Highlighted signals and events » + note de position sur les
  // vaccins typhoïdiques) et le 101-33 (signaux + rétrospective Bundibugyo/RDC) — ni l'un ni
  // l'autre ne porte le « Multi-country outbreak of cholera ». Le 101-31 (arrêté 28/06) reste donc
  // la donnée la plus récente pour la Tanzanie. Rien à écrire.
  "5db4495e-0615-434d-b5ca-5af99de2e5e8": "2026-08-26",
  // Choléra/Somalie : vérifié le 18/08, ligne laissée inchangée (233 cas / 0 décès, WER 101-31,
  // cumul au 28/06) — mais ⚠️ ÉCART NON RÉSOLU À ARBITRER, voir le rapport du 18/08.
  // L'aperçu mensuel choléra de l'ECDC donne pour la Somalie « Since 1 January 2026 and as of
  // 12 July 2026, 2 168 cases have been reported » (dont 962 nouveaux cas entre le 14/06 et le
  // 12/07), attribués à l'Africa CDC Epidemic Intelligence Weekly Report — soit ~9x le chiffre du
  // WER, sur une fenêtre où le WER dit au contraire « aucun cas dans les 28 derniers jours ».
  // Les deux hypothèses restent ouvertes et n'ont pas pu être départagées :
  //  (a) différence de cadrage — la surveillance somalienne publie une série « AWD/cholera »
  //      combinée (cf. le titre même de la série « Weekly Cholera/AWD Situation Report - Somalia »
  //      et le Health Cluster Bulletin mars-avril 2026, qui parle systématiquement d'« AWD/cholera
  //      »), donc 2 168 = AWD+choléra et 233 = choléra seul. Écrire 2 168 par-dessus mélangerait
  //      deux cadrages : exactement le piège documenté pour Rougeole/États-Unis (CDC vs OPS) ;
  //  (b) trou de déclaration à l'OMS — le WER porte lui-même la note « Missing data in this report
  //      do not imply the absence of cholera or AWD cases or deaths in the respective country ».
  // Argument pour (a) : le tableau 1 du WER note explicitement les pays qui déclarent en AWD
  // (Afghanistan, Myanmar, Yémen, Pakistan) et la Somalie n'a PAS cette note de bas de page.
  // Argument pour (b) : « 0 cas sur 28 jours » est difficilement tenable pour la Somalie.
  // Sources primaires inaccessibles ce jour, d'où la non-résolution : emro.who.int → 502 (deux
  // URL testées), africacdc.org → certificat expiré en WebFetch, et son EIWR du 02/08 lu via le
  // Browser pane est un PDF SANS TEXTE EXTRACTIBLE (15 pages, pdf.js renvoie 0 caractère — il
  // faudrait le lire en capture d'écran page à page). La série hebdo « Cholera/AWD Situation
  // Report - Somalia » sur reliefweb s'arrête en 2024, aucune édition 2026.
  // 🔎 Au prochain passage : viser l'EIWR Africa CDC le plus récent en capture d'écran (le seul
  // moyen connu de lire ce PDF), ou une édition 2026 du sitrep somalien, pour trancher (a) vs (b).
  // Revérifiée le 26/08 : pas de nouvel update choléra du WER (101-32 = typhoïde, 101-33 =
  // Bundibugyo), donc rien de neuf côté OMS et l'écart (a)/(b) ci-dessus reste ouvert — il ne peut
  // être tranché que par une source somalienne ou Africa CDC, pas par une nouvelle édition du WER.
  // Ligne laissée à 233/0. La piste EIWR Africa CDC en capture d'écran n'a pas été tentée ce jour.
  "6296cad0-8fdb-4b26-a670-c23c541e2c43": "2026-08-26",
};
console.log("\n=== Lignes actives à source_priority=10, hors clusters de seeds connus (>7j = à vérifier) ===");
const frozenNonSeed = active.filter((o) => o.source_priority === 10 && !o.is_seed);
if (frozenNonSeed.length) {
  frozenNonSeed.forEach((o) => {
    const checked = FROZEN_ROW_CHECKED[o.id];
    const lastSeen = Math.max(
      new Date(o.updated_at).getTime(),
      checked ? new Date(checked).getTime() : 0
    );
    const ageDays = Math.round((Date.now() - lastSeen) / 864e5);
    const via = checked && new Date(checked).getTime() > new Date(o.updated_at).getTime()
      ? " (dernière vérif sans changement)"
      : "";
    const status = ageDays > 7 ? "À VÉRIFIER" : "skip (vérifiée récemment)";
    console.log(`[${o.id}] ${o.disease_en || o.disease} | ${o.country_en || o.country} | ${ageDays}j${via} — ${status} | date=${(o.date || "").slice(0, 10)} | src=${(o.source || "").slice(0, 50)}`);
  });
} else {
  console.log("Aucune.");
}

// --- 4d-bis. Lignes gelées à source_priority=10 DANS un cluster de seeds connu ---
// Contrairement à 4d, ces lignes sont suivies en 4a pour la cohérence de classification (le
// compte du cluster est-il toujours correct), mais rien ne vérifie qu'une édition plus récente
// du bulletin multi-pays cité en `source` n'est pas parue depuis. Cadence 14j (bulletins
// typiquement mensuels, pas hebdo) — voir SKILL.md section "5 bis".
// ⚠️ La cadence se calcule sur CLUSTER_EDITION_CHECKED, pas sur `updated_at` de la ligne :
// une écriture cosmétique (rattrapage des traductions du 02/08, correction d'une coquille)
// rafraîchit `updated_at` sans que personne n'ait cherché une édition plus récente, et
// masquerait alors le cluster entier pendant 14 jours. Bumper la date du cluster ci-dessous
// UNIQUEMENT après avoir réellement fait la recherche d'édition.
// Une édition plus récente TROUVÉE mais pas encore appliquée ne doit pas être masquée par la
// cadence de 14j : un rafraîchissement de cluster touche plusieurs pays d'un coup et se signale
// à David au lieu de s'appliquer en autonomie (SKILL.md section 4 bis). Tant qu'une entrée est
// listée ici, le cluster ressort à chaque run, quelle que soit CLUSTER_EDITION_CHECKED.
// Retirer l'entrée une fois la mise à jour appliquée (ou explicitement écartée par David).
const CLUSTER_EDITION_PENDING = {
  // Choléra : (vide) — WER 101-31 appliqué le 10/08 sur ordre de David, voir
  // scripts/fix-cholera-don579-cluster-wer101-31-2026-08-10.mjs.
  //
  // Chikungunya : (vide) — édition du 13/08 appliquée le 17/08 sur ordre de David, voir
  // scripts/fix-chikungunya-cluster-nydoh-0813-2026-08-17.mjs (Brésil 110569/50→116095/47,
  // Argentine 11986/2→12114/2 ; Bolivie/Cuba/Suriname inchangés, Guyane française
  // délibérément non touchée — sourcée SPF, pas PAHO, cf. le script pour le détail).
};

const CLUSTER_EDITION_CHECKED = {
  // Choléra : la série numérotée s'arrête au #38 (30/06/2026) ; la suite est bien passée dans le
  // Weekly Epidemiological Record. WER 101-31 (données au 28/06/2026) appliqué le 10/08 aux 4
  // pays du cluster (Congo 651/34→767/49, RD Congo 28567/815→32193/908, Soudan du Sud
  // 7712/84→10526/111, Soudan 527/61→847/117). Chercher désormais le WER en priorité.
  // Revérifié le 18/08 sur la page de listing du WER : l'édition courante est le WER 101-32, dont
  // le bloc « Inside this edition » ne porte que « Highlighted signals and events » et le position
  // paper sur les vaccins typhoïdiques — pas d'update choléra. Le WER 101-31 (données au 28/06,
  // déjà appliqué) reste donc la dernière édition portant le tableau multi-pays. Rien à écrire.
  Cholera: "2026-08-18",
  // MERS-CoV : DON591 toujours le dernier ; revérifié le 17/08 sur la page « MERS-CoV worldwide
  // overview » de l'ECDC, dont l'arrêté est passé au 03/08/2026 — toujours 2 cas / 1 décès en
  // Arabie saoudite depuis le 1er janvier 2026, et toujours 2 649 cas / 960 décès dans le monde
  // depuis avril 2012. Rien à écrire, ni sur le seed Arabie saoudite ni sur la ligne Global.
  // ⚠️ Faux positif à ne pas rouvrir : une WebSearch « MERS Saudi Arabia August 2026 » remonte un
  // récit de cas détaillé (homme de 50-55 ans, Région de l'Est, testé positif le 4 septembre,
  // voyage au Pakistan le 2 septembre) et un « 5 cas / 4 décès depuis le début de l'année » —
  // aucun des deux ne concerne 2026. Vérifier l'arrêté ECDC avant de conclure à une hausse.
  "MERS-CoV": "2026-08-17",
  // Cereulide / lait infantile (DON596) : entrée manquante depuis la création du
  // cluster — le bloc 4d-bis sortait donc « cluster absent de CLUSTER_EDITION_CHECKED »
  // à chaque run sans que personne n'aille chercher d'édition, et les 8 lignes actives
  // du cluster ressortaient comme figées à 42 j. Recherche faite le 24/08 : le DON596
  // (13/03/2026, 144 cas suspects et confirmés dans dix pays entre le 01/01 et le
  // 25/02) reste la dernière édition OMS de l'événement — aucun DON postérieur sur le
  // sujet. Côté UE, l'évaluation rapide ECDC/EFSA est datée du 19/02/2026 (métadonnées
  // retouchées le 17/03), donc ANTÉRIEURE au DON : ce n'est pas une édition plus
  // récente. Rien à écrire.
  // ⚠️ L'ancienneté de ce cluster est structurelle, pas un signal de péremption : le
  // rappel produit a clos l'exposition dès février, et l'ECDC écrit explicitement
  // qu'un total de cas consolidé serait trompeur (capacités de surveillance
  // hétérogènes). Ne pas chercher à « rafraîchir » les chiffres pays par pays.
  // 🔎 Au prochain passage : la seule édition à guetter est un nouveau DON OMS.
  Cereulide: "2026-08-24",
  // Chikungunya : NY State DOH Global Health Update du 13/08/2026 (données PAHO au 13/08),
  // recherché le 17/08 via la page de listing globalhealthreports.health.ny.gov, qui liste
  // l'édition la plus récente en premier. ⚠️ Le PDF n'est pas lisible par WebFetch (flux
  // compressés) : WebFetch l'enregistre malgré tout en local et le chemin est retourné dans le
  // résultat — c'est ce fichier qu'il faut passer à Read, qui gère les PDF nativement.
  // Édition plus récente que celle en base → entrée ouverte dans CLUSTER_EDITION_PENDING.
  Chikungunya: "2026-08-17",
};
// Les clés de CLUSTER_EDITION_CHECKED étaient comparées à `disease_en` en égalité
// stricte. Ça marche tant que la clé est exactement le libellé en base ("Cholera",
// "Chikungunya"), mais le cluster cereulide s'appelle en base autrement que dans la
// table de référence ci-dessus (qui, elle, matche par /cereulide/i) — une entrée
// ajoutée sous un libellé approchant serait donc restée invisible et le cluster aurait
// continué à sortir « absent de CLUSTER_EDITION_CHECKED » indéfiniment. Résolution :
// égalité stricte d'abord, puis repli sur une correspondance par sous-chaîne
// insensible à la casse. Une clé courte ("Cereulide") couvre ainsi tout libellé qui la
// contient, sans avoir à deviner la chaîne exacte.
function clusterKeyFor(disease) {
  const name = disease || "";
  if (Object.prototype.hasOwnProperty.call(CLUSTER_EDITION_CHECKED, name)) return name;
  const lower = name.toLowerCase();
  return Object.keys(CLUSTER_EDITION_CHECKED).find((k) => lower.includes(k.toLowerCase())) ?? null;
}
console.log("\n=== Lignes actives à source_priority=10, DANS un cluster de seeds (>14j depuis la dernière recherche d'édition) ===");
const frozenSeed = active.filter((o) => o.source_priority === 10 && o.is_seed);
if (frozenSeed.length) {
  const seenClusters = new Set();
  frozenSeed.forEach((o) => {
    const disease = o.disease_en || o.disease || "";
    const key = clusterKeyFor(disease);
    const checked = key ? CLUSTER_EDITION_CHECKED[key] : undefined;
    if (!checked) {
      console.log(`[${o.id}] ${disease} | ${o.country_en || o.country} | ⚠️ cluster absent de CLUSTER_EDITION_CHECKED — ajouter une entrée`);
      return;
    }
    if (seenClusters.has(disease)) return; // un seul verdict par cluster, pas une ligne par pays
    seenClusters.add(disease);
    const pending = CLUSTER_EDITION_PENDING[key];
    if (pending) {
      const countries = frozenSeed.filter((r) => (r.disease_en || r.disease) === disease).length;
      console.log(`${disease} (${countries} pays) | ⏳ ÉDITION PLUS RÉCENTE EN ATTENTE D'ARBITRAGE — ${pending}`);
      return;
    }
    const ageDays = Math.round((Date.now() - new Date(checked).getTime()) / 864e5);
    const status = ageDays > 14 ? "À VÉRIFIER (édition plus récente ?)" : "skip (édition vérifiée récemment)";
    const countries = frozenSeed.filter((r) => (r.disease_en || r.disease) === disease).length;
    console.log(`${disease} (${countries} pays) | dernière recherche d'édition ${checked} (${ageDays}j) — ${status}`);
  });
} else {
  console.log("Aucune.");
}

// --- 4e. Traductions partielles (description_fr/es/ar/id incohérents) ---
// sync-outbreaks ne backfillait que sur description_fr IS NULL — un fr écrit à la main sans les
// 3 autres langues restait invisible pour toujours à ce gate (corrigé le 2026-07-23, commit
// ca8e30c). Ce signal reste utile si un autre chemin d'écriture recrée le même trou.
const partialTranslationRows = await fetchJson(
  `${SUPABASE_URL}/rest/v1/outbreaks?active=eq.true&description=not.is.null&description=neq.&select=id,disease_en,country_en,cases,description,description_fr,description_es,description_ar,description_id`,
  { headers: h }
);
const partial = partialTranslationRows.filter((o) => {
  const flags = [o.description_fr, o.description_es, o.description_ar, o.description_id].map((v) => !!v);
  return flags.some(Boolean) && flags.some((v) => !v);
});
console.log("\n=== Traductions partielles (au moins une langue remplie, au moins une manquante) ===");
if (partial.length) {
  partial.forEach((o) =>
    console.log(`[${o.id}] ${o.disease_en} | ${o.country_en} | fr=${o.description_fr ? "OK" : "NULL"} es=${o.description_es ? "OK" : "NULL"} ar=${o.description_ar ? "OK" : "NULL"} id=${o.description_id ? "OK" : "NULL"}`)
  );
} else {
  console.log("Aucune.");
}

// --- 4e-bis. Traductions périmées : remplies mais désynchronisées de la description EN ---
// Angle mort trouvé le 2026-08-02 : les crons appellent translateDescription() à l'insertion,
// mais les scripts de correction manuelle écrivaient `description` seule — les 4 colonnes
// traduites gardaient alors le texte d'une version antérieure de la ligne, jamais NULL, donc
// invisibles au check 4e ci-dessus. 11 lignes actives étaient dans ce cas (dont Choléra/RDC,
// le plus gros foyer du produit, dont le FR affichait encore un texte générique 2025 à
// 409 222 cas). Heuristique : comparer les nombres >= 100 cités par l'EN et par le FR, en
// neutralisant les séparateurs de milliers (1,457 / 1 457 / 1.457). On ne signale que si
// chaque version cite un nombre absent de l'autre — une simple omission ne suffit pas.
function bigNumbers(t) {
  if (!t) return null;
  let norm = t;
  for (let i = 0; i < 2; i++) norm = norm.replace(/(\d)[\s  .,](\d{3})\b/g, "$1$2");
  const out = new Set();
  for (const m of norm.matchAll(/\d{3,}/g)) out.add(m[0]);
  // Faux positif connu : le dénominateur d'incidence "pour 100 000 habitants" est écrit
  // "per 100,000" en EN (normalisé en 100000) et "pour 100 000" en FR (idem), mais certaines
  // formulations n'en gardent qu'une moitié — jamais un chiffre de cas, on l'ignore des 2 côtés.
  out.delete("100");
  out.delete("100000");
  return out;
}
const desynced = partialTranslationRows
  .map((o) => {
    const en = bigNumbers(o.description);
    const fr = bigNumbers(o.description_fr);
    if (!en || !fr) return null;
    const missing = [...en].filter((n) => !fr.has(n));
    const extra = [...fr].filter((n) => !en.has(n));
    return missing.length && extra.length ? { o, missing, extra } : null;
  })
  .filter(Boolean);
console.log("\n=== Traductions périmées (chiffres FR incompatibles avec la description EN) ===");
if (desynced.length) {
  desynced.forEach(({ o, missing, extra }) =>
    console.log(`[${o.id}] ${o.disease_en} | ${o.country_en} | EN cite ${missing.join(", ")} — FR cite ${extra.join(", ")}`)
  );
} else {
  console.log("Aucune.");
}

// --- 4e-ter. Traductions périmées, second filet : le compteur `cases` cité en EN, absent ailleurs ---
// Angle mort du 4e-bis trouvé le 2026-08-05 sur Choléra/Tanzanie : les 4 traductions portaient
// encore « 54 cas » alors que l'EN et la colonne `cases` disaient 113. Le 4e-bis ne l'a pas vu
// parce qu'il ne compare que les nombres >= 3 chiffres — 54 en fait 2, donc le FR ne citait
// aucun nombre « en trop » et la condition « missing && extra » n'était pas remplie.
// Règle complémentaire, volontairement étroite pour rester sans bruit : si la description EN
// cite littéralement la valeur de `cases` (>= 2 chiffres) et qu'une traduction ne la cite pas,
// cette traduction date d'une version antérieure de la ligne. Mesuré à 0 faux positif sur les
// 115 lignes actives du 2026-08-05 (seul hit = le vrai bug Tanzanie). Contrairement au 4e-bis,
// ce filet couvre les 4 langues, pas seulement le FR.
function citesCases(text, cases) {
  if (!text) return false;
  let norm = text;
  for (let i = 0; i < 2; i++) norm = norm.replace(/(\d)[\s  .,](\d{3})\b/g, "$1$2");
  return new RegExp(`(?<!\\d)${cases}(?!\\d)`).test(norm);
}
const staleVsCases = partialTranslationRows
  .map((o) => {
    if (o.cases == null || String(o.cases).length < 2) return null;
    if (!citesCases(o.description, o.cases)) return null;
    const langs = ["fr", "es", "ar", "id"].filter((l) => {
      const t = o[`description_${l}`];
      return t && !citesCases(t, o.cases);
    });
    return langs.length ? { o, langs } : null;
  })
  .filter(Boolean);
console.log("\n=== Traductions périmées (compteur `cases` cité en EN, absent d'une traduction) ===");
if (staleVsCases.length) {
  staleVsCases.forEach(({ o, langs }) =>
    console.log(`[${o.id}] ${o.disease_en} | ${o.country_en} | cases=${o.cases} cité en EN mais absent de : ${langs.join(", ")}`)
  );
} else {
  console.log("Aucune.");
}

// --- 4f. Nulls silencieux : pays câblés dans une map de source mais absents de la base ---
// Trouvé le 2026-07-27 en creusant le trou Tchad/choléra du 21-22/07 : la République
// centrafricaine est câblée dans CHOLERA_ISO3 (app/api/cron/sync-who-regional/route.ts)
// mais n'a JAMAIS produit de ligne — indistinguable en l'état d'un simple "pas de cas
// actuel" (le cas documenté de Cameroun/Syrie/Liban/Népal, cf. commentaire du fetcher).
// Scope volontairement restreint à CHOLERA_ISO3 pour l'instant (le cas confirmé) — étendre
// à d'autres maps pays de crons (Mpox, Dengue...) seulement si ce scan s'avère utile.
//
// La liste des pays n'est plus recopiée ici (2026-08-24) : elle est LUE dans la route.
// Elle l'était, avec un commentaire demandant de la tenir synchronisée à la main — et elle
// a divergé le jour même où la vraie const a bougé. Le commit a5ac23d y a ajouté Angola,
// Yémen, Pakistan et Burundi (14 → 18 pays) ; la copie en connaissait 14, donc les deux
// pays SANS aucune ligne en base (Pakistan, Burundi) — précisément ce que cette section
// existe pour signaler — lui étaient invisibles. Même lecture que scripts/coverage-cholera.mjs.
const CHOLERA_ROUTE = "app/api/cron/sync-who-regional/route.ts";
function readCholeraWiredCountries() {
  const src = readFileSync(CHOLERA_ROUTE, "utf-8");
  const block = src.match(/const CHOLERA_ISO3: Record<string, string> = \{([\s\S]*?)\n\};/);
  if (!block) return null;
  const names = [...block[1].matchAll(/"([^"]+)"\s*:\s*"[A-Z]{3}"/g)].map((m) => m[1]);
  return names.length ? names : null;
}
// Nulls documentés comme attendus (commentaire du fetcher, sync-who-regional/route.ts) —
// pas de cas actuel dans le flux ArcGIS, pas un bug. Ne pas re-signaler ces 4.
// ⚠️ Celle-ci reste manuelle, et c'est un jugement, pas un état du code : rien ne la
// revérifie. Le cas Yémen du 24/08 montre le risque — une absence tenue pour normale
// pendant que l'OMS publiait 5 196 cas. À rouvrir si un de ces 4 pays réapparaît ailleurs.
const CHOLERA_EXPECTED_NULLS = ["Cameroon", "Syria", "Lebanon", "Nepal"];

console.log("\n=== Choléra — pays câblés dans CHOLERA_ISO3 mais aucune ligne en base (hors nulls attendus) ===");
const choleraWired = readCholeraWiredCountries();
if (!choleraWired) {
  // Échec bruyant, jamais une liste vide silencieuse : sans ça, une const renommée
  // transformerait ce contrôle en "aucun trou détecté" permanent.
  console.log(`[4f] CONTRÔLE IMPOSSIBLE — CHOLERA_ISO3 illisible dans ${CHOLERA_ROUTE} (const renommée, déplacée ou reformatée). Aucun pays vérifié : réparer la lecture avant de conclure "aucun trou".`);
} else {
  const choleraRows = await fetchJson(
    `${SUPABASE_URL}/rest/v1/outbreaks?disease_en=eq.Cholera&select=country_en`,
    { headers: h }
  );
  const choleraCountriesPresent = new Set(choleraRows.map((o) => o.country_en));
  const silentNulls = choleraWired.filter(
    (c) => !choleraCountriesPresent.has(c) && !CHOLERA_EXPECTED_NULLS.includes(c)
  );
  if (silentNulls.length) {
    silentNulls.forEach((c) => console.log(`[${c}] À VÉRIFIER — câblé dans CHOLERA_ISO3, zéro ligne Choléra en base`));
  } else {
    console.log(`Aucun sur les ${choleraWired.length} pays câblés (hors nulls attendus : Cameroun, Syrie, Liban, Népal).`);
  }
}

// --- 4g. Incidents de rattrapage : lignes ingérées très longtemps après leur date signalée ---
// Signal interne uniquement (David, 27/07 : trop rare pour justifier une surface Pro — voir
// marketing/product-ideas-log.md item 3 du 27/07). Utile pour repérer une ligne mal étiquetée
// (is_seed/is_backfill oubliés) avant que ça ne fausse un audit — c'est l'usage qui a fait
// naître ce calcul (lib/reporting-lag.ts, jamais branché côté client). Duplique volontairement
// la logique de lib/reporting-lag.ts ici (ce script est du JS brut, pas de build TS) — garder
// les deux synchronisés si l'un change.
const catchupRows = await fetchJson(
  `${SUPABASE_URL}/rest/v1/outbreaks?select=id,disease_en,country_en,date,created_at,updated_at,is_seed,is_backfill`,
  { headers: h }
);
const CATCHUP_UPDATE_TOLERANCE_MS = 60_000;
const CATCHUP_THRESHOLD_DAYS = 7;
function computeCatchupDays(o) {
  if (o.is_seed || o.is_backfill || !o.date || !o.created_at) return null;
  const createdMs = new Date(o.created_at).getTime();
  if (o.updated_at) {
    const updatedMs = new Date(o.updated_at).getTime();
    if (!Number.isNaN(createdMs) && !Number.isNaN(updatedMs) && updatedMs - createdMs > CATCHUP_UPDATE_TOLERANCE_MS) return null;
  }
  const reported = new Date(`${o.date}T00:00:00Z`).getTime();
  if (Number.isNaN(reported) || Number.isNaN(createdMs)) return null;
  const days = Math.round((createdMs - reported) / 86_400_000);
  return days >= 0 ? days : null;
}
console.log("\n=== Incidents de rattrapage (ingérées >7j après leur date signalée — signal interne, jamais client) ===");
const catchupIncidents = catchupRows
  .filter((o) => !CATCHUP_EXCLUDE_IDS.has(o.id))
  .map((o) => ({ ...o, days: computeCatchupDays(o) }))
  .filter((o) => o.days !== null && o.days > CATCHUP_THRESHOLD_DAYS);
if (catchupIncidents.length) {
  catchupIncidents.forEach((o) =>
    console.log(`[${o.id}] ${o.disease_en} | ${o.country_en} | ${o.days}j après la date signalée | is_seed=${o.is_seed} is_backfill=${o.is_backfill}`)
  );
} else {
  console.log("Aucun.");
}

// --- 5. Lignes manuelles (section 5 du SKILL.md) dues pour vérif hebdo (>7j) ---
const MANUAL_ROWS = {
  "e856b352-747b-4db0-b0d1-c9e55f6c53aa": "Diphtérie/Australie",
  "5ffa5759-37c6-438f-b7dc-ddaa1bbddd77": "Dengue/Brésil",
  "b17d4fda-c38c-41c0-9b26-e60a54c1851b": "Marburg/Ouganda",
  // Rougeole/États-Unis (7d519ce6-…) retirée le 2026-07-26 : plus orpheline, la
  // ligne est maintenue par sync-paho-alerts (SitRep OPS bimensuel, priority=5).
  // Ne pas la remettre ici, et surtout ne pas la rafraîchir avec les chiffres
  // CDC — cadrage différent, cf. section 5 du SKILL.md.
  "8a4072ab-c0be-4567-8ba4-cdcedeccced8": "Polio/Palestine",
  // Ajoutées le 2026-07-29 : contrairement à Polio/Palestine (statut PHEIC),
  // ces deux lignes portent un vrai compte de cas WPV1 hebdomadaire (GPEI) et
  // avaient dérivé silencieusement (AFG: 11 en base vs 15 chez GPEI) parce que
  // data-quality.4f les classait par erreur dans le palier annuel 730j au lieu
  // du palier hebdo 30j (corrigé le même jour, commit b995b27).
  "b0f473be-a367-464e-ab32-3cdc43aa7815": "Polio/Afghanistan",
  "ab4cd321-0aa6-4598-86ac-b0a04d346465": "Polio/Pakistan",
  // Ajoutées le 2026-08-03 en comblant le trou de couverture Océanie
  // ([[project_oceania_coverage_gap_dengue_pacific_2026_08_03]]) : source WHO WPRO
  // "Dengue Situation Update" (série biweekly numérotée, #749 du 09/07 = la plus
  // récente au 03/08). Aucun cron ne couvre cette série.
  "74561cc3-216f-4ee1-988a-ee82e362155d": "Dengue/Nouvelle-Calédonie",
  "4f95242c-e512-488e-ba52-38298a3e9ec3": "Dengue/Polynésie française",
  // Ajoutée le 2026-08-11 : deuxième volet du même trou Océanie. Épidémie déclarée par
  // l'Agence de santé de Wallis-et-Futuna à la mi-mai 2026, zéro couverture HWG jusque-là
  // parce que « Wallis and Futuna » manquait à COUNTRIES dans lib/geo-data.ts (même angle
  // mort que Samoa la veille) — findCountry() ne pouvait pas le matcher, tout scraper le
  // mentionnant l'abandonnait silencieusement. Entrée geo ajoutée le même jour.
  // Source : mesvaccins.net (point de situation Pacifique), qui cite l'Agence de santé —
  // pas de série OMS numérotée donnant un compte confirmé pour ce territoire, donc aucun
  // cron possible en l'état. Détail dans scripts/add-wallis-futuna-dengue-2026-08-11.mjs.
  "2e91ffe2-25aa-4268-b5ef-3c591f369956": "Dengue/Wallis-et-Futuna",
  // Ajoutée le 2026-08-11, même passage que Wallis-et-Futuna : audit des 14 PICT restants
  // absents de COUNTRIES a aussi trouvé American Samoa — urgence de santé publique
  // déclarée par le territoire le 08/07/2025, 782 cas confirmés au 17/02/2026 (DOH,
  // épidémiologiste Adam Konrote, via Samoa News), toujours active au 11/06/2026 selon
  // le décompte régional (1 des 6 PICT en épidémie active). N'apparaît pas dans le flux
  // PSSS du WHO Division of Pacific Technical Support (vérifié absente des Dengue
  // Situation Update #740 et #750) — remonte ses propres chiffres via son DOH/CDC, pas
  // via cette série OMS, donc pas de cron possible en l'état. Détail dans
  // scripts/add-american-samoa-dengue-2026-08-11.mjs.
  "43c4c769-17e6-45c4-9f83-5c8d30104ff1": "Dengue/American Samoa",
  // Ajoutée le 2026-08-15 : trouvée par le contrôle qualité du même jour, mono-sourcée sur un
  // hash PDF NCDC (pas de série numérotée avec URL stable) et non couverte par sync-ncdc (qui
  // ne couvre pas le NCDC nigérian malgré le nom identique — acronyme homonyme, cf. la ligne
  // Diphtérie/Nigéria ci-dessous). Aucun cron possible en l'état.
  "4dee8751-4a98-43ed-85c5-51b1c74dc5c6": "Fièvre de Lassa/Nigéria",
  // Les trois lignes suivantes ajoutées le 2026-08-15, même déclencheur : toutes les trois citent
  // EXACTEMENT la même source (PAHO Situation Report Measles Americas Region, série numérotée
  // biweekly, ~15j de cadence) — une seule vérification de la page de listing PAHO répond aux
  // trois d'un coup, pas besoin de trois recherches séparées. Non couvertes par un cron
  // (source_priority=5 mais rien n'écrit dessus en pratique).
  "632f603c-0a7f-4bd3-82a2-e63ae4114c72": "Rougeole/Canada",
  "32d62690-2c7b-4f3c-88c7-215f691fb116": "Rougeole/Pérou",
  "220e23f5-34bd-47d8-b82a-f3dacb56feb1": "Rougeole/Bolivie",
  // Ajoutée le 2026-08-15 : conséquence directe du recadrage NCDC/MSF de la veille
  // (scripts/fix-diphtheria-nigeria-ncdc-reframe-2026-08-15.mjs) — la source est passée d'un PDF
  // WHO SAGE (palier "dashboard" 180j dans data-quality) à un article de presse (leadership.ng),
  // qui ne matche aucun motif de DASHBOARD_SOURCES et retombe donc sur le palier standard 21j.
  // La ligne va se re-signaler tous les jours indéfiniment sans ce suivi hebdo — même trou que
  // Wallis-et-Futuna/American Samoa, pas anticipé au moment du recadrage.
  "1ca31b07-6f83-4967-9f59-b599f7574642": "Diphtérie/Nigéria",
  // Ajoutée le 2026-08-16 : trouvée par le contrôle qualité du même jour (35j de péremption),
  // trou pas anticipé jusqu'ici. Source = WHO Kenya "Emergency Preparedness and Response Weekly
  // Situation Report" (série pays, hébergée sur afro.who.int, distincte du bulletin régional
  // AFRO générique) — mono-sourcée, aucun cron ne la couvre. La page-index de la série
  // (afro.who.int/countries/kenya/publication/kenya-weekly-situation-report-2026) liste les
  // éditions disponibles ; vérifié le 16/08 qu'elle s'arrête à "Week 28" (semaine du 05-12/07),
  // déjà la source citée en base — aucune Week 29-33 publiée, la cadence hebdo de cette série
  // semble interrompue depuis mi-juillet (à surveiller, pas creusé plus loin). Mêmes 40 cas/1
  // décès (Garissa+Nairobi) qu'au 12/07, rien à écrire.
  "07b42f30-5446-4931-871e-a1b079b04da2": "Choléra/Kenya",
  // Ajoutées le 2026-08-17 : les deux premières trouvées par le contrôle qualité du même jour
  // (péremption 21j, source = bulletin national SPF arboviroses), la troisième (West Nile) pas
  // flaguée par data-quality (updated_at encore sous le seuil) mais trouvée en cours de route sur
  // la même source — même série, même trou. Toutes les trois citaient une édition en retard de 2
  // crans (bulletin #18 ou #19, alors que le #20 du 12/08 était déjà publié) : aucun cron ne couvre
  // cette série SPF malgré un source_priority=5 hérité (corrigé à 10 dans le même correctif, voir
  // scripts/fix-france-arbovirus-bulletin20-2026-08-17.mjs). Vérifier désormais contre
  // santepubliquefrance.fr/.../chikungunya-dengue-zika-et-<N> (numéro à incrémenter, cadence hebdo).
  "99f356e8-7fc3-4f43-947e-45c9d6a34757": "Chikungunya/France",
  "5ccc53c2-b17b-493b-aadf-233acb4b2cdf": "Dengue/France",
  "906bf26a-8867-4a9c-ad7c-976e4e2c5bab": "West Nile/France",
  // Ajoutées le 2026-08-18, en reprenant le 2026-08-05 : ces deux lignes citent leur source
  // nationale (NDCU pour le Sri Lanka, CDC Perú pour le Pérou) depuis cette date, en
  // source_priority=6 — décision prise pour empêcher sync-who-regional (priority=5) de les
  // réécrire avec un chiffre OMS plus laggard. Contrepartie : AUCUN cron n'écrit au-dessus de 5
  // sur ces deux pays, elles ne se rafraîchissent donc plus toutes seules. Ce garde-fou hebdo
  // devait être ajouté le même jour mais n'a jamais atteint `master` (resté isolé dans une
  // branche jamais fusionnée — commit e3ad088). Trouvé le 17/08 en fusionnant une autre branche
  // stale : Sri Lanka et Pérou étaient tous deux figés depuis le 05/08 (12 jours), le Sri Lanka
  // ayant pourtant un PDF quotidien qui aurait dû être suivi. Corrigés le 18/08
  // (scripts/fix-dengue-srilanka-peru-freshen-2026-08-17.mjs, supprimé après application) :
  // 87 536->92 595 cas / 63->68 morts (Sri Lanka), 34 820->42 440 cas (Pérou, décès inchangés à
  // 36 — le tableau officiel du dashboard national ne publie pas de compte 2026, case vide dans
  // "Defunciones acumuladas hasta la SE 31" contrairement à 2023/2024 ; ne pas deviner ce
  // chiffre, le laisser tel quel jusqu'à ce qu'il soit officiellement publié).
  // ⚠️ Malaisie (même lot du 05/08) N'EST PAS ici : elle a depuis reçu son propre cron dédié
  // (sync-malaysia-dengue, ajouté après cette date, SOURCE_PRIORITY=6, `.lte(6)` — se
  // rafraîchit donc lui-même). Vérifié le 17/08 : `updated_at` du 16/08, fraîche. Ne pas la
  // rajouter ici sans revérifier d'abord si ce cron existe encore et tourne.
  "2c0f291c-e09b-4b96-afaf-7d7cb3e5251c": "Dengue/Sri Lanka",
  "b7813f6c-d98f-43d1-aff9-7b385ee44384": "Dengue/Pérou",
  // Ajoutée le 2026-08-18 : même trou, même cause, troisième occurrence du même correctif
  // (commit 77bab1b, 2026-08-05) jamais fusionné dans `master`. Cette ligne était le morceau
  // "extracteur Viêt Nam pour sync-wpro-dengue-update" du commit — vérifié : ce cron ne cible
  // que Nouvelle-Calédonie/Polynésie française/Cambodge, jamais le Viêt Nam. En
  // source_priority=6 sans aucun cron pour la rafraîchir, figée depuis le 05/08 (12 jours).
  // Trouvée en élargissant la vérification Sri Lanka/Pérou à l'ensemble des lignes actives à
  // source_priority=6 (10 au total ce jour-là) — les 3 lignes grippe aviaire USDA APHIS du même
  // palier ne sont PAS un trou similaire : couvertes par un cron quotidien (sync-usda-aphis) dont
  // la logique anticipe explicitement de longs silences entre détections (574j déjà vu pour
  // l'Utah), donc leur âge élevé est normal, pas un abandon.
  // Corrigée le 18/08 (script jetable, supprimé après application) : 41 684->73 828 cas,
  // 8->9 morts, WHO WPRO Dengue Situation Update #751 (06/08, lu directement dans le PDF page 4).
  // Corrigé au passage : la ligne portait un encodage UTF-8 corrompu (mojibake) dans `country` et
  // les 4 traductions depuis sa création — pas de rapport avec la péremption, mais découvert en
  // relisant la ligne pour appliquer ce correctif. Écrites proprement cette fois.
  "d5aa229f-0568-45db-b223-747d25014718": "Dengue/Viêt Nam",
  // Ajoutée le 2026-08-18, sur ordre explicite de David : seule épidémie de dengue 2026 du
  // Pacifique encore officiellement déclarée ET en cours (Nouvelle-Calédonie, Tonga et Îles
  // Cook sont soit closes soit déjà couvertes). Épidémie déclarée en juin 2026 par le
  // ministère de la Santé du Vanuatu, South Efate/province de Shefa. Source : "Dengue in the
  // Pacific: Multicountry Situation" (OMS WPRO South Pacific + Secretariat of the Pacific
  // Community, hebdomadaire/quasi-hebdomadaire sur reliefweb) — même famille de source que le
  // trou Fidji/Samoa/Tonga du 03/08, mais cette série-ci donne un TABLEAU par pays (cas
  // confirmés) en plus des highlights, contrairement au DSU WPRO qui mélange comptes
  // confirmés (Asie) et courbes DLI syndromiques (PICT) — préférer cette source pour toute
  // future vérification de couverture Pacifique. 76 cas confirmés / 0 décès au 10/08/2026
  // (Epi Week 32), DENV-1, 12 hospitalisations toutes guéries. Aucun cron ne couvre cette
  // série — vérification manuelle hebdo comme les autres lignes Pacifique de cette liste.
  "d9d8b75c-f7ac-4fc9-af3b-d4d41582c70c": "Dengue/Vanuatu",
  // Ajoutée le 2026-08-19 : le plus gros foyer actif du produit (PHEIC, source_priority=10,
  // "la plus grande épidémie d'Ebola jamais enregistrée dans le pays") n'a plus AUCUN rédacteur
  // automatisé depuis le 17/08. sync-drc-sitrep (route.ts) a sa détection de sitrep désactivée
  // en permanence (ToS ReliefWeb) et son en-tête renvoie explicitement vers sync-who-afro à la
  // place — mais sync-who-afro plafonne son écriture à `source_priority <= 5` (jamais 10, "never
  // overwrite sitrep"). Le seul autre rédacteur, scripts/update-drc-sitrep-social.mjs, est
  // orphelin depuis le 17/08 (ses deux seuls appelants, x-hwg-monitoring et
  // x-hwg-followup-check, ont été éliminés ce jour-là) et son garde-fou de source n'accepte que
  // les hôtes X/Twitter, donc aucune routine LinkedIn ne peut l'utiliser. Trouvé le 18/08 en
  // curl-ant la fiche publique : bulletin WHO DON615 du 12/08, déjà 7j de péremption au moment
  // du constat (seuil PHEIC data-quality = 7j) — la ligne n'a donc plus aucun filet, ni cron ni
  // vérification hebdo, jusqu'à cette entrée. Voir marketing/product-ideas-log.md, 2026-08-18
  // idée 1, pour le détail complet et la correction du badge "Vérifié par HealthWatch" livrée le
  // 19/08 (il affichait le dernier écriture DB, pas la date du bulletin).
  "bd1c3a46-a921-49b7-b79e-10ad715c4c38": "Ebola/RD Congo",
  // Ajoutée le 2026-08-19 : trouvée par le contrôle qualité du même jour (22j de péremption,
  // source = Bollettino_WND_2026_1, 28/07). L'ISS publie chaque semaine ; deux éditions manquées
  // (_2 ~06/08, _3 13/08 — confirmé le _4 pas encore paru, 404 sur l'URL). Aucun cron ne couvre
  // cette série. Corrigée le même jour : 84->226 cas, 2->7 décès. Voir
  // scripts/fix-west-nile-italy-report3-2026-08-19.mjs.
  "d0dcfdbd-b656-4d4f-91a9-ddd271025af8": "West Nile/Italie",
};
// Ebola/RD Congo (bd1c3a46) : chiffre débloqué le 19/08 — David a ouvert le PDF IRIS lui-même
// (même blocage JS que le PDF diphtérie australienne), lu directement depuis ses Téléchargements.
// WHO AFRO External Situation Report 14 (16/08) : 4 665->5 021 cas, 2 184->2 378 décès. Voir
// scripts/fix-ebola-drc-sitrep14-2026-08-19.mjs. Le problème de fond (aucun rédacteur automatisé,
// cf. l'entrée MANUAL_ROWS ci-dessus et product-ideas-log.md 2026-08-18 idée 2) reste entier —
// cette ligne redeviendra périmée dans ~7j sans un nouveau geste manuel ou une vraie correction
// de mécanisme. Ne pas la retirer du suivi hebdo pour cette raison précise.
// Vérification faite, source inchangée → aucune écriture, donc `updated_at` ne bouge pas et la
// ligne se re-signale tous les matins indéfiniment (vécu le 06/08 avec les deux lignes polio :
// GPEI confirmait les mêmes totaux qu'au 22/07, rien à écrire, mais la ligne restait "8j — À
// VÉRIFIER"). Même problème et même remède que CLUSTER_EDITION_CHECKED plus haut : on note ici la
// date de la dernière vérification RÉELLE, et la cadence part du plus récent des deux signaux.
// ⚠️ Ne bumper une date ci-dessous qu'après avoir effectivement consulté la source primaire —
// jamais pour faire taire une ligne.
const MANUAL_ROW_CHECKED = {
  // Dengue/Polynésie française : vérifié le 19/08 contre la source primaire. Le dernier Bulletin de
  // Surveillance Sanitaire publié par l'ARASS reste le n°25/2026, « données consolidées jusqu'à la
  // semaine 29 (13/07/2026 au 19/07/2026) », publié le 27/07 — soit exactement l'arrêté déjà cité en
  // base (34 cas confirmés au 19/07, via WPRO Dengue Situation Update 751). Le listing
  // `service-public.pf/dsp/bulletin-de-surveillance-sanitaire/` ne contient aucun bulletin d'août
  // 2026. Rien à écrire.
  // ⚠️ Divergence relevée et volontairement NON appliquée : le Tableau 1 du rapport WHO/SPC
  // « Dengue in the Pacific » du 14/08 donne 32 cas confirmés cumulés 2026 pour la Polynésie
  // française (contre 34 en base) en citant un « dernier rapport national » du 11/08 qui n'existe pas
  // publiquement. Ce 32 est en outre incohérent avec la propre colonne EW 29-32 du même tableau, qui
  // compte 2 cas sur ces quatre semaines : 34 au 19/07 + 2 donnerait 36, pas 32. Ne pas régresser la
  // ligne de 34 à 32 sur cette seule lecture de tableau — attendre un BSS de l'ARASS postérieur à la
  // semaine 29, qui est la source primaire de ce territoire.
  "4f95242c-e512-488e-ba52-38298a3e9ec3": "2026-08-19",
  // Polio/Afghanistan : « Polio This Week » du 19/08/2026 — « Four WPV1 cases were reported this
  // week from Hirat, Kandahar and Paktika, with onset of paralysis in June and July (most recent
  // case: 17 July 2026). The total number of cases in 2026 is 19. » Ligne corrigée le 21/08 de 15
  // à 19 cas (scripts/fix-polio-afg-samoa-dengue-2026-08-21.mjs) ; aucun échantillon environnemental
  // positif cette semaine, dernier positif 24/06/2026.
  "b0f473be-a367-464e-ab32-3cdc43aa7815": "2026-08-21",
  // Polio/Pakistan : vérifié le 21/08 sur endpolio.com.pk (source primaire de la ligne) — toujours
  // 3 cas WPV1 en 2026, à Sujawal (Sindh), Bannu et Waziristan du Nord (Khyber Pakhtunkhwa).
  // Corroboré par WebSearch. ⚠️ La section pays Pakistan n'apparaissait pas dans le rendu WebFetch
  // de « Polio This Week » ce jour-là (seule l'Afghanistan en sortait) : passer par endpolio.com.pk
  // plutôt que d'insister sur le GPEI si le cas se reproduit. Rien à écrire.
  "ab4cd321-0aa6-4598-86ac-b0a04d346465": "2026-08-21",
  // Marburg/Ouganda : vérifié le 08/08 — WebSearch « Marburg Uganda cases August 2026 » et page
  // pays WHO AFRO (afro.who.int/countries/uganda, aucune mention Marburg, uniquement Ebola
  // Bundibugyo). Toujours 1 cas / 1 décès (enfant de 18 mois, Kyegegwa, notifié à l'OMS le
  // 30/06/2026), aucun contact devenu symptomatique, aucun cas supplémentaire depuis. Aucune
  // source plus autoritaire que CIDRAP n'existe à ce jour (ni DON, ni item AFRO). Rien à écrire.
  // ⚠️ Fin de la fenêtre de 42 j vers le 11-12/08/2026 : rechercher à ce moment-là une
  // déclaration de fin d'épidémie ougandaise, qui justifierait de passer la ligne à active=false.
  // Revérifié le 11/08 (jour d'ouverture de la fenêtre) : la page de référence gov.uk « Ebola and
  // Marburg haemorrhagic fevers: outbreaks and case locations », mise à jour la veille (10/08/2026),
  // décrit toujours la notification du 30/06 sans aucune mention de clôture ; WebSearch d'une
  // déclaration ougandaise ne remonte que la clôture Ebola du 28/07 (événement distinct). Toujours
  // 1 cas / 1 décès, rien à écrire, ligne laissée active.
  // Revérifié le 16/08 (même passage que le watch de clôture ci-dessous) : la page gov.uk, toujours
  // datée du 13/08, décrit encore la seule notification du 30/06 à Kyegegwa et la classe en incident
  // en cours, sans aucun cas supplémentaire ni déclaration de fin. Toujours 1 cas / 1 décès.
  // Revérifié le 19/08 : la page gov.uk décrit toujours la seule notification du 30/06 à Kyegegwa
  // (1 cas confirmé), la classe en incident en cours et n'annonce aucune clôture. ⚠️ Piège écarté ce
  // jour-là : une WebSearch « Uganda Marburg declared over » renvoie un résumé qui attribue à Marburg
  // un décompte de 20 cas / 2 décès et un compte à rebours de 42 j démarré le 16/07 — ce sont les
  // chiffres ougandais de l'épidémie EBOLA Bundibugyo (cf. DON615), pas Marburg. Toujours 1 cas /
  // 1 décès, rien à écrire, ligne laissée active.
  "b17d4fda-c38c-41c0-9b26-e60a54c1851b": "2026-08-19",
  // Diphtérie/Australie : vérifié le 13/08 via le Browser pane. Le rapport le plus récent de la
  // collection reste celui du 27/07/2026 (déjà en base : 475 cas confirmés / 1 décès), donc rien
  // à écrire. ⚠️ CHANGEMENT DE CADENCE annoncé dans la « Collection description » de la page de
  // listing : « The final weekly Diphtheria in Australia: Epidemiological Update was published on
  // 31 July 2026. The report is now published fortnightly. » La série est donc bimensuelle depuis
  // le 31/07 — un `updated_at` > 7j est désormais NORMAL pour cette ligne et n'est pas un signal
  // d'alerte (même logique que les sitreps OPS pour Rougeole/États-Unis). Prochaine édition
  // attendue à partir de la mi-août. La page de listing cite aussi désormais des tableaux de bord
  // d'appoint (NNDSS, NT, WA, SA) si un chiffre intermédiaire devient nécessaire.
  // Revérifié le 17/08 : la prédiction s'est confirmée — la page de listing
  // (cdc.gov.au/resources/collections/diphtheria-australia-epidemiological-updates) montre
  // désormais une édition « 10 August 2026 » (publiée le 14/08), la première depuis le passage au
  // bimensuel. ⚠️ Chiffres NON obtenus malgré 4 tentatives : WebFetch time-out sur la page HTML et
  // sur le PDF direct, et le Browser pane déclenche un téléchargement de fichier plutôt qu'un rendu
  // (bloqué, pas de lecture possible côté agent). Le domaine cdc.gov.au semble structurellement
  // difficile à atteindre pour ces outils — à retenter avec une autre méthode (ex. demander à David
  // d'ouvrir le PDF lui-même) plutôt que de répéter la même approche. Ligne laissée à 475 cas/1
  // décès (valeur du 27/07), donc potentiellement périmée d'une édition — ne pas la présenter comme
  // confirmée à jour tant que ce chiffre n'est pas obtenu.
  // Débloqué le 17/08 (même jour) : David a ouvert le PDF dans le Browser pane et enregistré le
  // fichier lui-même ; lu directement depuis ses Téléchargements. 475 -> 513 cas, décès inchangé (1).
  // Voir scripts/fix-diphtheria-australia-20260810-2026-08-17.mjs. Le blocage réseau cdc.gov.au
  // reste entier pour un futur run automatique — prévoir de redemander à David si la ligne revient
  // périmée avant que quelqu'un ne teste une 6e méthode d'accès direct.
  // Revérifié le 25/08 : la page de listing s'ouvre normalement au Browser pane (le blocage du 17/08
  // portait sur le téléchargement du PDF, pas sur le HTML de la collection — nuance utile pour les
  // prochains runs). Le premier lien reste « Epidemiological update – 10 August 2026 », soit
  // exactement l'édition déjà en base : aucune parution nouvelle, rien à écrire. La série étant
  // bimensuelle depuis le 31/07, la prochaine édition est attendue vers le 24/08 — elle n'était pas
  // encore en ligne ce matin, un jour de retard n'est pas un signal de source cassée.
  // Revérifié le 28/08 au Browser pane : toujours « 10 August 2026 » en tête de listing, aucune
  // parution depuis. Voir la note jumelle dans FROZEN_ROW_CHECKED (cette ligne est suivie par les
  // deux maps — 4d parce qu'elle est à sp=10, section 5 parce qu'aucun cron ne la couvre).
  "e856b352-747b-4db0-b0d1-c9e55f6c53aa": "2026-08-28",
  // Polio/Palestine : vérifié le 13/08. La page du comité (who.int/groups/poliovirus-ihr-emergency-
  // committee) liste 44 réunions, la plus récente étant toujours la 44e du 04/03/2026 — déjà la
  // source de la ligne. Aucune 45e déclaration publiée à ce jour (cadence ~trimestrielle, donc une
  // 45e est attendue). La désignation PHEIC et les recommandations temporaires restent en vigueur,
  // la Palestine n'en est pas sortie. Rien à écrire, `active`/`is_seed` inchangés.
  // Revérifié le 21/08 sur la même page : toujours 44 réunions listées, la 44e du 04/03/2026 reste
  // la plus récente (cadence observée : 40e 03/12/2024, 41e 10/04/2025, 42e 28/07/2025, 43e
  // 11/11/2025, 44e 04/03/2026 — la 45e est donc en retard sur un rythme trimestriel, ce qui ne
  // change rien au statut : les recommandations temporaires courent jusqu'à révision). Rien à écrire.
  "8a4072ab-c0be-4567-8ba4-cdcedeccced8": "2026-08-21",
  // Dengue/Wallis-et-Futuna : vérifié le 14/08, déclenché par le contrôle qualité quotidien
  // (28j de péremption). WHO WPRO Dengue Situation Update #751 (06/08/2026, dernière édition —
  // #752 pas attendue avant ~20/08) ne mentionne le territoire que dans sa section syndromique
  // « DLI Surveillance », pas de compte confirmé/probable chiffré. La 1ère (fil dengue
  // Wallis-et-Futuna) n'a rien de plus récent que le 18/06. mesvaccins.net, l'Agence de santé et
  // Outremers360 n'ont rien de nouveau. Toujours 47 cas / 0 décès au 17/07, rien à écrire.
  "2e91ffe2-25aa-4268-b5ef-3c591f369956": "2026-08-14",
  // Dengue/American Samoa : vérifié le 14/08, même déclencheur (178j de péremption — normal,
  // la donnée source datait déjà de ~6 mois à la création de la ligne le 11/08). Archive complète
  // du tag dengue-fever de Samoa News passée en revue : rien de plus récent que l'article du
  // 17/02 déjà en base. CDC (403 sur chaque tentative) et PIHOA (page statique depuis 07/2025)
  // inexploitables. Confirmation utile trouvée : l'avis SafeTravel NZ (maj 17/06) liste toujours
  // American Samoa parmi les 6 PICT en épidémie active de dengue au 11/06 — le statut `active`
  // reste justifié même si le chiffre de cas ne peut pas être rafraîchi. ⚠️ Piège écarté : ne pas
  // confondre avec Samoa (pays indépendant voisin), qui a sa propre épidémie bien plus importante
  // et des sitreps MOH distincts. Toujours 782 cas / 0 décès au 17/02, rien à écrire.
  // Mise à jour le 19/08 (session distincte, hors de cette trace) : source basculée sur WHO/SPC
  // « Dengue in the Pacific Multicountry Situation », 14/08/2026 (via reliefweb.int) — la même
  // source précédemment bloquée en 403 pour une autre session le 17/08 (voir la ligne
  // Fidji/DLI ce jour-là). 782 -> 1 036 cas au 21/07/2026 (486 en 2026 + 550 en 2025, DENV-1/
  // DENV-2), toujours 0 décès. Constaté ici après coup, en synchronisant cette trace sur l'état
  // réel de la ligne plutôt qu'en la revérifiant une 2e fois inutilement.
  "43c4c769-17e6-45c4-9f83-5c8d30104ff1": "2026-08-19",
  // Fièvre de Lassa/Nigéria : vérifié le 15/08. Le listing NCDC filtré sur ce type de sitrep
  // (ncdc.gov.ng/diseases/sitreps/?cat=5&name=...) confirme que "Week 30" est bien la plus
  // récente entrée, ET que son PDF est EXACTEMENT celui déjà cité en base (même hash de fichier)
  // — donc pas une édition manquée, la ligne cite déjà la dernière disponible. ⚠️ Piège écarté :
  // le listing générique non filtré (ncdc.gov.ng/diseases/sitreps) affichait "Week 29" comme plus
  // récente — page moins fiable/à jour que la version filtrée par catégorie, ne pas s'y fier pour
  // ce type de vérification. Un article de presse (Tribune Online) citant "Week 30" avec le même
  // cumul 1000/237 semblait d'abord contradictoire avec ses propres chiffres "227 suspects/17
  // confirmés/6 décès" de la semaine — en réalité ces 17/6 sont déjà inclus dans le cumul 1000/237,
  // pas un delta à ajouter par-dessus. Toujours 1 000 cas / 237 décès au 25/07, rien à écrire.
  "4dee8751-4a98-43ed-85c5-51b1c74dc5c6": "2026-08-15",
  // Rougeole Canada/Pérou/Bolivie : vérifié le 15/08 puis rerevérifié le 16/08 (fenêtre "#9
  // attendu incessamment" du 15/08 passée sans nouvelle édition). La page de listing PAHO
  // (paho.org/en/measles-multi-country-outbreak-2026) confirme que le Situation Report #8
  // (31/07/2026) reste le plus récent — pas de #9 publié à ce jour, cadence ~15j (#6 02/07,
  // #7 17/07, #8 31/07). Toujours les chiffres du #8 pour les trois pays (Canada 1 107/0,
  // Pérou 1 139/0, Bolivie 85/1), rien à écrire pour aucun des trois.
  "632f603c-0a7f-4bd3-82a2-e63ae4114c72": "2026-08-16",
  "32d62690-2c7b-4f3c-88c7-215f691fb116": "2026-08-16",
  "220e23f5-34bd-47d8-b82a-f3dacb56feb1": "2026-08-16",
  // Choléra/Kenya : voir MANUAL_ROWS ci-dessus pour le contexte complet. Vérifié le 16/08 —
  // page-index de la série WHO Kenya Weekly Situation Report, s'arrête à Week 28 (05-12/07),
  // aucune édition plus récente publiée. Toujours 40 cas / 1 décès au 12/07, rien à écrire.
  "07b42f30-5446-4931-871e-a1b079b04da2": "2026-08-16",
  // Diphtérie/Nigéria : ligne créée/recadrée le 14-15/08 (voir MANUAL_ROWS ci-dessus), donc
  // rien à "vérifier" pour l'instant au sens de rechercher une édition plus récente — cette entrée
  // existe uniquement pour que la cadence hebdo démarre à la date du recadrage plutôt qu'à zéro.
  "1ca31b07-6f83-4967-9f59-b599f7574642": "2026-08-15",
  // Chikungunya/France, Dengue/France, West Nile/France : vérifiées une 2e fois le 22/08, cette
  // fois sur signalement d'un contact LinkedIn (Pierre PARNEIX, 21/08) plutôt que par le contrôle
  // qualité — même défaut structurel que le 17/08 (aucun cron ne visite les pages de bulletin
  // SPF, voir product-ideas-log.md du 21/08, idée 1). Bulletin #20 (12/08, données au 10/08)
  // toujours en base, bulletin national #21 (19/08, données au 17/08) déjà publié depuis 3 jours
  // au moment de la détection. Vérifié moi-même par WebFetch direct sur le national #21 ET sur le
  // régional Nouvelle-Aquitaine du 19/08 (données au 18/08, détail communal Gironde/Dordogne),
  // pas seulement sur la citation de session. Corrections réelles : Chikungunya 15→25 cas, Dengue
  // 2→4 cas, West Nile 6→18 cas (nouvelle région Île-de-France). Détail dans
  // scripts/fix-france-arbovirus-bulletin21-2026-08-22.mjs. source_priority déjà à 10 depuis le
  // 17/08, inchangé — ce n'est pas ce qui bloquait le rafraîchissement.
  "99f356e8-7fc3-4f43-947e-45c9d6a34757": "2026-08-22",
  "5ccc53c2-b17b-493b-aadf-233acb4b2cdf": "2026-08-22",
  "906bf26a-8867-4a9c-ad7c-976e4e2c5bab": "2026-08-22",
  // Dengue/Sri Lanka, Dengue/Pérou : voir MANUAL_ROWS ci-dessus pour le contexte complet.
  // Vérifiées le 18/08 (garde-fou recréé le jour même) — Sri Lanka : PDF quotidien NDCU
  // (dengue.health.gov.lk) lu directement, 92 595 cas / 68 morts au 17/08 (CFR 0,07 %).
  // Pérou : tableau de bord national CDC Perú (app7.dge.gob.pe), 42 440 cas cumulés, coupure
  // semaine épidémiologique 31 (08/08). Décès 2026 non publiés à ce niveau de détail (case vide
  // dans le tableau officiel, contrairement à 2023/2024) — dernier chiffre confirmé conservé
  // (36, daté du 28/06), ne pas le deviner. Les deux corrigées le même jour.
  "2c0f291c-e09b-4b96-afaf-7d7cb3e5251c": "2026-08-18",
  "b7813f6c-d98f-43d1-aff9-7b385ee44384": "2026-08-18",
  // Dengue/Viêt Nam : voir MANUAL_ROWS ci-dessus pour le contexte complet. Vérifiée le 18/08,
  // même passage que Sri Lanka/Pérou — WHO WPRO Dengue Situation Update #751 (06/08) lu
  // directement dans le PDF, page 4 : « In July 2026, Viet Nam recorded 15,940 cases, including
  // one death... From January to July 2026, a total of 73,828 cases, including nine deaths ».
  // Encodage corrompu (mojibake) trouvé et corrigé au passage sur `country` et les 4 traductions.
  // Revérifiée le 26/08 sur le WHO WPRO Dengue Situation Update #752 (20/08), page 4, qui écrit
  // explicitement « There was no update in this reporting period » pour le Viet Nam et reconduit
  // mot pour mot les chiffres de #751 (73 828 cas et neuf décès de janvier à juillet 2026). La
  // date d'arrêté de la ligne (31/07) est donc toujours la bonne — ce n'est pas un cas de
  // section 4 sexies, la source n'a pas avancé son propre arrêté. Rien à écrire.
  "d5aa229f-0568-45db-b223-747d25014718": "2026-08-26",
  // Dengue/Vanuatu : vérifiée le 26/08 sur le Tableau 1 (« Confirmed Cases and Deaths as Reported
  // in National Situation Report, EW 1-32 2026 ») du rapport WHO/SPC « Dengue in the Pacific »
  // du 14/08 — déjà l'édition citée en base, et toujours la plus récente de la série (recherche
  // du listing reliefweb triée par date : rien après le 14/08). Vanuatu y figure à 76 cas
  // confirmés cumulés 2026, 0 décès, dernier rapport national du 10/08, DENV-1, avec 29 cas
  // confirmés sur les quatre dernières semaines (S29-S32) — exactement la ligne en base. Rien à
  // écrire. ✅ Au passage : reliefweb est de nouveau lisible (curl 200 avec un User-Agent de
  // navigateur, PDF téléchargeable), le blocage constaté le 25/08 est levé.
  "d9d8b75c-f7ac-4fc9-af3b-d4d41582c70c": "2026-08-26",
  // Dengue/Nouvelle-Calédonie : vérifiée le 18/08 en relisant le PDF du WHO WPRO Dengue Situation
  // Update #751 (06/08), page 6 : « From 13 to 26 July, 17 additional dengue cases have been
  // reported, bringing the cumulative total in 2026 to 2 220 cases... 2 215 cases (2 017 confirmed
  // and 198 probable) were locally acquired ». La ligne porte déjà 2 220 sourcés à #751, donc rien
  // à écrire. #751 reste la dernière édition parue (série bimensuelle, #752 attendu vers le 20/08).
  "74561cc3-216f-4ee1-988a-ee82e362155d": "2026-08-18",
};
console.log("\n=== Lignes manuelles (section 5) — dues pour vérif hebdo (>7j) ===");
const now = Date.now();
let anyDue = false;
for (const o of active) {
  const label = MANUAL_ROWS[o.id];
  if (!label) continue;
  const checked = MANUAL_ROW_CHECKED[o.id];
  const lastSeen = Math.max(
    new Date(o.updated_at).getTime(),
    checked ? new Date(checked).getTime() : 0
  );
  const ageDays = Math.round((now - lastSeen) / 864e5);
  const via = checked && new Date(checked).getTime() > new Date(o.updated_at).getTime()
    ? " (dernière vérif sans changement)"
    : "";
  if (ageDays > 7) {
    anyDue = true;
    console.log(`${label} [${o.id}] : ${ageDays}j${via} — À VÉRIFIER (cases=${o.cases} deaths=${o.deaths} date=${(o.date || "").slice(0, 10)})`);
  } else {
    console.log(`${label} [${o.id}] : ${ageDays}j${via} — skip (vérifiée récemment)`);
  }
}
if (!anyDue) console.log("(aucune ligne due cette semaine)");

// Watch ponctuel, distinct de la cadence hebdo ci-dessus : la fenêtre de surveillance des 42j
// post-dernier-cas (calquée sur la règle OMS utilisée pour la clôture Ebola/Ouganda le 28/07)
// se termine vers le 11-12/08/2026 pour Marburg/Ouganda (cas unique notifié le 30/06/2026, voir
// commentaire MANUAL_ROW_CHECKED ci-dessus). Demande explicite de David le 08/08 : rechercher une
// déclaration de fin d'épidémie ougandaise à ce moment-là, indépendamment du cycle de 7j normal.
// Supprimer ce bloc une fois la clôture confirmée (ou la ligne passée à active=false).
// Une fois la fenêtre ouverte, la recherche de clôture est refaite tous les 3 jours et non tous
// les matins : une déclaration de fin d'épidémie peut tomber n'importe quel jour (donc pas de
// cadence hebdo), mais sans cette date de dernière vérification le bloc réémettait la même alerte
// indéfiniment — même travers que MANUAL_ROW_CHECKED / CLUSTER_EDITION_CHECKED ci-dessus.
// ⚠️ Ne bumper cette date qu'après avoir réellement cherché la déclaration.
const MARBURG_UGANDA_ID = "b17d4fda-c38c-41c0-9b26-e60a54c1851b";
const MARBURG_CLOSURE_WATCH_FROM = "2026-08-11";
// ⚠️ FAUX POSITIF À NE PAS ROUVRIR (rencontré le 16/08) : une WebSearch « Uganda Marburg outbreak
// declared over » remonte en bonne place l'article AFRO `afro.who.int/news/marburg-virus-disease-
// outbreak-uganda-over` — il date du **8 décembre 2017** (épidémie Kween/Kapchorwa), pas de 2026.
// Le résumé de recherche l'accompagnait d'un « 20 confirmed cases and 2 deaths » qui ne correspond
// à AUCUNE épidémie ougandaise réelle (2017 : 3 cas ; 2025 : 14 confirmés / 2 décès ; 2026 : 1 cas).
// Toujours vérifier la date de publication de cet article avant de conclure à une clôture.
const MARBURG_CLOSURE_LAST_CHECK = "2026-08-28"; // gov.uk (page mise à jour le 27/08, relue le 28/08) : le cas du 30/06 à Kyegegwa est toujours listé sous « Current incidents and outbreaks » 2026, aucune déclaration de fin d'épidémie. WebSearch « Marburg Uganda outbreak declared over August 2026 » : rien non plus, la couverture s'arrête au silence des autorités ougandaises constaté par STAT le 16/07. Les trois faux positifs documentés plus haut tiennent, ne pas les alléger.
// ⚠️ TROISIÈME FAUX POSITIF DE CLÔTURE, rencontré le 22/08 — distinct des deux ci-dessus : la guidance
// gov.uk ET le DON615 mentionnent tous deux une « fenêtre de 42 jours » ougandaise qui « cesse le
// 27/08 ». C'est celle de l'EBOLA Bundibugyo (dernier cas importé de RDC sorti de soins le 16/07),
// PAS celle de Marburg (cas notifié le 30/06, fenêtre théorique échue depuis le 11/08). Ne pas lire
// cette date du 27/08 comme une clôture Marburg à venir, et ne pas la mettre dans ce watch.
const MARBURG_CLOSURE_RECHECK_DAYS = 3;
console.log("\n=== Watch ponctuel : fenêtre de clôture Marburg/Ouganda (42j depuis notification 30/06) ===");
const marburgRow = active.find((o) => o.id === MARBURG_UGANDA_ID);
const marburgCheckAge = Math.round((now - new Date(MARBURG_CLOSURE_LAST_CHECK).getTime()) / 864e5);
if (!marburgRow) {
  console.log("Ligne déjà inactive ou introuvable en base — watch obsolète, à retirer du script.");
} else if (now >= new Date(MARBURG_CLOSURE_WATCH_FROM).getTime()) {
  if (marburgCheckAge < MARBURG_CLOSURE_RECHECK_DAYS) {
    console.log(`Fenêtre des 42j ouverte, dernière recherche de clôture il y a ${marburgCheckAge}j — skip (recheck tous les ${MARBURG_CLOSURE_RECHECK_DAYS}j).`);
  } else {
    console.log(`⚠️ Fenêtre des 42j atteinte (dès le ${MARBURG_CLOSURE_WATCH_FROM}), dernière recherche il y a ${marburgCheckAge}j — WebSearch/WebFetch une déclaration de fin d'épidémie ougandaise (who.int/afro.who.int news, gov.uk guidance) avant de conclure. Ligne toujours active en DB (cases=${marburgRow.cases} deaths=${marburgRow.deaths}).`);
  }
} else {
  const daysLeft = Math.ceil((new Date(MARBURG_CLOSURE_WATCH_FROM).getTime() - now) / 864e5);
  console.log(`Pas encore dû — ${daysLeft}j avant le ${MARBURG_CLOSURE_WATCH_FROM}.`);
}

// --- 4e. Lignes de cron dont la DATE D'ARRÊTÉ périme sans que rien ne le voie ---
// Angle mort trouvé le 20/08/2026 sur MERS-CoV/Global (sp=5, alimentée par l'aperçu ECDC).
// Les crons ne réécrivent une ligne que si les CHIFFRES changent. Quand une source publie une
// nouvelle édition avec des totaux identiques (MERS : 2 649 cas / 960 décès inchangés entre le
// 1er juin et le 3 août, aucun cas nouveau sur la période), le cron ne touche à rien — et la
// ligne continue d'afficher au client une date d'arrêté vieille de deux mois alors que la source
// confirme la donnée à une date bien plus récente. Aucun filet existant ne la voyait : 4d ne
// couvre que source_priority=10, 4d-bis que les clusters de seeds, la section 5 que les lignes
// sans cron du tout.
// Le scan ne conclut rien : il liste les lignes de cron figées depuis > 45j pour qu'on aille lire
// l'édition courante de leur source. Si les chiffres ont bougé → c'est le cron qui est en panne,
// creuser de ce côté plutôt que de patcher à la main. S'ils sont identiques → ne corriger QUE la
// date d'arrêté et les 5 descriptions, jamais les chiffres.
// Seuil à 45j (et non 7j) volontairement : ces lignes SONT couvertes par un cron, on ne cherche
// ici que les cas où la cadence de publication de la source et celle du cron ont divergé.
// Exclusions : seeds (figés à dessein, cf. 4a), source_priority=10 (déjà en 4d/4d-bis) et les
// lignes de MANUAL_ROWS (section 5, cadence 7j propre).
// Même garde-fou que les autres maps : ne bumper une date qu'après avoir réellement consulté
// l'édition courante de la source, jamais pour faire taire une ligne.
const STALE_CRON_ROW_CHECKED = {
  // MERS-CoV/Global : vérifié le 20/08. L'aperçu ECDC courant est arrêté au 03/08/2026 et donne
  // exactement les mêmes totaux (2 649 / 960) — aucun cas MERS déclaré dans le monde entre le
  // 01/06 et le 03/08. Seules la `date` et les 5 descriptions ont été alignées sur le 03/08 ;
  // chiffres et source inchangés, ligne laissée à sp=5 (le cron fait bien son travail sur les
  // chiffres, rien à verrouiller).
  "3dc50804-7718-43c7-b0ce-7cdd95165b2b": "2026-08-20",
  // Shigellosis/EU-EEE : vérifié le 20/08, rien à faire. Contrairement à MERS-CoV, la source
  // n'est pas une série périodique mais une « epidemiological update » ECDC ponctuelle et datée
  // (mai 2026) sur les clusters MDR/XDR de Shigella circulant depuis 2023. Il n'y a pas d'édition
  // suivante à attendre : la ligne est un agrégat pluriannuel en phase `monitoring`, son
  // ancienneté est structurelle et n'est pas un signal de péremption.
  "bac370f5-bdc9-4840-98b1-5c8b0b3502f3": "2026-08-20",
  // Dengue/Guatemala : verifie le 28/08 — CAS « chiffres differents », donc cron en panne, pas
  // ligne a repeindre. L'API xmart OMS (ARBOV/V_DENGUE_GLOBAL_VALIDATED_PUBLIC, la source reelle
  // derriere le libelle shinyapps) donne 15 679 cas cumules 2026 / 0 deces, derniere periode au
  // 2026-06-28, contre 4 817 au 2026-04-12 en base. Cause trouvee : 15 679 / 4 817 = 3,25x, donc
  // spikeGuard() (SPIKE_RATIO=3, lib/outbreak-guards.ts) refusait l'ecriture a CHAQUE run depuis
  // le 13/07 — et les guards ordinaires ne sont volontairement pas remontes a la sante du cron
  // (seuls ceux qui bloquent une ligne verrouillee le sont, cf. sync-who-regional/route.ts ~l.1474).
  // La hausse n'est pas un artefact de parsing mais une revision a la hausse des donnees validees
  // OMS (la somme des semaines jusqu'au 12/04 vaut aujourd'hui 10 270, pas 4 817) ; la serie est
  // lisse (602->135 cas/sem, decroissance conforme au -43 % annonce par le MSPAS). Ligne alignee a
  // la main sur ce que le cron aurait ecrit ; les increments hebdomadaires suivants (~135/sem) sont
  // tres en deca du seuil 3x, donc le cron reprend la main de lui-meme.
  // ⚠️ Divergence de cadrage a ne pas « corriger » : le MSPAS annonce 9 689 cas a la semaine 30,
  // moins que les 15 679 de l'OMS — cadrages differents (l'ARBOV public des Ameriques est alimente
  // par les cas *suspects* remontes a l'OPS). Cette ligne est possedee par le cron xmart : la
  // rafraichir avec un chiffre MSPAS melangerait deux cadrages, meme piege que Rougeole/Etats-Unis.
  "f24550be-7ed6-4a30-b077-3d0faed5f60e": "2026-08-28",
  // Mpox/Ouganda et Mpox/Rwanda : verifies le 28/08 — CAS « chiffres identiques ET date d'arrete
  // identique », donc rien a realigner, contrairement a MERS-CoV. L'API xmart (MPX/V_MPX_VALIDATED_DAILY,
  // source reelle derriere le libelle shinyapps) renvoie son dernier enregistrement au 2026-04-05
  // pour l'Ouganda (8 512 confirmes / 52 deces) et au 2026-04-19 pour le Rwanda (131 / 0) — soit
  // exactement les lignes en base, dates comprises. Ce n'est donc pas la cadence du cron qui a
  // diverge : c'est la source elle-meme qui n'a plus publie depuis avril. Le cron fait son travail.
  // ⏳ A surveiller : le fetcher abandonne au-dela de DENGUE_STALE_CEILING_DAYS (180j), soit vers le
  // 02/10 pour l'Ouganda et le 16/10 pour le Rwanda. Passe cette date il renverra null et les deux
  // lignes cesseront d'etre rafraichies sans que rien ne le signale — decider d'ici la si elles
  // doivent etre cloturees ou re-sourcees.
  "f8ac0c0f-4607-4910-bf42-60fbce058975": "2026-08-28",
  "7203dc63-d8b1-46fe-afeb-a5ad1541ccac": "2026-08-28",
};
const STALE_CRON_DAYS = 45;
console.log(`\n=== Lignes de cron figées depuis > ${STALE_CRON_DAYS}j (date d'arrêté potentiellement périmée) ===`);
const staleCronRows = active
  .filter((o) => !o.is_seed && o.source_priority !== 10 && !MANUAL_ROWS[o.id])
  .map((o) => {
    const checked = STALE_CRON_ROW_CHECKED[o.id];
    const lastSeen = Math.max(
      new Date(o.updated_at).getTime(),
      checked ? new Date(checked).getTime() : 0
    );
    return { o, checked, ageDays: Math.round((now - lastSeen) / 864e5) };
  })
  .filter((x) => x.ageDays > STALE_CRON_DAYS)
  .sort((a, b) => b.ageDays - a.ageDays);
if (staleCronRows.length) {
  staleCronRows.forEach(({ o, checked, ageDays }) => {
    const via = checked && new Date(checked).getTime() > new Date(o.updated_at).getTime()
      ? " (dernière vérif sans changement)"
      : "";
    console.log(`[${o.id}] ${o.disease_en || o.disease} | ${o.country_en || o.country} | ${ageDays}j sans écriture${via} — LIRE L'ÉDITION COURANTE | ${o.cases}c/${o.deaths}d | date=${(o.date || "").slice(0, 10)} | sp=${o.source_priority} | src=${(o.source || "").slice(0, 60)}`);
  });
} else {
  console.log("Aucune.");
}

// --- 6. Compteur canonique de fraîcheur — LE chiffre que le registre doit citer ---
// Ajouté le 2026-08-24 après un brief matinal annonçant « 75 des 131 foyers affichés
// n'ont pas bougé depuis plus de dix jours, 42 marqués actifs figés depuis plus de
// 30 jours », attribués à l'effet §8 (aucun cron n'écrivant au-dessus de
// source_priority 5). Deux problèmes dans ce chiffre :
//
//   1. L'effet §8 avait été corrigé cinq jours plus tôt — le balayage du 19/08 a porté
//      17 crons de `.lte(5)` à `.lte(10)`. Ce n'est plus la cause de quoi que ce soit.
//   2. Le compteur mesurait l'âge BRUT de `updated_at`, qui est un horodatage
//      d'ÉCRITURE et non de VÉRIFICATION. Or ce fichier tient depuis le 16/08 quatre
//      cartes de vérifications faites sans écriture (FROZEN_ROW_CHECKED,
//      CLUSTER_EDITION_CHECKED, MANUAL_ROW_CHECKED, STALE_CRON_ROW_CHECKED) et la base
//      porte depuis le 22/08 `source_confirmed_at`. Une ligne relue ce matin et
//      confirmée inchangée n'écrit rien : elle comptait donc comme « figée ».
//
// D'où ce bloc : un seul endroit versionné qui calcule l'ancienneté sur
// max(updated_at, source_confirmed_at, cartes CHECKED applicables), applique à chaque
// famille de lignes la cadence que ce fichier lui a déjà fixée, et sort un total à
// citer tel quel. Le chiffre brut est affiché en dessous, explicitement étiqueté comme
// à ne pas reprendre — pour que l'écart reste visible plutôt que de se rejouer.
//
// Les seuils NE SONT PAS choisis ici : ils reprennent ceux des sections ci-dessus
// (4d: 7j, 4d-bis: 14j, section 5: 7j, 4e: 45j). Changer une cadence se fait dans sa
// section, ce bloc suit.
const FRESHNESS_TIERS = {
  manual:  { label: "lignes manuelles (section 5)",          days: 7  },
  locked:  { label: "lignes verrouillées sp=10 (4d)",        days: 7  },
  cluster: { label: "clusters de seeds sp=10 (4d-bis)",      days: 14 },
  cron:    { label: "lignes de cron (4e)",                   days: 45 },
  seedRef: { label: "seeds de référence (figés à dessein)",  days: null },
};

function lastVerifiedMs(o) {
  const candidates = [
    o.updated_at,
    o.source_confirmed_at,
    FROZEN_ROW_CHECKED[o.id],
    STALE_CRON_ROW_CHECKED[o.id],
    MANUAL_ROW_CHECKED[o.id],
  ];
  if (o.is_seed && o.source_priority === 10) {
    const key = clusterKeyFor(o.disease_en || o.disease || "");
    if (key) candidates.push(CLUSTER_EDITION_CHECKED[key]);
  }
  return Math.max(
    ...candidates
      .filter(Boolean)
      .map((v) => new Date(v).getTime())
      .filter((t) => !Number.isNaN(t)),
    0
  );
}

function tierOf(o) {
  if (MANUAL_ROWS[o.id]) return "manual";
  if (o.source_priority === 10) return o.is_seed ? "cluster" : "locked";
  if (o.is_seed) return "seedRef";
  return "cron";
}

console.log("\n=== Fraîcheur d'ensemble — compteur canonique (c'est CE chiffre qu'il faut citer) ===");
const buckets = Object.fromEntries(Object.keys(FRESHNESS_TIERS).map((k) => [k, { total: 0, due: 0 }]));
let dueTotal = 0;
for (const o of active) {
  const tier = tierOf(o);
  const b = buckets[tier];
  b.total++;
  const days = FRESHNESS_TIERS[tier].days;
  if (days === null) continue; // hors cadence par construction
  const ageDays = Math.round((now - lastVerifiedMs(o)) / 864e5);
  if (ageDays > days) { b.due++; dueTotal++; }
}
console.log(`Foyers actifs : ${active.length}`);
for (const [k, t] of Object.entries(FRESHNESS_TIERS)) {
  const b = buckets[k];
  if (b.total === 0) continue;
  const seuil = t.days === null ? "hors cadence" : `seuil ${t.days}j`;
  console.log(`  · ${t.label.padEnd(38)} ${String(b.due).padStart(3)} en attente / ${String(b.total).padStart(3)} (${seuil})`);
}
console.log(`→ EN ATTENTE DE VÉRIFICATION : ${dueTotal} ligne(s) sur ${active.length}`);

// Chiffre brut, affiché uniquement pour rendre l'écart visible.
const rawStale = (n) => active.filter((o) => Math.round((now - new Date(o.updated_at).getTime()) / 864e5) > n).length;
console.log(
  `(âge brut de updated_at, NE PAS CITER : ${rawStale(10)} lignes > 10j, ${rawStale(30)} > 30j — ` +
  `updated_at est un horodatage d'écriture ; une ligne relue et confirmée inchangée n'écrit rien.)`
);
