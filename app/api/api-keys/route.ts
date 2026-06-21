/**
 * POST /api/api-keys  — generate a new key (enterprise only, max 5 per user)
 * GET  /api/api-keys  — list existing keys (without raw key)
 */

import { createClient } from "@/lib/supabase-server";
import { NextResponse } from "next/server";
import { createHash, randomBytes } from "crypto";

export const dynamic = "force-dynamic";

const MAX_KEYS = 5;

function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

// ── GET — list keys ───────────────────────────────────────────────────────────

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("api_keys")
    .select("id, name, key_prefix, last_used_at, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ keys: data ?? [] });
}

// ── POST — create a key ───────────────────────────────────────────────────────

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Require enterprise plan
  const { data: profile } = await supabase
    .from("profiles")
    .select("plan")
    .eq("id", user.id)
    .single();

  if (!["pro", "team", "enterprise"].includes(profile?.plan ?? "")) {
    return NextResponse.json({ error: "Pro plan required" }, { status: 403 });
  }

  // Enforce per-user key limit
  const { count } = await supabase
    .from("api_keys")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);

  if ((count ?? 0) >= MAX_KEYS) {
    return NextResponse.json(
      { error: `Maximum of ${MAX_KEYS} API keys reached. Revoke one before creating another.` },
      { status: 422 }
    );
  }

  const body = await req.json() as { name?: string };
  const name = (body.name ?? "").trim().slice(0, 64);
  if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });

  // Generate a cryptographically random key: "hwg_" + 40 random hex chars
  const rawKey   = `hwg_${randomBytes(20).toString("hex")}`;
  const keyHash  = sha256(rawKey);
  const keyPrefix = rawKey.slice(0, 12); // "hwg_" + 8 chars

  const { error } = await supabase.from("api_keys").insert({
    user_id:    user.id,
    name,
    key_hash:   keyHash,
    key_prefix: keyPrefix,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Return the raw key ONCE — it cannot be retrieved again
  return NextResponse.json({ key: rawKey, prefix: keyPrefix, name }, { status: 201 });
}
