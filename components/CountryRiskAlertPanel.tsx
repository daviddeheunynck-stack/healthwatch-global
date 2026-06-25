"use client";

import { useState, useEffect, useCallback } from "react";
import { Bell, Plus, Trash2, ChevronDown, ChevronUp, Loader2 } from "lucide-react";

interface Alert {
  id: string;
  country_en: string;
  min_risk: string;
  email: string;
  last_fired_at: string | null;
  created_at: string;
}

const COPY: Record<string, {
  title: string; subtitle: string;
  countryLabel: string; countryPlaceholder: string;
  riskLabel: string; emailLabel: string; emailPlaceholder: string;
  high: string; medium: string; low: string;
  add: string; cancel: string; create: string; creating: string;
  noAlerts: string; lastFired: string; neverFired: string;
  planError: string;
}> = {
  fr: {
    title: "Alertes escalade pays",
    subtitle: "Recevez un email quand un foyer actif atteint le niveau de risque configuré.",
    countryLabel: "Pays", countryPlaceholder: "ex. France",
    riskLabel: "Niveau minimum", emailLabel: "Email", emailPlaceholder: "vous@exemple.com",
    high: "Élevé seulement", medium: "Moyen ou supérieur", low: "Tous niveaux",
    add: "Ajouter une alerte", cancel: "Annuler", create: "Créer", creating: "Création…",
    noAlerts: "Aucune alerte pays configurée.",
    lastFired: "Dernier envoi", neverFired: "Jamais déclenché",
    planError: "Les alertes pays nécessitent un plan Pro ou supérieur.",
  },
  en: {
    title: "Country risk alerts",
    subtitle: "Get an email when an active outbreak in a watched country reaches your risk threshold.",
    countryLabel: "Country", countryPlaceholder: "e.g. France",
    riskLabel: "Minimum risk", emailLabel: "Email", emailPlaceholder: "you@example.com",
    high: "High only", medium: "Medium or above", low: "All levels",
    add: "Add alert", cancel: "Cancel", create: "Create", creating: "Creating…",
    noAlerts: "No country alerts set up.",
    lastFired: "Last fired", neverFired: "Never fired",
    planError: "Country risk alerts require a Pro plan or higher.",
  },
  es: {
    title: "Alertas de escalada por país",
    subtitle: "Reciba un email cuando un brote activo en un país vigilado alcance el umbral de riesgo.",
    countryLabel: "País", countryPlaceholder: "ej. España",
    riskLabel: "Nivel mínimo", emailLabel: "Email", emailPlaceholder: "usted@ejemplo.com",
    high: "Solo alto", medium: "Medio o superior", low: "Todos los niveles",
    add: "Agregar alerta", cancel: "Cancelar", create: "Crear", creating: "Creando…",
    noAlerts: "No hay alertas de país configuradas.",
    lastFired: "Último envío", neverFired: "Nunca activado",
    planError: "Las alertas de país requieren un plan Pro o superior.",
  },
  ar: {
    title: "تنبيهات تصعيد البلدان",
    subtitle: "احصل على بريد عند وصول تفشٍّ نشط في بلد تراقبه إلى عتبة الخطر.",
    countryLabel: "البلد", countryPlaceholder: "مثال: المغرب",
    riskLabel: "الحد الأدنى", emailLabel: "البريد الإلكتروني", emailPlaceholder: "you@example.com",
    high: "مرتفع فقط", medium: "متوسط أو أعلى", low: "كل المستويات",
    add: "إضافة تنبيه", cancel: "إلغاء", create: "إنشاء", creating: "جارٍ الإنشاء…",
    noAlerts: "لا توجد تنبيهات بلدان.",
    lastFired: "آخر إرسال", neverFired: "لم يُفعَّل بعد",
    planError: "تتطلب تنبيهات البلدان خطة Pro أو أعلى.",
  },
  id: {
    title: "Peringatan eskalasi negara",
    subtitle: "Terima email saat wabah aktif di negara yang dipantau mencapai ambang risiko.",
    countryLabel: "Negara", countryPlaceholder: "mis. Indonesia",
    riskLabel: "Risiko minimum", emailLabel: "Email", emailPlaceholder: "anda@contoh.com",
    high: "Hanya tinggi", medium: "Sedang atau lebih", low: "Semua tingkat",
    add: "Tambah peringatan", cancel: "Batal", create: "Buat", creating: "Membuat…",
    noAlerts: "Tidak ada peringatan negara.",
    lastFired: "Terakhir dikirim", neverFired: "Belum pernah aktif",
    planError: "Peringatan negara memerlukan paket Pro atau lebih tinggi.",
  },
};

const RISK_CHIP: Record<string, string> = {
  high:   "text-red-400 bg-red-900/20 border-red-700/40",
  medium: "text-amber-400 bg-amber-900/20 border-amber-700/30",
  low:    "text-green-400 bg-green-900/20 border-green-700/30",
};

