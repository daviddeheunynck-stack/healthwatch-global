/**
 * Usage:
 *   node scripts/e2e-test-user.mjs create   → creates test user, outputs env vars
 *   node scripts/e2e-test-user.mjs delete   → deletes test user
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

// Load .env.local manually (no dotenv dependency needed)
const envPath = new URL("../.env.local", import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1");
const envLines = readFileSync(envPath, "utf8").split("\n");
const env = {};
for (const line of envLines) {
  const m = line.match(/^([^#=\s]+)\s*=\s*(.*)$/);
  if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
}

const SUPABASE_URL     = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const TEST_EMAIL       = "playwright@healthwatch-global.com";
const TEST_PASSWORD    = "E2eTestHWG2026!";

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const action = process.argv[2];

if (action === "create") {
  // Try to delete existing first (idempotent setup) — profiles lookup
  // instead of auth.admin.listUsers() to avoid its unpaginated 1000-user limit.
  const { data: found } = await admin.from("profiles").select("id").eq("email", TEST_EMAIL).maybeSingle();
  if (found) {
    await admin.auth.admin.deleteUser(found.id);
  }

  const { data, error } = await admin.auth.admin.createUser({
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
    email_confirm: true,
  });

  if (error) {
    console.error("Failed to create test user:", error.message);
    process.exit(1);
  }

  // Activate 14-day trial so isPaid=true in dashboard
  await admin.from("profiles").update({
    plan: "pro",
    trial_ends_at: new Date(Date.now() + 14 * 86_400_000).toISOString(),
    locale: "fr",
  }).eq("id", data.user.id);

  console.log(`TEST_USER_EMAIL=${TEST_EMAIL}`);
  console.log(`TEST_USER_PASSWORD=${TEST_PASSWORD}`);
  console.log(`TEST_USER_ID=${data.user.id}`);

} else if (action === "delete") {
  const { data: found } = await admin.from("profiles").select("id").eq("email", TEST_EMAIL).maybeSingle();
  if (found) {
    await admin.auth.admin.deleteUser(found.id);
    console.log("Test user deleted.");
  } else {
    console.log("Test user not found.");
  }
} else {
  console.error("Usage: node scripts/e2e-test-user.mjs create|delete");
  process.exit(1);
}
