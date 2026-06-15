"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Bell } from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase-browser";
import { getLocalizedDisease, getLocalizedCountry } from "@/lib/outbreaks";
import type { Outbreak } from "@/lib/outbreaks";

const STORAGE_KEY = "hwg_notif_seen";
const MAX_ITEMS = 10;

type NotifOutbreak = Pick<
  Outbreak,
  "id" | "disease" | "disease_en" | "disease_ar" |
  "country" | "country_en" | "country_ar" | "risk_level"
> & { push_notified_at: string };

const RISK_DOT: Record<string, string> = {
  high:   "bg-red-500",
  medium: "bg-yellow-500",
  low:    "bg-green-500",
};

const LABELS: Record<string, { title: string; empty: string; seeAll: string; justNow: string; ago: (h: number) => string }> = {
  fr: { title: "Alertes récentes", empty: "Aucune alerte pour l'instant.", seeAll: "Voir toutes les alertes →", justNow: "À l'instant", ago: (h) => h < 24 ? `Il y a ${h}h` : `Il y a ${Math.floor(h / 24)}j` },
  en: { title: "Recent alerts",    empty: "No alerts yet.",               seeAll: "View all alerts →",         justNow: "Just now",      ago: (h) => h < 24 ? `${h}h ago` : `${Math.floor(h / 24)}d ago` },
  es: { title: "Alertas recientes",empty: "Sin alertas por ahora.",       seeAll: "Ver todas las alertas →",   justNow: "Ahora mismo",   ago: (h) => h < 24 ? `Hace ${h}h` : `Hace ${Math.floor(h / 24)}d` },
  ar: { title: "التنبيهات الأخيرة", empty: "لا توجد تنبيهات حتى الآن.", seeAll: "← عرض جميع التنبيهات",    justNow: "الآن",          ago: (h) => h < 24 ? `منذ ${h}س` : `منذ ${Math.floor(h / 24)}ي` },
  id: { title: "Peringatan terbaru",empty: "Belum ada peringatan.",       seeAll: "Lihat semua peringatan →", justNow: "Baru saja",     ago: (h) => h < 24 ? `${h}j lalu` : `${Math.floor(h / 24)}h lalu` },
};

function timeAgo(isoString: string, locale: string): string {
  const lb = LABELS[locale] ?? LABELS.en;
  const diffMs = Date.now() - new Date(isoString).getTime();
  const diffH  = Math.max(0, Math.floor(diffMs / 3_600_000));
  return diffH === 0 ? lb.justNow : lb.ago(diffH);
}

interface Props {
  locale: string;
}

export default function NotificationBell({ locale }: Props) {
  const lb = LABELS[locale] ?? LABELS.en;
  const isRtl = locale === "ar";

  const [open,    setOpen]    = useState(false);
  const [items,   setItems]   = useState<NotifOutbreak[]>([]);
  const [newCount, setNewCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Fetch recent push-notified outbreaks
  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("outbreaks")
      .select("id, disease, disease_en, disease_ar, country, country_en, country_ar, risk_level, push_notified_at")
      .not("push_notified_at", "is", null)
      .order("push_notified_at", { ascending: false })
      .limit(MAX_ITEMS)
      .then(({ data }) => {
        const rows = (data ?? []) as NotifOutbreak[];
        setItems(rows);

        // Count items newer than last-seen timestamp
        const lastSeen = localStorage.getItem(STORAGE_KEY);
        const lastSeenMs = lastSeen ? new Date(lastSeen).getTime() : 0;
        const fresh = rows.filter(
          (r) => new Date(r.push_notified_at).getTime() > lastSeenMs
        ).length;
        setNewCount(fresh);
        setLoading(false);
      });
  }, []);

  const handleOpen = useCallback(() => {
    setOpen((prev) => {
      if (!prev) {
        // Mark as seen
        localStorage.setItem(STORAGE_KEY, new Date().toISOString());
        setNewCount(0);
      }
      return !prev;
    });
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={handleOpen}
        className="relative p-1.5 text-gray-400 hover:text-white transition-colors rounded-md hover:bg-gray-800"
        aria-label="Notifications"
      >
        <Bell className="w-4 h-4" />
        {newCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-0.5 flex items-center justify-center rounded-full bg-red-600 text-white text-[10px] font-bold leading-none">
            {newCount > 9 ? "9+" : newCount}
          </span>
        )}
      </button>

      {open && (
        <div
          className={`absolute ${isRtl ? "left-0" : "right-0"} top-full mt-2 w-80 bg-gray-900 border border-gray-700 rounded-xl shadow-xl z-50 overflow-hidden`}
          dir={isRtl ? "rtl" : undefined}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
            <span className="text-sm font-semibold text-white">{lb.title}</span>
            {newCount === 0 && !loading && (
              <span className="text-xs text-green-400">✓</span>
            )}
          </div>

          {/* List */}
          <div className="max-h-80 overflow-y-auto">
            {loading && (
              <div className="px-4 py-6 text-center text-xs text-gray-500 animate-pulse">…</div>
            )}
            {!loading && items.length === 0 && (
              <p className="px-4 py-6 text-center text-xs text-gray-500">{lb.empty}</p>
            )}
            {!loading && items.map((item) => {
              const disease = getLocalizedDisease(item, locale);
              const country = getLocalizedCountry(item, locale);
              return (
                <Link
                  key={item.id}
                  href={`/${locale}/outbreak/${item.id}`}
                  onClick={() => setOpen(false)}
                  className="flex items-start gap-3 px-4 py-3 hover:bg-gray-800/60 transition-colors border-b border-gray-800/50 last:border-0"
                >
                  <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${RISK_DOT[item.risk_level] ?? "bg-gray-500"}`} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-white truncate">{disease}</p>
                    <p className="text-xs text-gray-400 truncate">{country}</p>
                    <p className="text-xs text-gray-600 mt-0.5">{timeAgo(item.push_notified_at, locale)}</p>
                  </div>
                </Link>
              );
            })}
          </div>

          {/* Footer */}
          {items.length > 0 && (
            <div className="border-t border-gray-800 px-4 py-2.5">
              <Link
                href={`/${locale}/alerts`}
                onClick={() => setOpen(false)}
                className="text-xs text-red-400 hover:text-red-300 transition-colors"
              >
                {lb.seeAll}
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
