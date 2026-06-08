"use client";

import { useEffect, useState } from "react";
import { BellRing, Loader2, X } from "lucide-react";

// ─── Copy ─────────────────────────────────────────────────────────────────────
//
// Marketing framing (not the neutral "manage your settings" tone of the
// account-page card): lead with the benefit ("alerted in real time, for
// free"), name the moment it pays off ("even when HealthWatch is closed"),
// and keep the ask to one click. This is the funnel's top — the account
// page's PushNotificationToggle is where the relationship continues
// (status, test, disable).

const COPY: Record<string, {
  title: string;
  desc: string;
  cta: string;
  enabling: string;
}> = {
  fr: {
    title: "Soyez alerté en temps réel — gratuitement",
    desc: "Activez les notifications pour être prévenu dès qu'un nouveau foyer est détecté dans le monde, même quand HealthWatch est fermé.",
    cta: "Activer les notifications",
    enabling: "Activation…",
  },
  en: {
    title: "Get real-time alerts — for free",
    desc: "Turn on notifications to be alerted the instant a new outbreak is detected anywhere in the world, even when HealthWatch is closed.",
    cta: "Enable notifications",
    enabling: "Enabling…",
  },
  es: {
    title: "Reciba alertas en tiempo real — gratis",
    desc: "Active las notificaciones para que le avisemos en cuanto se detecte un nuevo brote en cualquier parte del mundo, incluso con HealthWatch cerrado.",
    cta: "Activar notificaciones",
    enabling: "Activando…",
  },
  ar: {
    title: "احصل على تنبيهات فورية — مجاناً",
    desc: "فعّل الإشعارات لتُعلَم فور رصد أي تفشٍّ جديد في العالم، حتى عندما يكون HealthWatch مغلقاً.",
    cta: "تفعيل الإشعارات",
    enabling: "جارٍ التفعيل…",
  },
  id: {
    title: "Dapatkan peringatan real-time — gratis",
    desc: "Aktifkan notifikasi agar Anda diberi tahu begitu wabah baru terdeteksi di mana pun di dunia, bahkan saat HealthWatch tertutup.",
    cta: "Aktifkan notifikasi",
    enabling: "Mengaktifkan…",
  },
};

const STORAGE_KEY = "hwg_push_nudge_dismissed";

// Duplicated from PushNotificationToggle rather than shared — small, pure,
// and this keeps both components self-contained (same call this codebase
// already made for DiseaseAlertPicker's copy/chrome). See that component
// for the full rationale on the BufferSource cast below.
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const arr = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) arr[i] = rawData.charCodeAt(i);
  return arr;
}

interface Props {
  locale: string;
}

// ─── Component ────────────────────────────────────────────────────────────────
//
// Self-hiding dashboard nudge (same shape as CookieBanner: render nothing
// until a client-side check decides to show it). Stays invisible whenever
// it has nothing useful to offer —
//
//   • Push unsupported, or the user already said "no" at the OS/browser level
//   • Already subscribed (the account-page card is now their control surface)
//   • Explicitly dismissed before (remembered in localStorage — a "no" here
//     should stay "no", the same courtesy CookieBanner extends)
//
// — so the only people who ever see it are exactly the ones for whom
// one click turns into "wow, it actually pinged me." That's the whole
// marketing thesis: the live demo converts better than the pitch.
//
// The CTA subscribes inline (register → permission → subscribe → persist)
// rather than linking to /account — every extra navigation is a chance to
// lose the moment. Failures fail soft: this is a nudge, not the product's
// settings surface, so on error we simply stay put and let them try again
// (or visit /account, where PushNotificationToggle gives full status +
// retry + error feedback).
export default function PushNotificationBanner({ locale }: Props) {
  const c = COPY[locale] ?? COPY.en;

  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function check() {
      if (
        typeof window === "undefined" ||
        !("serviceWorker" in navigator) ||
        !("PushManager" in window) ||
        typeof Notification === "undefined"
      ) {
        return; // unsupported — nothing to offer
      }
      if (Notification.permission === "denied") return; // already said no
      if (localStorage.getItem(STORAGE_KEY)) return;     // dismissed before

      try {
        const reg = await navigator.serviceWorker.getRegistration();
        const sub = reg ? await reg.pushManager.getSubscription() : null;
        if (!cancelled && !sub) setVisible(true);
      } catch {
        if (!cancelled) setVisible(true);
      }
    }

    check();
    return () => { cancelled = true; };
  }, []);

  function dismiss() {
    localStorage.setItem(STORAGE_KEY, "1");
    setVisible(false);
  }

  async function enable() {
    if (busy) return;
    setBusy(true);
    try {
      const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!key) return;

      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;

      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        // Not a hard "no" (could be a dismissed prompt, not an explicit
        // block — that case is already filtered out on mount). Hide for
        // this visit without burning the localStorage flag, so a later
        // session gets another natural chance.
        setVisible(false);
        return;
      }

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(key) as BufferSource,
      });

      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...sub.toJSON(), locale }),
      });
      if (!res.ok) throw new Error("subscribe-failed");

      // Success — the account-page card is now the source of truth for
      // this device; remember so the nudge never resurfaces for it.
      localStorage.setItem(STORAGE_KEY, "1");
      setVisible(false);
    } catch {
      // Fail soft and silent: stay visible, let them try again with one
      // more click, or fall back to /account for full error feedback.
    } finally {
      setBusy(false);
    }
  }

  if (!visible) return null;

  return (
    <div className="rounded-xl border border-blue-700/40 bg-gradient-to-r from-blue-950/60 via-blue-900/20 to-transparent p-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5 bg-white/5 border border-white/10">
            <BellRing className="w-4 h-4 text-blue-400" />
          </div>
          <div>
            <p className="text-sm font-bold text-blue-400">{c.title}</p>
            <p className="text-xs text-gray-400 mt-0.5">{c.desc}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={enable}
            disabled={busy}
            className="flex items-center gap-2 bg-red-600 hover:bg-red-500 disabled:opacity-40 text-white font-semibold px-4 py-2 rounded-lg text-sm transition-colors whitespace-nowrap"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <BellRing className="w-4 h-4" />}
            {busy ? c.enabling : c.cta}
          </button>
          <button
            onClick={dismiss}
            aria-label="Dismiss"
            className="text-gray-500 hover:text-gray-300 transition-colors p-2 shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
