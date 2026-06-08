"use client";

import { useState, useEffect } from "react";
import { Bookmark, BookmarkCheck, Trash2, Plus } from "lucide-react";

export interface FilterState {
  search:    string;
  region:    string;
  country:   string;
  risk:      string;
  dateFrom:  string;
  dateTo:    string;
  cfrFilter: string; // "all" | "critical" | "elevated" | "low" | "nodata"
}

interface SavedFilter {
  name:      string;
  filters:   FilterState;
  savedAt:   string;
}

const STORAGE_KEY = "hwg_saved_filters";

const COPY: Record<string, {
  save: string; load: string; delete: string; name: string; noSaved: string; maxReached: string;
}> = {
  fr: { save: "Sauvegarder ce filtre", load: "Charger", delete: "Supprimer", name: "Nom du filtre", noSaved: "Aucun filtre sauvegardé.", maxReached: "Maximum 5 filtres." },
  en: { save: "Save this filter", load: "Load", delete: "Delete", name: "Filter name", noSaved: "No saved filters.", maxReached: "Maximum 5 filters." },
  es: { save: "Guardar este filtro", load: "Cargar", delete: "Eliminar", name: "Nombre del filtro", noSaved: "Sin filtros guardados.", maxReached: "Máximo 5 filtros." },
  ar: { save: "حفظ هذا الفلتر", load: "تحميل", delete: "حذف", name: "اسم الفلتر", noSaved: "لا توجد فلاتر محفوظة.", maxReached: "الحد الأقصى 5 فلاتر." },
  id: { save: "Simpan filter ini", load: "Muat", delete: "Hapus", name: "Nama filter", noSaved: "Tidak ada filter tersimpan.", maxReached: "Maksimal 5 filter." },
};

interface Props {
  locale:        string;
  currentFilters: FilterState;
  hasActiveFilters: boolean;
  onLoad:        (filters: FilterState) => void;
}

export default function SavedFilters({ locale, currentFilters, hasActiveFilters, onLoad }: Props) {
  const c = COPY[locale] ?? COPY.en;
  const [saved,     setSaved]     = useState<SavedFilter[]>([]);
  const [naming,    setNaming]    = useState(false);
  const [newName,   setNewName]   = useState("");

  useEffect(() => {
    // One-time hydration-safe load from localStorage. `saved` must start as
    // `[]` on both server and client — the server has no `localStorage`, so
    // the first paint can only show "no saved filters" — and this effect then
    // loads the persisted list right after mount. That's exactly the
    // "synchronize with an external system on mount" use React documents
    // useEffect for (https://react.dev/learn/you-might-not-need-an-effect):
    // a lazy `useState(() => ...)` initializer would run during the
    // *hydration* render too and could return a populated list where the
    // server rendered an empty one — a real hydration mismatch, not just a
    // lint nitpick — so the value has to land post-mount, in an effect, like
    // this. (Same constraint, same resolution, as CookieBanner/
    // ConsentAwareAnalytics — see CookieBanner.tsx for why *those* went with
    // useSyncExternalStore instead: they react to an ongoing external event
    // this component has no equivalent of, so an effect remains the right
    // tool here.)
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (raw) setSaved(JSON.parse(raw));
    } catch { /* ignore */ }
  }, []);

  function persist(list: SavedFilter[]) {
    setSaved(list);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  }

  function save() {
    if (!newName.trim() || saved.length >= 5) return;
    const entry: SavedFilter = {
      name:    newName.trim(),
      filters: { ...currentFilters },
      savedAt: new Date().toISOString(),
    };
    persist([...saved, entry]);
    setNewName("");
    setNaming(false);
  }

  function remove(name: string) {
    persist(saved.filter((s) => s.name !== name));
  }

  const maxReached = saved.length >= 5;

  return (
    <div className="space-y-2">
      {/* Saved filter chips */}
      {saved.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {saved.map((s) => (
            <div key={s.name} className="flex items-center gap-0.5 bg-gray-800 border border-gray-700 rounded-full text-xs overflow-hidden">
              <button
                onClick={() => onLoad(s.filters)}
                className="flex items-center gap-1.5 px-3 py-1 text-gray-300 hover:text-white hover:bg-gray-700 transition-colors"
              >
                <BookmarkCheck className="w-3 h-3 text-red-400" />
                {s.name}
              </button>
              <button
                onClick={() => remove(s.name)}
                className="px-2 py-1 text-gray-600 hover:text-red-400 hover:bg-gray-700 transition-colors"
                title={c.delete}
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Save button / name input */}
      {hasActiveFilters && (
        maxReached ? (
          <p className="text-xs text-amber-500">{c.maxReached}</p>
        ) : naming ? (
          <div className="flex gap-2">
            <input
              autoFocus
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") setNaming(false); }}
              placeholder={c.name}
              maxLength={30}
              className="flex-1 bg-gray-800 border border-gray-700 text-white text-xs rounded-lg px-3 py-1.5 focus:outline-none focus:border-red-500 transition-colors"
            />
            <button onClick={save} disabled={!newName.trim()}
              className="px-3 py-1.5 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition-colors">
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => setNaming(true)}
            className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-300 transition-colors"
          >
            <Bookmark className="w-3.5 h-3.5" />
            {c.save}
          </button>
        )
      )}
    </div>
  );
}
