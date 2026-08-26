// Contrôle mécanique d'un message sortant (DM LinkedIn, commentaire, note de
// connexion, email) AVANT relecture par l'agent relecteur.
//
// Ce script ne juge pas la qualité : il vérifie ce qui est vérifiable sans avis,
// c'est-à-dire exactement ce qu'une relecture par le rédacteur lui-même rate le
// plus souvent — un chiffre qui ne vient d'aucune ligne de la base, une formule
// déjà servie à quelqu'un d'autre, une langue qui ne suit pas le fil, un
// plafond de relance dépassé.
//
// Usage :
//   node scripts/check-outreach-message.mjs --draft brouillon.md --context ctx.json
//   node scripts/check-outreach-message.mjs --draft brouillon.md --context ctx.json --json
//
// Contexte attendu (ctx.json) :
//   {
//     "channel": "linkedin-dm" | "linkedin-comment" | "linkedin-connect-note" | "email",
//     "recipient": { "name": "Christophe VALINGOT DELAURENTI", "slug": "christophe-..." },
//     "threadFile": "tmp/thread-christophe.txt",   // fil relu, optionnel mais fortement conseillé
//     "peers": ["tmp/draft-adetifa.md"],           // autres brouillons du MEME run
//     "substantiveExchange": true,                  // au moins un aller-retour de fond
//     "outboundUnanswered": 1,                      // messages partis sans réponse sur ce sujet
//     "lastOutboundDate": "2026-08-21",
//     "attempt": 1
//   }
//
// Sortie : verdict PASS / WARN / FAIL / QUEUE + findings. Code de sortie 1 si FAIL ou QUEUE.
// Node >= 22.

import { readFileSync, existsSync } from "fs";

// ── Arguments ────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const arg = (name, fallback = null) => {
  const i = argv.indexOf(`--${name}`);
  return i === -1 ? fallback : argv[i + 1];
};
const asJson = argv.includes("--json");
const draftPath = arg("draft");
const contextPath = arg("context");
const lexiconPath = arg("lexicon", "marketing/qa/lexicon.json");
const factsPath = arg("facts", "marketing/qa/claimable-facts.json");
const claimsPath = arg("claims", "marketing/qa/product-claims.json");

if (!draftPath) {
  console.error("ABORT — --draft <fichier> est requis.");
  process.exit(2);
}

const draft = readFileSync(draftPath, "utf-8").trim();
const readJson = (path, fallback) => {
  if (!path || !existsSync(path)) return fallback;
  const raw = readFileSync(path, "utf-8").trim();
  if (!raw) return fallback;
  try {
    return JSON.parse(raw);
  } catch (e) {
    console.error(`ABORT — ${path} n'est pas du JSON valide : ${e.message}`);
    process.exit(2);
  }
};
const ctx = readJson(contextPath, {});
const lex = JSON.parse(readFileSync(lexiconPath, "utf-8"));
const factsDoc = readJson(factsPath, null);
const claimsDoc = readJson(claimsPath, null);

const channel = ctx.channel ?? "linkedin-dm";
const limits = lex.channel_limits[channel];
if (!limits) {
  console.error(`ABORT — canal inconnu : ${channel}`);
  process.exit(2);
}
const attempt = ctx.attempt ?? 1;
const thread = ctx.threadFile && existsSync(ctx.threadFile) ? readFileSync(ctx.threadFile, "utf-8") : "";

const findings = [];
const add = (severity, id, message, detail) => findings.push({ severity, id, message, detail });

// ── Outils ───────────────────────────────────────────────────────────────────
const words = (s) =>
  s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);

