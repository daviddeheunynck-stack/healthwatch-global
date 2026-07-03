import type { Outbreak } from "@/lib/outbreaks";
import type { OutbreakTrend } from "@/lib/outbreak-trend";

// ── "Why it matters" synthesis ──────────────────────────────────────────────
// Turns signals that already exist on the outbreak record (PHEIC status,
// verification/response phase, event linkage, trend) into one short sentence
// per locale — the "so what" a decision-maker asks for, instead of raw
// numbers they have to interpret themselves. Picks at most the two most
// salient signals rather than listing everything, so it stays scannable.

export type WhyItMattersSignal =
  | "pheic"
  | "multi_country"
  | "growing_fast"
  | "declining"
  | "under_investigation"
  | "active_response"
  | "contained"
  | "stale";

export interface WhyItMattersResult {
  signals: WhyItMattersSignal[];
}

/**
 * Pure signal selection — no copy, no locale. Ranked by how much it should
 * change a reader's next action, most urgent first, capped at 2.
 */
export function selectWhyItMattersSignals(
  outbreak: Pick<Outbreak, "is_pheic" | "event_id" | "verification_status" | "response_phase">,
  trend: OutbreakTrend | undefined,
  isStale: boolean
): WhyItMattersSignal[] {
  const signals: WhyItMattersSignal[] = [];

  if (outbreak.is_pheic) signals.push("pheic");
  if (outbreak.event_id) signals.push("multi_country");
  if (trend && trend.direction === "up" && trend.deltaPercent >= 20) signals.push("growing_fast");
  if (outbreak.response_phase === "active_response") signals.push("active_response");
  if (outbreak.verification_status === "under_investigation") signals.push("under_investigation");
  if (trend && trend.direction === "down" && trend.deltaPercent <= -20) signals.push("declining");
  if (outbreak.response_phase === "contained") signals.push("contained");
  if (isStale) signals.push("stale");

  return signals.slice(0, 2);
}

type Locale = "fr" | "en" | "es" | "ar" | "id";

const SIGNAL_COPY: Record<Locale, Record<WhyItMattersSignal, (deltaPercent?: number) => string>> = {
  fr: {
    pheic: () => "Urgence sanitaire de portée internationale (PHEIC) : le niveau d'alerte OMS le plus élevé.",
    multi_country: () => "Fait partie d'un événement multi-pays — le risque ne s'arrête pas à cette frontière.",
    growing_fast: (d) => `En accélération : +${d}% de cas sur 7 jours.`,
    declining: (d) => `En recul : ${d}% de cas sur 7 jours.`,
    under_investigation: () => "Statut préliminaire — données en cours d'investigation, à interpréter avec prudence.",
    active_response: () => "Réponse active en cours — équipes terrain mobilisées.",
    contained: () => "Foyer contenu — propagation limitée par les mesures de contrôle.",
    stale: () => "Aucun bulletin officiel récent — le silence peut signifier une résolution ou un défaut de signalement.",
  },
  en: {
    pheic: () => "Public Health Emergency of International Concern — WHO's highest alert level.",
    multi_country: () => "Part of a multi-country event — the risk doesn't stop at this border.",
    growing_fast: (d) => `Accelerating: +${d}% cases over 7 days.`,
    declining: (d) => `Declining: ${d}% cases over 7 days.`,
    under_investigation: () => "Preliminary status — data still under investigation, interpret with caution.",
    active_response: () => "Active response underway — field teams mobilised.",
    contained: () => "Contained — spread limited by control measures.",
    stale: () => "No recent official bulletin — the silence could mean resolution or under-reporting.",
  },
  es: {
    pheic: () => "Emergencia de salud pública de importancia internacional — el nivel de alerta más alto de la OMS.",
    multi_country: () => "Forma parte de un evento multipaís — el riesgo no se detiene en esta frontera.",
    growing_fast: (d) => `En aceleración: +${d}% de casos en 7 días.`,
    declining: (d) => `En descenso: ${d}% de casos en 7 días.`,
    under_investigation: () => "Estado preliminar — datos aún en investigación, interpretar con precaución.",
    active_response: () => "Respuesta activa en curso — equipos de campo movilizados.",
    contained: () => "Contenido — propagación limitada por medidas de control.",
    stale: () => "Sin boletín oficial reciente — el silencio puede significar resolución o falta de reporte.",
  },
  ar: {
    pheic: () => "طوارئ صحية عامة تثير قلقاً دولياً — أعلى مستوى إنذار لدى منظمة الصحة العالمية.",
    multi_country: () => "جزء من حدث متعدد الدول — الخطر لا يتوقف عند هذه الحدود.",
    growing_fast: (d) => `في تسارع: +${d}% من الحالات خلال 7 أيام.`,
    declining: (d) => `في تراجع: ${d}% من الحالات خلال 7 أيام.`,
    under_investigation: () => "حالة أولية — البيانات لا تزال قيد التحقيق، يُرجى التعامل معها بحذر.",
    active_response: () => "استجابة نشطة جارية — فِرق ميدانية منتشرة.",
    contained: () => "محتوَى — انتشار محدود بإجراءات السيطرة.",
    stale: () => "لا نشرة رسمية حديثة — قد يعني الصمت انتهاء التفشي أو نقص الإبلاغ.",
  },
  id: {
    pheic: () => "Darurat Kesehatan Masyarakat yang Meresahkan Dunia — level siaga tertinggi WHO.",
    multi_country: () => "Bagian dari kejadian multi-negara — risiko tidak berhenti di perbatasan ini.",
    growing_fast: (d) => `Mempercepat: +${d}% kasus dalam 7 hari.`,
    declining: (d) => `Menurun: ${d}% kasus dalam 7 hari.`,
    under_investigation: () => "Status awal — data masih dalam penyelidikan, tafsirkan dengan hati-hati.",
    active_response: () => "Respons aktif sedang berlangsung — tim lapangan dikerahkan.",
    contained: () => "Terkendali — penyebaran dibatasi oleh langkah pengendalian.",
    stale: () => "Tidak ada buletin resmi terbaru — bisa berarti wabah telah selesai atau tidak dilaporkan.",
  },
};

export function whyItMattersCopy(
  signal: WhyItMattersSignal,
  locale: string,
  deltaPercent?: number
): string {
  const l = (SIGNAL_COPY[locale as Locale] ?? SIGNAL_COPY.en)[signal];
  return l(deltaPercent);
}
