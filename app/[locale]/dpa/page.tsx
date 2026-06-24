import { getLocale } from "next-intl/server";
import Link from "next/link";
import { Shield, ArrowLeft, Mail, FileText, Check } from "lucide-react";
import type { Metadata } from "next";

const LOCALES = ["en", "fr", "es", "ar", "id"] as const;

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const titles: Record<string, string> = {
    fr: "Accord de Traitement des Données (DPA)",
    en: "Data Processing Agreement (DPA)",
    es: "Acuerdo de Tratamiento de Datos (DPA)",
    ar: "اتفاقية معالجة البيانات",
    id: "Perjanjian Pemrosesan Data (DPA)",
  };
  const url = `https://healthwatch-global.com/${locale}/dpa`;
  return {
    title: titles[locale] ?? titles.en,
    description: "HealthWatch Global — GDPR Article 28 Data Processing Agreement for institutional subscribers.",
    alternates: {
      canonical: url,
      languages: {
        ...Object.fromEntries(LOCALES.map((l) => [l, `https://healthwatch-global.com/${l}/dpa`])),
        "x-default": "https://healthwatch-global.com/en/dpa",
      },
    },
    robots: { index: true, follow: true },
  };
}

// Sub-processors — shared across locales
const SUBPROCESSORS = [
  { name: "Supabase Inc.",           purpose_fr: "Base de données & authentification",  purpose_en: "Database & authentication",         location: "UE — Frankfurt (Allemagne)", safeguard: "AWS eu-central-1 · DPA Supabase" },
  { name: "Sendinblue SAS (Brevo)",  purpose_fr: "Emails transactionnels & alertes",    purpose_en: "Transactional email & alerts",      location: "UE — Paris (France)",        safeguard: "Entreprise française · RGPD natif" },
  { name: "Vercel Inc.",             purpose_fr: "Hébergement & CDN",                   purpose_en: "Hosting & CDN",                     location: "CDN mondial (edge UE dispo)", safeguard: "SCCs · EU region configurable" },
  { name: "Stripe Inc.",             purpose_fr: "Traitement des paiements",            purpose_en: "Payment processing",               location: "UE / États-Unis",            safeguard: "DPA Stripe · SCCs transferts US" },
];

