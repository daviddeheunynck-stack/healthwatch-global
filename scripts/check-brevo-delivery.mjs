/**
 * Que s'est-il passé pour un e-mail donné, côté Brevo ?
 *
 * POURQUOI. Le 26/08/2026 : « mot de passe oublié » n'envoie rien, même en
 * production. La route `app/api/auth/reset-password/route.ts` répond toujours
 * `success: true` (anti-énumération), donc la page dit « vérifiez votre boîte »
 * dans tous les cas. Impossible, depuis le produit, de distinguer :
 *   1. l'app n'a jamais appelé Brevo (compte introuvable, limite de débit,
 *      exception avalée) ;
 *   2. l'app a appelé Brevo, qui a refusé ou n'a jamais délivré (adresse sur la
 *      liste de blocage, rebond dur, plainte pour spam).
 * Ce sont deux bugs complètement différents. Ce script les sépare.
 *
 * Il sert au-delà de ce cas : le 25/08, 7 adresses sur 39 comptes étaient
 * bloquées chez Brevo, dont une conversion MSF/Epicentre. C'est l'outil pour
 * regarder n'importe laquelle d'entre elles.
 *
 * Lecture seule. N'affiche aucune clé.
 *
 * Usage :
 *   node scripts/check-brevo-delivery.mjs quelquun@example.com
 *   node scripts/check-brevo-delivery.mjs quelquun@example.com --days=7
 */
import { readFileSync } from "fs";

const EMAIL = process.argv[2];
if (!EMAIL || !EMAIL.includes("@")) {
  console.error("Usage : node scripts/check-brevo-delivery.mjs <email> [--days=30]");
  process.exit(1);
}
const daysArg = process.argv.find((a) => a.startsWith("--days="));
const DAYS = daysArg ? Number(daysArg.slice("--days=".length)) : 30;

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

let API_KEY = "";
for (const f of [".env.local.live", ".env.local"]) {
  try {
    API_KEY = clean(parseEnv(f)["BREVO_API_KEY"]);
    if (API_KEY) {
      console.log(`Clé Brevo lue dans : ${f}`);
      break;
    }
  } catch { /* fichier absent */ }
}
if (!API_KEY) {
  console.error("✗ BREVO_API_KEY introuvable dans .env.local.live ni .env.local.");
  process.exit(1);
}

const api = async (path) => {
  const res = await fetch(`https://api.brevo.com/v3${path}`, {
    headers: { "api-key": API_KEY, accept: "application/json" },
    signal: AbortSignal.timeout(15_000),
  });
  return { status: res.status, body: await res.json().catch(() => ({})) };
};

console.log(`\nAdresse : ${EMAIL}`);
console.log(`Fenêtre : ${DAYS} derniers jours`);

// ── 1. Le contact est-il bloqué ? ───────────────────────────────────────────
console.log(`\n${"═".repeat(74)}\n1. ÉTAT DU CONTACT\n${"═".repeat(74)}`);

const contact = await api(`/contacts/${encodeURIComponent(EMAIL)}`);
if (contact.status === 404) {
  console.log("Contact inconnu de Brevo.");
  console.log("→ Normal pour du transactionnel pur : Brevo n'exige pas que le");
  console.log("  destinataire soit dans une liste. Ne prouve rien à ce stade.");
} else if (contact.status !== 200) {
  console.log(`⛔ Lecture impossible (HTTP ${contact.status}) : ${JSON.stringify(contact.body).slice(0, 300)}`);
} else {
  const c = contact.body;
  const blocked = c.emailBlacklisted === true;
  console.log(`créé le            : ${c.createdAt ?? "?"}`);
  console.log(`emailBlacklisted   : ${c.emailBlacklisted}${blocked ? "   🔴 BLOQUÉ — Brevo ne lui délivrera rien" : "   ✅"}`);
  if (Array.isArray(c.listIds)) console.log(`listes             : ${c.listIds.join(", ") || "aucune"}`);
  const st = c.statistics ?? {};
  for (const k of ["hardBounces", "softBounces", "complaints", "unsubscriptions", "blocked"]) {
    const v = st[k];
    if (Array.isArray(v) && v.length) {
      console.log(`${k.padEnd(18)} : ${v.length} — dernier : ${v[v.length - 1]?.eventTime ?? "?"}`);
    }
  }
}

// ── 2. Qu'est-il réellement parti ? ─────────────────────────────────────────
console.log(`\n${"═".repeat(74)}\n2. ÉVÉNEMENTS TRANSACTIONNELS\n${"═".repeat(74)}`);

const ev = await api(
  `/smtp/statistics/events?email=${encodeURIComponent(EMAIL)}&limit=100&days=${DAYS}&sort=desc`,
);

if (ev.status !== 200) {
  console.log(`⛔ Lecture impossible (HTTP ${ev.status}) : ${JSON.stringify(ev.body).slice(0, 300)}`);
  console.log(`   Si c'est une erreur de permission, la clé Brevo n'a pas l'accès aux statistiques SMTP.`);
} else {
  const events = ev.body?.events ?? [];
  if (events.length === 0) {
    console.log(`Aucun événement sur ${DAYS} jours.`);
    console.log(`\n🔴 CONCLUSION : l'application n'a jamais appelé Brevo pour cette adresse.`);
    console.log(`   Le problème est AVANT l'envoi — côté route, pas côté délivrabilité.`);
    console.log(`   Pistes, dans l'ordre : limite de débit (reset-password plafonne à`);
    console.log(`   5 requêtes par heure et par IP), compte introuvable pour generateLink,`);
    console.log(`   ou exception avalée par le catch qui répond quand même success:true.`);
  } else {
    const byType = {};
    for (const e of events) byType[e.event] = (byType[e.event] || 0) + 1;

    console.log(`${events.length} événement(s) :\n`);
    for (const e of events.slice(0, 40)) {
      console.log(`   ${(e.date ?? "?").slice(0, 19)}  ${String(e.event).padEnd(14)}  ${e.subject ?? ""}`);
      if (e.reason) console.log(`                        └─ ${e.reason}`);
    }

    console.log(`\nRépartition : ${Object.entries(byType).map(([k, v]) => `${k}=${v}`).join(", ")}`);

    const requested = byType["requests"] ?? 0;
    const delivered = byType["delivered"] ?? 0;
    const bad = (byType["hardBounces"] ?? 0) + (byType["softBounces"] ?? 0) + (byType["blocked"] ?? 0) + (byType["spam"] ?? 0);

    console.log(`\n${"─".repeat(74)}`);
    if (requested === 0) {
      console.log(`🔴 Aucune requête d'envoi : l'application n'a rien demandé à Brevo.`);
      console.log(`   Le problème est dans la route, pas dans la délivrabilité.`);
    } else if (delivered === 0 && bad > 0) {
      console.log(`🔴 ${requested} envoi(s) demandé(s), aucun délivré, ${bad} en échec.`);
      console.log(`   Brevo a bien reçu la demande et n'a pas pu ou pas voulu délivrer.`);
      console.log(`   Le problème est la délivrabilité, pas le code.`);
    } else if (delivered === 0) {
      console.log(`🟠 ${requested} envoi(s) demandé(s), aucun délivré, aucun échec signalé.`);
      console.log(`   Envoi accepté puis perdu, ou encore en cours. À relire dans quelques minutes.`);
    } else {
      console.log(`✅ ${delivered} message(s) délivré(s) sur ${requested} demandé(s).`);
      console.log(`   Si le destinataire ne les voit pas : dossier spam, filtre, ou alias.`);
    }
  }
}

console.log("");
