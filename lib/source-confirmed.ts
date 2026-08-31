/**
 * Records "the source was re-read and carried nothing newer" on outbreak rows.
 *
 * `source_confirmed_at` was added 2026-08-22 (migration 20260822120000) to
 * separate two facts that `updated_at` had been conflating: whether a row's
 * FIGURES changed, and whether anyone had LOOKED. Until this file existed only
 * that migration's backfill ever wrote the column — nine rows verified by hand
 * over two days — while the crons, which reach the same conclusion dozens of
 * times a week, discarded it.
 *
 * Every sync cron already has the exact moment in its loop: the branch where
 * it has fetched its source, parsed an entry for a row it matched, and found
 * nothing newer than the row's `date` — logged as `skip: "unchanged"`. That is
 * the column's definition word for word, so the stamp goes there and nowhere
 * else. In particular it must NOT be stamped when:
 *   - the source was unreachable, or the parse failed (nothing was confirmed);
 *   - the row simply wasn't mentioned by this edition (absence is not
 *     confirmation — a country dropping off a table is the ordinary reporting
 *     gap the staleness badge exists to show);
 *   - a guard refused an incoming figure (something newer DID exist, it was
 *     just not trustworthy — that row is not confirmed current, it is
 *     contested, and it needs a human).
 *
 * Why this deliberately carries no `.lte("source_priority", N)` ownership
 * guard, unlike every other write to `outbreaks` in the codebase: a
 * verification stamp claims no ownership and writes no epidemiological value.
 * A cron reading a source and finding nothing newer is a true statement
 * regardless of which tier owns the row's figures — and rows locked at
 * source_priority=10 are precisely the ones that most need it, since they are
 * the ones a human elevated and then watched go quiet.
 *
 * Self-invalidating, so a stale stamp cannot lie: isSourceConfirmed()
 * (lib/outbreaks.ts) only honours it while `source_confirmed_at >= date`. If
 * two crons race and one advances `date` just after the other stamped, the
 * comparison stops holding on its own and the row falls back to ordinary
 * staleness handling. No caller has to clear the column.
 *
 * Batched into a single UPDATE per run rather than one per row: these are the
 * skips, i.e. the common case, and they should cost one round-trip whatever
 * the size of the bulletin.
 *
 * Depends on migration 20260824030000, which teaches the `outbreaks` trigger
 * that an update touching only this column must not bump `updated_at` —
 * without it this helper would silence the staleness signal instead of
 * qualifying it.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export interface SourceConfirmedResult {
  /** Rows the UPDATE actually landed on. */
  stamped: number;
  /** Non-null when the write failed; callers log it, never throw on it. */
  error: string | null;
}

export async function stampSourceConfirmed(
  supabase: SupabaseClient,
  ids: readonly string[],
): Promise<SourceConfirmedResult> {
  const unique = [...new Set(ids)].filter(Boolean);
  if (unique.length === 0) return { stamped: 0, error: null };

  // .select("id") for the same reason every other write in these crons uses
  // it: without it a write that landed on zero rows still returns error: null,
  // and the caller would report a confirmation that never happened.
  const { data, error } = await supabase
    .from("outbreaks")
    .update({ source_confirmed_at: new Date().toISOString() })
    .in("id", unique)
    .select("id");

  if (error) return { stamped: 0, error: error.message };
  return { stamped: data?.length ?? 0, error: null };
}

/**
 * How long a confirmation stays worth honouring, in days.
 *
 * Added 2026-08-31. Until then the rule was `source_confirmed_at >= date` and
 * nothing else, justified by "self-invalidating: if the row's `date` ever
 * advances, the comparison stops holding". True — and exactly backwards as a
 * safety property, because `date` advances only when the ingestion cron works.
 * When one breaks, `date` freezes, and the very last stamp it managed to write
 * suppresses the staleness signal for good. The guard is cancelled by the only
 * event it exists to reveal. Measured on prod that day: 71 of 127 active rows
 * were riding on such a stamp, 60 of them would otherwise have been flagged
 * stale, and the mechanism had no expiry of any kind.
 *
 * Deliberately equal to STALE_DAYS in lib/outbreaks.ts, which imports this
 * constant so the two cannot drift: a confirmation is worth exactly as long as
 * the silence it vouches for. Under normal operation this is never reached —
 * the sync crons re-stamp on every `skip: "unchanged"`, so a live confirmation
 * is 0–2 days old (median 1 on 2026-08-31). A stamp that gets anywhere near 60
 * days means nothing has successfully re-read that row's source in two months,
 * which is the signal, not noise.
 *
 * data-quality does NOT use this number: each of its sections bounds the
 * confirmation by its own staleness threshold (7/21/180 in 4b, 30/180 in 4f)
 * rather than by the client-facing one — same rule, tighter clocks, because
 * that report exists to ask the question again sooner than a visitor would.
 */
export const CONFIRMATION_MAX_AGE_DAYS = 60;

/**
 * Mirrors isSourceConfirmed() (lib/outbreaks.ts) for callers holding a bare
 * row rather than a full Outbreak — the cron routes and scripts/. Kept here so
 * the rule has one definition per side of the app rather than being re-derived
 * inline at each call site.
 */
export function isConfirmedCurrent(row: {
  source_confirmed_at?: string | null;
  date?: string | null;
}): boolean {
  if (!row.source_confirmed_at || !row.date) return false;
  const stamped = new Date(row.source_confirmed_at).getTime();
  if (stamped < new Date(row.date).getTime()) return false;
  return Date.now() - stamped <= CONFIRMATION_MAX_AGE_DAYS * 86_400_000;
}
