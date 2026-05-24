import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const BOM = String.fromCharCode(65279);
const clean = (val: string | undefined) =>
  (val || "").replace(new RegExp("^" + BOM), "").trim();

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature");

  if (!sig) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    console.error("Webhook signature error:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as any;
    const email = session.customer_details?.email;
    const plan = session.metadata?.plan || "starter";
    const userId = session.metadata?.user_id;

    // Use service_role key to bypass RLS
    const supabase = createClient(
      clean(process.env.NEXT_PUBLIC_SUPABASE_URL),
      clean(process.env.SUPABASE_SERVICE_ROLE_KEY)
    );

    // Update the user's plan in profiles
    if (userId) {
      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          plan,
          stripe_customer_id: session.customer,
          stripe_subscription_id: session.subscription,
        })
        .eq("id", userId);

      if (profileError) {
        console.error("Failed to update profile:", profileError);
      } else {
        console.log(`Plan updated to ${plan} for user ${userId}`);
      }
    }

    // Also upsert email subscription for weekly digest
    if (email) {
      await supabase.from("subscriptions").upsert(
        { email, region: "allRegions", locale: "fr", active: true },
        { onConflict: "email", ignoreDuplicates: true }
      );
    }
  }

  return NextResponse.json({ received: true });
}
