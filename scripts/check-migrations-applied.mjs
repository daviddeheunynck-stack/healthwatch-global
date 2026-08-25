#!/usr/bin/env node
// Refuse un push dont les migrations locales ne sont pas appliquees en base.
//
// Deux incidents en deux jours, meme signature :
//
//   2026-08-24 — `weekly_email_claim` appliquee en prod sans fichier local, sa
//   remplacante `weekly_email_send_log` (le nom que le code utilise) jamais
//   appliquee : le verrou email hebdomadaire etait inoperant en production
//   depuis la veille au soir.
//
//   2026-08-25 — `20260824040000_outbreak_alert_daily_lock` presente dans le
//   depot, absente de la base. Meme consequence : la deduplication inter-crons
//   des trois canaux d'alerte etait inoperante, en silence.
//
// Ce qui rend cette classe d'ecart dangereuse, c'est que les verrous
// concernes ECHOUENT OUVERT (voir claimOutbreakAlertDaily et
// claimWeeklyEmailAddress dans lib/cron-monitor.ts) : table absente -> erreur
// -> "autorise, envoie". Un cron mal planifie se voit ; une table absente
// n'apparait nulle part, et le run est journalise "ok".
//
// La lecon avait ete tiree le 24 ("verifier `supabase migration list` avant de
// supposer qu'un lot est deploye") mais elle est restee une consigne. Meme
// arbitrage que pour les crons : un mecanisme plutot qu'une bonne intention.
//
// Deliberement branche sur pre-push et NON sur prebuild : le build Vercel n'a
// ni la CLI Supabase ni le lien projet, et un controle qui ne peut pas
// s'executer la ou il compte ne protege personne. Le moment utile est celui ou
// on publie du code qui suppose un schema.
//
// Ne bloque jamais sur une absence d'infrastructure (CLI absente, projet non
// lie, reseau coupe) : dans ces cas il previent et laisse passer. Le seul
// echec est un ecart reellement constate.
//
// Usage :
//   node scripts/check-migrations-applied.mjs
//   npm run check:migrations

import { readdirSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";

const MIGRATIONS_DIR = join(process.cwd(), "supabase", "migrations");
const VERSION_RE = /^(\d{14})_(.+)\.sql$/;
const ANSI_RE = new RegExp(String.fromCharCode(27) + "\\[[0-9;]*m", "g");

function skip(reason) {
  console.warn(`[check-migrations] ignore : ${reason}`);
  console.warn("[check-migrations] aucun ecart verifie — ce n'est PAS un feu vert.");
  process.exitCode = 0;
}

if (!existsSync(MIGRATIONS_DIR)) skip("supabase/migrations introuvable");
else {
  const local = new Map();
  for (const file of readdirSync(MIGRATIONS_DIR)) {
    const m = VERSION_RE.exec(file);
    if (m) local.set(m[1], m[2]);
  }

  if (local.size === 0) skip("aucune migration locale");
  else {
    // `--linked` interroge le projet reference dans supabase/.temp/project-ref.
    const res = spawnSync("npx", ["--no-install", "supabase", "migration", "list", "--linked"], {
      encoding: "utf8",
      shell: process.platform === "win32",
      timeout: 60_000,
    });

    const out = `${res.stdout ?? ""}${res.stderr ?? ""}`.replace(ANSI_RE, "");

    if (res.error || res.status !== 0) {
      skip(`\`supabase migration list\` a echoue (${res.error?.message ?? `code ${res.status}`})`);
    } else {
      // Colonnes : Local | Remote | Time (UTC). Une version dans Local sans
      // contrepartie dans Remote n'est pas appliquee, et inversement.
      const localSeen = new Set();
      const remoteSeen = new Set();
      for (const line of out.split(/\r?\n/)) {
        if (!line.includes("|")) continue;
        const cols = line.split("|").map((c) => c.trim());
        if (cols.length < 2) continue;
        const [l, r] = cols;
        if (/^\d{14}$/.test(l)) localSeen.add(l);
        if (/^\d{14}$/.test(r)) remoteSeen.add(r);
      }

      if (localSeen.size === 0 && remoteSeen.size === 0) {
        skip("sortie de `supabase migration list` illisible");
      } else {
        const missing = [...local.keys()].filter((v) => !remoteSeen.has(v)).sort();
        // L'autre moitie de l'incident du 24 : une migration appliquee en prod
        // dont le fichier n'existe pas ici. Signale sans bloquer — un clone
        // partiel ou un historique repare produisent le meme symptome.
        const orphans = [...remoteSeen].filter((v) => !local.has(v)).sort();

        if (orphans.length > 0) {
          console.warn("");
          console.warn("[check-migrations] appliquees en base, sans fichier local :");
          for (const v of orphans) console.warn(`    ${v}`);
          console.warn("  Verifier qu'aucune n'a ete renommee ou perdue (cf. weekly_email_claim, 24/08).");
        }

        if (missing.length === 0) {
          console.log(`[check-migrations] ${local.size} migration(s) locale(s), toutes appliquees en base.`);
          process.exitCode = 0;
        } else {
          console.error("");
          console.error("PUSH REFUSE — migrations presentes dans le depot, absentes de la base :");
          for (const v of missing) console.error(`    ${v}_${local.get(v)}.sql`);
          console.error("");
          console.error("  Le code qui suppose ces tables echouera en production, et les verrous");
          console.error("  concernes echouent OUVERT : la panne sera silencieuse.");
          console.error("");
          console.error("  Appliquer :   npx supabase db push");
          console.error("  Puis relancer le push.");
          console.error("");
          console.error("  Si l'ecart est voulu :   git push --no-verify");
          console.error("");
          process.exitCode = 1;
        }
      }
    }
  }
}
