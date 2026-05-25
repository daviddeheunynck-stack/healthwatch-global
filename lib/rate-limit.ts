/**
 * Lightweight in-memory rate limiter for Next.js API routes.
 *
 * Works per-process — suitable for single-instance deployments.
 * For multi-instance / edge deployments, swap the store for Redis/Upstash.
 *
 * Usage:
 *   const result = rateLimit(ip, { limit: 5, windowMs: 60_000 });
 *   if (!result.allowed) return new NextResponse("Too Many Requests", { status: 429 });
 */

interface Entry {
  count: number;
  resetAt: number;
}

// Module-level store — persists across requests within the same process
const store = new Map<string, Entry>();

// Prune stale keys every 5 minutes to prevent unbounded growth
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (entry.resetAt < now) store.delete(key);
  }
}, 5 * 60 * 1000);

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

export function rateLimit(key: string, { limit, windowMs }: Options): Result {
  const now = Date.now();
  const existing = store.get(key);

  if (!existing || existing.resetAt < now) {
    // First request in a new window
    const entry: Entry = { count: 1, resetAt: now + windowMs };
    store.set(key, entry);
    return { allowed: true, remaining: limit - 1, resetAt: entry.resetAt };
  }

  existing.count += 1;

  if (existing.count > limit) {
    return { allowed: false, remaining: 0, resetAt: existing.resetAt };
  }

  return { allowed: true, remaining: limit - existing.count, resetAt: existing.resetAt };
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
