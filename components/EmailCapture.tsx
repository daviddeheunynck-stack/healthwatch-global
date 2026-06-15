"use client";

import { useState } from "react";

type Locale = "en" | "fr" | "es" | "ar" | "id";

const COPY: Record<Locale, {
  placeholder: string;
  btn: string;
  btnLoading: string;
  success: string;
  errorInvalid: string;
  errorGeneric: string;
}> = {
  en: {
    placeholder: "your@email.com",
    btn: "Get free alerts",
    btnLoading: "Subscribing…",
    success: "Confirmed! Check your inbox for the confirmation email.",
    errorInvalid: "Please enter a valid email address.",
    errorGeneric: "Something went wrong — please try again.",
  },
  fr: {
    placeholder: "votre@email.com",
    btn: "Recevoir les alertes gratuitement",
    btnLoading: "Inscription…",
    success: "Confirmé ! Vérifiez votre boîte mail.",
    errorInvalid: "Veuillez saisir une adresse e-mail valide.",
    errorGeneric: "Une erreur est survenue — veuillez réessayer.",
  },
  es: {
    placeholder: "tu@email.com",
    btn: "Recibir alertas gratis",
    btnLoading: "Suscribiendo…",
    success: "¡Confirmado! Revisa tu bandeja de entrada.",
    errorInvalid: "Por favor ingresa un email válido.",
    errorGeneric: "Algo salió mal — inténtalo de nuevo.",
  },
  ar: {
    placeholder: "بريدك@الإلكتروني.com",
    btn: "احصل على تنبيهات مجانية",
    btnLoading: "جارٍ الاشتراك…",
    success: "تم التأكيد! تحقق من بريدك الإلكتروني.",
    errorInvalid: "يرجى إدخال بريد إلكتروني صحيح.",
    errorGeneric: "حدث خطأ — يرجى المحاولة مرة أخرى.",
  },
  id: {
    placeholder: "email@anda.com",
    btn: "Dapatkan peringatan gratis",
    btnLoading: "Mendaftar…",
    success: "Dikonfirmasi! Periksa kotak masuk Anda.",
    errorInvalid: "Masukkan alamat email yang valid.",
    errorGeneric: "Terjadi kesalahan — coba lagi.",
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
    <div className="bg-red-950/30 border border-red-900/40 rounded-2xl p-6 text-center space-y-3">
      <p className="font-semibold text-white text-lg">{title}</p>
      <p className="text-sm text-gray-400">{body}</p>

      {status === "success" ? (
        <p className="text-green-400 text-sm font-medium pt-1">{c.success}</p>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-2 justify-center pt-1">
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
            className="bg-red-600 hover:bg-red-500 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold px-5 py-2.5 rounded-lg transition-colors text-sm whitespace-nowrap"
          >
            {status === "loading" ? c.btnLoading : c.btn}
          </button>
        </form>
      )}

      {status === "error" && (
        <p className="text-red-400 text-xs">{errMsg}</p>
      )}

      <p className="text-xs text-gray-600">
        {l === "fr" && "Digest hebdomadaire · Sources OMS, CDC, ECDC · Désabonnement facile"}
        {l === "en" && "Weekly digest · WHO, CDC, ECDC sources · Easy unsubscribe"}
        {l === "es" && "Resumen semanal · Fuentes OMS, CDC, ECDC · Fácil cancelación"}
        {l === "ar" && "ملخص أسبوعي · مصادر منظمة الصحة العالمية · إلغاء اشتراك سهل"}
        {l === "id" && "Digest mingguan · Sumber WHO, CDC, ECDC · Berhenti berlangganan mudah"}
      </p>
    </div>
  );
}
