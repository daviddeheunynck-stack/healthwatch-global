import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { createClient as createService } from "@supabase/supabase-js";
import { errorMessage } from "@/lib/error";
import * as Sentry from "@sentry/nextjs";

export const dynamic = "force-dynamic";

function service() {
  return createService(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

interface SubscribeBody {
  endpoint?: string;
  keys?: { p256dh?: string; auth?: string };
  locale?: string;
}

// POST — register (or refresh) a browser push subscription for the logged-in user.
//
// Body is the browser's PushSubscription, JSON-serialized — i.e. exactly what
// `subscription.toJSON()` produces — plus a `locale` so the sender knows what
// language to write notifications in without a extra profile lookup per send.
//
// Upserts on `endpoint`: re-registering the same browser/device updates the
// row in place (e.g. refreshed keys, changed locale) instead of erroring on
// the UNIQUE constraint or piling up duplicates.
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: SubscribeBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid or missing request body" }, { status: 400 });
  }

  const { endpoint, keys, locale } = body;
  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    return NextResponse.json({ error: "Malformed subscription — endpoint and keys.{p256dh,auth} required" }, { status: 400 });
  }

  const safeLocale = ["fr", "en", "es", "ar", "id"].includes(locale ?? "") ? locale : null;

  const { error } = await service()
    .from("push_subscriptions")
    .upsert(
      {
        user_id:  user.id,
        endpoint,
        p256dh:   keys.p256dh,
        auth:     keys.auth,
        locale:   safeLocale,
      },
      { onConflict: "endpoint" }
    );

  if (error) {
    console.error("[push/subscribe] upsert failed:", errorMessage(error));
    Sentry.captureException(error, { tags: { route: "push-subscribe", user_id: user.id } });
    return NextResponse.json({ error: "Could not save subscription" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