// Mots-outils : une séquence qui n'en contient presque que ne dit rien du style,
// elle dit juste que les deux textes sont en français. Sans ce filtre l'anti-gabarit
// remonte « ou est ce qu elles » et noie les vraies formules recyclées.
const FUNCTION_WORDS = new Set(
  ("le la les l un une des du de d au aux a à et ou ni mais donc or car que qui quoi dont où quand si " +
   "ce cet cette ces c ça cela celui celle ceux je tu il elle on nous vous ils elles me te se lui leur y en " +
   "mon ma mes ton ta tes son sa ses notre nos votre vos leurs " +
   "est sont était étaient sera seront suis es sommes êtes être eu ai as avons avez ont avait avaient avoir " +
   "pas ne plus moins très trop bien aussi encore déjà tout tous toute toutes même autre autres " +
   "dans sur sous pour par avec sans vers chez entre depuis jusqu comme " +
   "the a an of to in on at by for with from as is are was were be been being it its this that these those " +
   "i you he she we they me him her us them my your his their our not no do does did have has had will would " +
   "can could should may might there here what which who whom when where how and or but so if then than").split(/\s+/)
);
const contentCount = (arr) => arr.filter((w) => !FUNCTION_WORDS.has(w)).length;

// Seuil relevé de 2 à 3 le 2026-08-26, après un incident documenté : des
// tournures d'anglais courant (« tends to be read as », « the other side of
// it ») ne contiennent que 2 mots non-fonctionnels et se faisaient bloquer
// comme gabarit recyclé alors qu'elles n'ont rien de spécifique à un message —
// deux rédacteurs indépendants les produiraient l'un et l'autre pour un sujet
// proche. Un vrai gabarit recyclé (accroche, CTA, clôture) porte presque
// toujours 3 mots substantiels ou plus ; ce seuil laisse passer la
// coïncidence de langue sans laisser passer la formule recopiée.
const ngrams = (text, n) => {
  const w = words(text);
  const out = new Set();
  for (let i = 0; i + n <= w.length; i++) {
    const slice = w.slice(i, i + n);
    if (contentCount(slice) < 3) continue;
    out.add(slice.join(" "));
  }
  return out;
};

const normalizeNumber = (raw) => {
  let s = raw.replace(/[\s  ]/g, "");
  if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, "");     // 1.406 → 1406
  else if (/^\d{1,3}(,\d{3})+$/.test(s)) s = s.replace(/,/g, "");  // 1,406 → 1406
  else s = s.replace(",", ".");                                     // 12,5 → 12.5
  const v = Number(s);
  return Number.isFinite(v) ? v : null;
};

const EPI_NEAR =
  /(cas|case|deaths?|d[ée]c[èe]s|d[ée]c[ée]d[ée]s|patients?|l[ée]talit[ée]|fatality|cfr|%|pour ?cent|percent|doses|contacts?|districts?|zones? de sant[ée])/i;

// ── 1. Forme : ponctuation, caractères, longueur ─────────────────────────────
const ALLOWED_NON_ASCII = /[àâäçéèêëîïôöùûüÿœæÀÂÄÇÉÈÊËÎÏÔÖÙÛÜŸŒÆ]/;
const strays = new Map();
for (const ch of draft) {
  if (ch.charCodeAt(0) > 127 && !ALLOWED_NON_ASCII.test(ch)) {
    strays.set(ch, (strays.get(ch) ?? 0) + 1);
  }
}
if (strays.size > 0) {
  add(
    "blocker",
    "form.non-ascii",
    "Caractères non ASCII hors accents français.",
    [...strays].map(([c, n]) => `${JSON.stringify(c)} (U+${c.codePointAt(0).toString(16).toUpperCase()}) ×${n}`).join(", ")
  );
}

const chars = [...draft].length;
if (chars > limits.maxChars) {
  add("blocker", "form.length", `Trop long pour ${channel}.`, `${chars} caractères, plafond ${limits.maxChars}.`);
}
const paragraphs = draft.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
if (paragraphs.length > limits.maxParagraphs) {
  add("warn", "form.paragraphs", `Plus de paragraphes que le format ne le tolère.`, `${paragraphs.length} > ${limits.maxParagraphs}.`);
}

