import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { resolvedPlan } from "@/lib/resolved-plan";
import { buildAlertConfirmUrl } from "@/lib/unsubscribe-token";
import { sendAlertConfirmationEmail } from "@/lib/alert-confirm-email";
import * as Sentry from "@sentry/nextjs";

const BOM = String.fromCharCode(65279);
const BREVO_API_KEY = (process.env.BREVO_API_KEY ?? "").replace(new RegExp("^" + BOM), "").trim();

const PAID_PLANS = ["pro", "team", "enterprise"];
const MAX_ALERTS = 30;

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("plan, trial_ends_at, stripe_subscription_id").eq("id", user.id).single();
  if (!PAID_PLANS.includes(resolvedPlan(profile)))
    return Response.json({ error: "Pro plan required" }, { status: 403 });

  const { data } = await supabase
    .from("country_risk_alerts")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  return Response.json({ alerts: data ?? [] });
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("plan, trial_ends_at, stripe_subscription_id, alert_locale").eq("id", user.id).single();
  if (!PAID_PLANS.includes(resolvedPlan(profile)))
    return Response.json({ error: "Pro plan required" }, { status: 403 });

  const body = await req.json() as { country_en?: string; min_risk?: string; email?: string };
  const { country_en, min_risk, email } = body;

  if (!country_en?.trim())
    return Response.json({ error: "country_en required" }, { status: 400 });
  if (!["high", "medium", "low"].includes(min_risk ?? ""))
    return Response.json({ error: "min_risk must be high, medium, or low" }, { status: 400 });
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return Response.json({ error: "Valid email required" }, { status: 400 });

  const { count } = await supabase
    .from("country_risk_alerts")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id);
  if ((count ?? 0) >= MAX_ALERTS)
    return Response.json({ error: `Max ${MAX_ALERTS} alerts per account` }, { status: 400 });

  // Self-addressed alerts skip the confirmation round-trip entirely: this
  // address is already proven (Supabase confirmed it at signup), so making
  // the owner click a link to confirm mail to themselves only risks a
  // silently-dead alert if they miss the email — no consent question to
  // resolve, since they can already mail themselves. Third-party addresses
  // (the case the migration exists for) still start unconfirmed.
  const isOwnEmail = email.trim().toLowerCase() === (user.email ?? "").trim().toLowerCase();

  const { data, error } = await supabase
    .from("country_risk_alerts")
    .insert({ user_id: user.id, country_en: country_en.trim(), min_risk, email, confirmed_at: isOwnEmail ? new Date().toISOString() : null })
    .select()
    .single();

  if (error) return Response.json({ error: error.message }, { status: 500 });

  // Row is committed above with confirmed_at NULL for a third-party address —
  // trigger-country-risk-alerts only fires for confirmed rows (see the
  // 2026-08-08 migration). `email` is free text the account owner typed in,
  // not necessarily their own address (see the finding this closes), so
  // nothing recurring goes out until whoever controls that inbox proves it
  // by clicking the link. A send failure here must not fail the creation
  // itself — the alert still exists, just permanently pending until
  // manually re-triggered or recreated.
  if (!isOwnEmail) {
    try {
      const locale = (profile?.alert_locale as string | null) ?? "en";
      const confirmUrl = buildAlertConfirmUrl("country_risk", data.id, locale);
      await sendAlertConfirmationEmail(email, "country_risk", confirmUrl, locale, BREVO_API_KEY, { id: user.id, email: user.email });
    } catch (emailErr) {
      console.error("[country-risk-alerts] confirmation email failed:", emailErr);
      Sentry.captureException(emailErr, { tags: { route: "country-risk-alerts", part: "confirmation-email" }, extra: { alert_id: data.id } });
    }
  }

  return Response.json({ alert: data }, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const id = new URL(req.url).searchParams.get("id");
  if (!id) return Response.json({ error: "id required" }, { status: 400 });

  const { error } = await supabase
    .from("country_risk_alerts")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    console.error("[country-risk-alerts] delete failed:", error.message);
    Sentry.captureException(new Error(`[country-risk-alerts] delete failed: ${error.message}`), { tags: { route: "country-risk-alerts", user_id: user.id } });
    return Response.json({ error: "Failed to delete" }, { status: 500 });
  }

  return new Response(null, { status: 204 });
}
