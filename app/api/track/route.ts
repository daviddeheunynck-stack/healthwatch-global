import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { trackEvent } from "@/lib/track-event";

export const dynamic = "force-dynamic";

// Closed allowlist — this endpoint is reachable by any client, so the set of
// trackable actions must stay fixed rather than arbitrary, to avoid it
// becoming an open write oracle for junk events / metadata bloat.
const ALLOWED_ACTIONS = new Set(["pricing_page_view", "outbreak_detail_view"]);

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
    const metadata = body?.metadata;
    trackEvent(user.id, action, typeof metadata === "object" && metadata !== null ? metadata as Record<string, unknown> : undefined);
  }

  return NextResponse.json({ ok: true });
}
