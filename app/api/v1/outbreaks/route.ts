/**
 * GET /api/v1/outbreaks
 *
 * Public API endpoint for Enterprise customers.
 * Authenticated via X-API-Key header.
 *
 * Query params:
 *   region  — africa | asia | americas | europe | oceania
 *   risk    — high | medium | low
 *   limit   — 1–100 (default 50)
 *   offset  — pagination offset (default 0)
 *
 * Response:
 *   { data: Outbreak[], total: number, limit: number, offset: number }
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createHash } from "crypto";

export const dynamic = "force-dynamic";

const BOM   = String.fromCharCode(65279);
const clean = (v: string | undefined) => (v || "").replace(new RegExp("^" + BOM), "").trim();

const SUPABASE_URL     = clean(process.env.NEXT_PUBLIC_SUPABASE_URL);
const SUPABASE_SERVICE = clean(process.env.SUPABASE_SERVICE_ROLE_KEY);

const VALID_REGIONS = new Set(["africa", "asia", "americas", "europe", "oceania"]);
const VALID_RISKS   = new Set(["high", "medium", "low"]);

function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

// Simple in-process rate limit: 300 req / 60s per key hash
const RL_MAP = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(keyHash: string): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const entry = RL_MAP.get(keyHash);

  if (!entry || entry.resetAt <= now) {
    RL_MAP.set(keyHash, { count: 1, resetAt: now + 60_000 });
    return { allowed: true, remaining: 299 };
  }

  entry.count++;
  if (entry.count > 300) return { allowed: false, remaining: 0 };

  return { allowed: true, remaining: 300 - entry.count };
}

export async function GET(req: NextRequest) {
  // ── 1. API key auth ───────────────────────────────────────────────────────
  const rawKey = req.headers.get("x-api-key") ?? "";
  if (!rawKey.startsWith("hwg_")) {
    return NextResponse.json(
      { error: "Missing or invalid API key. Pass your key in the X-API-Key header." },
      { status: 401 }
    );
  }

  const keyHash = sha256(rawKey);

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE);

  // Lookup key
  const { data: apiKey, error: keyErr } = await supabase
    .from("api_keys")
    .select("id, user_id")
    .eq("key_hash", keyHash)
    .maybeSingle();

  if (keyErr || !apiKey) {
    return NextResponse.json({ error: "Invalid API key." }, { status: 401 });
  }

  // Verify user is still on Enterprise plan
  const { data: profile } = await supabase
    .from("profiles")
    .select("plan")
    .eq("id", apiKey.user_id)
    .single();

  if (profile?.plan !== "enterprise") {
    return NextResponse.json(
      { error: "API access requires an active Enterprise subscription." },
      { status: 403 }
    );
  }

  // ── 2. Rate limiting ──────────────────────────────────────────────────────
  const rl = checkRateLimit(keyHash);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded. Max 300 requests per minute." },
      {
        status: 429,
        headers: { "Retry-After": "60", "X-RateLimit-Remaining": "0" },
      }
    );
  }

  // ── 3. Update last_used_at (fire-and-forget) ──────────────────────────────
  supabase
    .from("api_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", apiKey.id)
    .then(() => {});

  // ── 4. Parse query params ─────────────────────────────────────────────────
  const { searchParams } = new URL(req.url);
  const region    = searchParams.get("region") ?? "";
  const risk      = searchParams.get("risk")   ?? "";
  const limitRaw  = searchParams.get("limit");
  const offsetRaw = searchParams.get("offset");

  // A non-numeric limit/offset (e.g. "?limit=abc") makes parseInt return NaN,
  // which used to flow straight through Math.max/min into `.range(NaN, NaN)`
  // → Postgrest receives `offset=NaN&limit=NaN`, rejects it, and the catch-all
  // below turns that into an opaque 500 "Internal server error" — for what's
  // really a client-input mistake (same class as a bad region/risk value, which
  // DO get a clean 400 just below). Validate up front so it does too.
  const limitNum  = limitRaw  !== null ? parseInt(limitRaw, 10)  : 50;
  const offsetNum = offsetRaw !== null ? parseInt(offsetRaw, 10) : 0;

  if (!Number.isFinite(limitNum)) {
    return NextResponse.json({ error: "Invalid limit. Must be an integer between 1 and 100." }, { status: 400 });
  }
  if (!Number.isFinite(offsetNum)) {
    return NextResponse.json({ error: "Invalid offset. Must be a non-negative integer." }, { status: 400 });
  }

  const limit  = Math.min(Math.max(limitNum, 1), 100);
  const offset = Math.max(offsetNum, 0);

  if (region && !VALID_REGIONS.has(region)) {
    return NextResponse.json(
      { error: `Invalid region. Allowed: ${[...VALID_REGIONS].join(", ")}` },
      { status: 400 }
    );
  }
  if (risk && !VALID_RISKS.has(risk)) {
    return NextResponse.json(
      { error: `Invalid risk. Allowed: ${[...VALID_RISKS].join(", ")}` },
      { status: 400 }
    );
  }

  // ── 5. Query outbreaks ────────────────────────────────────────────────────
  let query = supabase
    .from("outbreaks")
    .select(
      "id, disease, country, region, lat, lng, risk_level, cases, deaths, date, source, description, is_pheic, active",
      { count: "exact" }
    )
    .eq("active", true)
    .order("date", { ascending: false })
    .range(offset, offset + limit - 1);

  if (region) query = query.eq("region", region);
  if (risk)   query = query.eq("risk_level", risk);

  const { data, error, count } = await query;

  if (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json(
    { data: data ?? [], total: count ?? 0, limit, offset },
    {
      headers: {
        "X-RateLimit-Remaining": String(rl.remaining),
        "Cache-Control": "no-store",
      },
    }
  );
}
