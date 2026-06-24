import { getLocale } from "next-intl/server";
import Link from "next/link";
import { ArrowLeft, Check, Shield, Lock, Server, Eye, Bell, FileText, Mail, AlertTriangle, Database, RefreshCw } from "lucide-react";
import type { Metadata } from "next";

const LOCALES = ["en", "fr", "es", "ar", "id"] as const;

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const titles: Record<string, string> = {
    fr: "Sécurité & conformité IT — HealthWatch Global",
    en: "Security & IT Compliance — HealthWatch Global",
    es: "Seguridad y conformidad IT — HealthWatch Global",
    ar: "الأمان والامتثال التقني — HealthWatch Global",
    id: "Keamanan & Kepatuhan IT — HealthWatch Global",
  };
  const descs: Record<string, string> = {
    fr: "Réponses aux questions de sécurité IT pour l'évaluation institutionnelle de HealthWatch Global.",
    en: "IT security answers for institutional evaluation of HealthWatch Global.",
    es: "Respuestas de seguridad IT para la evaluación institucional de HealthWatch Global.",
    ar: "إجابات أمان IT للتقييم المؤسسي لـ HealthWatch Global.",
    id: "Jawaban keamanan IT untuk evaluasi institusional HealthWatch Global.",
  };
  const url = `https://healthwatch-global.com/${locale}/security`;
  return {
    title: titles[locale] ?? titles.en,
    description: descs[locale] ?? descs.en,
    alternates: {
      canonical: url,
      languages: {
        ...Object.fromEntries(LOCALES.map((l) => [l, `https://healthwatch-global.com/${l}/security`])),
        "x-default": "https://healthwatch-global.com/en/security",
      },
    },
    robots: { index: true, follow: true },
  };
}

