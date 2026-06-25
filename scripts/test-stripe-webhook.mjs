/**
 * End-to-end Stripe webhook test.
 *
 * Forges a checkout.session.completed payload signed with the production
 * webhook secret, POSTs it to the production endpoint, then verifies the
 * profiles row was updated with stripe_customer_id / stripe_subscription_id.
 *
 * Uses the test-e2e account — reverts the change afterwards.
 *
 * Usage:  node scripts/test-stripe-webhook.mjs
 */

import crypto from "crypto";

// ── Config ────────────────────────────────────────────────────────────────────
const WEBHOOK_SECRET    = "whsec_25fbc57100ef3c27adb279de6d3b4c4570976bfa79cf04bd3ac328c13598af7b";
const SUPABASE_URL      = "https://tqznwmpkokdzrszysbcm.supabase.co";
const SERVICE_ROLE_KEY  = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRxem53bXBrb2tkenJzenlzYmNtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTM5NjQzMSwiZXhwIjoyMDk0OTcyNDMxfQ._fIWKNh438vxnLEoz_HXm0HWvbo71Ifpp-TbVJKc1kU";

// Safe test account — not a real customer
const TEST_USER_ID      = "76cc283b-4e1f-4263-9cff-6a2f5b735678";
const TEST_CUSTOMER_ID  = "cus_test_e2e_webhook_001";
const TEST_SUB_ID       = "sub_test_e2e_webhook_001";
const WEBHOOK_URL       = "https://healthwatch-global.com/api/webhook";

// ── Helpers ───────────────────────────────────────────────────────────────────
function buildSignature(payload, secret) {
  const ts      = Math.floor(Date.now() / 1000);
  const signed  = `${ts}.${payload}`;
  // Stripe uses the raw whsec_ string as the HMAC key
  const hmac    = crypto.createHmac("sha256", secret).update(signed, "utf8").digest("hex");
  return { sig: `t=${ts},v1=${hmac}` };
}

async function queryProfile(userId) {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}&select=plan,stripe_customer_id,stripe_subscription_id,trial_ends_at`,
    {
      headers: {
        apikey: SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      },
    }
  );
  const rows = await res.json();
  return rows[0] ?? null;
}

async function resetProfile(userId, originalTrialEndsAt) {
  await fetch(
    `${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}`,
    {
      method: "PATCH",
      headers: {
        apikey: SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        stripe_customer_id: null,
        stripe_subscription_id: null,
        trial_ends_at: originalTrialEndsAt ?? null,
      }),
    }
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
console.log("=== Stripe Webhook E2E Test ===\n");

// 1. Before state
const before = await queryProfile(TEST_USER_ID);
console.log("BEFORE:", before);

// 2. Build event
const event = {
  id:          "evt_test_e2e_" + Date.now(),
  object:      "event",
  api_version: "2026-04-22.dahlia",
  created:     Math.floor(Date.now() / 1000),
  livemode:    false,
  type:        "checkout.session.completed",
  data: {
    object: {
      id:             "cs_test_e2e_" + Date.now(),
      object:         "checkout.session",
      mode:           "subscription",
      payment_status: "paid",
      status:         "complete",
      metadata: {
        user_id: TEST_USER_ID,
        plan:    "pro",
        billing: "monthly",
      },
      customer:        TEST_CUSTOMER_ID,
      subscription:    TEST_SUB_ID,
      customer_details: {
        email: "test-e2e-20260618@healthwatch-test.dev",
      },
    },
  },
};

const body       = JSON.stringify(event);
const { sig }    = buildSignature(body, WEBHOOK_SECRET);

console.log("\nPOSTing to:", WEBHOOK_URL);
console.log("Payload type:", event.type);

// 3. Send webhook
const res = await fetch(WEBHOOK_URL, {
  method: "POST",
  headers: {
    "Content-Type":    "application/json",
    "stripe-signature": sig,
  },
  body,
});

const responseText = await res.text();
console.log("\nHTTP status:", res.status);
console.log("Response body:", responseText);

if (res.status !== 200) {
  console.error("\n❌ Webhook rejected — not checking DB");
  process.exit(1);
}

// 4. Wait a moment then check DB
await new Promise(r => setTimeout(r, 1500));
const after = await queryProfile(TEST_USER_ID);
console.log("\nAFTER:", after);

// 5. Validate
const ok =
  after?.stripe_customer_id === TEST_CUSTOMER_ID &&
  after?.stripe_subscription_id === TEST_SUB_ID;

if (ok) {
  console.log("\n✅ PASS — stripe_customer_id and stripe_subscription_id written to DB");
} else {
  console.error("\n❌ FAIL — DB not updated as expected");
  console.log("Expected stripe_customer_id:", TEST_CUSTOMER_ID);
  console.log("Got:", after?.stripe_customer_id);
  console.log("Expected stripe_subscription_id:", TEST_SUB_ID);
  console.log("Got:", after?.stripe_subscription_id);
}

// 6. Revert test user (restore trial_ends_at captured before the test)
await resetProfile(TEST_USER_ID, before?.trial_ends_at ?? null);
const reverted = await queryProfile(TEST_USER_ID);
console.log("\nReverted:", reverted);
console.log("\nDone.");
