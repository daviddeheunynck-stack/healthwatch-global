import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const PRICES: Record<string, Record<string, string>> = {
  starter: {
    eur: process.env.STRIPE_STARTER_EUR_PRICE_ID!,
    usd: process.env.STRIPE_STARTER_USD_PRICE_ID!,
  },
  pro: {
    eur: process.env.STRIPE_PRO_EUR_PRICE_ID!,
    usd: process.env.STRIPE_PRO_USD_PRICE_ID!,
  },
};

function getCurrency(locale: string): "eur" | "usd" {
  return locale === "fr" ? "eur" : "usd";
}

export async function POST(req: NextRequest) {
  try {
    const { plan, locale } = await req.json();
    const currency = getCurrency(locale);
    const priceId = PRICES[plan]?.[currency];

    if (!priceId) {
      return NextResponse.json({ error: "Plan ou devise invalide." }, { status: 400 });
    }

    const secretKey = (process.env.STRIPE_SECRET_KEY || "").replace(/^﻿/, "").trim();
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://healthwatch-global.com";

    const params = new URLSearchParams({
      mode: "subscription",
      "line_items[0][price]": priceId,
      "line_items[0][quantity]": "1",
      success_url: `${baseUrl}/${locale}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/${locale}/pricing`,
      allow_promotion_codes: "true",
    });

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
