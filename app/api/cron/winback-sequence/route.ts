// Cron: win-back email for users whose trial expired 3 days ago and haven't subscribed.
// Runs daily at 11:00 UTC. Targets plan=free users with trial_ends_at in [now-3.5d, now-2.5d).
// This is the last automated touch after the trial-expired email sent on day 14.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { PRICE_DISPLAY } from "@/lib/pricing";
import * as Sentry from "@sentry/nextjs";
import { logCronRun } from "@/lib/cron-monitor";

export const dynamic = "force-dynamic";

const BOM   = String.fromCharCode(65279);
const clean = (v: string | undefined) => (v || "").replace(new RegExp("^" + BOM), "").trim();

const BREVO_KEY        = clean(process.env.BREVO_API_KEY);
const SUPABASE_URL     = clean(process.env.NEXT_PUBLIC_SUPABASE_URL);
const SUPABASE_SERVICE = clean(process.env.SUPABASE_SERVICE_ROLE_KEY);

// ── Email shell ────────────────────────────────────────────────────────────────

function emailShell(locale: string, body: string): string {
  const isRtl = locale === "ar";
  return `<!DOCTYPE html>
<html lang="${locale}" dir="${isRtl ? "rtl" : "ltr"}">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width,initial-scale=1.0" />
<title>HealthWatch Global</title>
</head>
<body style="margin:0;padding:0;background:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f172a;">
    <tr><td align="center" style="padding:32px 16px;">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#1e293b;border-radius:16px;overflow:hidden;max-width:600px;width:100%;">
        <tr><td style="background:#dc2626;padding:20px 32px;">
          <p style="margin:0;font-size:20px;font-weight:800;color:white;letter-spacing:-0.5px;">HealthWatch Global</p>
          <p style="margin:4px 0 0;font-size:12px;color:#fca5a5;text-transform:uppercase;letter-spacing:.1em;">Disease Outbreak Surveillance</p>
        </td></tr>
        <tr><td>${body}</td></tr>
        <tr><td style="padding:20px 32px;background:#0f172a;text-align:center;">
          <a href="https://healthwatch-global.com/${locale}" style="color:#64748b;font-size:12px;text-decoration:none;">healthwatch-global.com</a>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ── Win-back copy (5 locales) ──────────────────────────────────────────────────

const COPY: Record<string, {
  subject: string;
  headline: string;
  intro: string;
  questionLabel: string;
  question: string;
  offerLabel: string;
  offerItems: string[];
  pricingNote: string;
  ctaLabel: string;
  altText: string;
  altLink: string;
  closing: string;
  unsubNote: string;
}> = {
  fr: {
    subject: "Vous pensez encore à HealthWatch ? L'accès Pro est toujours disponible",
    headline: "Votre essai s'est terminé il y a 3 jours.",
    intro: "Vous avez utilisé HealthWatch Pro pendant 14 jours. Depuis, vous n'avez plus accès aux données complètes. Est-ce que quelque chose vous a empêché de vous abonner ?",
    questionLabel: "La question qu'on se pose",
    question: "S'agit-il du prix ? Du besoin d'un devis institutionnel ? Ou simplement du bon moment ?",
    offerLabel: "Ce que vous perdez chaque jour sans Pro",
    offerItems: [
      "📊 Les chiffres exacts de cas et de décès — floutés sans Pro",
      "📬 Les alertes email régionales en temps réel",
      "📄 Les rapports PDF épidémiologiques régionaux",
      "📥 L'export CSV complet des données brutes",
    ],
    pricingNote: `${PRICE_DISPLAY.fr.proMonthly}/mois, sans engagement. Annulation à tout moment.`,
    ctaLabel: "Réactiver Pro maintenant →",
    altText: "Vous représentez une ONG, une agence ONU ou un ministère ?",
    altLink: "Programme pilote institutionnel gratuit →",
    closing: "L'équipe HealthWatch Global",
    unsubNote: "Vous recevez cet email car vous avez créé un compte sur healthwatch-global.com.",
  },
  en: {
    subject: "Still thinking about HealthWatch? Pro access is still available",
    headline: "Your trial ended 3 days ago.",
    intro: "You used HealthWatch Pro for 14 days. Since then, you no longer have access to the full data. Is something holding you back from subscribing?",
    questionLabel: "Our honest question",
    question: "Is it the price? Do you need an institutional quote? Or is it just not the right time?",
    offerLabel: "What you're missing every day without Pro",
    offerItems: [
      "📊 Exact case and death figures — blurred without Pro",
      "📬 Real-time regional email alerts",
      "📄 Regional epidemiological PDF reports",
      "📥 Full CSV export of raw data",
    ],
    pricingNote: `${PRICE_DISPLAY.en_eur.proMonthly}/month, no commitment. Cancel anytime.`,
    ctaLabel: "Reactivate Pro now →",
    altText: "Representing an NGO, UN agency or health ministry?",
    altLink: "Free institutional pilot program →",
    closing: "The HealthWatch Global Team",
    unsubNote: "You're receiving this email because you created an account on healthwatch-global.com.",
  },
  es: {
    subject: "¿Aún pensando en HealthWatch? El acceso Pro sigue disponible",
    headline: "Su prueba terminó hace 3 días.",
    intro: "Usó HealthWatch Pro durante 14 días. Desde entonces, ya no tiene acceso a los datos completos. ¿Hay algo que le impida suscribirse?",
    questionLabel: "Nuestra pregunta honesta",
    question: "¿Es el precio? ¿Necesita un presupuesto institucional? ¿O simplemente no es el momento adecuado?",
    offerLabel: "Lo que pierde cada día sin Pro",
    offerItems: [
      "📊 Cifras exactas de casos y fallecidos — borrosas sin Pro",
      "📬 Alertas email regionales en tiempo real",
      "📄 Informes PDF epidemiológicos regionales",
      "📥 Exportación CSV completa de datos brutos",
    ],
    pricingNote: `${PRICE_DISPLAY.es.proMonthly}/mes, sin compromiso. Cancele cuando quiera.`,
    ctaLabel: "Reactivar Pro ahora →",
    altText: "¿Representa una ONG, agencia ONU o ministerio de salud?",
    altLink: "Programa piloto institucional gratuito →",
    closing: "El equipo de HealthWatch Global",
    unsubNote: "Recibe este correo porque creó una cuenta en healthwatch-global.com.",
  },
  ar: {
    subject: "لا تزال تفكر في HealthWatch؟ الوصول Pro لا يزال متاحاً",
    headline: "انتهت تجربتك منذ 3 أيام.",
    intro: "استخدمت HealthWatch Pro لمدة 14 يوماً. منذ ذلك الحين، لم تعد تتمكن من الوصول إلى البيانات الكاملة. هل هناك ما يمنعك من الاشتراك؟",
    questionLabel: "سؤالنا الصادق",
    question: "هل هو السعر؟ هل تحتاج إلى عرض مؤسسي؟ أم أن التوقيت غير مناسب؟",
    offerLabel: "ما تخسره كل يوم بدون Pro",
    offerItems: [
      "📊 أرقام دقيقة للحالات والوفيات — مطموسة بدون Pro",
      "📬 تنبيهات بريد إلكتروني إقليمية فورية",
      "📄 تقارير PDF وبائية إقليمية",
      "📥 تصدير CSV كامل للبيانات الخام",
    ],
    pricingNote: `${PRICE_DISPLAY.ar.proMonthly}/شهر، بدون التزام. إلغاء في أي وقت.`,
    ctaLabel: "← إعادة تفعيل Pro الآن",
    altText: "هل تمثل منظمة غير حكومية أو وكالة أممية أو وزارة صحة؟",
    altLink: "← برنامج تجريبي مؤسسي مجاني",
    closing: "فريق HealthWatch Global",
    unsubNote: "تتلقى هذا البريد لأنك أنشأت حساباً على healthwatch-global.com.",
  },
  id: {
    subject: "Masih memikirkan HealthWatch? Akses Pro masih tersedia",
    headline: "Masa percobaan Anda berakhir 3 hari lalu.",
    intro: "Anda menggunakan HealthWatch Pro selama 14 hari. Sejak saat itu, Anda tidak lagi memiliki akses ke data lengkap. Apakah ada yang menghalangi Anda untuk berlangganan?",
    questionLabel: "Pertanyaan jujur kami",
    question: "Apakah masalah harga? Apakah Anda membutuhkan penawaran institusional? Atau memang belum waktunya?",
    offerLabel: "Yang Anda lewatkan setiap hari tanpa Pro",
    offerItems: [
      "📊 Angka kasus dan kematian tepat — dikaburkan tanpa Pro",
      "📬 Peringatan email regional real-time",
      "📄 Laporan PDF epidemiologi regional",
      "📥 Ekspor CSV lengkap dari data mentah",
    ],
    pricingNote: `${PRICE_DISPLAY.id.proMonthly}/bulan, tanpa komitmen. Batalkan kapan saja.`,
    ctaLabel: "Aktifkan kembali Pro sekarang →",
    altText: "Mewakili LSM, badan PBB, atau kementerian kesehatan?",
    altLink: "Program pilot institusional gratis →",
    closing: "Tim HealthWatch Global",
    unsubNote: "Anda menerima email ini karena mendaftar di healthwatch-global.com.",
  },
};

// ── J+7 copy ───────────────────────────────────────────────────────────────────

const COPY_J7: Record<string, {
  subject: string;
  headline: string;
  intro: string;
  missedLabel: string;
  missedItems: string[];
  commitLabel: string;
  commit: string;
  ctaLabel: string;
  closing: string;
  unsubNote: string;
}> = {
  fr: {
    subject: "7 jours sans surveillance active — ce que vous avez raté",
    headline: "7 jours sans accès Pro.",
    intro: "En une semaine, des dizaines de nouveaux foyers ont été signalés dans le monde. Vous n'en avez reçu aucune alerte.",
    missedLabel: "Ce qui s'est passé pendant votre absence",
    missedItems: [
      "🦠 Nouveaux foyers en Afrique et en Asie du Sud-Est signalés dans les 7 derniers jours",
      "📊 Données de cas et de décès mises à jour quotidiennement — invisibles depuis l'expiration",
      "📬 Alertes email en temps réel — silencieuses depuis 7 jours",
    ],
    commitLabel: "Pas de frais cachés",
    commit: "Chaque abonnement Pro commence immédiatement. Vous retrouvez l'accès complet en moins d'une minute.",
    ctaLabel: "Reprendre l'accès Pro →",
    closing: "L'équipe HealthWatch Global",
    unsubNote: "Vous recevez cet email car vous avez créé un compte sur healthwatch-global.com.",
  },
  en: {
    subject: "7 days without active surveillance — what you missed",
    headline: "7 days without Pro access.",
    intro: "In one week, dozens of new outbreaks were reported worldwide. You received no alerts.",
    missedLabel: "What happened while you were away",
    missedItems: [
      "🦠 New outbreaks in Africa and Southeast Asia reported in the last 7 days",
      "📊 Case and death counts updated daily — invisible since your trial ended",
      "📬 Real-time email alerts — silent for 7 days",
    ],
    commitLabel: "No hidden fees",
    commit: "Every Pro subscription starts immediately. Full access restored in under a minute.",
    ctaLabel: "Restore Pro access →",
    closing: "The HealthWatch Global Team",
    unsubNote: "You're receiving this email because you created an account on healthwatch-global.com.",
  },
  es: {
    subject: "7 días sin vigilancia activa — lo que se perdió",
    headline: "7 días sin acceso Pro.",
    intro: "En una semana, se notificaron decenas de nuevos brotes en todo el mundo. No recibió ninguna alerta.",
    missedLabel: "Lo que ocurrió durante su ausencia",
    missedItems: [
      "🦠 Nuevos brotes en África y el Sudeste Asiático reportados en los últimos 7 días",
      "📊 Recuentos de casos y fallecidos actualizados diariamente — invisibles desde la expiración",
      "📬 Alertas email en tiempo real — silenciadas durante 7 días",
    ],
    commitLabel: "Sin costes ocultos",
    commit: "Cada suscripción Pro comienza de inmediato. Acceso completo restaurado en menos de un minuto.",
    ctaLabel: "Restaurar acceso Pro →",
    closing: "El equipo de HealthWatch Global",
    unsubNote: "Recibe este correo porque creó una cuenta en healthwatch-global.com.",
  },
  ar: {
    subject: "7 أيام بدون مراقبة نشطة — ما فاتك",
    headline: "7 أيام بدون وصول Pro.",
    intro: "في أسبوع واحد، تم الإبلاغ عن عشرات التفشيات الجديدة حول العالم. لم تتلق أي تنبيه.",
    missedLabel: "ما حدث في غيابك",
    missedItems: [
      "🦠 تفشيات جديدة في أفريقيا وجنوب شرق آسيا أُبلغ عنها في الأيام السبعة الماضية",
      "📊 أرقام الحالات والوفيات تُحدَّث يومياً — غير مرئية منذ انتهاء التجربة",
      "📬 تنبيهات بريد إلكتروني فورية — صامتة منذ 7 أيام",
    ],
    commitLabel: "بدون رسوم خفية",
    commit: "كل اشتراك Pro يبدأ فوراً. استعادة الوصول الكامل في أقل من دقيقة.",
    ctaLabel: "← استعادة وصول Pro",
    closing: "فريق HealthWatch Global",
    unsubNote: "تتلقى هذا البريد لأنك أنشأت حساباً على healthwatch-global.com.",
  },
  id: {
    subject: "7 hari tanpa pengawasan aktif — apa yang terlewat",
    headline: "7 hari tanpa akses Pro.",
    intro: "Dalam satu minggu, puluhan wabah baru dilaporkan di seluruh dunia. Anda tidak menerima peringatan apapun.",
    missedLabel: "Yang terjadi selama Anda tidak aktif",
    missedItems: [
      "🦠 Wabah baru di Afrika dan Asia Tenggara dilaporkan dalam 7 hari terakhir",
      "📊 Jumlah kasus dan kematian diperbarui setiap hari — tidak terlihat sejak masa percobaan berakhir",
      "📬 Peringatan email real-time — diam selama 7 hari",
    ],
    commitLabel: "Tanpa biaya tersembunyi",
    commit: "Setiap langganan Pro dimulai segera. Akses penuh dipulihkan dalam waktu kurang dari satu menit.",
    ctaLabel: "Pulihkan akses Pro →",
    closing: "Tim HealthWatch Global",
    unsubNote: "Anda menerima email ini karena mendaftar di healthwatch-global.com.",
  },
};

function buildEmailJ7(locale: string, userId: string): { subject: string; html: string } {
  const c = COPY_J7[locale] ?? COPY_J7.en;
  const pricingUrl = `https://healthwatch-global.com/${locale}/pricing`;
  const unsubUrl   = `https://healthwatch-global.com/api/unsubscribe-signal?id=${encodeURIComponent(userId)}&locale=${locale}`;

  const body = `
    <div style="padding:36px 32px;">
      <h2 style="margin:0 0 12px;font-size:20px;font-weight:700;color:#f1f5f9;">${c.headline}</h2>
      <p style="color:#94a3b8;font-size:15px;line-height:1.7;margin:0 0 24px;">${c.intro}</p>

      <div style="background:#0f172a;border-radius:12px;padding:20px 24px;margin-bottom:24px;">
        <p style="margin:0 0 14px;font-size:13px;font-weight:700;color:#fca5a5;text-transform:uppercase;letter-spacing:.05em;">${c.missedLabel}</p>
        ${c.missedItems.map((item) => `
        <div style="margin-bottom:10px;">
          <p style="margin:0;font-size:14px;color:#e2e8f0;line-height:1.6;">${item}</p>
        </div>`).join("")}
      </div>

      <div style="background:#1e3a2f;border:1px solid #16a34a44;border-radius:12px;padding:20px 24px;margin-bottom:24px;">
        <p style="margin:0 0 8px;font-size:12px;font-weight:700;color:#34d399;text-transform:uppercase;letter-spacing:.05em;">${c.commitLabel}</p>
        <p style="margin:0;font-size:14px;color:#94a3b8;line-height:1.7;">${c.commit}</p>
      </div>

      <div style="text-align:center;margin-bottom:16px;">
        <a href="${pricingUrl}"
           style="display:inline-block;background:#dc2626;color:white;text-decoration:none;
                  padding:14px 36px;border-radius:8px;font-weight:700;font-size:15px;">
          ${c.ctaLabel}
        </a>
      </div>
    </div>
    <div style="padding:20px 32px;border-top:1px solid #334155;">
      <p style="margin:0 0 8px;font-size:13px;color:#e2e8f0;">${c.closing}</p>
      <p style="margin:0;font-size:11px;color:#475569;">${c.unsubNote} <a href="${unsubUrl}" style="color:#475569;text-decoration:underline;">Unsubscribe</a></p>
    </div>`;

  return { subject: c.subject, html: emailShell(locale, body) };
}

