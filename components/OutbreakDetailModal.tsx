"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X, ExternalLink, AlertTriangle, TrendingUp, Users, Skull, Calendar, Globe, Clock, Activity, ImageDown, FileText, Link as LinkIcon, Check, Copy, Info } from "lucide-react";
import WatchlistButton from "@/components/WatchlistButton";
import { getIncidenceRate } from "@/lib/population-data";
import type { Outbreak } from "@/lib/outbreaks";
import { getLocalizedDisease, getLocalizedCountry, getLocalizedDescription, sourceStatus, sourceName, staleOutbreakDays } from "@/lib/outbreaks";
import { getResponseGuidance, RESPONSE_ACTIONS } from "@/lib/response-guidance";
import { diseaseToSlug, normalizeDisease } from "@/lib/disease-data";
import Link from "next/link";
import type { OutbreakTrend } from "@/lib/outbreak-trend";
import RiskBadge from "@/components/RiskBadge";
import ShareOutbreakButton from "@/components/ShareOutbreakButton";
import LockedUpgradeButton from "@/components/LockedUpgradeButton";
import { useUpgradeModal } from "@/lib/upgrade-modal-context";
import OutbreakCasesChart from "@/components/OutbreakCasesChart";
import { createClient as createBrowserClient } from "@/lib/supabase-browser";
import { wilsonCI } from "@/lib/cfr-ci";
import OutbreakMetrics from "@/components/OutbreakMetrics";
import OutbreakWorkflow from "@/components/OutbreakWorkflow";
import OutbreakCluster from "@/components/OutbreakCluster";
import OutbreakBenchmark from "@/components/OutbreakBenchmark";
import CountryCapacity from "@/components/CountryCapacity";

