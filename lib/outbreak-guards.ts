/**
 * Anti-regression guards shared by the cron routes that write `cases`/`deaths`
 * onto existing `outbreaks` rows. A single parser miss on any of these sources
 * — a WHO DON page, a CDC travel notice, an AFRO bulletin, an ECDC page, or a
 * linearized PDF sitrep table — can silently destroy a real figure, so every
 * writer needs to refuse the same handful of implausible updates.
 *
 * Individually exported so each cron can compose exactly the subset (and
 * order) it already used before this file existed — this is a lift of
 * pre-existing, independently-evolved logic, not a new shared policy. The
 * four PDF-sitrep parsers (sync-paho-alerts, sync-ncdc, sync-drc-sitrep,
 * check-mpox-sitrep) had none of this at all until 2026-08-02, the day after
 * sync-paho-alerts parsed a footnote digit as Guatemala's death toll (26 → 4,
 * live 3+ weeks) — they use the `regressionGuard()` composite below. The four
 * that already had inline copies (sync-outbreaks, sync-cdc-notices,
 * sync-who-afro, sync-ecdc-threats) — built after three real overwrites of
 * the Ebola/DRC row on 2026-07-15 — were migrated onto the individual
 * functions on 2026-08-02 to stop a guard fix from requiring edits to eight
 * files in lockstep. Migration preserved each file's exact prior behavior,
 * including where the four differ (e.g. sync-ecdc-threats has never had a
 * collapse or zero-case guard; ncdc/paho/who-afro/cdc-notices all do) —
 * this consolidation intentionally does NOT equalize guard coverage across
 * sources, only removes the duplication of the checks each already ran.
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
const SPIKE_RATIO        = 3;

/**
 * Never let a stale re-fetch overwrite a row that already reflects a more
 * recent report. Only applied when both sides carry a date; a missing date on
 * either side means "unknown", not "older", so this never blocks the write on
 * its own in that case.
 */
export function dateFloorGuard(incoming: GuardedIncoming, existing: GuardedRow): string | null {
  if (incoming.date && existing.date && incoming.date < existing.date) {
    return `guard:older-report — ${incoming.date} vs existing ${existing.date}`;
  }
  return null;
}

/** A >3× jump is almost certainly a parsing anomaly, not a real surge. */
export function spikeGuard(incoming: GuardedIncoming, existing: GuardedRow): string | null {
  const exCases = existing.cases ?? 0;
  if (incoming.cases > 0 && exCases > 0 && incoming.cases > exCases * SPIKE_RATIO) {
    return `guard:spike — parsed ${incoming.cases} vs existing ${exCases} (>${SPIKE_RATIO}x)`;
  }
  return null;
}

/** A >70% drop on an already-substantial row — e.g. a source article covering only one region while the DB holds the global total. */
export function collapseGuard(incoming: GuardedIncoming, existing: GuardedRow): string | null {
  const exCases = existing.cases ?? 0;
  if (exCases > COLLAPSE_MIN_CASES && incoming.cases > 0 && incoming.cases < exCases * COLLAPSE_RATIO) {
    return `guard:collapse — parsed ${incoming.cases} vs existing ${exCases} (<30%)`;
  }
  return null;
}

/**
 * Never let a parser-miss zero cases overwrite a real count. Kept separate
 * from zeroDeathGuard because a bulletin can report only one figure — an
 * update stating a death toll but no case count parses to cases=0/deaths>0,
 * which zeroDeathGuard alone never sees (found 2026-07-16 on sync-who-afro).
 */
export function zeroCaseGuard(incoming: GuardedIncoming, existing: GuardedRow): string | null {
  const exCases = existing.cases ?? 0;
  if (incoming.cases === 0 && exCases > 0) {
    return `guard:zero-case — parsed 0 vs existing ${exCases}`;
  }
  return null;
}

/** Never let a parser-miss zero deaths overwrite a real death count. */
export function zeroDeathGuard(incoming: GuardedIncoming, existing: GuardedRow): string | null {
  const exDeaths = existing.deaths ?? 0;
  if (incoming.deaths === 0 && exDeaths > 0) {
    return `guard:zero-death — parsed 0 vs existing ${exDeaths} deaths`;
  }
  return null;
}

/**
 * cdc-notices-specific: a notice with NO extractable case data at all
 * (cases=0 AND deaths=0) must not blank out real numbers an authoritative
 * source already established — travel notices are prose, not case-count
 * bulletins, so 0/0 usually means "nothing parsed", not "nothing happening".
 * Stricter trigger than zeroCaseGuard/zeroDeathGuard (requires both to be
 * zero) — deliberately: a notice that DOES carry one real figure should still
 * go through the individual zero guards instead. Found 2026-07-16: a Level 3
 * DRC Ebola notice parsed to 0/0 overwrote 1963/719 from ECDC this way.
 */
export function bothZeroGuard(incoming: GuardedIncoming, existing: GuardedRow): string | null {
  const exCases = existing.cases ?? 0;
  if (incoming.cases === 0 && incoming.deaths === 0 && exCases > 0) {
    return `guard:zero-count — notice has no case data, preserving existing ${exCases}/${existing.deaths ?? 0}`;
  }
  return null;
}

/**
 * ecdc-threats-specific: a running death toll in an ongoing outbreak never
 * decreases. Stricter than zeroDeathGuard — catches a partial drop, not just
 * a fall to zero. A drop is almost always a parsing anomaly (e.g. grabbing a
 * daily increment instead of the running total — found 2026-07-15 on ECDC's
 * Ebola DRC page: 719 cumulative vs 10 same-day increment) rather than a real
 * downward revision, which is rare enough to apply by hand instead of risking
 * a silent overwrite.
 */
export function deathsNeverDecreaseGuard(incoming: GuardedIncoming, existing: GuardedRow): string | null {
  const exDeaths = existing.deaths ?? 0;
  if (incoming.deaths > 0 && exDeaths > 0 && incoming.deaths < exDeaths) {
    return `guard:deaths-decreased — parsed ${incoming.deaths} vs existing ${exDeaths} — refusing to overwrite`;
  }
  return null;
}

/**
 * Sanity check on the incoming item alone — no existing row needed. A death
 * toll exceeding the case count is never plausible and always a parsing
 * anomaly (mismatched table columns, a rate mistaken for a count, etc).
 */
export function implausibleDeathsGuard(incoming: GuardedIncoming): string | null {
  if (incoming.deaths > incoming.cases && incoming.cases > 0) {
    return `guard:deaths>cases — ${incoming.deaths}d > ${incoming.cases}c`;
  }
  return null;
}

/**
 * Composite of the four guards every PDF-sitrep parser needs: date floor,
 * collapse, zero-case, zero-death — in that order. Used as-is by
 * sync-paho-alerts, sync-ncdc, sync-drc-sitrep and check-mpox-sitrep (added
 * 2026-08-02). Does NOT include spikeGuard, bothZeroGuard,
 * deathsNeverDecreaseGuard or implausibleDeathsGuard — those are source-
 * specific and composed individually by the crons that need them.
 *
 * Returns a human-readable reason when the incoming figures must NOT be
 * written over `existing`, or null when the write is safe. Callers log the
 * reason as a "skip" and leave the row untouched — never as an error, since a
 * blocked write is the guard working as intended.
 */
export function regressionGuard(
  incoming: GuardedIncoming,
  existing: GuardedRow,
): string | null {
  return (
    dateFloorGuard(incoming, existing) ??
    collapseGuard(incoming, existing) ??
    zeroCaseGuard(incoming, existing) ??
    zeroDeathGuard(incoming, existing) ??
    null
  );
}
