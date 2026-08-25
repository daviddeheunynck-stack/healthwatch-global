"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase-browser";
import { track } from "@vercel/analytics/react";
import * as Sentry from "@sentry/nextjs";
import { Activity, Loader2, CheckCircle, BarChart2, Bell, FileDown, Lock, Sparkles } from "lucide-react";
import Link from "next/link";
import OAuthButtons from "@/components/OAuthButtons";

// Shown when supabase.auth.signUp() throws instead of resolving with
// {error} — see handleSignup below for why that happens and why it must
// never be left to just hang. Deliberately generic (not error.message):
// an uncaught exception here isn't a recognized AuthError, so its message
// is whatever a browser/crypto/storage API happened to throw, not
// something meant for an end user.
const UNEXPECTED_ERROR: Record<string, string> = {
  en: "Something went wrong creating your account. Please try again, or email contact@healthwatch-global.com if it persists.",
  fr: "Une erreur est survenue lors de la création de votre compte. Réessayez, ou écrivez à contact@healthwatch-global.com si le problème persiste.",
  es: "Ocurrió un error al crear su cuenta. Inténtelo de nuevo, o escriba a contact@healthwatch-global.com si persiste.",
  ar: "حدث خطأ أثناء إنشاء حسابك. يرجى المحاولة مرة أخرى، أو مراسلة contact@healthwatch-global.com إذا استمرت المشكلة.",
  id: "Terjadi kesalahan saat membuat akun Anda. Coba lagi, atau kirim email ke contact@healthwatch-global.com jika masalah berlanjut.",
};

const TRIAL_START_NOTE: Record<string, string> = {
  en: "Your 14-day Pro trial starts as soon as you confirm your email.",
  fr: "Votre essai Pro de 14 jours commence dès que vous confirmez votre email.",
  es: "Su prueba Pro de 14 días comienza en cuanto confirme su email.",
  ar: "تجربتك المجانية لمدة 14 يوماً تبدأ بمجرد تأكيد بريدك الإلكتروني.",
  id: "Uji coba Pro 14 hari Anda dimulai segera setelah mengkonfirmasi email.",
};

// Catches Gmail lookalike domains at signup — added 2026-08-19 after
// emmabahati@429gmail.com sat in the trial cohort for 12 days with 0 sessions:
// "429gmail.com" is a real, registered catch-all domain (MX records resolve),
// so it never hard-bounces and never trips the Brevo blocklist sync in
// lib/brevo-blocklist.ts. Nothing else in the funnel would ever have caught it.
// Plain Levenshtein distance alone misses this shape (inserting "429gmail" in
// front of ".com" is 3+ edits away from "gmail.com"), so a domain that simply
// contains "gmail.com" without being it is flagged directly.
function levenshtein(a: string, b: string): number {
  const dp: number[][] = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j - 1], dp[i - 1][j], dp[i][j - 1]);
    }
  }
  return dp[a.length][b.length];
}

function gmailTypoSuggestion(email: string): string | null {
  const domain = email.split("@")[1]?.toLowerCase().trim();
  if (!domain) return null;
  if (domain === "gmail.com" || domain === "googlemail.com") return null;
  const looksNearGmail = domain.includes("gmail.com") || levenshtein(domain, "gmail.com") <= 2;
  return looksNearGmail ? "gmail.com" : null;
}

const GMAIL_TYPO_WARNING: Record<string, string> = {
  en: "This doesn't look like a real Gmail address — did you mean",
  fr: "Cette adresse ne ressemble pas à une vraie adresse Gmail — vouliez-vous dire",
  es: "Esta dirección no parece una dirección de Gmail real — ¿quiso decir",
  ar: "لا يبدو هذا عنوان Gmail حقيقياً — هل تقصد",
  id: "Alamat ini tidak terlihat seperti alamat Gmail asli — maksud Anda",
};

const GMAIL_TYPO_KEEP: Record<string, string> = {
  en: "No, this address is correct",
  fr: "Non, cette adresse est correcte",
  es: "No, esta dirección es correcta",
  ar: "لا، هذا العنوان صحيح",
  id: "Tidak, alamat ini sudah benar",
};