const COPY: Record<string, {
  cases: string; deaths: string; cfr: string; incidence: string; date: string;
  source: string; officialSource: string; description: string; close: string;
  noData: string; cfrFull: string; region: string;
  partialData: string; dataAge: (d: number) => string; fresh: string; stale: string;
  incidencePer100k: string; trendDelta: (delta: number, days: number) => string;
  illustrative: string; illustrativeNotice: string;
  officialBadge: string; officialNotice: string;
  fpGuidance: string; tierLabels: { immediate: string; rapid: string; monitor: string };
  firstActions: string; reportingLag: string; staleBulletin: (d: number) => string;
}> = {
  fr: { cases: "Cas confirmés", deaths: "Décès", cfr: "Létalité", incidence: "Incidence", date: "Rapport du", source: "Bulletin OMS original", officialSource: "Source officielle", description: "Résumé", close: "Fermer", noData: "N/D", cfrFull: "Taux de létalité (CFR)", region: "Région", partialData: "Données partielles — chiffres non disponibles dans ce rapport OMS", dataAge: (d) => `Il y a ${d} jour${d > 1 ? "s" : ""}`, fresh: "Données récentes", stale: "Rapport ancien", incidencePer100k: "pour 100 000 hab.", trendDelta: (delta, days) => `${delta > 0 ? "+" : ""}${delta} cas / ${days}j`, illustrative: "NON VÉRIFIÉ", illustrativeNotice: "Chiffres provisoires non vérifiés — pas encore rattachés à un rapport OMS/officiel confirmé. À utiliser avec précaution.", officialBadge: "SOURCE OFFICIELLE", officialNotice: "Source officielle confirmée (rapport OMS, ECDC ou ministère de la santé) — sans numéro de bulletin DON. Données fiables, non directement citables comme DON.", fpGuidance: "Guide d'action — Point focal", tierLabels: { immediate: "IMMÉDIAT · NOTIFIABLE RSI", rapid: "RÉPONSE RAPIDE", monitor: "SURVEILLANCE STANDARD" }, firstActions: "Premières actions", reportingLag: "Date basée sur les sources officielles — l'apparition terrain peut précéder de plusieurs jours à semaines en zones isolées", staleBulletin: (d) => `Aucun bulletin officiel depuis ${d} jour${d > 1 ? "s" : ""} — foyer peut-être résolu ou non rapporté` },
  en: { cases: "Confirmed cases", deaths: "Deaths", cfr: "CFR", incidence: "Incidence", date: "Report date", source: "Original WHO bulletin", officialSource: "Official source", description: "Summary", close: "Close", noData: "N/A", cfrFull: "Case fatality rate (CFR)", region: "Region", partialData: "Partial data — figures not available in this WHO report", dataAge: (d) => `${d} day${d > 1 ? "s" : ""} ago`, fresh: "Recent data", stale: "Old report", incidencePer100k: "per 100,000 pop.", trendDelta: (delta, days) => `${delta > 0 ? "+" : ""}${delta} cases / ${days}d`, illustrative: "UNVERIFIED", illustrativeNotice: "Unverified placeholder figures — not yet matched to a confirmed WHO/official report. Treat with caution.", officialBadge: "OFFICIAL SOURCE", officialNotice: "Confirmed official source (WHO situation report, ECDC, or national Ministry of Health) — no WHO DON reference number. Data is reliable but not directly citable as a DON.", fpGuidance: "Focal Point Guidance", tierLabels: { immediate: "IMMEDIATE · IHR NOTIFIABLE", rapid: "RAPID RESPONSE", monitor: "STANDARD MONITORING" }, firstActions: "First actions", reportingLag: "Report date reflects official sources — field onset may precede by days to weeks in remote zones", staleBulletin: (d) => `No official bulletin in ${d} day${d > 1 ? "s" : ""} — outbreak may be resolved or under-reported` },
  es: { cases: "Casos confirmados", deaths: "Fallecidos", cfr: "Letalidad", incidence: "Incidencia", date: "Informe del", source: "Boletín OMS original", officialSource: "Fuente oficial", description: "Resumen", close: "Cerrar", noData: "N/D", cfrFull: "Tasa de letalidad (CFR)", region: "Región", partialData: "Datos parciales — cifras no disponibles en este informe OMS", dataAge: (d) => `Hace ${d} día${d > 1 ? "s" : ""}`, fresh: "Datos recientes", stale: "Informe antiguo", incidencePer100k: "por 100.000 hab.", trendDelta: (delta, days) => `${delta > 0 ? "+" : ""}${delta} casos / ${days}d`, illustrative: "NO VERIFICADO", illustrativeNotice: "Cifras provisionales no verificadas — aún no vinculadas a un informe oficial/OMS confirmado. Usar con precaución.", officialBadge: "FUENTE OFICIAL", officialNotice: "Fuente oficial confirmada (informe OMS, ECDC o ministerio de salud) — sin número de boletín DON. Datos fiables, no citables directamente como DON.", fpGuidance: "Guía del Punto focal", tierLabels: { immediate: "INMEDIATO · NOTIFICABLE RSI", rapid: "RESPUESTA RÁPIDA", monitor: "VIGILANCIA ESTÁNDAR" }, firstActions: "Primeras acciones", reportingLag: "Fecha basada en fuentes oficiales — el inicio clínico puede preceder días o semanas en zonas remotas", staleBulletin: (d) => `Sin boletín oficial en ${d} día${d > 1 ? "s" : ""} — el brote puede estar resuelto o sin reportar` },
  ar: { cases: "الحالات المؤكدة", deaths: "الوفيات", cfr: "معدل الوفيات", incidence: "معدل الإصابة", date: "تاريخ التقرير", source: "النشرة الرسمية لـ OMS", officialSource: "المصدر الرسمي", description: "ملخص", close: "إغلاق", noData: "غ/م", cfrFull: "معدل إماتة الحالات (CFR)", region: "المنطقة", partialData: "بيانات جزئية — الأرقام غير متوفرة في هذا التقرير", dataAge: (d) => `منذ ${d} يوم`, fresh: "بيانات حديثة", stale: "تقرير قديم", incidencePer100k: "لكل 100,000 ساكن", trendDelta: (delta, days) => `${delta > 0 ? "+" : ""}${delta} حالة / ${days} يوم`, illustrative: "غير مؤكد", illustrativeNotice: "أرقام تجريبية غير مؤكدة — لم تُربط بعد بتقرير رسمي مؤكد لمنظمة الصحة العالمية. يُرجى التعامل معها بحذر.", officialBadge: "مصدر رسمي", officialNotice: "مصدر رسمي مؤكد (تقرير منظمة الصحة العالمية أو المركز الأوروبي للوقاية أو وزارة الصحة) — بدون رقم نشرة DON. البيانات موثوقة لكنها غير قابلة للاستشهاد مباشرة.", fpGuidance: "توجيهات نقطة الاتصال", tierLabels: { immediate: "فوري · إخطار إلزامي (اللوائح الصحية الدولية)", rapid: "استجابة سريعة", monitor: "مراقبة روتينية" }, firstActions: "الإجراءات الأولى", reportingLag: "التاريخ يعكس المصادر الرسمية — قد يسبق بدء الحالات الميدانية أياماً إلى أسابيع في المناطق النائية", staleBulletin: (d) => `لا نشرة رسمية منذ ${d} يوم — قد يكون الوباء محلولاً أو غير مُبلَّغ عنه` },
  id: { cases: "Kasus terkonfirmasi", deaths: "Kematian", cfr: "CFR", incidence: "Insidensi", date: "Tanggal laporan", source: "Buletin WHO asli", officialSource: "Sumber resmi", description: "Ringkasan", close: "Tutup", noData: "T/S", cfrFull: "Tingkat kematian kasus (CFR)", region: "Wilayah", partialData: "Data parsial — angka tidak tersedia dalam laporan WHO ini", dataAge: (d) => `${d} hari lalu`, fresh: "Data terbaru", stale: "Laporan lama", incidencePer100k: "per 100.000 penduduk", trendDelta: (delta, days) => `${delta > 0 ? "+" : ""}${delta} kasus / ${days}h`, illustrative: "BELUM DIVERIFIKASI", illustrativeNotice: "Angka sementara yang belum diverifikasi — belum dikaitkan dengan laporan resmi/WHO yang terkonfirmasi. Gunakan dengan hati-hati.", officialBadge: "SUMBER RESMI", officialNotice: "Sumber resmi yang dikonfirmasi (laporan situasi WHO, ECDC, atau Kementerian Kesehatan) — tanpa nomor buletin DON WHO. Data dapat diandalkan namun tidak bisa dikutip langsung sebagai DON.", fpGuidance: "Panduan Focal Point", tierLabels: { immediate: "SEGERA · WAJIB LAPOR IHR", rapid: "RESPONS CEPAT", monitor: "PEMANTAUAN STANDAR" }, firstActions: "Tindakan pertama", reportingLag: "Tanggal berdasarkan sumber resmi — onset lapangan bisa mendahului beberapa hari hingga minggu di wilayah terpencil", staleBulletin: (d) => `Tidak ada buletin resmi sejak ${d} hari — wabah mungkin sudah teratasi atau tidak dilaporkan` },
};

const RISK_BG: Record<string, string> = {
  high:   "from-red-950/60 border-red-800/40",
  medium: "from-amber-950/60 border-amber-800/40",
  low:    "from-green-950/60 border-green-800/40",
};

