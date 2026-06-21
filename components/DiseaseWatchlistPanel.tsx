"use client";

import { useState, useEffect } from "react";
import { ChevronDown, ChevronUp, X, Plus, Microscope } from "lucide-react";

const COPY: Record<string, {
  title: string; subtitle: string;
  addPlaceholder: string; add: string;
  empty: string; save: string; saving: string; saved: string;
}> = {
  fr: {
    title: "Maladies prioritaires",
    subtitle: "Filtrez le tableau pour n'afficher que ces maladies. Les 12 pathogènes prioritaires IHR recommandés : Ebola, Marburg, Mpox, MERS, Grippe H5, Choléra, Peste, Dengue, Fièvre jaune, Rougeole, Méningocoque, COVID-19.",
    addPlaceholder: "Ebola, MERS, Mpox…", add: "Ajouter",
    empty: "Aucune maladie configurée",
    save: "Enregistrer", saving: "Enregistrement…", saved: "Enregistré — rechargement…",
  },
  en: {
    title: "Priority diseases",
    subtitle: "Filter the table to show only these diseases. Recommended IHR priority pathogens: Ebola, Marburg, Mpox, MERS, H5 Influenza, Cholera, Plague, Dengue, Yellow Fever, Measles, Meningococcal, COVID-19.",
    addPlaceholder: "Ebola, MERS, Mpox…", add: "Add",
    empty: "No diseases configured",
    save: "Save", saving: "Saving…", saved: "Saved — reloading…",
  },
  es: {
    title: "Enfermedades prioritarias",
    subtitle: "Filtre la tabla para mostrar solo estas enfermedades. Patógenos prioritarios RSI recomendados: Ébola, Marburg, Mpox, MERS, Gripe H5, Cólera, Peste, Dengue, Fiebre amarilla, Sarampión, Meningococo, COVID-19.",
    addPlaceholder: "Ébola, MERS, Mpox…", add: "Añadir",
    empty: "Sin enfermedades configuradas",
    save: "Guardar", saving: "Guardando…", saved: "Guardado — recargando…",
  },
  ar: {
    title: "الأمراض ذات الأولوية",
    subtitle: "صفِّح الجدول لعرض هذه الأمراض فقط. مسببات الأمراض ذات الأولوية وفق اللوائح الصحية الدولية: إيبولا، ماربورغ، جدري القردة، ميرس، إنفلونزا H5، كوليرا، طاعون، دنغي، حمى صفراء، حصبة، مكورات سحائية، COVID-19.",
    addPlaceholder: "Ebola, MERS, Mpox…", add: "إضافة",
    empty: "لا توجد أمراض مُهيَّأة",
    save: "حفظ", saving: "جارٍ الحفظ…", saved: "تم الحفظ — جارٍ إعادة التحميل…",
  },
  id: {
    title: "Penyakit prioritas",
    subtitle: "Filter tabel untuk menampilkan penyakit-penyakit ini saja. Patogen prioritas IHR: Ebola, Marburg, Mpox, MERS, Influenza H5, Kolera, Pes, Dengue, Demam kuning, Campak, Meningokokal, COVID-19.",
    addPlaceholder: "Ebola, MERS, Mpox…", add: "Tambah",
    empty: "Tidak ada penyakit yang dikonfigurasi",
    save: "Simpan", saving: "Menyimpan…", saved: "Tersimpan — memuat ulang…",
  },
};

interface Props {
  locale: string;
  initialWatchlist: string[];
}

export default function DiseaseWatchlistPanel({ locale, initialWatchlist }: Props) {
  const c = COPY[locale] ?? COPY.en;
  const [open,    setOpen]    = useState(false);
  const [list,    setList]    = useState<string[]>(initialWatchlist);
  const [input,   setInput]   = useState("");
  const [saving,  setSaving]  = useState(false);
  const [saved,   setSaved]   = useState(false);

  // Re-sync if parent prop changes (e.g. after page reload)
  useEffect(() => { setList(initialWatchlist); }, [initialWatchlist]);

  function add() {
    const d = input.trim();
    if (!d) return;
    if (!list.some((x) => x.toLowerCase() === d.toLowerCase())) {
      setList((prev) => [...prev, d]);
    }
    setInput("");
  }

  function remove(disease: string) {
    setList((prev) => prev.filter((d) => d !== disease));
  }

  async function save() {
    if (saving) return;
    setSaving(true);
    try {
      await fetch("/api/disease-watchlist", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ watchlist: list }),
      });
      setSaved(true);
      setTimeout(() => window.location.reload(), 800);
    } catch { /* ignore */ } finally { setSaving(false); }
  }

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900/40">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-800/30 transition-colors rounded-xl"
      >
        <div className="flex items-center gap-2">
          <Microscope className="w-4 h-4 text-gray-500 shrink-0" />
          <span className="text-sm font-semibold text-gray-300">{c.title}</span>
          {!open && list.length > 0 && (
            <span className="text-xs text-gray-600">({list.length})</span>
          )}
          {!open && list.length === 0 && (
            <span className="ml-1 text-xs text-gray-600">{c.empty}</span>
          )}
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-gray-500 shrink-0" /> : <ChevronDown className="w-4 h-4 text-gray-500 shrink-0" />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3 border-t border-gray-800 pt-4">
          <p className="text-xs text-gray-500 leading-relaxed">{c.subtitle}</p>

          {/* Chips */}
          <div className="flex flex-wrap gap-1.5 min-h-[28px]">
            {list.length === 0 && (
              <p className="text-xs text-gray-600 italic self-center">{c.empty}</p>
            )}
            {list.map((d) => (
              <span
                key={d}
                className="inline-flex items-center gap-1 text-xs px-2 py-1 bg-blue-900/30 border border-blue-700/40 text-blue-300 rounded-full"
              >
                {d}
                <button
                  onClick={() => remove(d)}
                  className="hover:text-red-400 transition-colors ml-0.5"
                >
                  <X className="w-2.5 h-2.5" />
                </button>
              </span>
            ))}
          </div>

          {/* Add input */}
          <div className="flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && add()}
              placeholder={c.addPlaceholder}
              maxLength={64}
              className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-gray-500 transition-colors"
            />
            <button
              onClick={add}
              disabled={!input.trim()}
              className="px-3 py-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-40 text-white rounded-lg transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Save */}
          <button
            onClick={save}
            disabled={saving || saved}
            className="w-full py-2 bg-blue-700 hover:bg-blue-600 disabled:opacity-60 text-white text-xs font-semibold rounded-lg transition-colors"
          >
            {saved ? c.saved : saving ? c.saving : c.save}
          </button>
        </div>
      )}
    </div>
  );
}
