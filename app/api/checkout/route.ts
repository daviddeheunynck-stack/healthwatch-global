import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { errorMessage } from "@/lib/error";
import { trackEvent } from "@/lib/track-event";
import * as Sentry from "@sentry/nextjs";

export const dynamic = "force-dynamic";

const stripBOM = (val: string | undefined) =>
  (val || "").replace(/^﻿/, "").trim();

// EUR: Pro €29/mo | €249/yr · Team €149/mo | €1 290/yr
// USD: Pro $29/mo | $249/yr · Team $165/mo | $1 425/yr  (en locale → USD, all others → EUR)
const PRICES: Record<string, Record<"eur" | "usd", string>> = {
  "pro:monthly":  { eur: stripBOM(process.env.STRIPE_PRO_EUR_PRICE_ID),         usd: stripBOM(process.env.STRIPE_PRO_USD_PRICE_ID)         },
  "pro:annual":   { eur: stripBOM(process.env.STRIPE_PRO_EUR_ANNUAL_PRICE_ID),  usd: stripBOM(process.env.STRIPE_PRO_USD_ANNUAL_PRICE_ID)  },
  "team:monthly": { eur: stripBOM(process.env.STRIPE_TEAM_EUR_PRICE_ID),        usd: stripBOM(process.env.STRIPE_TEAM_USD_PRICE_ID)        },
  "team:annual":  { eur: stripBOM(process.env.STRIPE_TEAM_EUR_ANNUAL_PRICE_ID), usd: stripBOM(process.env.STRIPE_TEAM_USD_ANNUAL_PRICE_ID) },
};

function getCurrency(locale: string): "eur" | "usd" {
  return locale === "en" ? "usd" : "eur";
}

// Stripe Checkout's `locale` is a closed enum (auto, bg, cs, … fr, … id, … zh-TW)
// — "ar" is NOT in it. Sending it makes the Checkout Sessions API reject the
// request outright ("Invalid locale: must be one of …"), so Arabic-locale users
// got a hard error instead of a payment link (verified live: fr → valid session
// URL, ar → 400 from Stripe). "auto" lets Stripe pick from the browser's
// Accept-Language — the documented escape hatch for unsupported locales — so the
// page renders in whatever Stripe *does* support rather than failing closed.
const STRIPE_LOCALES: Record<string, string> = {
  fr: "fr",
  en: "en",
  es: "es",
  ar: "auto",
  id: "id",
};

