"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import type { DiseaseInfo, TransmissionMode } from "@/lib/disease-data";
import { diseaseToSlug } from "@/lib/disease-data";

type DiseaseStats = { count: number; cases: number };
type Locale = "en" | "fr" | "es" | "ar" | "id";

const LOCALES: Locale[] = ["en", "fr", "es", "ar", "id"];

const MODE_LABELS: Record<Locale, Record<TransmissionMode | "all", string>> = {
  en: {
    all: "All routes",
    airborne: "Airborne",
    droplet: "Droplet",
    contact: "Direct contact",
    vector: "Vector-borne",
    foodborne: "Foodborne",
    waterborne: "Waterborne",
    sexual: "Sexual",
    nosocomial: "Nosocomial",
    fomite: "Fomite",
    zoonotic: "Zoonotic",
  },
  fr: {
    all: "Toutes voies",
    airborne: "Aérien",
    droplet: "Gouttelettes",
    contact: "Contact direct",
    vector: "Vectorielle",
    foodborne: "Alimentaire",
    waterborne: "Hydrique",
    sexual: "Sexuel",
    nosocomial: "Nosocomial",
    fomite: "Fomite",
    zoonotic: "Zoonotique",
  },
  es: {
    all: "Todas las vías",
    airborne: "Aéreo",
    droplet: "Gotas",
    contact: "Contacto directo",
    vector: "Vectorial",
    foodborne: "Alimentario",
    waterborne: "Hídrico",
    sexual: "Sexual",
    nosocomial: "Nosocomial",
    fomite: "Fómite",
    zoonotic: "Zoonótico",
  },
  ar: {
    all: "جميع الطرق",
    airborne: "هوائي",
    droplet: "قطيرات",
    contact: "تماس مباشر",
    vector: "ناقل حشري",
    foodborne: "غذائي",
    waterborne: "مائي",
    sexual: "جنسي",
    nosocomial: "مستشفوي",
    fomite: "تلامس سطوح",
    zoonotic: "حيواني المصدر",
  },
  id: {
    all: "Semua jalur",
    airborne: "Udara",
    droplet: "Droplet",
    contact: "Kontak langsung",
    vector: "Vektor",
    foodborne: "Makanan",
    waterborne: "Air",
    sexual: "Seksual",
    nosocomial: "Nosokomial",
    fomite: "Fomit",
    zoonotic: "Zoonosis",
  },
};

const FILTER_TITLE: Record<Locale, string> = {
  en: "Filter by transmission route",
  fr: "Filtrer par voie de transmission",
  es: "Filtrar por vía de transmisión",
  ar: "تصفية حسب طريق الانتقال",
  id: "Filter berdasarkan jalur penularan",
};

const COUNT_LABEL: Record<Locale, (n: number, mode: string) => string> = {
  en: (n, m) => `${n} disease${n !== 1 ? "s" : ""} — ${m}`,
  fr: (n, m) => `${n} maladie${n !== 1 ? "s" : ""} — ${m}`,
  es: (n, m) => `${n} enfermedad${n !== 1 ? "es" : ""} — ${m}`,
  ar: (n, m) => `${n} مرض — ${m}`,
  id: (n, m) => `${n} penyakit — ${m}`,
};

const ACTIVE_LABEL: Record<Locale, (n: number) => string> = {
  en: (n) => `${n} active outbreak${n > 1 ? "s" : ""}`,
  fr: (n) => `${n} foyer${n > 1 ? "s" : ""} actif${n > 1 ? "s" : ""}`,
  es: (n) => `${n} brote${n > 1 ? "s" : ""} activo${n > 1 ? "s" : ""}`,
  ar: (n) => `${n} تفشٍّ نشط`,
  id: (n) => `${n} wabah aktif`,
};

const NO_ACTIVE: Record<Locale, string> = {
  en: "No active outbreaks",
  fr: "Aucun foyer actif",
  es: "Sin brotes activos",
  ar: "لا تفشيات نشطة",
  id: "Tidak ada wabah aktif",
};

const CASES_LABEL: Record<Locale, string> = {
  en: "reported cases",
  fr: "cas signalés",
  es: "casos reportados",
  ar: "حالة مُبلَّغ عنها",
  id: "kasus dilaporkan",
};

