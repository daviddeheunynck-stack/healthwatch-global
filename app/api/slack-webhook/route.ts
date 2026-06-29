import { createClient } from "@/lib/supabase-server";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Accepts Slack incoming webhook URLs and MS Teams connector URLs.
const ALLOWED_PREFIXES = [
  "https://hooks.slack.com/",
  "https://hooks.slack.com/services/",
  "https://outlook.office.com/webhook/",
  "https://outlook.office365.com/webhook/",
];

function isValidWebhookUrl(url: string): boolean {
  return ALLOWED_PREFIXES.some((p) => url.startsWith(p));
}

// ── GET — return current webhook URL (masked) ─────────────────────────────────

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data } = await supabase
    .from("profiles")
    .select("slack_webhook_url")
    .eq("id", user.id)
    .single();

  const url: string | null = data?.slack_webhook_url ?? null;

  // Mask the URL — always expose only the first 30 and last 6 chars
  const masked = url
    ? `${url.slice(0, 30)}…${url.slice(-6)}`
    : null;

  return NextResponse.json({ configured: !!url, masked });
}

// ── PUT — save or delete webhook URL ─────────────────────────────────────────

export async function PUT(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Require paid plan (with trial expiry guard)
  const { data: profile } = await supabase
    .from("profiles")
    .select("plan, trial_ends_at, stripe_subscription_id")
    .eq("id", user.id)
    .single();
  let plan = profile?.plan ?? "free";
  if (
    plan !== "free" &&
    profile?.trial_ends_at &&
    new Date(profile.trial_ends_at).getTime() < Date.now() &&
    !profile?.stripe_subscription_id
  ) {
    plan = "free";
  }
  if (plan === "free") {
    return NextResponse.json({ error: "Upgrade required" }, { status: 403 });
  }

  const body = await req.json() as { url?: string };
  const url  = (body.url ?? "").trim();

  // Empty string = delete the webhook
  if (!url) {
    await supabase
      .from("profiles")
      .update({ slack_webhook_url: null })
      .eq("id", user.id);
    return NextResponse.json({ ok: true, configured: false });
  }

  if (!isValidWebhookUrl(url)) {
    return NextResponse.json({ error: "Invalid webhook URL" }, { status: 400 });
  }

  // Test the webhook before saving
  try {
    const test = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: "✅ HealthWatch Global — webhook connected successfully." }),
    });
    if (!test.ok) throw new Error(`Webhook responded with ${test.status}`);
  } catch {
    return NextResponse.json(
      { error: "Could not reach the webhook URL. Please check it and try again." },
      { status: 422 }
    );
  }

  await supabase
    .from("profiles")
    .update({ slack_webhook_url: url })
    .eq("id", user.id);

  return NextResponse.json({ ok: true, configured: true });
}