const COPY: Record<string, {
  back: string; title: string; subtitle: string; updated: string;
  parties_title: string; parties_controller: string; parties_processor: string;
  subject_title: string; subject_body: string;
  data_title: string; data_col_cat: string; data_col_detail: string; data_col_subjects: string;
  data_rows: [string, string, string][];
  obligations_title: string; obligations: string[];
  subprocessors_title: string; subprocessors_note: string;
  sp_col_name: string; sp_col_purpose: string; sp_col_location: string; sp_col_safeguard: string;
  security_title: string; security_measures: string[];
  breach_title: string; breach_body: string;
  duration_title: string; duration_body: string;
  law_title: string; law_body: string;
  request_title: string; request_body: string; request_cta: string;
  security_badge: string[];
}> = {
  fr: {
    back: "Retour",
    title: "Accord de Traitement des Données",
    subtitle: "Article 28 RGPD — pour les abonnés institutionnels",
    updated: "En vigueur depuis le 24 juin 2026",
    parties_title: "1. Parties",
    parties_controller: "Responsable du traitement : L'organisation souscrivant aux services HealthWatch Global (ci-après « Responsable »).",
    parties_processor: "Sous-traitant : HealthWatch Global, exploité par David Deheunynck, entrepreneur individuel (France) (ci-après « Sous-traitant »). Cet accord fait partie intégrante des CGU et régit tout traitement de données personnelles effectué par le Sous-traitant pour le compte du Responsable.",
    subject_title: "2. Objet et finalité",
    subject_body: "Le Sous-traitant fournit aux utilisateurs autorisés du Responsable l'accès à HealthWatch Global, un tableau de bord de surveillance épidémique en temps réel. Dans ce cadre, le Sous-traitant traite des données personnelles pour le compte du Responsable selon les modalités définies dans le présent accord.",
    data_title: "3. Catégories de données personnelles",
    data_col_cat: "Catégorie",
    data_col_detail: "Détail",
    data_col_subjects: "Personnes concernées",
    data_rows: [
      ["Identifiants de compte", "Adresse e-mail, mot de passe haché", "Utilisateurs autorisés du Responsable"],
      ["Données de profil", "Nom, organisation, rôle (si renseigné)", "Utilisateurs autorisés du Responsable"],
      ["Préférences d'alertes", "Régions, maladies surveillées, langue", "Utilisateurs autorisés du Responsable"],
      ["Données d'utilisation", "Horodatages de connexion, fonctionnalités consultées", "Utilisateurs autorisés du Responsable"],
      ["Données de facturation", "E-mail de facturation, nom d'organisation (les données de carte bancaire sont traitées directement par Stripe)", "Contact facturation"],
    ],
    obligations_title: "4. Obligations du Sous-traitant (Art. 28 RGPD)",
    obligations: [
      "a) Traiter les données personnelles uniquement sur instruction documentée du Responsable, y compris en ce qui concerne les transferts vers des pays tiers ;",
      "b) Garantir la confidentialité des personnes autorisées à traiter les données ;",
      "c) Mettre en œuvre les mesures techniques et organisationnelles prévues à l'article 32 RGPD ;",
      "d) Respecter les conditions d'engagement des sous-traitants ultérieurs (Art. 28(2)-(4) RGPD) ;",
      "e) Aider le Responsable à donner suite aux demandes d'exercice des droits des personnes concernées ;",
      "f) Aider le Responsable à garantir le respect des articles 32 à 36 RGPD (sécurité, notification de violations, AIPD, consultation préalable) ;",
      "g) Supprimer ou restituer toutes les données personnelles au Responsable à l'issue des services, et supprimer les copies existantes sauf obligation légale contraire ;",
      "h) Mettre à disposition du Responsable toutes les informations nécessaires pour démontrer le respect des obligations et permettre les audits.",
    ],
    subprocessors_title: "5. Sous-traitants ultérieurs",
    subprocessors_note: "Le Responsable autorise de manière générale le recours aux sous-traitants ultérieurs suivants. Le Sous-traitant informera le Responsable de tout ajout ou remplacement planifié, lui laissant la possibilité de s'y opposer.",
    sp_col_name: "Sous-traitant",
    sp_col_purpose: "Finalité",
    sp_col_location: "Localisation",
    sp_col_safeguard: "Garanties",
    security_title: "6. Mesures de sécurité (Art. 32 RGPD)",
    security_measures: [
      "Chiffrement en transit : HTTPS/TLS 1.2+ sur toutes les communications",
      "Chiffrement au repos : AES-256 (Supabase managed encryption)",
      "Contrôle d'accès : accès basé sur les rôles, principe de moindre privilège",
      "Authentification : Supabase Auth avec gestion sécurisée des sessions",
      "Surveillance : monitoring de disponibilité, journalisation des erreurs (Sentry)",
      "Sauvegardes : sauvegardes quotidiennes automatisées (Supabase)",
      "Disponibilité : objectif de 99,9 % de disponibilité (infrastructure Vercel + Supabase)",
    ],
    breach_title: "7. Notification de violation de données",
    breach_body: "En cas de violation de données personnelles, le Sous-traitant en informera le Responsable sans délai injustifié et, dans la mesure du possible, dans un délai de 24 heures après en avoir pris connaissance. La notification comprendra toutes les informations requises par l'article 33(3) RGPD.",
    duration_title: "8. Durée et suppression",
    duration_body: "Le présent accord est valable pour la durée de l'abonnement aux services HealthWatch Global. À la résiliation, le Sous-traitant supprimera ou restituera toutes les données personnelles dans un délai de 30 jours, fournira un export CSV à la demande du Responsable avant suppression, et supprimera toutes les copies existantes sauf obligation légale.",
    law_title: "9. Droit applicable",
    law_body: "Le présent accord est régi par le droit français et le Règlement (UE) 2016/679 (RGPD). Tout litige sera soumis à la compétence exclusive des tribunaux de Paris, France.",
    request_title: "Demander un exemplaire signé",
    request_body: "Pour obtenir un exemplaire contresigné de cet accord (nécessaire pour les dossiers d'achat institutionnel), contactez-nous. Nous répondons sous 2 jours ouvrés avec un PDF contresigné.",
    request_cta: "Demander le DPA signé →",
    security_badge: ["Données hébergées en UE", "RGPD Art. 28 conforme", "Réponse sous 48h"],
  },
  en: {
    back: "Back",
    title: "Data Processing Agreement",
    subtitle: "GDPR Article 28 — for institutional subscribers",
    updated: "Effective date: June 24, 2026",
    parties_title: "1. Parties",
    parties_controller: "Controller: The organization subscribing to HealthWatch Global services (hereinafter \"Controller\").",
    parties_processor: "Processor: HealthWatch Global, operated by David Deheunynck, sole trader (France) (hereinafter \"Processor\"). This DPA forms part of the Terms of Service and governs all processing of personal data by the Processor on behalf of the Controller.",
    subject_title: "2. Subject Matter and Purpose",
    subject_body: "The Processor provides the Controller's authorized users with access to HealthWatch Global, a real-time epidemic surveillance dashboard. In doing so, the Processor processes personal data on behalf of the Controller as set out in this DPA.",
    data_title: "3. Categories of Personal Data",
    data_col_cat: "Category",
    data_col_detail: "Detail",
    data_col_subjects: "Data Subjects",
    data_rows: [
      ["Account credentials", "Email address, hashed password", "Controller's authorized users"],
      ["Profile data", "Name, organization, role (if provided)", "Controller's authorized users"],
      ["Alert preferences", "Monitored regions, diseases, language", "Controller's authorized users"],
      ["Usage data", "Login timestamps, features accessed", "Controller's authorized users"],
      ["Billing data", "Billing email, organization name (payment card data processed directly by Stripe)", "Billing contact"],
    ],
    obligations_title: "4. Processor Obligations (GDPR Art. 28)",
    obligations: [
      "a) Process personal data only on documented instructions from the Controller, including with regard to transfers to third countries;",
      "b) Ensure that persons authorized to process the personal data have committed themselves to confidentiality;",
      "c) Implement all measures required pursuant to Article 32 GDPR;",
      "d) Respect the conditions for engaging sub-processors set out in Article 28(2)-(4) GDPR;",
      "e) Assist the Controller in fulfilling its obligations to respond to data subject rights requests;",
      "f) Assist the Controller in ensuring compliance with Articles 32-36 GDPR (security, breach notification, DPIA, prior consultation);",
      "g) At the Controller's choice, delete or return all personal data after the end of services, and delete existing copies unless required by law;",
      "h) Make available to the Controller all information necessary to demonstrate compliance and allow for audits.",
    ],
    subprocessors_title: "5. Sub-processors",
    subprocessors_note: "The Controller grants general authorization to engage the following sub-processors. The Processor will notify the Controller of any intended changes, giving the Controller the opportunity to object.",
    sp_col_name: "Sub-processor",
    sp_col_purpose: "Purpose",
    sp_col_location: "Location",
    sp_col_safeguard: "Safeguards",
    security_title: "6. Security Measures (GDPR Art. 32)",
    security_measures: [
      "Encryption in transit: HTTPS/TLS 1.2+ for all communications",
      "Encryption at rest: AES-256 (Supabase managed encryption)",
      "Access control: role-based access, least privilege principle",
      "Authentication: Supabase Auth with secure session management",
      "Monitoring: uptime monitoring, error logging (Sentry)",
      "Backups: automated daily backups (Supabase)",
      "Availability: 99.9% uptime target (Vercel + Supabase infrastructure)",
    ],
    breach_title: "7. Data Breach Notification",
    breach_body: "In the event of a personal data breach, the Processor shall notify the Controller without undue delay and, where feasible, not later than 24 hours after becoming aware. The notification shall include all information required under Article 33(3) GDPR.",
    duration_title: "8. Duration and Deletion",
    duration_body: "This DPA is effective for the duration of the HealthWatch Global subscription. Upon termination, the Processor shall delete or return all personal data within 30 days, provide a CSV export upon request before deletion, and delete all existing copies unless retention is required by applicable law.",
    law_title: "9. Governing Law",
    law_body: "This DPA is governed by French law and Regulation (EU) 2016/679 (GDPR). Any dispute shall be subject to the exclusive jurisdiction of the courts of Paris, France.",
    request_title: "Request a Signed Copy",
    request_body: "To obtain a countersigned copy of this DPA for your institutional procurement records, contact us. We respond within 2 business days with a countersigned PDF.",
    request_cta: "Request signed DPA →",
    security_badge: ["EU-hosted data", "GDPR Art. 28 compliant", "Response within 48h"],
  },
  es: {
    back: "Volver",
    title: "Acuerdo de Tratamiento de Datos",
    subtitle: "Artículo 28 RGPD — para suscriptores institucionales",
    updated: "En vigor desde el 24 de junio de 2026",
    parties_title: "1. Partes",
    parties_controller: "Responsable del tratamiento: La organización suscriptora de los servicios de HealthWatch Global.",
    parties_processor: "Encargado del tratamiento: HealthWatch Global, operado por David Deheunynck (autónomo, Francia). Este acuerdo forma parte de los Términos de Servicio.",
    subject_title: "2. Objeto y finalidad",
    subject_body: "El Encargado proporciona acceso a HealthWatch Global, un panel de vigilancia epidemiológica en tiempo real, a los usuarios autorizados del Responsable.",
    data_title: "3. Categorías de datos personales",
    data_col_cat: "Categoría",
    data_col_detail: "Detalle",
    data_col_subjects: "Interesados",
    data_rows: [
      ["Credenciales de cuenta", "Dirección de email, contraseña hasheada", "Usuarios autorizados"],
      ["Datos de perfil", "Nombre, organización, rol", "Usuarios autorizados"],
      ["Preferencias de alertas", "Regiones, enfermedades vigiladas, idioma", "Usuarios autorizados"],
      ["Datos de uso", "Marcas de tiempo de inicio de sesión, funciones consultadas", "Usuarios autorizados"],
      ["Datos de facturación", "Email, nombre de organización (datos de tarjeta tratados por Stripe)", "Contacto de facturación"],
    ],
    obligations_title: "4. Obligaciones del Encargado (Art. 28 RGPD)",
    obligations: [
      "a) Tratar los datos solo según instrucciones documentadas del Responsable;",
      "b) Garantizar la confidencialidad de las personas autorizadas;",
      "c) Implementar medidas de seguridad conforme al artículo 32 RGPD;",
      "d) Respetar las condiciones para subcontratistas (Art. 28(2)-(4));",
      "e) Asistir al Responsable en el ejercicio de los derechos de los interesados;",
      "f) Notificar violaciones de datos en un plazo de 24 horas;",
      "g) Eliminar o devolver los datos al finalizar el contrato;",
      "h) Facilitar auditorías y proporcionar información de cumplimiento.",
    ],
    subprocessors_title: "5. Subencargados",
    subprocessors_note: "El Responsable autoriza el uso de los siguientes subencargados. Se informará de cualquier cambio previsto.",
    sp_col_name: "Subencargado",
    sp_col_purpose: "Finalidad",
    sp_col_location: "Ubicación",
    sp_col_safeguard: "Garantías",
    security_title: "6. Medidas de seguridad (Art. 32 RGPD)",
    security_measures: [
      "Cifrado en tránsito: HTTPS/TLS 1.2+",
      "Cifrado en reposo: AES-256 (Supabase)",
      "Control de acceso basado en roles, principio de mínimo privilegio",
      "Autenticación segura: Supabase Auth",
      "Monitoreo de disponibilidad y registro de errores",
      "Copias de seguridad automáticas diarias",
      "Objetivo de disponibilidad: 99,9%",
    ],
    breach_title: "7. Notificación de violaciones",
    breach_body: "En caso de violación de datos personales, el Encargado notificará al Responsable sin demora injustificada y, en la medida de lo posible, en un plazo de 24 horas.",
    duration_title: "8. Duración y eliminación",
    duration_body: "Este acuerdo es válido durante la duración de la suscripción. Al finalizar, el Encargado eliminará o devolverá todos los datos personales en un plazo de 30 días.",
    law_title: "9. Ley aplicable",
    law_body: "Este acuerdo se rige por la ley francesa y el Reglamento (UE) 2016/679 (RGPD). Cualquier litigio será competencia de los tribunales de París, Francia.",
    request_title: "Solicitar copia firmada",
    request_body: "Para obtener una copia contrafirmada de este acuerdo, contáctenos. Respondemos en 2 días hábiles con un PDF contrafirmado.",
    request_cta: "Solicitar DPA firmado →",
    security_badge: ["Datos alojados en la UE", "RGPD Art. 28 conforme", "Respuesta en 48h"],
  },
  ar: {
    back: "رجوع",
    title: "اتفاقية معالجة البيانات",
    subtitle: "المادة 28 RGPD — للمشتركين المؤسسيين",
    updated: "سارية المفعول منذ 24 يونيو 2026",
    parties_title: "1. الأطراف",
    parties_controller: "المتحكم في البيانات: المؤسسة المشتركة في خدمات HealthWatch Global.",
    parties_processor: "المعالج: HealthWatch Global، تشغيل David Deheunynck (مقاول فردي، فرنسا). تُعدّ هذه الاتفاقية جزءاً من شروط الخدمة.",
    subject_title: "2. الموضوع والغرض",
    subject_body: "يوفر المعالج للمستخدمين المصرح لهم من قِبل المتحكم الوصول إلى HealthWatch Global، لوحة مراقبة وبائية في الوقت الفعلي.",
    data_title: "3. فئات البيانات الشخصية",
    data_col_cat: "الفئة",
    data_col_detail: "التفاصيل",
    data_col_subjects: "أصحاب البيانات",
    data_rows: [
      ["بيانات اعتماد الحساب", "البريد الإلكتروني، كلمة المرور المشفرة", "المستخدمون المصرح لهم"],
      ["بيانات الملف الشخصي", "الاسم، المؤسسة، الدور", "المستخدمون المصرح لهم"],
      ["تفضيلات التنبيهات", "المناطق والأمراض المراقبة، اللغة", "المستخدمون المصرح لهم"],
      ["بيانات الاستخدام", "طوابع زمنية لتسجيل الدخول، الميزات المستخدمة", "المستخدمون المصرح لهم"],
      ["بيانات الفوترة", "البريد الإلكتروني، اسم المؤسسة (بيانات البطاقة تُعالج بواسطة Stripe)", "جهة الفوترة"],
    ],
    obligations_title: "4. التزامات المعالج (المادة 28)",
    obligations: [
      "أ) معالجة البيانات وفق تعليمات موثقة من المتحكم فحسب؛",
      "ب) ضمان سرية الأشخاص المخولين بمعالجة البيانات؛",
      "ج) تطبيق تدابير الأمان وفق المادة 32 من اللائحة؛",
      "د) احترام شروط الاستعانة بمعالجين فرعيين؛",
      "هـ) مساعدة المتحكم في الاستجابة لطلبات حقوق أصحاب البيانات؛",
      "و) إخطار المتحكم بأي خرق للبيانات خلال 24 ساعة؛",
      "ز) حذف البيانات أو إعادتها عند انتهاء العقد؛",
      "ح) توفير المعلومات اللازمة لإثبات الامتثال وتسهيل عمليات التدقيق.",
    ],
    subprocessors_title: "5. المعالجون الفرعيون",
    subprocessors_note: "يمنح المتحكم تفويضاً عاماً للتعاقد مع المعالجين الفرعيين التاليين. سيتم إخطار المتحكم بأي تغييرات مخططة.",
    sp_col_name: "المعالج الفرعي",
    sp_col_purpose: "الغرض",
    sp_col_location: "الموقع",
    sp_col_safeguard: "الضمانات",
    security_title: "6. تدابير الأمان (المادة 32)",
    security_measures: [
      "التشفير أثناء النقل: HTTPS/TLS 1.2+",
      "التشفير أثناء التخزين: AES-256 (Supabase)",
      "التحكم في الوصول: صلاحيات قائمة على الأدوار، مبدأ الحد الأدنى من الامتيازات",
      "المصادقة الآمنة: Supabase Auth",
      "مراقبة التوفر وتسجيل الأخطاء",
      "نسخ احتياطية يومية تلقائية",
      "هدف التوفر: 99.9%",
    ],
    breach_title: "7. الإخطار بخرق البيانات",
    breach_body: "في حالة حدوث خرق للبيانات الشخصية، يُخطر المعالج المتحكم دون تأخير غير مبرر وفي غضون 24 ساعة من اكتشاف الخرق.",
    duration_title: "8. المدة والحذف",
    duration_body: "تسري هذه الاتفاقية طوال مدة الاشتراك في HealthWatch Global. عند انتهاء الاشتراك، يحذف المعالج أو يُعيد جميع البيانات الشخصية خلال 30 يوماً.",
    law_title: "9. القانون الواجب التطبيق",
    law_body: "تخضع هذه الاتفاقية للقانون الفرنسي واللائحة (EU) 2016/679. يختص القضاء الفرنسي (باريس) بالنظر في أي نزاع.",
    request_title: "طلب نسخة موقعة",
    request_body: "للحصول على نسخة موقعة من هذه الاتفاقية لملفات المشتريات المؤسسية، تواصلوا معنا. نردّ خلال يومي عمل.",
    request_cta: "طلب DPA موقعة ←",
    security_badge: ["البيانات مستضافة في الاتحاد الأوروبي", "متوافق مع RGPD المادة 28", "الرد خلال 48 ساعة"],
  },
  id: {
    back: "Kembali",
    title: "Perjanjian Pemrosesan Data",
    subtitle: "Pasal 28 GDPR — untuk pelanggan institusional",
    updated: "Berlaku sejak 24 Juni 2026",
    parties_title: "1. Para Pihak",
    parties_controller: "Pengontrol: Organisasi yang berlangganan layanan HealthWatch Global.",
    parties_processor: "Pemroses: HealthWatch Global, dioperasikan oleh David Deheunynck (pekerja mandiri, Prancis). DPA ini merupakan bagian dari Syarat Layanan.",
    subject_title: "2. Pokok Perjanjian dan Tujuan",
    subject_body: "Pemroses menyediakan akses ke HealthWatch Global, dasbor pemantauan epidemi real-time, kepada pengguna yang diotorisasi oleh Pengontrol.",
    data_title: "3. Kategori Data Pribadi",
    data_col_cat: "Kategori",
    data_col_detail: "Detail",
    data_col_subjects: "Subjek Data",
    data_rows: [
      ["Kredensial akun", "Alamat email, kata sandi terenkripsi", "Pengguna yang diotorisasi"],
      ["Data profil", "Nama, organisasi, peran", "Pengguna yang diotorisasi"],
      ["Preferensi peringatan", "Wilayah dan penyakit dipantau, bahasa", "Pengguna yang diotorisasi"],
      ["Data penggunaan", "Stempel waktu login, fitur yang diakses", "Pengguna yang diotorisasi"],
      ["Data penagihan", "Email, nama organisasi (data kartu diproses Stripe)", "Kontak penagihan"],
    ],
    obligations_title: "4. Kewajiban Pemroses (Pasal 28 GDPR)",
    obligations: [
      "a) Memproses data hanya atas instruksi Pengontrol yang terdokumentasi;",
      "b) Memastikan kerahasiaan orang yang berwenang memproses data;",
      "c) Menerapkan langkah keamanan sesuai Pasal 32 GDPR;",
      "d) Mematuhi ketentuan untuk sub-pemroses;",
      "e) Membantu Pengontrol memenuhi permintaan hak subjek data;",
      "f) Memberitahukan pelanggaran data dalam waktu 24 jam;",
      "g) Menghapus atau mengembalikan data setelah kontrak berakhir;",
      "h) Menyediakan informasi yang diperlukan untuk audit kepatuhan.",
    ],
    subprocessors_title: "5. Sub-pemroses",
    subprocessors_note: "Pengontrol memberikan otorisasi umum untuk melibatkan sub-pemroses berikut. Pemroses akan memberitahukan setiap perubahan yang direncanakan.",
    sp_col_name: "Sub-pemroses",
    sp_col_purpose: "Tujuan",
    sp_col_location: "Lokasi",
    sp_col_safeguard: "Perlindungan",
    security_title: "6. Langkah Keamanan (Pasal 32 GDPR)",
    security_measures: [
      "Enkripsi transit: HTTPS/TLS 1.2+",
      "Enkripsi saat disimpan: AES-256 (Supabase)",
      "Kontrol akses berbasis peran, prinsip hak istimewa minimum",
      "Autentikasi aman: Supabase Auth",
      "Pemantauan uptime dan pencatatan error",
      "Pencadangan otomatis harian",
      "Target ketersediaan: 99,9%",
    ],
    breach_title: "7. Pemberitahuan Pelanggaran Data",
    breach_body: "Jika terjadi pelanggaran data pribadi, Pemroses akan memberitahukan Pengontrol tanpa penundaan yang tidak perlu dan dalam 24 jam setelah mengetahui pelanggaran tersebut.",
    duration_title: "8. Durasi dan Penghapusan",
    duration_body: "DPA ini berlaku selama berlangganan HealthWatch Global. Setelah berakhir, Pemroses akan menghapus atau mengembalikan semua data pribadi dalam 30 hari.",
    law_title: "9. Hukum yang Berlaku",
    law_body: "DPA ini tunduk pada hukum Prancis dan Peraturan (EU) 2016/679 (GDPR). Perselisihan akan diselesaikan di pengadilan Paris, Prancis.",
    request_title: "Minta Salinan yang Ditandatangani",
    request_body: "Untuk mendapatkan salinan DPA yang ditandatangani untuk catatan pengadaan institusional Anda, hubungi kami. Kami merespons dalam 2 hari kerja dengan PDF yang ditandatangani.",
    request_cta: "Minta DPA yang ditandatangani →",
    security_badge: ["Data dihosting di UE", "GDPR Pasal 28 patuh", "Respons dalam 48j"],
  },
};

