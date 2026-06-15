"use client";

import { useState } from "react";
import CheckoutButton from "@/components/CheckoutButton";

type Locale = "en" | "fr" | "es" | "ar" | "id";

const COPY: Record<Locale, {
  placeholder: string;
  btn: string;
  btnLoading: string;
  success: string;
  errorInvalid: string;
  errorGeneric: string;
  proTitle: string;
  proSub: string;
  proBtn: string;
  trialNote: string;
  divider: string;
  digestLabel: string;
}> = {
  en: {
    placeholder: "your@email.com",
    btn: "Get free digest",
    btnLoading: "Subscribing…",
    success: "Confirmed! Check your inbox for the confirmation email.",
    errorInvalid: "Please enter a valid email address.",
    errorGeneric: "Something went wrong — please try again.",
    proTitle: "Track every outbreak in real time",
    proSub: "Exact case & death counts · Regional alerts · PDF reports · CSV export",
    proBtn: "Start free trial →",
    trialNote: "14 days free · No credit card",
    divider: "or get the free weekly digest",
    digestLabel: "Weekly digest · WHO, CDC, ECDC sources · Easy unsubscribe",
  },
  fr: {
    placeholder: "votre@email.com",
    btn: "Recevoir le digest gratuit",
    btnLoading: "Inscription…",
    success: "Confirmé ! Vérifiez votre boîte mail.",
    errorInvalid: "Veuillez saisir une adresse e-mail valide.",
    errorGeneric: "Une erreur est survenue — veuillez réessayer.",
    proTitle: "Suivre chaque foyer en temps réel",
    proSub: "Chiffres exacts de cas & décès · Alertes régionales · Rapports PDF · Export CSV",
    proBtn: "Commencer l'essai gratuit →",
    trialNote: "14 jours gratuits · Sans carte bancaire",
    divider: "ou recevoir le digest hebdomadaire gratuit",
    digestLabel: "Digest hebdomadaire · Sources OMS, CDC, ECDC · Désabonnement facile",
  },
  es: {
    placeholder: "tu@email.com",
    btn: "Recibir digest gratis",
    btnLoading: "Suscribiendo…",
    success: "¡Confirmado! Revisa tu bandeja de entrada.",
    errorInvalid: "Por favor ingresa un email válido.",
    errorGeneric: "Algo salió mal — inténtalo de nuevo.",
    proTitle: "Seguir cada brote en tiempo real",
    proSub: "Cifras exactas de casos y fallecidos · Alertas regionales · Informes PDF · Exportación CSV",
    proBtn: "Iniciar prueba gratuita →",
    trialNote: "14 días gratis · Sin tarjeta de crédito",
    divider: "o recibe el digest semanal gratuito",
    digestLabel: "Resumen semanal · Fuentes OMS, CDC, ECDC · Fácil cancelación",
  },
  ar: {
    placeholder: "بريدك@الإلكتروني.com",
    btn: "احصل على الملخص المجاني",
    btnLoading: "جارٍ الاشتراك…",
    success: "تم التأكيد! تحقق من بريدك الإلكتروني.",
    errorInvalid: "يرجى إدخال بريد إلكتروني صحيح.",
    errorGeneric: "حدث خطأ — يرجى المحاولة مرة أخرى.",
    proTitle: "تتبع كل تفشٍّ في الوقت الفعلي",
    proSub: "أرقام دقيقة للحالات والوفيات · تنبيهات إقليمية · تقارير PDF · تصدير CSV",
    proBtn: "← ابدأ التجربة المجانية",
    trialNote: "14 يوماً مجاناً · بدون بطاقة بنكية",
    divider: "أو احصل على الملخص الأسبوعي المجاني",
    digestLabel: "ملخص أسبوعي · مصادر منظمة الصحة العالمية · إلغاء اشتراك سهل",
  },
  id: {
    placeholder: "email@anda.com",
    btn: "Dapatkan digest gratis",
    btnLoading: "Mendaftar…",
    success: "Dikonfirmasi! Periksa kotak masuk Anda.",
    errorInvalid: "Masukkan alamat email yang valid.",
    errorGeneric: "Terjadi kesalahan — coba lagi.",
    proTitle: "Lacak setiap wabah secara real-time",
    proSub: "Angka kasus & kematian tepat · Peringatan regional · Laporan PDF · Ekspor CSV",
    proBtn: "Mulai uji coba gratis →",
    trialNote: "14 hari gratis · Tanpa kartu kredit",
    divider: "atau dapatkan digest mingguan gratis",
    digestLabel: "Digest mingguan · Sumber WHO, CDC, ECDC · Berhenti berlangganan mudah",
  },
};

interface Props {
  locale: string;
  region?: string;
  title: string;
  body: string;
}

export default function EmailCapture({ locale, region = "all", title, body }: Props) {
  const l = (["en","fr","es","ar","id"].includes(locale) ? locale : "en") as Locale;
  const c = COPY[l];
  const isRtl = l === "ar";

  const [email, setEmail]   = useState("");
  const [status, setStatus] = useState<"idle"|"loading"|"success"|"error">("idle");
  const [errMsg, setErrMsg] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setStatus("error");
      setErrMsg(c.errorInvalid);
      return;
    }
    setStatus("loading");
    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed, region, locale: l }),
      });
      if (res.ok) {
        setStatus("success");
      } else {
        const data = await res.json().catch(() => ({}));
        setStatus("error");
        setErrMsg(data.error || c.errorGeneric);
      }
    } catch {
      setStatus("error");
      setErrMsg(c.errorGeneric);
    }
  }

  return (
    <div className="bg-red-950/30 border border-red-900/40 rounded-2xl p-6 space-y-5" dir={isRtl ? "rtl" : undefined}>

      {/* Pro CTA — primary */}
      <div className="text-center space-y-3">
        <div>
          <p className="font-semibold text-white text-lg">{c.proTitle}</p>
          <p className="text-xs text-gray-400 mt-1">{c.proSub}</p>
        </div>
        <CheckoutButton
          plan="pro"
          locale={locale}
          label={c.proBtn}
          className="inline-block bg-red-600 hover:bg-red-500 text-white font-semibold px-6 py-2.5 rounded-lg transition-colors text-sm"
        />
        <p className="text-xs text-gray-600">{c.trialNote}</p>
      </div>

      {/* Divider */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-px bg-gray-800" />
        <span className="text-xs text-gray-600 shrink-0">{c.divider}</span>
        <div className="flex-1 h-px bg-gray-800" />
      </div>

      {/* Free digest form — secondary */}
      <div className="space-y-3 text-center">
        <div>
          <p className="font-medium text-gray-300 text-sm">{title}</p>
          <p className="text-xs text-gray-500 mt-0.5">{body}</p>
        </div>

        {status === "success" ? (
          <p className="text-green-400 text-sm font-medium">{c.success}</p>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-2 justify-center">
            <input
              type="email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); if (status === "error") setStatus("idle"); }}
              placeholder={c.placeholder}
              required
              disabled={status === "loading"}
              className="bg-gray-900 border border-gray-700 text-white placeholder-gray-600 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-red-500 w-full sm:w-64 disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={status === "loading"}
              className="bg-gray-700 hover:bg-gray-600 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold px-5 py-2.5 rounded-lg transition-colors text-sm whitespace-nowrap"
            >
              {status === "loading" ? c.btnLoading : c.btn}
            </button>
          </form>
        )}

        {status === "error" && (
          <p className="text-red-400 text-xs">{errMsg}</p>
        )}

        <p className="text-xs text-gray-600">{c.digestLabel}</p>
      </div>
    </div>
  );
}
