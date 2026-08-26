/**
 * Extend a user's Pro trial by N days.
 * Works for users with no Stripe subscription OR with a canceled Stripe subscription.
 * Run: npx tsx scripts/extend-trial.ts <email> <days>
 *
 * 2026-08-26, two fixes on the same symptom ("User not found: ...") —
 * the second one is the actual root cause, the first was real but not it:
 *
 * 1. Was looking the user up with
 *      supabase.from("profiles").eq("email", email).single()
 *    — an exact, case-sensitive match against profiles.email. Switched to
 *    resolving identity through Supabase Auth (case-insensitive, and the
 *    actual source of truth for login) the same way target-dossier.mjs and
 *    the Pasteur/Georgetown scripts do, then working by user id from there.
 *    Genuine improvement, but re-running still failed — with "User not
 *    found in Auth", meaning the Auth admin call succeeded but returned a
 *    user list that simply didn't include Ethan at all.
 *
 * 2. The actual cause: this script loaded `.env.local` — the ordinary
 *    Next.js dev env file — while every sibling admin script
 *    (target-dossier.mjs, reconfigure-pasteur-ma-2026-08-26.mjs,
 *    provision-hsoc-georgetown-2026-08-24.mjs) reads `.env.local.live` and
 *    explicitly refuses to run unless that file's Supabase URL contains the
 *    production project ref. This script had neither: it was silently
 *    querying whatever project `.env.local` points to (almost certainly a
 *    dev/staging project), where Ethan's account never existed — hence a
 *    clean, error-free "not found" instead of a connection failure. Fixed
 *    by reading `.env.local.live` with the same manual, BOM-safe parser the
 *    other production scripts use (dotenv's parser doesn't strip a leading
 *    BOM, which corrupts the first variable name in that file), and adding
 *    the same production-project guard so this can never again run quietly
 *    against the wrong database.
 *
 * Also stopped calling process.exit() on early-exit paths. On Windows this
 * script was crashing with "Assertion failed: !(handle->flags &
 * UV_HANDLE_CLOSING), file src\win\async.c" — a known Node/libuv issue where
 * process.exit() forcibly tears down an in-flight async handle (here, the
 * Supabase client's underlying fetch keep-alive socket) instead of letting
 * it close on its own. Using process.exitCode + return lets Node exit
 * normally once the event loop drains, so no handle is closed mid-flight.
 */
import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";
import { readFileSync } from "fs";

const BOM = String.fromCharCode(65279);
const clean = (v: string | undefined) => (v || "").replace(new RegExp("^" + BOM), "").trim().replace(/^"(.*)"$/, "$1");

// Relative to cwd, same as scripts/target-dossier.mjs — this script is always
// run as `npx tsx scripts/extend-trial.ts ...` from the repo root.
function parseEnvLocalLive(): Record<string, string> {
  const raw = readFileSync(".env.local.live", "utf8");
  const vars: Record<string, string> = {};
  raw.split("\n").forEach((line) => {
    const l = line.replace(new RegExp("^" + BOM), "");
    if (!l.trim() || l.trim().startsWith("#")) return;
    const idx = l.indexOf("=");
    if (idx < 0) return;
    vars[clean(l.slice(0, idx))] = clean(l.slice(idx + 1));
  });
  return vars;
}

const env = parseEnvLocalLive();

const emailArg = process.argv[2];
const days     = parseInt(process.argv[3] ?? "14", 10);

const SUPABASE_URL = clean(env["NEXT_PUBLIC_SUPABASE_URL"]);
const SERVICE_KEY  = clean(env["SUPABASE_SERVICE_ROLE_KEY"]);

