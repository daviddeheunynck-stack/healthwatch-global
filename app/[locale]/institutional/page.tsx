import { getLocale } from "next-intl/server";
import Link from "next/link";
import { ArrowLeft, Check, FileText, Shield, Clock, Building2, Mail, ArrowRight, Lock } from "lucide-react";
import type { Metadata } from "next";

const LOCALES = ["en", "fr", "es", "ar", "id"] as const;

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const titles: Record<string, string> = {
    fr: "Abonnement institutionnel — Du pilote au contrat",
    en: "Institutional Subscription — From Pilot to Contract",
    es: "Suscripción institucional — Del piloto al contrato",
    ar: "الاشتراك المؤسسي — من التجربة إلى العقد",
    id: "Langganan Institusional — Dari Pilot ke Kontrak",
  };
  const url = `https://healthwatch-global.com/${locale}/institutional`;
  return {
    title: titles[locale] ?? titles.en,
    description: "HealthWatch Global — DPA, SLA, invoicing and institutional procurement pathway for ministries, NGOs and UN agencies.",
    alternates: {
      canonical: url,
      languages: {
        ...Object.fromEntries(LOCALES.map((l) => [l, `https://healthwatch-global.com/${l}/institutional`])),
        "x-default": "https://healthwatch-global.com/en/institutional",
      },
    },
    robots: { index: true, follow: true },
  };
}

