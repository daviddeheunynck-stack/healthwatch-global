"use client";

import { useEffect, useState } from "react";
import { Bell, BellRing, BellOff, Loader2, CheckCircle, Send } from "lucide-react";

// ─── Copy ─────────────────────────────────────────────────────────────────────

const COPY: Record<string, {
  title: string; desc: string;
  enable: string; enabling: string;
  disable: string; disabling: string;
  active: string;
  sendTest: string; sending: string; testSent: string; testFailed: string;
  unsupported: string; denied: string; error: string;
}> = {
  fr: {
    title: "Notifications push",
    desc: "Recevez une alerte instantanée sur cet appareil dès qu'un nouveau foyer est détecté — même quand HealthWatch est fermé.",
    enable: "Activer les notifications",
    enabling: "Activation…",
    disable: "Désactiver",
    disabling: "Désactivation…",
    active: "Notifications activées sur cet appareil",
    sendTest: "Envoyer un test",
    sending: "Envoi…",
    testSent: "Notification de test envoyée — vérifiez votre appareil.",
    testFailed: "Échec de l'envoi du test.",
    unsupported: "Votre navigateur ne prend pas en charge les notifications push.",
    denied: "Notifications bloquées. Autorisez-les pour ce site dans les réglages de votre navigateur, puis rechargez la page.",
    error: "Une erreur est survenue. Réessayez.",
  },
  en: {
    title: "Push notifications",
    desc: "Get an instant alert on this device the moment a new outbreak is detected — even when HealthWatch is closed.",
    enable: "Enable notifications",
    enabling: "Enabling…",
    disable: "Disable",
    disabling: "Disabling…",
    active: "Notifications enabled on this device",
    sendTest: "Send a test",
    sending: "Sending…",
    testSent: "Test notification sent — check your device.",
    testFailed: "Could not send the test notification.",
    unsupported: "Your browser does not support push notifications.",
    denied: "Notifications are blocked. Allow them for this site in your browser settings, then reload the page.",
    error: "Something went wrong. Please try again.",
  },
  es: {
    title: "Notificaciones push",
    desc: "Reciba una alerta instantánea en este dispositivo en cuanto se detecte un nuevo brote — incluso con HealthWatch cerrado.",
    enable: "Activar notificaciones",
    enabling: "Activando…",
    disable: "Desactivar",
    disabling: "Desactivando…",
    active: "Notificaciones activadas en este dispositivo",
    sendTest: "Enviar una prueba",
    sending: "Enviando…",
    testSent: "Notificación de prueba enviada — revise su dispositivo.",
    testFailed: "No se pudo enviar la notificación de prueba.",
    unsupported: "Su navegador no admite notificaciones push.",
    denied: "Las notificaciones están bloqueadas. Permítalas para este sitio en la configuración de su navegador y recargue la página.",
    error: "Ocurrió un error. Inténtelo de nuevo.",
  },
  ar: {
    title: "إشعارات Push",
    desc: "احصل على تنبيه فوري على هذا الجهاز فور رصد تفشٍّ جديد — حتى عندما يكون HealthWatch مغلقاً.",
    enable: "تفعيل الإشعارات",
    enabling: "جارٍ التفعيل…",
    disable: "إلغاء التفعيل",
    disabling: "جارٍ الإلغاء…",
    active: "الإشعارات مفعّلة على هذا الجهاز",
    sendTest: "إرسال تجربة",
    sending: "جارٍ الإرسال…",
    testSent: "تم إرسال إشعار تجريبي — تحقق من جهازك.",
    testFailed: "تعذّر إرسال الإشعار التجريبي.",
    unsupported: "متصفحك لا يدعم إشعارات Push.",
    denied: "الإشعارات محظورة. اسمح بها لهذا الموقع من إعدادات المتصفح ثم أعد تحميل الصفحة.",
    error: "حدث خطأ. يرجى المحاولة مجدداً.",
  },
  id: {
    title: "Notifikasi push",
    desc: "Dapatkan peringatan instan di perangkat ini begitu wabah baru terdeteksi — bahkan saat HealthWatch tertutup.",
    enable: "Aktifkan notifikasi",
    enabling: "Mengaktifkan…",
    disable: "Nonaktifkan",
    disabling: "Menonaktifkan…",
    active: "Notifikasi aktif di perangkat ini",
    sendTest: "Kirim tes",
    sending: "Mengirim…",
    testSent: "Notifikasi tes terkirim — periksa perangkat Anda.",
    testFailed: "Gagal mengirim notifikasi tes.",
    unsupported: "Browser Anda tidak mendukung notifikasi push.",
    denied: "Notifikasi diblokir. Izinkan untuk situs ini di pengaturan browser, lalu muat ulang halaman.",
    error: "Terjadi kesalahan. Silakan coba lagi.",
  },
};

interface Props {
  locale: string;
}

type Status = "checking" | "unsupported" | "default" | "denied" | "subscribed";
type TestState = "idle" | "sending" | "sent" | "failed";

// Converts the URL-safe base64 VAPID public key (as exposed via
// NEXT_PUBLIC_VAPID_PUBLIC_KEY) into the Uint8Array shape PushManager.subscribe
// requires for `applicationServerKey`. Standard Web Push boilerplate — the
// browser API only accepts raw bytes, never the base64 string form.
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const arr = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) arr[i] = rawData.charCodeAt(i);
  return arr;
}

