"use client";

import { useState } from "react";
import Link from "next/link";
import { Bell, Trash2, CheckCheck, ArrowLeft } from "lucide-react";

type Notif = {
  id: string;
  type: string;
  title: string;
  body: string;
  outbreak_id: string | null;
  read_at: string | null;
  created_at: string;
};

const LABELS: Record<string, {
  title: string;
  back: string;
  markAllRead: string;
  empty: string;
  emptyDesc: string;
  setupCta: string;
  proUpsell: string;
  proUpsellCta: string;
  types: Record<string, string>;
  justNow: string;
  ago: (h: number) => string;
}> = {
  fr: {
    title:        "Vos alertes",
    back:         "Tableau de bord",
    markAllRead:  "Tout marquer comme lu",
    empty:        "Aucune alerte pour l'instant.",
    emptyDesc:    "Configurez vos alertes régionales et maladies pour recevoir des notifications.",
    setupCta:     "Configurer mes alertes",
    proUpsell:    "Les alertes régionales et maladies sont disponibles sur le plan Pro.",
    proUpsellCta: "Commencer l'essai gratuit 14 jours",
    types: { tripwire: "Tripwire", category_alert: "Catégorie", subscriber: "Foyer suivi", watchlist: "Surveillance", disease_alert: "Alerte maladie" },
    justNow: "À l'instant",
    ago: (h) => h < 24 ? `Il y a ${h}h` : `Il y a ${Math.floor(h / 24)}j`,
  },
  en: {
    title:        "Your alerts",
    back:         "Dashboard",
    markAllRead:  "Mark all as read",
    empty:        "No alerts yet.",
    emptyDesc:    "Set up regional and disease alerts to receive notifications.",
    setupCta:     "Set up my alerts",
    proUpsell:    "Regional and disease alerts are available on the Pro plan.",
    proUpsellCta: "Start 14-day free trial",
    types: { tripwire: "Tripwire", category_alert: "Category", subscriber: "Subscribed outbreak", watchlist: "Watchlist", disease_alert: "Disease alert" },
    justNow: "Just now",
    ago: (h) => h < 24 ? `${h}h ago` : `${Math.floor(h / 24)}d ago`,
  },
  es: {
    title:        "Tus alertas",
    back:         "Panel",
    markAllRead:  "Marcar todo como leído",
    empty:        "Sin alertas por ahora.",
    emptyDesc:    "Configura alertas regionales y de enfermedades para recibir notificaciones.",
    setupCta:     "Configurar mis alertas",
    proUpsell:    "Las alertas regionales y de enfermedades están disponibles en el plan Pro.",
    proUpsellCta: "Iniciar prueba gratuita de 14 días",
    types: { tripwire: "Tripwire", category_alert: "Categoría", subscriber: "Brote suscrito", watchlist: "Vigilancia", disease_alert: "Alerta de enfermedad" },
    justNow: "Ahora mismo",
    ago: (h) => h < 24 ? `Hace ${h}h` : `Hace ${Math.floor(h / 24)}d`,
  },
  ar: {
    title:        "تنبيهاتك",
    back:         "لوحة التحكم",
    markAllRead:  "تحديد الكل كمقروء",
    empty:        "لا توجد تنبيهات حتى الآن.",
    emptyDesc:    "قم بإعداد التنبيهات الإقليمية والمرضية لتلقي الإشعارات.",
    setupCta:     "إعداد التنبيهات",
    proUpsell:    "التنبيهات الإقليمية والمرضية متاحة في خطة Pro.",
    proUpsellCta: "← ابدأ التجربة المجانية 14 يوماً",
    types: { tripwire: "Tripwire", category_alert: "تنبيه الفئة", subscriber: "تفشٍّ مشترك", watchlist: "قائمة المراقبة", disease_alert: "تنبيه مرضي" },
    justNow: "الآن",
    ago: (h) => h < 24 ? `منذ ${h}س` : `منذ ${Math.floor(h / 24)}ي`,
  },
  id: {
    title:        "Peringatan Anda",
    back:         "Dasbor",
    markAllRead:  "Tandai semua sebagai dibaca",
    empty:        "Belum ada peringatan.",
    emptyDesc:    "Siapkan peringatan regional dan penyakit untuk menerima notifikasi.",
    setupCta:     "Atur peringatan saya",
    proUpsell:    "Peringatan regional dan penyakit tersedia di paket Pro.",
    proUpsellCta: "Mulai uji coba gratis 14 hari",
    types: { tripwire: "Tripwire", category_alert: "Kategori", subscriber: "Wabah langganan", watchlist: "Daftar pantau", disease_alert: "Peringatan penyakit" },
    justNow: "Baru saja",
    ago: (h) => h < 24 ? `${h}j lalu` : `${Math.floor(h / 24)}h lalu`,
  },
};

