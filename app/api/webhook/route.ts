import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";

export const dynamic = "force-dynamic";

// Raw body is required for Stripe signature verification — do NOT parse as JSON
export const runtime = "nodejs";

const BOM = String.fromCharCode(65279);
const clean = (v: string | undefined) => (v || "").replace(new RegExp("^" + BOM), "").trim();

const stripe = new Stripe(clean(process.env.STRIPE_SECRET_KEY), {
  apiVersion: "2026-04-22.dahlia",
  httpClient: Stripe.createFetchHttpClient(),
});

function getSupabase() {
  return createClient(
    clean(process.env.NEXT_PUBLIC_SUPABASE_URL),
    clean(process.env.SUPABASE_SERVICE_ROLE_KEY)
  );
}

/** Resolve the Supabase user id from a Stripe customer id */
async function getUserIdFromCustomer(customerId: string): Promise<string | null> {
  const supabase = getSupabase();
  const { data } = await supabase
    .from("profiles")
    .select("id")
    .eq("stripe_customer_id", customerId)
    .single();
  return data?.id ?? null;
}

/** Map Stripe price id → plan name */
function planFromPriceId(priceId: string | null | undefined): string {
  const BOM2 = String.fromCharCode(65279);
  const c = (v: string | undefined) => (v || "").replace(new RegExp("^" + BOM2), "").trim();
  if (priceId === c(process.env.STRIPE_STARTER_EUR_PRICE_ID) || priceId === c(process.env.STRIPE_STARTER_USD_PRICE_ID)) return "starter";
  if (priceId === c(process.env.STRIPE_PRO_EUR_PRICE_ID) || priceId === c(process.env.STRIPE_PRO_USD_PRICE_ID)) return "pro";
  return "starter"; // safe fallback for unknown paid price
}

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature");

  if (!sig) {
    return NextResponse.json({ error: "Missing stripe-signature header" }, { status: 400 });
  }

  const webhookSecret = clean(process.env.STRIPE_WEBHOOK_SECRET);
  if (!webhookSecret) {
    console.error("[webhook] STRIPE_WEBHOOK_SECRET not set");
    return NextResponse.json({ error: "Webhook secret not configured" }, { status: 500 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err: any) {
    console.error("[webhook] Signature verification failed:", err.message);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const supabase = getSupabase();

  try {
    switch (event.type) {

      // ─── Payment completed → activate plan ────────────────────────────────
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.user_id;
        const plan = session.metadata?.plan || "starter";

        if (userId) {
          const { error } = await supabase
            .from("profiles")
            .update({
              plan,
              stripe_customer_id: session.customer as string,
              stripe_subscription_id: session.subscription as string,
            })
            .eq("id", userId);
          if (error) console.error("[webhook] checkout.session.completed profile update:", error);
          else console.log(`[webhook] Plan set to ${plan} for user ${userId}`);
        }

        // Auto-subscribe to weekly digest
        const email = session.customer_details?.email;
        if (email) {
          await supabase
            .from("subscriptions")
            .upsert(
              { email, region: "allRegions", locale: "en", active: true },
              { onConflict: "email", ignoreDuplicates: true }
            );
        }
        break;
      }

      // ─── Subscription updated (plan change, renewal, etc.) ────────────────
      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        const customerId = sub.customer as string;
        const userId = await getUserIdFromCustomer(customerId);
        if (!userId) break;

        const priceId = sub.items.data[0]?.price?.id;
        const status = sub.status;

        if (status === "active" || status === "trialing") {
          const plan = planFromPriceId(priceId);
          const { error } = await supabase
            .from("profiles")
            .update({ plan, stripe_subscription_id: sub.id })
            .eq("id", userId);
          if (error) console.error("[webhook] subscription.updated:", error);
          else console.log(`[webhook] Subscription updated → plan ${plan} for user ${userId}`);
        } else if (status === "canceled" || status === "unpaid" || status === "past_due") {
          // Don't immediately downgrade on past_due — let invoice.payment_failed handle it
          if (status === "canceled") {
            const { error } = await supabase
              .from("profiles")
              .update({ plan: "free", stripe_subscription_id: null })
              .eq("id", userId);
            if (error) console.error("[webhook] subscription.updated cancel:", error);
            else console.log(`[webhook] Subscription cancelled → plan free for user ${userId}`);
          }
        }
        break;
      }

      // ─── Subscription cancelled ────────────────────────────────────────────
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const customerId = sub.customer as string;
        const userId = await getUserIdFromCustomer(customerId);
        if (!userId) break;

        const { error } = await supabase
          .from("profiles")
          .update({ plan: "free", stripe_subscription_id: null })
          .eq("id", userId);
        if (error) console.error("[webhook] subscription.deleted:", error);
        else console.log(`[webhook] Subscription deleted → plan free for user ${userId}`);
        break;
      }

      // ─── Payment failed → optional: notify or flag account ───────────────
      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;
        const userId = await getUserIdFromCustomer(customerId);
        if (!userId) break;
        // Log for now — don't immediately downgrade (Stripe retries 3× by default)
        console.warn(`[webhook] Payment failed for customer ${customerId} (user ${userId})`);
        break;
      }

      // ─── Payment succeeded (renewal) — ensure plan stays active ──────────
      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice;
        // Only act on subscription renewals, not the initial charge (handled by checkout.session.completed)
        if (invoice.billing_reason !== "subscription_cycle") break;

        const customerId = invoice.customer as string;
        const userId = await getUserIdFromCustomer(customerId);
        if (!userId) break;

        const lineItem = invoice.lines?.data[0] as any;
        const priceId = lineItem?.price?.id ?? lineItem?.pricing?.price_details?.price;
        const plan = planFromPriceId(priceId);
        const { error } = await supabase
          .from("profiles")
          .update({ plan })
          .eq("id", userId);
        if (error) console.error("[webhook] invoice.payment_succeeded renewal:", error);
        else console.log(`[webhook] Subscription renewed → plan ${plan} for user ${userId}`);
        break;
      }

      default:
        // Ignore unhandled event types
        break;
    }
  } catch (err: any) {
    console.error("[webhook] Handler error:", err.message);
    // Return 200 so Stripe doesn't retry — log the error for investigation
    return NextResponse.json({ received: true, warning: err.message });
  }

  return NextResponse.json({ received: true });
}
