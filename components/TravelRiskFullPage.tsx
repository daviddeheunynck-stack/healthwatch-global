"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Plane, AlertTriangle, CheckCircle, ShieldAlert, ShieldOff,
  Search, Shield, ExternalLink, MapPin, ChevronRight,
} from "lucide-react";

type Risk = "none" | "low" | "medium" | "high" | "critical";

interface ActiveOutbreak {
  id: string;
  disease_en: string | null;
  cases: number;
  deaths: number;
  risk_level: string;
  date: string;
  is_pheic: boolean;
}

interface TravelResult {
  country_en: string;
  risk: Risk;
  outbreaks: ActiveOutbreak[];
  recommendation: string;
  checked_at: string;
}

const COPY: Record<string, {
  title: string; subtitle: string; searchLabel: string; placeholder: string;
  check: string; checking: string; noOutbreaks: string; outbreaksTitle: string;
  precautionsTitle: string; resourcesTitle: string; checkedAt: string;
  cases: string; deaths: string; updated: string; networkError: string;
}> = {
  en: {
    title: "Travel Health Risk", subtitle: "Epidemiological risk assessment before travel",
    searchLabel: "Destination country", placeholder: "E.g. India, Brazil, Nigeria…",
    check: "Assess", checking: "Assessing…", noOutbreaks: "No active disease outbreaks detected in this country.",
    outbreaksTitle: "Active Outbreaks", precautionsTitle: "Recommended Precautions",
    resourcesTitle: "Official Health Resources", checkedAt: "Assessed at",
    cases: "Cases", deaths: "Deaths", updated: "Updated", networkError: "Network error — please retry.",
  },
  fr: {
    title: "Risque santé voyage", subtitle: "Évaluation épidémiologique avant déplacement",
    searchLabel: "Pays de destination", placeholder: "Ex : India, Brazil, Nigeria…",
    check: "Évaluer", checking: "Analyse…", noOutbreaks: "Aucun foyer épidémique actif détecté dans ce pays.",
    outbreaksTitle: "Foyers actifs", precautionsTitle: "Précautions recommandées",
    resourcesTitle: "Sources de santé officielles", checkedAt: "Évalué le",
    cases: "Cas", deaths: "Décès", updated: "Mise à jour", networkError: "Erreur réseau — réessayez.",
  },
  es: {
    title: "Riesgo sanitario de viaje", subtitle: "Evaluación epidemiológica antes del viaje",
    searchLabel: "País de destino", placeholder: "Ej: India, Brasil, Nigeria…",
    check: "Evaluar", checking: "Evaluando…", noOutbreaks: "No se detectaron brotes activos en este país.",
    outbreaksTitle: "Brotes activos", precautionsTitle: "Precauciones recomendadas",
    resourcesTitle: "Fuentes de salud oficiales", checkedAt: "Evaluado el",
    cases: "Casos", deaths: "Fallecidos", updated: "Actualizado", networkError: "Error de red — inténtelo de nuevo.",
  },
  ar: {
    title: "مخاطر صحة السفر", subtitle: "تقييم وبائي قبل السفر",
    searchLabel: "بلد الوجهة", placeholder: "مثال: India, Brazil, Nigeria…",
    check: "تقييم", checking: "جارٍ التقييم…", noOutbreaks: "لم يُرصد أي تفشٍّ نشط في هذا البلد.",
    outbreaksTitle: "التفشيات النشطة", precautionsTitle: "الاحتياطات الموصى بها",
    resourcesTitle: "مصادر الصحة الرسمية", checkedAt: "تم التقييم في",
    cases: "الحالات", deaths: "الوفيات", updated: "تحديث", networkError: "خطأ في الشبكة — يرجى المحاولة مرة أخرى.",
  },
  id: {
    title: "Risiko Kesehatan Perjalanan", subtitle: "Penilaian epidemiologis sebelum perjalanan",
    searchLabel: "Negara tujuan", placeholder: "Mis: India, Brasil, Nigeria…",
    check: "Nilai", checking: "Menilai…", noOutbreaks: "Tidak ada wabah aktif terdeteksi di negara ini.",
    outbreaksTitle: "Wabah Aktif", precautionsTitle: "Tindakan Pencegahan yang Direkomendasikan",
    resourcesTitle: "Sumber Kesehatan Resmi", checkedAt: "Dinilai pada",
    cases: "Kasus", deaths: "Kematian", updated: "Diperbarui", networkError: "Kesalahan jaringan — coba lagi.",
  },
};

