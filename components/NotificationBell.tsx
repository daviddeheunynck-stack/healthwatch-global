"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Bell, Check, Loader2, X } from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase-browser";
import { getLocalizedDisease, getLocalizedCountry } from "@/lib/outbreaks";
import type { Outbreak } from "@/lib/outbreaks";

const STORAGE_KEY = "hwg_notif_seen";
const MAX_PUSH    = 5;

type NotifOutbreak = Pick<
  Outbreak,
  "id" | "disease" | "disease_en" | "disease_ar" |
  "country" | "country_en" | "country_ar" | "risk_level"
> & { push_notified_at: string };

interface AlertNotif {
  id: string;
  type: string;
  title: string;
  body: string;
  outbreak_id: string | null;
  read_at: string | null;
  created_at: string;
}

const RISK_DOT: Record<string, string> = {
  high:   "bg-red-500",
  medium: "bg-yellow-500",
  low:    "bg-green-500",
};

const TYPE_DOT: Record<string, string> = {
  tripwire:       "bg-red-400",
  category_alert: "bg-amber-400",
  subscriber:     "bg-blue-400",
  watchlist:      "bg-purple-400",
  disease_alert:  "bg-teal-400",
  pheic:          "bg-red-500",
  country_risk:   "bg-orange-400",
  regional_digest:"bg-indigo-400",
};

const LABELS: Record<string, {
  title: string; empty: string; seeAll: string; justNow: string; ago: (h: number) => string;
  markRead: string; alertHistory: string; pushAlerts: string;
  types: Record<string, string>;
}> = {
  fr: { title: "Alertes & notifications", empty: "Aucune alerte pour l'instant.", seeAll: "Voir toutes les alertes →", justNow: "À l'instant", ago: (h) => h < 24 ? `Il y a ${h}h` : `Il y a ${Math.floor(h / 24)}j`, markRead: "Tout marquer lu", alertHistory: "Historique d'alertes", pushAlerts: "Notifications récentes",
    types: { tripwire: "Tripwire", category_alert: "Catégorie", subscriber: "Foyer suivi", watchlist: "Surveillance", disease_alert: "Alerte maladie", pheic: "PHEIC", country_risk: "Risque pays", regional_digest: "Digest régional" } },
  en: { title: "Alerts & notifications", empty: "No alerts yet.", seeAll: "View all alerts →", justNow: "Just now", ago: (h) => h < 24 ? `${h}h ago` : `${Math.floor(h / 24)}d ago`, markRead: "Mark all read", alertHistory: "Alert history", pushAlerts: "Recent notifications",
    types: { tripwire: "Tripwire", category_alert: "Category alert", subscriber: "Subscribed outbreak", watchlist: "Watchlist", disease_alert: "Disease alert", pheic: "PHEIC", country_risk: "Country risk", regional_digest: "Regional digest" } },
  es: { title: "Alertas y notificaciones", empty: "Sin alertas por ahora.", seeAll: "Ver todas las alertas →", justNow: "Ahora mismo", ago: (h) => h < 24 ? `Hace ${h}h` : `Hace ${Math.floor(h / 24)}d`, markRead: "Marcar todo como leído", alertHistory: "Historial de alertas", pushAlerts: "Notificaciones recientes",
    types: { tripwire: "Tripwire", category_alert: "Alerta categoría", subscriber: "Brote suscrito", watchlist: "Vigilancia", disease_alert: "Alerta enfermedad", pheic: "PHEIC", country_risk: "Riesgo país", regional_digest: "Resumen regional" } },
  ar: { title: "التنبيهات والإشعارات", empty: "لا توجد تنبيهات حتى الآن.", seeAll: "← عرض جميع التنبيهات", justNow: "الآن", ago: (h) => h < 24 ? `منذ ${h}س` : `منذ ${Math.floor(h / 24)}ي`, markRead: "تحديد الكل كمقروء", alertHistory: "سجل التنبيهات", pushAlerts: "الإشعارات الأخيرة",
    types: { tripwire: "Tripwire", category_alert: "تنبيه الفئة", subscriber: "تفشٍّ مشترك", watchlist: "قائمة المراقبة", disease_alert: "تنبيه مرضي", pheic: "PHEIC", country_risk: "خطر البلد", regional_digest: "ملخص إقليمي" } },
  id: { title: "Peringatan & notifikasi", empty: "Belum ada peringatan.", seeAll: "Lihat semua peringatan →", justNow: "Baru saja", ago: (h) => h < 24 ? `${h}j lalu` : `${Math.floor(h / 24)}h lalu`, markRead: "Tandai semua terbaca", alertHistory: "Riwayat peringatan", pushAlerts: "Notifikasi terbaru",
    types: { tripwire: "Tripwire", category_alert: "Peringatan kategori", subscriber: "Wabah langganan", watchlist: "Daftar pantau", disease_alert: "Peringatan penyakit", pheic: "PHEIC", country_risk: "Risiko negara", regional_digest: "Digest regional" } },
};

