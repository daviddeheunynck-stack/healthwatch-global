#!/usr/bin/env node
// LECTURE SEULE. Qui recoit les alertes, en quelle quantite, et est-ce que ce
// sont ceux-la qui sont partis ?
//
// Contexte (25/08/2026) : retention-check a montre que la boucle n'est pas
// muette — elle est deversante. 2 091 couples (utilisateur, foyer) touches par
// outbreak_alert_log en 30 jours pour 39 comptes, pendant que disease_alert_log
// n'a rien produit depuis 19 jours. L'hypothese "personne ne recoit rien" est
// morte ; celle qu'il faut tester est l'inverse.
//
// Le depot documente deja ce mode de defaillance, deux fois :
//   - regional-alerts, en-tete : "un seul nouvel inscrit correspondait a chaque
//     foyer que la synchronisation venait de toucher sur les 5 regions — jusqu'a
//     97 e-mails distincts en un run pour une seule boite", et "cela correspond
//     aux deux seuls vrais utilisateurs d'essai qui se sont desabonnes, l'un
//     dans les 36 h suivant son provisionnement, avant meme sa premiere
//     connexion".
//   - lib/brevo-blocklist.ts : deux utilisateurs d'essai bloques avaient plus de
//     100 lignes revendiquant une livraison qui n'a jamais eu lieu.
//
// Ce script croise donc trois choses par compte : combien de couples alertes,
// est-ce que l'adresse est bloquee, et quand ce compte a utilise le produit pour
// la derniere fois. Si les plus arroses sont les plus silencieux, le probleme de
// retention n'est pas un manque de sollicitation.
//
// Rappel de lecture : une ligne d'outbreak_alert_log est un couple
// (utilisateur, foyer), pas un envoi — regional-alerts regroupe en un digest par
// utilisateur et par run depuis le 02/08. Le nombre de couples mesure l'ampleur
// de ce qui est pousse, pas le nombre de messages.
//
// Usage :  node scripts/alert-pressure.mjs

import { readFileSync } from "fs";

const env = readFileSync(".env.local.live", "utf-8");
function getEnv(key) {
  const m = env.match(new RegExp(`^${key}=(.*)$`, "m"));
  if (!m) return "";
  return m[1].replace(/^﻿/, "").replace(/[\r\n]+$/, "").trim().replace(/^"(.*)"$/, "$1");
}

const SUPABASE_URL = getEnv("NEXT_PUBLIC_SUPABASE_URL");
const SERVICE_KEY = getEnv("SUPABASE_SERVICE_ROLE_KEY");
console.log("Projet cible :", SUPABASE_URL);
if (!SUPABASE_URL.includes("tqznwmpkokdzrszysbcm")) {
  throw new Error("Refus : ce projet ne ressemble pas a la production.");
}

const headers = { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` };
const DAYS = 30;
const since = new Date(Date.now() - DAYS * 86_400_000).toISOString();

// PostgREST plafonne les reponses : on pagine explicitement plutot que de
// tronquer en silence (une troncature ici sous-estimerait la pression, soit
// exactement l'erreur qu'on cherche a eviter).
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

const couples = await fetchAll("outbreak_alert_log", "user_id,sent_at", `&sent_at=gte.${since}`);
const profils = await fetchAll("profiles", "id,email,plan,email_blocked_at,created_at");
const evenements = await fetchAll("product_events", "user_id,created_at");

const parUtilisateur = new Map();
for (const c of couples) {
  const e = parUtilisateur.get(c.user_id) ?? { couples: 0, dernier: null };
  e.couples += 1;
  if (!e.dernier || c.sent_at > e.dernier) e.dernier = c.sent_at;
  parUtilisateur.set(c.user_id, e);
}

const dernierUsage = new Map();
for (const e of evenements) {
  const d = dernierUsage.get(e.user_id);
  if (!d || e.created_at > d) dernierUsage.set(e.user_id, e.created_at);
}

const profilParId = new Map(profils.map((p) => [p.id, p]));
const masque = (email) => {
  if (!email) return "(sans adresse)";
  const [nom, domaine] = email.split("@");
  return `${nom.slice(0, 3)}***@${domaine ?? "?"}`;
};
const jours = (iso) => (iso ? Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000) : null);

const lignes = [...parUtilisateur.entries()]
  .map(([id, e]) => {
    const p = profilParId.get(id);
    return {
      email: masque(p?.email),
      plan: p?.plan ?? "?",
      bloque: !!p?.email_blocked_at,
      couples: e.couples,
      silence: jours(dernierUsage.get(id)),
    };
  })
  .sort((a, b) => b.couples - a.couples);

console.log(`\nPression d'alerte par compte — ${DAYS} jours`);
console.log(`${couples.length} couples (utilisateur, foyer) repartis sur ${lignes.length} comptes\n`);
console.log("adresse                  | plan     | couples | bloque | dernier usage");
console.log("-------------------------|----------|---------|--------|----------------");
for (const l of lignes.slice(0, 20)) {
  const usage = l.silence === null ? "jamais" : l.silence === 0 ? "aujourd'hui" : `il y a ${l.silence} j`;
  console.log(
    `${l.email.padEnd(24)} | ${l.plan.padEnd(8)} | ${String(l.couples).padStart(7)} | ${(l.bloque ? "OUI" : "non").padEnd(6)} | ${usage}`,
  );
}
if (lignes.length > 20) console.log(`… et ${lignes.length - 20} autres comptes`);

const bloques = profils.filter((p) => p.email_blocked_at);
const arroses = lignes.filter((l) => l.couples >= 50);
const arrosesSilencieux = arroses.filter((l) => l.silence === null || l.silence >= 7);

console.log("\nSynthese");
console.log(`  comptes en base                       : ${profils.length}`);
console.log(`  comptes alertes sur la fenetre        : ${lignes.length}`);
console.log(`  adresses bloquees (Brevo)             : ${bloques.length}`);
if (bloques.length) {
  for (const p of bloques) console.log(`      ${masque(p.email)} — bloquee le ${String(p.email_blocked_at).slice(0, 10)}`);
}
console.log(`  comptes a 50+ couples alertes         : ${arroses.length}`);
console.log(`  dont sans usage depuis 7 j ou jamais  : ${arrosesSilencieux.length}`);

console.log("\nLecture");
if (arroses.length && arrosesSilencieux.length / arroses.length >= 0.7) {
  console.log("  Les comptes les plus arroses sont aussi les plus silencieux. La sollicitation");
  console.log("  n'est pas ce qui manque — c'est probablement ce qui a fait fuir. Le levier est");
  console.log("  de reduire et cibler, pas d'envoyer davantage.");
} else if (arroses.length) {
  console.log("  Les comptes tres alertes ne sont pas particulierement silencieux : le volume");
  console.log("  n'explique pas a lui seul le desengagement. Regarder le contenu et le ciblage.");
} else {
  console.log("  Aucun compte fortement arrose : la pression est diffuse plutot que concentree.");
}
console.log("");
