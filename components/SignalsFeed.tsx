"use client";

import { useState, useEffect } from "react";
import { ExternalLink, ThumbsUp, ThumbsDown, Plus, X, AlertTriangle } from "lucide-react";

interface Signal {
  id: string;
  headline: string;
  source_url: string | null;
  source_name: string;
  disease_hint: string | null;
  country_hint: string | null;
  region: string | null;
  signal_date: string | null;
  confidence: number;
  votes_up: number;
  votes_down: number;
  created_at: string;
}

const COPY: Record<string, {
  title: string; disclaimer: string; empty: string; submit: string; cancel: string;
  headlinePlaceholder: string; diseasePlaceholder: string; countryPlaceholder: string;
  urlPlaceholder: string; send: string; sending: string; confidence: string;
  sourceLabel: string; voted: string; signalCount: (n: number) => string;
  escalate: string; escalated: string;
}> = {
  fr: { title: "Veille signaux", disclaimer: "Signaux de veille complémentaires — pré-confirmation, non vérifiés, non citables. Les sources automatiques (ReliefWeb) reflètent des publications institutionnelles et peuvent ne pas précéder les rapports OMS. Les soumissions terrain peuvent être plus précoces. Croiser systématiquement avec des sources officielles.", empty: "Aucun signal en cours.", submit: "Soumettre un signal", cancel: "Annuler", headlinePlaceholder: "Titre ou description du signal…", diseasePlaceholder: "Maladie suspectée", countryPlaceholder: "Pays", urlPlaceholder: "URL source (optionnel)", send: "Soumettre", sending: "Envoi…", confidence: "Confiance", sourceLabel: "Source", voted: "Voté", signalCount: (n) => `${n} signal${n > 1 ? "aux" : ""}`, escalate: "→ Investigation", escalated: "En investigation" },
  en: { title: "Signal watch", disclaimer: "Complementary surveillance signals — pre-confirmation, unverified, not citable. Automated sources (ReliefWeb) reflect institutional publications and may not precede WHO reporting. Field submissions may be earlier. Always cross-check with official sources.", empty: "No active signals.", submit: "Submit a signal", cancel: "Cancel", headlinePlaceholder: "Signal headline or description…", diseasePlaceholder: "Suspected disease", countryPlaceholder: "Country", urlPlaceholder: "Source URL (optional)", send: "Submit", sending: "Sending…", confidence: "Confidence", sourceLabel: "Source", voted: "Voted", signalCount: (n) => `${n} signal${n > 1 ? "s" : ""}`, escalate: "→ Investigate", escalated: "Under investigation" },
  es: { title: "Vigilancia de señales", disclaimer: "Señales de vigilancia complementarias — preconfirmación, no verificadas, no citables. Las fuentes automatizadas (ReliefWeb) reflejan publicaciones institucionales y pueden no preceder a los informes OMS. Verificar siempre con fuentes oficiales.", empty: "Sin señales activas.", submit: "Enviar una señal", cancel: "Cancelar", headlinePlaceholder: "Titular o descripción de la señal…", diseasePlaceholder: "Enfermedad sospechada", countryPlaceholder: "País", urlPlaceholder: "URL fuente (opcional)", send: "Enviar", sending: "Enviando…", confidence: "Confianza", sourceLabel: "Fuente", voted: "Votado", signalCount: (n) => `${n} señal${n > 1 ? "es" : ""}`, escalate: "→ Investigar", escalated: "En investigación" },
  ar: { title: "مراقبة الإشارات", disclaimer: "إشارات مراقبة تكميلية — ما قبل التأكيد، غير مؤكدة وغير قابلة للاستشهاد. قد لا تسبق المصادر الآلية (ReliefWeb) تقارير منظمة الصحة العالمية. التقديمات الميدانية قد تكون أسبق. راجع دائماً المصادر الرسمية.", empty: "لا توجد إشارات نشطة.", submit: "إرسال إشارة", cancel: "إلغاء", headlinePlaceholder: "عنوان أو وصف الإشارة…", diseasePlaceholder: "المرض المشتبه به", countryPlaceholder: "الدولة", urlPlaceholder: "رابط المصدر (اختياري)", send: "إرسال", sending: "جارٍ الإرسال…", confidence: "الثقة", sourceLabel: "المصدر", voted: "تم التصويت", signalCount: (n) => `${n} ${n === 1 ? "إشارة" : "إشارات"}`, escalate: "→ تحقيق", escalated: "قيد التحقيق" },
  id: { title: "Pantau sinyal", disclaimer: "Sinyal pengawasan pelengkap — pra-konfirmasi, belum diverifikasi, tidak dapat dikutip. Sumber otomatis (ReliefWeb) mencerminkan publikasi institusional dan mungkin tidak mendahului laporan WHO. Kiriman lapangan bisa lebih awal. Selalu periksa silang dengan sumber resmi.", empty: "Tidak ada sinyal aktif.", submit: "Kirim sinyal", cancel: "Batal", headlinePlaceholder: "Judul atau deskripsi sinyal…", diseasePlaceholder: "Penyakit yang dicurigai", countryPlaceholder: "Negara", urlPlaceholder: "URL sumber (opsional)", send: "Kirim", sending: "Mengirim…", confidence: "Kepercayaan", sourceLabel: "Sumber", voted: "Sudah divote", signalCount: (n) => `${n} sinyal`, escalate: "→ Investigasi", escalated: "Sedang diselidiki" },
};