// ── J+3 builder (original) ─────────────────────────────────────────────────────

function buildEmail(locale: string, userId: string): { subject: string; html: string } {
  const c = COPY[locale] ?? COPY.en;
  const pricingUrl = `https://healthwatch-global.com/${locale}/pricing`;
  const pilotUrl   = `https://healthwatch-global.com/${locale}/pilot`;
  const unsubUrl   = `https://healthwatch-global.com/api/unsubscribe-signal?id=${encodeURIComponent(userId)}&locale=${locale}`;

  const body = `
    <div style="padding:36px 32px;">
      <h2 style="margin:0 0 12px;font-size:20px;font-weight:700;color:#f1f5f9;">${c.headline}</h2>
      <p style="color:#94a3b8;font-size:15px;line-height:1.7;margin:0 0 24px;">${c.intro}</p>

      <div style="background:#1e3a5f;border:1px solid #2563eb44;border-radius:12px;padding:20px 24px;margin-bottom:24px;">
        <p style="margin:0 0 8px;font-size:12px;font-weight:700;color:#93c5fd;text-transform:uppercase;letter-spacing:.05em;">${c.questionLabel}</p>
        <p style="margin:0;font-size:15px;font-weight:500;color:#e2e8f0;line-height:1.6;font-style:italic;">${c.question}</p>
      </div>

      <div style="background:#0f172a;border-radius:12px;padding:20px 24px;margin-bottom:24px;">
        <p style="margin:0 0 14px;font-size:13px;font-weight:700;color:#fca5a5;text-transform:uppercase;letter-spacing:.05em;">${c.offerLabel}</p>
        ${c.offerItems.map((item) => `
        <div style="margin-bottom:10px;">
          <p style="margin:0;font-size:14px;color:#e2e8f0;line-height:1.6;">${item}</p>
        </div>`).join("")}
      </div>

      <p style="margin:0 0 20px;font-size:13px;color:#64748b;text-align:center;">${c.pricingNote}</p>

      <div style="text-align:center;margin-bottom:16px;">
        <a href="${pricingUrl}"
           style="display:inline-block;background:#dc2626;color:white;text-decoration:none;
                  padding:14px 36px;border-radius:8px;font-weight:700;font-size:15px;">
          ${c.ctaLabel}
        </a>
      </div>
      <div style="text-align:center;">
        <p style="margin:0 4px;font-size:13px;color:#64748b;">${c.altText}</p>
        <a href="${pilotUrl}" style="color:#60a5fa;font-size:13px;font-weight:600;text-decoration:none;">${c.altLink}</a>
      </div>
    </div>
    <div style="padding:20px 32px;border-top:1px solid #334155;">
      <p style="margin:0 0 8px;font-size:13px;color:#e2e8f0;">${c.closing}</p>
      <p style="margin:0;font-size:11px;color:#475569;">${c.unsubNote} <a href="${unsubUrl}" style="color:#475569;text-decoration:underline;">Unsubscribe</a></p>
    </div>`;

  return { subject: c.subject, html: emailShell(locale, body) };
}

