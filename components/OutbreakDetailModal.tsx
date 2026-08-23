"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X, ExternalLink, AlertTriangle, TrendingUp, Users, Skull, Calendar, Globe, Clock, Activity, ImageDown, FileText, Link as LinkIcon, Check, Copy, Info } from "lucide-react";
import WatchlistButton from "@/components/WatchlistButton";
import { getIncidenceRate } from "@/lib/population-data";
import type { Outbreak } from "@/lib/outbreaks";
import { getLocalizedDisease, getLocalizedCountry, getLocalizedDescription, sourceStatus, sourceName, staleOutbreakDays, isSourceConfirmed, hasRealAdmin1 } from "@/lib/outbreaks";
import { getResponseGuidance, RESPONSE_ACTIONS } from "@/lib/response-guidance";
import { diseaseToSlug, matchDisease } from "@/lib/disease-data";
import Link from "next/link";
import type { OutbreakTrend } from "@/lib/outbreak-trend";
import RiskBadge from "@/components/RiskBadge";
import PhaseBadge from "@/components/PhaseBadge";
import ShareOutbreakButton from "@/components/ShareOutbreakButton";
import LockedUpgradeButton from "@/components/LockedUpgradeButton";
import { useUpgradeModal } from "@/lib/upgrade-modal-context";
import OutbreakCasesChart from "@/components/OutbreakCasesChart";
import { createClient as createBrowserClient } from "@/lib/supabase-browser";
import { wilsonCI } from "@/lib/cfr-ci";
import OutbreakMetrics from "@/components/OutbreakMetrics";
import { computeEpidemicMetrics } from "@/lib/epidemic-metrics";
import OutbreakWorkflow from "@/components/OutbreakWorkflow";
import OutbreakCluster from "@/components/OutbreakCluster";
import { selectWhyItMattersSignals, whyItMattersCopy } from "@/lib/why-it-matters";
import OutbreakBenchmark from "@/components/OutbreakBenchmark";
import CountryCapacity from "@/components/CountryCapacity";
import { getVaccineCoverage, COVERAGE_YEAR, COVERAGE_SOURCE } from "@/lib/vaccine-coverage";

const COPY: Record<string, {
  cases: string; deaths: string; cfr: string; incidence: string; date: string;
  source: string; officialSource: string; description: string; close: string;
  noData: string; cfrFull: string; region: string;
  partialData: string; dataAge: (d: number) => string; fresh: string; stale: string; confirmedAge: (d: number) => string; staleConfirmed: string;
  incidencePer100k: string; trendDelta: (delta: number, days: number) => string;
  illustrative: string; illustrativeNotice: string;
  officialBadge: string; officialNotice: string;
  pressNotice: string; pressSource: string;
  fpGuidance: string; tierLabels: { immediate: string; rapid: string; monitor: string };
  firstActions: string; reportingLag: string; staleBulletin: (d: number) => string;
}> = {
  fr: { cases: "Cas confirmés", deaths: "Décès", cfr: "Létalité", incidence: "Incidence", date: "Rapport du", source: "Bulletin OMS original", officialSource: "Source officielle", description: "Résumé", close: "Fermer", noData: "N/D", cfrFull: "Taux de létalité (CFR)", region: "Région", partialData: "Données partielles — chiffres non disponibles dans ce rapport OMS", dataAge: (d) => `Il y a ${d} jour${d > 1 ? "s" : ""}`, fresh: "Données récentes", stale: "Rapport ancien", confirmedAge: (d) => `Source confirmée · il y a ${d} jour${d > 1 ? "s" : ""}`, staleConfirmed: "Source officielle vérifiée directement — aucune édition plus récente, pas un trou de données", incidencePer100k: "pour 100 000 hab.", trendDelta: (delta, days) => `${delta > 0 ? "+" : ""}${delta} cas / ${days}j`, illustrative: "NON VÉRIFIÉ", illustrativeNotice: "Chiffres provisoires non vérifiés — pas encore rattachés à un rapport OMS/officiel confirmé. À utiliser avec précaution.", officialBadge: "SOURCE OFFICIELLE", officialNotice: "Source officielle confirmée (rapport OMS, ECDC ou ministère de la santé) — sans numéro de bulletin DON. Données fiables, non directement citables comme DON.", pressNotice: "Presse généraliste — chiffres rapportés par un média, pas par un bulletin d'agence sanitaire. Le lien reste consultable, mais à recouper avec une source officielle avant tout usage opérationnel.", pressSource: "Article de presse", fpGuidance: "Guide d'action — Point focal", tierLabels: { immediate: "IMMÉDIAT · NOTIFIABLE RSI", rapid: "RÉPONSE RAPIDE", monitor: "SURVEILLANCE STANDARD" }, firstActions: "Premières actions", reportingLag: "Date basée sur les sources officielles — l'apparition terrain peut précéder de plusieurs jours à semaines en zones isolées", staleBulletin: (d) => `Aucun bulletin officiel depuis ${d} jour${d > 1 ? "s" : ""} — foyer peut-être résolu ou non rapporté` },
  en: { cases: "Confirmed cases", deaths: "Deaths", cfr: "CFR", incidence: "Incidence", date: "Report date", source: "Original WHO bulletin", officialSource: "Official source", description: "Summary", close: "Close", noData: "N/A", cfrFull: "Case fatality rate (CFR)", region: "Region", partialData: "Partial data — figures not available in this WHO report", dataAge: (d) => `${d} day${d > 1 ? "s" : ""} ago`, fresh: "Recent data", stale: "Old report", confirmedAge: (d) => `Source confirmed · ${d} day${d > 1 ? "s" : ""} ago`, staleConfirmed: "Primary source checked directly — no newer edition exists, not a data gap", incidencePer100k: "per 100,000 pop.", trendDelta: (delta, days) => `${delta > 0 ? "+" : ""}${delta} cases / ${days}d`, illustrative: "UNVERIFIED", illustrativeNotice: "Unverified placeholder figures — not yet matched to a confirmed WHO/official report. Treat with caution.", officialBadge: "OFFICIAL SOURCE", officialNotice: "Confirmed official source (WHO situation report, ECDC, or national Ministry of Health) — no WHO DON reference number. Data is reliable but not directly citable as a DON.", pressNotice: "General news outlet — figures reported by a media outlet, not by a health-authority bulletin. The link is readable, but cross-check against an official source before operational use.", pressSource: "Press article", fpGuidance: "Focal Point Guidance", tierLabels: { immediate: "IMMEDIATE · IHR NOTIFIABLE", rapid: "RAPID RESPONSE", monitor: "STANDARD MONITORING" }, firstActions: "First actions", reportingLag: "Report date reflects official sources — field onset may precede by days to weeks in remote zones", staleBulletin: (d) => `No official bulletin in ${d} day${d > 1 ? "s" : ""} — outbreak may be resolved or under-reported` },
  es: { cases: "Casos confirmados", deaths: "Fallecidos", cfr: "Letalidad", incidence: "Incidencia", date: "Informe del", source: "Boletín OMS original", officialSource: "Fuente oficial", description: "Resumen", close: "Cerrar", noData: "N/D", cfrFull: "Tasa de letalidad (CFR)", region: "Región", partialData: "Datos parciales — cifras no disponibles en este informe OMS", dataAge: (d) => `Hace ${d} día${d > 1 ? "s" : ""}`, fresh: "Datos recientes", stale: "Informe antiguo", confirmedAge: (d) => `Fuente confirmada · hace ${d} día${d > 1 ? "s" : ""}`, staleConfirmed: "Fuente oficial verificada directamente — no existe edición más reciente, no es una laguna de datos", incidencePer100k: "por 100.000 hab.", trendDelta: (delta, days) => `${delta > 0 ? "+" : ""}${delta} casos / ${days}d`, illustrative: "NO VERIFICADO", illustrativeNotice: "Cifras provisionales no verificadas — aún no vinculadas a un informe oficial/OMS confirmado. Usar con precaución.", officialBadge: "FUENTE OFICIAL", officialNotice: "Fuente oficial confirmada (informe OMS, ECDC o ministerio de salud) — sin número de boletín DON. Datos fiables, no citables directamente como DON.", pressNotice: "Prensa generalista — cifras publicadas por un medio, no por un boletín de una agencia sanitaria. El enlace es consultable, pero verifíquelo con una fuente oficial antes de usarlo operativamente.", pressSource: "Artículo de prensa", fpGuidance: "Guía del Punto focal", tierLabels: { immediate: "INMEDIATO · NOTIFICABLE RSI", rapid: "RESPUESTA RÁPIDA", monitor: "VIGILANCIA ESTÁNDAR" }, firstActions: "Primeras acciones", reportingLag: "Fecha basada en fuentes oficiales — el inicio clínico puede preceder días o semanas en zonas remotas", staleBulletin: (d) => `Sin boletín oficial en ${d} día${d > 1 ? "s" : ""} — el brote puede estar resuelto o sin reportar` },
  ar: { cases: "الحالات المؤكدة", deaths: "الوفيات", cfr: "معدل الوفيات", incidence: "معدل الإصابة", date: "تاريخ التقرير", source: "النشرة الرسمية لـ OMS", officialSource: "المصدر الرسمي", description: "ملخص", close: "إغلاق", noData: "غ/م", cfrFull: "معدل إماتة الحالات (CFR)", region: "المنطقة", partialData: "بيانات جزئية — الأرقام غير متوفرة في هذا التقرير", dataAge: (d) => `منذ ${d} يوم`, fresh: "بيانات حديثة", stale: "تقرير قديم", confirmedAge: (d) => `منذ ${d} يوم · تم تأكيد المصدر`, staleConfirmed: "تم التحقق من المصدر الرسمي مباشرة — لا توجد نشرة أحدث، وليس فجوة بيانات", incidencePer100k: "لكل 100,000 ساكن", trendDelta: (delta, days) => `${delta > 0 ? "+" : ""}${delta} حالة / ${days} يوم`, illustrative: "غير مؤكد", illustrativeNotice: "أرقام تجريبية غير مؤكدة — لم تُربط بعد بتقرير رسمي مؤكد لمنظمة الصحة العالمية. يُرجى التعامل معها بحذر.", officialBadge: "مصدر رسمي", officialNotice: "مصدر رسمي مؤكد (تقرير منظمة الصحة العالمية أو المركز الأوروبي للوقاية أو وزارة الصحة) — بدون رقم نشرة DON. البيانات موثوقة لكنها غير قابلة للاستشهاد مباشرة.", pressNotice: "صحافة عامة — أرقام نشرها منبر إعلامي، وليست صادرة عن نشرة وكالة صحية. الرابط متاح للقراءة، لكن يجب التحقق منه من مصدر رسمي قبل أي استخدام تنفيذي.", pressSource: "مقال صحفي", fpGuidance: "توجيهات نقطة الاتصال", tierLabels: { immediate: "فوري · إخطار إلزامي (اللوائح الصحية الدولية)", rapid: "استجابة سريعة", monitor: "مراقبة روتينية" }, firstActions: "الإجراءات الأولى", reportingLag: "التاريخ يعكس المصادر الرسمية — قد يسبق بدء الحالات الميدانية أياماً إلى أسابيع في المناطق النائية", staleBulletin: (d) => `لا نشرة رسمية منذ ${d} يوم — قد يكون الوباء محلولاً أو غير مُبلَّغ عنه` },
  id: { cases: "Kasus terkonfirmasi", deaths: "Kematian", cfr: "CFR", incidence: "Insidensi", date: "Tanggal laporan", source: "Buletin WHO asli", officialSource: "Sumber resmi", description: "Ringkasan", close: "Tutup", noData: "T/S", cfrFull: "Tingkat kematian kasus (CFR)", region: "Wilayah", partialData: "Data parsial — angka tidak tersedia dalam laporan WHO ini", dataAge: (d) => `${d} hari lalu`, fresh: "Data terbaru", stale: "Laporan lama", confirmedAge: (d) => `Sumber dikonfirmasi · ${d} hari lalu`, staleConfirmed: "Sumber resmi diperiksa langsung — tidak ada edisi lebih baru, bukan celah data", incidencePer100k: "per 100.000 penduduk", trendDelta: (delta, days) => `${delta > 0 ? "+" : ""}${delta} kasus / ${days}h`, illustrative: "BELUM DIVERIFIKASI", illustrativeNotice: "Angka sementara yang belum diverifikasi — belum dikaitkan dengan laporan resmi/WHO yang terkonfirmasi. Gunakan dengan hati-hati.", officialBadge: "SUMBER RESMI", officialNotice: "Sumber resmi yang dikonfirmasi (laporan situasi WHO, ECDC, atau Kementerian Kesehatan) — tanpa nomor buletin DON WHO. Data dapat diandalkan namun tidak bisa dikutip langsung sebagai DON.", pressNotice: "Media pers umum — angka dilaporkan oleh media, bukan oleh buletin badan kesehatan. Tautannya dapat dibaca, tetapi verifikasi dengan sumber resmi sebelum digunakan secara operasional.", pressSource: "Artikel pers", fpGuidance: "Panduan Focal Point", tierLabels: { immediate: "SEGERA · WAJIB LAPOR IHR", rapid: "RESPONS CEPAT", monitor: "PEMANTAUAN STANDAR" }, firstActions: "Tindakan pertama", reportingLag: "Tanggal berdasarkan sumber resmi — onset lapangan bisa mendahului beberapa hari hingga minggu di wilayah terpencil", staleBulletin: (d) => `Tidak ada buletin resmi sejak ${d} hari — wabah mungkin sudah teratasi atau tidak dilaporkan` },
};

