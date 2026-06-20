"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";

export const STORAGE_KEY = "hwg_cookie_consent";

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

// ── useSyncExternalStore plumbing ─────────────────────────────────────────────
//
// Both this banner and ConsentAwareAnalytics need to read the localStorage-
// backed consent value reactively (re-rendering when it changes) *without* a
// hydration mismatch: the server has no `localStorage`, so it can't know the
// real value, yet the client might already have one from a previous visit.
//
// A lazy `useState(() => getConsent() === ...)` initializer would run during
// the hydration render too and could disagree with the server's markup right
// there — a real mismatch, not a lint nitpick. `useSyncExternalStore` is the
// hook React built for exactly this: it renders `getServerSnapshot`'s value
// on the server *and* during hydration, then switches to the live
// `getSnapshot` immediately after — no mismatch warning, no extra effect, and
// (per the rule that sent us here) no setState inside a useEffect at all.
// https://react.dev/reference/react/useSyncExternalStore#subscribing-to-a-browser-api

// `respond` (below) writes to localStorage *and* dispatches this event in the
// same tick, so same-tab subscribers learn about the change immediately —
// `storage` only fires in *other* tabs.
export function subscribeToConsent(callback: () => void): () => void {
  window.addEventListener("cookie-consent", callback);
  return () => window.removeEventListener("cookie-consent", callback);
}

export function getConsentServerSnapshot(): ConsentValue | null {
  return null;
}

export default function CookieBanner({ locale }: { locale: string }) {
  // Single source of truth: visibility is *derived* from the stored consent
  // value — no local "visible" state that could ever fall out of sync with it.
  const consent = useSyncExternalStore(subscribeToConsent, getConsent, getConsentServerSnapshot);
  const visible = consent === null;
  const l = LABELS[locale] ?? LABELS.fr;
  const dir = locale === "ar" ? "rtl" : "ltr";

  function respond(value: ConsentValue) {
    localStorage.setItem(STORAGE_KEY, value);
    // Dispatching re-notifies useSyncExternalStore subscribers (this component
    // included), which re-read getConsent() and re-render with the new value —
    // `visible` flips to false and ConsentAwareAnalytics picks up "accepted",
    // both from this single write+event.
    window.dispatchEvent(new CustomEvent("cookie-consent", { detail: value }));
  }

  if (!visible) return null;

  return (
    <div
      dir={dir}
      role="dialog"
      aria-label="Cookie consent"
      className="fixed bottom-0 left-0 right-0 z-[9999] p-4"
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