// ─── Component ────────────────────────────────────────────────────────────────
//
// Self-contained opt-in card for the account page (mirrors DiseaseAlertPicker:
// takes only `locale`, owns its own copy + card chrome). Lifecycle:
//
//   checking → unsupported          (no Push API in this browser)
//            → denied               (user already blocked notifications)
//            → default → subscribed (happy path: register SW, ask permission,
//                                     subscribe, persist to /api/push/subscribe)
//            → subscribed → default (unsubscribe: remove from browser + server)
//
// "Send a test" closes the loop in-product — see the rationale comment on
// app/api/push/test/route.ts for why that endpoint exists.
export default function PushNotificationToggle({ locale }: Props) {
  const c = COPY[locale] ?? COPY.en;

  const [status, setStatus] = useState<Status>("checking");
  const [busy,   setBusy]   = useState(false);
  const [test,   setTest]   = useState<TestState>("idle");
  const [error,  setError]  = useState<string | null>(null);

  // On mount: detect support and sync the UI with whatever the browser already
  // knows. Deliberately read-only (getRegistration, not register) — a visitor
  // who's never opted in shouldn't get a service worker installed just for
  // viewing this card.
  useEffect(() => {
    let cancelled = false;

    async function check() {
      if (typeof window === "undefined" || !("serviceWorker" in navigator) || !("PushManager" in window) || typeof Notification === "undefined") {
        if (!cancelled) setStatus("unsupported");
        return;
      }
      if (Notification.permission === "denied") {
        if (!cancelled) setStatus("denied");
        return;
      }
      try {
        const reg = await navigator.serviceWorker.getRegistration();
        const sub = reg ? await reg.pushManager.getSubscription() : null;
        if (!cancelled) setStatus(sub ? "subscribed" : "default");
      } catch {
        if (!cancelled) setStatus("default");
      }
    }

    check();
    return () => { cancelled = true; };
  }, []);

  const subscribe = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!key) throw new Error("missing-vapid-key");

      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;

      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus(permission === "denied" ? "denied" : "default");
        return;
      }

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        // Cast: with @types/node loaded, `Uint8Array` resolves to
        // Uint8Array<ArrayBufferLike> (Node's Buffer-compatible default),
        // while the DOM lib's BufferSource wants ArrayBufferView<ArrayBuffer>.
        // The runtime value is a plain browser Uint8Array either way — this
        // is a lib-typing mismatch, not a real incompatibility.
        applicationServerKey: urlBase64ToUint8Array(key) as BufferSource,
      });

      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...sub.toJSON(), locale }),
      });
      if (!res.ok) throw new Error("subscribe-failed");

      setStatus("subscribed");
    } catch {
      setError(c.error);
    } finally {
      setBusy(false);
    }
  };

  const unsubscribe = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();

      if (sub) {
        await fetch("/api/push/unsubscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }

      setStatus("default");
      setTest("idle");
    } catch {
      setError(c.error);
    } finally {
      setBusy(false);
    }
  };

  const sendTest = async () => {
    if (test === "sending" || busy) return;
    setTest("sending");
    try {
      const res = await fetch("/api/push/test", { method: "POST" });
      setTest(res.ok ? "sent" : "failed");
    } catch {
      setTest("failed");
    } finally {
      setTimeout(() => setTest("idle"), 5000);
    }
  };

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-4">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center shrink-0 mt-0.5">
          <BellRing className="w-4 h-4 text-red-400" />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide">{c.title}</h2>
          <p className="text-sm text-gray-500 mt-1">{c.desc}</p>
        </div>
      </div>

      {status === "checking" && (
        <Loader2 className="w-4 h-4 animate-spin text-gray-600" />
      )}

      {status === "unsupported" && (
        <p className="flex items-start gap-2 text-sm text-gray-500">
          <BellOff className="w-4 h-4 shrink-0 mt-0.5" />
          {c.unsupported}
        </p>
      )}

      {status === "denied" && (
        <p className="flex items-start gap-2 text-sm text-amber-400">
          <BellOff className="w-4 h-4 shrink-0 mt-0.5" />
          {c.denied}
        </p>
      )}

      {status === "default" && (
        <button
          onClick={subscribe}
          disabled={busy}
          className="flex items-center gap-2 bg-red-600 hover:bg-red-500 disabled:opacity-40 text-white font-semibold px-4 py-2 rounded-lg text-sm transition-colors"
        >
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bell className="w-4 h-4" />}
          {busy ? c.enabling : c.enable}
        </button>
      )}

      {status === "subscribed" && (
        <div className="space-y-3">
          <div className="flex items-center gap-3 p-4 rounded-xl border border-green-500/30 bg-green-500/10">
            <CheckCircle className="w-5 h-5 text-green-400 shrink-0" />
            <p className="text-sm font-semibold text-green-300 flex-1">{c.active}</p>
            <button
              onClick={unsubscribe}
              disabled={busy}
              className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-red-400 transition-colors disabled:opacity-50 shrink-0"
            >
              {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <BellOff className="w-3.5 h-3.5" />}
              {busy ? c.disabling : c.disable}
            </button>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={sendTest}
              disabled={test === "sending" || busy}
              className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 disabled:opacity-40 text-gray-300 font-semibold px-4 py-2 rounded-lg text-sm transition-colors"
            >
              {test === "sending" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              {test === "sending" ? c.sending : c.sendTest}
            </button>
            {test === "sent"   && <p className="text-xs text-green-400">{c.testSent}</p>}
            {test === "failed" && <p className="text-xs text-red-400">{c.testFailed}</p>}
          </div>
        </div>
      )}

      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}