const CONFIDENCE_LABELS: Record<string, (score: number) => string> = {
  fr: (s) => s >= 70 ? "Confirmation officielle multi-sources"
           : s >= 40 ? "Source institutionnelle secondaire (ReliefWeb / GDACS)"
           : "Soumission utilisateur — non vérifiée",
  en: (s) => s >= 70 ? "Official multi-source confirmation"
           : s >= 40 ? "Secondary institutional source (ReliefWeb / GDACS)"
           : "User submission — unverified",
  es: (s) => s >= 70 ? "Confirmación oficial multifuente"
           : s >= 40 ? "Fuente institucional secundaria (ReliefWeb / GDACS)"
           : "Envío de usuario — no verificado",
  ar: (s) => s >= 70 ? "تأكيد رسمي متعدد المصادر"
           : s >= 40 ? "مصدر مؤسسي ثانوي (ReliefWeb / GDACS)"
           : "تقديم مستخدم — غير مؤكد",
  id: (s) => s >= 70 ? "Konfirmasi resmi multi-sumber"
           : s >= 40 ? "Sumber institusional sekunder (ReliefWeb / GDACS)"
           : "Kiriman pengguna — belum diverifikasi",
};

function ConfidenceBadge({ score, locale }: { score: number; locale: string }) {
  const label = (CONFIDENCE_LABELS[locale] ?? CONFIDENCE_LABELS.en)(score);
  const cls = score >= 70 ? "bg-amber-900/30 border-amber-700/40 text-amber-300"
            : score >= 40 ? "bg-blue-900/30 border-blue-700/40 text-blue-300"
            :               "bg-gray-800 border-gray-700 text-gray-500";
  return (
    <span
      title={label}
      className={`inline-flex items-center text-[10px] font-bold px-1.5 py-0.5 rounded border cursor-help ${cls}`}
    >
      {score}%
    </span>
  );
}

interface Props { locale: string; }