// ── 2. Lexique : interdits et confusions de vocabulaire ──────────────────────
for (const entry of [...lex.banned, ...lex.confusables]) {
  const re = new RegExp(entry.pattern, "giu");
  const hits = [...draft.matchAll(re)].map((m) => m[0]);
  if (hits.length > 0) {
    add(
      entry.severity,
      "lexique",
      entry.why,
      `« ${[...new Set(hits)].join(" », « ")} »` + (entry.prefer ? ` → préférer : ${entry.prefer}` : "")
    );
  }
}

// ── 3. Véracité : tout chiffre doit venir du registre ou du fil ──────────────
// Les nombres du registre produit (prix, durée d'essai, couverture, copie
// publique du site) sont citables au même titre que les chiffres de flambée.
// Sans ça, « 29 € » et « 14 jours » seraient bloqués comme non sourcés.
const claimNumbers = new Map();
for (const n of claimsDoc?.numbers ?? []) {
  const key = String(n.value);
  if (!claimNumbers.has(key)) claimNumbers.set(key, []);
  claimNumbers.get(key).push(n);
}

const factIndex = new Map();
if (factsDoc) {
  for (const f of factsDoc.facts) {
    const key = String(f.value);
    if (!factIndex.has(key)) factIndex.set(key, []);
    factIndex.get(key).push(f);
  }
  // Le registre doit être régénéré au début du run. S'il date de la veille, il
  // décrit une base qui a bougé depuis, et le contrôle validerait des chiffres
  // périmés en croyant les sourcer. La règle est mécanique pour ne pas dépendre
  // du fait que la routine ait pensé à lancer l'étape 1.
  const registryAgeHours = (Date.now() - new Date(factsDoc.generatedAt)) / 3_600_000;
  if (!(registryAgeHours < 12)) {
    add(
      "blocker",
      "facts.registry-stale",
      `Registre de faits généré il y a ${Math.round(registryAgeHours)} h.`,
      "Relancer npm run qa:facts avant de rédiger : un registre de la veille valide des chiffres qui ont pu être révisés depuis."
    );
  }
} else {
  add(
    "blocker",
    "facts.registry-missing",
    "Registre de faits absent : aucun chiffre ne peut être validé.",
    `Lancer d'abord : npm run qa:facts (attendu à ${factsPath}).`
  );
}

const threadNumbers = new Set(
  [...thread.matchAll(/\d[\d\s  .,]*\d|\d+/g)].map((m) => normalizeNumber(m[0])).filter((v) => v !== null)
);

const ISO_DATE = /\b\d{4}-\d{2}-\d{2}\b/g;
const draftDates = [...draft.matchAll(ISO_DATE)].map((m) => m[0]);
const draftText = draft.replace(ISO_DATE, " ");

