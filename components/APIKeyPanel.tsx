"use client";

import { useState, useEffect, useCallback } from "react";
import { Key, Eye, EyeOff, Copy, Check, RefreshCw, ChevronDown, ChevronUp, Loader2 } from "lucide-react";

const COPY: Record<string, {
  title: string; subtitle: string;
  reveal: string; hide: string; copy: string; copied: string;
  rotate: string; rotating: string; confirmRotate: string;
  noKey: string; planError: string; usage: string;
}> = {
  fr: {
    title: "Clé API personnelle", subtitle: "Utilisez cette clé pour accéder à /api/rss sans session active.",
    reveal: "Afficher", hide: "Masquer", copy: "Copier", copied: "Copié !",
    rotate: "Régénérer", rotating: "Régénération…", confirmRotate: "Régénérer invalidera l'ancienne clé. Continuer ?",
    noKey: "Aucune clé générée.", planError: "Requiert un plan Pro ou supérieur.",
    usage: "Utilisation : /api/rss?api_key=<votre-clé>",
  },
  en: {
    title: "Personal API key", subtitle: "Use this key to access /api/rss without an active browser session.",
    reveal: "Reveal", hide: "Hide", copy: "Copy", copied: "Copied!",
    rotate: "Rotate", rotating: "Rotating…", confirmRotate: "Rotating will invalidate the current key. Continue?",
    noKey: "No key generated yet.", planError: "Requires a Pro plan or higher.",
    usage: "Usage: /api/rss?api_key=<your-key>",
  },
  es: {
    title: "Clave API personal", subtitle: "Use esta clave para acceder a /api/rss sin sesión activa.",
    reveal: "Mostrar", hide: "Ocultar", copy: "Copiar", copied: "¡Copiado!",
    rotate: "Rotar", rotating: "Rotando…", confirmRotate: "Rotar invalidará la clave actual. ¿Continuar?",
    noKey: "Ninguna clave generada.", planError: "Requiere un plan Pro o superior.",
    usage: "Uso: /api/rss?api_key=<tu-clave>",
  },
  ar: {
    title: "مفتاح API الشخصي", subtitle: "استخدم هذا المفتاح للوصول إلى /api/rss بدون جلسة نشطة.",
    reveal: "كشف", hide: "إخفاء", copy: "نسخ", copied: "تم النسخ!",
    rotate: "تجديد", rotating: "جارٍ التجديد…", confirmRotate: "التجديد سيُبطل المفتاح الحالي. هل تريد المتابعة؟",
    noKey: "لم يتم إنشاء مفتاح.", planError: "يتطلب خطة Pro أو أعلى.",
    usage: "الاستخدام: /api/rss?api_key=<مفتاحك>",
  },
  id: {
    title: "Kunci API personal", subtitle: "Gunakan kunci ini untuk mengakses /api/rss tanpa sesi browser aktif.",
    reveal: "Tampilkan", hide: "Sembunyikan", copy: "Salin", copied: "Disalin!",
    rotate: "Rotasi", rotating: "Merotasi…", confirmRotate: "Rotasi akan membatalkan kunci saat ini. Lanjutkan?",
    noKey: "Belum ada kunci yang dibuat.", planError: "Memerlukan paket Pro atau lebih tinggi.",
    usage: "Penggunaan: /api/rss?api_key=<kunci-anda>",
  },
};

export default function APIKeyPanel({ locale }: { locale: string }) {
  const c = COPY[locale] ?? COPY.en;
  const [open,      setOpen]      = useState(false);
  const [apiKey,    setApiKey]    = useState<string | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [planError, setPlanError] = useState(false);
  const [revealed,  setRevealed]  = useState(false);
  const [copied,    setCopied]    = useState(false);
  const [rotating,  setRotating]  = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/user/api-key");
      if (res.status === 403) { setPlanError(true); return; }
      const data = await res.json() as { api_key: string | null };
      setApiKey(data.api_key);
    } catch { /* ignore */ } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleCopy() {
    if (!apiKey) return;
    await navigator.clipboard.writeText(apiKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleRotate() {
    if (!window.confirm(c.confirmRotate)) return;
    setRotating(true);
    try {
      const res  = await fetch("/api/user/api-key", { method: "POST" });
      const data = await res.json() as { api_key: string | null };
      setApiKey(data.api_key);
      setRevealed(true);
    } finally { setRotating(false); }
  }

  const masked = apiKey ? `${apiKey.slice(0, 8)}${"•".repeat(20)}${apiKey.slice(-4)}` : "";

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900/40 overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-gray-800/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Key className="w-4 h-4 text-gray-500" />
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{c.title}</span>
        </div>
        {open
          ? <ChevronUp className="w-3.5 h-3.5 text-gray-600 shrink-0" />
          : <ChevronDown className="w-3.5 h-3.5 text-gray-600 shrink-0" />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          <p className="text-[11px] text-gray-600">{c.subtitle}</p>

          {planError && (
            <p className="text-[11px] text-amber-500 bg-amber-900/10 border border-amber-700/30 rounded px-3 py-2">
              {c.planError}
            </p>
          )}

          {!planError && loading && (
            <div className="flex items-center gap-2 py-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-gray-600" />
            </div>
          )}

          {!planError && !loading && (
            <>
              {!apiKey ? (
                <p className="text-[11px] text-gray-600 italic">{c.noKey}</p>
              ) : (
                <div className="flex items-center gap-2 flex-wrap">
                  <code className="text-[11px] font-mono text-gray-300 bg-gray-950/60 border border-gray-800 rounded px-2 py-1 select-all">
                    {revealed ? apiKey : masked}
                  </code>
                  <button
                    onClick={() => setRevealed((v) => !v)}
                    className="text-gray-600 hover:text-gray-300 transition-colors"
                    title={revealed ? c.hide : c.reveal}
                  >
                    {revealed ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                  <button
                    onClick={handleCopy}
                    className="flex items-center gap-1 text-[10px] text-gray-500 hover:text-gray-300 transition-colors"
                  >
                    {copied
                      ? <><Check className="w-3 h-3 text-green-400" /><span className="text-green-400">{c.copied}</span></>
                      : <><Copy className="w-3 h-3" />{c.copy}</>}
                  </button>
                </div>
              )}

              <div className="flex items-center gap-3">
                <button
                  onClick={handleRotate}
                  disabled={rotating}
                  className="flex items-center gap-1.5 text-[11px] text-gray-500 hover:text-amber-400 disabled:opacity-40 transition-colors"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${rotating ? "animate-spin" : ""}`} />
                  {rotating ? c.rotating : c.rotate}
                </button>
              </div>

              <p className="text-[10px] text-gray-700 font-mono">{c.usage}</p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