const TIER_STYLE: Record<string, string> = {
  immediate: "text-red-400 bg-red-500/10 border-red-500/30",
  rapid:     "text-yellow-400 bg-yellow-500/10 border-yellow-500/30",
  monitor:   "text-gray-300 bg-gray-600/20 border-gray-500/30",
};

const REGION_NAMES: Record<string, Record<string, string>> = {
  fr: { africa: "Afrique",    asia: "Asie",   europe: "Europe",  americas: "Amériques", oceania: "Océanie"    },
  en: { africa: "Africa",     asia: "Asia",   europe: "Europe",  americas: "Americas",  oceania: "Oceania"    },
  es: { africa: "África",     asia: "Asia",   europe: "Europa",  americas: "Américas",  oceania: "Oceanía"    },
  ar: { africa: "أفريقيا",   asia: "آسيا",  europe: "أوروبا", americas: "الأمريكتان", oceania: "أوقيانوسيا" },
  id: { africa: "Afrika",     asia: "Asia",   europe: "Eropa",   americas: "Amerika",   oceania: "Oseania"    },
};

interface Props {
  outbreak: Outbreak | null;
  locale: string;
  isPaid: boolean;
  watchlist?: Set<string>;
  trend?: OutbreakTrend;
  onClose: () => void;
}

interface Snapshot { snapped_at: string; cases: number; deaths: number; }
interface PastOutbreak { id: string; date: string; cases: number; deaths: number; risk_level: string; }
interface Note { id: string; note: string; status: string | null; author_email: string; user_id: string; created_at: string; }

const HISTORY_COPY: Record<string, { curve: string; past: string; peak: string; noHistory: string }> = {
  fr: { curve: "Courbe épidémique", past: "Épisodes précédents", peak: "pic", noHistory: "Aucun épisode antérieur enregistré" },
  en: { curve: "Epidemic curve",    past: "Previous episodes",   peak: "peak", noHistory: "No previous episode on record" },
  es: { curve: "Curva epidémica",   past: "Episodios anteriores", peak: "pico", noHistory: "Sin episodios anteriores registrados" },
  ar: { curve: "المنحنى الوبائي",  past: "الحلقات السابقة",    peak: "ذروة", noHistory: "لا توجد حلقات سابقة مسجلة" },
  id: { curve: "Kurva epidemi",     past: "Episode sebelumnya",  peak: "puncak", noHistory: "Tidak ada episode sebelumnya" },
};

const NOTES_COPY: Record<string, {
  title: string; placeholder: string; add: string; adding: string;
  statusLabel: string; noStatus: string; statuses: Record<string, string>;
  you: string; team: string;
}> = {
  fr: { title: "Notes d'équipe", placeholder: "Ajouter une note (investigation, contact terrain, décision…)", add: "Ajouter", adding: "Envoi…", statusLabel: "Statut", noStatus: "Sans statut", statuses: { monitoring: "Surveillance", investigating: "Investigation", closed: "Clôturé" }, you: "Vous", team: "Équipe" },
  en: { title: "Team notes", placeholder: "Add a note (investigation, field contact, decision…)", add: "Add", adding: "Sending…", statusLabel: "Status", noStatus: "No status", statuses: { monitoring: "Monitoring", investigating: "Investigating", closed: "Closed" }, you: "You", team: "Team" },
  es: { title: "Notas del equipo", placeholder: "Agregar una nota (investigación, contacto de campo, decisión…)", add: "Agregar", adding: "Enviando…", statusLabel: "Estado", noStatus: "Sin estado", statuses: { monitoring: "Vigilancia", investigating: "Investigando", closed: "Cerrado" }, you: "Tú", team: "Equipo" },
  ar: { title: "ملاحظات الفريق", placeholder: "إضافة ملاحظة (تحقيق، اتصال ميداني، قرار…)", add: "إضافة", adding: "جارٍ الإرسال…", statusLabel: "الحالة", noStatus: "بدون حالة", statuses: { monitoring: "مراقبة", investigating: "تحقيق", closed: "مغلق" }, you: "أنت", team: "الفريق" },
  id: { title: "Catatan tim", placeholder: "Tambahkan catatan (investigasi, kontak lapangan, keputusan…)", add: "Tambah", adding: "Mengirim…", statusLabel: "Status", noStatus: "Tanpa status", statuses: { monitoring: "Pemantauan", investigating: "Investigasi", closed: "Ditutup" }, you: "Anda", team: "Tim" },
};

const STATUS_STYLE: Record<string, string> = {
  monitoring:   "bg-blue-900/30 border-blue-700/40 text-blue-300",
  investigating: "bg-amber-900/30 border-amber-700/40 text-amber-300",
  closed:       "bg-gray-700/40 border-gray-600/40 text-gray-400",
};

