import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { trackEvent } from "@/lib/track-event";

export const dynamic = "force-dynamic";

// Closed allowlist — this endpoint is reachable by any client, so the set of
// trackable actions must stay fixed rather than arbitrary, to avoid it
// becoming an open write oracle for junk events / metadata bloat.
const ALLOWED_ACTIONS = new Set(["pricing_page_view", "outbreak_detail_view", "dashboard_view", "account_view"]);

// The action name is allowlisted but `metadata` was not bounded in any way, and
// it lands verbatim in product_events.metadata (jsonb). Any signed-in account —
// a free self-serve trial is enough — could POST megabyte-sized objects in a
// loop and grow that table without limit. Real callers send a handful of short
// scalars (locale, demo, outbreak id), so cap the serialized size and drop
// nested structures rather than trying to validate per-action shapes. Matters
// more than usual while the Supabase quota is the binding constraint.
const MAX_METADATA_BYTES = 1024;

function sanitizeMetadata(raw: unknown): Record<string, unknown> | undefined {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return undefined;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (v === null || ["string", "number", "boolean"].includes(typeof v)) {
      out[k] = typeof v === "string" ? v.slice(0, 200) : v;
    }
  }
  return JSON.stringify(out).length > MAX_METADATA_BYTES ? undefined : out;
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null) as { action?: unknown; metadata?: unknown } | null;
  const action = body?.action;
  if (typeof action !== "string" || !ALLOWED_ACTIONS.has(action)) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Anonymous visitors are intentionally not recorded — this table only
  // exists to be joinable against profiles by user_id.
  if (user) {
    trackEvent(user.id, action, sanitizeMetadata(body?.metadata));
  }

  return NextResponse.json({ ok: true });
}
