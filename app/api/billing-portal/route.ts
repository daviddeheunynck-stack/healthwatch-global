import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

const BOM = String.fromCharCode(65279);
const clean = (v: string | undefined) => (v || "").replace(new RegExp("^" + BOM), "").trim();

export async function POST(req: NextRequest) {
  try {
    const { locale } = await req.json();
    const returnUrl = `${clean(process.env.NEXT_PUBLIC_BASE_URL) || "https://healthwatch-global.com"}/${locale || "fr"}/account`;

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
      return NextResponse.json({ error: data.error?.message || "Stripe error" }, { status: 502 });
    }

    return NextResponse.json({ url: data.url });
  } catch (e: any) {
    console.error("[billing-portal] error:", e.message);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
