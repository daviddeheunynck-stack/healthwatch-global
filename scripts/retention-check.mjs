#!/usr/bin/env node
// LECTURE SEULE. Repond a une seule question : la boucle de retention tourne-t-elle ?
//
// Contexte (25/08/2026, diagnostic sur product_events) : 18 comptes sur 19
// inscrits depuis le 23/07 utilisent le produit, contre 4 sur 20 avant cette
// date. Le produit acquiert et active, mais ne fait pas revenir. Or ce qui fait
// revenir quelqu'un sur un outil de veille, ce n'est pas le site : c'est
// l'alerte qui arrive quand quelque chose bouge dans son pays.
//
// L'audit du meme jour a montre qu'on ne peut pas le savoir depuis le
// health-check : ses trois signaux peuvent etre verts alors que zero e-mail est
// sorti (push_notified_at tamponne meme sur exception, evaluatedAt pose avant
// la boucle utilisateur, sent_at ecrit sur le chemin de deduplication). Ce
// script contourne les signaux et va lire les journaux eux-memes.
//
// Precision de lecture, qui change tout : outbreak_alert_log, disease_alert_log
// et watchlist_alert_log sont upsertes sur (user_id, outbreak_id). Une ligne =
// un couple utilisateur/foyer, pas un envoi. `sent_at` y est donc la date du
// DERNIER envoi pour ce couple. Les comptages ci-dessous disent "combien de
// couples ont recu quelque chose recemment", jamais "combien d'e-mails sont
// partis". lifecycle_email_log et weekly_email_send_log, eux, sont bien
// une ligne par envoi.
//
// Usage :  node scripts/retention-check.mjs

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

// Compte exact via Content-Range, sans rapatrier les lignes.
async function count(table, query = "") {
  const url = `${SUPABASE_URL}/rest/v1/${table}?select=*&limit=1${query}`;
  const res = await fetch(url, { headers: { ...headers, Prefer: "count=exact" } });
  if (!res.ok) return { ok: false, error: `${res.status} ${(await res.text()).slice(0, 120)}` };
  const range = res.headers.get("content-range") ?? "";
  const total = Number(range.split("/")[1]);
  return { ok: true, total: Number.isFinite(total) ? total : 0 };
}

async function latest(table, column) {
  const url = `${SUPABASE_URL}/rest/v1/${table}?select=${column}&order=${column}.desc&limit=1`;
  const res = await fetch(url, { headers });
  if (!res.ok) return null;
  const rows = await res.json();
  return rows?.[0]?.[column] ?? null;
}

function ageLabel(iso) {
  if (!iso) return "jamais";
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  const d = iso.slice(0, 10);
  if (days === 0) return `${d} (aujourd'hui)`;
  if (days === 1) return `${d} (hier)`;
  return `${d} (il y a ${days} j)`;
}

// table, colonne de date, "une ligne = un envoi ?" , role dans la boucle
const JOURNAUX = [
  ["lifecycle_email_log",       "sent_at",    true,  "cycle de vie (J+1, J-3, expiration, winback)"],
  ["weekly_email_send_log",     "sent_at",    true,  "hebdomadaires (sitrep, digest, signal)"],
  ["outbreak_alert_log",        "sent_at",    false, "alertes regionales"],
  ["disease_alert_log",         "sent_at",    false, "alertes par maladie"],
  ["watchlist_alert_log",       "sent_at",    false, "alertes sur foyers suivis"],
  ["outbreak_alert_daily_lock", "claimed_at", false, "verrou inter-crons (existe depuis le 25/08)"],
];

console.log(`\nJournaux d'envoi — fenetre de ${DAYS} jours\n`);
console.log("journal                      | recent | total | dernier");
console.log("-----------------------------|--------|-------|------------------------");

let boucleVivante = false;
for (const [table, col, unLigneUnEnvoi, role] of JOURNAUX) {
  const recent = await count(table, `&${col}=gte.${since}`);
  if (!recent.ok) {
    console.log(`${table.padEnd(28)} |   —    |   —   | table absente ou illisible (${recent.error})`);
    continue;
  }
  const total = await count(table);
  const last = await latest(table, col);
  console.log(
    `${table.padEnd(28)} | ${String(recent.total).padStart(6)} | ${String(total.total ?? 0).padStart(5)} | ${ageLabel(last)}`,
  );
  if (recent.total > 0) boucleVivante = true;
  if (!unLigneUnEnvoi && recent.total > 0) {
    console.log(`${" ".repeat(28)} |        |       | ↳ ${role} — couples (utilisateur, foyer), pas des envois`);
  } else if (recent.total > 0) {
    console.log(`${" ".repeat(28)} |        |       | ↳ ${role}`);
  }
}

// Usage produit sur la meme fenetre, pour lire les deux cotes ensemble.
const evenements = await count("product_events", `&created_at=gte.${since}`);
const comptes = await count("profiles");

console.log(`\nUsage produit sur ${DAYS} jours`);
if (evenements.ok) console.log(`  evenements enregistres : ${evenements.total}`);
if (comptes.ok) console.log(`  comptes en base        : ${comptes.total}`);

console.log("\nLecture");
if (!boucleVivante) {
  console.log("  Aucun envoi sur la fenetre, tous journaux confondus.");
  console.log("  Les comptes silencieux n'ont pas cesse de repondre : rien ne leur a rien");
  console.log("  demande. Il n'y a pas de retention a reparer, il y a une boucle a allumer.");
} else {
  console.log("  Des envois ont bien eu lieu. Le desengagement n'est donc pas un silence");
  console.log("  technique : c'est le contenu de ce qui part qui ne suffit pas a faire revenir.");
  console.log("  Etape suivante : croiser les destinataires avec les comptes actifs.");
}
console.log("");
