import Link from "next/link";
import { Bell, ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase-server";
import { createClient as createService } from "@supabase/supabase-js";
import { getLocalizedDisease, getLocalizedCountry } from "@/lib/outbreaks";
import type { Outbreak } from "@/lib/outbreaks";

type AlertNotif = {
  id: string;
  type: string;
  title: string;
  body: string;
  read_at: string | null;
  created_at: string;
  outbreak_id: string | null;
};

type NotifOutbreak = Pick<
  Outbreak,
  "id" | "disease" | "disease_en" | "disease_ar" |
  "country" | "country_en" | "country_ar" | "risk_level"
> & { push_notified_at: string };

const LABELS: Record<string, {
  title: string; unread: string; empty: string; emptySetup: string;
  seeAll: string; justNow: string; ago: (h: number) => string;
  setupCta: string; types: Record<string, string>;
}> = {
  fr: {
    title: "Vos alertes récentes",
    unread: "non lue(s)",
    empty: "Aucune alerte déclenchée pour l'instant.",
    emptySetup: "Configurez vos alertes pour recevoir des notifications ciblées.",
    seeAll: "Voir toutes les alertes",
    justNow: "À l'instant",
    ago: (h) => h < 24 ? `Il y a ${h}h` : `Il y a ${Math.floor(h / 24)}j`,
    setupCta: "Configurer mes alertes →",
    types: { tripwire: "Tripwire", category_alert: "Catégorie", subscriber: "Foyer suivi", watchlist: "Surveillance", disease_alert: "Alerte maladie", pheic: "PHEIC", country_risk: "Risque pays", regional_digest: "Digest régional", geofence: "Zone géographique" },
  },
  en: {
    title: "Your recent alerts",
    unread: "unread",
    empty: "No alerts triggered yet.",
    emptySetup: "Set up your alerts to receive targeted notifications.",
    seeAll: "View all alerts",
    justNow: "Just now",
    ago: (h) => h < 24 ? `${h}h ago` : `${Math.floor(h / 24)}d ago`,
    setupCta: "Set up my alerts →",
    types: { tripwire: "Tripwire", category_alert: "Category", subscriber: "Subscribed outbreak", watchlist: "Watchlist", disease_alert: "Disease alert", pheic: "PHEIC", country_risk: "Country risk", regional_digest: "Regional digest", geofence: "Geofence" },
  },
  es: {
    title: "Tus alertas recientes",
    unread: "sin leer",
    empty: "Sin alertas activadas por ahora.",
    emptySetup: "Configura tus alertas para recibir notificaciones específicas.",
    seeAll: "Ver todas las alertas",
    justNow: "Ahora mismo",
    ago: (h) => h < 24 ? `Hace ${h}h` : `Hace ${Math.floor(h / 24)}d`,
    setupCta: "Configurar mis alertas →",
    types: { tripwire: "Tripwire", category_alert: "Categoría", subscriber: "Brote suscrito", watchlist: "Vigilancia", disease_alert: "Alerta de enfermedad", pheic: "PHEIC", country_risk: "Riesgo país", regional_digest: "Resumen regional", geofence: "Geovalla" },
  },
  ar: {
    title: "تنبيهاتك الأخيرة",
    unread: "غير مقروء",
    empty: "لا توجد تنبيهات حتى الآن.",
    emptySetup: "قم بإعداد تنبيهاتك للحصول على إشعارات مستهدفة.",
    seeAll: "← عرض جميع التنبيهات",
    justNow: "الآن",
    ago: (h) => h < 24 ? `منذ ${h}س` : `منذ ${Math.floor(h / 24)}ي`,
    setupCta: "← إعداد التنبيهات",
    types: { tripwire: "Tripwire", category_alert: "تنبيه الفئة", subscriber: "تفشٍّ مشترك", watchlist: "قائمة المراقبة", disease_alert: "تنبيه مرضي", pheic: "PHEIC", country_risk: "خطر البلد", regional_digest: "ملخص إقليمي", geofence: "منطقة جغرافية" },
  },
  id: {
    title: "Peringatan terbaru Anda",
    unread: "belum dibaca",
    empty: "Belum ada peringatan.",
    emptySetup: "Siapkan peringatan Anda untuk menerima notifikasi terarah.",
    seeAll: "Lihat semua peringatan",
    justNow: "Baru saja",
    ago: (h) => h < 24 ? `${h}j lalu` : `${Math.floor(h / 24)}h lalu`,
    setupCta: "Atur peringatan saya →",
    types: { tripwire: "Tripwire", category_alert: "Kategori", subscriber: "Wabah langganan", watchlist: "Daftar pantau", disease_alert: "Peringatan penyakit", pheic: "PHEIC", country_risk: "Risiko negara", regional_digest: "Digest regional", geofence: "Geofence" },
  },
};

const RISK_DOT: Record<string, string> = {
  high: "bg-red-500",
  medium: "bg-yellow-500",
  low: "bg-green-500",
};

const TYPE_DOT: Record<string, string> = {
  tripwire:        "bg-red-400",
  category_alert:  "bg-amber-400",
  subscriber:      "bg-blue-400",
  watchlist:       "bg-purple-400",
  disease_alert:   "bg-teal-400",
  pheic:           "bg-red-500",
  country_risk:    "bg-orange-400",
  regional_digest: "bg-indigo-400",
  geofence:        "bg-cyan-400",
};

function timeAgo(iso: string, locale: string): string {
  const lb = LABELS[locale] ?? LABELS.en;
  const h = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 3_600_000));
  return h === 0 ? lb.justNow : lb.ago(h);
}

