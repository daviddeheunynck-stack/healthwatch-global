"use client";

import { useState } from "react";
import { Plane, AlertTriangle, CheckCircle, ShieldAlert, ShieldOff } from "lucide-react";

type Risk = "none" | "low" | "medium" | "high" | "critical";

interface TravelResult {
  country_en: string;
  risk: Risk;
  outbreaks: { id: string; disease_en: string | null; cases: number; risk_level: string; is_pheic: boolean }[];
  recommendation: string;
  checked_at: string;
}

const COPY: Record<string, {
  title: string; placeholder: string; check: string; checking: string;
  noOutbreaks: string; outbreaks: string; asOf: string; networkError: string;
}> = {
  fr: { title: "Risque voyage", placeholder: "Pays (ex: India)", check: "Évaluer", checking: "Analyse…", noOutbreaks: "Aucun foyer actif", outbreaks: "foyer(s) actif(s)", asOf: "au", networkError: "Erreur réseau" },
  en: { title: "Travel risk", placeholder: "Country (e.g. India)", check: "Check", checking: "Checking…", noOutbreaks: "No active outbreaks", outbreaks: "active outbreak(s)", asOf: "as of", networkError: "Network error" },
  es: { title: "Riesgo de viaje", placeholder: "País (ej: India)", check: "Evaluar", checking: "Evaluando…", noOutbreaks: "Sin brotes activos", outbreaks: "brote(s) activo(s)", asOf: "al", networkError: "Error de red" },
  ar: { title: "مخاطر السفر", placeholder: "الدولة (مثال: India)", check: "تحقق", checking: "جارٍ التحليل…", noOutbreaks: "لا تفشيات نشطة", outbreaks: "تفشٍّ نشط", asOf: "بتاريخ", networkError: "خطأ في الشبكة" },
  id: { title: "Risiko perjalanan", placeholder: "Negara (mis: India)", check: "Periksa", checking: "Memeriksa…", noOutbreaks: "Tidak ada wabah aktif", outbreaks: "wabah aktif", asOf: "per", networkError: "Kesalahan jaringan" },
};

const LOCALE_TAG: Record<string, string> = { fr: "fr-FR", es: "es-ES", ar: "ar-SA", id: "id-ID", en: "en-GB" };

const RISK_STYLE: Record<Risk, { border: string; text: string; icon: typeof CheckCircle; label: Record<string, string> }> = {
  none:     { border: "border-green-700/30",  text: "text-green-400",  icon: CheckCircle, label: { en: "No risk", fr: "Aucun risque", es: "Sin riesgo", ar: "بلا خطر", id: "Tidak berisiko" } },
  low:      { border: "border-green-700/40",  text: "text-green-300",  icon: CheckCircle, label: { en: "Low",      fr: "Faible",        es: "Bajo",       ar: "منخفض",   id: "Rendah"  } },
  medium:   { border: "border-amber-700/40",  text: "text-amber-400",  icon: ShieldAlert, label: { en: "Medium",   fr: "Modéré",        es: "Moderado",   ar: "متوسط",   id: "Sedang"  } },
  high:     { border: "border-red-700/40",    text: "text-red-400",    icon: AlertTriangle, label: { en: "High",  fr: "Élevé",         es: "Alto",        ar: "مرتفع",   id: "Tinggi"  } },
  critical: { border: "border-red-500/60",    text: "text-red-300",    icon: ShieldOff,   label: { en: "Critical", fr: "Critique",     es: "Crítico",     ar: "حرج",     id: "Kritis"  } },
};

export default function TravelRiskWidget({ locale }: { locale: string }) {
  const c = COPY[locale] ?? COPY.en;
  const [query,    setQuery]    = useState("");
  const [loading,  setLoading]  = useState(false);
  const [result,   setResult]   = useState<TravelResult | null>(null);
  const [error,    setError]    = useState("");

  async function check() {
    const country = query.trim();
    if (!country) return;
    setLoading(true);
    setResult(null);
    setError("");
    try {
      const res  = await fetch(`/api/travel-risk?country_en=${encodeURIComponent(country)}&locale=${locale}`);
      const data = await res.json() as TravelResult & { error?: string };
      if (data.error) { setError(data.error); return; }
      setResult(data);
    } catch { setError(c.networkError); } finally { setLoading(false); }
  }

  const rs = result ? RISK_STYLE[result.risk] : null;
  const Icon = rs?.icon;

  return (
    <div className="rounded-xl border border-gray-700/50 bg-gray-900/60 p-4">
      <div className="flex items-center gap-2 mb-3">
        <Plane className="w-4 h-4 text-gray-500" />
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{c.title}</p>
      </div>

      <div className="flex gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && check()}
          placeholder={c.placeholder}
          className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-blue-500"
        />
        <button
          onClick={check}
          disabled={loading || !query.trim()}
          className="text-xs px-3 py-1.5 bg-blue-700/50 hover:bg-blue-700/70 disabled:opacity-40 border border-blue-700/40 text-blue-300 rounded-lg transition-colors whitespace-nowrap"
        >
          {loading ? c.checking : c.check}
        </button>
      </div>

      {error && <p className="text-xs text-red-400 mt-2">{error}</p>}

      {result && rs && Icon && (
        <div className={`mt-3 rounded-lg border ${rs.border} p-3 space-y-2`}>
          <div className="flex items-center gap-2">
            <Icon className={`w-4 h-4 ${rs.text} shrink-0`} />
            <span className={`text-sm font-bold ${rs.text}`}>
              {rs.label[locale] ?? rs.label.en}
            </span>
            <span className="text-xs text-gray-500">— {result.country_en}</span>
          </div>

          <p className="text-xs text-gray-400 leading-relaxed">{result.recommendation}</p>

          {result.outbreaks.length > 0 && (
            <div className="space-y-1 pt-1 border-t border-gray-700/40">
              {result.outbreaks.map((o) => (
                <div key={o.id} className="flex items-center justify-between text-[11px]">
                  <span className="text-gray-400">{o.disease_en ?? "Unknown"}{o.is_pheic ? " 🚨" : ""}</span>
                  <div className="flex items-center gap-1.5">
                    <span className="tabular-nums text-gray-500">{o.cases.toLocaleString(locale === "ar" ? "ar-SA" : locale)}</span>
                    <span className={`px-1 rounded text-[9px] font-bold ${o.risk_level === "high" ? "bg-red-900/40 text-red-400" : o.risk_level === "medium" ? "bg-amber-900/40 text-amber-400" : "bg-green-900/40 text-green-400"}`}>
                      {(RISK_STYLE[o.risk_level as Risk]?.label[locale] ?? o.risk_level).toUpperCase()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          <p className="text-[10px] text-gray-600">{c.asOf} {new Date(result.checked_at).toLocaleString(LOCALE_TAG[locale] ?? "en-GB", { dateStyle: "short", timeStyle: "short" })}</p>
        </div>
      )}
    </div>
  );
}