for (const m of draftText.matchAll(/\d[\d\s  .,]*\d|\d+/g)) {
  const value = normalizeNumber(m[0]);
  if (value === null) continue;

  const around = draftText.slice(Math.max(0, m.index - 40), m.index + m[0].length + 40);
  const isEpi = EPI_NEAR.test(around);
  const isYear = Number.isInteger(value) && value >= 1900 && value <= 2100 && !isEpi;
  if (isYear) continue;

  if (threadNumbers.has(value)) {
    add("info", "facts.from-thread", `Le chiffre ${m[0]} vient du fil, pas de la base.`, `Contexte : « …${around.trim()}… »`);
    continue;
  }

  const productMatches = claimNumbers.get(String(value)) ?? [];
  if (productMatches.length > 0) {
    add(
      "info",
      "claims.product-number",
      `Chiffre ${m[0]} sourcé côté produit.`,
      productMatches.slice(0, 3).map((n) => `${n.label} — ${n.provenance}`).join(" · ")
    );
    continue;
  }

  const matches = factIndex.get(String(value)) ?? [];
  if (matches.length === 0) {
    const severity = isEpi || value >= 100 ? "blocker" : "warn";
    add(
      severity,
      "facts.unsourced",
      `Chiffre ${m[0]} absent du registre de faits et du fil.`,
      `Contexte : « …${around.trim()}… »` +
        (isEpi ? " — chiffre épidémiologique, il doit venir d'une ligne de la base." : "")
    );
    continue;
  }

  // Une même valeur numérique peut correspondre à des dizaines de lignes du
  // registre (foyers et maladies différentes). Ne juger la fraîcheur ou le
  // statut d'UNE ligne précise que si sa maladie ou son pays apparaît dans la
  // même phrase — sinon un nombre non épidémiologique (une moyenne calculée,
  // un pourcentage) se fait bloquer par la ligne la plus stricte du registre
  // qui partage sa valeur, sans rapport avec le sujet réel. Incident du
  // 26/08 : « 56 » (moyenne calculée, 5 290 / 95 jours) bloqué comme périmé
  // sur une ligne Diphtérie/Mauritanie absente de la phrase.
  let contextConfirmed = false;
  for (const f of matches) {
    const aroundLower = around.toLowerCase();
    const mentionsLine = [f.disease, f.diseaseFr, f.country, f.countryFr].some(
      (name) => name && aroundLower.includes(name.toLowerCase())
    );
    if (!mentionsLine) continue;
    contextConfirmed = true;

    const label = `${f.disease} / ${f.country} (${f.kind}, source vérifiée le ${(f.confirmedAt ?? f.updatedAt)?.slice(0, 10)}, ${f.ageDays} j)`;
    if (f.stale && !draftDates.length && !/\bau \d|\ble \d|\bas of\b|\bà la date\b/i.test(around)) {
      add(
        "blocker",
        "facts.stale",
        `Chiffre ${m[0]} périmé (> ${factsDoc.staleAfterDays} j) et avancé sans sa date.`,
        `${label} — soit dater explicitement, soit relancer build-claimable-facts.mjs.`
      );
    }
    if (!f.active && /\b(en cours|actif|active|ongoing|toujours|encore)\b/i.test(around)) {
      add(
        "blocker",
        "facts.closed-presented-active",
        `Flambée close présentée comme en cours autour de ${m[0]}.`,
        label
      );
    }
  }
  if (!contextConfirmed && matches.length > 0) {
    add(
      "info",
      "facts.value-no-context-match",
      `Chiffre ${m[0]} présent dans le registre mais pour un foyer non nommé dans la phrase.`,
      `${matches.length} ligne(s) du registre partagent cette valeur, aucune dont la maladie/le pays n'apparaît dans « …${around.trim()}… » — non rapproché automatiquement, à confirmer par le relecteur si besoin.`
    );
  }
}

// ── 4. Affirmations sur HWG ──────────────────────────────────────────────────
const sentences = draft.split(/(?<=[.!?])\s+/);
const hwgSentences = sentences.filter((s) => /health ?watch|hwg/i.test(s));
if (hwgSentences.length > 0 && !claimsDoc) {
  add(
    "blocker",
    "claims.registry-missing",
    "Le message affirme quelque chose sur HWG, mais le registre produit est absent.",
    `Lancer npm run qa:claims (attendu à ${claimsPath}).`
  );
}
for (const s of hwgSentences) {
  // Le contrôle mécanique ne sait pas juger une affirmation en langue naturelle :
  // il la remonte au relecteur, qui la confronte au registre produit — une liste
  // fermée extraite du site et du code, pas sa mémoire.
  add(
    "review",
    "hwg.claim",
    "Affirmation sur HWG : à confronter au registre produit (copie publique du site, prix, couverture, claims manuelles).",
    s.trim()
  );
}
if (/\b(\d+\s*)(clients?|utilisateurs?|abonn[ée]s?|users?|subscribers?|customers?)\b/i.test(draft)) {
  add("blocker", "hwg.traction", "Chiffre de traction (clients, utilisateurs, abonnés) : interdit en sortant.", null);
}

