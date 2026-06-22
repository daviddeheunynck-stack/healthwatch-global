"use client";

import { useState, useEffect, useCallback } from "react";
import { MapPin, Check, ChevronDown, ChevronUp, Loader2 } from "lucide-react";

const REGIONS = [
  { value: "all",      label: { fr: "Monde entier", en: "Global", es: "Global", ar: "عالمي", id: "Global" } },
  { value: "africa",   label: { fr: "Afrique", en: "Africa", es: "África", ar: "أفريقيا", id: "Afrika" } },
  { value: "asia",     label: { fr: "Asie", en: "Asia", es: "Asia", ar: "آسيا", id: "Asia" } },
  { value: "americas", label: { fr: "Amériques", en: "Americas", es: "Américas", ar: "الأمريكتين", id: "Amerika" } },
  { value: "europe",   label: { fr: "Europe", en: "Europe", es: "Europa", ar: "أوروبا", id: "Eropa" } },
  { value: "oceania",  label: { fr: "Océanie", en: "Oceania", es: "Oceanía", ar: "أوقيانوسيا", id: "Oseania" } },
] as const;

const COPY: Record<string, { title: string; subtitle: string; save: string; saving: string; saved: string; planError: string }> = {
  fr: { title: "Région du digest hebdomadaire", subtitle: "Chaque lundi, recevez un récapitulatif des foyers actifs pour votre région.", save: "Enregistrer", saving: "Enregistrement…", saved: "Enregistré !", planError: "Requiert un plan Pro ou supérieur." },
  en: { title: "Weekly digest region", subtitle: "Every Monday, receive a recap of active outbreaks for your region.", save: "Save", saving: "Saving…", saved: "Saved!", planError: "Requires a Pro plan or higher." },
  es: { title: "Región del digest semanal", subtitle: "Cada lunes, reciba un resumen de brotes activos para su región.", save: "Guardar", saving: "Guardando…", saved: "¡Guardado!", planError: "Requiere un plan Pro o superior." },
  ar: { title: "منطقة الملخص الأسبوعي", subtitle: "كل يوم اثنين، استقبل ملخصاً للتفشيات النشطة في منطقتك.", save: "حفظ", saving: "جارٍ الحفظ…", saved: "تم الحفظ!", planError: "يتطلب خطة Pro أو أعلى." },
  id: { title: "Wilayah digest mingguan", subtitle: "Setiap Senin, terima ringkasan wabah aktif untuk wilayah Anda.", save: "Simpan", saving: "Menyimpan…", saved: "Tersimpan!", planError: "Memerlukan paket Pro atau lebih tinggi." },
};

export default function DigestRegionPanel({ locale }: { locale: string }) {
  const c = COPY[locale] ?? COPY.en;
  const [open,      setOpen]      = useState(false);
  const [current,   setCurrent]   = useState("all");
  const [selected,  setSelected]  = useState("all");
  const [loading,   setLoading]   = useState(true);
  const [saving,    setSaving]    = useState(false);
  const [saved,     setSaved]     = useState(false);
  const [planError, setPlanError] = useState(false);

  const load = useCallback(async () => {
    try {
      const res  = await fetch("/api/user/digest-region");
      if (res.status === 403) { setPlanError(true); return; }
      const data = await res.json() as { digest_region: string };
      setCurrent(data.digest_region ?? "all");
      setSelected(data.digest_region ?? "all");
    } catch { /* ignore */ } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleSave() {
    setSaving(true);
    try {
      await fetch("/api/user/digest-region", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ digest_region: selected }),
      });
      setCurrent(selected);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally { setSaving(false); }
  }

  const isDirty = selected !== current;
  const currentRegion = REGIONS.find((r) => r.value === current);
  const currentLabel  = currentRegion?.label[locale as keyof typeof currentRegion.label] ?? current;

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900/40 overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-gray-800/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          <MapPin className="w-4 h-4 text-gray-500" />
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{c.title}</span>
          {!loading && !planError && (
            <span className="text-[10px] text-gray-600">({currentLabel})</span>
          )}
        </div>
        {open
          ? <ChevronUp   className="w-3.5 h-3.5 text-gray-600 shrink-0" />
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
            <div className="py-2"><Loader2 className="w-3.5 h-3.5 animate-spin text-gray-600" /></div>
          )}

          {!planError && !loading && (
            <div className="flex items-center gap-2 flex-wrap">
              <select
                value={selected}
                onChange={(e) => setSelected(e.target.value)}
                className="text-xs px-3 py-1.5 rounded border border-gray-800 bg-gray-900 text-gray-300 focus:outline-none focus:border-gray-600"
              >
                {REGIONS.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label[locale as keyof typeof r.label] ?? r.label.en}
                  </option>
                ))}
              </select>
              {isDirty && (
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded bg-blue-900/60 border border-blue-700/50 text-blue-300 hover:bg-blue-800/60 disabled:opacity-40 transition-colors"
                >
                  {saving ? <><Loader2 className="w-3 h-3 animate-spin" />{c.saving}</> : c.save}
                </button>
              )}
              {saved && (
                <span className="flex items-center gap-1 text-[11px] text-green-400">
                  <Check className="w-3 h-3" />{c.saved}
                </span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