const VALUE_PROPS: Record<string, { trial: string; items: string[]; noCard: string; gdpr: string; alreadyRegistered: { text: string; signIn: string; or: string; reset: string } }> = {
  en: {
    trial: "14-day Pro trial included — no credit card",
    items: [
      "Exact case & death figures",
      "Instant regional alerts",
      "PDF reports & CSV export",
    ],
    noCard: "No credit card required",
    gdpr: "GDPR compliant · Data never sold",
    alreadyRegistered: { text: "An account already exists for this email.", signIn: "Sign in", or: "or", reset: "reset your password" },
  },
  fr: {
    trial: "Essai Pro 14 jours inclus — sans carte bancaire",
    items: [
      "Chiffres exacts cas & décès",
      "Alertes régionales instantanées",
      "Rapports PDF & export CSV",
    ],
    noCard: "Sans carte bancaire",
    gdpr: "Conforme RGPD · Données jamais revendues",
    alreadyRegistered: { text: "Un compte existe déjà pour cet email.", signIn: "Se connecter", or: "ou", reset: "réinitialiser votre mot de passe" },
  },
  es: {
    trial: "Prueba Pro 14 días incluida — sin tarjeta",
    items: [
      "Cifras exactas de casos y fallecidos",
      "Alertas regionales instantáneas",
      "Informes PDF y exportación CSV",
    ],
    noCard: "Sin tarjeta de crédito",
    gdpr: "Cumple GDPR · Datos nunca vendidos",
    alreadyRegistered: { text: "Ya existe una cuenta con este email.", signIn: "Iniciar sesión", or: "o", reset: "restablecer tu contraseña" },
  },
  ar: {
    trial: "تجربة Pro 14 يوماً مجاناً — بدون بطاقة بنكية",
    items: [
      "أرقام دقيقة للحالات والوفيات",
      "تنبيهات إقليمية فورية",
      "تقارير PDF وتصدير CSV",
    ],
    noCard: "لا حاجة لبطاقة ائتمانية",
    gdpr: "متوافق مع GDPR · بياناتك لن تُباع أبداً",
    alreadyRegistered: { text: "يوجد حساب مرتبط بهذا البريد الإلكتروني.", signIn: "تسجيل الدخول", or: "أو", reset: "إعادة تعيين كلمة المرور" },
  },
  id: {
    trial: "Uji coba Pro 14 hari termasuk — tanpa kartu kredit",
    items: [
      "Angka kasus & kematian tepat",
      "Peringatan regional instan",
      "Laporan PDF & ekspor CSV",
    ],
    noCard: "Tanpa kartu kredit",
    gdpr: "Sesuai GDPR · Data tidak pernah dijual",
    alreadyRegistered: { text: "Akun dengan email ini sudah ada.", signIn: "Masuk", or: "atau", reset: "atur ulang kata sandi" },
  },
};

const ICONS = [BarChart2, Bell, FileDown];

// Same 5-region taxonomy as AlertRegionToggles/account page.
//
// REQUIS depuis le 2026-08-25, apres mesure. Ce champ etait facultatif et son
// option vide valait "toutes les regions" : presque personne ne repondait, donc
// presque tout le monde etait inscrit aux cinq. Releve sur 30 jours ce jour-la :
// 2 091 couples (utilisateur, foyer) pousses sur 25 comptes, avec une
// distribution PLATE — 117, 117, 117, 116, 115, 115, 115... Tout le monde
// recevait la meme chose. Sur ~32 comptes reels, 4 adresses bloquees chez Brevo,
// dont une conversion institutionnelle en essai Pro qui n'avait jamais ouvert le
// produit. Un compte sur huit : un taux sain se compte en fractions de pour cent.
//
// Le cablage vers activate-trial existait et fonctionnait ; c'est le defaut
// silencieux qui le vidait de son sens. "Toutes les regions" reste disponible,
// mais comme un choix explicite — pas comme ce qu'on obtient en ne repondant pas.
// L'intention etait deja ecrite dans lib/activate-trial.ts : "un e-mail
// hebdomadaire sur un pays que vous avez demande est un produit ; un e-mail sur
// cinq continents ressemble a une newsletter."
//
// Non couvert ici : les inscriptions OAuth et les comptes provisionnes par
// script ne voient jamais ce formulaire et retombent sur les cinq regions.
const REGION_PICKER: Record<string, { label: string; prompt: string; required: string; all: string; options: Record<string, string> }> = {
  en: {
    label: "Which region matters most to you?",
    prompt: "Select a region",
    required: "Please choose a region — it decides which alerts you get.",
    all: "All regions",
    options: { africa: "Africa", asia: "Asia", americas: "Americas", europe: "Europe", oceania: "Oceania" },
  },
  fr: {
    label: "Quelle région vous intéresse en priorité ?",
    prompt: "Choisissez une région",
    required: "Choisissez une région — c’est elle qui détermine vos alertes.",
    all: "Toutes les régions",
    options: { africa: "Afrique", asia: "Asie", americas: "Amériques", europe: "Europe", oceania: "Océanie" },
  },
  es: {
    label: "¿Qué región le interesa prioritariamente?",
    prompt: "Elija una región",
    required: "Elija una región — determina las alertas que recibirá.",
    all: "Todas las regiones",
    options: { africa: "África", asia: "Asia", americas: "Américas", europe: "Europa", oceania: "Oceanía" },
  },
  ar: {
    label: "ما المنطقة الأهم بالنسبة لك؟",
    prompt: "اختر منطقة",
    required: "اختر منطقة — هي التي تحدد التنبيهات التي تصلك.",
    all: "كل المناطق",
    options: { africa: "أفريقيا", asia: "آسيا", americas: "الأمريكتين", europe: "أوروبا", oceania: "أوقيانوسيا" },
  },
  id: {
    label: "Wilayah mana yang paling penting bagi Anda?",
    prompt: "Pilih wilayah",
    required: "Pilih wilayah — ini menentukan peringatan yang Anda terima.",
    all: "Semua wilayah",
    options: { africa: "Afrika", asia: "Asia", americas: "Amerika", europe: "Eropa", oceania: "Oseania" },
  },
};