// ── 5. Contexte destinataire : langue, registre, CTA, relance ────────────────
const FR_STOP = ["le", "la", "les", "des", "une", "que", "qui", "pour", "dans", "pas", "vous", "est", "sur", "avec", "je", "ne", "au", "ce", "il"];
const EN_STOP = ["the", "of", "and", "to", "in", "is", "that", "it", "for", "you", "with", "on", "as", "are", "this", "was", "but", "have"];
const langScore = (text) => {
  const w = words(text);
  const fr = w.filter((x) => FR_STOP.includes(x)).length;
  const en = w.filter((x) => EN_STOP.includes(x)).length;
  return fr === en ? null : fr > en ? "fr" : "en";
};
const draftLang = langScore(draft);
const threadLang = ctx.threadLang ?? (thread ? langScore(thread) : null);
if (threadLang && draftLang && threadLang !== draftLang) {
  add("blocker", "context.language", "Le brouillon n'est pas dans la langue du fil.", `fil = ${threadLang}, brouillon = ${draftLang}.`);
}
if (!threadLang && !ctx.threadFile) {
  add("review", "context.no-thread", "Aucun fil fourni : langue, registre et répétitions n'ont pas pu être contrôlés contre l'historique.", null);
}

const register = (t) => {
  const tu = (t.match(/\b(tu|ton|ta|tes|toi|t'as)\b/gi) ?? []).length;
  const vous = (t.match(/\b(vous|votre|vos)\b/gi) ?? []).length;
  return tu === vous ? null : tu > vous ? "tutoiement" : "vouvoiement";
};
if (draftLang === "fr" && thread) {
  const rd = register(draft);
  const rt = register(thread);
  if (rd && rt && rd !== rt) {
    add("blocker", "context.register", "Tutoiement/vouvoiement incohérent avec le fil.", `fil = ${rt}, brouillon = ${rd}.`);
  }
}

const ctaHits = lex.cta_markers
  .map((p) => draft.match(new RegExp(p, "iu")))
  .filter(Boolean)
  .map((m) => m[0]);
if (ctaHits.length > 0) {
  const detail = `« ${[...new Set(ctaHits)].join(" », « ")} »`;
  if (limits.ctaAllowed === false) {
    add("blocker", "context.cta-forbidden", `CTA ou lien détecté, interdit sur ${channel}.`, detail);
  } else if (limits.ctaAllowed === "after-substantive-exchange" && ctx.substantiveExchange !== true) {
    add("blocker", "context.cta-too-early", "CTA avant le moindre aller-retour de fond dans ce fil.", detail);
  }
}
// Anti-répétition du CTA (cas de référence Simon Ruegg, 07/08) : le nom, le lien
// ou l'essai déjà envoyés plus tôt dans CE fil interdisent de reservir
// l'argumentaire une seconde fois, même des heures plus tard le même jour.
if (ctaHits.length > 0 && thread) {
  const alreadySent = [/healthwatch[- ]?global\.(com|org|app)/i, /\bessai\b/i, /\btrial\b/i, /\bpro\b/i]
    .filter((re) => re.test(thread))
    .map((re) => String(re));
  if (alreadySent.length > 0) {
    add(
      "blocker",
      "context.cta-repeat",
      "Argumentaire déjà envoyé plus tôt dans ce fil : ne pas le reservir.",
      `Traces dans le fil : ${alreadySent.join(", ")} — retirer le CTA, le point de fond suffit.`
    );
  }
}

// Closer imposé sur les notes de connexion, et jamais un corps FR avec un closer EN.
if (limits.closer && draftLang) {
  const expected = limits.closer[draftLang];
  if (expected && !draft.trim().endsWith(expected)) {
    add("blocker", "form.closer", `Note de connexion ${draftLang.toUpperCase()} : closer attendu absent ou mal placé.`, `Doit se terminer par « ${expected} ».`);
  }
  const wrong = limits.closer[draftLang === "fr" ? "en" : "fr"];
  if (wrong && draft.includes(wrong)) {
    add("blocker", "form.closer-mixed", "Corps et closer dans deux langues différentes.", `« ${wrong} » dans un message ${draftLang.toUpperCase()}.`);
  }
}

if (/https?:\/\//i.test(draft) && limits.linkAllowed !== true) {
  add(
    limits.linkAllowed === "on-request" && ctx.linkRequested === true ? "info" : "blocker",
    "context.link",
    `Lien dans un ${channel}.`,
    limits.linkAllowed === "on-request" ? "Autorisé seulement si le destinataire l'a demandé (linkRequested: true)." : null
  );
}

const unanswered = ctx.outboundUnanswered ?? 0;
if (unanswered >= lex.followup.maxUnansweredOutbound) {
  add(
    "blocker",
    "context.followup-cap",
    `Plafond de relance atteint : ${unanswered} message(s) sans réponse.`,
    "Consigner un abandon explicite plutôt que relancer."
  );
}
if (ctx.lastOutboundDate) {
  const days = Math.floor((Date.now() - new Date(ctx.lastOutboundDate)) / 86_400_000);
  if (days < lex.followup.minDaysBetweenOutbound) {
    add("blocker", "context.too-soon", `Dernier message il y a ${days} j.`, `Minimum ${lex.followup.minDaysBetweenOutbound} j entre deux envois.`);
  }
}

// ── 6. Anti-gabarit : historique et brouillons du même run ───────────────────
const draftHistoryGrams = ngrams(draft, lex.ngram.sizeHistory);
const historyHits = new Set();
for (const file of lex.ngram.corpus) {
  if (!existsSync(file)) {
    add("warn", "ngram.corpus-missing", `Corpus anti-gabarit introuvable : ${file}`, null);
    continue;
  }
  const corpusGrams = ngrams(readFileSync(file, "utf-8"), lex.ngram.sizeHistory);
  for (const g of draftHistoryGrams) if (corpusGrams.has(g)) historyHits.add(g);
}
if (historyHits.size > lex.ngram.maxHistoryHits) {
  add(
    "blocker",
    "ngram.history",
    `${historyHits.size} formule(s) déjà servie(s) dans l'historique.`,
    [...historyHits].slice(0, 12).map((g) => `« ${g} »`).join(" · ")
  );
}

// Le trou du 23/08 : le contrôle comparait aux archives, jamais aux autres
// brouillons du run en cours. Deux destinataires servis par le même moule le
// même jour passaient donc au travers.
const peerGrams = ngrams(draft, lex.ngram.sizePeer);
for (const peer of ctx.peers ?? []) {
  if (!existsSync(peer)) continue;
  const other = ngrams(readFileSync(peer, "utf-8"), lex.ngram.sizePeer);
  const shared = [...peerGrams].filter((g) => other.has(g));
  if (shared.length > lex.ngram.maxPeerHits) {
    add(
      "blocker",
      "ngram.peer",
      `${shared.length} séquence(s) de ${lex.ngram.sizePeer} mots partagée(s) avec un autre brouillon du même run (${peer}).`,
      shared.slice(0, 12).map((g) => `« ${g} »`).join(" · ")
    );
  }
}
for (const peer of ctx.peers ?? []) {
  if (ctx.recipient?.name && existsSync(peer) && readFileSync(peer, "utf-8").includes(ctx.recipient.name)) {
    add("warn", "peer.same-recipient", `Le brouillon ${peer} mentionne le même destinataire.`, null);
  }
}

// ── 7. Historique du destinataire, pour la relecture ─────────────────────────
if (ctx.recipient?.name && existsSync("marketing/linkedin-contacts.md")) {
  const log = readFileSync("marketing/linkedin-contacts.md", "utf-8");
  const occurrences = log.split("\n").filter((l) => l.includes(ctx.recipient.name)).length;
  add(
    "info",
    "context.history",
    `${occurrences} ligne(s) mentionnant ${ctx.recipient.name} dans linkedin-contacts.md.`,
    occurrences === 0 ? "Premier contact — les règles de premier contact s'appliquent." : null
  );
}

// ── Verdict ──────────────────────────────────────────────────────────────────
const blockers = findings.filter((f) => f.severity === "blocker");
const warns = findings.filter((f) => f.severity === "warn");
const reviews = findings.filter((f) => f.severity === "review");

// La boucle doit converger, pas mettre en file : les seuls états terminaux sont
// « envoyé » et « abandonné ». Essai 1 = rédaction ; essais 2-3 = corrections
// ciblées ; essai 4 = réécriture depuis zéro sous un autre angle, par un
// rédacteur qui ne reçoit PAS le brouillon échoué. Au-delà, abandon consigné.
const MAX_ATTEMPTS = 4;

// Un même motif de blocage qui revient d'un essai à l'autre signale que la
// correction ciblée ne comprend pas ce qui est demandé. Inutile d'user deux
// essais de plus : passer tout de suite à la réécriture depuis zéro.
const previousIds = new Set(ctx.previousFindingIds ?? []);
const repeated = [...new Set(blockers.map((f) => f.id))].filter((id) => previousIds.has(id));

let verdict;
if (blockers.length > 0) {
  if (attempt >= MAX_ATTEMPTS) verdict = "ABANDON";
  else if (repeated.length > 0 && attempt < MAX_ATTEMPTS - 1) verdict = "REWRITE_FROM_SCRATCH";
  else verdict = attempt >= MAX_ATTEMPTS - 1 ? "REWRITE_FROM_SCRATCH" : "FAIL";
} else if (warns.length > 0) verdict = "WARN";
else verdict = "PASS";

const result = {
  verdict,
  attempt,
  maxAttempts: MAX_ATTEMPTS,
  repeatedFindingIds: repeated,
  // À repasser tel quel en `previousFindingIds` dans le contexte de l'essai suivant.
  findingIds: [...new Set(blockers.map((f) => f.id))],
  channel,
  recipient: ctx.recipient?.name ?? null,
  chars,
  paragraphs: paragraphs.length,
  draftLang,
  threadLang,
  counts: { blockers: blockers.length, warns: warns.length, reviews: reviews.length },
  findings,
};

if (asJson) {
  console.log(JSON.stringify(result, null, 2));
} else {
  const icon = { blocker: "🔴", warn: "🟡", review: "🔎", info: "ℹ️ " };
  console.log(`\n${verdict}  —  ${channel}${result.recipient ? ` → ${result.recipient}` : ""}  (essai ${attempt})`);
  console.log(`${chars} caractères, ${paragraphs.length} paragraphe(s), langue ${draftLang ?? "?"}${threadLang ? ` / fil ${threadLang}` : ""}\n`);
  for (const f of findings) {
    console.log(`${icon[f.severity]} [${f.id}] ${f.message}`);
    if (f.detail) console.log(`    ${f.detail}`);
  }
  if (findings.length === 0) console.log("Rien à signaler côté mécanique. Passer au relecteur.");
  const next = {
    ABANDON:
      `\nEssai ${attempt}/${MAX_ATTEMPTS} : abandon. Ne rien envoyer sur ce fil ce run, consigner le motif et notifier David. Passer à l'opportunité suivante.`,
    REWRITE_FROM_SCRATCH:
      `\nRéécriture DEPUIS ZÉRO sous un autre angle (essai ${attempt + 1}/${MAX_ATTEMPTS}).` +
      (repeated.length > 0 ? ` Motif : ${repeated.join(", ")} déjà bloquant à l'essai précédent.` : "") +
      ` Le rédacteur repart du fil et du registre, sans le brouillon échoué sous les yeux.`,
    FAIL: `\nCorriger uniquement les points cités, puis relancer en essai ${attempt + 1}/${MAX_ATTEMPTS} avec previousFindingIds = ${JSON.stringify(result.findingIds)}.`,
    WARN: "\nRien de bloquant. Le relecteur tranche les points jaunes.",
    PASS: "",
  };
  console.log(next[verdict] ?? "");
}

// 0 = le message peut continuer vers le relecteur. 1 = il faut retravailler.
// 2 = abandon, ne rien envoyer sur ce fil ce run.
process.exitCode = verdict === "ABANDON" ? 2 : verdict === "PASS" || verdict === "WARN" ? 0 : 1;