const COPY: Record<string, {
  back: string; title: string; subtitle: string;
  phase1_title: string; phase1_badge: string; phase1_desc: string; phase1_items: string[];
  phase1_cta: string;
  phase2_title: string; phase2_badge: string; phase2_desc: string;
  docs_title: string;
  doc1_title: string; doc1_desc: string; doc1_status: string; doc1_cta: string;
  doc2_title: string; doc2_desc: string; doc2_status: string;
  doc3_title: string; doc3_desc: string; doc3_status: string;
  doc4_title: string; doc4_desc: string; doc4_status: string; doc4_cta: string;
  timeline_title: string; timeline: { day: string; event: string }[];
  faq_title: string; faqs: { q: string; a: string }[];
  contact_title: string; contact_desc: string; contact_cta: string;
  status_ready: string; status_auto: string; status_on_request: string;
}> = {
  fr: {
    back: "Retour aux tarifs",
    title: "Du pilote au contrat institutionnel",
    subtitle: "Deux étapes distinctes. Tous les documents sont prêts — aucun blocage procurement.",
    phase1_title: "Phase 1 — Pilote",
    phase1_badge: "30 jours · Gratuit",
    phase1_desc: "Pas de procurement nécessaire. Activez l'accès aujourd'hui pour votre équipe.",
    phase1_items: ["5 sièges Pro complets", "Accès toutes fonctionnalités", "Aucun document requis", "Aucune CB demandée"],
    phase1_cta: "Candidater au pilote →",
    phase2_title: "Phase 2 — Abonnement institutionnel",
    phase2_badge: "Team · €149/mois",
    phase2_desc: "Après le pilote : 4 documents suffisent pour activer l'abonnement dans la plupart des procédures institutionnelles.",
    docs_title: "Documents disponibles",
    doc1_title: "Accord de Traitement des Données (DPA)",
    doc1_desc: "Article 28 RGPD — sous-traitants, mesures de sécurité, délais de notification. Version EN/FR disponible immédiatement. Exemplaire contresigné sous 48h.",
    doc1_status: "Disponible maintenant",
    doc1_cta: "Lire le DPA →",
    doc2_title: "SLA — Engagement de disponibilité 99,9 %",
    doc2_desc: "Objectif de disponibilité 99,9 % (infrastructure Vercel + Supabase). Engagement écrit inclus dans l'abonnement Team et Enterprise.",
    doc2_status: "Inclus — Team & Enterprise",
    doc3_title: "Facture institutionnelle automatique",
    doc3_desc: "PDF généré automatiquement à chaque paiement, au nom de votre organisation. Le plan annuel émet une seule facture pour l'année entière — idéal pour les bons de commande.",
    doc3_status: "Automatique à l'activation",
    doc4_title: "Convention de partenariat (optionnelle)",
    doc4_desc: "Pour les marchés publics, certifications fournisseurs ou contrats-cadres. Sur demande, avec délai de réponse de 5 jours ouvrés.",
    doc4_status: "Sur demande — Enterprise",
    doc4_cta: "Demander →",
    timeline_title: "Calendrier type",
    timeline: [
      { day: "J+1", event: "Activation du pilote — 5 accès Pro immédiats, aucun document" },
      { day: "J+7", event: "Prise en main équipe — onboarding guidé, alertes configurées" },
      { day: "J+15", event: "Envoi automatique du dossier contractuel (DPA + SLA + modèle de facture)" },
      { day: "J+25", event: "Validation interne DSI/juridique si nécessaire" },
      { day: "J+30", event: "Activation de l'abonnement — ou renouvellement pilote si besoin" },
    ],
    faq_title: "Questions fréquentes",
    faqs: [
      { q: "Où sont hébergées les données ?", a: "Base de données : Supabase, Francfort (Allemagne, UE). Emails : Brevo, Paris (France, UE). Aucune donnée en dehors de l'Union Européenne." },
      { q: "HealthWatch Global est-il conforme au RGPD ?", a: "Oui. Conformité RGPD complète. DPA disponible (Art. 28). Données hébergées en UE. Droit d'accès, de rectification et de suppression garanti." },
      { q: "Que se passe-t-il si vous cessez votre activité ?", a: "Vos données vous appartiennent. Export CSV disponible à tout moment. En cas d'arrêt de service : notification 90 jours à l'avance et export complet fourni." },
      { q: "Puis-je obtenir un devis formel avant de m'engager ?", a: "Oui. Contactez-nous avec le nom de votre organisation et le plan souhaité. Réponse sous 24h avec devis PDF." },
    ],
    contact_title: "Une question sur votre procédure ?",
    contact_desc: "DSI, responsable juridique ou service achat — nous répondons sous 24h à toute question sur le cadre contractuel.",
    contact_cta: "Contacter →",
    status_ready: "✓ Disponible",
    status_auto: "✓ Automatique",
    status_on_request: "Sur demande",
  },
  en: {
    back: "Back to pricing",
    title: "From Pilot to Institutional Contract",
    subtitle: "Two distinct phases. All documents are ready — no procurement blocker.",
    phase1_title: "Phase 1 — Pilot",
    phase1_badge: "30 days · Free",
    phase1_desc: "No procurement required. Activate access for your team today.",
    phase1_items: ["5 full Pro seats", "Access to all features", "No documents required", "No credit card required"],
    phase1_cta: "Apply for the pilot →",
    phase2_title: "Phase 2 — Institutional Subscription",
    phase2_badge: "Team · €149/month",
    phase2_desc: "After the pilot: 4 documents are sufficient to activate the subscription in most institutional procurement procedures.",
    docs_title: "Available documents",
    doc1_title: "Data Processing Agreement (DPA)",
    doc1_desc: "GDPR Article 28 — sub-processors, security measures, breach notification timelines. EN/FR version available immediately. Countersigned copy within 48h.",
    doc1_status: "Available now",
    doc1_cta: "Read the DPA →",
    doc2_title: "SLA — 99.9% Uptime Commitment",
    doc2_desc: "99.9% availability target (Vercel + Supabase infrastructure). Written commitment included in Team and Enterprise subscriptions.",
    doc2_status: "Included — Team & Enterprise",
    doc3_title: "Automatic Institutional Invoice",
    doc3_desc: "PDF generated automatically for every payment, in your organization's name. The annual plan issues a single invoice for the full year — ideal for purchase orders.",
    doc3_status: "Automatic on activation",
    doc4_title: "Partnership Agreement (optional)",
    doc4_desc: "For public procurement, vendor certification or framework contracts. On request, with a 5-business-day response time.",
    doc4_status: "On request — Enterprise",
    doc4_cta: "Request →",
    timeline_title: "Typical timeline",
    timeline: [
      { day: "Day 1", event: "Pilot activation — 5 Pro seats, immediate access, no documents" },
      { day: "Day 7", event: "Team onboarding — guided setup, alerts configured" },
      { day: "Day 15", event: "Automatic dispatch of contractual package (DPA + SLA + invoice template)" },
      { day: "Day 25", event: "Internal IT/legal review if required" },
      { day: "Day 30", event: "Subscription activation — or pilot extension if needed" },
    ],
    faq_title: "Frequently asked questions",
    faqs: [
      { q: "Where is data hosted?", a: "Database: Supabase, Frankfurt (Germany, EU). Emails: Brevo, Paris (France, EU). No data outside the European Union." },
      { q: "Is HealthWatch Global GDPR compliant?", a: "Yes. Full GDPR compliance. DPA available (Art. 28). EU-hosted data. Right of access, rectification and deletion guaranteed." },
      { q: "What happens if you cease operations?", a: "Your data belongs to you. CSV export available at any time. In case of service shutdown: 90-day advance notice and full export provided." },
      { q: "Can I get a formal quote before committing?", a: "Yes. Contact us with your organization name and desired plan. Response within 24h with PDF quote." },
    ],
    contact_title: "A question about your procurement process?",
    contact_desc: "IT department, legal team or procurement office — we respond within 24h to any question about the contractual framework.",
    contact_cta: "Contact us →",
    status_ready: "✓ Available",
    status_auto: "✓ Automatic",
    status_on_request: "On request",
  },
  es: {
    back: "Volver a precios",
    title: "Del piloto al contrato institucional",
    subtitle: "Dos fases distintas. Todos los documentos están listos.",
    phase1_title: "Fase 1 — Piloto",
    phase1_badge: "30 días · Gratis",
    phase1_desc: "Sin proceso de compras requerido. Active el acceso para su equipo hoy.",
    phase1_items: ["5 plazas Pro completas", "Acceso a todas las funciones", "Sin documentos requeridos", "Sin tarjeta de crédito"],
    phase1_cta: "Solicitar piloto →",
    phase2_title: "Fase 2 — Suscripción institucional",
    phase2_badge: "Team · €149/mes",
    phase2_desc: "Después del piloto: 4 documentos son suficientes para activar la suscripción.",
    docs_title: "Documentos disponibles",
    doc1_title: "Acuerdo de Tratamiento de Datos (DPA)",
    doc1_desc: "Artículo 28 RGPD — subencargados, medidas de seguridad, plazos de notificación. Versión EN/FR disponible. Copia contrafirmada en 48h.",
    doc1_status: "Disponible ahora",
    doc1_cta: "Leer el DPA →",
    doc2_title: "SLA — Compromiso de disponibilidad 99,9%",
    doc2_desc: "Objetivo de disponibilidad 99,9% (Vercel + Supabase). Compromiso escrito incluido en Team y Enterprise.",
    doc2_status: "Incluido — Team y Enterprise",
    doc3_title: "Factura institucional automática",
    doc3_desc: "PDF generado automáticamente para cada pago, a nombre de su organización. El plan anual emite una sola factura para el año completo.",
    doc3_status: "Automático al activar",
    doc4_title: "Convenio de colaboración (opcional)",
    doc4_desc: "Para licitaciones públicas, certificación de proveedores o contratos marco. A petición, con plazo de respuesta de 5 días hábiles.",
    doc4_status: "A petición — Enterprise",
    doc4_cta: "Solicitar →",
    timeline_title: "Calendario tipo",
    timeline: [
      { day: "Día 1", event: "Activación del piloto — 5 plazas Pro, acceso inmediato" },
      { day: "Día 7", event: "Onboarding del equipo — configuración de alertas" },
      { day: "Día 15", event: "Envío automático del paquete contractual (DPA + SLA + modelo de factura)" },
      { day: "Día 25", event: "Revisión interna IT/legal si es necesario" },
      { day: "Día 30", event: "Activación de la suscripción o extensión del piloto" },
    ],
    faq_title: "Preguntas frecuentes",
    faqs: [
      { q: "¿Dónde se alojan los datos?", a: "Base de datos: Supabase, Frankfurt (Alemania, UE). Emails: Brevo, París (Francia, UE). Sin datos fuera de la Unión Europea." },
      { q: "¿Es HealthWatch Global conforme al RGPD?", a: "Sí. Conformidad RGPD completa. DPA disponible (Art. 28). Datos en UE. Derechos de acceso, rectificación y supresión garantizados." },
      { q: "¿Qué pasa si cesa la actividad?", a: "Sus datos le pertenecen. Exportación CSV disponible en cualquier momento. En caso de cierre: aviso 90 días y exportación completa." },
      { q: "¿Puedo obtener un presupuesto formal?", a: "Sí. Contáctenos con el nombre de su organización y el plan deseado. Respuesta en 24h con presupuesto PDF." },
    ],
    contact_title: "¿Una pregunta sobre su proceso de compras?",
    contact_desc: "Departamento TI, asesoría jurídica o compras — respondemos en 24h.",
    contact_cta: "Contactar →",
    status_ready: "✓ Disponible",
    status_auto: "✓ Automático",
    status_on_request: "A petición",
  },
  ar: {
    back: "العودة إلى الأسعار",
    title: "من التجربة إلى العقد المؤسسي",
    subtitle: "مرحلتان منفصلتان. جميع الوثائق جاهزة — لا عوائق مشتريات.",
    phase1_title: "المرحلة 1 — التجربة",
    phase1_badge: "30 يوماً · مجاناً",
    phase1_desc: "لا حاجة لإجراءات مشتريات. فعّل الوصول لفريقك اليوم.",
    phase1_items: ["5 مقاعد Pro كاملة", "وصول لجميع الميزات", "لا وثائق مطلوبة", "لا بطاقة ائتمانية"],
    phase1_cta: "التقديم للبرنامج التجريبي ←",
    phase2_title: "المرحلة 2 — الاشتراك المؤسسي",
    phase2_badge: "Team · €149/شهر",
    phase2_desc: "بعد التجربة: 4 وثائق تكفي لتفعيل الاشتراك في معظم إجراءات المشتريات المؤسسية.",
    docs_title: "الوثائق المتاحة",
    doc1_title: "اتفاقية معالجة البيانات (DPA)",
    doc1_desc: "المادة 28 RGPD — المعالجون الفرعيون، تدابير الأمان، مواعيد الإخطار. متوفرة الآن بالإنجليزية والفرنسية. نسخة موقعة خلال 48 ساعة.",
    doc1_status: "متاحة الآن",
    doc1_cta: "قراءة الاتفاقية ←",
    doc2_title: "SLA — التزام التوفر 99.9%",
    doc2_desc: "هدف توفر 99.9% (Vercel + Supabase). التزام مكتوب مضمّن في اشتراكي Team وEnterprise.",
    doc2_status: "مضمّن في Team وEnterprise",
    doc3_title: "فاتورة مؤسسية تلقائية",
    doc3_desc: "يُنشأ PDF تلقائياً لكل دفعة باسم مؤسستك. الخطة السنوية تُصدر فاتورة واحدة للسنة — مثالية لأوامر الشراء.",
    doc3_status: "تلقائية عند التفعيل",
    doc4_title: "اتفاقية شراكة (اختيارية)",
    doc4_desc: "للمناقصات العامة أو شهادات الموردين أو العقود الإطارية. عند الطلب، خلال 5 أيام عمل.",
    doc4_status: "عند الطلب — Enterprise",
    doc4_cta: "طلب ←",
    timeline_title: "الجدول الزمني النموذجي",
    timeline: [
      { day: "اليوم 1", event: "تفعيل التجربة — 5 مقاعد Pro فورية، لا وثائق مطلوبة" },
      { day: "اليوم 7", event: "إعداد الفريق — تهيئة التنبيهات والتدريب" },
      { day: "اليوم 15", event: "إرسال تلقائي للحزمة التعاقدية (DPA + SLA + نموذج فاتورة)" },
      { day: "اليوم 25", event: "المراجعة الداخلية (تقنية/قانونية) إذا لزم" },
      { day: "اليوم 30", event: "تفعيل الاشتراك أو تمديد التجربة" },
    ],
    faq_title: "أسئلة متكررة",
    faqs: [
      { q: "أين تُستضاف البيانات؟", a: "قاعدة البيانات: Supabase، فرانكفورت (ألمانيا، UE). البريد الإلكتروني: Brevo، باريس (فرنسا، UE). لا بيانات خارج الاتحاد الأوروبي." },
      { q: "هل HealthWatch Global متوافق مع RGPD؟", a: "نعم. امتثال كامل. اتفاقية DPA متاحة (المادة 28). بيانات مستضافة في الاتحاد الأوروبي. حقوق الوصول والتصحيح والحذف مضمونة." },
      { q: "ماذا يحدث إذا توقفت الخدمة؟", a: "بياناتك ملكك. تصدير CSV متاح في أي وقت. في حالة إيقاف الخدمة: إشعار مسبق 90 يوماً وتصدير كامل." },
      { q: "هل يمكنني الحصول على عرض سعر رسمي؟", a: "نعم. تواصل معنا باسم مؤسستك والخطة المطلوبة. رد خلال 24 ساعة مع عرض سعر PDF." },
    ],
    contact_title: "سؤال حول إجراءات الشراء لديكم؟",
    contact_desc: "قسم تقنية المعلومات، الفريق القانوني أو قسم المشتريات — نرد خلال 24 ساعة.",
    contact_cta: "تواصل معنا ←",
    status_ready: "✓ متاحة",
    status_auto: "✓ تلقائي",
    status_on_request: "عند الطلب",
  },
  id: {
    back: "Kembali ke harga",
    title: "Dari Pilot ke Kontrak Institusional",
    subtitle: "Dua fase berbeda. Semua dokumen siap — tidak ada hambatan pengadaan.",
    phase1_title: "Fase 1 — Pilot",
    phase1_badge: "30 hari · Gratis",
    phase1_desc: "Tanpa proses pengadaan. Aktifkan akses untuk tim Anda hari ini.",
    phase1_items: ["5 kursi Pro penuh", "Akses ke semua fitur", "Tidak ada dokumen yang diperlukan", "Tidak perlu kartu kredit"],
    phase1_cta: "Daftar pilot →",
    phase2_title: "Fase 2 — Langganan Institusional",
    phase2_badge: "Team · €149/bulan",
    phase2_desc: "Setelah pilot: 4 dokumen cukup untuk mengaktifkan langganan dalam prosedur pengadaan institusional.",
    docs_title: "Dokumen yang tersedia",
    doc1_title: "Perjanjian Pemrosesan Data (DPA)",
    doc1_desc: "Pasal 28 GDPR — sub-pemroses, langkah keamanan, tenggat notifikasi. Versi EN/FR tersedia sekarang. Salinan yang ditandatangani dalam 48j.",
    doc1_status: "Tersedia sekarang",
    doc1_cta: "Baca DPA →",
    doc2_title: "SLA — Komitmen Uptime 99,9%",
    doc2_desc: "Target ketersediaan 99,9% (Vercel + Supabase). Komitmen tertulis termasuk dalam Team dan Enterprise.",
    doc2_status: "Termasuk — Team & Enterprise",
    doc3_title: "Faktur Institusional Otomatis",
    doc3_desc: "PDF dibuat otomatis untuk setiap pembayaran atas nama organisasi Anda. Paket tahunan menerbitkan satu faktur untuk seluruh tahun.",
    doc3_status: "Otomatis saat aktivasi",
    doc4_title: "Perjanjian Kemitraan (opsional)",
    doc4_desc: "Untuk pengadaan publik, sertifikasi vendor, atau kontrak kerangka. Atas permintaan, dengan waktu respons 5 hari kerja.",
    doc4_status: "Atas permintaan — Enterprise",
    doc4_cta: "Minta →",
    timeline_title: "Jadwal tipikal",
    timeline: [
      { day: "Hari 1", event: "Aktivasi pilot — 5 kursi Pro, akses langsung, tanpa dokumen" },
      { day: "Hari 7", event: "Onboarding tim — pengaturan peringatan" },
      { day: "Hari 15", event: "Pengiriman otomatis paket kontrak (DPA + SLA + template faktur)" },
      { day: "Hari 25", event: "Tinjauan IT/hukum internal jika diperlukan" },
      { day: "Hari 30", event: "Aktivasi langganan atau perpanjangan pilot" },
    ],
    faq_title: "Pertanyaan yang sering diajukan",
    faqs: [
      { q: "Di mana data dihosting?", a: "Database: Supabase, Frankfurt (Jerman, UE). Email: Brevo, Paris (Prancis, UE). Tidak ada data di luar Uni Eropa." },
      { q: "Apakah HealthWatch Global patuh GDPR?", a: "Ya. Kepatuhan GDPR penuh. DPA tersedia (Psl. 28). Data di UE. Hak akses, perbaikan, dan penghapusan dijamin." },
      { q: "Apa yang terjadi jika layanan berhenti?", a: "Data Anda milik Anda. Ekspor CSV tersedia kapan saja. Jika layanan berhenti: pemberitahuan 90 hari sebelumnya dan ekspor lengkap diberikan." },
      { q: "Bisakah saya mendapatkan penawaran formal?", a: "Ya. Hubungi kami dengan nama organisasi dan paket yang diinginkan. Respons dalam 24 jam dengan penawaran PDF." },
    ],
    contact_title: "Ada pertanyaan tentang proses pengadaan Anda?",
    contact_desc: "Departemen IT, tim hukum atau pengadaan — kami merespons dalam 24 jam.",
    contact_cta: "Hubungi kami →",
    status_ready: "✓ Tersedia",
    status_auto: "✓ Otomatis",
    status_on_request: "Atas permintaan",
  },
};

