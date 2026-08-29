// Régression du contrôle mécanique des messages sortants.
//
// Lancer : npm run qa:check:test
//
// Ce fichier couvre le piège des frontières de mot ASCII, qui a bloqué à tort
// un commentaire vouvoyé le 2026-08-29 (run 17 h de
// linkedin-hwg-followup-check-2) : /\btes\b/ trouve « tes » dans « hôtes »,
// donc le post relu était classé « tutoiement ». Le même piège joue dans
// l'autre sens : /\bimpacté\b/ ne trouve jamais « impacté », et
// /\bà la date\b/ ne trouve jamais « à la date ».

import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { uwb, detectRegister } from "./outreach-text.mjs";

const scriptsDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(scriptsDir, "..");
const lexicon = JSON.parse(readFileSync(join(repoRoot, "marketing/qa/lexicon.json"), "utf-8"));

// Extrait réel du post LinkedIn du 2026-08-29, celui qui a déclenché l'incident.
const POST_2026_08_29 =
  "Le risque dépend de plusieurs facteurs qui doivent tous être réunis : vecteurs présents, " +
  "compétence vectorielle, saisonnalité, climat, vents, hôtes et virus circulant autour de l'Europe. " +
  "Les données de surveillance publiées permettent de suivre chacun de ces facteurs.";

// ── detectRegister : un accent n'est pas une frontière de mot ────────────────

test("« hôtes » ne compte pas pour du tutoiement", () => {
  assert.notEqual(detectRegister(POST_2026_08_29), "tutoiement");
  assert.equal(detectRegister(POST_2026_08_29), null, "aucun marqueur de registre dans ce texte");
});

test("les mots accentués qui contiennent un marqueur ASCII restent neutres", () => {
  const neutres = [
    "les hôtes intermédiaires",
    "les côtes du Kerala",
    "un bâton de berger",
    "des arrêtes de poisson",
    "la fenêtre de notification",
  ];
  for (const texte of neutres) assert.equal(detectRegister(texte), null, `« ${texte} »`);
});

test("un vrai tutoiement est bien détecté", () => {
  assert.equal(detectRegister("Tu as vu passer le bulletin ? Dis-moi ce que tu en penses."), "tutoiement");
  assert.equal(detectRegister("C'est toi qui suivais ce dossier, si je me souviens bien."), "tutoiement");
  assert.equal(detectRegister("Ton équipe a publié quelque chose là-dessus ?"), "tutoiement");
  assert.equal(detectRegister("t'as le lien du sitrep ?"), "tutoiement");
  assert.equal(detectRegister("tu t'arrêtes où dans la série ?"), "tutoiement");
});

test("un vrai vouvoiement est bien détecté, même noyé dans des mots accentués", () => {
  assert.equal(
    detectRegister("Merci pour votre message. Les hôtes et les côtes citées dans votre post m'intéressent."),
    "vouvoiement"
  );
});

// ── uwb : la frontière, dans les deux sens ───────────────────────────────────

test("uwb ne coupe pas à l'intérieur d'un mot accentué", () => {
  assert.equal(/\btes\b/i.test("hôtes"), true, "le piège ASCII est bien là, c'est ce qu'on corrige");
  assert.equal(uwb("\\btes\\b", "i").test("hôtes"), false);
  assert.equal(uwb("\\btes\\b", "i").test("tes hôtes"), true);
  assert.equal(uwb("\\bactive\\b", "i").test("une surveillance réactive"), false);
  assert.equal(uwb("\\bactive\\b", "i").test("flambée active"), true);
  assert.equal(uwb("\\bessai\\b", "i").test("un réessai plus tard"), false);
  assert.equal(uwb("\\bessai\\b", "i").test("l'essai de 14 jours"), true);
});

test("uwb déclenche les motifs qui commencent ou finissent par un accent", () => {
  assert.equal(/\bà la date\b/i.test("le chiffre à la date du 12 août"), false, "le piège ASCII est bien là");
  assert.equal(uwb("\\bà la date\\b", "i").test("le chiffre à la date du 12 août"), true);
  assert.equal(/\bimpacté\b/i.test("le district impacté"), false, "le piège ASCII est bien là");
  assert.equal(uwb("\\bimpacté\\b", "i").test("le district impacté"), true);
});

test("uwb laisse tranquille un antislash littéral", () => {
  assert.equal(uwb("x\\\\by").test("x\\by"), true);
});

