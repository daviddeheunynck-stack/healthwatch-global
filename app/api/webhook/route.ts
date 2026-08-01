import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";
import * as Sentry from "@sentry/nextjs";
import { buildUpgradeEmail }        from "@/lib/upgrade-email";
import { buildChurnEmail }          from "@/lib/churn-email";
import { buildPaymentFailedEmail }  from "@/lib/payment-failed-email";
import { buildTrialEndingEmail }    from "@/lib/trial-ending-email";
import { enrollAlertRegions } from "@/lib/activate-trial";
import { errorMessage } from "@/lib/error";

export const dynamic = "force-dynamic";

// Raw body is required for Stripe signature verification — do NOT parse as JSON
export const runtime = "nodejs";

const BOM        = String.fromCharCode(65279);
const clean      = (v: string | undefined) => (v || "").replace(new RegExp("^" + BOM), "").trim();
const BREVO_KEY  = clean(process.env.BREVO_API_KEY);

async function sendTransactionalEmail(
  to: string,
  subject: string,
  html: string,
  tag: string
) {
  if (!BREVO_KEY) return;
  try {
    await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "api-key": BREVO_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({
        sender:      { name: "HealthWatch Global", email: "alerts@healthwatch-global.com" },
        to:          [{ email: to }],
        subject,
        htmlContent: html,
      }),
    });
  } catch (err) {
    console.error(`[webhook] ${tag} email failed:`, err);
    Sentry.captureException(err, { tags: { route: "stripe-webhook", tag } });
  }
}

async function sendUpgradeEmail(
  to: string,
  plan: "starter" | "pro" | "team" | "enterprise",
  locale: string
) {
  const { subject, html } = buildUpgradeEmail(plan, locale);
  await sendTransactionalEmail(to, subject, html, "upgrade");
}

async function sendChurnEmail(
  to: string,
  plan: "starter" | "pro" | "team" | "enterprise",
  locale: string
) {
  const { subject, html } = buildChurnEmail(plan, locale);
  await sendTransactionalEmail(to, subject, html, "churn");
}

async function sendPaymentFailedEmail(to: string, locale: string) {
  const { subject, html } = buildPaymentFailedEmail(locale);
  await sendTransactionalEmail(to, subject, html, "payment_failed");
}

async function sendTrialEndingEmail(
  to: string,
  plan: "starter" | "pro",
  locale: string,
  trialEndsAt: string,
  hasPaymentMethod = false
) {
  const { subject, html } = buildTrialEndingEmail(plan, locale, trialEndsAt, hasPaymentMethod);
  await sendTransactionalEmail(to, subject, html, "trial_ending");
}

let _stripe: Stripe | null = null;
function getStripe() {
  return (_stripe ??= new Stripe(clean(process.env.STRIPE_SECRET_KEY), {
    apiVersion: "2026-04-22.dahlia",
    httpClient: Stripe.createFetchHttpClient(),
  }));
}

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

/**
 * Resolve userId from a Stripe Subscription object.
 * Primary: look up by stripe_customer_id (fast, indexed).
 * Fallback: use sub.metadata.user_id if stripe_customer_id lookup fails —
 * this recovers from cases where checkout.session.completed didn't link
 * stripe_customer_id (e.g. cold-start timeout). When falling back, also
 * patch stripe_customer_id into the profile so future lookups succeed.
 */
async function resolveUserFromSubscription(
  sub: Stripe.Subscription
): Promise<string | null> {
  const customerId = sub.customer as string;
  const supabase = getSupabase();

  // Primary path
  const primary = await getUserIdFromCustomer(customerId);
  if (primary) return primary;

  // Fallback: subscription metadata set by checkout route
  const metaUserId = sub.metadata?.user_id;
  if (!metaUserId) return null;

  // Heal the profile — link stripe_customer_id and stripe_subscription_id
  const { error } = await supabase
    .from("profiles")
    .update({ stripe_customer_id: customerId, stripe_subscription_id: sub.id })
    .eq("id", metaUserId);
  if (error) {
    console.error("[webhook] resolveUserFromSubscription heal failed:", error);
    Sentry.captureException(new Error(`[webhook] resolveUserFromSubscription heal failed: ${error.message}`), { tags: { route: "stripe-webhook", user_id: metaUserId } });
  } else {
    console.log(`[webhook] Healed stripe_customer_id for user ${metaUserId} via subscription metadata`);
  }
  return metaUserId;
}