const RISK_CONFIG: Record<Risk, {
  border: string; bg: string; text: string; badgeBg: string;
  icon: React.ElementType; label: Record<string, string>;
}> = {
  none:     { border: "border-green-700/40",  bg: "bg-green-900/10",  text: "text-green-400",  badgeBg: "bg-green-900/30",  icon: CheckCircle,   label: { en: "No Risk",      fr: "Aucun risque",    es: "Sin riesgo",      ar: "بلا خطر",       id: "Tidak berisiko" } },
  low:      { border: "border-green-700/40",  bg: "bg-green-900/10",  text: "text-green-300",  badgeBg: "bg-green-900/30",  icon: CheckCircle,   label: { en: "Low Risk",     fr: "Risque faible",   es: "Riesgo bajo",     ar: "خطر منخفض",     id: "Risiko rendah"  } },
  medium:   { border: "border-amber-700/40",  bg: "bg-amber-900/10",  text: "text-amber-400",  badgeBg: "bg-amber-900/30",  icon: ShieldAlert,   label: { en: "Moderate",     fr: "Risque modéré",   es: "Riesgo moderado", ar: "خطر متوسط",     id: "Risiko sedang"  } },
  high:     { border: "border-red-700/40",    bg: "bg-red-900/10",    text: "text-red-400",    badgeBg: "bg-red-900/30",    icon: AlertTriangle, label: { en: "High Risk",    fr: "Risque élevé",    es: "Riesgo alto",     ar: "خطر مرتفع",     id: "Risiko tinggi"  } },
  critical: { border: "border-red-500/50",    bg: "bg-red-900/20",    text: "text-red-300",    badgeBg: "bg-red-800/40",    icon: ShieldOff,     label: { en: "Critical",     fr: "Critique",        es: "Crítico",         ar: "حرج",            id: "Kritis"         } },
};

