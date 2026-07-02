"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import Link from "next/link";
import { Search, X } from "lucide-react";
import { allDiseases, diseaseToSlug } from "@/lib/disease-data";
import { countryToSlug } from "@/lib/country-utils";
import { getLocalizedDisease, getLocalizedCountry } from "@/lib/outbreaks";
import { createClient } from "@/lib/supabase-browser";

interface SearchResult {
  type: "disease" | "country" | "outbreak";
  label: string;
  sublabel?: string;
  href: string;
}

const PLACEHOLDER: Record<string, string> = {
  en: "Search diseases, countries, outbreaks…",
  fr: "Chercher maladies, pays, foyers…",
  es: "Buscar enfermedades, países, brotes…",
  ar: "البحث عن الأمراض والدول والتفشيات…",
  id: "Cari penyakit, negara, wabah…",
};

const SECTION_LABEL: Record<string, Record<string, string>> = {
  en: { disease: "Diseases", country: "Countries", outbreak: "Outbreaks" },
  fr: { disease: "Maladies", country: "Pays", outbreak: "Foyers" },
  es: { disease: "Enfermedades", country: "Países", outbreak: "Brotes" },
  ar: { disease: "الأمراض", country: "الدول", outbreak: "التفشيات" },
  id: { disease: "Penyakit", country: "Negara", outbreak: "Wabah" },
};

const SECTION_CHIP: Record<string, Record<string, string>> = {
  en: { disease: "Disease", country: "Country", outbreak: "Outbreak" },
  fr: { disease: "Maladie", country: "Pays", outbreak: "Foyer" },
  es: { disease: "Enfermedad", country: "País", outbreak: "Brote" },
  ar: { disease: "مرض", country: "دولة", outbreak: "تفشٍّ" },
  id: { disease: "Penyakit", country: "Negara", outbreak: "Wabah" },
};

const NO_RESULTS: Record<string, string> = {
  en: "No results found",
  fr: "Aucun résultat",
  es: "Sin resultados",
  ar: "لا نتائج",
  id: "Tidak ada hasil",
};

