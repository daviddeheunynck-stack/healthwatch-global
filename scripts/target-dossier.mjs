#!/usr/bin/env node
// LECTURE SEULE. Prepare les sept approches institutionnelles.
//
// Objectif fixe le 25/08/2026 : 500 EUR/mois, soit 5 contrats Team. Sept
// organisations sont deja inscrites sans avoir jamais recu de proposition. Ce
// script rassemble, pour chacune, ce que la base sait d'elle — et l'argument
// qu'on peut lui opposer : les foyers que HWG avait AVANT la publication du DON
// de l'OMS, dans les regions qu'elle suit.
//
// Le delta de detection est la seule chose que personne d'autre ne peut montrer.
// Il vient de deux colonnes posees a l'ingestion (migration 20260625000000) :
//   first_seen_at        date de publication de la PREMIERE source (ECDC/PAHO)
//   who_don_published_at date de l'article DON de l'OMS, enregistree la premiere
//                        fois que sync-outbreaks rapproche la ligne
// delta = who_don_published_at - first_seen_at, en jours d'avance.
//
// Usage :
//   node scripts/target-dossier.mjs                  liste les comptes, cibles d'abord
//   node scripts/target-dossier.mjs anss-guinee.org  dossier complet pour un domaine
//   node scripts/target-dossier.mjs nom@org.org      dossier complet pour une adresse

import { readFileSync } from "fs";

const env = readFileSync(".env.local.live", "utf-8");
function getEnv(key) {
  const m = env.match(new RegExp(`^${key}=(.*)$`, "m"));
  if (!m) return "";
  return m[1].replace(/^﻿/, "").replace(/[\r\n]+$/, "").trim().replace(/^"(.*)"$/, "$1");
}

const SUPABASE_URL = getEnv("NEXT_PUBLIC_SUPABASE_URL");
const SERVICE_KEY = getEnv("SUPABASE_SERVICE_ROLE_KEY");
if (!SUPABASE_URL.includes("tqznwmpkokdzrszysbcm")) {
  throw new Error("Refus : ce projet ne ressemble pas a la production.");
}
const headers = { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` };

async function fetchAll(table, select, query = "") {
  const PAGE = 1000;
  const rows = [];
  for (let offset = 0; ; offset += PAGE) {
    const url = `${SUPABASE_URL}/rest/v1/${table}?select=${select}${query}&limit=${PAGE}&offset=${offset}`;
    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error(`GET ${table} : ${res.status} ${(await res.text()).slice(0, 160)}`);
    const page = await res.json();
    rows.push(...page);
    if (page.length < PAGE) return rows;
  }
}

// Comptes de test et adresses personnelles — memes conventions que
// scripts/daily-marketing-check.mjs, pour ne pas les compter comme des cibles.
const EXCLUS = new Set([
  "david.deheunynck@gmail.com", "david.deheunynck@yahoo.fr",
  "e2e@healthwatch-global.com", "davy_skye@yahoo.fr",
  "clarence_skye@yahoo.fr", "r.endangrukmanams@gmail.com", "elyan.delaunay@proton.me",
  "mobile-nox-test@healthwatch-global.com",
]);
const MOTIFS_EXCLUS = [/@healthwatch-test\.dev$/i, /^claude-(repro|verify)-/i];
const estExclu = (e) => !e || EXCLUS.has(e) || MOTIFS_EXCLUS.some((re) => re.test(e));

// Une adresse grand public ne dit rien de l'organisation — mais ne l'elimine pas :
// la conversion MSF/Epicentre du mois d'aout est arrivee sur une adresse gmail.
const GRAND_PUBLIC = /@(gmail|yahoo|hotmail|outlook|live|icloud|proton|protonmail|gmx|orange|free|wanadoo)\./i;

const arg = (process.argv[2] ?? "").toLowerCase();

const [users, profils, evenements, regions, alertes, foyers] = await Promise.all([
  fetch(`${SUPABASE_URL}/auth/v1/admin/users?per_page=200`, { headers })
    .then((r) => r.json()).then((d) => d.users ?? []),
  fetchAll("profiles", "id,email,plan,trial_ends_at,email_blocked_at,is_pilot"),
  fetchAll("product_events", "user_id,action,created_at"),
  fetchAll("user_alert_regions", "user_id,region,min_risk"),
  fetchAll("outbreak_alert_log", "user_id,outbreak_id,sent_at"),
  fetchAll("outbreaks", "id,disease,disease_en,country,country_en,region,date,cases,deaths,risk_level,source,first_seen_at,who_don_published_at,is_pheic"),
]);

const foyerParId = new Map(foyers.map((o) => [o.id, o]));
const profilParId = new Map(profils.map((p) => [p.id, p]));
const jours = (iso) => (iso ? Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000) : null);
const d10 = (v) => (v ? String(v).slice(0, 10) : "—");

// ── Avance de detection : le seul argument que personne d'autre ne peut sortir ──
const avances = foyers
  .filter((o) => o.first_seen_at && o.who_don_published_at)
  .map((o) => ({ ...o, delta: Math.round((new Date(o.who_don_published_at) - new Date(o.first_seen_at)) / 86_400_000) }))
  .filter((o) => o.delta > 0)
  .sort((a, b) => b.delta - a.delta);

function ficheAvances(regionsCibles, max = 6) {
  const sel = regionsCibles?.length
    ? avances.filter((o) => regionsCibles.includes(o.region))
    : avances;
  if (!sel.length) return ["  (aucun delta enregistre pour ces regions)"];
  return sel.slice(0, max).map((o) =>
    `  ${String(o.delta).padStart(3)} j d'avance · ${o.disease_en ?? o.disease} / ${o.country_en ?? o.country}` +
    ` · premiere source ${d10(o.first_seen_at)} → DON OMS ${d10(o.who_don_published_at)}`);
}