const TYPE_DOT: Record<string, string> = {
  tripwire:       "bg-red-400",
  category_alert: "bg-amber-400",
  subscriber:     "bg-blue-400",
  watchlist:      "bg-purple-400",
  disease_alert:  "bg-teal-400",
};

function timeAgo(iso: string, locale: string): string {
  const lb = LABELS[locale] ?? LABELS.en;
  const h = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 3_600_000));
  return h === 0 ? lb.justNow : lb.ago(h);
}

export default function AlertsPageClient({
  locale,
  initialNotifications,
  isPaid,
}: {
  locale: string;
  initialNotifications: Notif[];
  isPaid?: boolean;
}) {
  const [notifications, setNotifications] = useState<Notif[]>(initialNotifications);
  const lb = LABELS[locale] ?? LABELS.en;
  const isRtl = locale === "ar";
  const unreadCount = notifications.filter((n) => !n.read_at).length;

  async function markAllRead() {
    await fetch("/api/notifications", { method: "PATCH" });
    const now = new Date().toISOString();
    setNotifications((prev) => prev.map((n) => ({ ...n, read_at: n.read_at ?? now })));
  }

  async function deleteOne(id: string) {
    await fetch(`/api/notifications?id=${id}`, { method: "DELETE" });
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8" dir={isRtl ? "rtl" : undefined}>
      <Link
        href={`/${locale}`}
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-300 transition-colors mb-6"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        {lb.back}
      </Link>

      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Bell className="w-5 h-5 text-red-400" />
          <h1 className="text-xl font-bold text-white">{lb.title}</h1>
          {unreadCount > 0 && (
            <span className="bg-red-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none">
              {unreadCount}
            </span>
          )}
        </div>
        {unreadCount > 0 && (
          <button
            onClick={markAllRead}
            className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-300 transition-colors"
          >
            <CheckCheck className="w-3.5 h-3.5" />
            {lb.markAllRead}
          </button>
        )}
      </div>

      {notifications.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-xl px-6 py-10 text-center space-y-2">
          <p className="text-sm text-gray-500">{lb.empty}</p>
          <p className="text-xs text-gray-600">{lb.emptyDesc}</p>
          {isPaid ? (
            <Link
              href={`/${locale}/account#regional-alerts`}
              className="inline-block mt-2 text-xs text-red-400 hover:text-red-300 transition-colors"
            >
              {lb.setupCta} →
            </Link>
          ) : (
            <div className="mt-3 space-y-1.5">
              <p className="text-xs text-gray-600">{lb.proUpsell}</p>
              <Link
                href={`/${locale}/pricing`}
                className="inline-block text-xs text-red-400 hover:text-red-300 transition-colors"
              >
                {lb.proUpsellCta} →
              </Link>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden divide-y divide-gray-800/60">
          {notifications.map((n) => {
            const rowCls = `flex items-start gap-3 px-5 py-3.5 transition-colors hover:bg-gray-800/30 pr-12 ${n.read_at ? "opacity-50" : ""}`;
            const content = (
              <>
                <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${TYPE_DOT[n.type] ?? "bg-gray-500"}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white leading-snug">{n.title}</p>
                  <p className="text-xs text-gray-500 leading-snug mt-0.5">{n.body}</p>
                  <p className="text-[10px] text-gray-700 mt-0.5">
                    {lb.types[n.type] ?? n.type} · {timeAgo(n.created_at, locale)}
                  </p>
                </div>
              </>
            );
            return (
              <div key={n.id} className="relative group">
                {n.outbreak_id
                  ? <Link href={`/${locale}?outbreak=${n.outbreak_id}`} className={rowCls}>{content}</Link>
                  : <div className={rowCls}>{content}</div>
                }
                <button
                  onClick={() => deleteOne(n.id)}
                  className="absolute top-3.5 right-4 text-gray-700 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                  aria-label="Delete"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