export default async function InstitutionalPage() {
  const locale = await getLocale();
  const c = COPY[locale] ?? COPY.en;
  const isRtl = locale === "ar";

  const docs = [
    { icon: Shield, title: c.doc1_title, desc: c.doc1_desc, status: c.doc1_status, statusColor: "text-green-400", cta: c.doc1_cta, href: `/${locale}/dpa` },
    { icon: Clock, title: c.doc2_title, desc: c.doc2_desc, status: c.doc2_status, statusColor: "text-green-400", cta: null, href: null },
    { icon: FileText, title: c.doc3_title, desc: c.doc3_desc, status: c.doc3_status, statusColor: "text-green-400", cta: null, href: null },
    { icon: Building2, title: c.doc4_title, desc: c.doc4_desc, status: c.doc4_status, statusColor: "text-gray-400", cta: c.doc4_cta, href: `/${locale}/contact` },
    {
      icon: Lock,
      title: locale === "fr" ? "Réponses IT Security" : locale === "es" ? "Respuestas IT Security" : locale === "ar" ? "أسئلة أمان IT" : locale === "id" ? "Jawaban IT Security" : "IT Security Q&A",
      desc: locale === "fr"
        ? "Hébergement, chiffrement, contrôle d'accès, sauvegardes, SLA, notification de breach — toutes les questions IT avec réponses directes. Transmissible à votre DSI ou votre homologation."
        : locale === "es"
        ? "Alojamiento, cifrado, acceso, copias de seguridad, SLA — todas las preguntas IT respondidas. Transmisible a su equipo IT."
        : locale === "ar"
        ? "الاستضافة، التشفير، التحكم في الوصول، النسخ الاحتياطية، SLA — جميع أسئلة IT مجابة."
        : locale === "id"
        ? "Hosting, enkripsi, akses, backup, SLA — semua pertanyaan IT terjawab. Kirimkan langsung ke tim IT Anda."
        : "Hosting, encryption, access control, backups, SLA, breach notification — all IT questions answered. Forward directly to your IT or InfoSec team.",
      status: locale === "fr" ? "✓ Disponible" : locale === "es" ? "✓ Disponible" : locale === "ar" ? "✓ متاح" : locale === "id" ? "✓ Tersedia" : "✓ Available",
      statusColor: "text-green-400",
      cta: locale === "fr" ? "Consulter →" : locale === "es" ? "Ver →" : locale === "ar" ? "← عرض" : locale === "id" ? "Lihat →" : "View →",
      href: `/${locale}/security`,
    },
  ];

  return (
    <div className="max-w-3xl mx-auto px-4 py-10 space-y-12" dir={isRtl ? "rtl" : undefined}>

      {/* Back */}
      <Link href={`/${locale}/pricing`} className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-300 transition-colors">
        <ArrowLeft className="w-3.5 h-3.5" />
        {c.back}
      </Link>

      {/* Header */}
      <div className="space-y-3">
        <div className="inline-flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 rounded-full px-3 py-1 text-xs text-amber-400 font-semibold uppercase tracking-widest">
          <Building2 className="w-3.5 h-3.5" />
          Institutional
        </div>
        <h1 className="text-3xl font-extrabold text-white">{c.title}</h1>
        <p className="text-gray-400 text-lg">{c.subtitle}</p>
      </div>

      {/* Two phases */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* Phase 1 */}
        <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 space-y-4">
          <div>
            <span className="text-xs bg-green-500/10 border border-green-500/20 text-green-400 font-bold px-3 py-1 rounded-full">{c.phase1_badge}</span>
            <h2 className="text-lg font-bold text-white mt-3">{c.phase1_title}</h2>
            <p className="text-gray-400 text-sm mt-1">{c.phase1_desc}</p>
          </div>
          <ul className="space-y-2">
            {c.phase1_items.map((item) => (
              <li key={item} className="flex items-center gap-2 text-sm text-gray-300">
                <Check className="w-4 h-4 text-green-400 shrink-0" />
                {item}
              </li>
            ))}
          </ul>
          <Link
            href={`/${locale}/pilot`}
            className="block w-full text-center bg-green-700 hover:bg-green-600 text-white font-semibold py-2.5 rounded-lg transition-colors text-sm"
          >
            {c.phase1_cta}
          </Link>
        </div>

        {/* Phase 2 */}
        <div className="bg-gray-900 border-2 border-amber-600/50 rounded-2xl p-6 space-y-4">
          <div>
            <span className="text-xs bg-amber-500/10 border border-amber-500/20 text-amber-400 font-bold px-3 py-1 rounded-full">{c.phase2_badge}</span>
            <h2 className="text-lg font-bold text-white mt-3">{c.phase2_title}</h2>
            <p className="text-gray-400 text-sm mt-1">{c.phase2_desc}</p>
          </div>
          <Link
            href={`/${locale}/pricing`}
            className="block w-full text-center bg-amber-700 hover:bg-amber-600 text-white font-semibold py-2.5 rounded-lg transition-colors text-sm"
          >
            {locale === "fr" ? "Voir les plans →" : locale === "es" ? "Ver planes →" : locale === "ar" ? "← عرض الخطط" : locale === "id" ? "Lihat paket →" : "View plans →"}
          </Link>
        </div>
      </div>

      {/* Documents */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold text-white">{c.docs_title}</h2>
        <div className="space-y-3">
          {docs.map(({ icon: Icon, title, desc, status, statusColor, cta, href }) => (
            <div key={title} className="bg-gray-900 border border-gray-800 rounded-xl p-5 flex flex-col sm:flex-row items-start gap-4">
              <div className="w-9 h-9 rounded-lg bg-gray-800 border border-gray-700 flex items-center justify-center shrink-0 mt-0.5">
                <Icon className="w-4 h-4 text-gray-400" />
              </div>
              <div className="flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold text-white text-sm">{title}</p>
                  <span className={`text-xs font-medium ${statusColor}`}>{status}</span>
                </div>
                <p className="text-gray-400 text-xs leading-relaxed">{desc}</p>
              </div>
              {cta && href && (
                <Link
                  href={href}
                  className="shrink-0 text-xs bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 hover:text-white font-medium px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap"
                >
                  {cta}
                </Link>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Timeline */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold text-white">{c.timeline_title}</h2>
        <div className="space-y-0">
          {c.timeline.map(({ day, event }, i) => (
            <div key={i} className="flex gap-4">
              <div className="flex flex-col items-center">
                <div className="w-8 h-8 rounded-full bg-gray-800 border border-gray-700 flex items-center justify-center text-xs font-bold text-gray-400 shrink-0">
                  {i + 1}
                </div>
                {i < c.timeline.length - 1 && <div className="w-px h-full bg-gray-800 my-1" />}
              </div>
              <div className="pb-5">
                <span className="text-xs font-bold text-amber-400">{day}</span>
                <p className="text-sm text-gray-300 mt-0.5">{event}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* FAQ */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold text-white">{c.faq_title}</h2>
        <div className="space-y-3">
          {c.faqs.map(({ q, a }) => (
            <div key={q} className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <p className="font-semibold text-white text-sm mb-2">{q}</p>
              <p className="text-gray-400 text-sm leading-relaxed">{a}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Contact CTA */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <p className="font-semibold text-white text-sm">{c.contact_title}</p>
          <p className="text-gray-400 text-xs mt-1">{c.contact_desc}</p>
        </div>
        <Link
          href={`/${locale}/contact`}
          className="shrink-0 inline-flex items-center gap-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 hover:text-white font-semibold px-4 py-2.5 rounded-lg transition-colors text-sm whitespace-nowrap"
        >
          <Mail className="w-4 h-4" />
          {c.contact_cta}
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>

    </div>
  );
}