const DONOR_BRIEF_COPY: Record<string, {
  copy: string; copied: string;
  generate: (date: string, cases: number, disease: string, country: string, risk: string, pheic: boolean) => string;
}> = {
  fr: {
    copy: "Copier note donateur", copied: "Copié",
    generate: (date, cases, disease, country, risk, pheic) =>
      `Au ${date}, ${cases.toLocaleString("fr")} cas de ${disease} ont été signalés en ${country} (niveau de risque : ${risk.toUpperCase()}).${pheic ? " L'OMS a déclaré une Urgence de Santé Publique de Portée Internationale (USPPI)." : ""} Source : HealthWatch Global · healthwatch-global.com`,
  },
  en: {
    copy: "Copy donor brief", copied: "Copied",
    generate: (date, cases, disease, country, risk, pheic) =>
      `As of ${date}, ${cases.toLocaleString("en")} cases of ${disease} have been reported in ${country} (risk level: ${risk.toUpperCase()}).${pheic ? " WHO has declared a Public Health Emergency of International Concern (PHEIC)." : ""} Source: HealthWatch Global · healthwatch-global.com`,
  },
  es: {
    copy: "Copiar nota donante", copied: "Copiado",
    generate: (date, cases, disease, country, risk, pheic) =>
      `Al ${date}, se han notificado ${cases.toLocaleString("es")} casos de ${disease} en ${country} (nivel de riesgo: ${risk.toUpperCase()}).${pheic ? " La OMS ha declarado una Emergencia de Salud Pública de Importancia Internacional (ESPII)." : ""} Fuente: HealthWatch Global · healthwatch-global.com`,
  },
  ar: {
    copy: "نسخ ملاحظة المانح", copied: "تم النسخ",
    generate: (date, cases, disease, country, risk, pheic) =>
      `اعتباراً من ${date}، تم الإبلاغ عن ${cases.toLocaleString("ar-SA")} حالة ${disease} في ${country} (مستوى الخطر: ${risk.toUpperCase()}).${pheic ? " أعلنت منظمة الصحة العالمية حالة طوارئ صحية عامة تثير قلقاً دولياً (PHEIC)." : ""} المصدر: HealthWatch Global · healthwatch-global.com`,
  },
  id: {
    copy: "Salin ringkasan donor", copied: "Disalin",
    generate: (date, cases, disease, country, risk, pheic) =>
      `Per ${date}, ${cases.toLocaleString("id")} kasus ${disease} telah dilaporkan di ${country} (tingkat risiko: ${risk.toUpperCase()}).${pheic ? " WHO telah menyatakan Kedaruratan Kesehatan Masyarakat yang Meresahkan Dunia (PHEIC)." : ""} Sumber: HealthWatch Global · healthwatch-global.com`,
  },
};