// ─── Copy ────────────────────────────────────────────────────────────────────
const COPY: Record<string, {
  back: string;
  title: string;
  subtitle: string;
  intro: string;
  request_checklist_cta: string;
  request_checklist_desc: string;
  badges: string[];
  sections: {
    icon: string;
    title: string;
    items: { q: string; a: string }[];
  }[];
  dpa_link: string;
  institutional_link: string;
  footer_title: string;
  footer_desc: string;
  footer_cta: string;
}> = {
  fr: {
    back: "Retour",
    title: "Sécurité & conformité IT",
    subtitle: "Document destiné aux équipes IT et DSI",
    intro: "Cette page répond aux questions les plus fréquentes des équipes informatiques lors de l'évaluation de HealthWatch Global. Si votre IT utilise une checklist standard, envoyez-la directement — nous répondons par écrit sous 2 jours ouvrés.",
    request_checklist_cta: "Envoyer votre checklist IT →",
    request_checklist_desc: "Réponse écrite sous 2 jours ouvrés. Format compatible avec vos procédures d'homologation.",
    badges: ["Données hébergées en UE", "Chiffrement AES-256 + TLS 1.3", "Notification de breach < 24h", "RGPD Art. 28 & 32 conforme"],
    sections: [
      {
        icon: "Server",
        title: "Hébergement & localisation des données",
        items: [
          {
            q: "Où sont hébergées les données ?",
            a: "Base de données et authentification : Supabase, région AWS eu-central-1 (Frankfurt, Allemagne). Application web et API : Vercel, région edge Europe activée. Emails transactionnels : Brevo (Sendinblue SAS), Paris, France. Toutes les données restent dans l'Union Européenne.",
          },
          {
            q: "Les données sont-elles transférées hors de l'UE ?",
            a: "Non pour les données de santé publique et de compte. Les logs d'infrastructure peuvent transiter par des CDN edge mondiaux (Vercel), couverts par des Standard Contractual Clauses (SCCs). Aucun transfert vers des pays tiers non couverts par une décision d'adéquation ou des SCCs.",
          },
          {
            q: "L'application est-elle disponible en mode déconnecté ou sur site (on-premise) ?",
            a: "Non. HealthWatch Global est un service SaaS cloud uniquement. Un déploiement on-premise n'est pas disponible à ce stade.",
          },
        ],
      },
      {
        icon: "Lock",
        title: "Chiffrement",
        items: [
          {
            q: "Chiffrement en transit",
            a: "HTTPS obligatoire sur toutes les routes. TLS 1.2 minimum, TLS 1.3 recommandé. Les connexions HTTP non sécurisées sont redirigées automatiquement vers HTTPS.",
          },
          {
            q: "Chiffrement au repos",
            a: "AES-256 géré par Supabase (AWS RDS encrypted volumes). Les mots de passe utilisateurs ne sont jamais stockés en clair — hashés avec bcrypt via Supabase Auth.",
          },
          {
            q: "Chiffrement des données de sauvegarde",
            a: "Les sauvegardes automatiques Supabase sont chiffrées au même niveau que les données de production (AES-256, même région AWS).",
          },
        ],
      },
      {
        icon: "Eye",
        title: "Contrôle d'accès",
        items: [
          {
            q: "Comment l'accès aux données est-il contrôlé ?",
            a: "Row-Level Security (RLS) Supabase activé sur toutes les tables : chaque utilisateur ne peut accéder qu'aux données de son organisation. Les API routes utilisent le service role Supabase uniquement pour les opérations système (crons, webhooks) — jamais exposé côté client.",
          },
          {
            q: "Principe de moindre privilège",
            a: "Les rôles applicatifs sont distincts : rôle utilisateur (lecture seule de son org), rôle service (opérations cron, lecture-écriture limitée aux tables système), rôle admin (accès restreint à l'interface /admin, protégé par Supabase Auth + vérification de rôle en base).",
          },
          {
            q: "Authentification multi-facteurs (MFA) disponible ?",
            a: "Non nativement à ce stade. L'authentification repose sur Supabase Auth (JWT sécurisés, sessions expirantes). La MFA est sur la feuille de route Enterprise.",
          },
          {
            q: "Gestion des sessions",
            a: "Sessions JWT avec expiration et rotation automatique via Supabase Auth. En cas de déconnexion ou de résiliation de compte, les tokens sont invalidés immédiatement.",
          },
        ],
      },
      {
        icon: "Database",
        title: "Sauvegardes & disponibilité",
        items: [
          {
            q: "Fréquence des sauvegardes",
            a: "Sauvegardes automatiques quotidiennes de la base de données Supabase. Point-in-time recovery (PITR) disponible sur le plan Pro Supabase (rétention 7 jours).",
          },
          {
            q: "Objectif de disponibilité (SLA)",
            a: "Objectif de disponibilité 99,9 % (infrastructure Vercel + Supabase combinée). Un SLA écrit est inclus dans les abonnements Team et Enterprise.",
          },
          {
            q: "Temps de récupération en cas d'incident (RTO / RPO) ?",
            a: "RTO estimé : < 4 heures pour une restauration complète. RPO : < 24 heures (fréquence des sauvegardes quotidiennes). Ces valeurs sont indicatives et peuvent être formalisées par contrat pour les abonnements Enterprise.",
          },
        ],
      },
      {
        icon: "Bell",
        title: "Notification de breach & réponse aux incidents",
        items: [
          {
            q: "Délai de notification en cas de violation de données",
            a: "Notification au Responsable du traitement dans un délai de 24 heures après prise de connaissance, conformément à l'Art. 33 RGPD. La notification inclut : nature de la violation, catégories et volume de données concernées, mesures prises et mesures correctives envisagées.",
          },
          {
            q: "Processus de réponse aux incidents",
            a: "1) Détection (monitoring Sentry + alertes Supabase) → 2) Confinement (révocation des accès compromis) → 3) Notification du Responsable < 24h → 4) Notification CNIL si risque élevé < 72h → 5) Rapport post-incident fourni sur demande.",
          },
          {
            q: "Disclosure de vulnérabilités",
            a: "Les rapports de vulnérabilités peuvent être envoyés à security@healthwatch-global.com. Nous répondons sous 5 jours ouvrés avec un accusé de réception et une estimation du calendrier de correction.",
          },
        ],
      },
      {
        icon: "RefreshCw",
        title: "Gestion des sous-traitants & chaîne d'approvisionnement",
        items: [
          {
            q: "Liste des sous-traitants (sous-processors RGPD)",
            a: "Supabase Inc. (DB & Auth, Frankfurt), Brevo/Sendinblue SAS (emails, Paris), Vercel Inc. (hébergement & CDN, edge EU), Stripe Inc. (paiements, UE/US — SCCs). La liste complète avec DPA de chaque sous-traitant est disponible dans notre DPA Art. 28.",
          },
          {
            q: "Notification en cas de changement de sous-traitant",
            a: "Conformément à l'Art. 28(2) RGPD, le Responsable sera notifié de tout ajout ou remplacement de sous-traitant avec un préavis raisonnable, lui laissant la possibilité de s'y opposer.",
          },
        ],
      },
      {
        icon: "AlertTriangle",
        title: "Certification & audits",
        items: [
          {
            q: "Êtes-vous certifiés ISO 27001 ?",
            a: "Non. HealthWatch Global est une infrastructure early-stage. Nous appliquons les mesures techniques équivalentes (chiffrement, RLS, RBAC, monitoring, backup) et les documentons de manière vérifiable. La certification ISO 27001 est envisagée à partir de 2027.",
          },
          {
            q: "Audit de sécurité ou test d'intrusion réalisé ?",
            a: "Pas de pentest formel à ce stade. Un audit de code source peut être organisé pour les abonnements Enterprise sur demande. Nous fournissons l'accès au dépôt privé pour review technique.",
          },
          {
            q: "Rapport SOC 2 disponible ?",
            a: "Non. Supabase (notre fournisseur de base de données) est SOC 2 Type II certifié — le rapport est disponible via leur Trust Center. Vercel dispose également d'attestations SOC 2.",
          },
        ],
      },
    ],
    dpa_link: "Consulter le DPA complet (Art. 28 RGPD) →",
    institutional_link: "Processus d'achat institutionnel →",
    footer_title: "Votre IT a une checklist spécifique ?",
    footer_desc: "Envoyez-nous votre liste de questions standard (format libre, Word, PDF ou email). Nous répondons point par point par écrit sous 2 jours ouvrés — dans le format requis par votre procédure d'homologation.",
    footer_cta: "Envoyer la checklist IT →",
  },

  en: {
    back: "Back",
    title: "Security & IT Compliance",
    subtitle: "Document for IT and InfoSec teams",
    intro: "This page answers the most common IT security questions when evaluating HealthWatch Global. If your IT team has a standard checklist, send it directly — we respond in writing within 2 business days.",
    request_checklist_cta: "Send your IT checklist →",
    request_checklist_desc: "Written response within 2 business days, in a format compatible with your procurement process.",
    badges: ["EU-hosted data", "AES-256 + TLS 1.3 encryption", "Breach notification < 24h", "GDPR Art. 28 & 32 compliant"],
    sections: [
      {
        icon: "Server",
        title: "Hosting & data location",
        items: [
          {
            q: "Where is data hosted?",
            a: "Database and authentication: Supabase, AWS eu-central-1 region (Frankfurt, Germany). Web app and API: Vercel, EU edge region enabled. Transactional email: Brevo (Sendinblue SAS), Paris, France. All data remains within the European Union.",
          },
          {
            q: "Are data transferred outside the EU?",
            a: "No for health surveillance and account data. Infrastructure logs may transit through global Vercel edge CDN nodes, covered by Standard Contractual Clauses (SCCs). No transfers to third countries not covered by an adequacy decision or SCCs.",
          },
          {
            q: "Is an offline or on-premise deployment available?",
            a: "No. HealthWatch Global is a cloud SaaS service only. On-premise deployment is not available at this stage.",
          },
        ],
      },
      {
        icon: "Lock",
        title: "Encryption",
        items: [
          {
            q: "Encryption in transit",
            a: "HTTPS enforced on all routes. TLS 1.2 minimum, TLS 1.3 preferred. Unencrypted HTTP connections are automatically redirected to HTTPS.",
          },
          {
            q: "Encryption at rest",
            a: "AES-256 managed by Supabase (AWS RDS encrypted volumes). User passwords are never stored in clear text — hashed with bcrypt via Supabase Auth.",
          },
          {
            q: "Backup encryption",
            a: "Supabase automated backups are encrypted at the same level as production data (AES-256, same AWS region).",
          },
        ],
      },
      {
        icon: "Eye",
        title: "Access control",
        items: [
          {
            q: "How is data access controlled?",
            a: "Supabase Row-Level Security (RLS) enabled on all tables: each user can only access data within their organization. API routes use the Supabase service role only for system operations (crons, webhooks) — never exposed client-side.",
          },
          {
            q: "Least-privilege principle",
            a: "Application roles are distinct: user role (read-only, own org), service role (cron operations, limited read-write on system tables), admin role (restricted to /admin interface, protected by Supabase Auth + DB role check).",
          },
          {
            q: "Multi-factor authentication (MFA) available?",
            a: "Not natively at this stage. Authentication relies on Supabase Auth (secure JWTs, expiring sessions). MFA is on the Enterprise roadmap.",
          },
          {
            q: "Session management",
            a: "JWT sessions with automatic expiration and rotation via Supabase Auth. On logout or account termination, tokens are immediately invalidated.",
          },
        ],
      },
      {
        icon: "Database",
        title: "Backups & availability",
        items: [
          {
            q: "Backup frequency",
            a: "Automatic daily database backups via Supabase. Point-in-time recovery (PITR) available on Supabase Pro plan (7-day retention).",
          },
          {
            q: "Availability SLA",
            a: "99.9% uptime target (combined Vercel + Supabase infrastructure). A written SLA is included in Team and Enterprise subscriptions.",
          },
          {
            q: "Recovery time objective (RTO / RPO)?",
            a: "Estimated RTO: < 4 hours for full restoration. RPO: < 24 hours (daily backup frequency). These values are indicative and can be formalized by contract for Enterprise subscriptions.",
          },
        ],
      },
      {
        icon: "Bell",
        title: "Breach notification & incident response",
        items: [
          {
            q: "Breach notification timeline",
            a: "Notification to the Controller within 24 hours of becoming aware, in accordance with GDPR Art. 33. Notification includes: nature of the breach, categories and volume of data affected, measures taken and planned corrective actions.",
          },
          {
            q: "Incident response process",
            a: "1) Detection (Sentry monitoring + Supabase alerts) → 2) Containment (revoke compromised access) → 3) Controller notification < 24h → 4) CNIL notification if high risk < 72h → 5) Post-incident report available on request.",
          },
          {
            q: "Vulnerability disclosure",
            a: "Vulnerability reports can be sent to security@healthwatch-global.com. We respond within 5 business days with an acknowledgement and estimated remediation timeline.",
          },
        ],
      },
      {
        icon: "RefreshCw",
        title: "Sub-processors & supply chain",
        items: [
          {
            q: "Sub-processor list (GDPR sub-processors)",
            a: "Supabase Inc. (DB & Auth, Frankfurt), Brevo/Sendinblue SAS (email, Paris), Vercel Inc. (hosting & CDN, EU edge), Stripe Inc. (payments, EU/US — SCCs). Full list with each sub-processor's DPA is available in our GDPR Art. 28 DPA.",
          },
          {
            q: "Notification of sub-processor changes",
            a: "Pursuant to GDPR Art. 28(2), the Controller will be notified of any intended addition or replacement of a sub-processor with reasonable prior notice, giving the Controller the opportunity to object.",
          },
        ],
      },
      {
        icon: "AlertTriangle",
        title: "Certifications & audits",
        items: [
          {
            q: "Are you ISO 27001 certified?",
            a: "No. HealthWatch Global is an early-stage infrastructure. We apply equivalent technical controls (encryption, RLS, RBAC, monitoring, backups) and document them in a verifiable manner. ISO 27001 certification is planned from 2027.",
          },
          {
            q: "Has a security audit or penetration test been conducted?",
            a: "No formal pentest at this stage. A source code audit can be arranged for Enterprise subscriptions on request. We provide access to the private repository for technical review.",
          },
          {
            q: "SOC 2 report available?",
            a: "No. Supabase (our database provider) is SOC 2 Type II certified — their report is available through their Trust Center. Vercel also holds SOC 2 attestations.",
          },
        ],
      },
    ],
    dpa_link: "Read the full DPA (GDPR Art. 28) →",
    institutional_link: "Institutional procurement process →",
    footer_title: "Does your IT team have a specific checklist?",
    footer_desc: "Send us your standard question list (any format — Word, PDF, or email). We respond point by point in writing within 2 business days, in the format your procurement process requires.",
    footer_cta: "Send IT checklist →",
  },

  es: {
    back: "Volver",
    title: "Seguridad y conformidad IT",
    subtitle: "Documento para equipos IT y seguridad de la información",
    intro: "Esta página responde las preguntas de seguridad IT más frecuentes al evaluar HealthWatch Global. Si su equipo IT tiene una lista de verificación estándar, envíenosla directamente — respondemos por escrito en 2 días hábiles.",
    request_checklist_cta: "Enviar su checklist IT →",
    request_checklist_desc: "Respuesta escrita en 2 días hábiles, en formato compatible con su proceso de adquisición.",
    badges: ["Datos alojados en la UE", "Cifrado AES-256 + TLS 1.3", "Notificación de breach < 24h", "RGPD Art. 28 y 32 conforme"],
    sections: [
      {
        icon: "Server",
        title: "Alojamiento y localización de datos",
        items: [
          { q: "¿Dónde se alojan los datos?", a: "Base de datos y autenticación: Supabase, región AWS eu-central-1 (Frankfurt, Alemania). Aplicación web y API: Vercel, región edge Europa activada. Email transaccional: Brevo (Sendinblue SAS), París, Francia. Todos los datos permanecen en la Unión Europea." },
          { q: "¿Se transfieren datos fuera de la UE?", a: "No para datos de vigilancia sanitaria y de cuenta. Los logs de infraestructura pueden transitar por nodos CDN edge globales de Vercel, cubiertos por Cláusulas Contractuales Estándar (SCCs). No hay transferencias a terceros países no cubiertos por una decisión de adecuación o SCCs." },
          { q: "¿Hay despliegue offline o en local disponible?", a: "No. HealthWatch Global es un servicio SaaS en la nube únicamente. El despliegue on-premise no está disponible en esta fase." },
        ],
      },
      {
        icon: "Lock",
        title: "Cifrado",
        items: [
          { q: "Cifrado en tránsito", a: "HTTPS obligatorio en todas las rutas. TLS 1.2 mínimo, TLS 1.3 preferido. Las conexiones HTTP no seguras se redirigen automáticamente a HTTPS." },
          { q: "Cifrado en reposo", a: "AES-256 gestionado por Supabase (volúmenes AWS RDS cifrados). Las contraseñas de usuario nunca se almacenan en claro — hasheadas con bcrypt via Supabase Auth." },
          { q: "Cifrado de copias de seguridad", a: "Las copias de seguridad automáticas de Supabase están cifradas al mismo nivel que los datos de producción (AES-256, misma región AWS)." },
        ],
      },
      {
        icon: "Eye",
        title: "Control de acceso",
        items: [
          { q: "¿Cómo se controla el acceso a los datos?", a: "Row-Level Security (RLS) de Supabase activado en todas las tablas: cada usuario solo puede acceder a los datos de su organización. Las rutas API usan el service role de Supabase solo para operaciones del sistema (crons, webhooks) — nunca expuesto al cliente." },
          { q: "Principio de mínimo privilegio", a: "Los roles de aplicación son distintos: rol usuario (solo lectura, propia org), rol servicio (operaciones cron, lectura-escritura limitada a tablas del sistema), rol admin (restringido a la interfaz /admin, protegido por Supabase Auth + verificación de rol en BD)." },
          { q: "¿Autenticación multifactor (MFA) disponible?", a: "No de forma nativa en esta fase. La autenticación se basa en Supabase Auth (JWT seguros, sesiones con expiración). La MFA está en la hoja de ruta Enterprise." },
          { q: "Gestión de sesiones", a: "Sesiones JWT con expiración y rotación automática via Supabase Auth. Al cerrar sesión o dar de baja la cuenta, los tokens se invalidan inmediatamente." },
        ],
      },
      {
        icon: "Database",
        title: "Copias de seguridad y disponibilidad",
        items: [
          { q: "Frecuencia de copias de seguridad", a: "Copias de seguridad diarias automáticas de la base de datos via Supabase. Point-in-time recovery (PITR) disponible en el plan Pro de Supabase (retención 7 días)." },
          { q: "SLA de disponibilidad", a: "Objetivo de disponibilidad 99,9% (infraestructura combinada Vercel + Supabase). Un SLA escrito está incluido en las suscripciones Team y Enterprise." },
          { q: "¿Objetivo de tiempo de recuperación (RTO / RPO)?", a: "RTO estimado: < 4 horas para restauración completa. RPO: < 24 horas (frecuencia de copias de seguridad diarias). Estos valores son indicativos y pueden formalizarse por contrato para suscripciones Enterprise." },
        ],
      },
      {
        icon: "Bell",
        title: "Notificación de breach y respuesta a incidentes",
        items: [
          { q: "Plazo de notificación en caso de violación de datos", a: "Notificación al Responsable del tratamiento en un plazo de 24 horas tras tener conocimiento, conforme al Art. 33 RGPD. La notificación incluye: naturaleza de la violación, categorías y volumen de datos afectados, medidas tomadas y correctivas previstas." },
          { q: "Proceso de respuesta a incidentes", a: "1) Detección (monitoreo Sentry + alertas Supabase) → 2) Contención (revocación de accesos comprometidos) → 3) Notificación al Responsable < 24h → 4) Notificación a la autoridad supervisora si hay riesgo elevado < 72h → 5) Informe post-incidente disponible a petición." },
          { q: "Divulgación de vulnerabilidades", a: "Los informes de vulnerabilidades se pueden enviar a security@healthwatch-global.com. Respondemos en 5 días hábiles con un acuse de recibo y una estimación del calendario de corrección." },
        ],
      },
      {
        icon: "RefreshCw",
        title: "Subencargados y cadena de suministro",
        items: [
          { q: "Lista de subencargados (sub-processors RGPD)", a: "Supabase Inc. (BD & Auth, Frankfurt), Brevo/Sendinblue SAS (email, París), Vercel Inc. (alojamiento & CDN, edge UE), Stripe Inc. (pagos, UE/EE.UU. — SCCs). La lista completa con DPA de cada subencargado está disponible en nuestro DPA Art. 28." },
          { q: "Notificación de cambios de subencargado", a: "De acuerdo con el Art. 28(2) RGPD, el Responsable será notificado de cualquier adición o sustitución planificada de un subencargado con un preaviso razonable, permitiéndole oponerse." },
        ],
      },
      {
        icon: "AlertTriangle",
        title: "Certificaciones y auditorías",
        items: [
          { q: "¿Tienen certificación ISO 27001?", a: "No. HealthWatch Global es una infraestructura en fase inicial. Aplicamos controles técnicos equivalentes (cifrado, RLS, RBAC, monitoreo, copias de seguridad) y los documentamos de forma verificable. La certificación ISO 27001 está prevista a partir de 2027." },
          { q: "¿Se ha realizado una auditoría de seguridad o prueba de penetración?", a: "No hay pentest formal en esta fase. Se puede organizar una auditoría de código fuente para suscripciones Enterprise a petición. Proporcionamos acceso al repositorio privado para revisión técnica." },
          { q: "¿Informe SOC 2 disponible?", a: "No. Supabase (nuestro proveedor de base de datos) tiene certificación SOC 2 Tipo II — su informe está disponible en su Trust Center. Vercel también cuenta con certificaciones SOC 2." },
        ],
      },
    ],
    dpa_link: "Consultar el DPA completo (RGPD Art. 28) →",
    institutional_link: "Proceso de adquisición institucional →",
    footer_title: "¿Su equipo IT tiene una checklist específica?",
    footer_desc: "Envíenos su lista de preguntas estándar (cualquier formato — Word, PDF o email). Respondemos punto por punto por escrito en 2 días hábiles, en el formato requerido por su proceso de adquisición.",
    footer_cta: "Enviar checklist IT →",
  },

  ar: {
    back: "رجوع",
    title: "الأمان والامتثال التقني",
    subtitle: "وثيقة موجهة لفرق IT وأمن المعلومات",
    intro: "تجيب هذه الصفحة على أكثر الأسئلة شيوعاً لدى فرق IT عند تقييم HealthWatch Global. إذا كان لدى فريقكم قائمة تحقق موحدة، أرسلوها مباشرة — نرد كتابياً خلال يومي عمل.",
    request_checklist_cta: "أرسلوا قائمة التحقق التقنية ←",
    request_checklist_desc: "رد كتابي خلال يومي عمل، بصيغة متوافقة مع إجراءات المشتريات لديكم.",
    badges: ["البيانات مستضافة في الاتحاد الأوروبي", "تشفير AES-256 + TLS 1.3", "إشعار الاختراق < 24 ساعة", "متوافق مع RGPD المادتين 28 و32"],
    sections: [
      {
        icon: "Server",
        title: "الاستضافة وموقع البيانات",
        items: [
          { q: "أين تُستضاف البيانات؟", a: "قاعدة البيانات والمصادقة: Supabase، منطقة AWS eu-central-1 (فرانكفورت، ألمانيا). تطبيق الويب وAPI: Vercel، منطقة edge أوروبية مفعّلة. البريد الإلكتروني التعاملي: Brevo (Sendinblue SAS)، باريس، فرنسا. تبقى جميع البيانات داخل الاتحاد الأوروبي." },
          { q: "هل تُنقل البيانات خارج الاتحاد الأوروبي؟", a: "لا، فيما يخص بيانات المراقبة الصحية والحسابات. قد تعبر سجلات البنية التحتية عُقد CDN عالمية لـ Vercel، مغطاة بالبنود التعاقدية القياسية (SCCs). لا نقل لأي دولة ثالثة غير مشمولة بقرار ملاءمة أو SCCs." },
          { q: "هل يتوفر نشر غير متصل أو محلي (on-premise)؟", a: "لا. HealthWatch Global خدمة SaaS سحابية حصراً. النشر المحلي غير متاح في هذه المرحلة." },
        ],
      },
      {
        icon: "Lock",
        title: "التشفير",
        items: [
          { q: "التشفير أثناء النقل", a: "HTTPS إلزامي على جميع المسارات. الحد الأدنى TLS 1.2، ويُفضَّل TLS 1.3. تُعاد توجيه اتصالات HTTP غير المشفرة تلقائياً إلى HTTPS." },
          { q: "التشفير أثناء التخزين", a: "AES-256 مُدار بواسطة Supabase (أقراص AWS RDS مشفرة). كلمات مرور المستخدمين لا تُخزَّن نصاً صريحاً أبداً — مُجزَّأة بـ bcrypt عبر Supabase Auth." },
          { q: "تشفير النسخ الاحتياطية", a: "النسخ الاحتياطية التلقائية لـ Supabase مشفرة بنفس مستوى بيانات الإنتاج (AES-256، منطقة AWS ذاتها)." },
        ],
      },
      {
        icon: "Eye",
        title: "التحكم في الوصول",
        items: [
          { q: "كيف يُتحكم في الوصول إلى البيانات؟", a: "أمان على مستوى الصف (RLS) مفعّل من Supabase على جميع الجداول: كل مستخدم لا يمكنه الوصول إلا لبيانات مؤسسته. مسارات API تستخدم service role لـ Supabase فقط للعمليات النظامية (crons، webhooks) — غير مكشوفة على جانب العميل." },
          { q: "مبدأ الحد الأدنى من الامتيازات", a: "أدوار التطبيق مفصولة: دور المستخدم (قراءة فقط، مؤسسته)، دور الخدمة (عمليات cron، قراءة-كتابة محدودة)، دور المسؤول (مقيد بواجهة /admin، محمي بـ Supabase Auth + التحقق من الدور في قاعدة البيانات)." },
          { q: "هل المصادقة متعددة العوامل (MFA) متاحة؟", a: "ليس بشكل أصلي في هذه المرحلة. المصادقة تعتمد على Supabase Auth (JWT آمنة، جلسات منتهية الصلاحية). MFA مدرجة في خارطة طريق Enterprise." },
          { q: "إدارة الجلسات", a: "جلسات JWT مع انتهاء صلاحية وتدوير تلقائي عبر Supabase Auth. عند تسجيل الخروج أو إنهاء الحساب، تُلغى الرموز المميزة فوراً." },
        ],
      },
      {
        icon: "Database",
        title: "النسخ الاحتياطية والتوفر",
        items: [
          { q: "تكرار النسخ الاحتياطية", a: "نسخ احتياطية يومية تلقائية لقاعدة البيانات عبر Supabase. استرداد في أي وقت (PITR) متاح على خطة Supabase Pro (احتفاظ 7 أيام)." },
          { q: "اتفاقية مستوى الخدمة (SLA)", a: "هدف توفر 99.9% (البنية التحتية المجمعة Vercel + Supabase). SLA مكتوب مضمّن في اشتراكات Team وEnterprise." },
          { q: "وقت الاسترداد (RTO / RPO)؟", a: "RTO المقدّر: < 4 ساعات للاستعادة الكاملة. RPO: < 24 ساعة (تكرار النسخ الاحتياطية اليومية). هذه القيم استرشادية ويمكن رسمتها بعقد لاشتراكات Enterprise." },
        ],
      },
      {
        icon: "Bell",
        title: "إشعار الاختراق والاستجابة للحوادث",
        items: [
          { q: "الجدول الزمني للإشعار عند اختراق البيانات", a: "إشعار المتحكم في البيانات خلال 24 ساعة من الاكتشاف، وفق المادة 33 من اللائحة RGPD. يتضمن الإشعار: طبيعة الاختراق، فئات وحجم البيانات المتأثرة، الإجراءات المتخذة والتصحيحية المقررة." },
          { q: "عملية الاستجابة للحوادث", a: "1) الكشف (مراقبة Sentry + تنبيهات Supabase) → 2) الاحتواء (سحب الصلاحيات المخترقة) → 3) إشعار المتحكم < 24 ساعة → 4) إشعار الجهة الإشرافية إن وجد خطر عالٍ < 72 ساعة → 5) تقرير ما بعد الحادث متاح عند الطلب." },
          { q: "الإفصاح عن الثغرات", a: "يمكن إرسال تقارير الثغرات إلى security@healthwatch-global.com. نرد خلال 5 أيام عمل بتأكيد استلام وتقدير للجدول الزمني للمعالجة." },
        ],
      },
      {
        icon: "RefreshCw",
        title: "المعالجون الفرعيون وسلسلة التوريد",
        items: [
          { q: "قائمة المعالجين الفرعيين", a: "Supabase Inc. (قاعدة بيانات ومصادقة، فرانكفورت)، Brevo/Sendinblue SAS (بريد إلكتروني، باريس)، Vercel Inc. (استضافة وCDN، edge UE)، Stripe Inc. (مدفوعات، UE/US — SCCs). القائمة الكاملة مع DPA كل معالج فرعي متاحة في DPA المادة 28 الخاص بنا." },
          { q: "الإشعار بتغييرات المعالجين الفرعيين", a: "وفق المادة 28(2) RGPD، سيُبلَّغ المتحكم بأي إضافة أو استبدال مخطط لمعالج فرعي مع إشعار مسبق معقول، مما يتيح له الاعتراض." },
        ],
      },
      {
        icon: "AlertTriangle",
        title: "الشهادات والتدقيق",
        items: [
          { q: "هل لديكم شهادة ISO 27001؟", a: "لا. HealthWatch Global بنية تحتية في مرحلة مبكرة. نطبق ضوابط تقنية مكافئة (تشفير، RLS، RBAC، مراقبة، نسخ احتياطية) ونوثقها بشكل قابل للتحقق. شهادة ISO 27001 مخطط لها اعتباراً من 2027." },
          { q: "هل أُجري تدقيق أمني أو اختبار اختراق؟", a: "لا يوجد pentest رسمي في هذه المرحلة. يمكن ترتيب تدقيق الكود المصدري لاشتراكات Enterprise عند الطلب. نوفر الوصول إلى المستودع الخاص للمراجعة التقنية." },
          { q: "هل يتوفر تقرير SOC 2؟", a: "لا. Supabase (مزوّد قاعدة بياناتنا) معتمد SOC 2 Type II — تقريره متاح عبر Trust Center الخاص بهم. Vercel لديها أيضاً شهادات SOC 2." },
        ],
      },
    ],
    dpa_link: "قراءة DPA الكاملة (RGPD المادة 28) ←",
    institutional_link: "عملية الشراء المؤسسي ←",
    footer_title: "هل لدى فريق IT لديكم قائمة تحقق خاصة؟",
    footer_desc: "أرسلوا لنا قائمة أسئلتكم القياسية (بأي صيغة — Word، PDF أو بريد إلكتروني). نرد نقطة بنقطة كتابياً خلال يومي عمل، بالصيغة التي تتطلبها إجراءات المشتريات لديكم.",
    footer_cta: "أرسل قائمة التحقق IT ←",
  },

  id: {
    back: "Kembali",
    title: "Keamanan & Kepatuhan IT",
    subtitle: "Dokumen untuk tim IT dan keamanan informasi",
    intro: "Halaman ini menjawab pertanyaan keamanan IT yang paling sering diajukan saat mengevaluasi HealthWatch Global. Jika tim IT Anda memiliki checklist standar, kirimkan langsung — kami merespons secara tertulis dalam 2 hari kerja.",
    request_checklist_cta: "Kirim checklist IT Anda →",
    request_checklist_desc: "Respons tertulis dalam 2 hari kerja, dalam format yang kompatibel dengan proses pengadaan Anda.",
    badges: ["Data dihosting di UE", "Enkripsi AES-256 + TLS 1.3", "Notifikasi breach < 24j", "GDPR Pasal 28 & 32 patuh"],
    sections: [
      {
        icon: "Server",
        title: "Hosting & lokasi data",
        items: [
          { q: "Di mana data dihosting?", a: "Database dan autentikasi: Supabase, region AWS eu-central-1 (Frankfurt, Jerman). Aplikasi web dan API: Vercel, region edge Eropa diaktifkan. Email transaksional: Brevo (Sendinblue SAS), Paris, Prancis. Semua data tetap berada di Uni Eropa." },
          { q: "Apakah data ditransfer di luar UE?", a: "Tidak untuk data pengawasan kesehatan dan akun. Log infrastruktur dapat melewati node CDN edge global Vercel, yang dicakup oleh Standard Contractual Clauses (SCCs). Tidak ada transfer ke negara ketiga yang tidak dicakup oleh keputusan kecukupan atau SCCs." },
          { q: "Apakah tersedia deployment offline atau on-premise?", a: "Tidak. HealthWatch Global adalah layanan SaaS cloud saja. Deployment on-premise tidak tersedia pada tahap ini." },
        ],
      },
      {
        icon: "Lock",
        title: "Enkripsi",
        items: [
          { q: "Enkripsi saat transit", a: "HTTPS wajib di semua rute. TLS 1.2 minimum, TLS 1.3 disarankan. Koneksi HTTP tidak aman diarahkan ulang secara otomatis ke HTTPS." },
          { q: "Enkripsi saat disimpan", a: "AES-256 dikelola oleh Supabase (volume AWS RDS terenkripsi). Kata sandi pengguna tidak pernah disimpan dalam teks biasa — di-hash dengan bcrypt melalui Supabase Auth." },
          { q: "Enkripsi backup", a: "Backup otomatis Supabase dienkripsi pada level yang sama dengan data produksi (AES-256, region AWS yang sama)." },
        ],
      },
      {
        icon: "Eye",
        title: "Kontrol akses",
        items: [
          { q: "Bagaimana akses data dikontrol?", a: "Row-Level Security (RLS) Supabase diaktifkan di semua tabel: setiap pengguna hanya dapat mengakses data dalam organisasinya. Rute API menggunakan service role Supabase hanya untuk operasi sistem (crons, webhooks) — tidak pernah diekspos ke sisi klien." },
          { q: "Prinsip hak istimewa minimum", a: "Peran aplikasi terpisah: peran pengguna (hanya baca, org sendiri), peran layanan (operasi cron, baca-tulis terbatas pada tabel sistem), peran admin (terbatas pada antarmuka /admin, dilindungi oleh Supabase Auth + pemeriksaan peran di DB)." },
          { q: "Autentikasi multi-faktor (MFA) tersedia?", a: "Tidak secara bawaan pada tahap ini. Autentikasi bergantung pada Supabase Auth (JWT aman, sesi berakhir). MFA ada di peta jalan Enterprise." },
          { q: "Manajemen sesi", a: "Sesi JWT dengan kedaluwarsa dan rotasi otomatis melalui Supabase Auth. Saat keluar atau penghentian akun, token segera dibatalkan." },
        ],
      },
      {
        icon: "Database",
        title: "Backup & ketersediaan",
        items: [
          { q: "Frekuensi backup", a: "Backup database harian otomatis melalui Supabase. Point-in-time recovery (PITR) tersedia pada paket Supabase Pro (retensi 7 hari)." },
          { q: "SLA ketersediaan", a: "Target uptime 99,9% (infrastruktur gabungan Vercel + Supabase). SLA tertulis disertakan dalam langganan Team dan Enterprise." },
          { q: "Recovery time objective (RTO / RPO)?", a: "RTO estimasi: < 4 jam untuk pemulihan penuh. RPO: < 24 jam (frekuensi backup harian). Nilai-nilai ini indikatif dan dapat diformalkan dalam kontrak untuk langganan Enterprise." },
        ],
      },
      {
        icon: "Bell",
        title: "Notifikasi breach & respons insiden",
        items: [
          { q: "Jadwal notifikasi pelanggaran data", a: "Notifikasi kepada Pengontrol dalam 24 jam setelah menyadari, sesuai GDPR Pasal 33. Notifikasi mencakup: sifat pelanggaran, kategori dan volume data yang terpengaruh, tindakan yang diambil dan tindakan korektif yang direncanakan." },
          { q: "Proses respons insiden", a: "1) Deteksi (monitoring Sentry + alert Supabase) → 2) Penahanan (cabut akses yang disusupi) → 3) Notifikasi Pengontrol < 24j → 4) Notifikasi otoritas pengawas jika risiko tinggi < 72j → 5) Laporan pasca-insiden tersedia atas permintaan." },
          { q: "Pengungkapan kerentanan", a: "Laporan kerentanan dapat dikirim ke security@healthwatch-global.com. Kami merespons dalam 5 hari kerja dengan konfirmasi penerimaan dan estimasi jadwal perbaikan." },
        ],
      },
      {
        icon: "RefreshCw",
        title: "Sub-pemroses & rantai pasokan",
        items: [
          { q: "Daftar sub-pemroses (sub-processors GDPR)", a: "Supabase Inc. (DB & Auth, Frankfurt), Brevo/Sendinblue SAS (email, Paris), Vercel Inc. (hosting & CDN, edge UE), Stripe Inc. (pembayaran, UE/AS — SCCs). Daftar lengkap dengan DPA setiap sub-pemroses tersedia dalam DPA Pasal 28 GDPR kami." },
          { q: "Notifikasi perubahan sub-pemroses", a: "Sesuai GDPR Pasal 28(2), Pengontrol akan diberitahu tentang penambahan atau penggantian sub-pemroses yang direncanakan dengan pemberitahuan awal yang wajar, memberi Pengontrol kesempatan untuk menolak." },
        ],
      },
      {
        icon: "AlertTriangle",
        title: "Sertifikasi & audit",
        items: [
          { q: "Apakah Anda bersertifikat ISO 27001?", a: "Tidak. HealthWatch Global adalah infrastruktur tahap awal. Kami menerapkan kontrol teknis yang setara (enkripsi, RLS, RBAC, monitoring, backup) dan mendokumentasikannya secara dapat diverifikasi. Sertifikasi ISO 27001 direncanakan mulai 2027." },
          { q: "Apakah audit keamanan atau uji penetrasi telah dilakukan?", a: "Tidak ada pentest formal pada tahap ini. Audit kode sumber dapat diatur untuk langganan Enterprise atas permintaan. Kami menyediakan akses ke repositori privat untuk tinjauan teknis." },
          { q: "Laporan SOC 2 tersedia?", a: "Tidak. Supabase (penyedia database kami) bersertifikat SOC 2 Type II — laporannya tersedia melalui Trust Center mereka. Vercel juga memiliki atestasi SOC 2." },
        ],
      },
    ],
    dpa_link: "Baca DPA lengkap (GDPR Pasal 28) →",
    institutional_link: "Proses pengadaan institusional →",
    footer_title: "Tim IT Anda punya checklist spesifik?",
    footer_desc: "Kirimkan daftar pertanyaan standar Anda (format apa pun — Word, PDF, atau email). Kami merespons poin per poin secara tertulis dalam 2 hari kerja, dalam format yang dibutuhkan oleh proses pengadaan Anda.",
    footer_cta: "Kirim checklist IT →",
  },
};

