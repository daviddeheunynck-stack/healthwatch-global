import type { SupabaseClient } from "@supabase/supabase-js";
import { getBlockedEmailSet } from "@/lib/brevo-blocklist";

// Une seule décision « peut-on écrire à cette personne », lue par toutes les
// routes qui envoient.
//
// Le problème que ce module remplace : il existait deux drapeaux d'opt-out
// indépendants — `display_filters.no_onboarding_emails` et
// `display_filters.no_weekly_signal` — sans abstraction commune, et chaque cron
// en consultait zéro, un, ou les deux, au hasard de son écriture :
//
//   cron                      no_onboarding_emails   no_weekly_signal
//   onboarding-sequence              oui                   non
//   expire-trials                    oui                   non
//   winback-sequence                 oui                   oui
//   weekly-signal                    non                   oui
//   trigger-regional-digest          non                   oui
//   pilot-follow-up                  non                   oui
//   trial-reminders                  non                   non
//
// Conséquence concrète, constatée le 2026-08-23 : quelqu'un qui clique
// « se désinscrire » sur l'email J+1 écrit `no_onboarding_emails`, puis reçoit
// encore pilot-follow-up au jour 8, trial-reminders aux jours 11 et 13, et
// weekly-signal tous les lundis. Quatre emails après désinscription. Se
// désabonner ne marchait pas — ce qui explique les inscriptions suivies d'un
// départ immédiat bien mieux que le volume d'envois.
//
// ── Marketing vs transactionnel ─────────────────────────────────────────────
//
// La correction n'est PAS « un drapeau coupe tout ». Un rappel de fin d'essai
// porte sur l'accès et l'argent de la personne : le couper parce qu'elle s'est
// désabonnée d'une séquence d'accueil lui ferait perdre son accès sans préavis,
// et le RGPD comme le CAN-SPAM exemptent explicitement ce type de message.
//
// D'où deux classes, nommées et explicites plutôt que déduites du cron :
//
//   "marketing"      — accueil, relances de valeur, digests, signaux hebdo.
//                      Coupé par l'un OU l'autre des deux drapeaux.
//   "transactional"  — fin d'essai, essai expiré, reçus. N'obéit qu'au blocage
//                      dur (email_blocked_at / blocklist Brevo), jamais à un
//                      opt-out marketing.
//
// Les deux drapeaux historiques sont traités comme équivalents pour le
// marketing : ils ont été écrits par des liens différents, mais aucune personne
// n'a jamais eu l'intention de dire « arrête les emails d'accueil mais continue
// le signal hebdomadaire ». Les distinguer était un accident d'implémentation,
// pas un choix produit.

export type MailClass = "marketing" | "transactional";

/** Champs de `profiles` nécessaires à la décision. */
export interface SuppressionFields {
  email_blocked_at?: string | null;
  display_filters?: unknown;
}

/**
 * Vrai si cette personne ne doit PAS recevoir un email de cette classe.
 *
 * Prédicat pur sur une ligne `profiles` déjà chargée — les crons de cycle de vie
 * ont la ligne en main, inutile de leur faire construire un Set de toutes les
 * adresses. Pour les envois adressés à une adresse libre (newsletter, rapports
 * programmés), voir `getWeeklySuppressionSet` plus bas.
 *
 * Penser à sélectionner `email_blocked_at` et `display_filters` dans la requête :
 * un champ absent est lu comme « rien ne bloque », ce qui échoue du mauvais côté.
 */
export function isMailSuppressed(profile: SuppressionFields, klass: MailClass): boolean {
  if (profile.email_blocked_at) return true;
  if (klass === "transactional") return false;
  const df = profile.display_filters as Record<string, unknown> | null;
  return !!(df?.no_onboarding_emails || df?.no_weekly_signal);
}

// ── Envois adressés à une adresse, pas à un compte ──────────────────────────
//
// Les quatre mailers du lundi écrivent à des adresses qui ne sont pas toujours
// une ligne `profiles` : `subscriptions.email` est une adresse newsletter
// autonome, `scheduled_reports.recipients` est une liste libre. D'où un Set
// d'adresses plutôt que le prédicat ci-dessus.
//
// Toujours de classe "marketing" : aucun des quatre n'est transactionnel.

export interface WeeklySuppression {
  emails: Set<string>;
  degraded: boolean;
}

