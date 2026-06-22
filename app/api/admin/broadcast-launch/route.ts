import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { isAdmin } from "@/lib/admin";
import { buildPHLaunchEmail } from "@/lib/ph-launch-email";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const BOM   = String.fromCharCode(65279);
const clean = (v: string | undefined) => (v || "").replace(new RegExp("^" + BOM), "").trim();

const BREVO_API_KEY   = clean(process.env.BREVO_API_KEY);
const SENDER          = { name: "David — HealthWatch Global", email: "alerts@healthwatch-global.com" };

// Brevo rate limit: ~10 req/s on transactional SMTP — batch with small delay
const BATCH_SIZE  = 5;
const BATCH_DELAY = 1200; // ms between batches

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function sendOne(to: string, locale: string): Promise<boolean> {
  const { subject, html } = buildPHLaunchEmail(locale);
  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "api-key": BREVO_API_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ sender: SENDER, to: [{ email: to }], subject, htmlContent: html }),
  });
  return res.ok;
}

export async function POST(req: NextRequest) {
  // Auth: must be a logged-in admin
  const cookieStore = await cookies();
  const supabase = createServerClient(
    clean(process.env.NEXT_PUBLIC_SUPABASE_URL),
    clean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (toSet) => {
          toSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        },
      },
    }
  );
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !isAdmin(user.email)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!BREVO_API_KEY) {
    return NextResponse.json({ error: "BREVO_API_KEY not set" }, { status: 500 });
  }

  // Optional: ?dry=1 to preview without sending
  const dry = new URL(req.url).searchParams.get("dry") === "1";

  const admin = createClient(
    clean(process.env.NEXT_PUBLIC_SUPABASE_URL),
    clean(process.env.SUPABASE_SERVICE_ROLE_KEY)
  );

  // Fetch all profiles with an email
  const { data: profiles, error } = await admin
    .from("profiles")
    .select("email, plan, locale")
    .not("email", "is", null);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const TEST_EMAILS = [
    "shintayuliawati28@gmail.com",
    "analin1309@gmail.com",
    "e2e@healthwatch-global.com",
    "elyan.delaunay@proton.me",
    "davy_skye@yahoo.fr",
    "clarence_skye@yahoo.fr",
  ];
  const isTestAccount = (email: string) => {
    const e = email.toLowerCase();
    return (
      e.includes("deheunynck") ||
      e.includes("healthwatch-test.dev") ||
      e.startsWith("test-e2e") ||
      TEST_EMAILS.includes(e)
    );
  };

  const targets = (profiles ?? [])
    .map((p) => ({ email: p.email as string, locale: (p.locale as string) ?? "fr" }))
    .filter((p) => p.email && p.email.includes("@") && !isTestAccount(p.email));

  if (dry) {
    return NextResponse.json({ dry: true, total: targets.length, preview: targets.slice(0, 5).map((p) => p.email) });
  }

  // Send in batches
  let sent = 0;
  let failed = 0;
  const errors: string[] = [];

  for (let i = 0; i < targets.length; i += BATCH_SIZE) {
    const batch = targets.slice(i, i + BATCH_SIZE);
    await Promise.all(
      batch.map(async ({ email, locale }) => {
        const ok = await sendOne(email, locale);
        if (ok) { sent++; } else { failed++; errors.push(email); }
      })
    );
    if (i + BATCH_SIZE < targets.length) await sleep(BATCH_DELAY);
  }

  return NextResponse.json({ sent, failed, total: targets.length, errors: errors.slice(0, 10) });
}
