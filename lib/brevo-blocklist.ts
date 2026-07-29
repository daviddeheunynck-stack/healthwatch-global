import type { SupabaseClient } from "@supabase/supabase-js";

// Brevo blocks a contact (hard bounce, or "unsubscribedViaEmail" via its own
// List-Unsubscribe header) with no trace in our DB — our sending crons keep
// treating the address as live and, worse, keep logging alert state as if
// delivery happened. See supabase/migrations/20260729120000_email_blocked_tracking.sql.

interface BrevoBlockedContact {
  email: string;
  reason?: { code?: string; message?: string };
  blockedAt?: string;
}

const BOM = String.fromCharCode(65279);
const clean = (v: string | undefined) => (v || "").replace(new RegExp("^" + BOM), "").trim();

const BLOCKED_EMAILS_CACHE_KEY = "brevo:blocked_emails";

async function fetchAllBlockedContacts(apiKey: string): Promise<BrevoBlockedContact[]> {
  const all: BrevoBlockedContact[] = [];
  const limit = 50;
  let offset = 0;
  // Safety cap, not a real expected ceiling — a legitimate blocklist should
  // never approach 1000 rows on this account's volume.
  for (let page = 0; page < 20; page++) {
    const res = await fetch(
      `https://api.brevo.com/v3/smtp/blockedContacts?limit=${limit}&offset=${offset}`,
      { headers: { "api-key": apiKey }, signal: AbortSignal.timeout(10_000) }
    );
    if (!res.ok) throw new Error(`Brevo blockedContacts error: ${res.status} ${await res.text()}`);
    const body = (await res.json()) as { contacts?: BrevoBlockedContact[] };
    const contacts = body.contacts ?? [];
    all.push(...contacts);
    if (contacts.length < limit) break;
    offset += limit;
  }
  return all;
}

export interface BlocklistSyncResult {
  blockedTotal: number;
  newlyBlocked: number;
  unblocked: number;
}

/**
 * Syncs Brevo's blockedContacts list onto profiles.email_blocked_at /
 * email_blocked_reason. Bidirectional: clears the flag on profiles whose
 * address is no longer in Brevo's blocklist (contact re-subscribed, or a
 * bounce entry was cleared), so a stale flag doesn't permanently mute a
 * user who fixed their inbox.
 */
export async function syncBrevoBlocklist(
  supabase: SupabaseClient,
  brevoApiKey: string
): Promise<BlocklistSyncResult> {
  const blocked = await fetchAllBlockedContacts(clean(brevoApiKey));
  const blockedByEmail = new Map(
    blocked.map((c) => [c.email.toLowerCase(), c])
  );

  // Cache the full blocked-email list independent of profiles — some crons
  // (e.g. trigger-subscriber-alerts) send to free-text addresses that were
  // never a profiles row, so a profiles-derived set would miss them.
  await supabase
    .from("site_config")
    .upsert(
      { key: BLOCKED_EMAILS_CACHE_KEY, value: JSON.stringify([...blockedByEmail.keys()]) },
      { onConflict: "key" }
    )
    .then(({ error: cacheErr }) => {
      if (cacheErr) console.error("[brevo-blocklist] failed to cache blocked emails:", cacheErr.message);
    });

  const { data: profiles, error } = await supabase
    .from("profiles")
    .select("id, email, email_blocked_at");
  if (error) throw new Error(`profiles fetch failed: ${error.message}`);

  let newlyBlocked = 0;
  let unblocked = 0;

  for (const p of profiles ?? []) {
    const email = (p.email as string | null)?.toLowerCase();
    const contact = email ? blockedByEmail.get(email) : undefined;
    const wasBlocked = !!p.email_blocked_at;

    if (contact && !wasBlocked) {
      const { error: updErr } = await supabase
        .from("profiles")
        .update({
          email_blocked_at: contact.blockedAt ?? new Date().toISOString(),
          email_blocked_reason: contact.reason?.code ?? null,
        })
        .eq("id", p.id);
      if (updErr) {
        console.error(`[brevo-blocklist] failed to flag ${p.id}:`, updErr.message);
        continue;
      }
      newlyBlocked++;
    } else if (!contact && wasBlocked) {
      const { error: updErr } = await supabase
        .from("profiles")
        .update({ email_blocked_at: null, email_blocked_reason: null })
        .eq("id", p.id);
      if (updErr) {
        console.error(`[brevo-blocklist] failed to clear ${p.id}:`, updErr.message);
        continue;
      }
      unblocked++;
    }
  }

  return { blockedTotal: blocked.length, newlyBlocked, unblocked };
}

/**
 * Lowercased set of every email Brevo currently has blocked, as of the last
 * sync-brevo-blocklist run. Backed by the site_config cache written in
 * syncBrevoBlocklist (not derived from profiles), so it also covers
 * recipients that were never a profiles row — e.g. the free-text addresses
 * in outbreak_subscribers.emails. Returns an empty set (never throws) if the
 * cache is missing or malformed — a sending cron should degrade to "treat
 * nobody as blocked" rather than fail outright over this side channel.
 */
export async function getBlockedEmailSet(supabase: SupabaseClient): Promise<Set<string>> {
  const { data, error } = await supabase
    .from("site_config")
    .select("value")
    .eq("key", BLOCKED_EMAILS_CACHE_KEY)
    .maybeSingle();
  if (error || !data?.value) {
    if (error) console.error("[brevo-blocklist] blocked emails cache read failed:", error.message);
    return new Set();
  }
  try {
    const emails = JSON.parse(data.value) as string[];
    return new Set(emails);
  } catch {
    console.error("[brevo-blocklist] blocked emails cache is malformed JSON");
    return new Set();
  }
}
