import { NextRequest, NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { buildResetPasswordEmail } from "@/lib/reset-password-email";
import { errorMessage } from "@/lib/error";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { isRealProduction } from "@/lib/cron-monitor";
import * as Sentry from "@sentry/nextjs";

export const dynamic = "force-dynamic";

const BOM = String.fromCharCode(65279);
const clean = (v: string | undefined) => (v || "").replace(new RegExp("^" + BOM), "").trim();

const BREVO_API_KEY = clean(process.env.BREVO_API_KEY);

const VALID_LOCALES = ["en", "fr", "es", "ar", "id"];

// Supabase's own Auth mailer (default or dashboard SMTP) is unreliable for
// recovery emails to some providers (Gmail in particular — see the Zahra
// Bouzidi case, July 2026: account confirmed but zero successful sign-ins,
// recovery emails never arrived). This route bypasses it entirely: generate
// the recovery link server-side via the admin API, then send it through the
// Brevo transport already used for every other transactional email in the
// app (send-welcome, admin/invite, etc).
export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const rl = await rateLimit(`reset-password:${ip}`, { limit: 5, windowMs: 60 * 60 * 1000 });
  if (!rl.allowed) {
    // La page forgot-password ne lit pas le code de retour : elle affiche
    // « vérifiez votre boîte » même sur un 429. Sans cette ligne, cinq essais
    // rapprochés rendent la fonctionnalité muette sans laisser de trace.
    console.warn(`[reset-password] 429 — plafond de 5/h atteint pour cette IP, aucun envoi tenté`);
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  try {
    const { email, locale: rawLocale } = await req.json();

    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "Missing email" }, { status: 400 });
    }

    const locale = VALID_LOCALES.includes(rawLocale) ? rawLocale : "fr";

    const admin = createServiceClient(
      clean(process.env.NEXT_PUBLIC_SUPABASE_URL),
      clean(process.env.SUPABASE_SERVICE_ROLE_KEY),
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const siteUrl = clean(process.env.NEXT_PUBLIC_SITE_URL) || "https://healthwatch-global.com";
    const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
      type: "recovery",
      email,
      options: { redirectTo: `${siteUrl}/${locale}/reset-password` },
    });

    // Don't leak whether an account exists for this email — always report
    // success to the caller, but capture unexpected failures for visibility.
    if (linkErr || !linkData?.properties?.action_link) {
      // Journalisé dans tous les cas. Le « compte introuvable » est un
      // fonctionnement normal côté produit (on ne révèle pas qui a un compte),
      // mais côté exploitation c'est la seule chose qui distingue « personne
      // n'a ce mail » de « notre chaîne d'envoi est cassée » — et sans trace,
      // les deux se ressemblent depuis le navigateur.
      console.warn(
        `[reset-password] aucun lien généré — ${linkErr ? `erreur Supabase: ${linkErr.message}` : "generateLink n'a pas renvoyé d'action_link"}. Aucun e-mail envoyé.`,
      );
      if (linkErr && !/not.?found/i.test(linkErr.message)) {
        Sentry.captureException(new Error(`[reset-password] generateLink error: ${linkErr.message}`), {
          tags: { route: "reset-password" },
        });
      }
      return NextResponse.json({ success: true });
    }

    if (!BREVO_API_KEY || !isRealProduction) {
      if (!BREVO_API_KEY) {
        console.warn("[reset-password] BREVO_API_KEY not set — skipping send");
        Sentry.captureException(new Error("[reset-password] BREVO_API_KEY not set"), { tags: { route: "reset-password" } });
      } else {
        // Cas normal hors production : `isRealProduction` interdit tout envoi
        // vers une vraie personne. Mais la réponse reste `success: true`
        // (anti-énumération), donc la page affiche « vérifiez votre boîte »
        // alors que rien n'est parti — et la seule façon de le comprendre était
        // de lire ce fichier. Le 26/08/2026, une heure y est passée.
        //
        // Le lien de récupération n'est journalisé qu'en local (VERCEL_ENV
        // absent) : sur une préproduction Vercel, il apparaîtrait dans des logs
        // consultables par toute personne ayant accès au projet, alors que
        // n'importe qui peut déclencher un envoi pour n'importe quelle adresse.
        const isLocal = !process.env.VERCEL_ENV;
        console.info(
          `[reset-password] non-production (VERCEL_ENV=${process.env.VERCEL_ENV ?? "unset"}) — aucun e-mail envoyé` +
            (isLocal ? `\n[reset-password] lien de récupération : ${linkData.properties.action_link}` : ""),
        );
      }
      return NextResponse.json({ success: true });
    }

    const { subject, html } = buildResetPasswordEmail(locale, linkData.properties.action_link);

    const brevoRes = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "api-key": BREVO_API_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({
        sender: { name: "HealthWatch Global", email: "alerts@healthwatch-global.com" },
        to: [{ email }],
        subject,
        htmlContent: html,
      }),
    });

    if (!brevoRes.ok) {
      const err = await brevoRes.text();
      console.error("[reset-password] Brevo error:", err);
      Sentry.captureException(new Error(`[reset-password] Brevo error: ${err}`), { tags: { route: "reset-password" } });
    } else {
      // Le succès aussi se journalise : sans lui, des logs vides voudraient dire
      // aussi bien « tout va bien » que « la route n'a jamais été appelée ».
      console.info(`[reset-password] envoi demandé à Brevo (HTTP ${brevoRes.status})`);
    }

    // Always report success — matches the anti-enumeration behavior the
    // forgot-password page already had with supabase.auth.resetPasswordForEmail.
    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    console.error("[reset-password] unexpected error:", errorMessage(e));
    Sentry.captureException(e, { tags: { route: "reset-password" } });
    return NextResponse.json({ success: true });
  }
}
