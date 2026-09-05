/**
 * Le verrou de déduplication peut-il ÊTRE POSÉ, maintenant ?
 *
 * POURQUOI CE SCRIPT EN PLUS DE check-alert-lock.mjs. Celui-ci ne prouve que
 * deux choses : que PostgREST voit la table (une LECTURE à zéro ligne), et que
 * des réclamations ont été posées les jours passés. Ni l'un ni l'autre ne dit
 * qu'une réclamation POURRAIT être posée au prochain passage des crons — or
 * c'est exactement la question ouverte après le rechargement du cache du
 * 26/08, et l'attendre coûte une journée d'alertes en double si la réponse
 * est non.
 *
 * `claimOutbreakAlertDaily` ne fait pas un select : il fait un UPSERT avec
 * `onConflict: "user_id,outbreak_id,alert_date"`. Une table lisible dont
 * l'index unique correspondant manquerait ferait échouer cet upsert (42P10)
 * en laissant la lecture parfaitement saine — verrou muet, table visible.
 * Ce script rejoue donc le helper à l'identique, sur une date sentinelle.
 *
 * PORTÉE DE L'ÉCRITURE. Une ligne est réellement insérée en production, avec
 * `alert_date = 1970-01-01` et `source = probe-alert-lock`, puis supprimée
 * dans la foulée. Aucun cron ne consulte cette date : la sonde ne peut ni
 * bloquer ni déclencher un envoi réel. En cas d'interruption, la ligne
 * résiduelle se retrouve par sa date et sa source, et le prochain passage du
 * script la nettoie avant de commencer.
 *
 * Usage : node scripts/probe-alert-lock.mjs [--days=3]
 */
import { readFileSync } from "fs";
import { createClient } from "@supabase/supabase-js";

const daysArg = process.argv.find((a) => a.startsWith("--days="));
const DAYS = daysArg ? Number(daysArg.slice("--days=".length)) : 3;

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

const PROBE_DATE = "1970-01-01";
const PROBE_SOURCE = "probe-alert-lock";
const bar = (t) => console.log(`\n${"═".repeat(70)}\n${t}\n${"═".repeat(70)}`);
const hhmm = (iso) => (iso || "").slice(11, 19);

// ── 1. À QUELLE HEURE les alertes sont-elles parties, et les verrous posés ? ──
bar(`1. HORODATAGE DES ENVOIS ET DES RÉCLAMATIONS (${DAYS} j)`);

const since = new Date(Date.now() - DAYS * 86_400_000).toISOString();

const { data: sent, error: sentErr } = await supabase
  .from("outbreak_alert_log")
  .select("user_id, outbreak_id, sent_at")
  .gte("sent_at", since)
  .order("sent_at", { ascending: true });

const { data: locks, error: lockErr } = await supabase
  .from("outbreak_alert_daily_lock")
  .select("user_id, outbreak_id, alert_date, source, claimed_at")
  .gte("claimed_at", since)
  .order("claimed_at", { ascending: true });

if (sentErr) console.log(`⚠️  Lecture des envois : ${sentErr.message}`);
if (lockErr) console.log(`⚠️  Lecture des verrous : ${lockErr.message}`);

const byDay = {};
for (const s of sent ?? []) {
  const d = (s.sent_at || "").slice(0, 10);
  (byDay[d] ??= { sent: [], locks: [] }).sent.push(s.sent_at);
}
for (const l of locks ?? []) {
  const d = (l.claimed_at || "").slice(0, 10);
  (byDay[d] ??= { sent: [], locks: [] }).locks.push(l.claimed_at);
}

const days = Object.keys(byDay).sort();
if (days.length === 0) {
  console.log("Aucun envoi ni verrou sur la période.");
} else {
  console.log("jour         envois  première→dernière (UTC)   verrous  première→dernière");
  for (const d of days) {
    const { sent: S, locks: L } = byDay[d];
    const span = (a) => (a.length ? `${hhmm(a[0])}→${hhmm(a[a.length - 1])}` : "        —        ");
    console.log(
      `${d}  ${String(S.length).padStart(6)}  ${span(S).padEnd(24)} ${String(L.length).padStart(7)}  ${span(L)}`,
    );
  }
  console.log(
    "\nÀ lire ainsi : un jour sans verrou n'est un défaut ACTIF que si ses envois\n" +
      "sont postérieurs au rechargement du cache PostgREST (26/08). Les envois\n" +
      "antérieurs relèvent de l'incident déjà clos, pas d'une panne en cours.",
  );
}