export default async function DpaPage() {
  const locale = await getLocale();
  const c = COPY[locale] ?? COPY.en;
  const isRtl = locale === "ar";

  return (
    <div className="max-w-3xl mx-auto px-4 py-10 space-y-10" dir={isRtl ? "rtl" : undefined}>

      {/* Back */}
      <Link href={`/${locale}/pricing`} className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-300 transition-colors">
        <ArrowLeft className="w-3.5 h-3.5" />
        {c.back}
      </Link>

      {/* Header */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Shield className="w-6 h-6 text-green-400" />
          <span className="text-xs text-green-400 font-semibold uppercase tracking-widest">GDPR · Art. 28</span>
        </div>
        <h1 className="text-3xl font-extrabold text-white">{c.title}</h1>
        <p className="text-gray-400">{c.subtitle}</p>
        <p className="text-xs text-gray-600">{c.updated}</p>

        {/* Security badges */}
        <div className="flex flex-wrap gap-2 pt-2">
          {c.security_badge.map((b) => (
            <span key={b} className="inline-flex items-center gap-1.5 text-xs bg-green-500/10 border border-green-500/20 text-green-400 rounded-full px-3 py-1">
              <Check className="w-3 h-3" />
              {b}
            </span>
          ))}
        </div>
      </div>

      {/* Request CTA — top */}
      <div className="bg-green-500/5 border border-green-500/20 rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <p className="font-semibold text-white text-sm">{c.request_title}</p>
          <p className="text-gray-400 text-xs mt-1">{c.request_body}</p>
        </div>
        <a
          href={`mailto:contact@healthwatch-global.com?subject=DPA%20Request%20—%20HealthWatch%20Global&body=Organization%3A%20%0AContact%3A%20%0ALanguage%3A%20`}
          className="shrink-0 inline-flex items-center gap-2 bg-green-700 hover:bg-green-600 text-white font-semibold px-4 py-2.5 rounded-lg transition-colors text-sm whitespace-nowrap"
        >
          <Mail className="w-4 h-4" />
          {c.request_cta}
        </a>
      </div>

      {/* Section 1 — Parties */}
      <section className="space-y-3">
        <h2 className="text-lg font-bold text-white border-b border-gray-800 pb-2">{c.parties_title}</h2>
        <p className="text-gray-300 text-sm leading-relaxed">{c.parties_controller}</p>
        <p className="text-gray-400 text-sm leading-relaxed">{c.parties_processor}</p>
      </section>

      {/* Section 2 — Subject */}
      <section className="space-y-3">
        <h2 className="text-lg font-bold text-white border-b border-gray-800 pb-2">{c.subject_title}</h2>
        <p className="text-gray-400 text-sm leading-relaxed">{c.subject_body}</p>
      </section>

      {/* Section 3 — Data categories */}
      <section className="space-y-3">
        <h2 className="text-lg font-bold text-white border-b border-gray-800 pb-2">{c.data_title}</h2>
        <div className="overflow-x-auto rounded-xl border border-gray-800">
          <table className="w-full text-sm min-w-[520px]">
            <thead>
              <tr className="bg-gray-900 border-b border-gray-800">
                <th className="text-left px-4 py-3 text-gray-400 font-medium">{c.data_col_cat}</th>
                <th className="text-left px-4 py-3 text-gray-400 font-medium">{c.data_col_detail}</th>
                <th className="text-left px-4 py-3 text-gray-400 font-medium">{c.data_col_subjects}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/60">
              {c.data_rows.map(([cat, detail, subjects], i) => (
                <tr key={i} className={i % 2 === 0 ? "bg-gray-900/20" : ""}>
                  <td className="px-4 py-3 text-gray-300 font-medium">{cat}</td>
                  <td className="px-4 py-3 text-gray-400">{detail}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{subjects}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Section 4 — Obligations */}
      <section className="space-y-3">
        <h2 className="text-lg font-bold text-white border-b border-gray-800 pb-2">{c.obligations_title}</h2>
        <ul className="space-y-2">
          {c.obligations.map((o, i) => (
            <li key={i} className="text-gray-400 text-sm leading-relaxed">{o}</li>
          ))}
        </ul>
      </section>

      {/* Section 5 — Sub-processors */}
      <section className="space-y-3">
        <h2 className="text-lg font-bold text-white border-b border-gray-800 pb-2">{c.subprocessors_title}</h2>
        <p className="text-gray-400 text-sm">{c.subprocessors_note}</p>
        <div className="overflow-x-auto rounded-xl border border-gray-800">
          <table className="w-full text-sm min-w-[600px]">
            <thead>
              <tr className="bg-gray-900 border-b border-gray-800">
                <th className="text-left px-4 py-3 text-gray-400 font-medium">{c.sp_col_name}</th>
                <th className="text-left px-4 py-3 text-gray-400 font-medium">{c.sp_col_purpose}</th>
                <th className="text-left px-4 py-3 text-gray-400 font-medium">{c.sp_col_location}</th>
                <th className="text-left px-4 py-3 text-gray-400 font-medium">{c.sp_col_safeguard}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/60">
              {SUBPROCESSORS.map((sp, i) => (
                <tr key={i} className={i % 2 === 0 ? "bg-gray-900/20" : ""}>
                  <td className="px-4 py-3 text-gray-300 font-medium whitespace-nowrap">{sp.name}</td>
                  <td className="px-4 py-3 text-gray-400">{locale === "fr" ? sp.purpose_fr : sp.purpose_en}</td>
                  <td className="px-4 py-3 text-gray-400 text-xs">{sp.location}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{sp.safeguard}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Section 6 — Security */}
      <section className="space-y-3">
        <h2 className="text-lg font-bold text-white border-b border-gray-800 pb-2">{c.security_title}</h2>
        <ul className="space-y-2">
          {c.security_measures.map((m, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-gray-400">
              <Check className="w-4 h-4 text-green-400 shrink-0 mt-0.5" />
              {m}
            </li>
          ))}
        </ul>
      </section>

      {/* Section 7 — Breach */}
      <section className="space-y-3">
        <h2 className="text-lg font-bold text-white border-b border-gray-800 pb-2">{c.breach_title}</h2>
        <p className="text-gray-400 text-sm leading-relaxed">{c.breach_body}</p>
      </section>

      {/* Section 8 — Duration */}
      <section className="space-y-3">
        <h2 className="text-lg font-bold text-white border-b border-gray-800 pb-2">{c.duration_title}</h2>
        <p className="text-gray-400 text-sm leading-relaxed">{c.duration_body}</p>
      </section>

      {/* Section 9 — Law */}
      <section className="space-y-3">
        <h2 className="text-lg font-bold text-white border-b border-gray-800 pb-2">{c.law_title}</h2>
        <p className="text-gray-400 text-sm leading-relaxed">{c.law_body}</p>
      </section>

      {/* Request CTA — bottom */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <FileText className="w-5 h-5 text-green-400 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-white text-sm">{c.request_title}</p>
            <p className="text-gray-400 text-xs mt-1">{c.request_body}</p>
          </div>
        </div>
        <a
          href={`mailto:contact@healthwatch-global.com?subject=DPA%20Request%20—%20HealthWatch%20Global&body=Organization%3A%20%0AContact%3A%20%0ALanguage%3A%20`}
          className="shrink-0 inline-flex items-center gap-2 bg-green-700 hover:bg-green-600 text-white font-semibold px-4 py-2.5 rounded-lg transition-colors text-sm whitespace-nowrap"
        >
          <Mail className="w-4 h-4" />
          {c.request_cta}
        </a>
      </div>

    </div>
  );
}
