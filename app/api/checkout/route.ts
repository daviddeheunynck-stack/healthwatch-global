import { NextRequest, NextResponse } from "next/server";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const stripBOM = (val: string | undefined) =>
  (val || "").replace(/^﻿/, "").trim();

// Single paid plan: Pro — €49/month | annual: €39/month (€468/year)
const PRICES: Record<string, Record<string, Record<string, string>>> = {
  pro: {
    monthly: {
      eur: stripBOM(process.env.STRIPE_PRO_EUR_PRICE_ID),
      usd: stripBOM(process.env.STRIPE_PRO_USD_PRICE_ID),
    },
    annual: {
      eur: stripBOM(process.env.STRIPE_PRO_EUR_ANNUAL_PRICE_ID),
      usd: stripBOM(process.env.STRIPE_PRO_USD_ANNUAL_PRICE_ID),
    },
  },
};

function getCurrency(_locale: string): "eur" | "usd" {
  // Pricing page shows EUR for all locales — always bill in EUR
  return "eur";
}

const STRIPE_LOCALES: Record<string, string> = {
  fr: "fr",
  en: "en",
  es: "es",
  ar: "ar",
  id: "id",
};

export async function POST(req: NextRequest) {
  // ── Rate limiting: 10 checkout attempts per IP per hour ─────────────────────
  const ip = getClientIp(req);
  const rl = rateLimit(`checkout:${ip}`, { limit: 10, windowMs: 60 * 60 * 1000 });
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

  try {
    const { plan, locale, userId, userEmail, billing } = await req.json();
    const currency = getCurrency(locale);
    const billingPeriod = billing === "annual" ? "annual" : "monthly";
    const priceId = PRICES[plan]?.[billingPeriod]?.[currency];

    if (!priceId) {
      return NextResponse.json({ error: "Plan ou devise invalide." }, { status: 400 });
    }

    const clean = (val: string | undefined, fallback = "") =>
      (val || fallback).replace(/^﻿/, "").trim();

    const secretKey = clean(process.env.STRIPE_SECRET_KEY);
    const baseUrl = clean(process.env.NEXT_PUBLIC_BASE_URL, "https://healthwatch-global.com");

    const stripeLocale = STRIPE_LOCALES[locale] || "en";

    const params = new URLSearchParams({
      mode: "subscription",
      "line_items[0][price]": priceId,
      "line_items[0][quantity]": "1",
      success_url: `${baseUrl}/${locale}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/${locale}/pricing`,
      allow_promotion_codes: "true",
      locale: stripeLocale,
      "metadata[plan]": plan,
      "metadata[user_id]": userId || "",
      "metadata[billing]": billingPeriod,
    });

    // 14-day free trial — no credit card required
    params.set("subscription_data[trial_period_days]", "14");
    params.set("subscription_data[trial_settings][end_behavior][missing_payment_method]", "cancel");
    params.set("payment_method_collection", "if_required");

    // Pre-fill Stripe form with user email if available
    if (userEmail) {
      params.set("customer_email", userEmail);
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
      return NextResponse.json(
        { error: data.error?.message || "Erreur Stripe." },
        { status: response.status }
      );
    }

    return NextResponse.json({ url: data.url });
  } catch (err: any) {
    console.error("Checkout fetch error:", err?.message);
    return NextResponse.json(
      { error: err?.message || "Erreur serveur." },
      { status: 500 }
    );
  }
}
