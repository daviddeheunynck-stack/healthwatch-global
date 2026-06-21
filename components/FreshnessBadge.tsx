"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Clock } from "lucide-react";

// ─── Multilingual labels ──────────────────────────────────────────────────────

const LABELS: Record<string, {
  justNow: string;
  hoursAgo: (n: number) => string;
  dayAgo: string;
  daysAgo: (n: number) => string;
  stale: string;
}> = {
  fr: {
    justNow:  "À l'instant",
    hoursAgo: (n) => `Mis à jour il y a ${n}h`,
    dayAgo:   "Mis à jour il y a 1 jour",
    daysAgo:  (n) => `Mis à jour il y a ${n} jours`,
    stale:    "Données anciennes",
  },
  en: {
    justNow:  "Just updated",
    hoursAgo: (n) => `Updated ${n}h ago`,
    dayAgo:   "Updated 1 day ago",
    daysAgo:  (n) => `Updated ${n} days ago`,
    stale:    "Data may be outdated",
  },
  es: {
    justNow:  "Actualizado ahora",
    hoursAgo: (n) => `Actualizado hace ${n}h`,
    dayAgo:   "Actualizado hace 1 día",
    daysAgo:  (n) => `Actualizado hace ${n} días`,
    stale:    "Datos pueden estar desactualizados",
  },
  ar: {
    justNow:  "تحديث للتو",
    hoursAgo: (n) => `تحديث منذ ${n} ساعة`,
    dayAgo:   "تحديث منذ يوم",
    daysAgo:  (n) => `تحديث منذ ${n} أيام`,
    stale:    "قد تكون البيانات قديمة",
  },
  id: {
    justNow:  "Baru diperbarui",
    hoursAgo: (n) => `Diperbarui ${n} jam lalu`,
    dayAgo:   "Diperbarui 1 hari lalu",
    daysAgo:  (n) => `Diperbarui ${n} hari lalu`,
    stale:    "Data mungkin usang",
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getStatus(diffMs: number): "fresh" | "ok" | "stale" {
  if (diffMs < 2 * 3600_000)  return "fresh";
  if (diffMs < 24 * 3600_000) return "ok";
  return "stale";
}

function getLabel(diffMs: number, locale: string): string {
  const l = LABELS[locale] ?? LABELS.en;
  const hours = Math.floor(diffMs / 3600_000);
  const days  = Math.floor(diffMs / 86400_000);

  if (diffMs < 60_000)          return l.justNow;
  if (diffMs < 24 * 3600_000)   return l.hoursAgo(Math.max(1, hours));
  if (days === 1)                return l.dayAgo;
  if (days < 7)                  return l.daysAgo(days);
  return l.stale;
}

const STATUS_STYLES = {
  fresh: { dot: "bg-green-400", text: "text-green-400", border: "border-green-500/20", bg: "bg-green-500/8" },
  ok:    { dot: "bg-yellow-400", text: "text-yellow-400", border: "border-yellow-500/20", bg: "bg-yellow-500/8" },
  stale: { dot: "bg-gray-500", text: "text-gray-500", border: "border-gray-700", bg: "bg-gray-800/40" },
} as const;

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  /** ISO timestamp from the server (updated_at of the most recent outbreak row) */
  lastSync: string | null;
  locale: string;
}

export default function FreshnessBadge({ lastSync, locale }: Props) {
  const [label, setLabel] = useState<string | null>(null);
  const [status, setStatus] = useState<"fresh" | "ok" | "stale">("fresh");

  useEffect(() => {
    if (!lastSync) return;

    const update = () => {
      const diffMs = Date.now() - new Date(lastSync).getTime();
      setLabel(getLabel(diffMs, locale));
      setStatus(getStatus(diffMs));
    };

    update();
    // Refresh every minute so the label stays current without a full page reload
    const id = setInterval(update, 60_000);
    return () => clearInterval(id);
  }, [lastSync, locale]);

  if (!lastSync || label === null) return null;

  const s = STATUS_STYLES[status];

  return (
    <Link
      href={`/${locale}/methodology`}
      className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border ${s.border} ${s.bg} hover:brightness-125 transition-all`}
      title="Data sources &amp; methodology"
    >
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot} ${status === "fresh" ? "animate-pulse" : ""}`} />
      <Clock className={`w-3 h-3 ${s.text}`} />
      <span className={s.text}>{label}</span>
    </Link>
  );
}
