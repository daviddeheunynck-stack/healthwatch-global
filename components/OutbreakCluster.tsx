"use client";

import { useState, useEffect } from "react";
import { Loader2, Link2, ExternalLink } from "lucide-react";
import Link from "next/link";
import RiskBadge from "@/components/RiskBadge";

interface ClusterOutbreak {
  id: string;
  disease: string;
  disease_en: string | null;
  country: string;
  country_en: string | null;
  risk_level: string;
  cases: number;
  date: string;
}

const COPY: Record<string, { title: string; empty: string }> = {
  fr: { title: "Événement multi-pays", empty: "Aucun autre foyer lié" },
  en: { title: "Multi-country event",  empty: "No other linked outbreaks" },
  es: { title: "Evento multinacional", empty: "Sin brotes vinculados" },
  ar: { title: "حدث متعدد الدول",     empty: "لا توجد تفشيات مرتبطة" },
  id: { title: "Kejadian multi-negara", empty: "Tidak ada wabah terkait" },
};

interface Props { eventId: string; excludeId: string; locale: string; }

export default function OutbreakCluster({ eventId, excludeId, locale }: Props) {
  const c = COPY[locale] ?? COPY.en;
  const [items,   setItems]   = useState<ClusterOutbreak[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/outbreak-cluster?event_id=${eventId}&exclude=${excludeId}`)
      .then((r) => r.json())
      .then((d) => { if (d.outbreaks) setItems(d.outbreaks); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [eventId, excludeId]);

  return (
    <div className="px-5 pb-4">
      <div className="flex items-center gap-2 mb-2">
        <Link2 className="w-3.5 h-3.5 text-blue-500 shrink-0" />
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{c.title}</p>
      </div>

      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin text-gray-600" />
      ) : items.length === 0 ? (
        <p className="text-xs text-gray-600 italic">{c.empty}</p>
      ) : (
        <div className="space-y-1.5">
          {items.map((o) => (
            <Link
              key={o.id}
              href={`/${locale}/outbreak/${o.id}`}
              target="_blank"
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-2 rounded-xl px-3 py-2 border border-gray-800 hover:border-gray-600 transition-colors group"
            >
              <RiskBadge level={o.risk_level as "high" | "medium" | "low"} />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-gray-300 group-hover:text-white transition-colors truncate">
                  {o.disease_en || o.disease}
                </p>
                <p className="text-[10px] text-gray-600 truncate">{o.country_en || o.country}</p>
              </div>
              {o.cases > 0 && (
                <span className="text-[10px] text-gray-600 shrink-0">{o.cases.toLocaleString(locale)}</span>
              )}
              <ExternalLink className="w-3 h-3 text-gray-700 group-hover:text-gray-400 transition-colors shrink-0" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
