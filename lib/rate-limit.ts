/**
 * Rate limiter for Next.js API routes.
 *
 * Backed by Upstash Redis (REST API, works from serverless/edge without a
 * persistent connection) when STORAGEv0_KV_REST_API_URL / STORAGEv0_KV_REST_API_TOKEN
 * are set — shared across every Vercel function instance, so a burst spread
 * across cold starts is still counted correctly. Falls back to the previous
 * in-memory, per-process store when those env vars are absent (local dev,
 * or before Upstash is provisioned) so nothing breaks without them.
 *
 * Var names come from the Vercel Marketplace "Upstash for Redis" integration
 * (2026-08-10, prefix "STORAGEv0" chosen at install time) — not the generic
 * UPSTASH_REDIS_REST_* names Upstash's own docs use standalone. The
 * integration also exposes STORAGEv0_KV_REST_API_READ_ONLY_TOKEN,
 * STORAGEv0_KV_URL and STORAGEv0_REDIS_URL (plain TCP connection string) —
 * unused here, rate limiting only needs the REST write token.
 *
 * Fixed window, bucketed on `Math.floor(now / windowMs)`: simpler and cheaper
 * than a sliding window, and precise enough for abuse prevention rather than
 * billing — the one edge case (a burst spanning a window boundary can pass
 * up to ~2x limit) is the accepted trade-off already documented in the
 * previous in-memory version.
 *
 * Usage:
 *   const result = await rateLimit(ip, { limit: 5, windowMs: 60_000 });
 *   if (!result.allowed) return new NextResponse("Too Many Requests", { status: 429 });
 */
import { Redis } from "@upstash/redis";

const BOM   = String.fromCharCode(65279);
const clean = (v: string | undefined) => (v || "").replace(new RegExp("^" + BOM), "").trim();

const UPSTASH_URL   = clean(process.env.STORAGEv0_KV_REST_API_URL);
const UPSTASH_TOKEN = clean(process.env.STORAGEv0_KV_REST_API_TOKEN);

const redis = UPSTASH_URL && UPSTASH_TOKEN
  ? new Redis({ url: UPSTASH_URL, token: UPSTASH_TOKEN })
  : null;

interface Options {
  /** Maximum number of requests allowed within the window */
  limit: number;
  /** Window duration in milliseconds */
  windowMs: number;
}

interface Result {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

// ── In-memory fallback (previous implementation, unchanged) ──────────────────

interface Entry {
  count: number;
  resetAt: number;
}

const memoryStore = new Map<string, Entry>();

// Prune stale keys every 5 minutes to prevent unbounded growth
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of memoryStore) {
    if (entry.resetAt < now) memoryStore.delete(key);
  }
}, 5 * 60 * 1000);

function rateLimitMemory(key: string, { limit, windowMs }: Options): Result {
  const now = Date.now();
  const existing = memoryStore.get(key);

  if (!existing || existing.resetAt < now) {
    const entry: Entry = { count: 1, resetAt: now + windowMs };
    memoryStore.set(key, entry);
    return { allowed: true, remaining: limit - 1, resetAt: entry.resetAt };
  }

  existing.count += 1;

  if (existing.count > limit) {
    return { allowed: false, remaining: 0, resetAt: existing.resetAt };
  }

  return { allowed: true, remaining: limit - existing.count, resetAt: existing.resetAt };
}

// ── Redis-backed implementation ───────────────────────────────────────────────

async function rateLimitRedis(key: string, { limit, windowMs }: Options): Promise<Result> {
  const bucket   = Math.floor(Date.now() / windowMs);
  const resetAt  = (bucket + 1) * windowMs;
  const redisKey = `ratelimit:${key}:${bucket}`;

  // INCR is atomic — two concurrent requests in the same window can never
  // both read the same pre-increment count the way a GET-then-SET would.
  const count = await redis!.incr(redisKey);
  if (count === 1) {
    // Only the request that created the bucket sets its TTL, so a slow
    // concurrent INCR can't reset an already-ticking expiry.
    await redis!.expire(redisKey, Math.ceil(windowMs / 1000));
  }

  if (count > limit) {
    return { allowed: false, remaining: 0, resetAt };
  }
  return { allowed: true, remaining: limit - count, resetAt };
}

export async function rateLimit(key: string, opts: Options): Promise<Result> {
  if (!redis) return rateLimitMemory(key, opts);

  try {
    return await rateLimitRedis(key, opts);
  } catch (err) {
    // A Redis outage must not turn into an outage of the routes it protects —
    // fail open onto the in-memory store rather than throwing out of every
    // rate-limited route (checkout, contact, alert confirmation, ...).
    console.error("[rate-limit] Redis error, falling back to in-memory:", err instanceof Error ? err.message : err);
    return rateLimitMemory(key, opts);
  }
}

/**
 * Extract the real client IP from a Next.js request, respecting common
 * reverse-proxy headers (Vercel, Cloudflare, nginx).
 */
export function getClientIp(req: { headers: { get(name: string): string | null } }): string {
  return (
    req.headers.get("x-real-ip") ??
    req.headers.get("cf-connecting-ip") ??
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    "unknown"
  );
}
