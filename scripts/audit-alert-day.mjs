/**
 * Croise, pour un jour donné, les réclamations posées et les alertes réellement
 * parties — sur LES TROIS journaux, un par cron.
 *
 * CE QUE LES VERSIONS PRÉCÉDENTES SE SONT FAIT AVOIR (27/08, à corriger aussi
 * dans check-alert-lock.mjs) :
 *
 * 1. TROIS JOURNAUX, PAS UN. `regional-alerts` écrit dans outbreak_alert_log,
 *    `watchlist-alerts` dans watchlist_alert_log, `disease-alerts` dans
 *    disease_alert_log. Comparer les réclamations des trois crons aux lignes
 *    d'un seul revient à compter des pommes en face de trois paniers. Le 27/08,
 *    « 219 verrous pour 218 envois » n'était pas un écart de 1 : c'était un
 *    rapprochement qui n'avait pas de sens, et l'unique « verrou sans envoi »
 *    qu'il désignait — watchlist-alerts à 10:30:33 — était un faux positif, son
 *    envoi étant journalisé dans une table que le script ne lisait pas.
 *
 * 2. CES JOURNAUX SONT DES ÉTATS, PAS DES HISTORIQUES. `outbreak_alert_log` a
 *    pour clé primaire (user_id, outbreak_id) : une seule ligne par couple, dont
 *    `sent_at` est écrasé à chaque nouvelle alerte. Une ligne ne s'ajoute pas,
 *    elle SE DÉPLACE dans le temps. D'où le mystère des « douze lignes disparues
 *    du 25/08 » : douze foyers de Georgetown ré-alertés le 27/08, dont la ligne a
 *    simplement changé de date. Conséquence à retenir : un décompte « X alertes
 *    le jour J » n'est juste que le jour même, et se dégrade tout seul ensuite.
 *
 * Les verrous, eux, sont immuables : une ligne par (user, foyer, jour), jamais
 * réécrite. C'est ce qui rend l'appariement fiable le jour même — et seulement
 * le jour même.
 *
 * LECTURE SEULE. Pagination explicite : PostgREST plafonne ses réponses, et un
 * plafond atteint en silence produirait le genre de compte faux que ce script
 * cherche.
 *
 * Usage : node scripts/audit-alert-day.mjs [--date=2026-08-27] [--days=5]
 */
import { readFileSync } from "fs";
import { createClient } from "@supabase/supabase-js";

const arg = (name, fallback) => {
  const a = process.argv.find((x) => x.startsWith(`--${name}=`));
  return a ? a.slice(name.length + 3) : fallback;
};

const DATE = arg("date", new Date().toISOString().slice(0, 10));
const DAYS = Number(arg("days", "5"));

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

const vars = parseEnv(".env.local.live");
const SUPABASE_URL = clean(vars["NEXT_PUBLIC_SUPABASE_URL"]);
if (!SUPABASE_URL.includes("tqznwmpkokdzrszysbcm")) {
  throw new Error("Refus : ceci ne ressemble pas au projet de production.");
}
const supabase = createClient(SUPABASE_URL, clean(vars["SUPABASE_SERVICE_ROLE_KEY"]), {
  auth: { autoRefreshToken: false, persistSession: false },
});

/** Le nom du cron dans outbreak_alert_daily_lock.source ⇄ son journal à lui. */
// `ts` : la colonne d'horodatage n'a pas le meme nom partout —
// watchlist_alert_log utilise alerted_at la ou les deux autres utilisent
// sent_at. Constate le 27/08 : interroger sent_at sur cette table renvoie
// « column does not exist », l'erreur est journalisee et le journal compte
// zero ligne, ce qui se lit exactement comme « ce cron n'a rien envoye ».
const JOURNALS = [
  { source: "regional-alerts", table: "outbreak_alert_log", ts: "sent_at" },
  { source: "watchlist-alerts", table: "watchlist_alert_log", ts: "alerted_at" },
  { source: "disease-alerts", table: "disease_alert_log", ts: "sent_at" },
];

const bar = (t) => console.log(`\n${"═".repeat(72)}\n${t}\n${"═".repeat(72)}`);
const short = (v) => String(v ?? "").slice(0, 8);
const hhmm = (iso) => (iso || "").slice(11, 19);
const key = (r) => `${r.user_id}|${r.outbreak_id}`;