// ── Le lexique passe par la même compilation ─────────────────────────────────

const lexiconHits = (text) =>
  [...lexicon.banned, ...lexicon.confusables].filter((e) => uwb(e.pattern, "gi").test(text)).map((e) => e.pattern);

test("tous les motifs du lexique compilent sous drapeau u", () => {
  for (const entry of [...lexicon.banned, ...lexicon.confusables]) {
    assert.doesNotThrow(() => uwb(entry.pattern, "gi"), entry.pattern);
  }
  for (const p of lexicon.cta_markers) {
    assert.doesNotThrow(() => uwb(p, "i"), p);
  }
});

test("les interdits accentués du lexique se déclenchent enfin", () => {
  assert.deepEqual(lexiconHits("les districts impactés par la flambée"), ["\\bimpact(er|ée?s?)\\b"]);
  assert.deepEqual(lexiconHits("une zone impactée"), ["\\bimpact(er|ée?s?)\\b"]);
  assert.deepEqual(lexiconHits("la maladie a été éradiquée"), ["\\b[ée]radiqu(é|er|ée)s?\\b"]);
  assert.deepEqual(lexiconHits("leader du marché de la veille sanitaire"), ["\\bleader (du|de la|des) march[ée]s?\\b"]);
  assert.deepEqual(lexiconHits("un taux de mortalité de 2 %"), ["\\btaux de mortalit[ée]s?\\b"]);
});

test("le post du 29/08 ne déclenche aucun interdit du lexique", () => {
  assert.deepEqual(lexiconHits(POST_2026_08_29), []);
});

// ── Bout en bout : le script réel, sur un couple brouillon / contexte ────────

const runChecker = ({ draft, thread, context = {} }) => {
  const dir = mkdtempSync(join(tmpdir(), "hwg-qa-"));
  const draftPath = join(dir, "draft.md");
  const threadPath = join(dir, "thread.txt");
  const ctxPath = join(dir, "ctx.json");
  writeFileSync(draftPath, draft, "utf-8");
  writeFileSync(threadPath, thread, "utf-8");
  writeFileSync(ctxPath, JSON.stringify({ channel: "linkedin-comment", threadFile: threadPath, ...context }), "utf-8");
  const res = spawnSync(
    process.execPath,
    [join(scriptsDir, "check-outreach-message.mjs"), "--draft", draftPath, "--context", ctxPath, "--json"],
    { cwd: repoRoot, encoding: "utf-8" }
  );
  assert.equal(res.error, undefined);
  assert.ok(res.stdout.trim().startsWith("{"), `sortie inattendue : ${res.stdout}\n${res.stderr}`);
  return JSON.parse(res.stdout);
};

// Brouillon vouvoyé, sans chiffre ni CTA : les seuls blocages possibles viennent
// des registres de faits, jamais du registre de langue.
const BROUILLON_VOUVOIEMENT =
  "Merci pour ce point sur la compétence vectorielle : c'est ce qui manque dans la plupart des " +
  "synthèses, qui s'arrêtent à la présence du vecteur. Vous citez aussi les hôtes, et c'est le " +
  "facteur que les bulletins documentent le moins bien.";

test("bout en bout : un fil bourré de mots accentués ne bloque plus un brouillon vouvoyé", () => {
  const out = runChecker({ draft: BROUILLON_VOUVOIEMENT, thread: POST_2026_08_29 });
  assert.deepEqual(
    out.findings.filter((f) => f.id === "context.register"),
    [],
    "aucun blocage de registre attendu sur ce couple"
  );
  assert.equal(out.draftLang, "fr");
});

test("bout en bout : un fil réellement tutoyé bloque toujours un brouillon vouvoyé", () => {
  const out = runChecker({
    draft: BROUILLON_VOUVOIEMENT,
    thread:
      "Dis-moi si tu veux qu'on en reparle, je pense que toi tu as déjà vu ce genre de courbe passer " +
      "dans ton service. Tu me diras ce que tu en penses quand tu auras le temps.",
  });
  const registre = out.findings.filter((f) => f.id === "context.register");
  assert.equal(registre.length, 1, JSON.stringify(out.findings, null, 1));
  assert.equal(registre[0].severity, "blocker");
  assert.match(registre[0].detail, /fil = tutoiement, brouillon = vouvoiement/);
});
