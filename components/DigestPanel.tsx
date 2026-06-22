"use client";

import { useState, useCallback } from "react";
import { FileText, Copy, Check, ChevronDown, ChevronUp, Loader2 } from "lucide-react";

const COPY: Record<string, {
  title: string; subtitle: string;
  generate: string; generating: string; copy: string; copied: string;
  planError: string; days: string;
}> = {
  fr: {
    title: "Digest sitrep", subtitle: "Résumé texte des foyers actifs — prêt à coller dans un rapport OMS/PAHO.",
    generate: "Générer", generating: "Génération…", copy: "Copier", copied: "Copié !",
    planError: "Requiert un plan Pro ou supérieur.", days: "Nouveaux sur",
  },
  en: {
    title: "Situation digest", subtitle: "Plain-text summary of active outbreaks — ready to paste into a WHO/PAHO sitrep.",
    generate: "Generate", generating: "Generating…", copy: "Copy", copied: "Copied!",
    planError: "Requires a Pro plan or higher.", days: "New in last",
  },
  es: {
    title: "Digest de situación", subtitle: "Resumen en texto plano de los brotes activos — listo para pegar en un sitrep.",
    generate: "Generar", generating: "Generando…", copy: "Copiar", copied: "¡Copiado!",
    planError: "Requiere un plan Pro o superior.", days: "Nuevos en",
  },
  ar: {
    title: "ملخص الوضع", subtitle: "ملخص نصي للتفشيات النشطة — جاهز للصق في تقرير منظمة الصحة العالمية.",
    generate: "توليد", generating: "جارٍ التوليد…", copy: "نسخ", copied: "تم النسخ!",
    planError: "يتطلب خطة Pro أو أعلى.", days: "جديدة في",
  },
  id: {
    title: "Digest situasi", subtitle: "Ringkasan teks wabah aktif — siap ditempel ke sitrep WHO/PAHO.",
    generate: "Hasilkan", generating: "Menghasilkan…", copy: "Salin", copied: "Disalin!",
    planError: "Memerlukan paket Pro atau lebih tinggi.", days: "Baru dalam",
  },
};

const DAY_OPTIONS = [3, 7, 14, 30];

export default function DigestPanel({ locale }: { locale: string }) {
  const c = COPY[locale] ?? COPY.en;
  const [open,      setOpen]      = useState(false);
  const [days,      setDays]      = useState(7);
  const [digest,    setDigest]    = useState<string | null>(null);
  const [loading,   setLoading]   = useState(false);
  const [planError, setPlanError] = useState(false);
  const [copied,    setCopied]    = useState(false);

  const generate = useCallback(async () => {
    setLoading(true); setPlanError(false);
    try {
      const res  = await fetch(`/api/digest?days=${days}`);
      if (res.status === 403) { setPlanError(true); return; }
      const data = await res.json() as { digest: string };
      setDigest(data.digest ?? null);
    } catch { /* ignore */ } finally { setLoading(false); }
  }, [days]);

  async function handleCopy() {
    if (!digest) return;
    await navigator.clipboard.writeText(digest);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900/40 overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-gray-800/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-gray-500" />
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

          {!planError && (
            <>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[11px] text-gray-600">{c.days}</span>
                {DAY_OPTIONS.map((d) => (
                  <button
                    key={d}
                    onClick={() => setDays(d)}
                    className={`text-[10px] px-2 py-0.5 rounded border transition-colors ${
                      days === d
                        ? "border-blue-700/60 bg-blue-900/30 text-blue-300"
                        : "border-gray-800 text-gray-600 hover:text-gray-300"
                    }`}
                  >
                    {d}d
                  </button>
                ))}
                <button
                  onClick={generate}
                  disabled={loading}
                  className="ml-1 flex items-center gap-1.5 text-xs px-3 py-1 rounded bg-gray-800 border border-gray-700 text-gray-300 hover:bg-gray-700 disabled:opacity-40 transition-colors"
                >
                  {loading
                    ? <><Loader2 className="w-3 h-3 animate-spin" />{c.generating}</>
                    : c.generate}
                </button>
                {digest && (
                  <button
                    onClick={handleCopy}
                    className="flex items-center gap-1 text-[10px] text-gray-500 hover:text-gray-300 transition-colors"
                  >
                    {copied
                      ? <><Check className="w-3 h-3 text-green-400" /><span className="text-green-400">{c.copied}</span></>
                      : <><Copy className="w-3 h-3" />{c.copy}</>}
                  </button>
                )}
              </div>

              {digest && (
                <pre className="text-[10px] font-mono text-gray-400 bg-gray-950/60 border border-gray-800 rounded-lg p-3 overflow-x-auto whitespace-pre leading-relaxed max-h-72 overflow-y-auto">
                  {digest}
                </pre>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