/** Get user email + locale from profiles (locale preferred over subscriptions fallback) */
async function getUserProfile(userId: string): Promise<{ email: string; locale: string } | null> {
  const supabase = getSupabase();
  const { data } = await supabase
    .from("profiles")
    .select("email, locale")
    .eq("id", userId)
    .single();
  if (!data?.email) return null;
  return { email: data.email, locale: data.locale ?? "en" };
}

/** Map Stripe price id → plan name */
function planFromPriceId(priceId: string | null | undefined): string {
  const BOM2 = String.fromCharCode(65279);
  const c = (v: string | undefined) => (v || "").replace(new RegExp("^" + BOM2), "").trim();

  const PRO_IDS = new Set([
    c(process.env.STRIPE_PRO_EUR_PRICE_ID),
    c(process.env.STRIPE_PRO_USD_PRICE_ID),
    c(process.env.STRIPE_PRO_EUR_ANNUAL_PRICE_ID),
    c(process.env.STRIPE_PRO_USD_ANNUAL_PRICE_ID),
  ].filter(Boolean));

  const TEAM_IDS = new Set([
    c(process.env.STRIPE_TEAM_EUR_PRICE_ID),
    c(process.env.STRIPE_TEAM_EUR_ANNUAL_PRICE_ID),
    c(process.env.STRIPE_TEAM_USD_PRICE_ID),
    c(process.env.STRIPE_TEAM_USD_ANNUAL_PRICE_ID),
  ].filter(Boolean));

  if (priceId && PRO_IDS.has(priceId)) return "pro";
  if (priceId && TEAM_IDS.has(priceId)) return "team";

  console.warn(`[webhook] Unknown price ID: ${priceId} — defaulting to pro`);
  return "pro";
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
    event = getStripe().webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err: unknown) {
    console.error("[webhook] Signature verification failed:", errorMessage(err));
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const supabase = getSupabase();

  try {
    switch (event.type) {

      // ─── Payment completed → activate plan ────────────────────────────────
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.user_id;
        const plan = session.metadata?.plan || "pro";

        if (userId) {
          // Fetch subscription to read trial_end
          let trialEndsAt: string | null = null;
          if (session.subscription) {
            try {
              const sub = await getStripe().subscriptions.retrieve(session.subscription as string);
              if (sub.trial_end) {
                trialEndsAt = new Date(sub.trial_end * 1000).toISOString();
              }
            } catch (e) {
              console.warn("[webhook] Could not retrieve subscription for trial_end:", e);
            }
          }

          const updateData: Record<string, unknown> = { plan, trial_ends_at: trialEndsAt };
          if (session.customer) updateData.stripe_customer_id = session.customer;
          if (session.subscription) updateData.stripe_subscription_id = session.subscription;

          const { error } = await supabase
            .from("profiles")
            .update(updateData)
            .eq("id", userId);
          if (error) {
            console.error("[webhook] checkout.session.completed profile update:", error);
            Sentry.captureException(new Error(`[webhook] checkout.session.completed DB update failed: ${error.message}`), {
              tags: { event_type: "checkout.session.completed", plan, user_id: userId },
            });
          } else {
            console.log(`[webhook] Plan set to ${plan} for user ${userId} (trial_ends_at: ${trialEndsAt})`);

            // Default-enroll into regional alerts (opt-out, not opt-in) — same helper
            // as the trial/pilot activation paths (lib/activate-trial.ts). Found
            // 2026-08-01: a customer paying directly through Stripe Checkout without
            // ever going through a trial (signup, OAuth, or pilot invite) never hit
            // any of the paths that enroll regions, so they'd have Pro access with 0
            // alerts indefinitely. Upsert is idempotent — a no-op for anyone who
            // already has regions from an earlier trial. Best-effort: a failure here
            // must not affect the paid activation itself.
            await enrollAlertRegions(supabase, userId, "webhook/checkout");
          }
        }

        // Auto-subscribe to weekly digest + send upgrade welcome email
        const userProfile = userId ? await getUserProfile(userId) : null;
        const email       = userProfile?.email ?? session.customer_details?.email ?? null;
        const locale      = userProfile?.locale ?? "en";

        if (email) {
          // Upsert digest subscription using the profile's actual locale
          await supabase
            .from("subscriptions")
            .upsert(
              { email, region: "allRegions", locale, active: true },
              { onConflict: "email" }
            );

          if (["starter", "pro", "team", "enterprise"].includes(plan)) {
            await sendUpgradeEmail(email, plan as "starter" | "pro" | "team" | "enterprise", locale);
          }
        }
        break;
      }

      // ─── Subscription updated (plan change, renewal, etc.) ────────────────
      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        const userId = await resolveUserFromSubscription(sub);
        if (!userId) break;

        const priceId = sub.items.data[0]?.price?.id;
        const status = sub.status;

        if (status === "active" || status === "trialing") {
          const plan = planFromPriceId(priceId);
          const trialEndsAt = sub.trial_end
            ? new Date(sub.trial_end * 1000).toISOString()
            : null;
          const { error } = await supabase
            .from("profiles")
            .update({ plan, stripe_subscription_id: sub.id, trial_ends_at: trialEndsAt })
            .eq("id", userId);
          if (error) {
            console.error("[webhook] subscription.updated:", error);
            Sentry.captureException(new Error(`[webhook] subscription.updated DB failed: ${error.message}`), {
              tags: { event_type: "customer.subscription.updated", plan, user_id: userId },
            });
          } else {
            console.log(`[webhook] Subscription updated → plan ${plan} for user ${userId} (trial_ends_at: ${trialEndsAt})`);
          }
        } else if (status === "canceled" || status === "unpaid" || status === "past_due") {
          // Don't immediately downgrade on past_due — let invoice.payment_failed handle it
          if (status === "canceled") {
            const { error } = await supabase
              .from("profiles")
              .update({ plan: "free", stripe_subscription_id: null, trial_ends_at: null })
              .eq("id", userId);
            if (error) {
              console.error("[webhook] subscription.updated cancel:", error);
              Sentry.captureException(new Error(`[webhook] subscription.updated cancel DB failed: ${error.message}`), { tags: { event_type: "customer.subscription.updated", user_id: userId } });
            }
            else console.log(`[webhook] Subscription cancelled → plan free for user ${userId}`);
          }
        }
        break;
      }

      // ─── Subscription cancelled ────────────────────────────────────────────
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const userId = await resolveUserFromSubscription(sub);
        if (!userId) break;

        // Fetch current plan + email + locale before downgrading
        const { data: profile } = await supabase
          .from("profiles")
          .select("plan, email")
          .eq("id", userId)
          .single();

        const cancelledPlan = (profile?.plan ?? "starter") as "starter" | "pro" | "team" | "enterprise";
        const userEmail     = profile?.email as string | null;

        const { error } = await supabase
          .from("profiles")
          // Keep trial_ends_at as a sentinel (past date) so activate-trial cannot grant a new free trial to ex-subscribers
          .update({ plan: "free", stripe_subscription_id: null, trial_ends_at: new Date().toISOString(), team_id: null })
          .eq("id", userId);

        if (error) {
          console.error("[webhook] subscription.deleted:", error);
          Sentry.captureException(new Error(`[webhook] subscription.deleted DB failed: ${error.message}`), { tags: { event_type: "customer.subscription.deleted", user_id: userId } });
        } else {
          console.log(`[webhook] Subscription deleted → plan free for user ${userId}`);

          // If team plan cancelled, revoke all member access and delete the team
          if (cancelledPlan === "team") {
            const { data: ownedTeam } = await supabase
              .from("teams")
              .select("id")
              .eq("owner_id", userId)
              .maybeSingle();

            if (ownedTeam) {
              // Collect non-owner member ids before cascade delete
              const { data: memberRows } = await supabase
                .from("team_members")
                .select("user_id")
                .eq("team_id", ownedTeam.id)
                .neq("user_id", userId);

              const memberIds = (memberRows ?? []).map((m: { user_id: string }) => m.user_id);
              if (memberIds.length > 0) {
                await supabase
                  .from("profiles")
                  .update({ plan: "free", team_id: null })
                  .in("id", memberIds);
              }

              // Delete team — cascades to team_members and team_invites
              await supabase.from("teams").delete().eq("id", ownedTeam.id);
              console.log(`[webhook] Team ${ownedTeam.id} disbanded — ${memberIds.length} member(s) reverted to free`);
            }
          }

          // If team/enterprise plan cancelled, also clean up any owned
          // "organization" — a separate investigation-sharing feature (see
          // supabase/migrations/20260621230000_organizations.sql) that isn't
          // tied to profiles.plan the way "teams" is, so nothing else revokes
          // member access to shared investigations once the subscription
          // funding it ends. Covers enterprise too (MAX_SEATS in app/api/org/
          // route.ts allows both), unlike the "teams" system above which is
          // team-plan only.
          if (["team", "enterprise"].includes(cancelledPlan)) {
            const { data: ownedOrg } = await supabase
              .from("organizations")
              .select("id")
              .eq("owner_id", userId)
              .maybeSingle();

            if (ownedOrg) {
              // Deleting the org cascades to organization_members and org_activity_log
              await supabase.from("organizations").delete().eq("id", ownedOrg.id);
              console.log(`[webhook] Organization ${ownedOrg.id} deleted — owner's ${cancelledPlan} subscription cancelled`);
            }
          }

          // Send churn email (fire-and-forget)
          if (userEmail && ["starter", "pro", "team", "enterprise"].includes(cancelledPlan)) {
            const churnProfile = await getUserProfile(userId);
            const locale = churnProfile?.locale ?? "en";
            sendChurnEmail(userEmail, cancelledPlan, locale).catch((e) => {
              console.error("[webhook] churn email:", e);
              Sentry.captureException(e, { tags: { event_type: "customer.subscription.deleted", user_id: userId } });
            });
          }
        }
        break;
      }

      // ─── Payment failed → notify user (Stripe retries automatically) ────
      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;
        const userId = await getUserIdFromCustomer(customerId);
        if (!userId) break;

        console.warn(`[webhook] Payment failed for customer ${customerId} (user ${userId})`);

        const failedProfile = await getUserProfile(userId);
        if (failedProfile) {
          sendPaymentFailedEmail(failedProfile.email, failedProfile.locale).catch((e) => {
            console.error("[webhook] payment_failed email:", e);
            Sentry.captureException(e, { tags: { event_type: "invoice.payment_failed", user_id: userId } });
          });
        }
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

        const lineItem = invoice.lines?.data[0];
        // `price_details.price` is typed as `string | Stripe.Price` — webhooks
        // send unexpanded references (a bare price-ID string) in practice, but
        // we handle the expanded-object shape too rather than assume either way.
        // (No `.price` directly on InvoiceLineItem at this API version — that's
        // the Subscription-item shape used in the cases above, not the invoice one.)
        const priceRef = lineItem?.pricing?.price_details?.price;
        const priceId = typeof priceRef === "string" ? priceRef : priceRef?.id;
        const plan = planFromPriceId(priceId);
        const { error } = await supabase
          .from("profiles")
          .update({ plan })
          .eq("id", userId);
        if (error) {
          console.error("[webhook] invoice.payment_succeeded renewal:", error);
          Sentry.captureException(new Error(`[webhook] invoice.payment_succeeded renewal DB failed: ${error.message}`), { tags: { event_type: "invoice.payment_succeeded", plan, user_id: userId } });
        }
        else console.log(`[webhook] Subscription renewed → plan ${plan} for user ${userId}`);
        break;
      }

      // ─── Trial ending in 3 days (Stripe native event) ────────────────────
      // Complements the daily cron — more reliable as Stripe retries on failure.
      // Requires "customer.subscription.trial_will_end" enabled in Stripe Dashboard
      // webhook settings (fired 3 days before trial_end by default).
      case "customer.subscription.trial_will_end": {
        const sub = event.data.object as Stripe.Subscription;
        const userId = await resolveUserFromSubscription(sub);
        if (!userId) break;

        const priceId = sub.items.data[0]?.price?.id;
        const plan = planFromPriceId(priceId) as "starter" | "pro";
        if (plan !== "starter" && plan !== "pro") break;

        const trialEnd = sub.trial_end
          ? new Date(sub.trial_end * 1000).toISOString()
          : null;
        if (!trialEnd) break;

        const trialProfile = await getUserProfile(userId);
        if (!trialProfile) break;

        // If the subscription already has a default payment method, the user
        // is on track for automatic renewal — tell them so, not "add payment method".
        const hasPaymentMethod = !!sub.default_payment_method;

        sendTrialEndingEmail(trialProfile.email, plan, trialProfile.locale, trialEnd, hasPaymentMethod).catch((e) => {
          console.error("[webhook] trial_ending email:", e);
          Sentry.captureException(e, { tags: { event_type: "customer.subscription.trial_will_end", user_id: userId } });
        });

        console.log(`[webhook] trial_will_end → email sent (plan ${plan}, ends ${trialEnd}, hasPaymentMethod: ${hasPaymentMethod})`);
        break;
      }

      default:
        // Ignore unhandled event types
        break;
    }
  } catch (err: unknown) {
    console.error("[webhook] Handler error:", errorMessage(err));
    Sentry.captureException(err, { tags: { event_type: event.type } });
    // Return 200 so Stripe doesn't retry — log the error for investigation
    return NextResponse.json({ received: true, warning: errorMessage(err) });
  }

  return NextResponse.json({ received: true });
}
