import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { errorMessage } from "@/lib/error";

export const dynamic = "force-dynamic";

const BOM = String.fromCharCode(65279);
const clean = (v: string | undefined) => (v || "").replace(new RegExp("^" + BOM), "").trim();

const BASE_URL = "https://healthwatch-global.com";

// ─── Localized labels ────────────────────────────────────────────────────────

const REGION_LABELS: Record<string, Record<string, string>> = {
  fr: { allRegions: "Toutes les régions", africa: "Afrique", asia: "Asie", europe: "Europe", americas: "Amériques", oceania: "Océanie" },
  en: { allRegions: "All regions", africa: "Africa", asia: "Asia", europe: "Europe", americas: "Americas", oceania: "Oceania" },
  es: { allRegions: "Todas las regiones", africa: "África", asia: "Asia", europe: "Europa", americas: "Américas", oceania: "Oceanía" },
  ar: { allRegions: "جميع المناطق", africa: "أفريقيا", asia: "آسيا", europe: "أوروبا", americas: "الأمريكتان", oceania: "أوقيانوسيا" },
  id: { allRegions: "Semua wilayah", africa: "Afrika", asia: "Asia", europe: "Eropa", americas: "Amerika", oceania: "Oseania" },
};

const EMAIL_COPY: Record<string, {
  subject: string; greeting: string; confirmed: string; regionLabel: string;
  emailLabel: string; ctaLabel: string; ctaText: string;
  unsubscribeLabel: string; sourcesLabel: string;
}> = {
  fr: {
    subject: "Votre abonnement aux alertes sanitaires est confirmé",
    greeting: "Abonnement confirmé ✓",
    confirmed: "Vous recevrez désormais un digest hebdomadaire pour la région :",
    regionLabel: "Région", emailLabel: "Email",
    ctaLabel: "Voir le tableau de bord →",
    ctaText: "https://healthwatch-global.com/fr",
    unsubscribeLabel: "Se désabonner",
    sourcesLabel: "Sources : OMS · ECDC · PAHO · Africa CDC",
  },
  en: {
    subject: "Your health alert subscription is confirmed",
    greeting: "Subscription confirmed ✓",
    confirmed: "You will now receive a weekly digest for the region:",
    regionLabel: "Region", emailLabel: "Email",
    ctaLabel: "Go to dashboard →",
    ctaText: "https://healthwatch-global.com/en",
    unsubscribeLabel: "Unsubscribe",
    sourcesLabel: "Sources: WHO · ECDC · PAHO · Africa CDC",
  },
  es: {
    subject: "Su suscripción a alertas de salud está confirmada",
    greeting: "Suscripción confirmada ✓",
    confirmed: "Recibirá un resumen semanal para la región:",
    regionLabel: "Región", emailLabel: "Email",
    ctaLabel: "Ir al panel →",
    ctaText: "https://healthwatch-global.com/es",
    unsubscribeLabel: "Cancelar suscripción",
    sourcesLabel: "Fuentes: OMS · ECDC · PAHO · Africa CDC",
  },
  ar: {
    subject: "تم تأكيد اشتراكك في تنبيهات الصحة",
    greeting: "تم تأكيد الاشتراك ✓",
    confirmed: "ستتلقى الآن ملخصًا أسبوعيًا للمنطقة:",
    regionLabel: "المنطقة", emailLabel: "البريد الإلكتروني",
    ctaLabel: "الذهاب إلى لوحة التحكم ←",
    ctaText: "https://healthwatch-global.com/ar",
    unsubscribeLabel: "إلغاء الاشتراك",
    sourcesLabel: "المصادر: WHO · ECDC · PAHO · Africa CDC",
  },
  id: {
    subject: "Langganan peringatan kesehatan Anda telah dikonfirmasi",
    greeting: "Langganan dikonfirmasi ✓",
    confirmed: "Anda akan menerima digest mingguan untuk wilayah:",
    regionLabel: "Wilayah", emailLabel: "Email",
    ctaLabel: "Buka dasbor →",
    ctaText: "https://healthwatch-global.com/id",
    unsubscribeLabel: "Berhenti berlangganan",
    sourcesLabel: "Sumber: WHO · ECDC · PAHO · Africa CDC",
  },
};

// ─── Email builder ────────────────────────────────────────────────────────────