export async function POST(req: NextRequest) {
  // ── Rate limiting: 10 checkout attempts per IP per hour ─────────────────────
  const ip = getClientIp(req);
  const rl = await rateLimit(`checkout:${ip}`, { limit: 10, windowMs: 60 * 60 * 1000 });
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many requests — please try again later." },
      {
        status: 429,
        headers: {
          "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)),
          "X-RateLimit-Limit": "10",
          "X-RateLimit-Remaining": "0",
        },
      }
    );
  }

  // Identify the caller from their session cookie — never trust client-supplied userId
  const cookieStore = await cookies();
  const supabase = createServerClient(
    (process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/^﻿/, "").trim(),
    (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "").replace(/^﻿/, "").trim(),
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (toSet) => {
          toSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        },
      },
    }
  );
  const { data: { user: sessionUser } } = await supabase.auth.getUser();

  let body: { plan?: string; locale?: string; userEmail?: string; billing?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Corps de requête invalide (JSON malformé)." }, { status: 400 });
  }

  try {
    const { plan, userEmail, billing } = body;
    const VALID_LOCALES_CO = ["fr", "en", "es", "ar", "id"];
    const locale = VALID_LOCALES_CO.includes(body.locale ?? "") ? (body.locale ?? "fr") : "fr";
    // Use session-authenticated userId; fall back to empty string for anonymous checkout
    const userId = sessionUser?.id ?? "";
    const resolvedEmail = sessionUser?.email ?? userEmail;

    // Look up existing Stripe customer and DB trial state
    let existingStripeCustomerId: string | null = null;
    let dbTrialEndsAt: string | null = null;
    if (userId) {
      const { data: profileData } = await supabase
        .from("profiles")
        .select("stripe_customer_id, trial_ends_at")
        .eq("id", userId)
        .single();
      existingStripeCustomerId = profileData?.stripe_customer_id ?? null;
      dbTrialEndsAt = profileData?.trial_ends_at ?? null;
    }
    const currency = getCurrency(locale ?? "fr");
    const billingPeriod = billing === "annual" ? "annual" : "monthly";
    const priceRow = PRICES[`${plan ?? ""}:${billingPeriod}`];
    // Fall back to EUR if the USD price ID is not configured (e.g. Team USD not yet created in Stripe)
    const priceId = priceRow?.[currency] || priceRow?.["eur"];

    if (!priceId) {
      return NextResponse.json({ error: "Plan ou devise invalide." }, { status: 400 });
    }

    const clean = (val: string | undefined, fallback = "") =>
      (val || fallback).replace(/^﻿/, "").trim();

    const secretKey = clean(process.env.STRIPE_SECRET_KEY);
    const baseUrl = clean(process.env.NEXT_PUBLIC_BASE_URL, "https://healthwatch-global.com");

    const stripeLocale = STRIPE_LOCALES[locale ?? ""] || "en";

    const params = new URLSearchParams({
      mode: "subscription",
      "line_items[0][price]": priceId,
      "line_items[0][quantity]": "1",
      success_url: `${baseUrl}/${locale}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/${locale}/pricing`,
      allow_promotion_codes: "true",
      locale: stripeLocale,
      // Collect billing address + company name → institutional invoices show org name
      billing_address_collection: "required",
      // Collect VAT/tax ID for institutional buyers (SIRET, EU VAT, etc.)
      "tax_id_collection[enabled]": "true",
      "metadata[plan]": plan ?? "",
      "metadata[user_id]": userId || "",
      "metadata[billing]": billingPeriod,
      // Mirror user_id in subscription metadata so the webhook can recover
      // if checkout.session.completed fails to link stripe_customer_id.
      "subscription_data[metadata][user_id]": userId || "",
      "subscription_data[metadata][plan]": plan ?? "",
      // Mirrored here (not just session metadata) so customer.subscription.updated —
      // which only ever sees the Subscription object, never the Checkout Session —
      // can also persist stripe_billing_period. See syncPaymentMethodFlag in
      // app/api/webhook/route.ts.
      "subscription_data[metadata][billing]": billingPeriod,
    });

    // Trial period: honour remaining days from the DB trial (no credit card required).
    // If the user already had a trial, only carry over the days they still have left
    // (prevents double-trials when subscribing mid-trial or after trial expiry).
    const trialDaysRemaining = dbTrialEndsAt
      ? Math.min(7, Math.max(0, Math.ceil((new Date(dbTrialEndsAt).getTime() - Date.now()) / 86_400_000)))
      : 7; // no DB trial → first-time user: give the standard 7-day trial
    // Cap at 7: pilot users have a 35-day DB trial; without the cap they would
    // inherit the full remaining pilot duration as a Stripe trial (up to 34 days).
    if (trialDaysRemaining > 0) {
      params.set("subscription_data[trial_period_days]", String(trialDaysRemaining));
      params.set("subscription_data[trial_settings][end_behavior][missing_payment_method]", "cancel");
      // 2026-08-19: was "if_required" — with end_behavior.missing_payment_method
      // = "cancel", that meant a mid-trial subscription auto-cancelled at trial
      // end unless a card was added later, so this path could never produce a
      // real paying customer (paying criterion needs stripe_has_payment_method).
      // Always collecting the card keeps the user unbilled until trial end but
      // makes end_behavior a harmless safety net instead of the default outcome.
      params.set("payment_method_collection", "always");
    }

    // Reuse existing Stripe customer to avoid duplicate records
    if (existingStripeCustomerId) {
      params.set("customer", existingStripeCustomerId);
    } else if (resolvedEmail) {
      params.set("customer_email", resolvedEmail);
    }

    const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${secretKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
        "Stripe-Version": "2026-04-22.dahlia",
      },
      body: params.toString(),
      cache: "no-store",
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Stripe API error:", JSON.stringify(data));
      Sentry.captureException(new Error(`[checkout] Stripe API error: ${data.error?.message ?? response.status}`), {
        tags: { plan: body.plan ?? "", user_id: sessionUser?.id ?? "anon" },
      });
      return NextResponse.json(
        { error: data.error?.message || "Erreur Stripe." },
        { status: response.status }
      );
    }

    // Server-side, not the client-only @vercel/analytics "checkout_start" already
    // fired in CheckoutButton — that one only shows up in the Vercel dashboard,
    // not queryable from Supabase. This mirrors it into product_events so the
    // conversion funnel (account_view → checkout_started → real Stripe payment)
    // is answerable from the DB, closing the instrumentation gap flagged
    // 2026-08-05/22 in project_trial_value_nudge_feature.
    if (userId) trackEvent(userId, "checkout_started", { plan: plan ?? "", billing: billingPeriod, locale });

    return NextResponse.json({ url: data.url });
  } catch (err: unknown) {
    console.error("Checkout fetch error:", errorMessage(err));
    Sentry.captureException(err, { tags: { route: "checkout" } });
    return NextResponse.json(
      { error: "Erreur serveur. Réessayez dans quelques instants." },
      { status: 500 }
    );
  }
}