export default function SignupPage() {
  const t = useTranslations("auth");
  const locale = useLocale();
  const vp = VALUE_PROPS[locale] ?? VALUE_PROPS.en;
  const rp = REGION_PICKER[locale] ?? REGION_PICKER.en;
  const isRtl = locale === "ar";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [priorityRegion, setPriorityRegion] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [gmailTypo, setGmailTypo] = useState<string | null>(null);

  const submitSignup = async () => {
    // Double avec l'attribut `required` du select : la validation native ne
    // s'applique qu'a une soumission de formulaire, et ce gestionnaire est
    // aussi appelable autrement.
    if (!priorityRegion) {
      setError(rp.required);
      return;
    }

    setLoading(true);
    setError("");
    track("signup_attempt", { method: "email", locale });

    // Supabase itself only rejects an exact duplicate email — john+trial@gmail.com
    // looks brand new to it even though it's the same inbox as an existing
    // account. Checked server-side (app/api/check-email-alias) before
    // signUp() so a blocked attempt never creates an orphaned auth user.
    // Fails open (never blocks) on a network/lookup error.
    const aliasCheck = await fetch("/api/check-email-alias", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    }).then((r) => (r.ok ? r.json() : { alreadyRegistered: false })).catch(() => ({ alreadyRegistered: false }));

    if (aliasCheck.alreadyRegistered) {
      track("signup_alias_blocked", { method: "email", locale });
      setError("User already registered");
      setLoading(false);
      return;
    }

    const supabase = createClient();
    // supabase-js's signUp() only catches errors it recognizes as its own
    // AuthError types and returns those as `{error}` — anything else (a
    // storage/crypto API blocked by a locked-down corporate browser, an
    // unrecognized network failure) is re-thrown instead of resolved. Without
    // this try/catch that left the button spinning forever with no error
    // shown, no Sentry event, and no DB row — invisible everywhere except to
    // the person stuck looking at a dead form. Found 2026-08-03 after a WHO
    // epidemiologist reported "I wasn't able to create an account" with
    // nothing else to go on — the exact shape a bug in this class produces.
    try {
      const { data: signUpData, error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=/${locale}` },
      });

      if (error) {
        // Nothing else records this: the branch below is the only trace a
        // failed signup ever leaves. Found 2026-08-04: a leaked secret key
        // rejected every signup for weeks and this exact spot stayed silent
        // the whole time. Domain only, never the full address (nobody here
        // has an account yet). Fire-and-forget: a tracking hiccup must
        // never block the error the person is already looking at.
        fetch("/api/track-auth-failure", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            flow: "signup",
            method: "email",
            errorCode: error.code ?? "unknown",
            emailDomain: email.split("@")[1]?.toLowerCase() ?? null,
          }),
        }).catch(() => {});
        setError(error.message);
        setLoading(false);
        return;
      }

      const userId = signUpData.user?.id;

      // Save locale to profile so all transactional emails use the right language
      if (userId) {
        supabase.from("profiles").update({ locale, alert_locale: locale }).eq("id", userId).then(() => {});
      }

      // Fire welcome email — non-blocking
      fetch("/api/send-welcome", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, locale }),
      }).catch(() => {});

      // When mailer_autoconfirm is ON, Supabase returns a session immediately —
      // the /auth/callback route is never called, so the trial must be activated here.
      // Redirect straight to the dashboard so the user doesn't see "check your email".
      if (signUpData.session && userId) {
        track("signup_success", { method: "email", locale, autoconfirm: true });
        // activate-trial reads the session from cookies, which can lag a beat right
        // after signUp() — retry once so a losing race doesn't silently skip the trial.
        let activated = false;
        for (let attempt = 0; attempt < 2 && !activated; attempt++) {
          if (attempt > 0) await new Promise((r) => setTimeout(r, 600));
          const res = await fetch("/api/activate-trial", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            // "all" est un choix explicite : on n'envoie rien et l'API retombe
            // sur les cinq regions, exactement comme avant ce champ.
            body: JSON.stringify(priorityRegion && priorityRegion !== "all" ? { priorityRegion } : {}),
          }).catch(() => null);
          activated = !!res?.ok;
        }
        if (!activated) track("activate_trial_failed", { method: "email", locale });
        // Hard redirect (not router.push) so the Navbar remounts and reads the
        // updated plan from Supabase — client-side nav keeps the old "free" state.
        window.location.assign(`/${locale}`);
        return;
      }

      track("signup_success", { method: "email", locale, autoconfirm: false });
      setSuccess(true);
      setLoading(false);
    } catch (err) {
      console.error("[signup] unexpected exception:", err);
      Sentry.captureException(err, { tags: { flow: "signup", method: "email", locale } });
      track("signup_unexpected_error", { method: "email", locale });
      setError(UNEXPECTED_ERROR[locale] ?? UNEXPECTED_ERROR.en);
      setLoading(false);
    }
  };

  // Interrupts submission once per suspicious address so the person confirms
  // or fixes it — never a hard block, since the heuristic can misfire on a
  // legitimate lookalike domain. Re-editing the email field (see onChange
  // below) clears gmailTypo so a corrected address re-checks on next submit.
  const handleSignup = (e: React.FormEvent) => {
    e.preventDefault();
    const suggestion = gmailTypoSuggestion(email);
    if (suggestion) {
      setGmailTypo(suggestion);
      track("signup_typo_warning_shown", { locale, domain: email.split("@")[1]?.toLowerCase() ?? null });
      return;
    }
    submitSignup();
  };

  return (
    <div className="min-h-[70vh] flex items-center justify-center py-8 px-4">
      <div className="w-full max-w-4xl grid md:grid-cols-2 gap-8 items-center" dir={isRtl ? "rtl" : undefined}>

        {/* Left — value proposition */}
        <div className="space-y-6 hidden md:block">
          <div className="flex items-center gap-2.5">
            <Activity className="text-red-500 w-7 h-7 shrink-0" />
            <span className="font-bold text-white text-xl">HealthWatch Global</span>
          </div>

          <div>
            <div className="inline-flex items-center gap-1.5 bg-green-500/10 border border-green-500/20 rounded-lg px-3 py-1.5 mb-3">
              <Sparkles className="w-3.5 h-3.5 text-green-400" />
              <span className="text-xs font-semibold text-green-400">{vp.trial}</span>
            </div>
            <h2 className="text-2xl font-bold text-white leading-tight">
              {t("signupTitle")}
            </h2>
            <p className="text-gray-400 mt-2 text-sm leading-relaxed">
              {vp.gdpr}
            </p>
          </div>

          <ul className="space-y-3">
            {vp.items.map((item, i) => {
              const Icon = ICONS[i];
              return (
                <li key={i} className="flex items-center gap-3 text-sm text-gray-300">
                  <div className="w-8 h-8 rounded-lg bg-red-600/10 border border-red-600/20 flex items-center justify-center shrink-0">
                    <Icon className="w-4 h-4 text-red-400" />
                  </div>
                  {item}
                </li>
              );
            })}
          </ul>

          <div className="flex items-center gap-2 text-xs text-gray-600 pt-2">
            <Lock className="w-3.5 h-3.5 shrink-0" />
            {vp.gdpr}
          </div>
        </div>

        {/* Right — form */}
        <div>
          {/* Mobile header */}
          <div className="text-center mb-6 md:hidden">
            <Activity className="text-red-500 w-9 h-9 mx-auto mb-2" />
            <h1 className="text-2xl font-bold text-white">{t("signupTitle")}</h1>
            <div className="inline-flex items-center gap-1.5 bg-green-500/10 border border-green-500/20 rounded-lg px-3 py-1.5 mt-3">
              <Sparkles className="w-3.5 h-3.5 text-green-400" />
              <span className="text-xs font-semibold text-green-400">{vp.trial}</span>
            </div>
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8">
            {success ? (
              <div className="flex flex-col items-center py-8 gap-4 text-center">
                <div className="w-16 h-16 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center">
                  <CheckCircle className="w-8 h-8 text-green-400" />
                </div>
                <div>
                  <p className="text-lg font-semibold text-white">{t("successSignup")}</p>
                  <p className="text-sm text-gray-400 mt-1">{t("checkEmailSignup")}</p>
                  <p className="text-xs text-blue-400 mt-2">{TRIAL_START_NOTE[locale] ?? TRIAL_START_NOTE.en}</p>
                </div>
                <Link
                  href={`/${locale}/login`}
                  className="mt-2 text-sm text-red-400 hover:text-red-300 transition-colors"
                >
                  {t("loginLink")} →
                </Link>
              </div>
            ) : (
              <>
                <div className="space-y-4 mb-5">
                  <OAuthButtons locale={locale} />
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-px bg-gray-800" />
                    <span className="text-xs text-gray-600">{t("or")}</span>
                    <div className="flex-1 h-px bg-gray-800" />
                  </div>
                </div>
                <form onSubmit={handleSignup} className="space-y-4">
                  <div>
                    <label className="block text-sm text-gray-400 mb-1.5">{t("email")}</label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => { setEmail(e.target.value); setGmailTypo(null); }}
                      required
                      disabled={loading}
                      autoComplete="email"
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-red-500 transition-colors disabled:opacity-50"
                      placeholder="you@organization.org"
                    />
                    {gmailTypo && (
                      <p className="text-xs text-amber-400 mt-1.5">
                        {GMAIL_TYPO_WARNING[locale] ?? GMAIL_TYPO_WARNING.en}{" "}
                        <button
                          type="button"
                          onClick={() => { setEmail(`${email.split("@")[0]}@${gmailTypo}`); setGmailTypo(null); }}
                          className="underline hover:text-amber-300 font-medium"
                        >
                          {email.split("@")[0]}@{gmailTypo}
                        </button>
                        ?{" "}
                        <button
                          type="button"
                          onClick={() => { setGmailTypo(null); submitSignup(); }}
                          className="underline hover:text-amber-300"
                        >
                          {GMAIL_TYPO_KEEP[locale] ?? GMAIL_TYPO_KEEP.en}
                        </button>
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1.5">{t("password")}</label>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      disabled={loading}
                      minLength={8}
                      autoComplete="new-password"
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-red-500 transition-colors disabled:opacity-50"
                      placeholder="••••••••"
                    />
                    <p className="text-xs text-gray-600 mt-1">{t("passwordHint")}</p>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1.5">{rp.label}</label>
                    <select
                      value={priorityRegion}
                      onChange={(e) => setPriorityRegion(e.target.value)}
                      disabled={loading}
                      required
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-red-500 transition-colors disabled:opacity-50"
                    >
                      <option value="" disabled>{rp.prompt}</option>
                      <option value="all">{rp.all}</option>
                      {Object.entries(rp.options).map(([value, label]) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </select>
                  </div>

                  {error && (
                    /already registered/i.test(error) ? (
                      <p className="text-sm text-amber-400">
                        {vp.alreadyRegistered.text}{" "}
                        <Link href={`/${locale}/login`} className="underline hover:text-amber-300 font-medium">
                          {vp.alreadyRegistered.signIn}
                        </Link>
                        {" "}{vp.alreadyRegistered.or}{" "}
                        <Link href={`/${locale}/forgot-password`} className="underline hover:text-amber-300 font-medium">
                          {vp.alreadyRegistered.reset}
                        </Link>
                        .
                      </p>
                    ) : (
                      <p className="text-red-400 text-sm">{error}</p>
                    )
                  )}

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-red-600 hover:bg-red-500 disabled:opacity-60 text-white font-semibold py-3 rounded-lg transition-colors flex items-center justify-center gap-2 text-sm"
                  >
                    {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                    {t("signup")}
                  </button>
                </form>

                <div className="mt-5 space-y-3">
                  <p className="text-center text-xs text-gray-600 flex items-center justify-center gap-1.5">
                    <Lock className="w-3 h-3" />
                    {vp.noCard} · {vp.gdpr}
                  </p>
                  <p className="text-center text-sm text-gray-500">
                    {t("alreadyHaveAccount")}{" "}
                    <Link href={`/${locale}/login`} className="text-red-400 hover:text-red-300 font-medium">
                      {t("loginLink")}
                    </Link>
                  </p>
                </div>
              </>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
