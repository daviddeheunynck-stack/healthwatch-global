// Data methodology page — how HealthWatch processes outbreak data.
// URL: /[locale]/methodology
// Target: institutional buyers, corporate risk, epidemiologists asking "can I trust this?"

import Link from "next/link";
import type { Metadata } from "next";
import { Database, Clock, ShieldCheck, AlertTriangle, TrendingUp, Info, Mail } from "lucide-react";
import CitationBlock from "@/components/CitationBlock";
import { PRICE_DISPLAY } from "@/lib/pricing";

export const revalidate = 86400;

const LOCALES = ["en", "fr", "es", "ar", "id"] as const;
type Locale = typeof LOCALES[number];

const BASE_URL = "https://healthwatch-global.com";

const META: Record<Locale, { title: string; description: string }> = {
  en: {
    title: "Data Methodology — HealthWatch Global",
    description: "How HealthWatch Global collects, processes and validates disease outbreak data from WHO, ECDC, PAHO and Africa CDC. Sources, update frequency, quality tiers and limitations.",
  },
  fr: {
    title: "Méthodologie des données — HealthWatch Global",
    description: "Comment HealthWatch Global collecte, traite et valide les données épidémiques de l'OMS, l'ECDC, l'OPAS et l'Africa CDC. Sources, fréquence de mise à jour, niveaux de qualité et limites.",
  },
  es: {
    title: "Metodología de datos — HealthWatch Global",
    description: "Cómo HealthWatch Global recopila, procesa y valida datos de brotes de enfermedades de OMS, ECDC, PAHO y Africa CDC. Fuentes, frecuencia de actualización, niveles de calidad y limitaciones.",
  },
  ar: {
    title: "منهجية البيانات — HealthWatch Global",
    description: "كيف تجمع HealthWatch Global بيانات تفشي الأمراض من WHO وECDC وPAHO وAfrica CDC وتعالجها وتتحقق منها. المصادر وتكرار التحديث ومستويات الجودة والقيود.",
  },
  id: {
    title: "Metodologi Data — HealthWatch Global",
    description: "Bagaimana HealthWatch Global mengumpulkan, memproses, dan memvalidasi data wabah penyakit dari WHO, ECDC, PAHO, dan Africa CDC. Sumber, frekuensi pembaruan, tingkat kualitas, dan keterbatasan.",
  },
};

const METHODOLOGY_UPDATED = new Date("2026-06-01");

