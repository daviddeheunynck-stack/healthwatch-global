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
 *
 * Below the guard functions sit four raw, threshold-parameterized predicates
 * (isCollapse, isSpike, deathsExceedCases, isZeroData) — the arithmetic each
 * guard wraps. Added 2026-08-02 so `data-quality`'s daily self-audit could
 * stop duplicating the same four checks a fifth time: it compares an active
 * row against YESTERDAY's snapshot rather than an incoming report against the
 * current row, and at deliberately different thresholds (e.g. collapse at
 * <40% instead of <30%, spike at >10× with a 5000-case floor instead of >3×)
 * tuned for a same-day self-check rather than cross-source validation at
 * ingest time. Sharing only the arithmetic — not the thresholds, and not the
 * write-time-specific exclusions like "never flag cases=0 as a collapse,
 * that's zeroCaseGuard's job" — keeps data-quality's actual sensitivity
 * unchanged while still removing the duplicated formulas.
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

/** Raw "did cases drop by more than (1-ratio) on an already-substantial row" check — no exclusions, no message. Threshold is caller-supplied so write-time guards and data-quality's self-audit can each use their own. */
export function isCollapse(currentCases: number, previousCases: number, opts: { minPreviousCases: number; ratio: number }): boolean {
  return previousCases > opts.minPreviousCases && currentCases < previousCases * opts.ratio;
}

/** Raw "did cases jump by more than ratio×" check, with an optional floor on the new value. Threshold is caller-supplied — see isCollapse. */
export function isSpike(currentCases: number, previousCases: number, opts: { ratio: number; minCurrentCases?: number }): boolean {
  return previousCases > 0 && currentCases > previousCases * opts.ratio && currentCases > (opts.minCurrentCases ?? 0);
}

/** Raw "deaths exceed cases" check — no `cases > 0` exclusion (see implausibleDeathsGuard, which adds one for write-time use). */
export function deathsExceedCases(deaths: number, cases: number): boolean {
  return deaths > cases;
}

/** Raw "both figures are zero" check. */
export function isZeroData(cases: number, deaths: number): boolean {
  return cases === 0 && deaths === 0;
}

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
  if (isSpike(incoming.cases, exCases, { ratio: SPIKE_RATIO })) {
    return `guard:spike — parsed ${incoming.cases} vs existing ${exCases} (>${SPIKE_RATIO}x)`;
  }
  return null;
}

/**
 * A >70% drop on an already-substantial row — e.g. a source article covering
 * only one region while the DB holds the global total. Requires
 * `incoming.cases > 0` on top of the raw isCollapse() check: a drop to
 * exactly 0 is zeroCaseGuard's job (it produces a more specific message), not
 * this one's — unlike data-quality's equivalent check, which has no such
 * exclusion (see isCollapse's own doc comment).
 */
export function collapseGuard(incoming: GuardedIncoming, existing: GuardedRow): string | null {
  const exCases = existing.cases ?? 0;
  if (incoming.cases > 0 && isCollapse(incoming.cases, exCases, { minPreviousCases: COLLAPSE_MIN_CASES, ratio: COLLAPSE_RATIO })) {
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
  if (isZeroData(incoming.cases, incoming.deaths) && exCases > 0) {
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
  if (incoming.cases > 0 && deathsExceedCases(incoming.deaths, incoming.cases)) {
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
