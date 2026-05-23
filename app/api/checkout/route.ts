import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";

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

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://healthwatch-global.com";

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${baseUrl}/${locale}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/${locale}/pricing`,
      allow_promotion_codes: true,
    });

    return NextResponse.json({ url: session.url });
  } catch (err: any) {
    console.error("Stripe checkout error:", JSON.stringify({
      message: err?.message,
      type: err?.type,
      code: err?.code,
      param: err?.param,
      statusCode: err?.statusCode,
    }));
    return NextResponse.json({
      error: err?.message || "Erreur lors de la création du paiement."
    }, { status: 500 });
  }
}