function getLocaleName(d: DiseaseInfo, locale: Locale): string {
  if (locale === "fr") return d.name_fr;
  if (locale === "es") return d.name_es;
  if (locale === "ar") return d.name_ar;
  if (locale === "id") return d.name_id;
  return d.name_en;
}

export default function DiseasesGrid({
  locale,
  diseases,
  byDisease,
}: {
  locale: string;
  diseases: DiseaseInfo[];
  byDisease: Record<string, DiseaseStats>;
}) {
  const [selectedMode, setSelectedMode] = useState<TransmissionMode | "all">("all");
  const l: Locale = LOCALES.includes(locale as Locale) ? (locale as Locale) : "en";
  const ml = MODE_LABELS[l];
  const numLocale = l === "ar" ? "ar-SA" : l;

  // Transmission modes present in the dataset, sorted by disease count desc
  const modes = useMemo<TransmissionMode[]>(() => {
    const freq = new Map<TransmissionMode, number>();
    for (const d of diseases) {
      for (const m of d.transmission) {
        freq.set(m, (freq.get(m) ?? 0) + 1);
      }
    }
    return [...freq.entries()].sort((a, b) => b[1] - a[1]).map(([m]) => m);
  }, [diseases]);

  const filtered = useMemo(() => {
    if (selectedMode === "all") return diseases;
    return diseases.filter((d) => d.transmission.includes(selectedMode));
  }, [diseases, selectedMode]);

  return (
    <div className="space-y-4">
      {/* Transmission filter */}
      <div
        className="flex flex-wrap gap-2"
        role="group"
        aria-label={FILTER_TITLE[l]}
      >
        <button
          onClick={() => setSelectedMode("all")}
          className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
            selectedMode === "all"
              ? "bg-gray-700 border-gray-600 text-white font-semibold"
              : "border-gray-700 text-gray-500 hover:text-gray-300 hover:border-gray-600"
          }`}
        >
          {ml.all}
        </button>
        {modes.map((mode) => (
          <button
            key={mode}
            onClick={() => setSelectedMode(selectedMode === mode ? "all" : mode)}
            className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
              selectedMode === mode
                ? "bg-amber-900/40 border-amber-700 text-amber-400 font-semibold"
                : "border-gray-700 text-gray-500 hover:text-gray-300 hover:border-gray-600"
            }`}
          >
            {ml[mode]}
          </button>
        ))}
      </div>

      {/* Match count when a mode is selected */}
      {selectedMode !== "all" && (
        <p className="text-xs text-gray-500">
          {COUNT_LABEL[l](filtered.length, ml[selectedMode])}
        </p>
      )}

      {/* Disease cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {filtered.map((disease) => {
          const slug = diseaseToSlug(disease.name_en);
          const stats = byDisease[disease.name_en];
          const hasActive = (stats?.count ?? 0) > 0;
          const name = getLocaleName(disease, l);

          return (
            <Link
              key={slug}
              href={`/${l}/disease/${slug}`}
              className={`group relative flex flex-col gap-2 rounded-xl border p-4 transition-all hover:scale-[1.02] ${
                hasActive
                  ? "bg-red-950/20 border-red-800/40 hover:border-red-600/60"
                  : "bg-gray-900/50 border-gray-800 hover:border-gray-600"
              }`}
            >
              {hasActive && (
                <span className="absolute top-3 right-3 w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              )}
              <p
                className={`font-semibold leading-tight pr-4 ${
                  hasActive ? "text-white" : "text-gray-300 group-hover:text-white"
                } transition-colors`}
              >
                {name}
              </p>
              <p
                className={`text-xs font-medium ${
                  hasActive ? "text-red-400" : "text-gray-600"
                }`}
              >
                {hasActive ? ACTIVE_LABEL[l](stats!.count) : NO_ACTIVE[l]}
              </p>
              {hasActive && stats!.cases > 0 && (
                <p className="text-xs text-gray-500">
                  {stats!.cases.toLocaleString(numLocale)} {CASES_LABEL[l]}
                </p>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