async function readAll(table, columns, apply) {
  const out = [];
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    let q = supabase.from(table).select(columns).range(from, from + PAGE - 1);
    q = apply(q);
    const { data, error } = await q;
    if (error) {
      console.log(`⚠️  Lecture de ${table} : ${error.message}`);
      return out;
    }
    out.push(...(data ?? []));
    if ((data?.length ?? 0) < PAGE) return out;
  }
}

const dayStart = `${DATE}T00:00:00.000Z`;
const dayEnd = new Date(Date.parse(dayStart) + 86_400_000).toISOString();

// ── Lecture des trois journaux + des verrous ────────────────────────────────
const sentBySource = {};
for (const j of JOURNALS) {
  const rows = await readAll(j.table, `user_id, outbreak_id, ${j.ts}`, (q) =>
    q.gte(j.ts, dayStart).lt(j.ts, dayEnd).order(j.ts, { ascending: true }),
  );
  sentBySource[j.source] = rows.map((r) => ({ ...r, sent_at: r[j.ts] }));
}
const locks = await readAll("outbreak_alert_daily_lock", "user_id, outbreak_id, alert_date, source, claimed_at", (q) =>
  q.eq("alert_date", DATE).order("claimed_at", { ascending: true }),
);

const totalSent = Object.values(sentBySource).reduce((n, a) => n + a.length, 0);
console.log(`\nJour analysé : ${DATE}`);
console.log(`Réclamations : ${locks.length}`);
for (const j of JOURNALS) console.log(`  ${j.table.padEnd(22)} ${String(sentBySource[j.source].length).padStart(5)} ligne(s)`);
console.log(`  ${"TOTAL".padEnd(22)} ${String(totalSent).padStart(5)}`);

// ── 1. Réclamé, puis rien n'est parti — cron par cron ───────────────────────
bar("1. VERROUS SANS ENVOI — chaque cron comparé à SON journal");

let orphanTotal = 0;
for (const j of JOURNALS) {
  const sentKeys = new Set(sentBySource[j.source].map(key));
  const orphans = locks.filter((l) => l.source === j.source && !sentKeys.has(key(l)));
  const claimed = locks.filter((l) => l.source === j.source).length;
  if (orphans.length === 0) {
    console.log(`✅ ${j.source.padEnd(17)} ${claimed} réclamation(s), toutes suivies d'un envoi.`);
    continue;
  }
  orphanTotal += orphans.length;
  console.log(`🔴 ${j.source.padEnd(17)} ${orphans.length} réclamation(s) sur ${claimed} sans envoi dans ${j.table} :`);
  for (const l of orphans.slice(0, 15)) {
    console.log(`     ${hhmm(l.claimed_at)}   destinataire ${short(l.user_id)}…   foyer ${short(l.outbreak_id)}…`);
  }
  if (orphans.length > 15) console.log(`     … et ${orphans.length - 15} autre(s).`);
}
if (orphanTotal > 0) {
  console.log("\nCes destinataires n'ont rien reçu pour ce foyer : le verrou posé a fait");
  console.log("reculer les crons suivants et l'envoi qui devait le suivre n'a pas eu");
  console.log("lieu. Logs Vercel du cron nommé, à l'heure indiquée — le pendant");
  console.log("releaseOutbreakAlertDaily aurait dû relâcher.");
}

// ── 2. Parti sans verrou ────────────────────────────────────────────────────
bar("2. ENVOIS SANS VERROU — la déduplication a été contournée");

const lockKeys = new Set(locks.map(key));
for (const j of JOURNALS) {
  const orphans = sentBySource[j.source].filter((s) => !lockKeys.has(key(s)));
  if (orphans.length === 0) {
    console.log(`✅ ${j.source.padEnd(17)} tout envoi porte sa réclamation.`);
  } else {
    console.log(`⚠️  ${j.source.padEnd(17)} ${orphans.length} envoi(s) sans réclamation (verrou inévaluable, ou chemin qui ne réclame pas).`);
  }
}

// ── 3. Le doublon inter-crons, enfin visible ────────────────────────────────
bar("3. MÊME FOYER SERVI PAR PLUSIEURS CRONS AU MÊME DESTINATAIRE");
console.log("C'est ici, et nulle part ailleurs, que se voit la triple livraison que");
console.log("le verrou existe pour empêcher : le même couple présent le même jour");
console.log("dans deux ou trois journaux différents.\n");

