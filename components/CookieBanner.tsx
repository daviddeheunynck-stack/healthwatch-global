"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const STORAGE_KEY = "hwg_cookie_consent";

const LABELS: Record<string, {
  text: string;
  accept: string;
  decline: string;
  policy: string;
}> = {
  fr: {
    text: "Nous utilisons le stockage local pour mémoriser vos préférences et mesurer l'audience de façon anonyme (Vercel Analytics — aucune donnée personnelle collectée).",
    accept: "Accepter",
    decline: "Refuser",
    policy: "Politique de confidentialité",
  },
  en: {
    text: "We use local storage to remember your preferences and measure audience anonymously (Vercel Analytics — no personal data collected).",
    accept: "Accept",
    decline: "Decline",
    policy: "Privacy Policy",
  },
  es: {
    text: "Usamos almacenamiento local para recordar sus preferencias y medir la audiencia de forma anónima (Vercel Analytics — sin datos personales).",
    accept: "Aceptar",
    decline: "Rechazar",
    policy: "Política de privacidad",
  },
  ar: {
    text: "نستخدم التخزين المحلي لحفظ تفضيلاتك وقياس الجمهور بشكل مجهول (Vercel Analytics — لا تُجمع بيانات شخصية).",
    accept: "قبول",
    decline: "رفض",
    policy: "سياسة الخصوصية",
  },
  id: {
    text: "Kami menggunakan penyimpanan lokal untuk mengingat preferensi Anda dan mengukur audiens secara anonim (Vercel Analytics — tidak ada data pribadi yang dikumpulkan).",
    accept: "Terima",
    decline: "Tolak",
    policy: "Kebijakan Privasi",
  },
};

export type ConsentValue = "accepted" | "declined";

export function getConsent(): ConsentValue | null {
  if (typeof window === "undefined") return null;
  return (localStorage.getItem(STORAGE_KEY) as ConsentValue) ?? null;
}

export default function CookieBanner({ locale }: { locale: string }) {
  const [visible, setVisible] = useState(false);
  const l = LABELS[locale] ?? LABELS.fr;
  const dir = locale === "ar" ? "rtl" : "ltr";

  useEffect(() => {
    if (!getConsent()) setVisible(true);
  }, []);

  function respond(value: ConsentValue) {
    localStorage.setItem(STORAGE_KEY, value);
    setVisible(false);
    // Dispatch event so analytics can be lazily initialised on "accepted"
    window.dispatchEvent(new CustomEvent("cookie-consent", { detail: value }));
  }

  if (!visible) return null;

  return (
    <div
      dir={dir}
      role="dialog"
      aria-label="Cookie consent"
      className="fixed bottom-0 left-0 right-0 z-50 p-4"
    >
      <div className="max-w-3xl mx-auto bg-slate-800 border border-slate-600 rounded-xl shadow-2xl
                      flex flex-col sm:flex-row items-start sm:items-center gap-4 px-5 py-4">

        {/* Text */}
        <p className="flex-1 text-sm text-slate-300 leading-relaxed">
          {l.text}{" "}
          <Link
            href={`/${locale}/privacy`}
            className="text-red-400 hover:underline whitespace-nowrap"
          >
            {l.policy}
          </Link>
        </p>

        {/* Buttons */}
        <div className="flex gap-2 shrink-0">
          <button
            onClick={() => respond("declined")}
            className="px-4 py-2 text-sm rounded-lg border border-slate-500
                       text-slate-300 hover:bg-slate-700 transition-colors"
          >
            {l.decline}
          </button>
          <button
            onClick={() => respond("accepted")}
            className="px-4 py-2 text-sm rounded-lg bg-red-600 hover:bg-red-500
                       text-white font-semibold transition-colors"
          >
            {l.accept}
          </button>
        </div>
      </div>
    </div>
  );
}