export default function GlobalSearch() {
  const locale = useLocale();
  const l = (["en","fr","es","ar","id"].includes(locale) ? locale : "en");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [focused, setFocused] = useState(0);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cmd+K / Ctrl+K to open
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen(true);
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setQuery("");
      setResults([]);
      setFocused(0);
    }
  }, [open]);

  const search = useCallback(async (q: string) => {
    const trimmed = q.trim().toLowerCase();
    if (trimmed.length < 2) { setResults([]); return; }
    setLoading(true);

    const diseases = allDiseases();
    const matchedDiseases: SearchResult[] = diseases
      .filter((d) => {
        const names = [d.name_en, d.name_fr, d.name_es, d.name_ar, d.name_id];
        return names.some((n) => n?.toLowerCase().includes(trimmed));
      })
      .slice(0, 4)
      .map((d) => ({
        type: "disease" as const,
        label: l === "fr" ? d.name_fr : l === "es" ? d.name_es : l === "ar" ? d.name_ar : l === "id" ? d.name_id : d.name_en,
        href: `/${l}/disease/${diseaseToSlug(d.name_en)}`,
      }));

    // Supabase: countries + outbreaks
    const supabase = createClient();
    const [{ data: cData }, { data: oData }] = await Promise.all([
      supabase
        .from("outbreaks")
        .select("country_en, country, country_ar")
        .ilike("country_en", `%${trimmed}%`)
        .not("country_en", "is", null)
        .limit(20),
      supabase
        .from("outbreaks")
        .select("id, disease, disease_en, disease_ar, country, country_en, country_ar, active, date")
        .or(`disease_en.ilike.%${trimmed}%,disease.ilike.%${trimmed}%,country_en.ilike.%${trimmed}%`)
        .order("date", { ascending: false })
        .limit(5),
    ]);

    // Deduplicate countries
    const seenCountries = new Set<string>();
    const matchedCountries: SearchResult[] = (cData ?? [])
      .filter((r) => {
        if (!r.country_en || seenCountries.has(r.country_en)) return false;
        seenCountries.add(r.country_en);
        return true;
      })
      .slice(0, 4)
      .map((r) => ({
        type: "country" as const,
        label: getLocalizedCountry({ country: r.country, country_en: r.country_en, country_ar: r.country_ar ?? null }, l),
        href: `/${l}/country/${countryToSlug(r.country_en!)}`,
      }));

    const matchedOutbreaks: SearchResult[] = (oData ?? []).map((o) => ({
      type: "outbreak" as const,
      label: getLocalizedDisease(o, l),
      sublabel: getLocalizedCountry(o, l),
      href: `/${l}/outbreak/${o.id}`,
    }));

    setResults([...matchedDiseases, ...matchedCountries, ...matchedOutbreaks]);
    setFocused(0);
    setLoading(false);
  }, [l]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(val), 200);
  };

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setFocused((f) => Math.min(f + 1, results.length - 1)); }
    if (e.key === "ArrowUp")   { e.preventDefault(); setFocused((f) => Math.max(f - 1, 0)); }
    if (e.key === "Enter" && results[focused]) {
      router.push(results[focused].href);
      setOpen(false);
    }
  };

  // Group results by type
  const groups: { type: SearchResult["type"]; items: SearchResult[] }[] = [];
  for (const type of ["disease", "country", "outbreak"] as const) {
    const items = results.filter((r) => r.type === type);
    if (items.length) groups.push({ type, items });
  }

  let flatIndex = 0;

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 text-sm text-gray-400 hover:text-white bg-gray-800/60 hover:bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 transition-colors"
        aria-label="Search"
      >
        <Search className="w-3.5 h-3.5" />
        <span className="hidden xl:inline">{l === "ar" ? "بحث" : l === "fr" ? "Chercher" : l === "es" ? "Buscar" : l === "id" ? "Cari" : "Search"}</span>
        <kbd className="hidden xl:inline text-xs bg-gray-700 text-gray-400 px-1.5 py-0.5 rounded font-mono">⌘K</kbd>
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-start justify-center pt-[15vh] px-4" dir={l === "ar" ? "rtl" : "ltr"}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setOpen(false)} />

      {/* Modal */}
      <div className="relative w-full max-w-xl bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl overflow-hidden">
        {/* Input row */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-800">
          <Search className="w-4 h-4 text-gray-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder={PLACEHOLDER[l]}
            className="flex-1 bg-transparent text-white placeholder-gray-500 outline-none text-sm"
          />
          {loading && (
            <div className="w-3.5 h-3.5 border-2 border-gray-600 border-t-red-400 rounded-full animate-spin shrink-0" />
          )}
          <button onClick={() => setOpen(false)} className="text-gray-500 hover:text-white shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Results */}
        {query.length >= 2 && (
          <div className="max-h-80 overflow-y-auto">
            {groups.length === 0 && !loading && (
              <p className="text-sm text-gray-500 text-center py-8">{NO_RESULTS[l]}</p>
            )}
            {groups.map(({ type, items }) => (
              <div key={type}>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 pt-3 pb-1">
                  {SECTION_LABEL[l][type]}
                </p>
                {items.map((r) => {
                  const idx = flatIndex++;
                  return (
                    <Link
                      key={r.href}
                      href={r.href}
                      onClick={() => setOpen(false)}
                      onMouseEnter={() => setFocused(idx)}
                      className={`flex items-center justify-between gap-3 px-4 py-2.5 transition-colors ${
                        idx === focused ? "bg-red-950/40 text-white" : "text-gray-300 hover:bg-gray-800"
                      }`}
                    >
                      <div className="min-w-0">
                        <span className="text-sm font-medium truncate block">{r.label}</span>
                        {r.sublabel && <span className="text-xs text-gray-500 truncate block">{r.sublabel}</span>}
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${
                        type === "disease" ? "bg-purple-500/10 text-purple-400" :
                        type === "country" ? "bg-blue-500/10 text-blue-400" :
                        "bg-red-500/10 text-red-400"
                      }`}>
                        {(SECTION_CHIP[l] ?? SECTION_CHIP.en)[type]}
                      </span>
                    </Link>
                  );
                })}
              </div>
            ))}
          </div>
        )}

        {/* Footer hint */}
        <div className="flex items-center justify-between px-4 py-2 border-t border-gray-800 text-xs text-gray-600">
          <span>↑↓ {l === "fr" ? "naviguer" : l === "es" ? "navegar" : l === "ar" ? "تنقل" : l === "id" ? "navigasi" : "navigate"}</span>
          <span>↵ {l === "fr" ? "ouvrir" : l === "es" ? "abrir" : l === "ar" ? "فتح" : l === "id" ? "buka" : "open"}</span>
          <span>Esc {l === "fr" ? "fermer" : l === "es" ? "cerrar" : l === "ar" ? "إغلاق" : l === "id" ? "tutup" : "close"}</span>
        </div>
      </div>
    </div>
  );
}