export default function SignalsFeed({ locale }: Props) {
  const c = COPY[locale] ?? COPY.en;
  const isRtl = locale === "ar";

  const [signals,   setSignals]   = useState<Signal[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [showForm,  setShowForm]  = useState(false);
  const [voted,      setVoted]      = useState<Set<string>>(new Set());
  const [escalating, setEscalating] = useState<Set<string>>(new Set());
  const [escalated,  setEscalated]  = useState<Set<string>>(new Set());

  const [headline,    setHeadline]    = useState("");
  const [diseaseHint, setDiseaseHint] = useState("");
  const [countryHint, setCountryHint] = useState("");
  const [sourceUrl,   setSourceUrl]   = useState("");
  const [submitting,  setSubmitting]  = useState(false);

  useEffect(() => {
    fetch("/api/signals")
      .then((r) => r.json())
      .then((d) => { if (d.signals) setSignals(d.signals); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function handleVote(id: string, vote: "up" | "down") {
    if (voted.has(id)) return;
    setVoted((v) => new Set(v).add(id));
    setSignals((prev) => prev.map((s) =>
      s.id === id ? { ...s, [vote === "up" ? "votes_up" : "votes_down"]: (vote === "up" ? s.votes_up : s.votes_down) + 1 } : s
    ));
    await fetch("/api/signals", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, vote }),
    }).catch(() => {});
  }

  async function handleEscalate(s: Signal) {
    if (escalating.has(s.id) || escalated.has(s.id)) return;
    setEscalating((v) => new Set(v).add(s.id));
    try {
      const res = await fetch("/api/signals/escalate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ headline: s.headline, disease_hint: s.disease_hint, country_hint: s.country_hint, source_url: s.source_url }),
      });
      if (res.ok) setEscalated((v) => new Set(v).add(s.id));
    } catch { /* ignore */ } finally {
      setEscalating((prev) => { const n = new Set(prev); n.delete(s.id); return n; });
    }
  }

  async function handleSubmit() {
    if (!headline.trim() || submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/signals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ headline, disease_hint: diseaseHint || null, country_hint: countryHint || null, source_url: sourceUrl || null }),
      });
      const d = await res.json();
      if (d.ok) {
        setHeadline(""); setDiseaseHint(""); setCountryHint(""); setSourceUrl("");
        setShowForm(false);
        // Refresh
        fetch("/api/signals").then((r) => r.json()).then((d) => { if (d.signals) setSignals(d.signals); }).catch(() => {});
      }
    } catch { /* ignore */ } finally { setSubmitting(false); }
  }

  return (
    <div className="space-y-3" dir={isRtl ? "rtl" : undefined}>
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
          </span>
          <h3 className="text-sm font-semibold text-gray-300">{c.title}</h3>
          {signals.length > 0 && (
            <span className="text-xs text-gray-600">({c.signalCount(signals.length)})</span>
          )}
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-300 transition-colors"
        >
          {showForm ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
          {showForm ? c.cancel : c.submit}
        </button>
      </div>

      {/* Disclaimer */}
      <div className="flex items-start gap-2 bg-amber-950/30 border border-amber-800/30 rounded-lg px-3 py-2">
        <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
        <p className="text-[11px] text-amber-400/80">{c.disclaimer}</p>
      </div>

      {/* Submit form */}
      {showForm && (
        <div className="bg-gray-900 border border-gray-700 rounded-xl p-4 space-y-2">
          <input
            value={headline}
            onChange={(e) => setHeadline(e.target.value)}
            placeholder={c.headlinePlaceholder}
            maxLength={300}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-gray-500 transition-colors"
          />
          <div className="flex gap-2">
            <input
              value={diseaseHint}
              onChange={(e) => setDiseaseHint(e.target.value)}
              placeholder={c.diseasePlaceholder}
              maxLength={100}
              className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-gray-500 transition-colors"
            />
            <input
              value={countryHint}
              onChange={(e) => setCountryHint(e.target.value)}
              placeholder={c.countryPlaceholder}
              maxLength={100}
              className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-gray-500 transition-colors"
            />
          </div>
          <div className="flex gap-2">
            <input
              value={sourceUrl}
              onChange={(e) => setSourceUrl(e.target.value)}
              placeholder={c.urlPlaceholder}
              type="url"
              maxLength={1000}
              className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-gray-500 transition-colors"
            />
            <button
              onClick={handleSubmit}
              disabled={!headline.trim() || submitting}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-40 text-white text-xs font-semibold rounded-lg transition-colors shrink-0"
            >
              {submitting ? c.sending : c.send}
            </button>
          </div>
        </div>
      )}

      {/* Signals list */}
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-gray-800/40 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : signals.length === 0 ? (
        <p className="text-xs text-gray-600 italic text-center py-6">{c.empty}</p>
      ) : (
        <div className="space-y-2">
          {signals.map((s) => (
            <div key={s.id} className="bg-gray-900/60 border border-gray-800 rounded-xl px-4 py-3 space-y-1.5">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1 flex-1 min-w-0">
                  <p className="text-sm text-gray-200 leading-snug">{s.headline}</p>
                  <div className="flex items-center gap-2 flex-wrap">
                    {s.disease_hint && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-900/30 border border-red-800/40 text-red-400">{s.disease_hint}</span>
                    )}
                    {s.country_hint && (
                      <span className="text-[10px] text-gray-500">{s.country_hint}</span>
                    )}
                    {s.signal_date && (
                      <span className="text-[10px] text-gray-600">{s.signal_date}</span>
                    )}
                    <span className="text-[10px] text-gray-600">{c.sourceLabel}: {s.source_name}</span>
                    <ConfidenceBadge score={s.confidence} locale={locale} />
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {s.source_url && (
                    <a href={s.source_url} target="_blank" rel="noopener noreferrer"
                      className="p-1.5 rounded hover:bg-gray-700 text-gray-500 hover:text-gray-300 transition-colors">
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                  <button
                    onClick={() => handleVote(s.id, "up")}
                    disabled={voted.has(s.id)}
                    title={voted.has(s.id) ? c.voted : undefined}
                    className={`flex items-center gap-0.5 p-1.5 rounded text-xs transition-colors ${voted.has(s.id) ? "text-green-500 cursor-default" : "text-gray-500 hover:text-green-400 hover:bg-gray-700"}`}
                  >
                    <ThumbsUp className="w-3 h-3" />
                    <span>{s.votes_up}</span>
                  </button>
                  <button
                    onClick={() => handleVote(s.id, "down")}
                    disabled={voted.has(s.id)}
                    className={`flex items-center gap-0.5 p-1.5 rounded text-xs transition-colors ${voted.has(s.id) ? "text-red-500 cursor-default" : "text-gray-500 hover:text-red-400 hover:bg-gray-700"}`}
                  >
                    <ThumbsDown className="w-3 h-3" />
                    <span>{s.votes_down}</span>
                  </button>
                  <button
                    onClick={() => handleEscalate(s)}
                    disabled={escalating.has(s.id) || escalated.has(s.id)}
                    title={c.escalate}
                    className={`px-1.5 py-1 rounded text-[10px] font-medium transition-colors ${
                      escalated.has(s.id)
                        ? "text-purple-400 cursor-default"
                        : escalating.has(s.id)
                        ? "text-gray-500 cursor-wait"
                        : "text-gray-500 hover:text-purple-400 hover:bg-gray-700"
                    }`}
                  >
                    {escalated.has(s.id) ? c.escalated : c.escalate}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