if (!SUPABASE_URL.includes("tqznwmpkokdzrszysbcm")) {
  throw new Error("Refus : .env.local.live ne pointe pas vers le projet de production.");
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

const stripe = new Stripe(clean(env["STRIPE_SECRET_KEY"]), {
  apiVersion: "2026-04-22.dahlia",
});

// Case-insensitive lookup through Auth — the same approach as
// scripts/target-dossier.mjs — instead of an exact-case match on
// profiles.email, which is just a copy and can disagree in case.
async function findUserIdByEmail(email: string): Promise<string | null> {
  const headers = { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` };
  const target = email.trim().toLowerCase();
  for (let page = 1; ; page++) {
    const res = await fetch(
      `${SUPABASE_URL}/auth/v1/admin/users?per_page=200&page=${page}`,
      { headers },
    );
    if (!res.ok) throw new Error(`GET auth/v1/admin/users : ${res.status} ${(await res.text()).slice(0, 160)}`);
    const { users } = await res.json();
    const hit = (users ?? []).find((u: { email?: string }) => (u.email ?? "").toLowerCase() === target);
    if (hit) return hit.id;
    if (!users?.length || users.length < 200) return null;
  }
}

async function run(emailArg: string) {
  const userId = await findUserIdByEmail(emailArg);
  if (!userId) {
    console.error("User not found in Auth:", emailArg);
    process.exitCode = 1;
    return;
  }

  const { data: profile, error: fetchErr } = await supabase
    .from("profiles")
    .select("id, email, plan, trial_ends_at, stripe_subscription_id")
    .eq("id", userId)
    .single();

  if (fetchErr || !profile) {
    console.error("Auth user exists but has no profile row:", emailArg, fetchErr?.message);
    process.exitCode = 1;
    return;
  }

  console.log("Current DB state:");
  console.log(`  id:                  ${profile.id}`);
  console.log(`  email (profiles):    ${profile.email}`);
  console.log(`  plan:                ${profile.plan}`);
  console.log(`  trial_ends_at:       ${profile.trial_ends_at ?? "null"}`);
  console.log(`  stripe_subscription: ${profile.stripe_subscription_id ?? "none"}`);

  // If there's a Stripe subscription ID, check whether it's actually active
  if (profile.stripe_subscription_id) {
    let sub: Stripe.Subscription;
    try {
      sub = await stripe.subscriptions.retrieve(profile.stripe_subscription_id);
    } catch {
      console.log(`  Stripe sub not found (deleted/purged) — treating as no subscription`);
      sub = { status: "canceled" } as Stripe.Subscription;
    }

    console.log(`  Stripe sub status:   ${sub.status}`);

    if (sub.status === "trialing") {
      // Extend the trial end date on the Stripe subscription directly
      const base = new Date();
      base.setDate(base.getDate() + days);
      base.setUTCHours(23, 59, 59, 0);
      const newEndsAt = base.toISOString();
      const trialEndUnix = Math.floor(base.getTime() / 1000);

      console.log(`\n→ Extending Stripe trial to ${newEndsAt} …`);
      await stripe.subscriptions.update(profile.stripe_subscription_id, {
        trial_end: trialEndUnix,
      });
      console.log("  Stripe updated ✓");

      const { error: updateErr } = await supabase
        .from("profiles")
        .update({ plan: "pro", trial_ends_at: newEndsAt })
        .eq("id", profile.id);

      if (updateErr) {
        console.error("DB update failed:", updateErr.message);
        process.exitCode = 1;
        return;
      }

      console.log(`\n✅  Trial extended for ${emailArg}`);
      console.log(`  plan:          pro`);
      console.log(`  trial_ends_at: ${newEndsAt}  (+${days} days)`);
      return;
    }

    if (sub.status === "active") {
      console.error("\n⚠️  Paid active subscription — no trial to extend. Add a coupon/credit in the Stripe dashboard instead.");
      process.exitCode = 1;
      return;
    }

    // Subscription is canceled/past_due/unpaid — safe to manage in DB only
    console.log("  → Subscription is not active; managing access in DB only.");
  }

  const base = new Date();
  base.setDate(base.getDate() + days);
  base.setUTCHours(23, 59, 59, 0);
  const newEndsAt = base.toISOString();

  const updates: Record<string, unknown> = {
    plan: "pro",
    trial_ends_at: newEndsAt,
  };
  // Clear the stale sub ID so the checkout route can grant a fresh Stripe trial if they upgrade
  if (profile.stripe_subscription_id) {
    updates.stripe_subscription_id = null;
  }

  const { error: updateErr } = await supabase
    .from("profiles")
    .update(updates)
    .eq("id", profile.id);

  if (updateErr) {
    console.error("Update failed:", updateErr.message);
    process.exitCode = 1;
    return;
  }

  console.log(`\n✅  Access extended for ${emailArg}`);
  console.log(`  plan:          pro`);
  console.log(`  trial_ends_at: ${newEndsAt}  (+${days} days)`);
  if (updates.stripe_subscription_id === null) {
    console.log(`  stripe_sub:    cleared (was canceled)`);
  }
}

if (!emailArg) {
  console.error("Usage: npx tsx scripts/extend-trial.ts <email> [days]");
  process.exitCode = 1;
} else {
  run(emailArg).catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });
}
