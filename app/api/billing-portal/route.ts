import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { errorMessage } from "@/lib/error";
import * as Sentry from "@sentry/nextjs";

export const dynamic = "force-dynamic";

const BOM = String.fromCharCode(65279);
const clean = (v: string | undefined) => (v || "").replace(new RegExp("^" + BOM), "").trim();

export async function POST(req: NextRequest) {
  try {
    const { locale: rawLocale } = await req.json();
    const safeLocale = ["fr", "en", "es", "ar", "id"].includes(rawLocale) ? rawLocale : "fr";
    const returnUrl = `${clean(process.env.NEXT_PUBLIC_BASE_URL) || "https://healthwatch-global.com"}/${safeLocale}/account`;

    // Get authenticated user
    const supabase = await createClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();

    if (authErr || !user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    // Fetch Stripe customer ID from profiles
    const { data: profile } = await supabase
      .from("profiles")
      .select("stripe_customer_id")
      .eq("id", user.id)
      .single();

    if (!profile?.stripe_customer_id) {
      return NextResponse.json({ error: "No billing account found" }, { status: 404 });
    }

    // Create Stripe Customer Portal session
    const secretKey = clean(process.env.STRIPE_SECRET_KEY);
    const params = new URLSearchParams({
      customer: profile.stripe_customer_id,
      return_url: returnUrl,
    });

    const res = await fetch("https://api.stripe.com/v1/billing_portal/sessions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${secretKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
        "Stripe-Version": "2026-04-22.dahlia",
      },
      body: params.toString(),
    });

    const data = await res.json();

    if (!res.ok) {
      console.error("[billing-portal] Stripe error:", data);
      Sentry.captureException(new Error(`[billing-portal] Stripe error: ${data.error?.message ?? res.status}`), {
        tags: { route: "billing-portal", user_id: user.id },
      });
      return NextResponse.json({ error: data.error?.message || "Stripe error" }, { status: 502 });
    }

    return NextResponse.json({ url: data.url });
  } catch (e: unknown) {
    console.error("[billing-portal] error:", errorMessage(e));
    Sentry.captureException(e, { tags: { route: "billing-portal" } });
    return NextResponse.json({ error: errorMessage(e) }, { status: 500 });
  }
}