const ICON_MAP: Record<string, React.FC<{ className?: string }>> = {
  Server, Lock, Eye, Database, Bell, RefreshCw, AlertTriangle,
};

// ─── Page ─────────────────────────────────────────────────────────────────────
export default async function SecurityPage() {
  const locale = await getLocale();
  const c = COPY[locale] ?? COPY.en;
  const isRtl = locale === "ar";

  return (
    <div className="max-w-3xl mx-auto px-4 py-10 space-y-10" dir={isRtl ? "rtl" : undefined}>

      {/* Back */}
      <Link href={`/${locale}/institutional`} className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-300 transition-colors">
        <ArrowLeft className="w-3.5 h-3.5" />
        {c.back}
      </Link>

      {/* Header */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Shield className="w-6 h-6 text-blue-400" />
          <span className="text-xs text-blue-400 font-semibold uppercase tracking-widest">IT Security</span>
        </div>
        <h1 className="text-3xl font-extrabold text-white">{c.title}</h1>
        <p className="text-gray-400">{c.subtitle}</p>

        {/* Badges */}
        <div className="flex flex-wrap gap-2 pt-1">
          {c.badges.map((b) => (
            <span key={b} className="inline-flex items-center gap-1.5 text-xs bg-blue-500/10 border border-blue-500/20 text-blue-300 rounded-full px-3 py-1">
              <Check className="w-3 h-3" />
              {b}
            </span>
          ))}
        </div>
      </div>

      {/* Intro + CTA */}
      <div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-5 space-y-4">
        <p className="text-gray-300 text-sm leading-relaxed">{c.intro}</p>
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <a
            href={`mailto:contact@healthwatch-global.com?subject=IT%20Security%20Checklist%20—%20HealthWatch%20Global&body=Organization%3A%20%0AChecklist%20attached%3A%20`}
            className="inline-flex items-center gap-2 bg-blue-700 hover:bg-blue-600 text-white font-semibold px-4 py-2.5 rounded-lg transition-colors text-sm whitespace-nowrap"
          >
            <Mail className="w-4 h-4" />
            {c.request_checklist_cta}
          </a>
          <p className="text-xs text-gray-500">{c.request_checklist_desc}</p>
        </div>
      </div>

      {/* Quick links */}
      <div className="flex flex-wrap gap-3 text-sm">
        <Link href={`/${locale}/dpa`} className="inline-flex items-center gap-1.5 text-blue-400 hover:text-blue-300 transition-colors">
          <FileText className="w-3.5 h-3.5" />
          {c.dpa_link}
        </Link>
        <Link href={`/${locale}/institutional`} className="inline-flex items-center gap-1.5 text-gray-400 hover:text-gray-300 transition-colors">
          <FileText className="w-3.5 h-3.5" />
          {c.institutional_link}
        </Link>
      </div>

      {/* Q&A Sections */}
      {c.sections.map((section) => {
        const Icon = ICON_MAP[section.icon] ?? Shield;
        return (
          <section key={section.title} className="space-y-4">
            <h2 className="flex items-center gap-2.5 text-base font-bold text-white border-b border-gray-800 pb-3">
              <Icon className="w-4 h-4 text-blue-400 shrink-0" />
              {section.title}
            </h2>
            <div className="space-y-4">
              {section.items.map((item, i) => (
                <div key={i} className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
                  <div className="mt-0.5">
                    <Check className="w-3.5 h-3.5 text-green-400 shrink-0" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-gray-200 font-medium leading-snug">{item.q}</p>
                    <p className="text-gray-400 leading-relaxed">{item.a}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        );
      })}

      {/* Footer CTA */}
      <div className="bg-blue-500/5 border border-blue-500/20 rounded-2xl p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <Shield className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-white text-sm">{c.footer_title}</p>
            <p className="text-gray-400 text-xs mt-1 leading-relaxed">{c.footer_desc}</p>
          </div>
        </div>
        <a
          href={`mailto:contact@healthwatch-global.com?subject=IT%20Security%20Checklist%20—%20HealthWatch%20Global&body=Organization%3A%20%0AChecklist%20attached%3A%20`}
          className="shrink-0 inline-flex items-center gap-2 bg-blue-700 hover:bg-blue-600 text-white font-semibold px-4 py-2.5 rounded-lg transition-colors text-sm whitespace-nowrap"
        >
          <Mail className="w-4 h-4" />
          {c.footer_cta}
        </a>
      </div>

    </div>
  );
}
