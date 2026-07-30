import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { createClient as createService } from "@supabase/supabase-js";
import * as Sentry from "@sentry/nextjs";

export const dynamic = "force-dynamic";

function service() {
  return createService(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// POST — unregister a browser push subscription for the logged-in user.
//
// Scoped to `user_id` (not just `endpoint`) so one user can never remove
// another's subscription row even if they somehow learned its endpoint URL —
// same belt-and-braces the watchlist DELETE route uses, on top of RLS.
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { endpoint } = await req.json().catch(() => ({ endpoint: undefined }));
  if (!endpoint) return NextResponse.json({ error: "endpoint required" }, { status: 400 });

  // Previously unchecked: a failed delete told the browser "unsubscribed"
  // while the row survived, so an explicit opt-out silently didn't take —
  // the user keeps getting push notifications they asked to stop.
  const { error } = await service()
    .from("push_subscriptions")
    .delete()
    .eq("user_id", user.id)
    .eq("endpoint", endpoint);

  if (error) {
    console.error("[push/unsubscribe] delete failed:", error.message);
    Sentry.captureException(new Error(`[push/unsubscribe] delete failed: ${error.message}`), { tags: { route: "push-unsubscribe", user_id: user.id } });
    return NextResponse.json({ error: "Failed to unsubscribe" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