// ── Cron handler ───────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const cronSecret = clean(process.env.CRON_SECRET);
  const auth = req.headers.get("authorization");
  if (!cronSecret || auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!BREVO_KEY) {
    return NextResponse.json({ error: "BREVO_API_KEY not set" }, { status: 500 });
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE) {
    console.error("[winback-sequence] Missing env: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    return NextResponse.json({ error: "env:missing" }, { status: 500 });
  }
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE);

  const isEligible = (p: { email: string | null; display_filters: unknown; trial_ends_at: string | null; created_at: string | null }) => {
    if (!p.email) return false;
    const filters = p.display_filters as Record<string, unknown> | null;
    if (filters?.no_weekly_signal) return false;
    // Skip pilot users (35-day trials) — followed up personally via J+32 conversion email.
    const trialDays = p.trial_ends_at && p.created_at
      ? (new Date(p.trial_ends_at).getTime() - new Date(p.created_at).getTime()) / 86_400_000
      : 14;
    return trialDays <= 20;
  };

  const sendBrevo = async (email: string, subject: string, html: string) => {
    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "api-key": BREVO_KEY!, "Content-Type": "application/json" },
      body: JSON.stringify({
        sender:      { name: "HealthWatch Global", email: "alerts@healthwatch-global.com" },
        to:          [{ email }],
        subject,
        htmlContent: html,
      }),
    });
    if (!res.ok) throw new Error(await res.text());
  };

  // ── J+3 query: trial expired 3 days ago ───────────────────────────────────
  const j3Start = new Date(Date.now() - 3.5 * 86_400_000).toISOString();
  const j3End   = new Date(Date.now() - 2.5 * 86_400_000).toISOString();

  const { data: j3Profiles, error: j3Err } = await supabase
    .from("profiles")
    .select("id, email, locale, trial_ends_at, created_at, display_filters")
    .eq("plan", "free")
    .not("trial_ends_at", "is", null)
    .is("stripe_subscription_id", null)
    .gte("trial_ends_at", j3Start)
    .lt("trial_ends_at", j3End);

  if (j3Err) {
    console.error("[winback] J+3 query error:", j3Err);
    Sentry.captureException(j3Err, { tags: { cron: "winback-sequence", step: "j3-query" } });
    await logCronRun(supabase, "winback-sequence", "error", 0, j3Err.message);
    return NextResponse.json({ error: j3Err.message }, { status: 500 });
  }

  // ── J+7 query: trial expired 7 days ago ───────────────────────────────────
  const j7Start = new Date(Date.now() - 7.5 * 86_400_000).toISOString();
  const j7End   = new Date(Date.now() - 6.5 * 86_400_000).toISOString();

  const { data: j7Profiles, error: j7Err } = await supabase
    .from("profiles")
    .select("id, email, locale, trial_ends_at, created_at, display_filters")
    .eq("plan", "free")
    .not("trial_ends_at", "is", null)
    .is("stripe_subscription_id", null)
    .gte("trial_ends_at", j7Start)
    .lt("trial_ends_at", j7End);

  if (j7Err) {
    console.error("[winback] J+7 query error:", j7Err);
    Sentry.captureException(j7Err, { tags: { cron: "winback-sequence", step: "j7-query" } });
    await logCronRun(supabase, "winback-sequence", "error", 0, j7Err.message);
    return NextResponse.json({ error: j7Err.message }, { status: 500 });
  }

  let j3Sent = 0, j3Failed = 0;
  let j7Sent = 0, j7Failed = 0;

  // ── Send J+3 emails ────────────────────────────────────────────────────────
  for (const profile of j3Profiles ?? []) {
    if (!isEligible(profile)) continue;
    try {
      const locale = profile.locale ?? "en";
      const { subject, html } = buildEmail(locale, profile.id);
      await sendBrevo(profile.email!, subject, html);
      j3Sent++;
    } catch (err) {
      console.error(`[winback] J+3 failed for ${profile.email}:`, err);
      Sentry.captureException(err, { tags: { cron: "winback-sequence", step: "j3", user_id: profile.id } });
      j3Failed++;
    }
    await new Promise((r) => setTimeout(r, 150));
  }

  // ── Send J+7 emails ────────────────────────────────────────────────────────
  for (const profile of j7Profiles ?? []) {
    if (!isEligible(profile)) continue;
    try {
      const locale = profile.locale ?? "en";
      const { subject, html } = buildEmailJ7(locale, profile.id);
      await sendBrevo(profile.email!, subject, html);
      j7Sent++;
    } catch (err) {
      console.error(`[winback] J+7 failed for ${profile.email}:`, err);
      Sentry.captureException(err, { tags: { cron: "winback-sequence", step: "j7", user_id: profile.id } });
      j7Failed++;
    }
    await new Promise((r) => setTimeout(r, 150));
  }

  const totalSent = j3Sent + j7Sent;
  await logCronRun(supabase, "winback-sequence", "ok", totalSent);
  console.log(`[winback] J+3: ${j3Sent}/${j3Failed} | J+7: ${j7Sent}/${j7Failed}`);
  return NextResponse.json({
    j3: { sent: j3Sent, failed: j3Failed, total: (j3Profiles ?? []).length },
    j7: { sent: j7Sent, failed: j7Failed, total: (j7Profiles ?? []).length },
  });
}