const COPY: Record<Locale, {
  back: string;
  title: string;
  subtitle: string;
  updatedLabel: string;
  sourcesTitle: string;
  sources: { name: string; type: string; coverage: string; freq: string; url: string }[];
  pipelineTitle: string;
  pipelineSteps: { title: string; desc: string }[];
  qualityTitle: string;
  qualityTiers: { badge: string; badgeClass: string; title: string; desc: string }[];
  staleTitle: string;
  staleDesc: string;
  cfrTitle: string;
  cfrDesc: string;
  cfrFormula: string;
  cfrWarning: string;
  riskTitle: string;
  riskDisclaimer: string;
  riskLevels: { label: string; labelClass: string; criteria: string }[];
  limitsTitle: string;
  limits: string[];
  eiosTitle: string;
  eiosSub: string;
  eiosItems: { label: string; hwg: string; other: string }[];
  correctionsTitle: string;
  correctionsDesc: string;
  correctionsBtn: string;
  citeLabel: string;
  citeCopy: string;
  citeCopied: string;
}> = {
  en: {
    back: "← About",
    title: "How we process data",
    subtitle: "HealthWatch Global does not produce original surveillance data. We aggregate, normalize and present data from four official international health authorities — without editorial interpretation.",
    updatedLabel: "Last updated:",
    sourcesTitle: "Official data sources",
    sources: [
      { name: "WHO DON", type: "Disease Outbreak News", coverage: "Global", freq: "Irregular — per outbreak event", url: "https://www.who.int/emergencies/disease-outbreak-news" },
      { name: "ECDC CDTR", type: "Communicable Disease Threats Report", coverage: "Europe / global risk assessment", freq: "Weekly + ad hoc", url: "https://www.ecdc.europa.eu/en/threats-and-outbreaks" },
      { name: "PAHO", type: "Pan American Health Organization alerts", coverage: "Americas", freq: "Per event", url: "https://www.paho.org/en/epidemiological-alerts-and-updates" },
      { name: "Africa CDC", type: "Africa Centres for Disease Control", coverage: "Africa", freq: "Per event + weekly sitrep", url: "https://africacdc.org/outbreaks-events" },
    ],
    pipelineTitle: "Data pipeline",
    pipelineSteps: [
      { title: "Automated sync — WHO: hourly | ECDC, PAHO & Africa CDC: weekly", desc: "Scheduled cron jobs fetch the latest publications from each source. WHO DON is checked every hour. ECDC, PAHO and Africa CDC are checked weekly. New outbreaks are ingested within 1 hour of WHO publication, or within the same week for the other sources." },
      { title: "Normalization", desc: "Country names, disease names, dates and case counts are standardized to a common schema. Disease names are mapped to canonical English names used across all 5 languages." },
      { title: "Deduplication", desc: "Outbreaks from multiple sources for the same event are matched and merged. The highest-authority source (WHO DON > ECDC > PAHO > Africa CDC) takes precedence for case counts." },
      { title: "Storage & ISR", desc: "Data is stored in a PostgreSQL database (Supabase). Dashboard pages are revalidated every hour via Next.js ISR. The data freshness badge on the dashboard shows the last successful sync timestamp." },
    ],
    qualityTitle: "Data quality tiers",
    qualityTiers: [
      {
        badge: "WHO DON",
        badgeClass: "bg-blue-900/30 border-blue-700/50 text-blue-400",
        title: "WHO Disease Outbreak News",
        desc: "Officially citable WHO bulletin with a unique DON reference number. Highest confidence — data comes directly from the WHO's official outbreak notification system.",
      },
      {
        badge: "OFFICIAL",
        badgeClass: "bg-amber-900/30 border-amber-700/50 text-amber-400",
        title: "Confirmed official source",
        desc: "Data sourced from a confirmed official report (WHO situation report, ECDC assessment, PAHO alert, or national Ministry of Health) — without an assigned WHO DON reference.",
      },
      {
        badge: "UNVERIFIED",
        badgeClass: "bg-gray-800 border-gray-600 text-gray-400",
        title: "Unverified provisional figures",
        desc: "Preliminary figures not yet matched to a confirmed official report. Used for outbreaks that have been publicly announced but not yet covered by a formal WHO/official bulletin. Treat with caution.",
      },
    ],
    staleTitle: "Stale data detection",
    staleDesc: "When no official update has been published for an outbreak in more than 14 days, a ⚠ NO UPDATE badge appears on the outbreak row. This does not mean the outbreak is resolved — it may be ongoing but unreported, or the source may not have published a new bulletin. We never auto-close outbreaks based on silence alone.",
    cfrTitle: "Case fatality rate (CFR)",
    cfrDesc: "CFR is calculated automatically from the case and death counts as reported by the official source:",
    cfrFormula: "CFR = Deaths ÷ Confirmed cases × 100",
    cfrWarning: "This is the crude CFR as reported — not age-standardized, adjusted for underreporting, or corrected for reporting lag. Early-outbreak CFR is inherently unstable. Use with appropriate epidemiological caution.",
    riskTitle: "Risk level assignment",
    riskDisclaimer: "Risk levels are assigned algorithmically from published WHO IHR criteria (Art. 6, 9, 12) — not by editorial judgment. HIGH means an outbreak matches WHO's published NFP notification threshold. HealthWatch Global does not conduct independent epidemiological risk assessment. All clinical and policy decisions must rely on primary WHO/ECDC sources and qualified professionals.",
    riskLevels: [
      { label: "HIGH RISK", labelClass: "text-red-400 bg-red-500/10 border-red-500/30", criteria: "WHO DON issued, PHEIC declared, CFR > 5%, or novel pathogen / first human cases. High-consequence pathogens (Ebola, Marburg, SARS) are always HIGH." },
      { label: "MODERATE RISK", labelClass: "text-yellow-400 bg-yellow-500/10 border-yellow-500/30", criteria: "Confirmed official source, regional spread documented, CFR 1–5%, or significant case counts in endemic disease (cholera, dengue, mpox)." },
      { label: "LOW RISK", labelClass: "text-green-400 bg-green-500/10 border-green-500/30", criteria: "Localized outbreak, contained transmission, CFR < 1%, and no evidence of international spread." },
    ],
    limitsTitle: "Limitations",
    limits: [
      "We rely entirely on what official sources publish. Reporting delays between outbreak onset and official declaration are outside our control.",
      "Case counts reflect what has been officially reported — true burden is typically higher due to underdiagnosis and underreporting.",
      "Outbreak-end detection is manual. We do not automatically close outbreaks unless the source explicitly reports resolution.",
      "Translations (disease names, country names) are maintained by our team — minor localization nuances may exist in edge cases.",
      "HealthWatch Global is not a medical authority. Data on this platform should not replace direct consultation of official WHO/ECDC publications for clinical or policy decisions.",
      "The 'date' field for each outbreak reflects the date reported by the official source bulletin — not when HealthWatch ingested it. Ingestion typically occurs within 1 hour of source publication. The freshness badge on the dashboard shows the actual last ingestion timestamp.",
      "Successive WHO bulletins on the same disease event may occasionally create two separate entries for the same outbreak. These are detected and merged within 24 hours. Use the 'Report a data error' link on any outbreak page to flag a suspected duplicate immediately.",
    ],
    eiosTitle: "HealthWatch vs WHO surveillance tools (EIOS, EWARN)",
    eiosSub: "EIOS and similar WHO tools are designed for WHO analysts and affiliated institutions. HealthWatch Global serves a different audience — here is how they differ.",
    eiosItems: [
      { label: "Access", hwg: "Open to any organization — no WHO credentials or affiliation required", other: "EIOS requires WHO affiliation or national IHR focal point access" },
      { label: "Cost", hwg: `${PRICE_DISPLAY.en_eur.proMonthly}/month Pro — 14-day free trial, no commitment`, other: "Free for WHO member states & accredited institutions only — not available to NGOs, humanitarian organizations, or private sector without WHO institutional credentials" },
      { label: "Target user", hwg: "Operational teams: NGO coordinators, humanitarian staff, health programme managers", other: "Epidemiological analysts with WHO/institutional training" },
      { label: "Proactive alerts", hwg: "Automated email + Slack/Teams alerts per monitored region", other: "No proactive alert system — requires active daily monitoring" },
      { label: "Languages", hwg: "English, French, Spanish, Arabic, Indonesian", other: "Primarily English" },
      { label: "Team access", hwg: "Shared team plans with seat management and single invoice", other: "Individual credentials, no shared team workspace" },
      { label: "Data export", hwg: "PDF reports + CSV export per outbreak or region", other: "Not designed for export to third-party systems" },
    ],
    correctionsTitle: "Corrections and data disputes",
    correctionsDesc: "If you identify a data error, incorrect figure, or source mismatch, contact us. We review and correct within 48 hours.",
    correctionsBtn: "Report a data issue →",
    citeLabel: "Cite this page",
    citeCopy: "Copy citation",
    citeCopied: "Copied!",
  },
  fr: {
    back: "← À propos",
    title: "Comment nous traitons les données",
    subtitle: "HealthWatch Global ne produit pas de données de surveillance originales. Nous agrégeons, normalisons et présentons les données de quatre autorités sanitaires internationales officielles — sans interprétation éditoriale.",
    updatedLabel: "Mis à jour :",
    sourcesTitle: "Sources de données officielles",
    sources: [
      { name: "WHO DON", type: "Disease Outbreak News", coverage: "Mondial", freq: "Irrégulier — par événement épidémique", url: "https://www.who.int/emergencies/disease-outbreak-news" },
      { name: "ECDC CDTR", type: "Rapport sur les menaces sanitaires communicables", coverage: "Europe / évaluation mondiale", freq: "Hebdomadaire + ad hoc", url: "https://www.ecdc.europa.eu/en/threats-and-outbreaks" },
      { name: "OPAS/PAHO", type: "Organisation panaméricaine de la santé", coverage: "Amériques", freq: "Par événement", url: "https://www.paho.org/en/epidemiological-alerts-and-updates" },
      { name: "Africa CDC", type: "Centres africains de contrôle des maladies", coverage: "Afrique", freq: "Par événement + sitrep hebdomadaire", url: "https://africacdc.org/outbreaks-events" },
    ],
    pipelineTitle: "Pipeline de données",
    pipelineSteps: [
      { title: "Synchronisation automatique — OMS : toutes les heures | ECDC, OPAS & Africa CDC : hebdomadaire", desc: "Des jobs cron planifiés récupèrent les dernières publications de chaque source. L'OMS DON est vérifiée toutes les heures. L'ECDC, l'OPAS et l'Africa CDC sont vérifiés chaque semaine. Les nouveaux foyers OMS sont intégrés dans l'heure, les autres dans la semaine suivant la publication." },
      { title: "Normalisation", desc: "Les noms de pays, noms de maladies, dates et chiffres de cas sont standardisés dans un schéma commun. Les noms de maladies sont mappés sur des noms canoniques en anglais, utilisés dans les 5 langues." },
      { title: "Déduplication", desc: "Les foyers issus de plusieurs sources pour le même événement sont rapprochés et fusionnés. La source de plus haute autorité (WHO DON > ECDC > OPAS > Africa CDC) prend la priorité pour les chiffres de cas." },
      { title: "Stockage & ISR", desc: "Les données sont stockées dans une base PostgreSQL (Supabase). Les pages du tableau de bord sont revalidées toutes les heures via Next.js ISR. Le badge de fraîcheur sur le tableau de bord affiche le timestamp de la dernière synchronisation réussie." },
    ],
    qualityTitle: "Niveaux de qualité des données",
    qualityTiers: [
      {
        badge: "WHO DON",
        badgeClass: "bg-blue-900/30 border-blue-700/50 text-blue-400",
        title: "WHO Disease Outbreak News",
        desc: "Bulletin OMS officiellement citable avec numéro de référence DON unique. Confiance maximale — données issues directement du système officiel de notification des épidémies de l'OMS.",
      },
      {
        badge: "OFFICIEL",
        badgeClass: "bg-amber-900/30 border-amber-700/50 text-amber-400",
        title: "Source officielle confirmée",
        desc: "Données issues d'un rapport officiel confirmé (rapport de situation OMS, évaluation ECDC, alerte OPAS ou ministère de la santé national) — sans numéro de référence DON attribué.",
      },
      {
        badge: "NON VÉRIFIÉ",
        badgeClass: "bg-gray-800 border-gray-600 text-gray-400",
        title: "Chiffres provisoires non vérifiés",
        desc: "Données préliminaires non encore rattachées à un rapport officiel confirmé. Utilisées pour des foyers annoncés publiquement mais non encore couverts par un bulletin OMS/officiel. À utiliser avec précaution.",
      },
    ],
    staleTitle: "Détection des données périmées",
    staleDesc: "Lorsqu'aucune mise à jour officielle n'a été publiée pour un foyer depuis plus de 14 jours, un badge ⚠ SANS MAJ apparaît sur la ligne du foyer. Cela ne signifie pas que le foyer est résolu — il peut être toujours actif mais non rapporté, ou la source peut ne pas avoir publié de nouveau bulletin. Nous ne fermons jamais automatiquement un foyer sur la seule base du silence.",
    cfrTitle: "Taux de létalité (CFR)",
    cfrDesc: "La létalité est calculée automatiquement à partir des chiffres de cas et de décès tels que rapportés par la source officielle :",
    cfrFormula: "CFR = Décès ÷ Cas confirmés × 100",
    cfrWarning: "Il s'agit du CFR brut tel que rapporté — non standardisé par âge, non ajusté pour la sous-déclaration, ni corrigé pour le délai de signalement. Le CFR en début d'épidémie est intrinsèquement instable. À utiliser avec la prudence épidémiologique appropriée.",
    riskTitle: "Attribution du niveau de risque",
    riskDisclaimer: "Les niveaux de risque sont attribués algorithmiquement à partir des critères RSI publiés par l'OMS (Art. 6, 9, 12) — sans jugement éditorial. ÉLEVÉ signifie qu'un foyer correspond au seuil de notification des Points focaux nationaux publié par l'OMS. HealthWatch Global ne conduit aucune évaluation épidémiologique indépendante. Toute décision clinique ou de santé publique doit s'appuyer sur les sources primaires OMS/ECDC et des professionnels qualifiés.",
    riskLevels: [
      { label: "RISQUE ÉLEVÉ", labelClass: "text-red-400 bg-red-500/10 border-red-500/30", criteria: "DON OMS publié, USPPI déclarée, CFR > 5 %, ou pathogène nouveau / premiers cas humains. Les pathogènes à haute conséquence (Ebola, Marburg, SRAS) sont toujours ÉLEVÉ." },
      { label: "RISQUE MODÉRÉ", labelClass: "text-yellow-400 bg-yellow-500/10 border-yellow-500/30", criteria: "Source officielle confirmée, diffusion régionale documentée, CFR 1–5 %, ou nombre de cas significatif pour une maladie endémique (choléra, dengue, mpox)." },
      { label: "RISQUE FAIBLE", labelClass: "text-green-400 bg-green-500/10 border-green-500/30", criteria: "Foyer localisé, transmission contenue, CFR < 1 %, et aucune preuve de propagation internationale." },
    ],
    limitsTitle: "Limites",
    limits: [
      "Nous dépendons entièrement de ce que les sources officielles publient. Les délais de signalement entre le début d'un foyer et la déclaration officielle échappent à notre contrôle.",
      "Les chiffres de cas reflètent ce qui a été officiellement rapporté — la charge réelle est généralement plus élevée en raison du sous-diagnostic et de la sous-déclaration.",
      "La détection de la fin d'un foyer est manuelle. Nous ne fermons pas automatiquement les foyers à moins que la source ne signale explicitement la résolution.",
      "Les traductions (noms de maladies, noms de pays) sont maintenues par notre équipe — des nuances mineures de localisation peuvent exister dans des cas atypiques.",
      "HealthWatch Global n'est pas une autorité médicale. Les données sur cette plateforme ne doivent pas remplacer la consultation directe des publications officielles OMS/ECDC pour des décisions cliniques ou politiques.",
      "Le champ « date » de chaque foyer reflète la date rapportée dans le bulletin officiel — pas la date d'intégration par HealthWatch. L'intégration intervient généralement dans l'heure suivant la publication source. Le badge de fraîcheur sur le tableau de bord affiche le timestamp réel de la dernière synchronisation.",
      "Des bulletins OMS successifs sur le même événement peuvent occasionnellement créer deux entrées distinctes pour le même foyer. Ces doublons sont détectés et fusionnés sous 24 heures. Utilisez le lien « Signaler une erreur » sur chaque page de foyer pour signaler un doublon immédiatement.",
    ],
    eiosTitle: "HealthWatch vs les outils OMS (EIOS, EWARN)",
    eiosSub: "EIOS et les outils OMS similaires sont conçus pour les analystes OMS et les institutions affiliées. HealthWatch Global s'adresse à un public différent — voici les différences clés.",
    eiosItems: [
      { label: "Accès", hwg: "Ouvert à toute organisation — sans credentials OMS ni affiliation", other: "EIOS requiert une affiliation OMS ou un accès de point focal national RSI" },
      { label: "Coût", hwg: `${PRICE_DISPLAY.fr.proMonthly}/mois Pro — essai 14 jours gratuit, sans engagement`, other: "Gratuit pour les États membres OMS et institutions accréditées uniquement — inaccessible aux ONG, organisations humanitaires ou secteur privé sans credentials OMS institutionnels" },
      { label: "Utilisateur cible", hwg: "Équipes opérationnelles : coordinateurs ONG, agents humanitaires, responsables de programmes santé", other: "Analystes épidémiologiques avec formation OMS/institutionnelle" },
      { label: "Alertes proactives", hwg: "Alertes email + Slack/Teams automatiques par région surveillée", other: "Aucun système d'alerte proactif — nécessite une surveillance active quotidienne" },
      { label: "Langues", hwg: "Anglais, français, espagnol, arabe, indonésien", other: "Principalement anglais" },
      { label: "Accès équipe", hwg: "Plans équipe partagés avec gestion des sièges et facture unique", other: "Identifiants individuels, pas d'espace de travail partagé" },
      { label: "Export des données", hwg: "Rapports PDF + export CSV par foyer ou par région", other: "Non conçu pour l'export vers des systèmes tiers" },
    ],
    correctionsTitle: "Corrections et contestations de données",
    correctionsDesc: "Si vous identifiez une erreur de données, un chiffre incorrect ou une discordance de source, contactez-nous. Nous examinons et corrigeons dans les 48 heures.",
    correctionsBtn: "Signaler un problème de données →",
    citeLabel: "Citer cette page",
    citeCopy: "Copier la citation",
    citeCopied: "Copié !",
  },
  es: {
    back: "← Acerca de",
    title: "Cómo procesamos los datos",
    subtitle: "HealthWatch Global no produce datos de vigilancia originales. Agregamos, normalizamos y presentamos datos de cuatro autoridades sanitarias internacionales oficiales, sin interpretación editorial.",
    updatedLabel: "Actualizado:",
    sourcesTitle: "Fuentes de datos oficiales",
    sources: [
      { name: "WHO DON", type: "Disease Outbreak News", coverage: "Mundial", freq: "Irregular — por evento epidémico", url: "https://www.who.int/emergencies/disease-outbreak-news" },
      { name: "ECDC CDTR", type: "Informe de amenazas de enfermedades transmisibles", coverage: "Europa / evaluación mundial", freq: "Semanal + ad hoc", url: "https://www.ecdc.europa.eu/en/threats-and-outbreaks" },
      { name: "OPS/PAHO", type: "Organización Panamericana de la Salud", coverage: "Américas", freq: "Por evento", url: "https://www.paho.org/en/epidemiological-alerts-and-updates" },
      { name: "Africa CDC", type: "Centros Africanos para el Control de Enfermedades", coverage: "África", freq: "Por evento + sitrep semanal", url: "https://africacdc.org/outbreaks-events" },
    ],
    pipelineTitle: "Flujo de datos",
    pipelineSteps: [
      { title: "Sincronización automática — OMS: cada hora | ECDC, OPS & Africa CDC: semanal", desc: "Trabajos cron programados obtienen las últimas publicaciones de cada fuente. OMS DON se verifica cada hora. ECDC, OPS y Africa CDC se verifican semanalmente. Los nuevos brotes OMS se integran en 1 hora; los demás, en la misma semana de publicación." },
      { title: "Normalización", desc: "Nombres de países, nombres de enfermedades, fechas y recuentos de casos se estandarizan en un esquema común." },
      { title: "Deduplicación", desc: "Los brotes de múltiples fuentes para el mismo evento se emparejan y fusionan. La fuente de mayor autoridad (WHO DON > ECDC > PAHO > Africa CDC) tiene prioridad." },
      { title: "Almacenamiento e ISR", desc: "Los datos se almacenan en PostgreSQL (Supabase). Las páginas del panel se revalidan cada hora mediante Next.js ISR." },
    ],
    qualityTitle: "Niveles de calidad de datos",
    qualityTiers: [
      { badge: "WHO DON", badgeClass: "bg-blue-900/30 border-blue-700/50 text-blue-400", title: "WHO Disease Outbreak News", desc: "Boletín oficial citable con número de referencia DON único. Mayor confianza — datos del sistema oficial de notificación de brotes de la OMS." },
      { badge: "OFICIAL", badgeClass: "bg-amber-900/30 border-amber-700/50 text-amber-400", title: "Fuente oficial confirmada", desc: "Datos de un informe oficial confirmado (informe OMS, ECDC, PAHO o ministerio de salud) sin número DON asignado." },
      { badge: "NO VERIFICADO", badgeClass: "bg-gray-800 border-gray-600 text-gray-400", title: "Cifras provisionales no verificadas", desc: "Datos preliminares no vinculados aún a un informe oficial confirmado. Usar con precaución." },
    ],
    staleTitle: "Detección de datos desactualizados",
    staleDesc: "Cuando no se ha publicado actualización oficial de un brote en más de 14 días, aparece el badge ⚠ SIN ACTU. Esto no significa que el brote esté resuelto. Nunca cerramos brotes automáticamente por falta de actualizaciones.",
    cfrTitle: "Tasa de letalidad (CFR)",
    cfrDesc: "El CFR se calcula automáticamente a partir de los casos y muertes reportados por la fuente oficial:",
    cfrFormula: "CFR = Muertes ÷ Casos confirmados × 100",
    cfrWarning: "Este es el CFR bruto reportado — no estandarizado por edad ni ajustado por subnotificación. El CFR al inicio de un brote es intrínsecamente inestable.",
    riskTitle: "Asignación del nivel de riesgo",
    riskDisclaimer: "Los niveles de riesgo se asignan algorítmicamente a partir de los criterios del RSI publicados por la OMS (Art. 6, 9, 12) — sin juicio editorial. ALTO significa que un brote cumple el umbral de notificación para Puntos Focales Nacionales publicado por la OMS. HealthWatch Global no realiza evaluación epidemiológica independiente. Toda decisión clínica o de salud pública debe basarse en fuentes primarias OMS/ECDC y profesionales cualificados.",
    riskLevels: [
      { label: "RIESGO ALTO", labelClass: "text-red-400 bg-red-500/10 border-red-500/30", criteria: "DON OMS publicado, PHEIC declarada, CFR > 5%, o patógeno nuevo. Ébola, Marburg, SRAS siempre son ALTO." },
      { label: "RIESGO MODERADO", labelClass: "text-yellow-400 bg-yellow-500/10 border-yellow-500/30", criteria: "Fuente oficial confirmada, dispersión regional, CFR 1–5%, o casos significativos en enfermedad endémica." },
      { label: "RIESGO BAJO", labelClass: "text-green-400 bg-green-500/10 border-green-500/30", criteria: "Brote localizado, transmisión contenida, CFR < 1%, sin propagación internacional." },
    ],
    limitsTitle: "Limitaciones",
    limits: [
      "Dependemos de lo que publican las fuentes oficiales. Los retrasos de notificación están fuera de nuestro control.",
      "Los recuentos de casos reflejan lo notificado oficialmente — la carga real suele ser mayor por subdiagnóstico.",
      "La detección del fin de un brote es manual. No cerramos brotes automáticamente.",
      "HealthWatch Global no es una autoridad médica. Los datos no deben reemplazar la consulta directa de publicaciones oficiales para decisiones clínicas.",
      "El campo 'fecha' de cada brote refleja la fecha reportada en el boletín oficial — no cuándo HealthWatch lo ingirió. La ingesta ocurre en general en menos de 1 hora desde la publicación fuente.",
      "Los boletines sucesivos de la OMS sobre el mismo evento pueden ocasionalmente crear dos entradas separadas para el mismo brote. Estos duplicados se detectan y fusionan en 24 horas. Utilice el enlace 'Reportar un error' en cualquier página de brote para señalar un duplicado de inmediato.",
    ],
    eiosTitle: "HealthWatch vs herramientas de vigilancia OMS (EIOS, EWARN)",
    eiosSub: "EIOS y herramientas similares de la OMS están diseñadas para analistas de la OMS e instituciones afiliadas. HealthWatch Global sirve a un público diferente.",
    eiosItems: [
      { label: "Acceso", hwg: "Abierto a cualquier organización — sin credenciales OMS", other: "EIOS requiere afiliación OMS o acceso de punto focal nacional RSI" },
      { label: "Coste", hwg: `${PRICE_DISPLAY.es.proMonthly}/mes Pro — 14 días de prueba gratuita, sin compromiso`, other: "Gratuito para estados miembros OMS e instituciones acreditadas únicamente — no disponible para ONG, organizaciones humanitarias o sector privado sin credenciales OMS institucionales" },
      { label: "Usuario objetivo", hwg: "Equipos operativos: coordinadores ONG, personal humanitario, responsables de programas de salud", other: "Analistas epidemiológicos con formación OMS" },
      { label: "Alertas proactivas", hwg: "Alertas automáticas por email + Slack/Teams por región", other: "Sin sistema de alertas proactivas — requiere monitoreo activo diario" },
      { label: "Idiomas", hwg: "Inglés, francés, español, árabe, indonesio", other: "Principalmente inglés" },
      { label: "Acceso en equipo", hwg: "Planes de equipo compartidos con gestión de asientos y factura única", other: "Credenciales individuales, sin espacio de trabajo compartido" },
      { label: "Exportación", hwg: "Informes PDF + exportación CSV por brote o región", other: "No diseñado para exportar a sistemas de terceros" },
    ],
    correctionsTitle: "Correcciones y disputas de datos",
    correctionsDesc: "Si detecta un error de datos, una cifra incorrecta o una discrepancia de fuente, contáctenos. Revisamos y corregimos en 48 horas.",
    correctionsBtn: "Reportar un problema de datos →",
    citeLabel: "Citar esta página",
    citeCopy: "Copiar cita",
    citeCopied: "¡Copiado!",
  },
  ar: {
    back: "→ حول المنصة",
    title: "كيف نعالج البيانات",
    subtitle: "لا تنتج HealthWatch Global بيانات مراقبة أصلية. نجمع بيانات أربع هيئات صحية دولية رسمية ونوحّدها ونعرضها — دون تفسير تحريري.",
    updatedLabel: "آخر تحديث:",
    sourcesTitle: "مصادر البيانات الرسمية",
    sources: [
      { name: "WHO DON", type: "أخبار تفشي الأمراض", coverage: "عالمي", freq: "غير منتظم — لكل حدث وبائي", url: "https://www.who.int/emergencies/disease-outbreak-news" },
      { name: "ECDC CDTR", type: "تقرير تهديدات الأمراض المعدية", coverage: "أوروبا / تقييم عالمي", freq: "أسبوعي + مخصص", url: "https://www.ecdc.europa.eu/en/threats-and-outbreaks" },
      { name: "PAHO", type: "منظمة الصحة للبلدان الأمريكية", coverage: "الأمريكتان", freq: "لكل حدث", url: "https://www.paho.org/en/epidemiological-alerts-and-updates" },
      { name: "Africa CDC", type: "المراكز الأفريقية لمكافحة الأمراض", coverage: "أفريقيا", freq: "لكل حدث + تقرير أسبوعي", url: "https://africacdc.org/outbreaks-events" },
    ],
    pipelineTitle: "خط أنابيب البيانات",
    pipelineSteps: [
      { title: "مزامنة تلقائية — WHO: كل ساعة | ECDC وPAHO وAfrica CDC: أسبوعياً", desc: "تجلب مهام cron منتظمة أحدث المنشورات من كل مصدر. يُفحص WHO DON كل ساعة. أما ECDC وPAHO وAfrica CDC فتُفحص أسبوعياً. تُدرج تفشيات WHO في غضون ساعة، وتفشيات المصادر الأخرى خلال نفس الأسبوع." },
      { title: "التوحيد والتطبيع", desc: "تُوحَّد أسماء الدول والأمراض والتواريخ وأعداد الحالات وفق مخطط مشترك." },
      { title: "إزالة التكرار", desc: "تُدمج التفشيات من مصادر متعددة لنفس الحدث. تحتل المصادر الأعلى سلطةً (WHO DON > ECDC > PAHO > Africa CDC) الأولوية." },
      { title: "التخزين والتحديث", desc: "تُخزَّن البيانات في قاعدة بيانات PostgreSQL. تُحدَّث صفحات لوحة التحكم كل ساعة." },
    ],
    qualityTitle: "مستويات جودة البيانات",
    qualityTiers: [
      { badge: "WHO DON", badgeClass: "bg-blue-900/30 border-blue-700/50 text-blue-400", title: "نشرة أخبار تفشي الأمراض من WHO", desc: "نشرة رسمية قابلة للاستشهاد برقم مرجع DON فريد. أعلى مستوى ثقة." },
      { badge: "رسمي", badgeClass: "bg-amber-900/30 border-amber-700/50 text-amber-400", title: "مصدر رسمي مؤكد", desc: "بيانات من تقرير رسمي مؤكد دون رقم DON مخصص." },
      { badge: "غير مؤكد", badgeClass: "bg-gray-800 border-gray-600 text-gray-400", title: "أرقام أولية غير مؤكدة", desc: "بيانات أولية غير مرتبطة بعد بتقرير رسمي مؤكد. يُرجى التعامل معها بحذر." },
    ],
    staleTitle: "الكشف عن البيانات القديمة",
    staleDesc: "عند غياب أي تحديث رسمي لأكثر من 14 يوماً، يظهر شارة ⚠ بلا تحديث. هذا لا يعني أن التفشي انتهى. لا نغلق التفشيات تلقائياً بسبب الصمت.",
    cfrTitle: "معدل وفيات الحالات (CFR)",
    cfrDesc: "يُحسب معدل الوفيات تلقائياً من أعداد الحالات والوفيات كما أفادت بها المصادر الرسمية:",
    cfrFormula: "CFR = الوفيات ÷ الحالات المؤكدة × 100",
    cfrWarning: "هذا هو CFR الخام كما أُبلغ عنه — غير معيّر بالعمر وغير مصحَّح للتقصير في الإبلاغ. CFR في بداية التفشي غير مستقر بطبيعته.",
    riskTitle: "تحديد مستوى الخطر",
    riskDisclaimer: "تُحدَّد مستويات الخطر خوارزمياً استناداً إلى معايير اللوائح الصحية الدولية المنشورة من قِبل منظمة الصحة العالمية (المواد 6 و9 و12) — دون اجتهاد تحريري. ÉLEVÉ يعني أن التفشي يستوفي عتبة إخطار نقاط الاتصال الوطنية المنشورة من المنظمة. لا تُجري HealthWatch Global أي تقييم وبائي مستقل. يجب أن تستند جميع القرارات السريرية وقرارات الصحة العامة إلى المصادر الأولية لمنظمة الصحة العالمية/ECDC والمختصين المؤهلين.",
    riskLevels: [
      { label: "خطر مرتفع", labelClass: "text-red-400 bg-red-500/10 border-red-500/30", criteria: "صدر WHO DON، أو أُعلنت حالة PHEIC، أو CFR > 5%، أو مسبب وبائي جديد. إيبولا وماربورغ وسارس دائماً مرتفع." },
      { label: "خطر متوسط", labelClass: "text-yellow-400 bg-yellow-500/10 border-yellow-500/30", criteria: "مصدر رسمي مؤكد، انتشار إقليمي، CFR بين 1-5%، أو حالات كبيرة في مرض متوطن." },
      { label: "خطر منخفض", labelClass: "text-green-400 bg-green-500/10 border-green-500/30", criteria: "تفشٍّ محلي، انتقال محصور، CFR < 1%، لا دليل على انتشار دولي." },
    ],
    limitsTitle: "القيود",
    limits: [
      "نعتمد كلياً على ما تنشره المصادر الرسمية. تأخيرات الإبلاغ بين بداية التفشي والإعلان الرسمي خارجة عن سيطرتنا.",
      "أعداد الحالات تعكس ما أُبلغ عنه رسمياً — العبء الحقيقي عادةً أعلى بسبب نقص التشخيص والإبلاغ.",
      "الكشف عن انتهاء التفشي يدوي. لا نغلق التفشيات تلقائياً.",
      "HealthWatch Global ليست سلطة طبية. لا تحل البيانات محل الاستشارة المباشرة من المصادر الرسمية للقرارات الصحية.",
      "يعكس حقل «التاريخ» لكل تفشٍّ التاريخ الوارد في النشرة الرسمية — لا تاريخ إدراجه في HealthWatch. يُجرى الإدراج عموماً في غضون ساعة من النشر. يُظهر شارة الحداثة على لوحة التحكم الطابع الزمني الفعلي لآخر مزامنة.",
      "قد تُنشئ النشرات المتتالية لمنظمة الصحة العالمية حول الحدث نفسه أحياناً مدخلتين منفصلتين لنفس التفشي. يُكتشف هذا التكرار ويُدمج خلال 24 ساعة. استخدم رابط «الإبلاغ عن خطأ» في أي صفحة تفشٍّ للإبلاغ عن تكرار محتمل فوراً.",
    ],
    eiosTitle: "HealthWatch مقابل أدوات مراقبة منظمة الصحة العالمية (EIOS، EWARN)",
    eiosSub: "صُمِّم EIOS وأدوات مماثلة لمحللي منظمة الصحة العالمية والمؤسسات المنتسبة. تخدم HealthWatch Global جمهوراً مختلفاً.",
    eiosItems: [
      { label: "الوصول", hwg: "مفتوح لأي منظمة — دون بيانات اعتماد OMS أو انتساب", other: "EIOS يتطلب انتسابًا لمنظمة الصحة العالمية أو صلاحية نقطة التواصل الوطنية RSI" },
      { label: "التكلفة", hwg: `${PRICE_DISPLAY.ar.proMonthly}/شهر Pro — تجربة مجانية 14 يوماً، بدون التزام`, other: "مجاني للدول الأعضاء في منظمة الصحة العالمية والمؤسسات المعتمدة فقط — غير متاح للمنظمات غير الحكومية أو الهيئات الإنسانية أو القطاع الخاص دون بيانات اعتماد مؤسسية لمنظمة الصحة العالمية" },
      { label: "المستخدم المستهدف", hwg: "الفرق التشغيلية: منسقو المنظمات غير الحكومية، العاملون الإنسانيون، مديرو برامج الصحة", other: "محللون وبائيون مع تدريب OMS/مؤسسي" },
      { label: "تنبيهات استباقية", hwg: "تنبيهات بريد إلكتروني + Slack/Teams تلقائية حسب المنطقة", other: "لا يوجد نظام تنبيه استباقي — يتطلب مراقبة يومية نشطة" },
      { label: "اللغات", hwg: "الإنجليزية والفرنسية والإسبانية والعربية والإندونيسية", other: "الإنجليزية بصورة رئيسية" },
      { label: "وصول الفريق", hwg: "خطط فريق مشتركة مع إدارة المقاعد وفاتورة واحدة", other: "بيانات اعتماد فردية، لا مساحة عمل مشتركة" },
      { label: "تصدير البيانات", hwg: "تقارير PDF + تصدير CSV لكل تفشٍّ أو منطقة", other: "غير مصمم للتصدير إلى أنظمة خارجية" },
    ],
    correctionsTitle: "التصحيحات والنزاعات",
    correctionsDesc: "إذا رصدت خطأً في البيانات أو تناقضاً في المصادر، تواصل معنا. نراجع ونصحح خلال 48 ساعة.",
    correctionsBtn: "← الإبلاغ عن مشكلة في البيانات",
    citeLabel: "اقتبس هذه الصفحة",
    citeCopy: "نسخ الاقتباس",
    citeCopied: "تم النسخ!",
  },
  id: {
    back: "← Tentang",
    title: "Cara kami memproses data",
    subtitle: "HealthWatch Global tidak memproduksi data surveilans orisinal. Kami mengagregasi, menormalisasi, dan menyajikan data dari empat otoritas kesehatan internasional resmi — tanpa interpretasi editorial.",
    updatedLabel: "Terakhir diperbarui:",
    sourcesTitle: "Sumber data resmi",
    sources: [
      { name: "WHO DON", type: "Disease Outbreak News", coverage: "Global", freq: "Tidak teratur — per kejadian wabah", url: "https://www.who.int/emergencies/disease-outbreak-news" },
      { name: "ECDC CDTR", type: "Communicable Disease Threats Report", coverage: "Eropa / penilaian global", freq: "Mingguan + ad hoc", url: "https://www.ecdc.europa.eu/en/threats-and-outbreaks" },
      { name: "PAHO", type: "Pan American Health Organization", coverage: "Amerika", freq: "Per kejadian", url: "https://www.paho.org/en/epidemiological-alerts-and-updates" },
      { name: "Africa CDC", type: "Africa Centres for Disease Control", coverage: "Afrika", freq: "Per kejadian + sitrep mingguan", url: "https://africacdc.org/outbreaks-events" },
    ],
    pipelineTitle: "Alur data",
    pipelineSteps: [
      { title: "Sinkronisasi otomatis — WHO: setiap jam | ECDC, PAHO & Africa CDC: mingguan", desc: "Cron job terjadwal mengambil publikasi terbaru dari setiap sumber. WHO DON dicek setiap jam. ECDC, PAHO dan Africa CDC dicek setiap minggu. Wabah baru WHO masuk dalam 1 jam; sumber lain dalam minggu yang sama setelah publikasi." },
      { title: "Normalisasi", desc: "Nama negara, nama penyakit, tanggal, dan jumlah kasus distandarisasi ke skema umum." },
      { title: "Deduplikasi", desc: "Wabah dari beberapa sumber untuk kejadian yang sama dicocokkan dan digabungkan. Sumber otoritas tertinggi (WHO DON > ECDC > PAHO > Africa CDC) diprioritaskan." },
      { title: "Penyimpanan & ISR", desc: "Data disimpan di PostgreSQL (Supabase). Halaman dasbor divalidasi ulang setiap jam via Next.js ISR." },
    ],
    qualityTitle: "Tingkat kualitas data",
    qualityTiers: [
      { badge: "WHO DON", badgeClass: "bg-blue-900/30 border-blue-700/50 text-blue-400", title: "WHO Disease Outbreak News", desc: "Buletin WHO resmi yang dapat dikutip dengan nomor referensi DON unik. Kepercayaan tertinggi." },
      { badge: "RESMI", badgeClass: "bg-amber-900/30 border-amber-700/50 text-amber-400", title: "Sumber resmi terkonfirmasi", desc: "Data dari laporan resmi terkonfirmasi (WHO, ECDC, PAHO, atau Kementerian Kesehatan) tanpa nomor DON." },
      { badge: "BELUM DIVERIFIKASI", badgeClass: "bg-gray-800 border-gray-600 text-gray-400", title: "Angka sementara belum diverifikasi", desc: "Data awal yang belum dikaitkan dengan laporan resmi terkonfirmasi. Gunakan dengan hati-hati." },
    ],
    staleTitle: "Deteksi data usang",
    staleDesc: "Ketika tidak ada pembaruan resmi selama lebih dari 14 hari, badge ⚠ TK ADA UPDATE muncul. Ini tidak berarti wabah telah berakhir. Kami tidak pernah menutup wabah secara otomatis.",
    cfrTitle: "Tingkat kematian kasus (CFR)",
    cfrDesc: "CFR dihitung otomatis dari jumlah kasus dan kematian yang dilaporkan sumber resmi:",
    cfrFormula: "CFR = Kematian ÷ Kasus terkonfirmasi × 100",
    cfrWarning: "Ini adalah CFR kasar yang dilaporkan — tidak distandarisasi berdasarkan usia atau disesuaikan untuk pelaporan yang kurang. CFR awal wabah secara inheren tidak stabil.",
    riskTitle: "Penentuan tingkat risiko",
    riskDisclaimer: "Tingkat risiko ditetapkan secara algoritmis berdasarkan kriteria IHR yang diterbitkan WHO (Psl. 6, 9, 12) — bukan penilaian editorial. TINGGI berarti suatu wabah memenuhi ambang notifikasi Focal Point Nasional yang diterbitkan WHO. HealthWatch Global tidak melakukan penilaian risiko epidemiologis independen. Semua keputusan klinis dan kebijakan kesehatan harus mengandalkan sumber primer WHO/ECDC dan profesional terlatih.",
    riskLevels: [
      { label: "RISIKO TINGGI", labelClass: "text-red-400 bg-red-500/10 border-red-500/30", criteria: "WHO DON diterbitkan, PHEIC dinyatakan, CFR > 5%, atau patogen baru. Ebola, Marburg, SARS selalu TINGGI." },
      { label: "RISIKO SEDANG", labelClass: "text-yellow-400 bg-yellow-500/10 border-yellow-500/30", criteria: "Sumber resmi terkonfirmasi, penyebaran regional, CFR 1–5%, atau kasus signifikan pada penyakit endemik." },
      { label: "RISIKO RENDAH", labelClass: "text-green-400 bg-green-500/10 border-green-500/30", criteria: "Wabah terlokalisasi, penularan terkontrol, CFR < 1%, tidak ada bukti penyebaran internasional." },
    ],
    limitsTitle: "Keterbatasan",
    limits: [
      "Kami sepenuhnya bergantung pada apa yang diterbitkan sumber resmi. Keterlambatan pelaporan di luar kendali kami.",
      "Jumlah kasus mencerminkan yang dilaporkan secara resmi — beban sebenarnya biasanya lebih tinggi.",
      "Deteksi akhir wabah dilakukan secara manual. Kami tidak menutup wabah secara otomatis.",
      "HealthWatch Global bukan otoritas medis. Data tidak boleh menggantikan konsultasi publikasi resmi WHO/ECDC untuk keputusan klinis.",
      "Bidang 'tanggal' setiap wabah mencerminkan tanggal yang dilaporkan dalam buletin resmi — bukan kapan HealthWatch menerimanya. Penerimaan biasanya terjadi dalam 1 jam setelah publikasi sumber.",
      "Buletin WHO yang berurutan tentang kejadian yang sama terkadang dapat menghasilkan dua entri terpisah untuk wabah yang sama. Duplikat ini dideteksi dan digabung dalam 24 jam. Gunakan tautan 'Laporkan kesalahan' di halaman wabah mana pun untuk segera menandai duplikat yang dicurigai.",
    ],
    eiosTitle: "HealthWatch vs alat surveilans WHO (EIOS, EWARN)",
    eiosSub: "EIOS dan alat WHO serupa dirancang untuk analis WHO dan institusi afiliasi. HealthWatch Global melayani audiens yang berbeda.",
    eiosItems: [
      { label: "Akses", hwg: "Terbuka untuk organisasi mana pun — tanpa kredensial WHO", other: "EIOS memerlukan afiliasi WHO atau akses focal point RSI nasional" },
      { label: "Biaya", hwg: `${PRICE_DISPLAY.id.proMonthly}/bulan Pro — uji coba gratis 14 hari, tanpa komitmen`, other: "Gratis untuk negara anggota WHO & lembaga terakreditasi saja — tidak tersedia untuk LSM, organisasi kemanusiaan, atau sektor swasta tanpa kredensial institusional WHO" },
      { label: "Pengguna target", hwg: "Tim operasional: koordinator LSM, staf kemanusiaan, manajer program kesehatan", other: "Analis epidemiologi dengan pelatihan WHO/institusional" },
      { label: "Peringatan proaktif", hwg: "Peringatan email + Slack/Teams otomatis per wilayah", other: "Tidak ada sistem peringatan proaktif — memerlukan pemantauan aktif harian" },
      { label: "Bahasa", hwg: "Inggris, Prancis, Spanyol, Arab, Indonesia", other: "Terutama Inggris" },
      { label: "Akses tim", hwg: "Paket tim bersama dengan manajemen kursi dan satu faktur", other: "Kredensial individual, tanpa ruang kerja bersama" },
      { label: "Ekspor data", hwg: "Laporan PDF + ekspor CSV per wabah atau wilayah", other: "Tidak dirancang untuk ekspor ke sistem pihak ketiga" },
    ],
    correctionsTitle: "Koreksi dan sengketa data",
    correctionsDesc: "Jika Anda menemukan kesalahan data, angka yang salah, atau ketidaksesuaian sumber, hubungi kami. Kami meninjau dan memperbaiki dalam 48 jam.",
    correctionsBtn: "Laporkan masalah data →",
    citeLabel: "Kutip halaman ini",
    citeCopy: "Salin kutipan",
    citeCopied: "Disalin!",
  },
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const l = (LOCALES.includes(locale as Locale) ? locale : "en") as Locale;
  const m = META[l];
  const url = `${BASE_URL}/${l}/methodology`;

  return {
    title: m.title,
    description: m.description,
    alternates: {
      canonical: url,
      languages: {
        ...Object.fromEntries(LOCALES.map((loc) => [loc, `${BASE_URL}/${loc}/methodology`])),
        "x-default": `${BASE_URL}/en/methodology`,
      },
    },
    openGraph: { title: m.title, description: m.description, url, type: "website", siteName: "HealthWatch Global", locale: ({ en: "en_US", fr: "fr_FR", es: "es_ES", ar: "ar_SA", id: "id_ID" } as Record<string, string>)[l] ?? "en_US" },
    twitter: { card: "summary_large_image", title: m.title, description: m.description },
    robots: { index: true, follow: true },
  };
}

