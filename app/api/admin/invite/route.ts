import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { isAdmin } from "@/lib/admin";
import * as Sentry from "@sentry/nextjs";

export const dynamic = "force-dynamic";

const BOM   = String.fromCharCode(65279);
const clean = (v: string | undefined) => (v || "").replace(new RegExp("^" + BOM), "").trim();

const PILOT_EMAIL = {
  en: {
    subject: "Your HealthWatch Global pilot access is ready",
    heading: "Welcome to the HealthWatch Global Pilot Program",
    body: (name: string, org: string) => `
      <p>Hi ${name},</p>
      <p>Your 35-day Pro access to <strong>HealthWatch Global</strong> is now active for <strong>${org}</strong>.</p>
      <p>Click the button below to set up your account and log in — no password required, this link is valid for 24 hours:</p>
    `,
    cta: "Access the platform →",
    what: "What you have access to",
    features: ["Real-time outbreak data (cases, deaths, CFR)", "All 195+ countries", "Instant regional alerts", "PDF reports", "CSV data export", "Slack / Teams integration"],
    help: "Any questions? Reply to this email — we'll get back to you within 24 hours.",
    footer: "HealthWatch Global · Epidemiological surveillance for health organizations",
  },
  fr: {
    subject: "Votre accès pilote HealthWatch Global est prêt",
    heading: "Bienvenue dans le programme pilote HealthWatch Global",
    body: (name: string, org: string) => `
      <p>Bonjour ${name},</p>
      <p>Votre accès Pro de 35 jours à <strong>HealthWatch Global</strong> est maintenant actif pour <strong>${org}</strong>.</p>
      <p>Cliquez sur le bouton ci-dessous pour configurer votre compte et vous connecter — sans mot de passe, ce lien est valable 24 heures :</p>
    `,
    cta: "Accéder à la plateforme →",
    what: "Ce à quoi vous avez accès",
    features: ["Données épidémiques en temps réel (cas, décès, taux de létalité)", "195+ pays couverts", "Alertes régionales instantanées", "Rapports PDF", "Export CSV des données", "Intégration Slack / Teams"],
    help: "Des questions ? Répondez à cet email — nous vous répondrons sous 24 heures.",
    footer: "HealthWatch Global · Surveillance épidémiologique pour les organisations de santé",
  },
};

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user || !isAdmin(user.email)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { email, name, organization, locale = "en" } = await req.json();

  if (!email || !name || !organization) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const admin = createServiceClient(
    clean(process.env.NEXT_PUBLIC_SUPABASE_URL),
    clean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  // 1. Create or update the user (query profiles table — avoids listUsers() 1000-user limit)
  const { data: existingProfile } = await admin
    .from("profiles")
    .select("id")
    .eq("email", email)
    .maybeSingle();

  let userId: string;

  if (existingProfile?.id) {
    userId = existingProfile.id;
  } else {
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      email_confirm: true,
    });
    if (createErr || !created?.user) {
      return NextResponse.json({ error: createErr?.message ?? "Failed to create user" }, { status: 500 });
    }
    userId = created.user.id;
  }

  // 2. Set Pro plan for 35 days
  const trialEnd = new Date(Date.now() + 35 * 86_400_000).toISOString();
  const { error: profileErr } = await admin.from("profiles").upsert({
    id:            userId,
    email,
    plan:          "pro",
    trial_ends_at: trialEnd,
    locale:        locale === "fr" ? "fr" : "en",
  }, { onConflict: "id" });

  if (profileErr) {
    return NextResponse.json({ error: profileErr.message }, { status: 500 });
  }

  // Default-enroll into regional alerts (opt-out, not opt-in) — same as the
  // standard activate-trial and pilot-request paths. Without this, an admin-invited
  // pilot user gets Pro access but no alert ever fires. Best-effort: a failure here
  // must not fail the invite.
  const { error: alertsErr } = await admin
    .from("user_alert_regions")
    .upsert(
      ["africa", "asia", "americas", "europe", "oceania"].map((region) => ({
        user_id: userId,
        region,
        min_risk: "medium",
      })),
      { onConflict: "user_id,region", ignoreDuplicates: true }
    );
  if (alertsErr) {
    console.error("[admin/invite] default alert enrollment failed:", alertsErr);
    Sentry.captureException(
      new Error(`[admin/invite] alert enrollment failed: ${alertsErr.message}`),
      { tags: { user_id: userId } }
    );
  }

  // 3. Generate a magic link
  const siteUrl = clean(process.env.NEXT_PUBLIC_SITE_URL) || "https://healthwatch-global.com";
  const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
    type:       "magiclink",
    email,
    options: { redirectTo: `${siteUrl}/${locale}` },
  });

  if (linkErr || !linkData?.properties?.action_link) {
    return NextResponse.json({ error: linkErr?.message ?? "Failed to generate link" }, { status: 500 });
  }

  const magicLink = linkData.properties.action_link;

  // 4. Send branded pilot welcome email via Brevo
  const l = locale === "fr" ? PILOT_EMAIL.fr : PILOT_EMAIL.en;
  const BREVO_API_KEY = clean(process.env.BREVO_API_KEY);

  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const featureList = l.features.map((f) => `<li style="margin:6px 0;">✓ ${f}</li>`).join("");

  const htmlContent = `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;background:#111827;color:#e5e7eb;padding:32px 24px;border-radius:12px;">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:24px;">
        <span style="color:#dc2626;font-size:22px;">●</span>
        <span style="font-weight:700;font-size:18px;color:#fff;">HealthWatch Global</span>
      </div>
      <h1 style="color:#fff;font-size:22px;font-weight:700;margin-bottom:8px;">${l.heading}</h1>
      <div style="color:#9ca3af;font-size:15px;line-height:1.6;">${l.body(esc(name), esc(organization))}</div>
      <div style="text-align:center;margin:28px 0;">
        <a href="${magicLink}" style="display:inline-block;background:#dc2626;color:#fff;font-weight:700;padding:14px 32px;border-radius:10px;text-decoration:none;font-size:15px;">${l.cta}</a>
      </div>
      <div style="background:#1f2937;border-radius:10px;padding:20px;margin:20px 0;">
        <p style="color:#fff;font-weight:600;margin:0 0 12px;">${l.what}</p>
        <ul style="margin:0;padding:0 0 0 4px;list-style:none;color:#9ca3af;font-size:14px;">${featureList}</ul>
      </div>
      <p style="color:#6b7280;font-size:13px;margin-top:24px;">${l.help}</p>
      <hr style="border:none;border-top:1px solid #374151;margin:24px 0;" />
      <p style="color:#4b5563;font-size:12px;text-align:center;">${l.footer}</p>
    </div>
  `;

  const brevoRes = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "api-key": BREVO_API_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({
      sender:  { name: "HealthWatch Global", email: "alerts@healthwatch-global.com" },
      to:      [{ email, name }],
      subject: l.subject,
      htmlContent,
    }),
  });

  if (!brevoRes.ok) {
    const err = await brevoRes.text();
    console.error("Brevo pilot invite error:", err);
    Sentry.captureException(new Error(`[admin/invite] Brevo error: ${err}`), { tags: { route: "admin-invite" } });
    return NextResponse.json({ error: "Email send failed" }, { status: 500 });
  }

  return NextResponse.json({ success: true, userId, trialEnd });
}
