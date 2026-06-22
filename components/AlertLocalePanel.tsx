"use client";

import { useState, useEffect, useCallback } from "react";
import { Globe, Check, ChevronDown, ChevronUp, Loader2 } from "lucide-react";

const LOCALES = [
  { value: "en", label: "English" },
  { value: "fr", label: "Français" },
  { value: "es", label: "Español" },
  { value: "ar", label: "العربية" },
  { value: "id", label: "Bahasa Indonesia" },
] as const;

const COPY: Record<string, { title: string; subtitle: string; save: string; saving: string; saved: string; planError: string }> = {
  fr: { title: "Langue des alertes email", subtitle: "Les alertes de foyer vous seront envoyées dans cette langue.", save: "Enregistrer", saving: "Enregistrement…", saved: "Enregistré !", planError: "Requiert un plan Pro ou supérieur." },
  en: { title: "Alert email language", subtitle: "Outbreak alerts will be sent in this language.", save: "Save", saving: "Saving…", saved: "Saved!", planError: "Requires a Pro plan or higher." },
  es: { title: "Idioma de los emails de alerta", subtitle: "Las alertas de brote se enviarán en este idioma.", save: "Guardar", saving: "Guardando…", saved: "¡Guardado!", planError: "Requiere un plan Pro o superior." },
  ar: { title: "لغة تنبيهات البريد الإلكتروني", subtitle: "سيتم إرسال تنبيهات التفشي بهذه اللغة.", save: "حفظ", saving: "جارٍ الحفظ…", saved: "تم الحفظ!", planError: "يتطلب خطة Pro أو أعلى." },
  id: { title: "Bahasa email peringatan", subtitle: "Peringatan wabah akan dikirim dalam bahasa ini.", save: "Simpan", saving: "Menyimpan…", saved: "Tersimpan!", planError: "Memerlukan paket Pro atau lebih tinggi." },
};

export default function AlertLocalePanel({ locale }: { locale: string }) {
  const c = COPY[locale] ?? COPY.en;
  const [open,       setOpen]       = useState(false);
  const [current,    setCurrent]    = useState("en");
  const [selected,   setSelected]   = useState("en");
  const [loading,    setLoading]    = useState(true);
  const [saving,     setSaving]     = useState(false);
  const [saved,      setSaved]      = useState(false);
  const [planError,  setPlanError]  = useState(false);

  const load = useCallback(async () => {
    try {
      const res  = await fetch("/api/user/locale");
      if (res.status === 403) { setPlanError(true); return; }
      const data = await res.json() as { alert_locale: string };
      setCurrent(data.alert_locale ?? "en");
      setSelected(data.alert_locale ?? "en");
    } catch { /* ignore */ } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleSave() {
    setSaving(true);
    try {
      await fetch("/api/user/locale", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ alert_locale: selected }),
      });
      setCurrent(selected);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally { setSaving(false); }
  }

  const isDirty = selected !== current;

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900/40 overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-gray-800/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Globe className="w-4 h-4 text-gray-500" />
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{c.title}</span>
          {!loading && !planError && (
            <span className="text-[10px] text-gray-600">
              ({LOCALES.find((l) => l.value === current)?.label ?? current})
            </span>
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
            <div className="flex items-center gap-2 flex-wrap">
              <select
                value={selected}
                onChange={(e) => setSelected(e.target.value)}
                className="text-xs px-3 py-1.5 rounded border border-gray-800 bg-gray-900 text-gray-300 focus:outline-none focus:border-gray-600"
              >
                {LOCALES.map((l) => (
                  <option key={l.value} value={l.value}>{l.label}</option>
                ))}
              </select>
              {isDirty && (
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded bg-blue-900/60 border border-blue-700/50 text-blue-300 hover:bg-blue-800/60 disabled:opacity-40 transition-colors"
                >
                  {saving
                    ? <><Loader2 className="w-3 h-3 animate-spin" />{c.saving}</>
                    : c.save}
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