const seenIn = {};
for (const j of JOURNALS) {
  for (const s of sentBySource[j.source]) (seenIn[key(s)] ??= []).push(j.source);
}
const multi = Object.entries(seenIn).filter(([, srcs]) => srcs.length > 1);
if (multi.length === 0) {
  console.log("✅ Aucun couple servi par plus d'un cron.");
} else {
  console.log(`🔴 ${multi.length} couple(s) servi(s) par plusieurs crons le même jour :\n`);
  for (const [k, srcs] of multi.slice(0, 20)) {
    const [u, o] = k.split("|");
    console.log(`destinataire ${short(u)}…   foyer ${short(o)}…   par ${srcs.join(" + ")}`);
  }
  if (multi.length > 20) console.log(`… et ${multi.length - 20} autre(s).`);
}

// ── 4. Historique — avec l'avertissement qui va avec ────────────────────────
bar(`4. HISTORIQUE JOUR PAR JOUR (${DAYS} j)`);
console.log("⚠️  À NE PAS LIRE COMME UN VOLUME D'ENVOIS. Ces journaux ont pour clé");
console.log("primaire (user_id, outbreak_id) : une ré-alerte écrase sent_at au lieu");
console.log("d'ajouter une ligne. Un jour passé ne montre donc que les couples QUE");
console.log("PERSONNE N'A RÉ-ALERTÉS DEPUIS — un plancher qui baisse tout seul avec");
console.log("le temps, jamais le volume réel de ce jour-là. Seule la ligne du jour");
console.log("même est exacte.\n");

const since = new Date(Date.parse(dayEnd) - DAYS * 86_400_000).toISOString();
const perDay = {};
for (const j of JOURNALS) {
  const rows = await readAll(j.table, `user_id, ${j.ts}`, (q) => q.gte(j.ts, since).lt(j.ts, dayEnd));
  for (const s of rows) {
    const d = (s[j.ts] || "").slice(0, 10);
    (perDay[d] ??= { sent: 0, users: new Set(), locks: 0 }).sent++;
    perDay[d].users.add(s.user_id);
  }
}
const lockWindow = await readAll("outbreak_alert_daily_lock", "user_id, alert_date", (q) =>
  q.gte("alert_date", since.slice(0, 10)).lt("alert_date", dayEnd.slice(0, 10)),
);
for (const l of lockWindow) (perDay[l.alert_date] ??= { sent: 0, users: new Set(), locks: 0 }).locks++;

console.log("jour         lignes   destinataires   verrous");
for (const d of Object.keys(perDay).sort()) {
  const { sent: S, users, locks: L } = perDay[d];
  console.log(`${d}  ${String(S).padStart(7)}  ${String(users.size).padStart(14)}  ${String(L).padStart(8)}${S > 0 && L === 0 ? "  ← muet" : ""}`);
}

// ── 5. Qui a été servi ──────────────────────────────────────────────────────
bar(`5. DESTINATAIRES DU ${DATE} — combien de foyers chacun, tous crons confondus`);
console.log("Un foyer ≠ un e-mail : regional-alerts et disease-alerts groupent en");
console.log("digest (MAX_DIGEST_ITEMS_PER_EMAIL = 10 affichés, le reste résumé), alors");
console.log("que watchlist-alerts envoie un message par entrée. Le nombre de messages");
console.log("réellement reçus se lit chez Brevo, adresse par adresse.\n");

const perUser = {};
for (const j of JOURNALS) for (const s of sentBySource[j.source]) (perUser[s.user_id] ??= new Set()).add(s.outbreak_id);

const userIds = Object.keys(perUser);
const emails = {};
if (userIds.length > 0) {
  const { data: profiles, error: profErr } = await supabase.from("profiles").select("id, email").in("id", userIds);
  if (profErr) console.log(`⚠️  Lecture des profils : ${profErr.message}`);
  for (const p of profiles ?? []) emails[p.id] = p.email;
}

console.log("foyers   adresse");
for (const [uid, set] of Object.entries(perUser).sort((a, b) => b[1].size - a[1].size)) {
  console.log(`${String(set.size).padStart(6)}   ${emails[uid] ?? `⚠️  profil introuvable (${short(uid)}…)`}`);
}

console.log("\nPour convertir en messages réellement reçus :");
console.log("  node scripts/check-brevo-delivery.mjs <adresse>\n");
