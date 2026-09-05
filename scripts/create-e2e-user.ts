/**
 * Create a fresh E2E test user with Pro trial for Playwright tests.
 * Run: npx tsx scripts/create-e2e-user.ts
 */
import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";

const envPath = path.resolve(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) dotenv.config({ path: envPath });

const EMAIL = "test-e2e-playwright@healthwatch-test.dev";
const PASSWORD = "HWG_TestPlay24!";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function run() {
  // Delete existing user if present — profiles lookup instead of
  // auth.admin.listUsers() to avoid its unpaginated 1000-user limit.
  const { data: existing } = await supabase.from("profiles").select("id").eq("email", EMAIL).maybeSingle();
  if (existing) {
    await supabase.auth.admin.deleteUser(existing.id);
    console.log("Deleted existing user");
  }

  // Create fresh confirmed user
  const { data, error } = await supabase.auth.admin.createUser({
    email: EMAIL,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { locale: "fr" },
  });

  if (error || !data.user) {
    console.error("Create failed:", error?.message);
    process.exit(1);
  }

  // Set Pro trial (7 days)
  const trialEnd = new Date();
  trialEnd.setDate(trialEnd.getDate() + 7);
  const { error: updateErr } = await supabase
    .from("profiles")
    .update({ plan: "pro", trial_ends_at: trialEnd.toISOString() })
    .eq("id", data.user.id);

  if (updateErr) {
    console.error("Profile update failed:", updateErr.message);
    process.exit(1);
  }

  console.log(`✅ Test user ready`);
  console.log(`   email:    ${EMAIL}`);
  console.log(`   password: ${PASSWORD}`);
  console.log(`   plan:     pro (trial until ${trialEnd.toISOString().split("T")[0]})`);
}

run().catch((e) => { console.error(e); process.exit(1); });