/**
 * Ensemble minuscule de toutes les adresses à ne pas servir cette passe.
 * Construit une fois par invocation, pas par destinataire — les quatre crons du
 * lundi parcourent des centaines de lignes.
 *
 * Réunit quatre signaux d'opt-out indépendants :
 *   1. blocklist Brevo (bounce dur, ou List-Unsubscribe depuis le client mail)
 *   2. `profiles.email_blocked_at` — miroir de (1), gardé parce qu'un profil peut
 *      être marqué entre deux synchronisations de la blocklist
 *   3. `profiles.display_filters.no_weekly_signal` et `no_onboarding_emails` —
 *      les désinscriptions in-produit, désormais équivalentes (voir plus haut)
 *   4. `subscriptions.active = false` — l'opt-out newsletter. La colonne vaut
 *      TRUE par défaut et n'est mise à FALSE que par une désinscription
 *      explicite : c'est un vrai signal, pas un marqueur d'inscription non
 *      confirmée.
 *
 * Ne lève jamais. Chaque source dégrade indépendamment : un échec sur l'une est
 * journalisé et n'apporte rien, plutôt que de vider l'ensemble (ce qui écrirait
 * à tout le monde) ou d'interrompre la passe (ce qui n'écrirait à personne). Le
 * drapeau `degraded` permet à l'appelant de journaliser la course en "error"
 * pour qu'une liste silencieusement partielle ne passe pas pour un run sain.
 */
export async function getWeeklySuppressionSet(
  supabase: SupabaseClient,
): Promise<WeeklySuppression> {
  const emails = new Set<string>();
  let degraded = false;

  const add = (v: unknown) => {
    if (typeof v === "string" && v.trim()) emails.add(v.trim().toLowerCase());
  };

  // 1. Blocklist Brevo — dégrade déjà vers un ensemble vide en interne, donc un
  //    retour vide est indistinguable de « personne n'est bloqué ». C'est le
  //    contrat préexistant, pas resserré ici.
  try {
    for (const e of await getBlockedEmailSet(supabase)) add(e);
  } catch (err) {
    degraded = true;
    console.error("[mail-suppression] blocklist Brevo indisponible :", err);
  }

  // 2 + 3. profiles : adresses bloquées dur, et désinscriptions in-produit.
  //    display_filters est un blob jsonb partagé avec les préférences du
  //    tableau de bord, donc le filtrage se fait en JS plutôt que dans la
  //    requête — un filtre `->>` manquerait silencieusement un booléen stocké
  //    `true` plutôt que "true".
  //
  //    Paginé délibérément. PostgREST plafonne un select non borné à son
  //    max-rows (1000 par défaut) et renvoie la page tronquée SANS erreur : un
  //    simple .select() ici perdrait en silence tout opt-out au-delà du
  //    plafond et écrirait à ces gens — exactement la panne que ce module
  //    existe pour empêcher, réintroduite une ligne à la fois à mesure que la
  //    table grossit. La troncature doit être impossible, pas improbable.
  const profileErr = await paginate(
    (from, to) =>
      supabase
        .from("profiles")
        .select("email, email_blocked_at, display_filters")
        .not("email", "is", null)
        .range(from, to),
    (p: SuppressionFields & { email: unknown }) => {
      if (isMailSuppressed(p, "marketing")) add(p.email);
    },
  );
  if (profileErr) {
    degraded = true;
    console.error("[mail-suppression] requête profiles en échec :", profileErr);
  }

  // 4. Opt-out newsletter. Même raisonnement de pagination.
  const subErr = await paginate(
    (from, to) =>
      supabase.from("subscriptions").select("email").eq("active", false).range(from, to),
    (s: { email: unknown }) => add(s.email),
  );
  if (subErr) {
    degraded = true;
    console.error("[mail-suppression] requête subscriptions en échec :", subErr);
  }

  return { emails, degraded };
}

const PAGE_SIZE = 1000;
// Garde-fou, pas un plafond attendu : 200 pages = 200 000 adresses supprimées,
// très au-delà du volume de ce compte. L'atteindre signale un problème de
// requête, et boucler indéfiniment ne ferait que bloquer le cron.
const MAX_PAGES = 200;

/**
 * Lit toutes les lignes d'une requête paginable en appliquant `onRow` à chacune.
 * Renvoie null en cas de succès, sinon le message d'erreur. Une page incomplète
 * termine la boucle ; une page pleine est toujours suivie d'une requête de plus,
 * puisqu'une page pleine est précisément à quoi ressemble une troncature.
 */
async function paginate<T>(
  query: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
  onRow: (row: T) => void,
): Promise<string | null> {
  for (let page = 0; page < MAX_PAGES; page++) {
    const from = page * PAGE_SIZE;
    const { data, error } = await query(from, from + PAGE_SIZE - 1);
    if (error) return error.message;
    const rows = data ?? [];
    for (const row of rows) onRow(row);
    if (rows.length < PAGE_SIZE) return null;
  }
  return `plus de ${MAX_PAGES * PAGE_SIZE} lignes — pagination interrompue, liste incomplète`;
}