const VSTATUS_STYLE: Record<string, string> = {
  suspected:           "bg-yellow-900/30 border-yellow-700/40 text-yellow-400",
  under_investigation: "bg-blue-900/30 border-blue-700/40 text-blue-400",
  confirmed:           "bg-green-900/30 border-green-700/40 text-green-400",
  closed:              "bg-gray-800/40 border-gray-700/40 text-gray-500",
};
const VSTATUS_LABELS: Record<string, Record<string, string>> = {
  fr: { suspected: "Suspecté",   under_investigation: "En investigation", confirmed: "Confirmé",      closed: "Clôturé"    },
  en: { suspected: "Suspected",  under_investigation: "Under investigation", confirmed: "Confirmed",  closed: "Closed"     },
  es: { suspected: "Sospechado", under_investigation: "En investigación",  confirmed: "Confirmado",   closed: "Cerrado"    },
  ar: { suspected: "مشتبه به",  under_investigation: "قيد التحقيق",       confirmed: "مؤكد",         closed: "مغلق"       },
  id: { suspected: "Diduga",     under_investigation: "Dalam investigasi", confirmed: "Terkonfirmasi", closed: "Tertutup"  },
};
const RPHASE_STYLE: Record<string, string> = {
  monitoring:      "bg-gray-800/40 border-gray-700/40 text-gray-400",
  investigating:   "bg-amber-900/30 border-amber-700/40 text-amber-400",
  active_response: "bg-red-900/30 border-red-700/40 text-red-400",
  contained:       "bg-green-900/30 border-green-700/40 text-green-400",
};
const RPHASE_LABELS: Record<string, Record<string, string>> = {
  fr: { monitoring: "Surveillance", investigating: "Investigation",  active_response: "Réponse active", contained: "Contenu"     },
  en: { monitoring: "Monitoring",   investigating: "Investigating",  active_response: "Active response", contained: "Contained"   },
  es: { monitoring: "Vigilancia",   investigating: "Investigación",  active_response: "Respuesta activa", contained: "Contenido"  },
  ar: { monitoring: "مراقبة",       investigating: "تحقيق",          active_response: "استجابة نشطة",    contained: "محتوى"      },
  id: { monitoring: "Pemantauan",   investigating: "Investigasi",    active_response: "Respons aktif",   contained: "Terkendali"  },
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

const TRIPWIRE_COPY: Record<string, {
  label: string; placeholder: string; set: string; setting: string; active: string;
  remove: string; linkCopied: string; copyLink: string;
}> = {
  fr: { label: "M'alerter quand les cas dépassent", placeholder: "5000", set: "Activer", setting: "Activation…", active: "Alerte active", remove: "Supprimer", linkCopied: "Lien copié !", copyLink: "Copier le lien" },
  en: { label: "Alert me when cases exceed", placeholder: "5000", set: "Set alert", setting: "Setting…", active: "Alert active", remove: "Remove", linkCopied: "Link copied!", copyLink: "Copy link" },
  es: { label: "Alertarme cuando los casos superen", placeholder: "5000", set: "Activar", setting: "Activando…", active: "Alerta activa", remove: "Eliminar", linkCopied: "¡Enlace copiado!", copyLink: "Copiar enlace" },
  ar: { label: "تنبيهي عند تجاوز الحالات", placeholder: "5000", set: "تفعيل", setting: "جارٍ التفعيل…", active: "تنبيه نشط", remove: "حذف", linkCopied: "تم نسخ الرابط", copyLink: "نسخ الرابط" },
  id: { label: "Beri tahu saya saat kasus melebihi", placeholder: "5000", set: "Aktifkan", setting: "Mengaktifkan…", active: "Peringatan aktif", remove: "Hapus", linkCopied: "Tautan disalin!", copyLink: "Salin tautan" },
};

const COMPARE_COPY: Record<string, { title: string; select: string; noHistory: string; metric: string; current: string; period: string; cases: string; deaths: string; cfr: string; risk: string; duration: string }> = {
  fr: { title: "Comparer avec un épisode précédent", select: "Sélectionner un épisode", noHistory: "Aucun épisode antérieur", metric: "Indicateur", current: "Actuel", period: "Période", cases: "Cas", deaths: "Décès", cfr: "Létalité", risk: "Risque", duration: "Durée (depuis début)" },
  en: { title: "Compare with a previous episode", select: "Select an episode", noHistory: "No previous episodes", metric: "Metric", current: "Current", period: "Period", cases: "Cases", deaths: "Deaths", cfr: "CFR", risk: "Risk", duration: "Duration (since onset)" },
  es: { title: "Comparar con un episodio anterior", select: "Seleccionar un episodio", noHistory: "Sin episodios anteriores", metric: "Indicador", current: "Actual", period: "Período", cases: "Casos", deaths: "Fallecidos", cfr: "Letalidad", risk: "Riesgo", duration: "Duración (desde inicio)" },
  ar: { title: "مقارنة مع حلقة سابقة", select: "اختر حلقة", noHistory: "لا توجد حلقات سابقة", metric: "المؤشر", current: "الحالي", period: "الفترة", cases: "الحالات", deaths: "الوفيات", cfr: "معدل الإماتة", risk: "الخطر", duration: "المدة (منذ البداية)" },
  id: { title: "Bandingkan dengan episode sebelumnya", select: "Pilih episode", noHistory: "Tidak ada episode sebelumnya", metric: "Metrik", current: "Saat ini", period: "Periode", cases: "Kasus", deaths: "Kematian", cfr: "CFR", risk: "Risiko", duration: "Durasi (sejak awal)" },
};

const IHR_COPY: Record<string, {
  badge: string; banner: string; btnLabel: string; btnCopied: string;
  notif: string; eventDesc: string; geo: string; onset: string;
  epi: string; pop: string; measures: string; src: string; lab: string; contact: string;
  notifDate: string; cases: string; deaths: string; per100k: string; fillIn: string; generatedVia: string;
}> = {
  fr: { badge: "RSI", banner: "Événement RSI enregistré — référencé au Siège OMS", btnLabel: "Générer notification Art. 6", btnCopied: "Copié !",
    notif: "NOTIFICATION RSI — ARTICLE 6 (IHR 2005)", eventDesc: "Description de l'événement", geo: "Zone géographique affectée",
    onset: "Date d'apparition des premiers cas", epi: "Données épidémiologiques", pop: "Population exposée / à risque",
    measures: "Mesures prises", src: "Source de l'information", lab: "Confirmation de laboratoire", contact: "Point focal RSI national",
    notifDate: "Date de notification", cases: "cas", deaths: "décès", per100k: "pour 100 000", fillIn: "à renseigner", generatedVia: "Généré via" },
  en: { badge: "IHR EVENT", banner: "Active IHR event — referenced at WHO HQ", btnLabel: "Generate Art. 6 notification", btnCopied: "Copied!",
    notif: "IHR NOTIFICATION — ARTICLE 6 (IHR 2005)", eventDesc: "Event description", geo: "Affected geographic area",
    onset: "Date of onset of first cases", epi: "Epidemiological data", pop: "Exposed / at-risk population",
    measures: "Measures taken", src: "Information source", lab: "Laboratory confirmation", contact: "National IHR focal point",
    notifDate: "Date of notification", cases: "cases", deaths: "deaths", per100k: "per 100,000", fillIn: "to fill in", generatedVia: "Generated via" },
  es: { badge: "EVENTO RSI", banner: "Evento RSI activo — referenciado en la sede de la OMS", btnLabel: "Generar notificación Art. 6", btnCopied: "¡Copiado!",
    notif: "NOTIFICACIÓN RSI — ARTÍCULO 6 (RSI 2005)", eventDesc: "Descripción del evento", geo: "Zona geográfica afectada",
    onset: "Fecha de aparición de los primeros casos", epi: "Datos epidemiológicos", pop: "Población expuesta / en riesgo",
    measures: "Medidas adoptadas", src: "Fuente de información", lab: "Confirmación de laboratorio", contact: "Punto focal RSI nacional",
    notifDate: "Fecha de notificación", cases: "casos", deaths: "fallecidos", per100k: "por 100.000", fillIn: "a completar", generatedVia: "Generado via" },
  ar: { badge: "حدث RSI", banner: "حدث RSI نشط — مسجل في المقر الرئيسي لمنظمة الصحة العالمية", btnLabel: "إنشاء إشعار المادة 6", btnCopied: "تم النسخ",
    notif: "إشعار اللوائح الصحية الدولية — المادة 6 (IHR 2005)", eventDesc: "وصف الحدث", geo: "المنطقة الجغرافية المتضررة",
    onset: "تاريخ ظهور أول حالة", epi: "البيانات الوبائية", pop: "السكان المعرضون / المعرضون للخطر",
    measures: "التدابير المتخذة", src: "مصدر المعلومات", lab: "التأكيد المخبري", contact: "نقطة الاتصال الوطنية لـ RSI",
    notifDate: "تاريخ الإشعار", cases: "حالات", deaths: "وفيات", per100k: "لكل 100,000", fillIn: "للإكمال", generatedVia: "تم التوليد عبر" },
  id: { badge: "KEJADIAN IHR", banner: "Kejadian IHR aktif — tercatat di Kantor Pusat WHO", btnLabel: "Buat notifikasi Pasal 6", btnCopied: "Disalin!",
    notif: "NOTIFIKASI IHR — PASAL 6 (IHR 2005)", eventDesc: "Deskripsi kejadian", geo: "Wilayah geografis yang terdampak",
    onset: "Tanggal onset kasus pertama", epi: "Data epidemiologi", pop: "Populasi yang terpapar / berisiko",
    measures: "Tindakan yang diambil", src: "Sumber informasi", lab: "Konfirmasi laboratorium", contact: "Focal point IHR nasional",
    notifDate: "Tanggal notifikasi", cases: "kasus", deaths: "kematian", per100k: "per 100.000", fillIn: "isi di sini", generatedVia: "Dibuat melalui" },
};

const NEIGHBOR_COPY: Record<string, { title: string; noNeighbors: string; km: string }> = {
  fr: { title: "Pays limitrophes actifs (< 1500 km)", noNeighbors: "Aucun foyer actif dans un rayon de 1500 km", km: "km" },
  en: { title: "Active neighboring outbreaks (< 1500 km)", noNeighbors: "No active outbreaks within 1500 km", km: "km" },
  es: { title: "Focos vecinos activos (< 1500 km)", noNeighbors: "Sin focos activos en un radio de 1500 km", km: "km" },
  ar: { title: "تفشيات نشطة في الدول المجاورة (< 1500 كم)", noNeighbors: "لا توجد تفشيات نشطة في نطاق 1500 كم", km: "كم" },
  id: { title: "Wabah aktif negara tetangga (< 1500 km)", noNeighbors: "Tidak ada wabah aktif dalam radius 1500 km", km: "km" },
};

const SUBSCRIBER_COPY: Record<string, {
  label: string; placeholder: string; add: string; save: string; saving: string;
  active: string; remove: string; emailList: string;
}> = {
  fr: { label: "Alertes email pour ce foyer :", placeholder: "email@exemple.fr", add: "Ajouter", save: "Enregistrer", saving: "Enregistrement…", active: "Liste active", remove: "Supprimer la liste", emailList: "emails enregistrés" },
  en: { label: "Email alerts for this outbreak:", placeholder: "email@example.com", add: "Add", save: "Save", saving: "Saving…", active: "Active list", remove: "Remove list", emailList: "emails saved" },
  es: { label: "Alertas de email para este brote:", placeholder: "email@ejemplo.com", add: "Agregar", save: "Guardar", saving: "Guardando…", active: "Lista activa", remove: "Eliminar lista", emailList: "emails guardados" },
  ar: { label: "تنبيهات البريد الإلكتروني لهذا التفشي:", placeholder: "email@example.com", add: "إضافة", save: "حفظ", saving: "جارٍ الحفظ…", active: "القائمة النشطة", remove: "حذف القائمة", emailList: "بريد إلكتروني محفوظ" },
  id: { label: "Peringatan email untuk wabah ini:", placeholder: "email@contoh.com", add: "Tambah", save: "Simpan", saving: "Menyimpan…", active: "Daftar aktif", remove: "Hapus daftar", emailList: "email tersimpan" },
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
interface NeighborOutbreak { id: string; disease: string; disease_en: string | null; disease_ar: string | null; country: string; country_en: string | null; country_ar: string | null; cases: number; deaths: number; risk_level: string; date: string; distKm: number; }
interface Note { id: string; note: string; status: string | null; author_email: string; user_id: string; created_at: string; }

const SITREP_COPY: Record<string, {
  header: string; src: string; disease: string; country: string; riskLevel: string;
  pheic: string; epiData: string; asOf: string; cases: string; deaths: string;
  cfr: string; incidence: string; verification: string; responsePhase: string;
  rt: string; rtNote: string; previousEpisodes: string; btnLabel: string; btnCopied: string;
}> = {
  fr: {
    header: "DRAFT SITREP", src: "Source : HealthWatch Global", disease: "Maladie", country: "Pays",
    riskLevel: "Niveau de risque", pheic: "⚠️ USPPI — Urgence de Santé Publique de Portée Internationale",
    epiData: "DONNÉES ÉPIDÉMIOLOGIQUES", asOf: "au", cases: "Cas", deaths: "Décès", cfr: "Létalité (CFR)",
    incidence: "Incidence", verification: "Vérification", responsePhase: "Phase de réponse",
    rt: "Rt estimé", rtNote: "estimation préliminaire",
    previousEpisodes: "ÉPISODES PRÉCÉDENTS", btnLabel: "Copier le sitrep", btnCopied: "Copié !",
  },
  en: {
    header: "SITREP DRAFT", src: "Source: HealthWatch Global", disease: "Disease", country: "Country",
    riskLevel: "Risk level", pheic: "⚠️ PHEIC — Public Health Emergency of International Concern",
    epiData: "EPIDEMIOLOGICAL DATA", asOf: "as of", cases: "Cases", deaths: "Deaths", cfr: "CFR",
    incidence: "Incidence", verification: "Verification", responsePhase: "Response phase",
    rt: "Rt estimated", rtNote: "preliminary estimate",
    previousEpisodes: "PREVIOUS EPISODES", btnLabel: "Copy sitrep", btnCopied: "Copied!",
  },
  es: {
    header: "BORRADOR DE SITREP", src: "Fuente: HealthWatch Global", disease: "Enfermedad", country: "País",
    riskLevel: "Nivel de riesgo", pheic: "⚠️ ESPII — Emergencia de Salud Pública de Importancia Internacional",
    epiData: "DATOS EPIDEMIOLÓGICOS", asOf: "al", cases: "Casos", deaths: "Fallecidos", cfr: "Letalidad (CFR)",
    incidence: "Incidencia", verification: "Verificación", responsePhase: "Fase de respuesta",
    rt: "Rt estimado", rtNote: "estimación preliminar",
    previousEpisodes: "EPISODIOS ANTERIORES", btnLabel: "Copiar sitrep", btnCopied: "¡Copiado!",
  },
  ar: {
    header: "مسودة تقرير الوضع", src: "المصدر: HealthWatch Global", disease: "المرض", country: "الدولة",
    riskLevel: "مستوى الخطر", pheic: "⚠️ طوارئ الصحة العمومية التي تثير قلقاً دولياً",
    epiData: "البيانات الوبائية", asOf: "بتاريخ", cases: "الحالات", deaths: "الوفيات", cfr: "معدل الإماتة",
    incidence: "معدل الإصابة", verification: "التحقق", responsePhase: "مرحلة الاستجابة",
    rt: "Rt المُقدَّر", rtNote: "تقدير أولي",
    previousEpisodes: "حلقات سابقة", btnLabel: "نسخ تقرير الوضع", btnCopied: "تم النسخ",
  },
  id: {
    header: "DRAFT SITREP", src: "Sumber: HealthWatch Global", disease: "Penyakit", country: "Negara",
    riskLevel: "Tingkat risiko", pheic: "⚠️ KKMMD — Kedaruratan Kesehatan Masyarakat yang Meresahkan Dunia",
    epiData: "DATA EPIDEMIOLOGI", asOf: "per", cases: "Kasus", deaths: "Kematian", cfr: "CFR",
    incidence: "Insidensi", verification: "Verifikasi", responsePhase: "Fase respons",
    rt: "Rt perkiraan", rtNote: "perkiraan awal",
    previousEpisodes: "EPISODE SEBELUMNYA", btnLabel: "Salin sitrep", btnCopied: "Disalin!",
  },
};

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
  const numLocale = locale === "ar" ? "ar-SA" : (locale || "en");
  const { openModal } = useUpgradeModal();

  const [snapshots,      setSnapshots]      = useState<Snapshot[]>([]);
  const [pastOutbreaks,  setPastOutbreaks]  = useState<PastOutbreak[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const [sitrepCopied,  setSitrepCopied]  = useState(false);
  const [linkCopied,    setLinkCopied]    = useState(false);

  // Tripwire state
  const [tripwire,      setTripwire]      = useState<{ id: string; threshold_cases: number } | null>(null);
  const [tripwireInput, setTripwireInput] = useState<number | "">("");
  const [tripwireSaving, setTripwireSaving] = useState(false);

  // Comparison state
  const [compareIdx,   setCompareIdx]   = useState<number>(-1);

  // IHR Article 6 copy
  const [ihrCopied,    setIhrCopied]    = useState(false);

  // P4 — historical outbreak frequency for this country
  const [historyByCountry,        setHistoryByCountry]        = useState<{ year: number; total: number; high: number; medium: number; low: number }[]>([]);
  const [historyByCountryLoading, setHistoryByCountryLoading] = useState(false);

  // Neighboring country outbreaks
  const [neighborOutbreaks, setNeighborOutbreaks] = useState<NeighborOutbreak[]>([]);
  const [neighborLoading,   setNeighborLoading]   = useState(false);

  // Subscriber email list
  const [subscriberEmails,  setSubscriberEmails]  = useState<string[]>([]);
  const [subscriberInput,   setSubscriberInput]   = useState("");
  const [subscriberSaving,  setSubscriberSaving]  = useState(false);

  const [notes,       setNotes]       = useState<Note[]>([]);
  const [noteText,    setNoteText]    = useState("");
  const [noteStatus,  setNoteStatus]  = useState<string>("");
  const [submitting,  setSubmitting]  = useState(false);
  const [briefCopied, setBriefCopied] = useState(false);

  // Fetch notes
  useEffect(() => {
    if (!outbreak || !isPaid) return;
    setNotes([]);
    fetch(`/api/outbreak-notes?outbreak_id=${outbreak.id}`)
      .then((r) => r.json())
      .then((d) => { if (d.notes) setNotes(d.notes); })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // Fetch existing tripwire for this outbreak
  useEffect(() => {
    if (!outbreak || !isPaid) return;
    setTripwire(null);
    setTripwireInput("");
    setCompareIdx(-1);
    fetch(`/api/tripwires?outbreak_id=${outbreak.id}`)
      .then((r) => r.json())
      .then((d) => {
        const tw = d.tripwires?.[0];
        if (tw) { setTripwire(tw); setTripwireInput(tw.threshold_cases); }
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outbreak?.id, isPaid]);

  // P3 — fetch neighboring country outbreaks
  useEffect(() => {
    if (!outbreak || !isPaid) return;
    setNeighborOutbreaks([]);
    setNeighborLoading(true);
    const params = new URLSearchParams({ country_en: outbreak.country_en ?? "" });
    if (outbreak.lat) params.set("lat", String(outbreak.lat));
    if (outbreak.lng) params.set("lng", String(outbreak.lng));
    fetch(`/api/outbreak-neighbors?${params}`)
      .then((r) => r.json())
      .then((d) => { if (d.neighbors) setNeighborOutbreaks(d.neighbors); })
      .catch(() => {})
      .finally(() => setNeighborLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outbreak?.id, isPaid]);

  // P4 — fetch existing subscriber email list
  useEffect(() => {
    if (!outbreak || !isPaid) return;
    setSubscriberEmails([]);
    setSubscriberInput("");
    fetch(`/api/outbreak-subscribers?outbreak_id=${outbreak.id}`)
      .then((r) => r.json())
      .then((d) => { if (d.subscriber?.emails) setSubscriberEmails(d.subscriber.emails); })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outbreak?.id, isPaid]);

  // P4 Osei-Bonsu — fetch historical outbreak frequency for this country
  useEffect(() => {
    if (!outbreak?.country_en || !isPaid) return;
    setHistoryByCountry([]);
    setHistoryByCountryLoading(true);
    fetch(`/api/outbreak-history-by-country?country_en=${encodeURIComponent(outbreak.country_en)}`)
      .then((r) => r.json())
      .then((d) => { if (d.history) setHistoryByCountry(d.history); })
      .catch(() => {})
      .finally(() => setHistoryByCountryLoading(false));
  }, [outbreak?.country_en, isPaid]);

  // Log outbreak view to org activity log (fire-and-forget, non-blocking)
  useEffect(() => {
    if (!outbreak || !isPaid) return;
    fetch("/api/org/activity", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "view_outbreak",
        metadata: {
          outbreak_id: outbreak.id,
          disease: outbreak.disease_en || outbreak.disease,
          country: outbreak.country_en || outbreak.country,
        },
      }),
    }).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outbreak?.id, isPaid]);

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
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
  const cfr        = hasData && outbreak.deaths !== null ? (outbreak.deaths / outbreak.cases * 100).toFixed(1) : null;
  const incidence  = getIncidenceRate(outbreak.cases, outbreak.country_en);

  // Data freshness. `new Date()` (not `Date.now()`) keeps this pure for
  // react-hooks/purity — see app/[locale]/page.tsx for the same idiom — and
  // day-granularity freshness needs no live tick: this modal only exists while
  // a marker's detail view is open, it isn't a long-lived countdown display.
  const now       = new Date();
  const daysSince = Math.floor((now.getTime() - new Date(outbreak.date).getTime()) / 86_400_000);

  // isSourceConfirmed means a human opened the primary source and found no
  // newer edition — the row is old, but it is not a data gap. Wiring it here
  // was missing until 2026-08-23: the pill below read a red "Rapport ancien"
  // on the exact rows OutbreakTable (l. ~1265) labels "✓ SOURCE CONFIRMÉE",
  // and on which the "may be resolved or unreported" warning twenty lines
  // down is already suppressed for that very reason. The card contradicted
  // both the table and itself. Deliberately NOT folded into isFresh: a
  // confirmed row is still old, so it gets a third, neutral state rather than
  // the green "recent data" promise.
  const sourceConfirmed = isSourceConfirmed(outbreak);
  const isFresh         = daysSince <= 7;
  const isConfirmedOld  = daysSince > 7 && sourceConfirmed;
  const isStale         = daysSince > 30 && !sourceConfirmed;

  // Four-tier source verification for this row (see lib/source-trust.ts).
  const status = sourceStatus(outbreak);

  // DON reference from source URL (e.g., "2026-DON603") — only for confirmed DON rows.
  const donRef = status === 'don' ? (outbreak.source?.match(/item\/([\w-]+)/)?.[1] ?? null) : null;

  // 'don' / 'official' / 'press' rows all have a real, allowlisted publisher URL and get a
  // source link, styled per tier; 'unverified' rows (placeholder text, social media, blogs)
  // get no link and no publisher name.

  // A row confirmed current (isSourceConfirmed) isn't treated as stale here:
  // the "may be resolved or unreported" warning below would otherwise
  // contradict the "✓ source confirmed" badge shown for the same row in
  // OutbreakTable. See migration 20260822120000.
  const staleDaysRaw = staleOutbreakDays(outbreak);
  const staleDays = staleDaysRaw !== null && !sourceConfirmed ? staleDaysRaw : null;
  const guidance  = getResponseGuidance(outbreak.disease_en || outbreak.disease);
  const fpActions = RESPONSE_ACTIONS[guidance.tier][locale] ?? RESPONSE_ACTIONS[guidance.tier].en;
  const whyItMattersSignals = selectWhyItMattersSignals(outbreak, trend, staleDays !== null);

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
              <PhaseBadge trend={trend} staleDays={staleDays} locale={locale} />
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
              {status === 'press' && (
                <span
                  title={c.pressNotice}
                  className="inline-flex items-center text-xs px-2 py-0.5 rounded-full bg-violet-900/30 border border-violet-700/50 text-violet-400 font-bold cursor-help"
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
              {outbreak.ihr_event_id && (
                <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-blue-900/40 border border-blue-700/50 text-blue-300 font-bold">
                  🔵 {(IHR_COPY[locale] ?? IHR_COPY.en).badge} #{outbreak.ihr_event_id}
                </span>
              )}
              {/* Verification status — hidden for default "suspected" to avoid noise */}
              {outbreak.verification_status && outbreak.verification_status !== "suspected" && (
                <span className={`inline-flex items-center text-xs px-2 py-0.5 rounded-full border font-medium ${VSTATUS_STYLE[outbreak.verification_status] ?? VSTATUS_STYLE.suspected}`}>
                  {(VSTATUS_LABELS[locale] ?? VSTATUS_LABELS.en)[outbreak.verification_status] ?? outbreak.verification_status}
                </span>
              )}
              {/* Response phase — hidden for default "monitoring" */}
              {outbreak.response_phase && outbreak.response_phase !== "monitoring" && (
                <span className={`inline-flex items-center text-xs px-2 py-0.5 rounded-full border font-medium ${RPHASE_STYLE[outbreak.response_phase] ?? RPHASE_STYLE.monitoring}`}>
                  {(RPHASE_LABELS[locale] ?? RPHASE_LABELS.en)[outbreak.response_phase] ?? outbreak.response_phase}
                </span>
              )}
            </div>
            {matchDisease(outbreak.disease_en || outbreak.disease).matched ? (
              <Link
                href={`/${locale}/disease/${diseaseToSlug(matchDisease(outbreak.disease_en || outbreak.disease).info.name_en)}`}
                onClick={onClose}
                className="text-xl font-bold text-white leading-tight hover:text-red-400 transition-colors"
              >
                {disease}
              </Link>
            ) : (
              <p className="text-xl font-bold text-white leading-tight">{disease}</p>
            )}
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
            {/* Full analysis page */}
            <Link
              href={`/${locale}/outbreak/${outbreak.id}`}
              onClick={onClose}
              title={locale === "fr" ? "Analyse complète (graphique, Rt, tendance)" :
                     locale === "es" ? "Análisis completo (gráfico, Rt, tendencia)" :
                     locale === "ar" ? "التحليل الكامل (رسم بياني، Rt، الاتجاه)" :
                     locale === "id" ? "Analisis lengkap (grafik, Rt, tren)" :
                     "Full analysis (chart, Rt, trend)"}
              className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
            </Link>
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
                ? (hasData ? outbreak.cases.toLocaleString(numLocale) : <span className="text-gray-600 text-sm italic">{c.noData}</span>)
                : <span className="blur-sm select-none cursor-pointer" onClick={() => openModal("cases")}>{outbreak.cases.toLocaleString(numLocale)}</span>
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
                ? outbreak.deaths !== null
                  ? outbreak.deaths.toLocaleString(numLocale)
                  : <span className="text-gray-500 text-sm" title="Non rapporté dans cette source">—</span>
                : outbreak.deaths !== null
                  ? <span className="blur-sm select-none cursor-pointer" onClick={() => openModal("cases")}>{outbreak.deaths.toLocaleString(numLocale)}</span>
                  : <span className="text-gray-600 text-sm">—</span>
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
                : cfr
                  ? <span className="blur-sm select-none cursor-pointer" onClick={() => openModal("cases")}>{cfr}%</span>
                  : <span className="text-gray-600 text-sm italic">{c.noData}</span>
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

        {/* ── Why it matters — synthesis, visible to all plans ────────────── */}
        {whyItMattersSignals.length > 0 && (
          <div className="bg-red-950/10 border border-red-900/30 rounded-xl p-4 space-y-1.5">
            {whyItMattersSignals.map((signal) => (
              <p key={signal} className="text-sm text-gray-300 flex items-start gap-2">
                <span className="text-red-400 shrink-0 mt-0.5">•</span>
                <span>{whyItMattersCopy(signal, locale, trend?.deltaPercent)}</span>
              </p>
            ))}
          </div>
        )}

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
                          <span>{p.cases.toLocaleString(numLocale)} {hc.peak}</span>
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

        {/* ── Historical outbreak frequency by country ─────────────────── */}
        {isPaid && (() => {
          const label = locale === "fr" ? "Fréquence historique des foyers" :
                        locale === "es" ? "Frecuencia histórica de brotes" :
                        locale === "ar" ? "التكرار التاريخي للتفشيات" :
                        locale === "id" ? "Frekuensi historis wabah" :
                        "Historical outbreak frequency";
          const maxTotal = Math.max(...historyByCountry.map((h) => h.total), 1);
          return (
            <div className="px-5 pb-4">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                {label} — {outbreak.country_en}
              </p>
              {historyByCountryLoading ? (
                <div className="h-4 w-32 bg-gray-800 rounded animate-pulse" />
              ) : historyByCountry.length === 0 ? (
                <p className="text-xs text-gray-600 italic">
                  {locale === "fr" ? "Aucune donnée historique" : locale === "es" ? "Sin datos históricos" : "No historical data"}
                </p>
              ) : (
                <div className="space-y-1.5">
                  {historyByCountry.map((h) => (
                    <div key={h.year} className="flex items-center gap-2">
                      <span className="text-[10px] text-gray-500 w-9 shrink-0 tabular-nums">{h.year}</span>
                      <div className="flex-1 flex rounded overflow-hidden h-3 bg-gray-800/60">
                        {h.high   > 0 && <div style={{ width: `${h.high   / maxTotal * 100}%` }} className="bg-red-500/60" title={`High: ${h.high}`} />}
                        {h.medium > 0 && <div style={{ width: `${h.medium / maxTotal * 100}%` }} className="bg-amber-500/60" title={`Medium: ${h.medium}`} />}
                        {h.low    > 0 && <div style={{ width: `${h.low    / maxTotal * 100}%` }} className="bg-green-500/60" title={`Low: ${h.low}`} />}
                      </div>
                      <span className="text-[10px] text-gray-400 w-4 shrink-0 tabular-nums text-right">{h.total}</span>
                    </div>
                  ))}
                  <div className="flex items-center gap-3 mt-1">
                    {[["bg-red-500/60", locale === "fr" ? "Élevé" : "High"], ["bg-amber-500/60", locale === "fr" ? "Modéré" : "Medium"], ["bg-green-500/60", locale === "fr" ? "Faible" : "Low"]].map(([cls, lbl]) => (
                      <span key={lbl} className="flex items-center gap-1 text-[9px] text-gray-600">
                        <span className={`w-2 h-2 rounded-sm ${cls}`} />{lbl}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })()}

        {/* Epidemic curve teaser for free users */}
        {!isPaid && (
          <div className="px-5 pb-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              {locale === "fr" ? "Courbe épidémique" : locale === "es" ? "Curva epidémica" : locale === "ar" ? "منحنى الوباء" : locale === "id" ? "Kurva epidemi" : "Epidemic curve"}
            </p>
            <div
              className="relative rounded-xl border border-gray-800/60 bg-gray-900/40 h-[100px] overflow-hidden cursor-pointer"
              onClick={() => openModal("cases")}
            >
              {/* Blurred fake curve */}
              <svg className="absolute inset-0 w-full h-full blur-[3px] opacity-30" viewBox="0 0 300 100" preserveAspectRatio="none">
                <polyline
                  points="0,90 30,85 60,78 90,65 120,45 150,30 180,22 210,28 240,40 270,55 300,62"
                  fill="none"
                  stroke="#ef4444"
                  strokeWidth="2.5"
                  strokeLinejoin="round"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center gap-2">
                <Activity className="w-4 h-4 text-gray-600" />
                <span className="text-xs text-gray-600 font-medium">
                  {locale === "fr" ? "Graphique disponible — Pro" : locale === "es" ? "Gráfico disponible — Pro" : locale === "ar" ? "الرسم متاح — Pro" : locale === "id" ? "Grafik tersedia — Pro" : "Chart available — Pro"}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Unlock prompt for free users — outbreak-specific to drive conversion */}
        {!isPaid && (
          <div className="mx-5 mb-3 rounded-xl bg-amber-900/10 border border-amber-700/20 p-3 space-y-2">
            <p className="text-xs text-amber-300 font-semibold">
              {locale === "fr"
                ? `Suivez ${getLocalizedDisease(outbreak, locale)} en temps réel`
                : locale === "es"
                ? `Siga ${getLocalizedDisease(outbreak, locale)} en tiempo real`
                : locale === "ar"
                ? `تابع ${getLocalizedDisease(outbreak, locale)} في الوقت الفعلي`
                : locale === "id"
                ? `Pantau ${getLocalizedDisease(outbreak, locale)} secara real-time`
                : `Track ${getLocalizedDisease(outbreak, locale)} in real time`}
            </p>
            <p className="text-xs text-gray-500">
              {locale === "fr"
                ? "Chiffres exacts · Alertes instantanées quand de nouveaux cas sont signalés · Graphique d'évolution · Export CSV"
                : locale === "es"
                ? "Cifras exactas · Alertas al instante cuando se notifican nuevos casos · Gráfico de evolución · Exportación CSV"
                : locale === "ar"
                ? "أرقام دقيقة · تنبيهات فورية عند تسجيل حالات جديدة · مخطط تطور · تصدير CSV"
                : locale === "id"
                ? "Angka tepat · Peringatan instan saat kasus baru dilaporkan · Grafik perkembangan · Ekspor CSV"
                : "Exact figures · Instant alerts when new cases are reported · Case chart · CSV export"}
            </p>
            <LockedUpgradeButton
              feature="cases"
              label={
                locale === "fr" ? "Commencer l'essai gratuit →" :
                locale === "es" ? "Iniciar prueba gratuita →" :
                locale === "ar" ? "← ابدأ التجربة المجانية" :
                locale === "id" ? "Mulai uji coba gratis →" :
                "Start 14-day free trial →"
              }
              variant="banner"
            />
          </div>
        )}

        {/* IHR event banner */}
        {outbreak.ihr_event_id && (
          <div className="mx-5 mb-3 flex items-start gap-2 bg-blue-900/20 border border-blue-700/30 rounded-xl p-3 text-xs text-blue-300">
            <span className="shrink-0 text-base">🔵</span>
            <span>{(IHR_COPY[locale] ?? IHR_COPY.en).banner} — <strong className="font-semibold">#{outbreak.ihr_event_id}</strong></span>
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
        {status === 'press' && (
          <div className="mx-5 mb-3 flex items-start gap-2 bg-violet-900/10 border border-violet-700/30 rounded-xl p-3 text-xs text-violet-300/80">
            <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            {c.pressNotice}
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
            <span
              title={isConfirmedOld ? c.staleConfirmed : undefined}
              className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border shrink-0 ${
              isFresh        ? "bg-green-900/20 border-green-800/30 text-green-400" :
              isConfirmedOld ? "bg-slate-800/50 border-slate-600/50 text-slate-300 cursor-help" :
              isStale        ? "bg-red-900/20 border-red-800/30 text-red-400" :
                               "bg-amber-900/20 border-amber-800/30 text-amber-400"
            }`}>
              <Clock className="w-3 h-3" />
              {isFresh ? c.fresh : isConfirmedOld ? c.confirmedAge(daysSince) : isStale ? c.stale : c.dataAge(daysSince)}
            </span>
          </div>

          <div className="flex items-center gap-2 text-gray-400">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            <span>{c.region} :</span>
            <span className="text-gray-300">
              {(REGION_NAMES[locale] ?? REGION_NAMES.en)[outbreak.region] ?? outbreak.region}
            </span>
          </div>
          {hasRealAdmin1(outbreak.admin1) && (
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
          <p className="text-[10px] text-gray-500 leading-snug flex items-center gap-1 mt-0.5">
            <Info className="w-3 h-3 shrink-0 text-gray-600" />
            {locale === "fr" ? "Cas confirmés + probables — agrégés OMS, ECDC, OPAS et Africa CDC" :
             locale === "es" ? "Casos confirmados + probables — agregados OMS, ECDC, PAHO y Africa CDC" :
             locale === "ar" ? "الحالات المؤكدة + المحتملة — مجمّعة من WHO وECDC وPAHO وAfrica CDC" :
             locale === "id" ? "Kasus terkonfirmasi + probable — agregat WHO, ECDC, PAHO dan Africa CDC" :
             "Confirmed + probable cases — aggregated from WHO, ECDC, PAHO & Africa CDC"}
          </p>
          {/* Reads outbreak.date (the source bulletin's own date), not updated_at
              (our last DB write) — see freshOutbreakHours in lib/outbreaks.ts for
              why. Date-only formatting (no hour/minute) matches date's own
              precision: it never carries a time-of-day. */}
          {outbreak.date && (
            <p className="text-[10px] text-gray-600 leading-snug flex items-center gap-1">
              <Clock className="w-3 h-3 shrink-0" />
              {locale === "fr" ? "Bulletin du" :
               locale === "es" ? "Boletín del" :
               locale === "ar" ? "نشرة" :
               locale === "id" ? "Buletin" :
               "Bulletin dated"}{" "}
              <span className="text-gray-500">
                {new Date(outbreak.date).toLocaleDateString(
                  locale === "fr" ? "fr-FR" : locale === "es" ? "es-ES" : locale === "ar" ? "ar-SA" : locale === "id" ? "id-ID" : "en-GB",
                  { day: "numeric", month: "short", year: "numeric" }
                )}
              </span>
            </p>
          )}
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

        {/* Sitrep draft + citation buttons */}
        {isPaid && (
          <div className="mx-5 mb-3 flex items-center gap-4 flex-wrap">
            {/* Copy sitrep — available for all paid users */}
            <button
              onClick={async () => {
                const sc = SITREP_COPY[locale] ?? SITREP_COPY.en;
                const today = new Date().toISOString().split("T")[0];
                const regionName = (REGION_NAMES[locale] ?? REGION_NAMES.en)[outbreak.region] ?? outbreak.region;
                const vstatus = (VSTATUS_LABELS[locale] ?? VSTATUS_LABELS.en)[outbreak.verification_status ?? "suspected"] ?? outbreak.verification_status;
                const rphase  = (RPHASE_LABELS[locale] ?? RPHASE_LABELS.en)[outbreak.response_phase  ?? "monitoring"] ?? outbreak.response_phase;
                const riskLabel = (({ high: { fr:"ÉLEVÉ",en:"HIGH",es:"ALTO",ar:"عالٍ",id:"TINGGI" }, medium: { fr:"MODÉRÉ",en:"MEDIUM",es:"MEDIO",ar:"متوسط",id:"SEDANG" }, low: { fr:"FAIBLE",en:"LOW",es:"BAJO",ar:"منخفض",id:"RENDAH" } } as Record<string,Record<string,string>>)[outbreak.risk_level]?.[locale]) ?? outbreak.risk_level.toUpperCase();
                const metrics = snapshots.length > 1 ? computeEpidemicMetrics(snapshots.map((s) => ({ snapped_at: s.snapped_at, cases: s.cases })), outbreak.disease_en) : null;

                const lines: (string | null)[] = [
                  `${sc.header} — ${today}`,
                  sc.src,
                  "",
                  `${sc.disease}: ${disease}`,
                  `${sc.country}: ${country} (${regionName})`,
                  `${sc.riskLevel}: ${riskLabel}`,
                  outbreak.is_pheic ? sc.pheic : null,
                  "",
                  `${sc.epiData} (${sc.asOf} ${outbreak.date}):`,
                  outbreak.cases > 0 ? `• ${sc.cases}: ${outbreak.cases.toLocaleString(numLocale)}` : null,
                  outbreak.deaths !== null && outbreak.deaths > 0 ? `• ${sc.deaths}: ${outbreak.deaths.toLocaleString(numLocale)}` : null,
                  cfr ? `• ${sc.cfr}: ${cfr}%` : null,
                  incidence ? `• ${sc.incidence}: ${incidence} ${c.incidencePer100k}` : null,
                  "",
                  `${sc.verification}: ${vstatus}`,
                  `${sc.responsePhase}: ${rphase}`,
                  metrics && metrics.trend !== "insufficient_data" && metrics.rtEstimate !== null
                    ? `${sc.rt}: ${metrics.rtEstimate.toFixed(2)} (${metrics.rtConfidence ?? ""}) — ${sc.rtNote}`
                    : null,
                  pastOutbreaks.length > 0 ? "" : null,
                  pastOutbreaks.length > 0 ? `${sc.previousEpisodes}:` : null,
                  ...pastOutbreaks.slice(0, 3).map((p) => {
                    const pcfr = p.cases > 0 ? (p.deaths / p.cases * 100).toFixed(1) : null;
                    return `• ${p.date.slice(0, 7)} — ${p.cases.toLocaleString(numLocale)} ${sc.cases.toLowerCase()}${pcfr ? `, CFR ${pcfr}%` : ""}`;
                  }),
                  "",
                  `${today} | healthwatch-global.com/${locale}`,
                ];
                await navigator.clipboard.writeText(lines.filter((l) => l !== null).join("\n"));
                setSitrepCopied(true);
                setTimeout(() => setSitrepCopied(false), 2500);
              }}
              className={`flex items-center gap-2 text-xs transition-colors ${sitrepCopied ? "text-green-400" : "text-gray-400 hover:text-white"}`}
            >
              {sitrepCopied ? <Check className="w-3 h-3" /> : <FileText className="w-3 h-3" />}
              {(SITREP_COPY[locale] ?? SITREP_COPY.en)[sitrepCopied ? "btnCopied" : "btnLabel"]}
            </button>

            {/* Citation — only for WHO DON rows */}
            {status === 'don' && (
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
            )}

            {/* P4 — Deep link copy */}
            <button
              onClick={async () => {
                await navigator.clipboard.writeText(`${window.location.origin}/${locale}?outbreak=${outbreak.id}`);
                setLinkCopied(true);
                setTimeout(() => setLinkCopied(false), 2000);
              }}
              className={`flex items-center gap-2 text-xs transition-colors ${linkCopied ? "text-green-400" : "text-gray-500 hover:text-gray-300"}`}
            >
              {linkCopied ? <Check className="w-3 h-3" /> : <LinkIcon className="w-3 h-3" />}
              {(TRIPWIRE_COPY[locale] ?? TRIPWIRE_COPY.en)[linkCopied ? "linkCopied" : "copyLink"]}
            </button>

            {/* P2 — IHR Article 6 notification template */}
            <button
              onClick={async () => {
                const ic = IHR_COPY[locale] ?? IHR_COPY.en;
                const cfr = outbreak.cases > 0 && outbreak.deaths !== null ? (outbreak.deaths / outbreak.cases * 100).toFixed(1) : "N/A";
                const incidence = getIncidenceRate(outbreak.cases, outbreak.country_en);
                const text = [
                  ic.notif,
                  `${ic.notifDate}: ${new Date().toISOString().split("T")[0]}`,
                  "",
                  `1. ${ic.eventDesc}: ${disease} (${country})`,
                  `2. ${ic.geo}: ${country}${hasRealAdmin1(outbreak.admin1) ? `, ${outbreak.admin1}` : ""}`,
                  `3. ${ic.onset}: ${outbreak.date}`,
                  `4. ${ic.epi}: ${outbreak.cases.toLocaleString(numLocale)} ${ic.cases}${outbreak.deaths !== null ? ` / ${outbreak.deaths.toLocaleString(numLocale)} ${ic.deaths}` : ""} / CFR ${cfr}%${incidence ? ` / ${incidence.toFixed(1)} ${ic.per100k}` : ""}`,
                  `5. ${ic.pop}: [${ic.fillIn}]`,
                  `6. ${ic.measures}: [${ic.fillIn}]`,
                  `7. ${ic.src}: HealthWatch Global / ${outbreak.source || "OMS / WHO"}`,
                  `8. ${ic.lab}: [${ic.fillIn}]`,
                  `9. ${ic.contact}: [${ic.fillIn}]`,
                  "",
                  `--- ${ic.generatedVia} HealthWatch Global — https://healthwatch-global.com`,
                ].join("\n");
                await navigator.clipboard.writeText(text);
                setIhrCopied(true);
                setTimeout(() => setIhrCopied(false), 2500);
              }}
              className={`flex items-center gap-2 text-xs transition-colors ${ihrCopied ? "text-green-400" : "text-gray-500 hover:text-gray-300"}`}
            >
              {ihrCopied ? <Check className="w-3 h-3" /> : <FileText className="w-3 h-3" />}
              {(IHR_COPY[locale] ?? IHR_COPY.en)[ihrCopied ? "btnCopied" : "btnLabel"]}
            </button>
          </div>
        )}

        {/* P1 — Tripwire: case-threshold alert */}
        {isPaid && (
          <div className="mx-5 mb-3 flex items-center gap-2 flex-wrap">
            {tripwire ? (
              <div className="flex items-center gap-2 text-xs flex-wrap">
                <span className="text-amber-400 font-medium">
                  🔔 {(TRIPWIRE_COPY[locale] ?? TRIPWIRE_COPY.en).active} — {tripwire.threshold_cases.toLocaleString(numLocale)} {(COMPARE_COPY[locale] ?? COMPARE_COPY.en).cases.toLowerCase()}
                </span>
                <button
                  onClick={async () => {
                    await fetch(`/api/tripwires/${outbreak.id}`, { method: "DELETE" });
                    setTripwire(null);
                    setTripwireInput("");
                  }}
                  className="text-gray-600 hover:text-red-400 transition-colors text-[10px] underline underline-offset-2"
                >
                  {(TRIPWIRE_COPY[locale] ?? TRIPWIRE_COPY.en).remove}
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-xs text-gray-500">{(TRIPWIRE_COPY[locale] ?? TRIPWIRE_COPY.en).label}</span>
                <input
                  type="number"
                  min="1"
                  value={tripwireInput}
                  onChange={(e) => setTripwireInput(e.target.value === "" ? "" : Number(e.target.value))}
                  placeholder={(TRIPWIRE_COPY[locale] ?? TRIPWIRE_COPY.en).placeholder}
                  className="w-24 bg-gray-800 border border-gray-700 rounded-lg px-2 py-1 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-amber-500"
                />
                <span className="text-xs text-gray-500">{(COMPARE_COPY[locale] ?? COMPARE_COPY.en).cases.toLowerCase()}</span>
                <button
                  disabled={tripwireInput === "" || tripwireSaving}
                  onClick={async () => {
                    if (tripwireInput === "") return;
                    setTripwireSaving(true);
                    try {
                      const res = await fetch("/api/tripwires", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ outbreak_id: outbreak.id, threshold_cases: Number(tripwireInput), email: "" }),
                      });
                      const d = await res.json();
                      if (d.tripwire) setTripwire(d.tripwire);
                    } catch { /* ignore */ } finally { setTripwireSaving(false); }
                  }}
                  className="text-xs px-2 py-1 bg-amber-700/40 hover:bg-amber-700/60 disabled:opacity-40 border border-amber-700/40 text-amber-300 rounded-lg transition-colors"
                >
                  {tripwireSaving ? (TRIPWIRE_COPY[locale] ?? TRIPWIRE_COPY.en).setting : (TRIPWIRE_COPY[locale] ?? TRIPWIRE_COPY.en).set}
                </button>
              </div>
            )}
          </div>
        )}

        {/* P2 — Historical comparison */}
        {isPaid && pastOutbreaks.length > 0 && (() => {
          const cc = COMPARE_COPY[locale] ?? COMPARE_COPY.en;
          const cmp = compareIdx >= 0 ? pastOutbreaks[compareIdx] ?? null : null;
          const cCFR  = outbreak.cases  > 0 && outbreak.deaths !== null ? (outbreak.deaths  / outbreak.cases  * 100).toFixed(1) : null;
          const pCFR  = cmp && cmp.cases > 0 ? (cmp.deaths / cmp.cases * 100).toFixed(1) : null;
          const ageCurrentDays  = Math.round((Date.now() - new Date(outbreak.date).getTime()) / 86400000);
          const agePastDays     = cmp ? Math.round((Date.now() - new Date(cmp.date).getTime()) / 86400000) : 0;
          return (
            <div className="mx-5 mb-3">
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">{cc.title}</span>
                <select
                  value={compareIdx}
                  onChange={(e) => setCompareIdx(Number(e.target.value))}
                  className="text-xs bg-gray-800 border border-gray-700 rounded-lg px-2 py-0.5 text-gray-300 focus:outline-none focus:border-blue-500"
                >
                  <option value={-1}>{cc.select}</option>
                  {pastOutbreaks.map((p, i) => (
                    <option key={p.id} value={i}>{p.date.slice(0, 7)} — {p.cases.toLocaleString(numLocale)} {cc.cases.toLowerCase()}</option>
                  ))}
                </select>
              </div>
              {cmp && (
                <div className="rounded-xl border border-gray-700/50 overflow-hidden text-xs">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-700/50 bg-gray-800/40">
                        <th className="text-left px-3 py-2 text-gray-500 font-medium">{cc.metric}</th>
                        <th className="text-right px-3 py-2 text-blue-400 font-medium">{cc.current}</th>
                        <th className="text-right px-3 py-2 text-gray-500 font-medium">{cmp.date.slice(0, 7)}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800/60">
                      <tr>
                        <td className="px-3 py-1.5 text-gray-500">{cc.cases}</td>
                        <td className="px-3 py-1.5 text-right text-white tabular-nums">{outbreak.cases.toLocaleString(numLocale)}</td>
                        <td className="px-3 py-1.5 text-right text-gray-400 tabular-nums">{cmp.cases.toLocaleString(numLocale)}</td>
                      </tr>
                      <tr>
                        <td className="px-3 py-1.5 text-gray-500">{cc.deaths}</td>
                        <td className="px-3 py-1.5 text-right text-white tabular-nums">{outbreak.deaths?.toLocaleString(numLocale) ?? "—"}</td>
                        <td className="px-3 py-1.5 text-right text-gray-400 tabular-nums">{cmp.deaths?.toLocaleString(numLocale) ?? "—"}</td>
                      </tr>
                      <tr>
                        <td className="px-3 py-1.5 text-gray-500">{cc.cfr}</td>
                        <td className="px-3 py-1.5 text-right text-white">{cCFR ? `${cCFR}%` : "—"}</td>
                        <td className="px-3 py-1.5 text-right text-gray-400">{pCFR ? `${pCFR}%` : "—"}</td>
                      </tr>
                      <tr>
                        <td className="px-3 py-1.5 text-gray-500">{cc.risk}</td>
                        <td className="px-3 py-1.5 text-right text-white capitalize">{outbreak.risk_level}</td>
                        <td className="px-3 py-1.5 text-right text-gray-400 capitalize">{cmp.risk_level}</td>
                      </tr>
                      <tr>
                        <td className="px-3 py-1.5 text-gray-500">{cc.duration}</td>
                        <td className="px-3 py-1.5 text-right text-white">{ageCurrentDays}d</td>
                        <td className="px-3 py-1.5 text-right text-gray-400">{agePastDays}d</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })()}

        {/* P1 — Vaccination coverage */}
        {isPaid && (() => {
          const cov = getVaccineCoverage(outbreak.disease_en, outbreak.country_en);
          if (!cov) return null;
          const barColor = cov.coverage >= 80 ? "bg-green-500" : cov.coverage >= 60 ? "bg-amber-500" : "bg-red-500";
          const label = cov.label[locale] ?? cov.label.en;
          const srcLabel = locale === "fr" ? "Source" : locale === "es" ? "Fuente" : locale === "ar" ? "المصدر" : locale === "id" ? "Sumber" : "Source";
          const titleLabel = locale === "fr" ? "Couverture vaccinale" : locale === "es" ? "Cobertura vacunal" : locale === "ar" ? "التغطية التطعيمية" : locale === "id" ? "Cakupan vaksin" : "Vaccination coverage";
          return (
            <div className="mx-5 mb-3">
              <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-2">{titleLabel}</p>
              <div className="rounded-xl border border-gray-700/50 bg-gray-800/30 p-3 space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs text-gray-300">{label}</span>
                  <span className={`text-sm font-bold tabular-nums ${cov.coverage >= 80 ? "text-green-400" : cov.coverage >= 60 ? "text-amber-400" : "text-red-400"}`}>
                    {cov.coverage}%
                  </span>
                </div>
                <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden">
                  <div className={`h-2 rounded-full transition-all ${barColor}`} style={{ width: `${cov.coverage}%` }} />
                </div>
                <p className="text-[9px] text-gray-700">{srcLabel}: {COVERAGE_SOURCE} {COVERAGE_YEAR} · {outbreak.country_en}</p>
              </div>
            </div>
          );
        })()}

        {/* P3 — Neighboring country outbreaks */}
        {isPaid && (
          <div className="mx-5 mb-3">
            <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-2">
              {(NEIGHBOR_COPY[locale] ?? NEIGHBOR_COPY.en).title}
            </p>
            {neighborLoading ? (
              <div className="h-4 w-32 bg-gray-800 rounded animate-pulse" />
            ) : neighborOutbreaks.length === 0 ? (
              <p className="text-xs text-gray-600 italic">{(NEIGHBOR_COPY[locale] ?? NEIGHBOR_COPY.en).noNeighbors}</p>
            ) : (
              <div className="space-y-1">
                {neighborOutbreaks.map((n) => (
                  <div key={n.id} className="flex items-center justify-between text-xs gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className={`shrink-0 w-1.5 h-1.5 rounded-full ${n.risk_level === "high" ? "bg-red-400" : n.risk_level === "medium" ? "bg-amber-400" : "bg-green-400"}`} />
                      <span className="text-gray-400 truncate">{getLocalizedDisease(n, locale) || "—"}</span>
                      <span className="text-gray-600">·</span>
                      <span className="text-gray-500 truncate">{getLocalizedCountry(n, locale) || "—"}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 text-gray-600">
                      <span className="tabular-nums">{n.cases.toLocaleString(numLocale)}</span>
                      <span className="text-[10px]">{n.distKm.toLocaleString(numLocale)} {(NEIGHBOR_COPY[locale] ?? NEIGHBOR_COPY.en).km}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* P4 — Outbreak subscriber email list */}
        {isPaid && (() => {
          const sc = SUBSCRIBER_COPY[locale] ?? SUBSCRIBER_COPY.en;
          return (
            <div className="mx-5 mb-3">
              <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-2">{sc.label}</p>
              {subscriberEmails.length > 0 ? (
                <div className="flex items-center gap-2 flex-wrap mb-2">
                  <span className="text-xs text-green-400">{sc.active} — {subscriberEmails.length} {sc.emailList}</span>
                  <button
                    onClick={async () => {
                      await fetch(`/api/outbreak-subscribers?outbreak_id=${outbreak.id}`, { method: "DELETE" });
                      setSubscriberEmails([]);
                    }}
                    className="text-[10px] text-gray-600 hover:text-red-400 transition-colors underline underline-offset-2"
                  >{sc.remove}</button>
                </div>
              ) : null}
              <div className="flex items-center gap-1.5 flex-wrap">
                <input
                  type="email"
                  value={subscriberInput}
                  onChange={(e) => setSubscriberInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key !== "Enter") return;
                    e.preventDefault();
                    const v = subscriberInput.trim();
                    if (v && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) && !subscriberEmails.includes(v)) {
                      setSubscriberEmails((prev) => [...prev, v]);
                      setSubscriberInput("");
                    }
                  }}
                  placeholder={sc.placeholder}
                  className="w-48 bg-gray-800 border border-gray-700 rounded-lg px-2 py-1 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-blue-500"
                />
                <button
                  onClick={() => {
                    const v = subscriberInput.trim();
                    if (v && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) && !subscriberEmails.includes(v)) {
                      setSubscriberEmails((prev) => [...prev, v]);
                      setSubscriberInput("");
                    }
                  }}
                  className="text-xs px-2 py-1 bg-gray-700/60 hover:bg-gray-700 border border-gray-600/40 text-gray-300 rounded-lg transition-colors"
                >{sc.add}</button>
                {subscriberEmails.length > 0 && (
                  <button
                    disabled={subscriberSaving}
                    onClick={async () => {
                      setSubscriberSaving(true);
                      try {
                        await fetch("/api/outbreak-subscribers", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ outbreak_id: outbreak.id, emails: subscriberEmails, locale }),
                        });
                      } catch { /* ignore */ } finally { setSubscriberSaving(false); }
                    }}
                    className="text-xs px-2 py-1 bg-blue-700/40 hover:bg-blue-700/60 disabled:opacity-40 border border-blue-700/40 text-blue-300 rounded-lg transition-colors"
                  >{subscriberSaving ? sc.saving : sc.save}</button>
                )}
              </div>
              {subscriberEmails.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {subscriberEmails.map((e) => (
                    <span key={e} className="inline-flex items-center gap-1 text-[10px] bg-gray-800 border border-gray-700 text-gray-400 rounded-full px-2 py-0.5">
                      {e}
                      <button onClick={() => setSubscriberEmails((prev) => prev.filter((x) => x !== e))} className="text-gray-600 hover:text-red-400">×</button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })()}

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

        {/* ── Donor brief (Pro) ─────────────────────────────────────── */}
        {isPaid && (() => {
          const bc = DONOR_BRIEF_COPY[locale] ?? DONOR_BRIEF_COPY.en;
          const disease = getLocalizedDisease(outbreak, locale) ?? outbreak.disease_en ?? outbreak.disease;
          const country = getLocalizedCountry(outbreak, locale) ?? outbreak.country_en ?? outbreak.country;
          const brief = bc.generate(outbreak.date, outbreak.cases, disease, country, outbreak.risk_level, !!outbreak.is_pheic);
          return (
            <div className="px-5 pb-3">
              <button
                onClick={async () => {
                  await navigator.clipboard.writeText(brief);
                  setBriefCopied(true);
                  setTimeout(() => setBriefCopied(false), 2500);
                }}
                className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white transition-colors border border-gray-700 hover:border-gray-500 rounded-lg px-3 py-1.5"
              >
                {briefCopied
                  ? <Check className="w-3.5 h-3.5 text-green-400" />
                  : <Copy className="w-3.5 h-3.5" />}
                {briefCopied ? bc.copied : bc.copy}
              </button>
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
          {status === 'press' && (
            <a
              href={outbreak.source!}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm font-medium transition-colors text-violet-400 hover:text-violet-300"
            >
              <ExternalLink className="w-4 h-4 shrink-0" />
              {c.pressSource} →
            </a>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