// ── Mode liste ────────────────────────────────────────────────────────────────
if (!arg) {
  const lignes = users
    .filter((u) => !estExclu(u.email))
    .map((u) => {
      const p = profilParId.get(u.id);
      const ev = evenements.filter((e) => e.user_id === u.id).length;
      const al = alertes.filter((a) => a.user_id === u.id).length;
      const dom = (u.email ?? "").split("@")[1] ?? "?";
      return {
        email: u.email, dom, institutionnel: !GRAND_PUBLIC.test(u.email ?? ""),
        plan: p?.plan ?? "?", bloque: !!p?.email_blocked_at,
        inscrit: d10(u.created_at), ev, al,
        silence: jours(evenements.filter((e) => e.user_id === u.id).map((e) => e.created_at).sort().pop()),
      };
    })
    .sort((a, b) => (b.institutionnel - a.institutionnel) || (b.ev - a.ev));

  console.log(`\n${lignes.length} comptes reels (hors comptes de test)\n`);
  console.log("adresse                              | plan     | inscrit    | evts | alertes | bloque | dernier usage");
  console.log("-------------------------------------|----------|------------|------|---------|--------|---------------");
  for (const l of lignes) {
    const marque = l.institutionnel ? "◆ " : "  ";
    const usage = l.silence === null ? "jamais" : l.silence === 0 ? "aujourd'hui" : `il y a ${l.silence} j`;
    console.log(
      `${marque}${(l.email ?? "").padEnd(34).slice(0, 34)} | ${l.plan.padEnd(8)} | ${l.inscrit} | ${String(l.ev).padStart(4)} | ${String(l.al).padStart(7)} | ${(l.bloque ? "OUI" : "non").padEnd(6)} | ${usage}`,
    );
  }
  console.log("\n◆ = domaine d'organisation. Une adresse grand public peut aussi etre une cible");
  console.log("  (la conversion MSF/Epicentre d'aout est arrivee sur une adresse gmail).");
  console.log(`\nAvance de detection enregistree sur ${avances.length} foyers, toutes regions :`);
  ficheAvances(null, 8).forEach((l) => console.log(l));
  console.log("\nDossier complet :  node scripts/target-dossier.mjs <domaine|adresse>\n");
  process.exit(0);
}

// ── Mode dossier ──────────────────────────────────────────────────────────────
const cibles = users.filter((u) => (u.email ?? "").toLowerCase().includes(arg) && !estExclu(u.email));
if (!cibles.length) {
  console.log(`Aucun compte ne correspond a "${arg}".`);
  process.exit(1);
}

for (const u of cibles) {
  const p = profilParId.get(u.id);
  const ev = evenements.filter((e) => e.user_id === u.id).sort((a, b) => a.created_at.localeCompare(b.created_at));
  const reg = regions.filter((r) => r.user_id === u.id).map((r) => r.region);
  const al = alertes.filter((a) => a.user_id === u.id).sort((a, b) => (b.sent_at ?? "").localeCompare(a.sent_at ?? ""));

  console.log("\n" + "═".repeat(78));
  console.log(`  ${u.email}`);
  console.log("═".repeat(78));
  console.log(`  Inscrit le      : ${d10(u.created_at)}`);
  console.log(`  Plan            : ${p?.plan ?? "?"}${p?.is_pilot ? " (pilote)" : ""}` +
              (p?.trial_ends_at ? ` · essai jusqu'au ${d10(p.trial_ends_at)}` : ""));
  console.log(`  Adresse bloquee : ${p?.email_blocked_at ? `OUI depuis le ${d10(p.email_blocked_at)} — ecrire depuis une autre boite` : "non"}`);
  console.log(`  Regions suivies : ${reg.length ? reg.join(", ") : "aucune"}`);

  console.log(`\n  Usage produit (${ev.length} evenements)`);
  if (!ev.length) console.log("    aucun — n'a jamais rien ouvert");
  else {
    const parAction = ev.reduce((m, e) => m.set(e.action, (m.get(e.action) ?? 0) + 1), new Map());
    for (const [action, n] of [...parAction].sort((a, b) => b[1] - a[1])) console.log(`    ${String(n).padStart(3)} × ${action}`);
    console.log(`    premier : ${d10(ev[0].created_at)} · dernier : ${d10(ev[ev.length - 1].created_at)}`);
  }

  console.log(`\n  Alertes recues (${al.length} couples utilisateur/foyer)`);
  if (!al.length) console.log("    aucune");
  else {
    for (const a of al.slice(0, 8)) {
      const o = foyerParId.get(a.outbreak_id);
      console.log(`    ${d10(a.sent_at)} · ${o ? `${o.disease_en ?? o.disease} / ${o.country_en ?? o.country}` : a.outbreak_id}`);
    }
    if (al.length > 8) console.log(`    … et ${al.length - 8} autres`);
  }

  console.log("\n  Avance de detection dans SES regions — l'argument a lui opposer");
  ficheAvances(reg).forEach((l) => console.log(l));

  console.log("\n  A verifier a la main avant d'ecrire : qui est cette personne dans son");
  console.log("  organisation, et ce que cette organisation surveille reellement.");
  console.log("  La base ne le sait pas, et c'est ce qui fait la difference entre une");
  console.log("  lettre travaillee et un publipostage.\n");
}