export default function OutbreakDetailModal({ outbreak, locale, isPaid, watchlist, trend, onClose }: Props) {
  const c = COPY[locale] ?? COPY.en;
  const hc = HISTORY_COPY[locale] ?? HISTORY_COPY.en;
  const isRtl = locale === "ar";
  const { openModal } = useUpgradeModal();

  const [snapshots,      setSnapshots]      = useState<Snapshot[]>([]);
  const [pastOutbreaks,  setPastOutbreaks]  = useState<PastOutbreak[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const [notes,       setNotes]       = useState<Note[]>([]);
  const [noteText,    setNoteText]    = useState("");
  const [noteStatus,  setNoteStatus]  = useState<string>("");
  const [submitting,  setSubmitting]  = useState(false);

  // Fetch notes
  useEffect(() => {
    if (!outbreak || !isPaid) return;
    setNotes([]);
    fetch(`/api/outbreak-notes?outbreak_id=${outbreak.id}`)
      .then((r) => r.json())
      .then((d) => { if (d.notes) setNotes(d.notes); })
      .catch(() => {});
  }, [outbreak?.id, isPaid]);

  // Realtime subscription — receive team notes inserted by others without refresh
  useEffect(() => {
    if (!outbreak?.id || !isPaid) return;
    const supabase = createBrowserClient();
    const channel = supabase
      .channel(`notes:${outbreak.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "outbreak_notes", filter: `outbreak_id=eq.${outbreak.id}` },
        (payload) => {
          const incoming = payload.new as Note;
          setNotes((prev) => prev.some((n) => n.id === incoming.id) ? prev : [incoming, ...prev]);
        }
      )
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [outbreak?.id, isPaid]);

  async function handleAddNote() {
    if (!outbreak || !noteText.trim() || submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/outbreak-notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ outbreak_id: outbreak.id, note: noteText.trim(), status: noteStatus || null }),
      });
      const d = await res.json();
      if (d.note) {
        setNotes((prev) => [d.note, ...prev]);
        setNoteText("");
        setNoteStatus("");
      }
    } catch { /* ignore */ } finally {
      setSubmitting(false);
    }
  }

  // Fetch epidemic curve + past episodes whenever the modal opens on a new outbreak
  useEffect(() => {
    if (!outbreak || !isPaid) return;
    setSnapshots([]);
    setPastOutbreaks([]);
    setHistoryLoading(true);
    const params = new URLSearchParams({
      outbreak_id: outbreak.id,
      ...(outbreak.disease_en ? { disease_en: outbreak.disease_en } : {}),
      ...(outbreak.country_en ? { country_en: outbreak.country_en } : {}),
    });
    fetch(`/api/outbreak-history?${params}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.snapshots)     setSnapshots(d.snapshots);
        if (d.pastOutbreaks) setPastOutbreaks(d.pastOutbreaks);
      })
      .catch(() => {})
      .finally(() => setHistoryLoading(false));
  }, [outbreak?.id, isPaid]);

  // Close on Escape
  useEffect(() => {
    function handler(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  if (!outbreak || typeof document === "undefined") return null;

  const disease     = getLocalizedDisease(outbreak, locale);
  const country     = getLocalizedCountry(outbreak, locale) ?? outbreak.country_en;
  const description = getLocalizedDescription(outbreak, locale);
  const hasData    = outbreak.cases > 0;
  const cfr        = hasData ? (outbreak.deaths / outbreak.cases * 100).toFixed(1) : null;
  const incidence  = getIncidenceRate(outbreak.cases, outbreak.country_en);

  // Data freshness. `new Date()` (not `Date.now()`) keeps this pure for
  // react-hooks/purity — see app/[locale]/page.tsx for the same idiom — and
  // day-granularity freshness needs no live tick: this modal only exists while
  // a marker's detail view is open, it isn't a long-lived countdown display.
  const now       = new Date();
  const daysSince = Math.floor((now.getTime() - new Date(outbreak.date).getTime()) / 86_400_000);
  const isFresh   = daysSince <= 7;
  const isStale   = daysSince > 30;

  // Three-tier source verification for this row.
  const status = sourceStatus(outbreak);

  // DON reference from source URL (e.g., "2026-DON603") — only for confirmed DON rows.
  const donRef = status === 'don' ? (outbreak.source?.match(/item\/([\w-]+)/)?.[1] ?? null) : null;

  // 'official' rows have a real https URL (WHO sitrep, ECDC, national MoH…)
  // 'don' rows also have a real URL — both get a source link.
  // 'unverified' rows have a placeholder source and get no link.
  const hasDisplayableSource = status !== 'unverified';

  const staleDays = staleOutbreakDays(outbreak);
  const guidance  = getResponseGuidance(outbreak.disease_en || outbreak.disease);
  const fpActions = RESPONSE_ACTIONS[guidance.tier][locale] ?? RESPONSE_ACTIONS[guidance.tier].en;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div
        className={`relative bg-gray-900 border rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto
          bg-gradient-to-b ${RISK_BG[outbreak.risk_level] ?? RISK_BG.low}`}
        dir={isRtl ? "rtl" : undefined}
      >
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-white/10">
          <div className="space-y-2 flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <RiskBadge level={outbreak.risk_level as "high" | "medium" | "low"} />
              {status === 'don' && (
                <span
                  title="WHO Disease Outbreak News — officially citable WHO bulletin with a unique DON reference number."
                  className="inline-flex items-center text-xs px-2 py-0.5 rounded-full bg-blue-900/30 border border-blue-700/50 text-blue-400 font-bold cursor-help"
                >
                  WHO DON
                </span>
              )}
              {status === 'official' && (
                <span
                  title={c.officialNotice}
                  className="inline-flex items-center text-xs px-2 py-0.5 rounded-full bg-amber-900/30 border border-amber-700/50 text-amber-400 font-bold cursor-help"
                >
                  {sourceName(outbreak.source)}
                </span>
              )}
              {status === 'unverified' && (
                <span
                  title={c.illustrativeNotice}
                  className="inline-flex items-center text-xs px-2 py-0.5 rounded-full bg-gray-800 border border-gray-600 text-gray-400 font-bold cursor-help"
                >
                  {c.illustrative}
                </span>
              )}
              {outbreak.is_pheic && (
                <span
                  title={
                    locale === "fr" ? "Urgence de Santé Publique de Portée Internationale (USPPI)" :
                    locale === "es" ? "Emergencia de Salud Pública de Importancia Internacional (ESPII)" :
                    locale === "ar" ? "طوارئ الصحة العمومية التي تثير قلقاً دولياً" :
                    locale === "id" ? "Kedaruratan Kesehatan Masyarakat yang Meresahkan Dunia (KKMMD)" :
                    "Public Health Emergency of International Concern"
                  }
                  className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-purple-900/40 border border-purple-700/50 text-purple-300 font-bold cursor-help"
                >
                  🚨 PHEIC
                </span>
              )}
            </div>
            <Link
              href={`/${locale}/disease/${diseaseToSlug(normalizeDisease(outbreak.disease_en || outbreak.disease).name_en)}`}
              onClick={onClose}
              className="text-xl font-bold text-white leading-tight hover:text-red-400 transition-colors"
            >
              {disease}
            </Link>
            <div className="flex items-center gap-1.5 text-gray-400 text-sm">
              <Globe className="w-3.5 h-3.5 shrink-0" />
              <span>{country}</span>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0 ml-3">
            {/* Watchlist star */}
            <WatchlistButton
              outbreakId={outbreak.id}
              initialWatched={watchlist?.has(outbreak.id) ?? false}
              isPaid={isPaid}
              locale={locale}
            />
            {/* PDF one-pager — Pro/Team/Enterprise */}
            {isPaid ? (
              <a
                href={`/${locale}/outbreak/${outbreak.id}/print`}
                target="_blank"
                rel="noopener noreferrer"
                title={locale === "fr" ? "Rapport PDF" :
                       locale === "es" ? "Informe PDF" :
                       locale === "ar" ? "تقرير PDF" :
                       locale === "id" ? "Laporan PDF" :
                       "PDF Report"}
                className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
              >
                <FileText className="w-4 h-4" />
              </a>
            ) : (
              <button
                onClick={() => openModal("pdf")}
                title={locale === "fr" ? "Rapport PDF — Pro" :
                       locale === "es" ? "Informe PDF — Pro" :
                       locale === "ar" ? "تقرير PDF — Pro" :
                       locale === "id" ? "Laporan PDF — Pro" :
                       "PDF Report — Pro"}
                className="p-1.5 rounded-lg hover:bg-white/10 text-gray-600 hover:text-gray-400 transition-colors"
              >
                <FileText className="w-4 h-4" />
              </button>
            )}
            {/* Download card image */}
            <a
              href={`/api/outbreak-card/${outbreak.id}?locale=${locale}`}
              target="_blank"
              rel="noopener noreferrer"
              title={locale === "fr" ? "Télécharger comme image" :
                     locale === "es" ? "Descargar como imagen" :
                     locale === "ar" ? "تنزيل كصورة" :
                     locale === "id" ? "Unduh sebagai gambar" :
                     "Download as image"}
              className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
            >
              <ImageDown className="w-4 h-4" />
            </a>
            <ShareOutbreakButton
              disease={disease}
              country={country ?? ""}
              cases={outbreak.cases}
              riskLevel={outbreak.risk_level}
              locale={locale}
            />
            <button
              onClick={onClose}
              aria-label={c.close}
              className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Stats grid */}
        <div className={`grid ${incidence !== null ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-3"} gap-3 p-5`}>
          {/* Cases */}
          <div className="bg-white/5 rounded-xl p-3 text-center space-y-1">
            <Users className="w-4 h-4 text-blue-400 mx-auto" />
            <p className="text-xs text-gray-500">{c.cases}</p>
            <p className="text-lg font-bold text-white">
              {isPaid
                ? (hasData ? outbreak.cases.toLocaleString("en") : <span className="text-gray-600 text-sm italic">{c.noData}</span>)
                : <span className="blur-sm select-none cursor-pointer" onClick={() => openModal("cases")}>12345</span>
              }
            </p>
            {isPaid && trend && trend.direction !== "unknown" && (
              <p className={`text-[11px] font-medium ${
                trend.direction === "up" ? "text-red-400" :
                trend.direction === "down" ? "text-green-400" : "text-gray-500"
              }`}>
                {c.trendDelta(trend.deltaCases, trend.daysBack)}
              </p>
            )}
          </div>

          {/* Deaths */}
          <div className="bg-white/5 rounded-xl p-3 text-center space-y-1">
            <Skull className="w-4 h-4 text-red-400 mx-auto" />
            <p className="text-xs text-gray-500">{c.deaths}</p>
            <p className="text-lg font-bold text-red-400">
              {isPaid
                ? (hasData ? outbreak.deaths.toLocaleString("en") : <span className="text-gray-600 text-sm italic">{c.noData}</span>)
                : <span className="blur-sm select-none cursor-pointer" onClick={() => openModal("cases")}>234</span>
              }
            </p>
          </div>

          {/* CFR */}
          <div className="bg-white/5 rounded-xl p-3 text-center space-y-1">
            <TrendingUp className="w-4 h-4 text-amber-400 mx-auto" />
            <p className="text-xs text-gray-500">{c.cfr}</p>
            <p className={`text-lg font-bold ${
              cfr && parseFloat(cfr) > 10 ? "text-red-400" :
              cfr && parseFloat(cfr) > 3  ? "text-amber-400" : "text-gray-300"
            }`}>
              {isPaid
                ? (cfr ? `${cfr}%` : <span className="text-gray-600 text-sm italic">{c.noData}</span>)
                : <span className="blur-sm select-none cursor-pointer" onClick={() => openModal("cases")}>9.9%</span>
              }
            </p>
            {isPaid && cfr && (() => {
              const ci = wilsonCI(outbreak.deaths, outbreak.cases);
              if (!ci) return null;
              return (
                <p className="text-[10px] text-gray-600" title="Wilson score 95% confidence interval">
                  IC95% [{ci[0]}–{ci[1]}%]
                </p>
              );
            })()}
          </div>

          {/* Incidence rate */}
          {incidence !== null && (
            <div className="bg-white/5 rounded-xl p-3 text-center space-y-1">
              <Activity className="w-4 h-4 text-purple-400 mx-auto" />
              <p className="text-xs text-gray-500">{c.incidence}</p>
              {isPaid ? (
                <div>
                  <p className={`text-lg font-bold ${
                    incidence > 100 ? "text-red-400" :
                    incidence > 10  ? "text-amber-400" : "text-gray-300"
                  }`}>
                    {incidence < 0.01 ? "<0.01" : incidence.toFixed(incidence < 1 ? 2 : 1)}
                  </p>
                  <p className="text-[10px] text-gray-600 mt-0.5">{c.incidencePer100k}</p>
                </div>
              ) : (
                <p className="text-lg font-bold blur-sm select-none text-gray-300 cursor-pointer" onClick={() => openModal("cases")}>0.36</p>
              )}
            </div>
          )}
        </div>

        {/* ── Transmission dynamics (P1) ───────────────────────────────── */}
        {isPaid && snapshots.length >= 2 && (
          <OutbreakMetrics
            snapshots={snapshots}
            diseaseEn={outbreak.disease_en}
            locale={locale}
          />
        )}

        {/* ── Epidemic curve (Pro) ──────────────────────────────────────── */}
        {isPaid && (
          <div className="px-5 pb-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{hc.curve}</p>
            {historyLoading ? (
              <div className="flex items-center justify-center h-[180px]">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-red-500" />
              </div>
            ) : (
              <OutbreakCasesChart
                snapshots={snapshots}
                riskLevel={outbreak.risk_level}
                locale={locale}
              />
            )}
          </div>
        )}

        {/* ── Previous episodes (Pro) ───────────────────────────────────── */}
        {isPaid && (
          <div className="px-5 pb-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{hc.past}</p>
            {historyLoading ? (
              <div className="h-4 w-24 bg-gray-800 rounded animate-pulse" />
            ) : pastOutbreaks.length === 0 ? (
              <p className="text-xs text-gray-600 italic">{hc.noHistory}</p>
            ) : (
              <div className="space-y-1.5">
                {pastOutbreaks.map((p) => {
                  const cfr = p.cases > 0 ? (p.deaths / p.cases * 100).toFixed(1) : null;
                  return (
                    <div key={p.id} className="flex items-center justify-between text-xs text-gray-400">
                      <span className="text-gray-500">{p.date.slice(0, 7)}</span>
                      <span className="flex items-center gap-2">
                        {p.cases > 0 && (
                          <span>{p.cases.toLocaleString("en")} {hc.peak}</span>
                        )}
                        {cfr && (
                          <span className={`${parseFloat(cfr) > 10 ? "text-red-400" : parseFloat(cfr) > 3 ? "text-amber-400" : "text-gray-500"}`}>
                            CFR {cfr}%
                          </span>
                        )}
                        <RiskBadge level={p.risk_level as "high" | "medium" | "low"} />
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── Historical benchmark (P2) ────────────────────────────────── */}
        {isPaid && outbreak.cases > 0 && (
          <OutbreakBenchmark outbreakId={outbreak.id} currentCases={outbreak.cases} locale={locale} />
        )}

        {/* ── Multi-country cluster (P3) ───────────────────────────────── */}
        {outbreak.event_id && (
          <OutbreakCluster
            eventId={outbreak.event_id}
            excludeId={outbreak.id}
            locale={locale}
          />
        )}

        {/* ── Country capacity (P4) ────────────────────────────────────── */}
        {isPaid && (
          <CountryCapacity countryEn={outbreak.country_en ?? null} locale={locale} />
        )}

        {/* Unlock prompt for free users */}
        {!isPaid && (
          <div className="mx-5 mb-3 flex items-center justify-between gap-3 p-3 rounded-xl bg-amber-900/10 border border-amber-700/20">
            <p className="text-xs text-gray-500">
              {locale === "fr" ? "Débloquez les chiffres exacts avec Pro — essai 14 jours gratuit" :
               locale === "es" ? "Desbloquee las cifras exactas con Pro — prueba de 14 días gratis" :
               locale === "ar" ? "افتح الأرقام الدقيقة مع Pro — تجربة 14 يوماً مجانية" :
               locale === "id" ? "Buka angka tepat dengan Pro — uji coba 14 hari gratis" :
               "Unlock exact figures with Pro — 14-day free trial"}
            </p>
            <LockedUpgradeButton
              feature="cases"
              label={
                locale === "fr" ? "Débloquer Pro" :
                locale === "es" ? "Desbloquear Pro" :
                locale === "ar" ? "فتح Pro" :
                locale === "id" ? "Buka Pro" :
                "Unlock Pro"
              }
              variant="banner"
            />
          </div>
        )}

        {/* PHEIC banner */}
        {outbreak.is_pheic && (
          <div className="mx-5 mb-3 flex items-start gap-2 bg-purple-900/20 border border-purple-700/30 rounded-xl p-3 text-xs text-purple-300">
            <span className="shrink-0 text-base">🚨</span>
            <span>
              {locale === "fr" ? "Urgence de Santé Publique de Portée Internationale (USPPI) — déclarée par le Directeur Général de l'OMS. Niveau d'alerte maximal." :
               locale === "es" ? "Emergencia de Salud Pública de Importancia Internacional (ESPII) — declarada por el Director General de la OMS." :
               locale === "ar" ? "طوارئ الصحة العمومية التي تثير قلقاً دولياً — أعلنها المدير العام لمنظمة الصحة العالمية." :
               locale === "id" ? "Kedaruratan Kesehatan Masyarakat yang Meresahkan Dunia (KKMMD) — dinyatakan oleh Direktur Jenderal WHO." :
               "Public Health Emergency of International Concern (PHEIC) — declared by the WHO Director-General. Highest global health alert level."}
            </span>
          </div>
        )}

        {/* Source verification banner */}
        {status === 'official' && (
          <div className="mx-5 mb-3 flex items-start gap-2 bg-amber-900/10 border border-amber-700/30 rounded-xl p-3 text-xs text-amber-300/80">
            <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            {c.officialNotice}
          </div>
        )}
        {status === 'unverified' && (
          <div className="mx-5 mb-3 flex items-start gap-2 bg-gray-800/40 border border-gray-700/40 rounded-xl p-3 text-xs text-gray-400">
            <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            {c.illustrativeNotice}
          </div>
        )}

        {/* Partial data warning */}
        {!hasData && (
          <div className="mx-5 mb-3 flex items-start gap-2 bg-amber-900/20 border border-amber-800/30 rounded-xl p-3 text-xs text-amber-300">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            {c.partialData}
          </div>
        )}

        {/* Meta */}
        <div className="px-5 pb-3 space-y-2 text-sm">
          {/* Report date + freshness */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-gray-400">
              <Calendar className="w-3.5 h-3.5 shrink-0" />
              <span>{c.date}</span>
              <span className="text-gray-300 font-medium">{outbreak.date}</span>
              {donRef && (
                <span className="text-gray-600 text-xs">· {donRef}</span>
              )}
            </div>
            <span className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border shrink-0 ${
              isFresh ? "bg-green-900/20 border-green-800/30 text-green-400" :
              isStale ? "bg-red-900/20 border-red-800/30 text-red-400" :
                        "bg-amber-900/20 border-amber-800/30 text-amber-400"
            }`}>
              <Clock className="w-3 h-3" />
              {isFresh ? c.fresh : isStale ? c.stale : c.dataAge(daysSince)}
            </span>
          </div>

          <div className="flex items-center gap-2 text-gray-400">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            <span>{c.region} :</span>
            <span className="text-gray-300">
              {(REGION_NAMES[locale] ?? REGION_NAMES.en)[outbreak.region] ?? outbreak.region}
            </span>
          </div>
          {outbreak.admin1 && (
            <div className="flex items-center gap-2 text-gray-400">
              <Globe className="w-3.5 h-3.5 shrink-0 text-blue-500/70" />
              <span className="text-xs">
                {locale === "fr" ? "Province / zone" :
                 locale === "es" ? "Provincia / zona" :
                 locale === "ar" ? "المقاطعة / المنطقة" :
                 locale === "id" ? "Provinsi / zona" :
                 "Province / zone"}
                {" : "}
              </span>
              <span className="text-gray-300 text-xs font-medium">{outbreak.admin1}</span>
              <span className="text-[10px] text-blue-500/60 bg-blue-900/20 border border-blue-800/30 px-1.5 py-0.5 rounded-full">
                {locale === "fr" ? "infra-national" :
                 locale === "es" ? "subnacional" :
                 locale === "ar" ? "دون الوطني" :
                 locale === "id" ? "sub-nasional" :
                 "sub-national"}
              </span>
            </div>
          )}
          <p className="text-[10px] text-gray-600 leading-snug">{c.reportingLag}</p>
        </div>

        {/* Stale-signal warning */}
        {staleDays !== null && (
          <div className="mx-5 mb-3 flex items-start gap-2 bg-orange-900/20 border border-orange-700/30 rounded-xl p-3 text-xs text-orange-300">
            <span className="shrink-0">⚠</span>
            <span>{c.staleBulletin(staleDays)}</span>
          </div>
        )}

        {/* Description — localized via getLocalizedDescription(), falls back to EN */}
        {description && (
          <div className="px-5 pb-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{c.description}</p>
            <p className="text-sm text-gray-400 leading-relaxed">{description}</p>
          </div>
        )}

        {/* Focal Point Guidance — active outbreaks only */}
        {outbreak.active && (
          <div className={`mx-5 mb-4 rounded-xl border p-3 ${TIER_STYLE[guidance.tier]}`}>
            <div className="flex items-center justify-between gap-2 mb-2">
              <p className="text-xs font-bold uppercase tracking-wide">{c.fpGuidance}</p>
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${TIER_STYLE[guidance.tier]}`}>
                {c.tierLabels[guidance.tier]}
              </span>
            </div>
            <p className="text-[10px] font-semibold uppercase tracking-wide opacity-60 mb-1.5">{c.firstActions}</p>
            <ul className="space-y-1">
              {fpActions.map((action, i) => (
                <li key={i} className="flex items-start gap-1.5 text-xs">
                  <span className="mt-0.5 shrink-0 opacity-50">›</span>
                  <span>{action}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* CFR interpretation */}
        {isPaid && cfr && (
          <div className={`mx-5 mb-4 rounded-xl p-3 text-xs border ${
            parseFloat(cfr) > 10
              ? "bg-red-900/20 border-red-800/30 text-red-300"
              : parseFloat(cfr) > 3
              ? "bg-amber-900/20 border-amber-800/30 text-amber-300"
              : "bg-gray-800/50 border-gray-700/30 text-gray-400"
          }`}>
            {parseFloat(cfr) > 10
              ? `⚠️ CFR ${cfr}% — ${{ fr: "taux de létalité critique. Ebola typique : 25–90 %.", en: "critical fatality rate. Typical Ebola: 25–90%.", es: "tasa de letalidad crítica. Ébola típico: 25–90%.", ar: "معدل وفيات حرج. إيبولا النموذجي: 25–90%.", id: "tingkat kematian kritis. Ebola tipikal: 25–90%." }[locale] ?? "critical fatality rate. Typical Ebola: 25–90%."}`
              : parseFloat(cfr) > 3
              ? `⚠️ CFR ${cfr}% — ${{ fr: "taux de létalité élevé. Surveillance renforcée recommandée.", en: "high fatality rate. Enhanced surveillance recommended.", es: "tasa de letalidad alta. Se recomienda vigilancia reforzada.", ar: "معدل وفيات مرتفع. يُنصح بتعزيز المراقبة.", id: "tingkat kematian tinggi. Pengawasan lebih ketat disarankan." }[locale] ?? "high fatality rate. Enhanced surveillance recommended."}`
              : `CFR ${cfr}% — ${{ fr: "taux de létalité modéré.", en: "moderate fatality rate.", es: "tasa de letalidad moderada.", ar: "معدل وفيات معتدل.", id: "tingkat kematian sedang." }[locale] ?? "moderate fatality rate."}`
            }
          </div>
        )}

        {/* Citation for reports — only for WHO DON-verified rows */}
        {isPaid && status === 'don' && (
          <div className="mx-5 mb-3">
            <button
              onClick={async (e) => {
                const donRef = outbreak.source?.match(/item\/([\w-]+)/)?.[1] ?? "";
                const citation = `${disease} (${country}). WHO Disease Outbreak News${donRef ? ` — ${donRef}` : ""}, ${outbreak.date}. Via HealthWatch Global — https://healthwatch-global.com/${locale}`;
                await navigator.clipboard.writeText(citation);
                const btn = e.currentTarget;
                btn.classList.add("text-green-400");
                setTimeout(() => btn.classList.remove("text-green-400"), 2000);
              }}
              className="flex items-center gap-2 text-xs text-gray-500 hover:text-gray-300 transition-colors"
            >
              <Copy className="w-3 h-3" />
              {locale === "fr" ? "Copier la citation" :
               locale === "es" ? "Copiar cita" :
               locale === "ar" ? "نسخ الاستشهاد" :
               locale === "id" ? "Salin kutipan" :
               "Copy citation"}
            </button>
          </div>
        )}

        {/* ── Response workflow (P2) ───────────────────────────────────── */}
        {isPaid && (
          <OutbreakWorkflow outbreakId={outbreak.id} locale={locale} />
        )}

        {/* ── Team notes (Pro/Team) ─────────────────────────────────────── */}
        {isPaid && (() => {
          const nc = NOTES_COPY[locale] ?? NOTES_COPY.en;
          const currentStatus = notes.find((n) => n.status)?.status ?? null;
          return (
            <div className="px-5 pb-4 space-y-3">
              <div className="flex items-center gap-2">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{nc.title}</p>
                {currentStatus && (
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${STATUS_STYLE[currentStatus] ?? ""}`}>
                    {nc.statuses[currentStatus] ?? currentStatus}
                  </span>
                )}
              </div>

              {/* Add note form */}
              <div className="space-y-2">
                <textarea
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  placeholder={nc.placeholder}
                  maxLength={1000}
                  rows={2}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-gray-500 resize-none transition-colors"
                />
                <div className="flex items-center gap-2">
                  <select
                    value={noteStatus}
                    onChange={(e) => setNoteStatus(e.target.value)}
                    className="text-xs px-2 py-1.5 rounded-lg border border-gray-700 bg-gray-800 text-gray-400 focus:outline-none focus:border-gray-500 transition-colors cursor-pointer"
                  >
                    <option value="">{nc.noStatus}</option>
                    <option value="monitoring">{nc.statuses.monitoring}</option>
                    <option value="investigating">{nc.statuses.investigating}</option>
                    <option value="closed">{nc.statuses.closed}</option>
                  </select>
                  <button
                    onClick={handleAddNote}
                    disabled={!noteText.trim() || submitting}
                    className="ml-auto px-3 py-1.5 bg-red-600 hover:bg-red-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold rounded-lg transition-colors"
                  >
                    {submitting ? nc.adding : nc.add}
                  </button>
                </div>
              </div>

              {/* Existing notes */}
              {notes.length > 0 && (
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {notes.map((n) => (
                    <div key={n.id} className="bg-gray-800/60 rounded-lg px-3 py-2 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] text-gray-500 truncate">
                          {n.author_email.split("@")[0]}
                        </span>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {n.status && (
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${STATUS_STYLE[n.status] ?? ""}`}>
                              {nc.statuses[n.status] ?? n.status}
                            </span>
                          )}
                          <span className="text-[10px] text-gray-600">
                            {new Date(n.created_at).toLocaleDateString(locale === "ar" ? "ar-SA" : locale === "fr" ? "fr-FR" : locale === "es" ? "es-ES" : locale === "id" ? "id-ID" : "en-GB", { day: "numeric", month: "short" })}
                          </span>
                        </div>
                      </div>
                      <p className="text-xs text-gray-300 leading-relaxed">{n.note}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })()}

        {/* Source links — shown for DON and official rows; hidden for unverified */}
        <div className="px-5 pb-5 space-y-2">
          {status === 'don' && (
            <a
              href={outbreak.source!}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm font-medium transition-colors text-red-400 hover:text-red-300"
            >
              <ExternalLink className="w-4 h-4 shrink-0" />
              {c.source} →
            </a>
          )}
          {status === 'official' && (
            <a
              href={outbreak.source!}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm font-medium transition-colors text-gray-400 hover:text-gray-200"
            >
              <ExternalLink className="w-4 h-4 shrink-0" />
              {c.officialSource} →
            </a>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