export default async function DashboardAlertsWidget({
  locale,
  userId,
}: {
  locale: string;
  userId: string;
}) {
  const lb = LABELS[locale] ?? LABELS.en;
  const isRtl = locale === "ar";

  const supabase = await createClient();
  const svc = createService(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const [{ data: alertData }, { data: pushData }] = await Promise.all([
    supabase
      .from("alert_notifications")
      .select("id, type, title, body, read_at, created_at, outbreak_id")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(4),
    svc
      .from("outbreaks")
      .select("id, disease, disease_en, disease_ar, country, country_en, country_ar, risk_level, push_notified_at")
      .not("push_notified_at", "is", null)
      .order("push_notified_at", { ascending: false })
      .limit(3),
  ]);

  const alerts = (alertData ?? []) as AlertNotif[];
  const pushItems = (pushData ?? []) as NotifOutbreak[];
  const unreadCount = alerts.filter((a) => !a.read_at).length;
  const hasAny = alerts.length > 0 || pushItems.length > 0;

  return (
    <div
      dir={isRtl ? "rtl" : undefined}
      className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-800">
        <div className="flex items-center gap-2.5">
          <Bell className="w-4 h-4 text-red-400" />
          <span className="font-semibold text-white text-sm">{lb.title}</span>
          {unreadCount > 0 && (
            <span className="bg-red-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none">
              {unreadCount} {lb.unread}
            </span>
          )}
        </div>
        <Link
          href={`/${locale}/notifications`}
          className="flex items-center gap-1 text-xs text-gray-500 hover:text-red-400 transition-colors"
        >
          {lb.seeAll}
          <ArrowRight className="w-3 h-3" />
        </Link>
      </div>

      {!hasAny ? (
        <div className="px-5 py-6 text-center space-y-2">
          <p className="text-sm text-gray-500">{lb.empty}</p>
          <p className="text-xs text-gray-600">{lb.emptySetup}</p>
          <Link
            href={`/${locale}/settings?tab=alerts`}
            className="inline-block mt-1 text-xs text-red-400 hover:text-red-300 transition-colors"
          >
            {lb.setupCta}
          </Link>
        </div>
      ) : (
        <div className="divide-y divide-gray-800/60">
          {/* Alert notifications (tripwires, category alerts, disease alerts) */}
          {alerts.map((a) => {
            const cls = `flex items-start gap-3 px-5 py-3 transition-colors hover:bg-gray-800/30 ${a.read_at ? "opacity-50" : ""}`;
            const inner = (
              <>
                <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${TYPE_DOT[a.type] ?? "bg-gray-500"}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white leading-snug truncate">{a.title}</p>
                  <p className="text-xs text-gray-500 leading-snug mt-0.5 line-clamp-1">{a.body}</p>
                  <p className="text-[10px] text-gray-700 mt-0.5">
                    {lb.types[a.type] ?? a.type} · {timeAgo(a.created_at, locale)}
                  </p>
                </div>
              </>
            );
            return a.outbreak_id
              ? <Link key={a.id} href={`/${locale}?outbreak=${a.outbreak_id}`} className={cls}>{inner}</Link>
              : <div  key={a.id} className={cls}>{inner}</div>;
          })}

          {/* Push-notified outbreaks */}
          {pushItems.map((item) => (
            <Link
              key={item.id}
              href={`/${locale}?outbreak=${item.id}`}
              className="flex items-start gap-3 px-5 py-3 hover:bg-gray-800/30 transition-colors"
            >
              <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${RISK_DOT[item.risk_level] ?? "bg-gray-500"}`} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-white truncate">
                  {getLocalizedDisease(item, locale)} — {getLocalizedCountry(item, locale)}
                </p>
                <p className="text-[10px] text-gray-600 mt-0.5">
                  {timeAgo(item.push_notified_at, locale)}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