const PRECAUTIONS: Record<Risk, Record<string, string[]>> = {
  none: {
    en: ["Ensure routine vaccinations are up to date (MMR, tetanus, hepatitis A/B)", "Carry a basic travel health kit", "Register with your embassy if staying long-term"],
    fr: ["Vérifier que les vaccinations de routine sont à jour (ROR, tétanos, hépatite A/B)", "Emporter une trousse de santé voyage basique", "S'enregistrer auprès de l'ambassade pour un séjour prolongé"],
    es: ["Verificar que las vacunas de rutina estén al día (SRP, tétanos, hepatitis A/B)", "Llevar un kit básico de salud para viajeros", "Registrarse en la embajada para estancias largas"],
    ar: ["التأكد من تحديث التطعيمات الروتينية (الحصبة، الكزاز، التهاب الكبد أ/ب)", "حمل حقيبة صحة سفر أساسية", "التسجيل في السفارة للإقامات الطويلة"],
    id: ["Pastikan vaksinasi rutin terkini (MMR, tetanus, hepatitis A/B)", "Bawa kit kesehatan perjalanan dasar", "Daftarkan diri ke kedutaan untuk tinggal jangka panjang"],
  },
  low: {
    en: ["Ensure routine vaccinations are up to date", "Carry a travel health kit including diarrhoea medication", "Monitor WHO situation reports for updates", "Purchase travel health insurance"],
    fr: ["Vaccinations de routine à jour", "Trousse de santé voyage avec médicaments anti-diarrhéiques", "Suivre les rapports de situation OMS", "Souscrire une assurance santé voyage"],
    es: ["Vacunas de rutina al día", "Kit de salud con medicamentos para diarrea", "Seguir los informes de situación OMS", "Contratar seguro médico de viaje"],
    ar: ["تحديث التطعيمات الروتينية", "حقيبة صحة تشمل أدوية الإسهال", "متابعة تقارير الوضع من منظمة الصحة العالمية", "الحصول على تأمين صحي للسفر"],
    id: ["Pastikan vaksinasi rutin terkini", "Kit kesehatan termasuk obat diare", "Pantau laporan situasi WHO", "Beli asuransi kesehatan perjalanan"],
  },
  medium: {
    en: ["Consult a travel medicine clinic at least 4–6 weeks before departure", "Review disease-specific prophylaxis options with your physician", "Ensure travel health insurance covers medical evacuation", "Carry a comprehensive medical kit", "Brief colleagues or family on your itinerary"],
    fr: ["Consulter un médecin de voyage 4 à 6 semaines avant le départ", "Envisager une prophylaxie spécifique aux maladies actives", "Vérifier que l'assurance couvre l'évacuation médicale", "Trousse médicale complète", "Informer vos proches de votre itinéraire"],
    es: ["Consultar un especialista en medicina de viaje 4–6 semanas antes", "Evaluar profilaxis específica para las enfermedades activas", "Asegurarse de que el seguro cubra evacuación médica", "Kit médico completo", "Informar a colegas del itinerario"],
    ar: ["استشارة طبيب سفر قبل 4-6 أسابيع من المغادرة", "مراجعة خيارات الوقاية الخاصة بالأمراض النشطة", "التأكد من تغطية التأمين للإخلاء الطبي", "حقيبة طبية شاملة", "إبلاغ الزملاء بمسار الرحلة"],
    id: ["Konsultasi klinik kesehatan perjalanan 4-6 minggu sebelum berangkat", "Tinjau opsi profilaksis khusus penyakit dengan dokter", "Pastikan asuransi mencakup evakuasi medis", "Kit medis lengkap", "Beritahu kolega tentang rencana perjalanan"],
  },
  high: {
    en: ["Reconsider non-essential travel", "Mandatory pre-travel medical consultation", "Ensure evacuation insurance and emergency contacts are confirmed", "Carry an advanced medical kit — antibiotic prophylaxis if advised", "Establish daily check-ins with your organisation", "Identify local hospitals and emergency services in advance"],
    fr: ["Reconsidérer les voyages non essentiels", "Consultation médicale pré-voyage obligatoire", "Assurance évacuation et contacts d'urgence confirmés", "Trousse médicale avancée avec prophylaxie antibiotique si conseillé", "Points de contact quotidiens avec votre organisation", "Identifier à l'avance les hôpitaux et services d'urgence locaux"],
    es: ["Reconsiderar los viajes no esenciales", "Consulta médica previa al viaje obligatoria", "Seguro de evacuación y contactos de emergencia confirmados", "Kit médico avanzado con profilaxis antibiótica si se recomienda", "Puntos de control diarios con su organización", "Identificar hospitales locales de antemano"],
    ar: ["إعادة النظر في السفر غير الضروري", "استشارة طبية إلزامية قبل السفر", "تأمين الإخلاء وجهات الاتصال الطارئة المؤكدة", "حقيبة طبية متقدمة مع وقاية بالمضادات الحيوية إذا أُوصي بها", "تسجيل يومي مع مؤسستك", "تحديد المستشفيات المحلية وخدمات الطوارئ مسبقاً"],
    id: ["Pertimbangkan kembali perjalanan tidak penting", "Konsultasi medis pra-perjalanan wajib", "Pastikan asuransi evakuasi dan kontak darurat terkonfirmasi", "Kit medis lanjutan dengan profilaksis antibiotik jika disarankan", "Check-in harian dengan organisasi Anda", "Identifikasi rumah sakit dan layanan darurat lokal terlebih dahulu"],
  },
  critical: {
    en: ["Avoid all non-essential travel immediately", "If already in-country: contact your embassy for evacuation options", "Coordinate closely with medical and security teams", "Do not enter high-risk areas", "Maintain 24/7 emergency contact protocols", "Follow official government travel advisories strictly"],
    fr: ["Éviter tout voyage non essentiel immédiatement", "Si déjà sur place : contacter l'ambassade pour les options d'évacuation", "Coordination étroite avec les équipes médicales et sécurité", "Ne pas entrer dans les zones à risque élevé", "Maintenir des protocoles de contact d'urgence 24h/24", "Suivre strictement les avis de voyage gouvernementaux officiels"],
    es: ["Evitar cualquier viaje no esencial inmediatamente", "Si ya está en el país: contactar la embajada para opciones de evacuación", "Coordinar estrechamente con equipos médicos y de seguridad", "No entrar en zonas de alto riesgo", "Mantener protocolos de contacto de emergencia 24/7", "Seguir estrictamente los avisos de viaje gubernamentales"],
    ar: ["تجنب أي سفر غير ضروري فوراً", "إذا كنت بالفعل في البلد: اتصل بالسفارة لخيارات الإخلاء", "التنسيق الوثيق مع الفرق الطبية والأمنية", "عدم الدخول إلى مناطق الخطر العالي", "الحفاظ على بروتوكولات الاتصال الطارئ على مدار الساعة", "اتباع نصائح السفر الحكومية الرسمية بدقة"],
    id: ["Hindari semua perjalanan tidak penting segera", "Jika sudah di dalam negeri: hubungi kedutaan untuk opsi evakuasi", "Koordinasikan erat dengan tim medis dan keamanan", "Jangan masuk ke zona risiko tinggi", "Pertahankan protokol kontak darurat 24/7", "Ikuti saran perjalanan pemerintah resmi dengan ketat"],
  },
};

