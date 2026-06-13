"use client";
import { useState } from "react";
import OutbreakDetailModal from "@/components/OutbreakDetailModal";
import type { Outbreak } from "@/lib/outbreaks";

const base: Partial<Outbreak> = {
  cases: 5353, deaths: 78, risk_level: "high", date: "2025-12-28",
  region: "americas", active: true, is_pheic: false,
  disease_en: "Cholera", country_en: "Haiti",
  disease: "Choléra", country: "Haïti",
};

const VERIFIED: Outbreak = {
  ...base as Outbreak,
  id: "v1", disease_en: "Ebola", disease: "Ébola", country_en: "DR Congo", country: "RDC",
  cases: 515, deaths: 91,
  source: "https://www.who.int/emergencies/disease-outbreak-news/item/2026-DON606",
};

const UNVERIFIED_REAL_URL: Outbreak = {
  ...base as Outbreak,
  id: "u1",
  source: "https://cdn.who.int/media/docs/default-source/documents/emergencies/situation-reports/20260127_multi-country_outbreak-of-cholera_epidemiological_update_33.pdf",
};

const UNVERIFIED_FAKE_URL: Outbreak = {
  ...base as Outbreak,
  id: "u2", disease_en: "Dengue Fever", disease: "Dengue", country_en: "Côte d'Ivoire", country: "Côte d'Ivoire",
  cases: 39, deaths: 0,
  source: "https://www.who.int/emergencies/disease-outbreak-news/item/dengue-cotedivoire-2024",
};

export default function QASourceCheckUI() {
  const [open, setOpen] = useState<Outbreak | null>(null);
  return (
    <div className="p-8 bg-gray-950 min-h-screen text-white space-y-4">
      <h1 className="text-xl font-bold mb-6">QA — Source display in modal</h1>
      {[
        { label: "✅ VÉRIFIÉ (DON606) — doit afficher 'Bulletin OMS original' en rouge", o: VERIFIED },
        { label: "⚠️ NON VÉRIFIÉ + vraie URL (sitrep PDF) — doit afficher 'Source officielle' en gris", o: UNVERIFIED_REAL_URL },
        { label: "⚠️ NON VÉRIFIÉ + fausse URL seed — ne doit PAS afficher de lien source", o: UNVERIFIED_FAKE_URL },
      ].map(({ label, o }) => (
        <div key={o.id} className="space-y-1">
          <p className="text-xs text-gray-400">{label}</p>
          <button
            onClick={() => setOpen(o)}
            className="px-4 py-2 rounded bg-gray-800 hover:bg-gray-700 text-sm"
          >
            Ouvrir modal — {o.disease_en} / {o.country_en}
          </button>
        </div>
      ))}
      {open && (
        <OutbreakDetailModal
          outbreak={open}
          locale="fr"
          isPaid={true}
          onClose={() => setOpen(null)}
        />
      )}
    </div>
  );
}
