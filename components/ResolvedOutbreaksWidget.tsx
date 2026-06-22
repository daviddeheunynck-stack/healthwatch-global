"use client";

import { useState, useEffect, useCallback } from "react";
import { CheckCircle, ChevronDown, ChevronUp, Loader2 } from "lucide-react";

interface Resolved {
  id: string;
  disease_en: string | null;
  country_en: string | null;
  risk_level: string | null;
  date: string;
  updated_at: string | null;
  region: string | null;
  cases: number;
}

const COPY: Record<string, {
  title: string; subtitle: string;
  noData: string; daysAgo: string; planError: string;
}> = {
  fr: {
    title: "Foyers récemment résolus",
    subtitle: "Signal de levée — foyers inactifs des 30 derniers jours.",
    noData: "Aucun foyer résolu récemment.",
    daysAgo: "il y a",
    planError: "Requiert un plan Pro ou supérieur.",
  },
  en: {
    title: "Recently resolved outbreaks",
    subtitle: "Clearance signal — outbreaks closed in the last 30 days.",
    noData: "No recently resolved outbreaks.",
    daysAgo: "ago",
    planError: "Requires a Pro plan or higher.",
  },
  es: {
    title: "Brotes resueltos recientemente",
    subtitle: "Señal de despeje — brotes cerrados en los últimos 30 días.",
    noData: "No hay brotes resueltos recientemente.",
    daysAgo: "hace",
    planError: "Requiere un plan Pro o superior.",
  },
  ar: {
    title: "التفشيات المحلولة مؤخراً",
    subtitle: "إشارة التخليص — التفشيات المغلقة في آخر 30 يوماً.",
    noData: "لا توجد تفشيات محلولة مؤخراً.",
    daysAgo: "منذ",
    planError: "يتطلب خطة Pro أو أعلى.",
  },
  id: {
    title: "Wabah yang baru selesai",
    subtitle: "Sinyal pembebasan — wabah yang ditutup dalam 30 hari terakhir.",
    noData: "Tidak ada wabah yang baru selesai.",
    daysAgo: "lalu",
    planError: "Memerlukan paket Pro atau lebih tinggi.",
  },
};

const RISK_STYLE: Record<string, string> = {
  high:   "text-red-400",
  medium: "text-amber-400",
  low:    "text-green-400",
};

function daysAgoStr(iso: string, label: string): string {
  const d = Math.round((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (d === 0) return "today";
  return `${d}d ${label}`;
}

export default function ResolvedOutbreaksWidget({ locale }: { locale: string }) {
  const c = COPY[locale] ?? COPY.en;
  const [open,      setOpen]      = useState(false);
  const [resolved,  setResolved]  = useState<Resolved[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [planError, setPlanError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await fetch("/api/outbreaks/resolved");
      if (res.status === 403) { setPlanError(true); return; }
      const data = await res.json() as { resolved: Resolved[] };
      setResolved(data.resolved ?? []);
    } catch { /* ignore */ } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900/40 overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-gray-800/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-gray-500" />
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{c.title}</span>
          {resolved.length > 0 && (
            <span className="text-[10px] text-green-700">({resolved.length})</span>
          )}
        </div>
        {open
          ? <ChevronUp className="w-3.5 h-3.5 text-gray-600 shrink-0" />
          : <ChevronDown className="w-3.5 h-3.5 text-gray-600 shrink-0" />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-2">
          <p className="text-[11px] text-gray-600">{c.subtitle}</p>

          {planError && (
            <p className="text-[11px] text-amber-500 bg-amber-900/10 border border-amber-700/30 rounded px-3 py-2">
              {c.planError}
            </p>
          )}

          {!planError && loading && (
            <div className="flex items-center gap-2 py-3">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-gray-600" />
            </div>
          )}

          {!planError && !loading && resolved.length === 0 && (
            <p className="text-[11px] text-gray-600 italic">{c.noData}</p>
          )}

          {!planError && !loading && resolved.length > 0 && (
            <div className="space-y-0.5">
              {resolved.map((r) => (
                <div
                  key={r.id}
                  className="flex items-center justify-between gap-2 py-1.5 border-b border-gray-800/60 last:border-0"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <CheckCircle className="w-3 h-3 text-green-800 shrink-0" />
                    <span className="text-[11px] font-semibold text-gray-400 truncate">{r.disease_en}</span>
                    <span className="text-[10px] text-gray-600">— {r.country_en}</span>
                    <span className={`text-[9px] font-bold uppercase shrink-0 ${RISK_STYLE[r.risk_level ?? ""] ?? "text-gray-500"}`}>
                      {r.risk_level}
                    </span>
                  </div>
                  <span className="text-[9px] text-gray-700 shrink-0 whitespace-nowrap">
                    {r.updated_at ? daysAgoStr(r.updated_at, c.daysAgo) : ""}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
