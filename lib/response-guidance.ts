/**
 * WHO/IHR-aligned response guidance for outbreak focal points.
 *
 * Tiers follow the IHR (2005) Annex 2 decision instrument and WHO emergency
 * response framework. Actions mirror the signal → validation → escalation
 * pathway used in national health ministry surveillance workflows.
 */

export type ResponseTier = "immediate" | "rapid" | "monitor";

export interface ResponseGuidance {
  tier: ResponseTier;
  /** True for diseases subject to IHR Annex 2 — mandatory WHO notification. */
  ihr_notifiable: boolean;
}

// IHR Annex 2 — WHO National Focal Point must be notified within 24 h
const IHR_IMMEDIATE_PATTERNS = [
  "ebola", "marburg", "lassa", "crimean-congo", "crimean congo",
  "viral hemorrhagic", "haemorrhagic fever",
  "smallpox", "variola",
  "sars",
  "polio", "poliovirus",
  "yellow fever",
  "plague", "yersinia pestis",
  "novel influenza", "pandemic influenza", "h5n1", "h7n9", "h5n6", "h5n2",
  "nipah", "hendra",
];

// High priority — field investigation within 48 h, alert national focal points
const RAPID_RESPONSE_PATTERNS = [
  "mpox", "monkeypox",
  "cholera",
  "meningococcal", "meningitis",
  "anthrax",
  "rift valley fever",
  "west nile",
];

export function getResponseGuidance(diseaseNameEn: string): ResponseGuidance {
  const name = diseaseNameEn.toLowerCase();
  if (IHR_IMMEDIATE_PATTERNS.some((p) => name.includes(p))) {
    return { tier: "immediate", ihr_notifiable: true };
  }
  if (RAPID_RESPONSE_PATTERNS.some((p) => name.includes(p))) {
    return { tier: "rapid", ihr_notifiable: false };
  }
  return { tier: "monitor", ihr_notifiable: false };
}

export const RESPONSE_ACTIONS: Record<ResponseTier, Record<string, string[]>> = {
  immediate: {
    en: [
      "Notify WHO National Focal Point within 24 h — IHR Art. 6 obligation",
      "Activate Incident Management System (IMS) or Emergency Operations Centre",
      "Dispatch field investigation team — confirm case definition and epicentre",
      "Brief senior health authority and issue first situation report",
    ],
    fr: [
      "Notifier le Point focal national OMS sous 24 h — obligation RSI art. 6",
      "Activer le Système de gestion des incidents (SGI) ou le Centre des opérations d'urgence",
      "Déployer une équipe terrain — confirmer la définition de cas et l'épicentre",
      "Briefer les autorités sanitaires supérieures et publier le premier sitrep",
    ],
    es: [
      "Notificar al Punto focal nacional OMS en 24 h — obligación RSI art. 6",
      "Activar el Sistema de gestión de incidentes o el Centro de Operaciones de Emergencia",
      "Enviar equipo de campo — confirmar definición de caso y epicentro",
      "Informar a autoridades sanitarias superiores y emitir primer sitrep",
    ],
    ar: [
      "إخطار نقطة الاتصال الوطنية لمنظمة الصحة العالمية خلال 24 ساعة — التزام اللوائح الصحية الدولية م. 6",
      "تفعيل نظام إدارة الحوادث أو مركز عمليات الطوارئ",
      "إيفاد فريق تحقيق ميداني — تأكيد تعريف الحالة وتحديد البؤرة",
      "إحاطة السلطات الصحية العليا وإصدار أول تقرير وضع",
    ],
    id: [
      "Notifikasi Focal Point Nasional WHO dalam 24 jam — kewajiban IHR Ps. 6",
      "Aktifkan Sistem Manajemen Insiden (IMS) atau Pusat Operasi Darurat",
      "Kirim tim investigasi lapangan — konfirmasi definisi kasus dan episentrum",
      "Brifing otoritas kesehatan senior dan terbitkan laporan situasi pertama",
    ],
  },
  rapid: {
    en: [
      "Initiate field investigation within 48 h — verify signal with local authorities",
      "Alert regional health offices and district focal points",
      "Cross-check against WHO, ECDC and Africa CDC data for corroboration",
      "Prepare situation report for the next surveillance meeting",
    ],
    fr: [
      "Lancer l'investigation terrain sous 48 h — vérifier le signal avec les autorités locales",
      "Alerter les bureaux régionaux de santé et les points focaux de district",
      "Croiser avec les données OMS, ECDC et Africa CDC pour corroboration",
      "Préparer un sitrep pour la prochaine réunion de surveillance",
    ],
    es: [
      "Iniciar investigación de campo en 48 h — verificar señal con autoridades locales",
      "Alertar a oficinas de salud regionales y puntos focales de distrito",
      "Contrastar con datos de OMS, ECDC y Africa CDC para corroboración",
      "Preparar sitrep para la próxima reunión de vigilancia",
    ],
    ar: [
      "الشروع في التحقيق الميداني خلال 48 ساعة — التحقق من الإشارة مع السلطات المحلية",
      "تنبيه مكاتب الصحة الإقليمية ونقاط الاتصال الإقليمية",
      "مقارنة بيانات WHO وECDC وAfrica CDC للتأكيد",
      "إعداد تقرير وضع للاجتماع الدوري للمراقبة الوبائية",
    ],
    id: [
      "Mulai investigasi lapangan dalam 48 jam — verifikasi sinyal dengan otoritas lokal",
      "Peringatkan kantor kesehatan regional dan focal point kabupaten",
      "Bandingkan dengan data WHO, ECDC, dan Africa CDC untuk konfirmasi",
      "Siapkan laporan situasi untuk pertemuan surveilans berikutnya",
    ],
  },
  monitor: {
    en: [
      "Log in national surveillance system — continue routine monitoring",
      "Compare with seasonal baseline for this region and disease",
      "Include in weekly surveillance briefing — escalate if trend worsens (▲ cases or CFR)",
    ],
    fr: [
      "Enregistrer dans le système de surveillance national — maintenir la veille de routine",
      "Comparer avec la baseline saisonnière pour cette région et cette maladie",
      "Inclure dans le briefing de surveillance hebdomadaire — escalader si tendance à la hausse (▲ cas ou létalité)",
    ],
    es: [
      "Registrar en el sistema de vigilancia nacional — continuar seguimiento de rutina",
      "Comparar con la línea de base estacional para esta región y enfermedad",
      "Incluir en el informe de vigilancia semanal — escalar si la tendencia empeora (▲ casos o tasa de letalidad)",
    ],
    ar: [
      "التسجيل في نظام المراقبة الوطني — الاستمرار في المراقبة الروتينية",
      "المقارنة مع خط الأساس الموسمي لهذه المنطقة والمرض",
      "التضمين في إحاطة المراقبة الأسبوعية — التصعيد إذا ساءت الاتجاهات (▲ حالات أو معدل الوفيات)",
    ],
    id: [
      "Catat dalam sistem surveilans nasional — lanjutkan pemantauan rutin",
      "Bandingkan dengan baseline musiman untuk wilayah dan penyakit ini",
      "Sertakan dalam brifing surveilans mingguan — eskalasi jika tren memburuk (▲ kasus atau CFR)",
    ],
  },
};