const RESOURCES = [
  { key: "who",  label: { en: "WHO Travel Advice",   fr: "Conseils voyage OMS",   es: "Consejos de viaje OMS",   ar: "نصائح سفر منظمة الصحة العالمية", id: "Saran Perjalanan WHO"   }, url: "https://www.who.int/travel-advice" },
  { key: "cdc",  label: { en: "CDC Travel Health",   fr: "Santé voyage CDC",      es: "Salud de viaje CDC",      ar: "صحة السفر CDC",                   id: "Kesehatan Perjalanan CDC" }, url: "https://wwwnc.cdc.gov/travel" },
  { key: "ecdc", label: { en: "ECDC Travel Health",  fr: "Santé voyage ECDC",     es: "Salud viaje ECDC",        ar: "صحة السفر ECDC",                   id: "Kesehatan Perjalanan ECDC" }, url: "https://www.ecdc.europa.eu/en/travel-information" },
  { key: "fcdo", label: { en: "UK FCDO Travel",      fr: "FCDO (Royaume-Uni)",    es: "FCDO (Reino Unido)",      ar: "نصائح FCDO (المملكة المتحدة)",     id: "UK FCDO Travel"         }, url: "https://www.gov.uk/foreign-travel-advice" },
];

export default function TravelRiskFullPage({ locale }: { locale: string }) {
  const c = COPY[locale] ?? COPY.en;
  const [query,   setQuery]   = useState("");
  const [loading, setLoading] = useState(false);
  const [result,  setResult]  = useState<TravelResult | null>(null);
  const [error,   setError]   = useState("");

  async function check() {
    const country = query.trim();
    if (!country) return;
    setLoading(true);
    setResult(null);
    setError("");
    try {
      const res  = await fetch(`/api/travel-risk?country_en=${encodeURIComponent(country)}&locale=${locale}`);
      const data = await res.json() as TravelResult & { error?: string };
      if (data.error) { setError(data.error); return; }
      setResult(data);
    } catch { setError(c.networkError); }
    finally { setLoading(false); }
  }

  const rc      = result ? RISK_CONFIG[result.risk] : null;
  const RiskIcon = rc?.icon;
  const lang    = (locale in (PRECAUTIONS.none)) ? locale : "en";
  const precs   = result ? (PRECAUTIONS[result.risk][lang] ?? PRECAUTIONS[result.risk].en) : null;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">

      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0">
          <Plane className="w-6 h-6 text-blue-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">{c.title}</h1>
          <p className="text-sm text-gray-400 mt-0.5">{c.subtitle}</p>
        </div>
      </div>

      {/* Search */}
      <div className="bg-gray-900/60 border border-gray-700/50 rounded-2xl p-6">
        <label className="block text-sm font-medium text-gray-300 mb-3 flex items-center gap-1.5">
          <MapPin className="w-4 h-4 text-gray-500" />
          {c.searchLabel}
        </label>
        <div className="flex gap-3">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && check()}
            placeholder={c.placeholder}
            className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30"
          />
          <button
            onClick={check}
            disabled={loading || !query.trim()}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl transition-colors flex items-center gap-2 shrink-0"
          >
            <Search className="w-4 h-4" />
            {loading ? c.checking : c.check}
          </button>
        </div>
        {error && <p className="text-sm text-red-400 mt-3">{error}</p>}
      </div>

      {/* Result */}
      {result && rc && RiskIcon && (
        <>
          {/* Risk hero card */}
          <div className={`rounded-2xl border ${rc.border} ${rc.bg} p-6`}>
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-4">
                <div className={`w-16 h-16 rounded-2xl ${rc.badgeBg} flex items-center justify-center shrink-0`}>
                  <RiskIcon className={`w-8 h-8 ${rc.text}`} />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-2xl font-bold ${rc.text}`}>{rc.label[locale] ?? rc.label.en}</span>
                    {result.outbreaks.some((o) => o.is_pheic) && (
                      <span className="text-xs bg-red-800/50 text-red-300 border border-red-700/40 px-2 py-0.5 rounded-full font-bold">PHEIC</span>
                    )}
                  </div>
                  <p className="text-xl font-semibold text-white mt-0.5">{result.country_en}</p>
                  <p className="text-xs text-gray-500 mt-1">{c.checkedAt} {new Date(result.checked_at).toLocaleString(locale === "ar" ? "ar-SA" : locale, { dateStyle: "short", timeStyle: "short" })}</p>
                </div>
              </div>
              <div className="text-right">
                <p className={`text-4xl font-bold ${rc.text} tabular-nums`}>{result.outbreaks.length}</p>
                <p className="text-xs text-gray-500 mt-0.5">{c.outbreaksTitle.toLowerCase()}</p>
              </div>
            </div>
            <p className={`mt-5 text-sm leading-relaxed border-t ${rc.border} pt-4 ${result.risk === "critical" ? "text-red-200 font-medium" : "text-gray-300"}`}>
              {result.recommendation}
            </p>
          </div>

          {/* Outbreaks list */}
          {result.outbreaks.length > 0 ? (
            <div className="bg-gray-900/60 border border-gray-700/50 rounded-2xl overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-800 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                <h2 className="text-sm font-bold text-gray-200 uppercase tracking-wide">{c.outbreaksTitle}</h2>
              </div>
              <div className="divide-y divide-gray-800/60">
                {result.outbreaks.map((o) => {
                  const oc = RISK_CONFIG[o.risk_level as Risk] ?? RISK_CONFIG.low;
                  return (
                    <Link
                      key={o.id}
                      href={`/${locale}/outbreak/${o.id}`}
                      className="flex items-center gap-4 px-6 py-4 hover:bg-gray-800/50 transition-colors group"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-white text-sm truncate">{o.disease_en ?? "Unknown"}</span>
                          {o.is_pheic && (
                            <span className="text-[10px] bg-red-800/50 text-red-300 border border-red-700/40 px-1.5 py-0.5 rounded-full font-bold shrink-0">PHEIC</span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5">{c.updated}: {new Date(o.date).toLocaleDateString(locale === "ar" ? "ar-SA" : locale)}</p>
                      </div>
                      <div className="flex items-center gap-5 shrink-0">
                        <div className="text-right hidden sm:block">
                          <p className="text-sm font-semibold text-white tabular-nums">{o.cases.toLocaleString()}</p>
                          <p className="text-[10px] text-gray-500 uppercase tracking-wide">{c.cases}</p>
                        </div>
                        <div className="text-right hidden sm:block">
                          <p className="text-sm font-semibold text-gray-400 tabular-nums">{o.deaths.toLocaleString()}</p>
                          <p className="text-[10px] text-gray-500 uppercase tracking-wide">{c.deaths}</p>
                        </div>
                        <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${oc.badgeBg} ${oc.text} border ${oc.border} uppercase tracking-wide`}>
                          {oc.label[locale] ?? oc.label.en}
                        </span>
                        <ChevronRight className="w-4 h-4 text-gray-600 group-hover:text-gray-400 transition-colors" />
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="bg-gray-900/60 border border-green-700/30 rounded-2xl p-8 text-center">
              <CheckCircle className="w-10 h-10 text-green-400 mx-auto mb-3" />
              <p className="text-sm text-gray-400">{c.noOutbreaks}</p>
            </div>
          )}

          {/* Precautions */}
          {precs && (
            <div className="bg-gray-900/60 border border-gray-700/50 rounded-2xl p-6">
              <div className="flex items-center gap-2 mb-5">
                <Shield className="w-4 h-4 text-blue-400" />
                <h2 className="text-sm font-bold text-gray-200 uppercase tracking-wide">{c.precautionsTitle}</h2>
              </div>
              <ul className="space-y-3">
                {precs.map((p, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm text-gray-300">
                    <CheckCircle className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
                    {p}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}

      {/* Official resources — always visible */}
      <div className="bg-gray-900/40 border border-gray-700/30 rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <ExternalLink className="w-4 h-4 text-gray-500" />
          <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wide">{c.resourcesTitle}</h2>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {RESOURCES.map((r) => (
            <a
              key={r.key}
              href={r.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-xs text-gray-400 hover:text-blue-400 transition-colors p-3 rounded-xl hover:bg-gray-800/60 border border-transparent hover:border-gray-700/50"
            >
              <ExternalLink className="w-3 h-3 shrink-0 text-gray-600" />
              {r.label[locale as keyof typeof r.label] ?? r.label.en}
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