function buildConfirmationEmail(
  email: string,
  region: string,
  locale: string,
  subscriptionId: string
): { subject: string; html: string } {
  const l = EMAIL_COPY[locale] ?? EMAIL_COPY.en;
  const regions = REGION_LABELS[locale] ?? REGION_LABELS.en;
  const regionLabel = regions[region] ?? region;
  const unsubUrl = `${BASE_URL}/api/unsubscribe?id=${encodeURIComponent(subscriptionId)}&locale=${locale}`;
  const isRtl = locale === "ar";

  const html = `<!DOCTYPE html>
<html lang="${locale}" dir="${isRtl ? "rtl" : "ltr"}">
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width"/></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#0f172a;color:#e2e8f0;margin:0;padding:40px 20px;">
  <div style="max-width:560px;margin:0 auto;background:#1e293b;border-radius:16px;overflow:hidden;border:1px solid #334155;">
    <div style="background:#dc2626;padding:28px 32px;">
      <h1 style="margin:0;font-size:22px;color:white;font-weight:700;">🌍 HealthWatch Global</h1>
    </div>
    <div style="padding:32px;">
      <h2 style="margin:0 0 16px;font-size:20px;color:#f1f5f9;">${l.greeting}</h2>
      <p style="margin:0 0 8px;color:#94a3b8;line-height:1.6;">${l.confirmed}</p>
      <p style="margin:0 0 24px;color:#f1f5f9;font-weight:600;">${regionLabel}</p>
      <div style="background:#0f172a;border-radius:10px;padding:20px;margin-bottom:28px;border:1px solid #334155;">
        <p style="margin:0 0 6px;font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;">
          ${locale === "ar" ? "تفاصيل الاشتراك" : "Subscription details"}
        </p>
        <p style="margin:0;color:#e2e8f0;font-size:14px;">
          <span style="color:#64748b;">${l.emailLabel} : </span>${email}
        </p>
        <p style="margin:8px 0 0;color:#e2e8f0;font-size:14px;">
          <span style="color:#64748b;">${l.regionLabel} : </span>${regionLabel}
        </p>
      </div>
      <a href="${l.ctaText}"
         style="display:inline-block;background:#dc2626;color:white;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;font-size:14px;">
        ${l.ctaLabel}
      </a>
    </div>
    <div style="padding:20px 32px;border-top:1px solid #334155;">
      <p style="margin:0 0 8px;font-size:12px;color:#475569;">${l.sourcesLabel}</p>
      <a href="${unsubUrl}" style="font-size:12px;color:#64748b;">${l.unsubscribeLabel}</a>
    </div>
  </div>
</body>
</html>`;

  return { subject: l.subject, html };
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // ── Rate limiting: 5 subscriptions per IP per hour ───────────────────────────
  const ip = getClientIp(req);
  const rl = rateLimit(`subscribe:${ip}`, { limit: 5, windowMs: 60 * 60 * 1000 });
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many requests — please wait before trying again." },
      {
        status: 429,
        headers: {
          "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)),
          "X-RateLimit-Limit": "5",
          "X-RateLimit-Remaining": "0",
        },
      }
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid or missing request body" }, { status: 400 });
  }

  try {
    const { email, region, locale } = body;

    if (!email || !region) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    const VALID_REGIONS = ["allRegions", "africa", "asia", "europe", "americas", "oceania"];
    if (!VALID_REGIONS.includes(region)) {
      return NextResponse.json({ error: "Invalid region" }, { status: 400 });
    }

    const safeLocale = ["fr", "en", "es", "ar", "id"].includes(locale) ? locale : "en";

    const supabase = createClient(
      clean(process.env.NEXT_PUBLIC_SUPABASE_URL),
      clean(process.env.SUPABASE_SERVICE_ROLE_KEY) // service_role bypasses RLS
    );

    // Insert and get back the generated UUID
    const { data: row, error: dbError } = await supabase
      .from("subscriptions")
      .insert({ email, region, locale: safeLocale, active: true })
      .select("id")
      .single();

    // 23505 = unique_violation (already subscribed) — still return success
    if (dbError && dbError.code !== "23505") {
      return NextResponse.json({ error: dbError.message }, { status: 500 });
    }

    // If already subscribed (duplicate), fetch existing row to get the ID
    let subscriptionId = row?.id as string | undefined;
    if (!subscriptionId) {
      const { data: existing } = await supabase
        .from("subscriptions")
        .select("id")
        .eq("email", email)
        .single();
      subscriptionId = existing?.id;
    }

    // Send confirmation email with unsubscribe link
    const brevoKey = clean(process.env.BREVO_API_KEY);
    if (brevoKey && subscriptionId) {
      const { subject, html } = buildConfirmationEmail(email, region, safeLocale, subscriptionId);
      await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: { "api-key": brevoKey, "Content-Type": "application/json" },
        body: JSON.stringify({
          sender: { name: "HealthWatch Global", email: "alerts@healthwatch-global.com" },
          to: [{ email }],
          subject,
          htmlContent: html,
        }),
      }).catch((e) => console.error("[subscribe] Email send error:", e.message));
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error("[subscribe] Error:", errorMessage(err));
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
