// Wraps fetch() with a small number of retries for TRANSIENT failures only —
// network errors (DNS, TCP reset, TLS) and 502/503/504 gateway-level HTTP
// statuses. Never retries 403/404/other 4xx: those are almost always a
// deliberate response (bot-detection UA filtering, a removed page — see
// reference_govt_sites_need_browser_user_agent) and hammering them would make
// things worse, not better, not a transient blip.
//
// Built 2026-09-02 after sync-africa-cdc logged "fetch failed" and lost a full
// day of ingestion for a source confirmed reachable moments later (20/20
// probes succeeded from here, with the exact prod headers). No sync-* cron
// retried anything — one attempt per run, every time. For a daily cron that
// costs 24h; for the six crons that only run on Monday, a one-second network
// blip costs a full week, in silence.
//
// Scoped to the single LISTING fetch of daily/weekly source crons: a cron
// that loops per-article afterwards already has its own wall-clock budget
// against Vercel's maxDuration, and 3 retries on every one of N per-article
// fetches could blow through it — that loop is deliberately left untouched.

export interface FetchRetryOptions {
  /** Total attempts, including the first. Default 3. */
  attempts?: number;
  /** Delay in ms before each retry, indexed by attempt number (0-based). The
   *  last entry repeats if there are more retries than entries. */
  backoffMs?: number[];
  /** Per-attempt timeout — a fresh AbortSignal is created for every attempt,
   *  since AbortSignal.timeout() is single-use. Default 15000. */
  timeoutMs?: number;
  /** HTTP statuses worth retrying. Default [502, 503, 504]. */
  retryStatuses?: number[];
}

export interface FetchRetryResult {
  /** The last response received, or null if every attempt threw (network
   *  error / timeout) rather than returning an HTTP response at all. */
  response: Response | null;
  /** Set only when `response` is null. */
  error: Error | null;
  /** How many attempts were actually made — logged by the caller so a source
   *  that becomes chronically flaky is visible instead of just "ok". */
  attemptsMade: number;
}

const DEFAULT_BACKOFF_MS      = [1000, 4000];
const DEFAULT_RETRY_STATUSES  = [502, 503, 504];

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Never throws. Callers check `response` (null means every attempt failed at
 * the network level) instead of wrapping this in try/catch.
 */
export async function fetchWithRetry(
  url: string,
  init: RequestInit = {},
  opts: FetchRetryOptions = {},
): Promise<FetchRetryResult> {
  const attempts      = opts.attempts ?? 3;
  const backoffMs      = opts.backoffMs ?? DEFAULT_BACKOFF_MS;
  const timeoutMs      = opts.timeoutMs ?? 15_000;
  const retryStatuses  = new Set(opts.retryStatuses ?? DEFAULT_RETRY_STATUSES);

  let lastError: Error | null = null;
  for (let attempt = 0; attempt < attempts; attempt++) {
    const isLastAttempt = attempt === attempts - 1;
    try {
      const res = await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
      if (res.ok || !retryStatuses.has(res.status) || isLastAttempt) {
        return { response: res, error: null, attemptsMade: attempt + 1 };
      }
      lastError = new Error(`HTTP ${res.status}`);
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));
      if (isLastAttempt) break;
    }
    await sleep(backoffMs[attempt] ?? backoffMs[backoffMs.length - 1] ?? 1000);
  }
  return { response: null, error: lastError, attemptsMade: attempts };
}