function timeAgo(isoString: string, locale: string): string {
  const lb = LABELS[locale] ?? LABELS.en;
  const diffMs = Date.now() - new Date(isoString).getTime();
  const diffH  = Math.max(0, Math.floor(diffMs / 3_600_000));
  return diffH === 0 ? lb.justNow : lb.ago(diffH);
}

export default function NotificationBell({ locale, dropUp = false }: { locale: string; dropUp?: boolean }) {
  const lb    = LABELS[locale] ?? LABELS.en;
  const isRtl = locale === "ar";

  const [open,         setOpen]         = useState(false);
  const [pushItems,    setPushItems]    = useState<NotifOutbreak[]>([]);
  const [alertItems,   setAlertItems]   = useState<AlertNotif[]>([]);
  const [newCount,     setNewCount]     = useState(0);
  const [alertUnread,  setAlertUnread]  = useState(0);
  const [loading,      setLoading]      = useState(true);
  const [marking,      setMarking]      = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Fetch both sources in parallel
  useEffect(() => {
    const supabase = createClient();

    Promise.all([
      supabase
        .from("outbreaks")
        .select("id, disease, disease_en, disease_ar, country, country_en, country_ar, risk_level, push_notified_at")
        .not("push_notified_at", "is", null)
        .order("push_notified_at", { ascending: false })
        .limit(MAX_PUSH),
      fetch("/api/notifications").then((r) => r.json()).catch(() => ({ notifications: [] })),
    ]).then(([{ data: pushData }, alertData]) => {
      const rows = (pushData ?? []) as NotifOutbreak[];
      setPushItems(rows);

      const lastSeen   = localStorage.getItem(STORAGE_KEY);
      const lastSeenMs = lastSeen ? new Date(lastSeen).getTime() : 0;
      setNewCount(rows.filter((r) => new Date(r.push_notified_at).getTime() > lastSeenMs).length);

      const alerts = (alertData.notifications ?? []) as AlertNotif[];
      setAlertItems(alerts);
      setAlertUnread(alerts.filter((a) => !a.read_at).length);
      setLoading(false);
    });
  }, []);

  const totalBadge = newCount + alertUnread;

  const handleOpen = useCallback(() => {
    setOpen((prev) => {
      if (!prev) {
        localStorage.setItem(STORAGE_KEY, new Date().toISOString());
        setNewCount(0);
      }
      return !prev;
    });
  }, []);

  async function markAllRead() {
    setMarking(true);
    await fetch("/api/notifications", { method: "PATCH" }).catch(() => {});
    setAlertItems((prev) => prev.map((a) => ({ ...a, read_at: a.read_at ?? new Date().toISOString() })));
    setAlertUnread(0);
    setMarking(false);
  }

  async function dismissAlert(id: string) {
    await fetch(`/api/notifications?id=${id}`, { method: "DELETE" }).catch(() => {});
    setAlertItems((prev) => prev.filter((a) => a.id !== id));
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={handleOpen}
        className="relative p-1.5 text-gray-400 hover:text-white transition-colors rounded-md hover:bg-gray-800"
        aria-label="Notifications"
      >
        <Bell className="w-4 h-4" />
        {totalBadge > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-0.5 flex items-center justify-center rounded-full bg-red-600 text-white text-[10px] font-bold leading-none">
            {totalBadge > 9 ? "9+" : totalBadge}
          </span>
        )}
      </button>

      {open && (
        <div
          className={`absolute ${isRtl ? "left-0" : "right-0"} ${dropUp ? "bottom-full mb-2" : "top-full mt-2"} w-80 bg-gray-900 border border-gray-700 rounded-xl shadow-xl z-50 overflow-hidden`}
          dir={isRtl ? "rtl" : undefined}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
            <span className="text-sm font-semibold text-white">{lb.title}</span>
            {alertUnread > 0 && (
              <button
                onClick={markAllRead}
                disabled={marking}
                className="flex items-center gap-1 text-[10px] text-gray-500 hover:text-green-400 transition-colors disabled:opacity-40"
              >
                {marking ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                {lb.markRead}
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {loading && (
              <div className="px-4 py-6 text-center text-xs text-gray-500 animate-pulse">…</div>
            )}

            {/* ── Alert history (tripwires, category alerts) ── */}
            {!loading && alertItems.length > 0 && (
              <>
                <p className="px-4 pt-3 pb-1 text-[10px] font-semibold text-gray-600 uppercase tracking-wide">{lb.alertHistory}</p>
                {alertItems.map((a) => (
                  <div
                    key={a.id}
                    className={`flex items-start gap-2.5 px-4 py-2.5 border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors ${a.read_at ? "opacity-50" : ""}`}
                  >
                    <span className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${TYPE_DOT[a.type] ?? "bg-gray-500"}`} />
                    <div className="flex-1 min-w-0 space-y-0.5">
                      <p className="text-xs font-medium text-white leading-snug">{a.title}</p>
                      <p className="text-[10px] text-gray-500 leading-snug">{a.body}</p>
                      <p className="text-[9px] text-gray-700">{lb.types[a.type] ?? a.type} · {timeAgo(a.created_at, locale)}</p>
                    </div>
                    <button onClick={() => dismissAlert(a.id)} className="shrink-0 text-gray-700 hover:text-gray-400 mt-0.5 transition-colors">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </>
            )}

            {/* ── Push-notified outbreaks ── */}
            {!loading && pushItems.length > 0 && (
              <>
                <p className="px-4 pt-3 pb-1 text-[10px] font-semibold text-gray-600 uppercase tracking-wide">{lb.pushAlerts}</p>
                {pushItems.map((item) => {
                  const disease = getLocalizedDisease(item, locale);
                  const country = getLocalizedCountry(item, locale);
                  return (
                    <Link
                      key={item.id}
                      href={`/${locale}/outbreak/${item.id}`}
                      onClick={() => setOpen(false)}
                      className="flex items-start gap-3 px-4 py-2.5 hover:bg-gray-800/60 transition-colors border-b border-gray-800/50 last:border-0"
                    >
                      <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${RISK_DOT[item.risk_level] ?? "bg-gray-500"}`} />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium text-white truncate">{disease}</p>
                        <p className="text-[10px] text-gray-400 truncate">{country}</p>
                        <p className="text-[10px] text-gray-600 mt-0.5">{timeAgo(item.push_notified_at, locale)}</p>
                      </div>
                    </Link>
                  );
                })}
              </>
            )}

            {!loading && alertItems.length === 0 && pushItems.length === 0 && (
              <p className="px-4 py-6 text-center text-xs text-gray-500">{lb.empty}</p>
            )}
          </div>

          {pushItems.length > 0 && (
            <div className="border-t border-gray-800 px-4 py-2.5">
              <Link href={`/${locale}/notifications`} onClick={() => setOpen(false)} className="text-xs text-red-400 hover:text-red-300 transition-colors">
                {lb.seeAll}
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