export default function CountryRiskAlertPanel({ locale, userEmail }: { locale: string; userEmail?: string }) {
  const c = COPY[locale] ?? COPY.en;
  const [open,       setOpen]       = useState(false);
  const [alerts,     setAlerts]     = useState<Alert[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [planError,  setPlanError]  = useState(false);
  const [showForm,   setShowForm]   = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError,  setFormError]  = useState("");
  const [countryEn,  setCountryEn]  = useState("");
  const [minRisk,    setMinRisk]    = useState("high");
  const [email,      setEmail]      = useState(userEmail ?? "");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/country-risk-alerts");
      if (res.status === 403) { setPlanError(true); return; }
      const data = await res.json() as { alerts: Alert[] };
      setAlerts(data.alerts ?? []);
    } catch { /* ignore */ } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setFormError(""); setSubmitting(true);
    try {
      const res = await fetch("/api/country-risk-alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ country_en: countryEn, min_risk: minRisk, email }),
      });
      if (!res.ok) {
        const d = await res.json() as { error?: string };
        setFormError(d.error ?? "Error"); return;
      }
      setCountryEn(""); setMinRisk("high"); setEmail(userEmail ?? ""); setShowForm(false);
      load();
    } finally { setSubmitting(false); }
  }

  async function handleDelete(id: string) {
    await fetch(`/api/country-risk-alerts?id=${id}`, { method: "DELETE" });
    setAlerts((prev) => prev.filter((a) => a.id !== id));
  }

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900/40 overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-gray-800/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Bell className="w-4 h-4 text-gray-500" />
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{c.title}</span>
          {alerts.length > 0 && (
            <span className="text-[10px] text-gray-600">({alerts.length})</span>
          )}
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
              {alerts.length === 0 && !showForm && (
                <p className="text-[11px] text-gray-600 italic">{c.noAlerts}</p>
              )}

              <div className="space-y-1.5">
                {alerts.map((alert) => (
                  <div
                    key={alert.id}
                    className="flex items-center justify-between gap-2 rounded-lg border border-gray-800 bg-gray-950/60 px-3 py-2"
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-wrap">
                      <span className="text-xs font-semibold text-gray-300 truncate">{alert.country_en}</span>
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase ${RISK_CHIP[alert.min_risk] ?? ""}`}>
                        {alert.min_risk}+
                      </span>
                      <span className="text-[10px] text-gray-600 truncate">{alert.email}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[9px] text-gray-700 whitespace-nowrap">
                        {alert.last_fired_at
                          ? `${c.lastFired} ${new Date(alert.last_fired_at).toLocaleDateString(locale === "ar" ? "ar-SA" : locale)}`
                          : c.neverFired}
                      </span>
                      <button
                        onClick={() => handleDelete(alert.id)}
                        className="text-gray-700 hover:text-red-400 transition-colors"
                        aria-label="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {showForm ? (
                <form onSubmit={handleCreate} className="space-y-2 border border-gray-800 rounded-lg p-3 bg-gray-950/40">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-gray-500 block mb-1">{c.countryLabel}</label>
                      <input
                        type="text" value={countryEn}
                        onChange={(e) => setCountryEn(e.target.value)}
                        placeholder={c.countryPlaceholder}
                        required
                        className="w-full text-xs px-2 py-1.5 rounded border border-gray-800 bg-gray-900 text-gray-300 placeholder-gray-600 focus:outline-none focus:border-gray-600"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-gray-500 block mb-1">{c.riskLabel}</label>
                      <select
                        value={minRisk} onChange={(e) => setMinRisk(e.target.value)}
                        className="w-full text-xs px-2 py-1.5 rounded border border-gray-800 bg-gray-900 text-gray-300 focus:outline-none focus:border-gray-600"
                      >
                        <option value="high">{c.high}</option>
                        <option value="medium">{c.medium}</option>
                        <option value="low">{c.low}</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-500 block mb-1">{c.emailLabel}</label>
                    <input
                      type="email" value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder={c.emailPlaceholder}
                      required
                      className="w-full text-xs px-2 py-1.5 rounded border border-gray-800 bg-gray-900 text-gray-300 placeholder-gray-600 focus:outline-none focus:border-gray-600"
                    />
                  </div>
                  {formError && <p className="text-[10px] text-red-400">{formError}</p>}
                  <div className="flex gap-2">
                    <button
                      type="submit" disabled={submitting}
                      className="text-xs px-3 py-1.5 rounded bg-blue-900/60 border border-blue-700/50 text-blue-300 hover:bg-blue-800/60 disabled:opacity-40 transition-colors"
                    >
                      {submitting ? c.creating : c.create}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setShowForm(false); setFormError(""); }}
                      className="text-xs px-3 py-1.5 rounded border border-gray-800 text-gray-500 hover:text-gray-300 transition-colors"
                    >
                      {c.cancel}
                    </button>
                  </div>
                </form>
              ) : (
                <button
                  onClick={() => setShowForm(true)}
                  className="flex items-center gap-1.5 text-[11px] text-gray-500 hover:text-gray-300 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  {c.add}
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
