import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import * as Sentry from "@sentry/nextjs";
import { logCronRun } from "@/lib/cron-monitor";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const clean = (v: string | undefined) => (v ?? "").replace(/^﻿/, "").trim();

// Exercises the one path every real prospect has to go through and nothing
// automated ever has: the actual public email/password signup form, using
// the actual publishable key a browser uses, not an admin-created stand-in
// (scripts/create-e2e-user.ts's auth.admin.createUser() never touches this
// call at all). Two outages in two days (2026-08-03's uncaught exception,
// 2026-08-04's leaked secret key rejected by Supabase) were both caught by a
// prospect on LinkedIn, never by anything in this codebase. See
// marketing/product-ideas-log.md, 2026-08-04, idea 2.
//
// Scope, documented rather than left implicit:
// - Email/password only, not Google OAuth: OAuth is not the path that broke
//   twice, and testing it would need a dedicated Google test account this
//   canary doesn't have.
// - Deliberately does NOT call activate-trial or send-welcome afterward.
//   Both are separate client-side fetches app/[locale]/signup/page.tsx makes
//   after signUp() resolves, not something signUp() itself triggers, so
//   skipping them costs no coverage of the call that actually broke twice.
//   Extending this to replicate them would mean either suppressing a real
//   Brevo send to a fictitious address (exactly what damaged sender
//   reputation on 2026-08-03, "Unable to find MX of domain
//   healthwatch-test.dev") or threading test-domain checks into shared
//   production email logic, not worth it for a path that isn't the one
//   under test here.
export async function GET(req: NextRequest) {
  const cronSecret = clean(process.env.CRON_SECRET);
  if (!cronSecret || req.headers.get("authorization") !== `Bearer ${cronSecret}`)
    return new Response("Unauthorized", { status: 401 });

  const supabaseUrl = clean(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const admin = createClient(
    supabaseUrl,
    clean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const email = `claude-canary-${Date.now()}@healthwatch-test.dev`;
  const password = `Canary-${Math.random().toString(36).slice(2)}A1!`;

  let userId: string | null = null;
  let failure: string | null = null;

  try {
    // The anon/publishable client, same key and call a real browser makes
    // in app/[locale]/signup/page.tsx's handleSignup(). No localStorage on
    // the server, hence persistSession:false.
    const anon = createClient(
      supabaseUrl,
      clean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
      { auth: { persistSession: false, autoRefreshToken: false } },
    );

    const { data, error } = await anon.auth.signUp({ email, password });
    if (error) {
      failure = `signUp error: ${error.message}`;
    } else {
      userId = data.user?.id ?? null;
      if (!userId) {
        failure = "signUp returned no user id";
      } else {
        // on_auth_user_created (supabase/migrations/20240101000000_initial_schema.sql)
        // inserts the profiles row synchronously with the auth.users insert,
        // so it should already be visible; a short retry absorbs read
        // replica lag rather than failing on a false positive.
        let profileFound = false;
        for (let attempt = 0; attempt < 3 && !profileFound; attempt++) {
          if (attempt > 0) await new Promise((r) => setTimeout(r, 500));
          const { data: profile } = await admin.from("profiles").select("id").eq("id", userId).maybeSingle();
          profileFound = !!profile;
        }
        if (!profileFound) failure = "no profiles row found after signUp";
      }
    }
  } catch (err) {
    // Mirrors the exact failure mode fixed 2026-08-03 on the real signup
    // page: supabase-js re-throws instead of resolving {error} for anything
    // it doesn't recognize as its own AuthError shape.
    failure = `signUp threw: ${err instanceof Error ? err.message : String(err)}`;
  }

  // Always attempt cleanup, even after a failure above: a canary that
  // leaves accounts behind recreates the exact hygiene problem it exists to
  // prevent (see marketing/product-ideas-log.md, 2026-08-03 idea 3 and
  // 2026-08-04 idea 2's own cleanup of the prior day's debug accounts).
  if (userId) {
    const { error: deleteErr } = await admin.auth.admin.deleteUser(userId);
    if (deleteErr) {
      const cleanupMsg = `cleanup failed: account ${email} (${userId}) NOT deleted: ${deleteErr.message}`;
      failure = failure ? `${failure}; ${cleanupMsg}` : cleanupMsg;
    }
  }

  if (failure) {
    console.error("[signup-canary]", failure);
    Sentry.captureMessage(`[signup-canary] ${failure}`, "error");
    await Sentry.flush(2000);
    await logCronRun(admin, "signup-canary", "error", 0, failure);
    return Response.json({ ok: false, error: failure });
  }

  await logCronRun(admin, "signup-canary", "ok", 1);
  return Response.json({ ok: true });
}
