"use client";

import { useState, useEffect } from "react";
import { Database, RefreshCw } from "lucide-react";

interface SourceStatus {
  name: string;
  last_synced_at: string;
  count: number;
}

const COPY: Record<string, { title: string; outbreaks: string; ago: string; never: string; refresh: string; checked: string }> = {
  fr: { title: "Statut des sources", outbreaks: "foyer(s)", ago: "il y a", never: "Jamais", refresh: "Rafraîchir", checked: "Vérifié" },
  en: { title: "Data source status", outbreaks: "outbreak(s)", ago: "ago", never: "Never", refresh: "Refresh", checked: "Checked" },
  es: { title: "Estado de fuentes", outbreaks: "brote(s)", ago: "hace", never: "Nunca", refresh: "Actualizar", checked: "Verificado" },
  ar: { title: "حالة المصادر", outbreaks: "تفشٍّ", ago: "منذ", never: "أبدًا", refresh: "تحديث", checked: "تم التحقق" },
  id: { title: "Status sumber data", outbreaks: "wabah", ago: "yang lalu", never: "Tidak pernah", refresh: "Perbarui", checked: "Diperiksa" },
};

function timeAgo(iso: string, locale: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  const h = Math.floor(diff / 3600000);
  const d = Math.floor(diff / 86400000);
  if (m < 2)  return ({ fr: "à l'instant", es: "ahora", ar: "الآن", id: "baru saja", en: "just now" } as Record<string, string>)[locale] ?? "just now";
  if (h < 1)  return `${m}m`;
  if (d < 1)  return `${h}h`;
  return `${d}d`;
}

function freshnessColor(iso: string): string {
  const h = (Date.now() - new Date(iso).getTime()) / 3600000;
  if (h < 2)  return "bg-green-500";
  if (h < 24) return "bg-amber-500";
  return "bg-red-500";
}

export default function DataStatusWidget({ locale }: { locale: string }) {
  const c = COPY[locale] ?? COPY.en;
  const [sources,  setSources]  = useState<SourceStatus[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [checkedAt, setCheckedAt] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res  = await fetch("/api/data-status");
      const data = await res.json() as { sources: SourceStatus[]; checked_at: string };
      setSources(data.sources ?? []);
      setCheckedAt(data.checked_at ?? null);
    } catch { /* ignore */ } finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  return (
    <div className="rounded-xl border border-gray-700/50 bg-gray-900/60 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Database className="w-4 h-4 text-gray-500" />
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{c.title}</p>
        </div>
        <button onClick={load} disabled={loading}
          className="p-1 text-gray-600 hover:text-gray-300 transition-colors disabled:opacity-40">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {loading && !sources.length ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => <div key={i} className="h-4 bg-gray-800 rounded animate-pulse" />)}
        </div>
      ) : (
        <div className="space-y-2">
          {sources.map((s) => (
            <div key={s.name} className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <span className={`w-2 h-2 rounded-full shrink-0 ${freshnessColor(s.last_synced_at)}`} />
                <span className="text-xs text-gray-300 font-medium">{s.name}</span>
                <span className="text-[10px] text-gray-600">{s.count} {c.outbreaks}</span>
              </div>
              <span className="text-[10px] text-gray-500 shrink-0 tabular-nums">
                {timeAgo(s.last_synced_at, locale)} {c.ago}
              </span>
            </div>
          ))}
        </div>
      )}

      {checkedAt && (
        <p className="text-[10px] text-gray-700">
          {c.checked}: {new Date(checkedAt).toLocaleTimeString(locale)}
        </p>
      )}
    </div>
  );
}