// ── 2. UNE RÉCLAMATION PEUT-ELLE ÊTRE POSÉE MAINTENANT ? ─────────────────────
bar("2. SONDE D'ÉCRITURE — rejoue claimOutbreakAlertDaily à l'identique");

const { data: pair, error: pairErr } = await supabase
  .from("outbreak_alert_log")
  .select("user_id, outbreak_id")
  .limit(1);

if (pairErr || !pair?.length) {
  console.log(`🔴 Impossible de trouver un couple (user, foyer) existant : ${pairErr?.message ?? "table vide"}`);
  console.log("   Sans couple réel, un test d'écriture buterait sur les clés étrangères.\n");
  process.exit(1);
}
const { user_id, outbreak_id } = pair[0];
console.log(`Couple utilisé : user ${String(user_id).slice(0, 8)}… / foyer ${String(outbreak_id).slice(0, 8)}…`);
console.log(`Date sentinelle : ${PROBE_DATE}   source : ${PROBE_SOURCE}`);

// Nettoyage préalable — au cas où une exécution précédente aurait été coupée.
await supabase
  .from("outbreak_alert_daily_lock")
  .delete()
  .eq("alert_date", PROBE_DATE)
  .eq("source", PROBE_SOURCE);

const claim = async () => {
  const { data, error } = await supabase
    .from("outbreak_alert_daily_lock")
    .upsert(
      { user_id, outbreak_id, alert_date: PROBE_DATE, source: PROBE_SOURCE },
      { onConflict: "user_id,outbreak_id,alert_date", ignoreDuplicates: true },
    )
    .select("user_id");
  if (error) return { state: "unevaluable", error: error.message, code: error.code };
  return { state: (data?.length ?? 0) > 0 ? "granted" : "taken" };
};

const first = await claim();
const second = first.state === "unevaluable" ? null : await claim();

// Nettoyage — quoi qu'il arrive.
const { error: cleanupErr } = await supabase
  .from("outbreak_alert_daily_lock")
  .delete()
  .eq("alert_date", PROBE_DATE)
  .eq("source", PROBE_SOURCE);

console.log(`\n1ʳᵉ réclamation : ${first.state}${first.error ? `  ← ${first.code ?? ""} ${first.error}` : ""}`);
if (second) console.log(`2ᵈᵉ réclamation : ${second.state}${second.error ? `  ← ${second.error}` : ""}`);
console.log(`Nettoyage      : ${cleanupErr ? `🔴 ÉCHEC — ${cleanupErr.message}` : "✅ ligne sentinelle supprimée"}`);

console.log(`\n${"─".repeat(70)}`);
let code = 0;
if (first.state === "unevaluable") {
  console.log("🔴 LE VERROU EST TOUJOURS MUET. L'upsert échoue par le chemin REST :");
  console.log(`   ${first.code ?? ""} ${first.error}`);
  console.log("   Les trois crons d'alerte enverront donc sans déduplication au");
  console.log("   prochain passage. Le message ci-dessus nomme la cause — un code");
  console.log("   PGRST205 renvoie au cache de schéma, un 42P10 à l'index unique");
  console.log("   (user_id, outbreak_id, alert_date) qui manquerait.");
  code = 1;
} else if (first.state === "granted" && second?.state === "taken") {
  console.log("✅ LE VERROU FONCTIONNE. Première réclamation accordée, seconde");
  console.log("   refusée : l'index unique joue son rôle et le cron le plus large");
  console.log("   se retirera bien derrière le plus spécifique.");
} else {
  console.log(`⚠️  Résultat inattendu (${first.state} / ${second?.state}).`);
  console.log("   Une première réclamation 'taken' signifie qu'une ligne sentinelle");
  console.log("   subsistait malgré le nettoyage préalable — à regarder de près.");
  code = 1;
}
if (cleanupErr) {
  console.log(`\n⚠️  La ligne sentinelle (${PROBE_DATE} / ${PROBE_SOURCE}) est restée en base.`);
  code = 1;
}
console.log("");
process.exit(code);
