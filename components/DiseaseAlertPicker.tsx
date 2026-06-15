"use client";

import { useEffect, useState } from "react";
import { Biohazard, Plus, X, Loader2 } from "lucide-react";
import LockedUpgradeButton from "@/components/LockedUpgradeButton";

const COPY: Record<string, {
  title: string; sub: string; add: string; remove: string;
  empty: string; max: string; locked: string; upgrade: string; loading: string; error: string;
}> = {
  fr: { title: "Alertes par maladie", sub: "Recevez un email dès qu'un foyer est détecté pour ces pathogènes, partout dans le monde.", add: "Ajouter", remove: "Retirer", empty: "Aucune maladie surveillée.", max: "Maximum 10 maladies.", locked: "Alertes par maladie — disponible avec le plan Pro.", upgrade: "Débloquer Pro", loading: "Chargement…", error: "Erreur." },
  en: { title: "Disease alerts", sub: "Get an email as soon as an outbreak is detected for these pathogens, anywhere in the world.", add: "Add", remove: "Remove", empty: "No diseases monitored.", max: "Maximum 10 diseases.", locked: "Disease alerts — available on the Pro plan.", upgrade: "Unlock Pro", loading: "Loading…", error: "Error." },
  es: { title: "Alertas por enfermedad", sub: "Reciba un email cuando se detecte un brote de estos patógenos en cualquier parte del mundo.", add: "Agregar", remove: "Quitar", empty: "Sin enfermedades monitoreadas.", max: "Máximo 10 enfermedades.", locked: "Alertas por enfermedad — disponible en el plan Pro.", upgrade: "Desbloquear Pro", loading: "Cargando…", error: "Error." },
  ar: { title: "تنبيهات الأمراض", sub: "احصل على بريد إلكتروني فور اكتشاف تفشٍّ لهذه الأمراض في أي مكان بالعالم.", add: "إضافة", remove: "إزالة", empty: "لا توجد أمراض مراقبة.", max: "الحد الأقصى 10 أمراض.", locked: "تنبيهات الأمراض — متاح في خطة Pro.", upgrade: "فتح Pro", loading: "جارٍ التحميل…", error: "خطأ." },
  id: { title: "Peringatan penyakit", sub: "Dapatkan email segera saat wabah terdeteksi untuk patogen ini, di mana saja.", add: "Tambah", remove: "Hapus", empty: "Tidak ada penyakit yang dipantau.", max: "Maksimal 10 penyakit.", locked: "Peringatan penyakit — tersedia di paket Pro.", upgrade: "Buka Pro", loading: "Memuat…", error: "Error." },
};

interface Props {
  locale: string;
  isPaid: boolean;
}

export default function DiseaseAlertPicker({ locale, isPaid }: Props) {
  const c = COPY[locale] ?? COPY.en;
  const [subscribed, setSubscribed] = useState<string[]>([]);
  const [available,  setAvailable]  = useState<string[]>([]);
  const [selected,   setSelected]   = useState<string>("");
  const [loading,    setLoading]    = useState(true);
  const [saving,     setSaving]     = useState(false);
  const [error,      setError]      = useState("");
  const maxReached = subscribed.length >= 10;

  useEffect(() => {
    if (!isPaid) return;
    fetch("/api/alert-diseases")
      .then((r) => r.json())
      .then((d) => {
        setSubscribed(d.subscribed ?? []);
        setAvailable(d.available ?? []);
        if (d.available?.length) setSelected(d.available[0]);
      })
      .catch(() => setError(c.error))
      .finally(() => setLoading(false));
  }, [isPaid, c.error]);

  async function add() {
    if (!selected || maxReached) return;
    setSaving(true); setError("");
    try {
      await fetch("/api/alert-diseases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ disease_en: selected }),
      });
      setSubscribed((prev) => [...new Set([...prev, selected])].sort());
    } catch { setError(c.error); }
    finally { setSaving(false); }
  }

  async function remove(disease: string) {
    setSaving(true); setError("");
    try {
      await fetch("/api/alert-diseases", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ disease_en: disease }),
      });
      setSubscribed((prev) => prev.filter((d) => d !== disease));
    } catch { setError(c.error); }
    finally { setSaving(false); }
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-4">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center shrink-0 mt-0.5">
          <Biohazard className="w-4 h-4 text-red-400" />
        </div>
        <div>
          <p className="text-white font-semibold text-sm">{c.title}</p>
          <p className="text-gray-400 text-xs mt-0.5">{c.sub}</p>
        </div>
      </div>

      {!isPaid ? (
        <div className="flex items-center gap-3 p-3 rounded-lg bg-amber-900/20 border border-amber-700/30">
          <p className="text-sm text-gray-400 flex-1">{c.locked}</p>
          <LockedUpgradeButton feature="realtime" label={c.upgrade} variant="banner" />
        </div>
      ) : loading ? (
        <div className="flex items-center gap-2 text-gray-500 text-sm">
          <Loader2 className="w-4 h-4 animate-spin" />
          {c.loading}
        </div>
      ) : (
        <>
          {/* Subscribed pills */}
          <div className="flex flex-wrap gap-2 min-h-[28px]">
            {subscribed.length === 0 ? (
              <p className="text-gray-600 text-xs italic">{c.empty}</p>
            ) : subscribed.map((d) => (
              <span key={d} className="inline-flex items-center gap-1.5 text-xs bg-red-900/30 border border-red-800/40 text-red-300 px-3 py-1 rounded-full">
                {d}
                <button onClick={() => remove(d)} disabled={saving} className="hover:text-white transition-colors">
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>

          {/* Add disease */}
          {maxReached ? (
            <p className="text-amber-400 text-xs">{c.max}</p>
          ) : (
            <div className="flex gap-2">
              <select
                value={selected}
                onChange={(e) => setSelected(e.target.value)}
                className="flex-1 bg-gray-800 border border-gray-700 text-gray-300 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-gray-500 transition-colors"
              >
                {available
                  .filter((d) => !subscribed.includes(d))
                  .map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
              </select>
              <button
                onClick={add}
                disabled={saving || !selected || available.filter((d) => !subscribed.includes(d)).length === 0}
                className="flex items-center gap-1.5 px-4 py-2 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors"
              >
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                {c.add}
              </button>
            </div>
          )}

          {error && <p className="text-red-400 text-xs">{error}</p>}
        </>
      )}
    </div>
  );
}
