/**
 * Anti-regression guards shared by the PDF-sitrep ingestion crons.
 *
 * Every cron that writes `cases`/`deaths` onto an existing `outbreaks` row has
 * to refuse three classes of bad write, or a single parser miss silently
 * destroys a real figure:
 *
 *   (a) an older-dated report overwriting a more recent row,
 *   (b) a "collapse" — a >70% drop on a row that already has >100 cases,
 *   (c) a zero where the row already holds a real count (deaths OR cases).
 *
 * These already existed, inline and duplicated, in sync-outbreaks,
 * sync-cdc-notices, sync-who-afro and sync-ecdc-threats — built there after
 * three real overwrites of the Ebola/DRC row on 2026-07-15. They were missing
 * entirely from the four PDF-sitrep parsers (sync-paho-alerts, sync-ncdc,
 * sync-drc-sitrep, check-mpox-sitrep), which are the most fragile input class
 * in the repo: a linearized PDF table is one regex away from returning the
 * wrong column. Found 2026-08-02, the day after sync-paho-alerts parsed a
 * footnote digit as Guatemala's death toll (26 → 4, live 3+ weeks).
 *
 * Extracted here rather than copy-pasted a fifth through eighth time — same
 * reasoning as the lib/activate-trial.ts consolidation (2026-08-01): a fix to
 * the guard logic must not require editing eight files in lockstep.
 *
 * The `source_priority` ownership guard is deliberately NOT part of this: it
 * belongs on the `.update()` chain itself (`.lte("source_priority", N)` +
 * `.select("id")`), where the DB enforces it atomically.
 */

export interface GuardedRow {
  cases:  number | null;
  deaths: number | null;
  date?:  string | null;
}

export interface GuardedIncoming {
  cases:  number;
  deaths: number;
  date?:  string | null;
}

// A row below this many cases is too small for a percentage drop to mean
// anything — a genuine correction from 40 to 5 is ordinary, from 4000 to 500
// is a parsing accident.
const COLLAPSE_MIN_CASES = 100;
const COLLAPSE_RATIO     = 0.3;

/**
 * Returns a human-readable reason when the incoming figures must NOT be
 * written over `existing`, or null when the write is safe.
 *
 * Callers log the reason as a "skip" and leave the row untouched — never
 * as an error, since a blocked write is the guard working as intended.
 */
export function regressionGuard(
  incoming: GuardedIncoming,
  existing: GuardedRow,
): string | null {
  const exCases  = existing.cases  ?? 0;
  const exDeaths = existing.deaths ?? 0;

  // (a) Date floor — never let a stale re-fetch overwrite a fresher row.
  // Only applied when both sides carry a date; a missing date on either side
  // means "unknown", not "older", so the remaining guards still run.
  if (incoming.date && existing.date && incoming.date < existing.date) {
    return `guard:older-report — ${incoming.date} vs existing ${existing.date}`;
  }

  // (b) Collapse — a >70% drop on an already-substantial row.
  if (exCases > COLLAPSE_MIN_CASES && incoming.cases > 0 && incoming.cases < exCases * COLLAPSE_RATIO) {
    return `guard:collapse — parsed ${incoming.cases} vs existing ${exCases} (<30%)`;
  }

  // (c) Zero over a real count. Split in two because a bulletin can report
  // only one of the figures: an update stating a death toll but no case count
  // parses to cases=0/deaths>0, which the zero-death check alone never sees
  // (found 2026-07-16 on sync-who-afro).
  if (incoming.cases === 0 && exCases > 0) {
    return `guard:zero-case — parsed 0 vs existing ${exCases}`;
  }
  if (incoming.deaths === 0 && exDeaths > 0) {
    return `guard:zero-death — parsed 0 vs existing ${exDeaths} deaths`;
  }

  return null;
}