export default async function MethodologyPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const l = (LOCALES.includes(locale as Locale) ? locale : "en") as Locale;
  const c = COPY[l];
  const isRtl = l === "ar";

  const updatedStr = METHODOLOGY_UPDATED.toLocaleDateString(
    l === "ar" ? "ar-SA" : l === "fr" ? "fr-FR" : l === "es" ? "es-ES" : l === "id" ? "id-ID" : "en-GB",
    { year: "numeric", month: "long" }
  );

  return (
    <div className="max-w-3xl mx-auto py-4 space-y-12" dir={isRtl ? "rtl" : "ltr"}>

      {/* Breadcrumb */}
      <Link href={`/${l}/about`} className="text-sm text-gray-500 hover:text-gray-300 transition-colors">
        {c.back}
      </Link>

      {/* Hero */}
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0">
            <Database className="w-5 h-5 text-blue-400" />
          </div>
          <h1 className="text-3xl font-bold text-white">{c.title}</h1>
        </div>
        <p className="text-gray-400 leading-relaxed text-lg">{c.subtitle}</p>
        <p className="text-xs text-gray-600">
          {c.updatedLabel} <span className="text-gray-500">{updatedStr}</span>
        </p>
      </div>

      {/* Sources */}
      <section className="space-y-5">
        <h2 className="text-xl font-bold text-white border-b border-gray-800 pb-3">{c.sourcesTitle}</h2>
        <div className="grid sm:grid-cols-2 gap-4">
          {c.sources.map((s) => (
            <div key={s.name} className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold text-white text-sm">{s.name}</span>
                <span className="text-xs text-gray-500">{s.coverage}</span>
              </div>
              <p className="text-xs text-gray-400">{s.type}</p>
              <p className="text-xs text-gray-500">
                <Clock className="w-3 h-3 inline mr-1 opacity-60" />
                {s.freq}
              </p>
              <a
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] text-blue-400 hover:text-blue-300 transition-colors"
              >
                {s.url.replace("https://", "")} ↗
              </a>
            </div>
          ))}
        </div>
      </section>

      {/* Pipeline */}
      <section className="space-y-5">
        <h2 className="text-xl font-bold text-white border-b border-gray-800 pb-3">{c.pipelineTitle}</h2>
        <div className="space-y-3">
          {c.pipelineSteps.map((step, i) => (
            <div key={i} className="flex gap-4 bg-gray-900/50 border border-gray-800 rounded-xl p-4">
              <div className="w-7 h-7 rounded-full bg-gray-800 border border-gray-700 flex items-center justify-center text-xs font-bold text-gray-400 shrink-0 mt-0.5">
                {i + 1}
              </div>
              <div className="space-y-1">
                <p className="font-semibold text-white text-sm">{step.title}</p>
                <p className="text-gray-400 text-sm leading-relaxed">{step.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Quality tiers */}
      <section className="space-y-5">
        <h2 className="text-xl font-bold text-white border-b border-gray-800 pb-3">{c.qualityTitle}</h2>
        <div className="space-y-3">
          {c.qualityTiers.map((tier) => (
            <div key={tier.badge} className="bg-gray-900/50 border border-gray-800 rounded-xl p-4 space-y-2">
              <div className="flex items-center gap-3">
                <span className={`text-[11px] font-bold px-2 py-0.5 rounded border ${tier.badgeClass}`}>
                  {tier.badge}
                </span>
                <p className="font-semibold text-white text-sm">{tier.title}</p>
              </div>
              <p className="text-gray-400 text-sm leading-relaxed">{tier.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Stale data */}
      <section className="space-y-3">
        <h2 className="text-xl font-bold text-white border-b border-gray-800 pb-3">
          <AlertTriangle className="w-5 h-5 inline mr-2 text-orange-400 -mt-0.5" />
          {c.staleTitle}
        </h2>
        <p className="text-gray-400 leading-relaxed text-sm">{c.staleDesc}</p>
      </section>

      {/* CFR */}
      <section className="space-y-4">
        <h2 className="text-xl font-bold text-white border-b border-gray-800 pb-3">
          <TrendingUp className="w-5 h-5 inline mr-2 text-yellow-400 -mt-0.5" />
          {c.cfrTitle}
        </h2>
        <p className="text-gray-400 text-sm">{c.cfrDesc}</p>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 font-mono text-sm text-white text-center">
          {c.cfrFormula}
        </div>
        <div className="flex gap-3 bg-yellow-950/20 border border-yellow-800/30 rounded-xl p-4">
          <Info className="w-4 h-4 text-yellow-400 shrink-0 mt-0.5" />
          <p className="text-yellow-200/70 text-sm leading-relaxed">{c.cfrWarning}</p>
        </div>
      </section>

      {/* Risk levels */}
      <section className="space-y-4">
        <h2 className="text-xl font-bold text-white border-b border-gray-800 pb-3">
          <ShieldCheck className="w-5 h-5 inline mr-2 text-red-400 -mt-0.5" />
          {c.riskTitle}
        </h2>
        <div className="flex gap-3 bg-amber-500/8 border border-amber-500/25 rounded-xl p-4 text-sm text-amber-300/80 leading-relaxed">
          <Info className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
          {c.riskDisclaimer}
        </div>
        <div className="space-y-3">
          {c.riskLevels.map((r) => (
            <div key={r.label} className="flex gap-4 items-start bg-gray-900/50 border border-gray-800 rounded-xl p-4">
              <span className={`text-[11px] font-bold px-2.5 py-1 rounded border shrink-0 whitespace-nowrap ${r.labelClass}`}>
                {r.label}
              </span>
              <p className="text-gray-400 text-sm leading-relaxed">{r.criteria}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Limitations */}
      <section className="space-y-4">
        <h2 className="text-xl font-bold text-white border-b border-gray-800 pb-3">{c.limitsTitle}</h2>
        <ul className="space-y-3">
          {c.limits.map((limit, i) => (
            <li key={i} className="flex gap-3 text-sm text-gray-400 leading-relaxed">
              <span className="text-gray-600 shrink-0 mt-0.5">·</span>
              {limit}
            </li>
          ))}
        </ul>
      </section>

      {/* EIOS comparison */}
      <section className="space-y-5">
        <h2 className="text-xl font-bold text-white border-b border-gray-800 pb-3">
          <Info className="w-5 h-5 inline mr-2 text-blue-400 -mt-0.5" />
          {c.eiosTitle}
        </h2>
        <p className="text-gray-400 text-sm leading-relaxed">{c.eiosSub}</p>
        <div className="overflow-x-auto rounded-xl border border-gray-800">
          <table className="w-full text-sm min-w-[520px]">
            <thead>
              <tr className="border-b border-gray-800 bg-gray-900">
                <th className="text-left px-4 py-3 text-gray-500 font-medium w-1/4"></th>
                <th className="text-left px-4 py-3 font-bold text-red-400">HealthWatch Global</th>
                <th className="text-left px-4 py-3 font-bold text-gray-500">EIOS / EWARN</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/60">
              {c.eiosItems.map((row, i) => (
                <tr key={i} className={i % 2 === 0 ? "bg-gray-900/20" : ""}>
                  <td className="px-4 py-3 text-gray-500 text-xs font-medium">{row.label}</td>
                  <td className="px-4 py-3 text-gray-300 text-xs leading-relaxed">{row.hwg}</td>
                  <td className="px-4 py-3 text-gray-600 text-xs leading-relaxed">{row.other}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* GPHIN complementarity note */}
      <section className="bg-blue-950/30 border border-blue-800/30 rounded-xl p-5 space-y-2">
        <p className="text-sm font-semibold text-blue-300">
          {locale === "fr" ? "Vous utilisez déjà GPHIN ?" :
           locale === "es" ? "¿Ya usa GPHIN?" :
           locale === "ar" ? "هل تستخدم GPHIN بالفعل؟" :
           locale === "id" ? "Sudah menggunakan GPHIN?" :
           "Already using GPHIN?"}
        </p>
        <p className="text-sm text-gray-400 leading-relaxed">
          {locale === "fr" ? "GPHIN est une infrastructure d'intelligence gouvernementale pour vos analystes centraux. HealthWatch est la couche opérationnelle que vous donnez à vos équipes terrain — ceux qui n'ont pas de credentials GPHIN, qui travaillent en arabe, français ou indonésien, et qui ont besoin d'alertes et de PDFs partageables. Les deux outils sont complémentaires." :
           locale === "es" ? "GPHIN es infraestructura de inteligencia gubernamental para analistas centrales. HealthWatch es la capa operacional para sus equipos de campo — sin credenciales GPHIN, en 5 idiomas, con alertas y PDF compartibles. Ambas herramientas son complementarias." :
           locale === "ar" ? "GPHIN بنية تحتية استخباراتية حكومية للمحللين المركزيين. HealthWatch هي الطبقة التشغيلية لفرقك الميدانية — بدون بيانات اعتماد GPHIN، بـ 5 لغات، مع تنبيهات وتقارير PDF قابلة للمشاركة. الأداتان متكاملتان." :
           locale === "id" ? "GPHIN adalah infrastruktur intelijen pemerintah untuk analis pusat. HealthWatch adalah lapisan operasional untuk tim lapangan Anda — tanpa kredensial GPHIN, dalam 5 bahasa, dengan peringatan dan PDF yang dapat dibagikan. Kedua alat ini saling melengkapi." :
           "GPHIN is government intelligence infrastructure for your central analysts. HealthWatch is the operational layer for your field teams — those without GPHIN credentials, working in Arabic, French or Indonesian, who need alerts and shareable PDFs. The two tools are complementary."}
        </p>
      </section>

      {/* Corrections CTA */}
      <CitationBlock
        label={c.citeLabel}
        copyLabel={c.citeCopy}
        copiedLabel={c.citeCopied}
        citation={`HealthWatch Global. How we process data — methodology and sources [Internet]. 2026 [cited YYYY Mon DD]. Available from: ${BASE_URL}/${l}/methodology`}
      />

      <section className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-3">
        <div className="flex items-center gap-3">
          <Mail className="w-5 h-5 text-red-400 shrink-0" />
          <h2 className="text-lg font-bold text-white">{c.correctionsTitle}</h2>
        </div>
        <p className="text-gray-400 text-sm">{c.correctionsDesc}</p>
        <a
          href="mailto:contact@healthwatch-global.com?subject=Data%20correction%20request"
          className="inline-block bg-red-600 hover:bg-red-500 text-white font-semibold text-sm px-5 py-2.5 rounded-lg transition-colors"
        >
          {c.correctionsBtn}
        </a>
      </section>

    </div>
  );
}
