"use client";

import { useEffect, useState } from "react";
import { useLocale } from "next-intl";
import { track } from "@vercel/analytics/react";
import { Globe, BarChart2, Zap, X, ArrowRight, ChevronLeft, Activity } from "lucide-react";
import Link from "next/link";
import CheckoutButton from "@/components/CheckoutButton";

// ─── Copy ─────────────────────────────────────────────────────────────────────

type Step = { title: string; body: string; cta: string };

const COPY: Record<string, {
  skip: string;
  prev: string;
  finish: string;
  startTrial: string;
  seePlans: string;
  pilotNudge: string;
  pilotLink: string;
  steps: [Step, Step, Step, Step];
}> = {
  fr: {
    skip: "Passer",
    prev: "Précédent",
    finish: "Accéder au tableau de bord →",
    startTrial: "Commencer l'essai gratuit →",
    seePlans: "Voir les offres →",
    pilotNudge: "Vous représentez une organisation ?",
    pilotLink: "Programme pilote gratuit →",
    steps: [
      {
        title: "Bienvenue sur HealthWatch Global 🌍",
        body: "Votre plateforme de surveillance épidémique mondiale, alimentée par l'OMS, l'ECDC, l'OPAS et l'Africa CDC. Laissez-nous vous montrer l'essentiel en 3 étapes.",
        cta: "Commencer",
      },
      {
        title: "La carte mondiale interactive",
        body: "Chaque bulle représente un foyer actif. Rouge = risque élevé, jaune = moyen, vert = faible. Cliquez sur une bulle pour voir la maladie, le pays, la source et la date.",
        cta: "Suivant",
      },
      {
        title: "Le tableau de bord épidémiologique",
        body: "Tous les foyers actifs triés par niveau de risque. Les chiffres exacts de cas et de décès sont disponibles avec le plan Pro — les utilisateurs gratuits voient les données floutées.",
        cta: "Suivant",
      },
      {
        title: "Débloquez la surveillance complète",
        body: "Cas confirmés · Décès · Rapports PDF · Alertes instantanées · Export CSV. Essai Pro 14 jours — sans carte bancaire requise.",
        cta: "C'est parti →",
      },
    ],
  },
  en: {
    skip: "Skip",
    prev: "Back",
    finish: "Go to dashboard →",
    startTrial: "Start free trial →",
    seePlans: "See plans →",
    pilotNudge: "Representing an organization?",
    pilotLink: "Free institutional pilot →",
    steps: [
      {
        title: "Welcome to HealthWatch Global 🌍",
        body: "Your global epidemic surveillance platform, powered by official WHO data. Let us show you the essentials in 3 steps.",
        cta: "Get started",
      },
      {
        title: "The interactive world map",
        body: "Each bubble represents an active outbreak. Red = high risk, yellow = medium, green = low. Click a bubble to see the disease, country, source and date.",
        cta: "Next",
      },
      {
        title: "The epidemiological dashboard",
        body: "All active outbreaks sorted by risk level. Exact case and death figures are available on the Pro plan — free users see blurred data.",
        cta: "Next",
      },
      {
        title: "Unlock full surveillance",
        body: "Confirmed cases · Deaths · PDF reports · Instant alerts · CSV export. 14-day Pro trial — no credit card required.",
        cta: "Let's go →",
      },
    ],
  },
  es: {
    skip: "Omitir",
    prev: "Anterior",
    finish: "Ir al panel →",
    startTrial: "Iniciar prueba gratuita →",
    seePlans: "Ver planes →",
    pilotNudge: "¿Representa una organización?",
    pilotLink: "Piloto institucional gratuito →",
    steps: [
      {
        title: "Bienvenido a HealthWatch Global 🌍",
        body: "Su plataforma de vigilancia epidémica mundial, impulsada por la OMS, ECDC, PAHO y Africa CDC. Déjenos mostrarle lo esencial en 3 pasos.",
        cta: "Comenzar",
      },
      {
        title: "El mapa mundial interactivo",
        body: "Cada burbuja representa un brote activo. Rojo = riesgo alto, amarillo = medio, verde = bajo. Haga clic en una burbuja para ver la enfermedad, el país, la fuente y la fecha.",
        cta: "Siguiente",
      },
      {
        title: "El panel epidemiológico",
        body: "Todos los brotes activos ordenados por nivel de riesgo. Las cifras exactas de casos y fallecidos están disponibles en el plan Pro.",
        cta: "Siguiente",
      },
      {
        title: "Desbloquee la vigilancia completa",
        body: "Casos confirmados · Fallecidos · Informes PDF · Alertas instantáneas · Exportación CSV. Prueba Pro de 14 días — sin tarjeta de crédito.",
        cta: "¡Vamos! →",
      },
    ],
  },
  ar: {
    skip: "تخطي",
    prev: "السابق",
    finish: "← إلى لوحة التحكم",
    startTrial: "← ابدأ التجربة المجانية",
    seePlans: "← عرض الخطط",
    pilotNudge: "هل تمثل منظمة؟",
    pilotLink: "← برنامج تجريبي مؤسسي مجاني",
    steps: [
      {
        title: "مرحباً بك في HealthWatch Global 🌍",
        body: "منصتك لمراقبة الأوبئة العالمية، مدعومة ببيانات منظمة الصحة العالمية الرسمية. دعنا نُريك الأساسيات في 3 خطوات.",
        cta: "ابدأ",
      },
      {
        title: "الخريطة العالمية التفاعلية",
        body: "كل فقاعة تمثّل تفشياً نشطاً. أحمر = خطر مرتفع، أصفر = متوسط، أخضر = منخفض. انقر على فقاعة لرؤية المرض والدولة والمصدر والتاريخ.",
        cta: "التالي",
      },
      {
        title: "لوحة التحكم الوبائية",
        body: "جميع التفشيات النشطة مرتّبة حسب مستوى الخطر. الأرقام الدقيقة للحالات والوفيات متاحة في خطة Pro.",
        cta: "التالي",
      },
      {
        title: "افتح المراقبة الكاملة",
        body: "الحالات المؤكدة · الوفيات · تقارير PDF · تنبيهات فورية · تصدير CSV. تجربة Pro 14 يوماً — بدون بطاقة بنكية.",
        cta: "لنبدأ →",
      },
    ],
  },
  id: {
    skip: "Lewati",
    prev: "Kembali",
    finish: "Ke dasbor →",
    startTrial: "Mulai uji coba gratis →",
    seePlans: "Lihat paket →",
    pilotNudge: "Mewakili sebuah organisasi?",
    pilotLink: "Program pilot institusional gratis →",
    steps: [
      {
        title: "Selamat datang di HealthWatch Global 🌍",
        body: "Platform pemantauan epidemi global Anda, didukung oleh data resmi WHO. Biarkan kami menunjukkan hal-hal penting dalam 3 langkah.",
        cta: "Mulai",
      },
      {
        title: "Peta dunia interaktif",
        body: "Setiap gelembung mewakili wabah aktif. Merah = risiko tinggi, kuning = sedang, hijau = rendah. Klik gelembung untuk melihat penyakit, negara, sumber, dan tanggal.",
        cta: "Lanjut",
      },
      {
        title: "Dasbor epidemiologi",
        body: "Semua wabah aktif diurutkan berdasarkan tingkat risiko. Angka kasus dan kematian yang tepat tersedia di paket Pro.",
        cta: "Lanjut",
      },
      {
        title: "Buka pemantauan lengkap",
        body: "Kasus terkonfirmasi · Kematian · Laporan PDF · Peringatan instan · Ekspor CSV. Uji coba Pro 14 hari — tanpa kartu kredit.",
        cta: "Ayo mulai →",
      },
    ],
  },
};

// ─── Step icons ───────────────────────────────────────────────────────────────

const STEP_CONFIG = [
  { Icon: Activity, bg: "bg-red-500/10",    border: "border-red-500/20",    color: "text-red-400"    },
  { Icon: Globe,    bg: "bg-blue-500/10",   border: "border-blue-500/20",   color: "text-blue-400"   },
  { Icon: BarChart2,bg: "bg-yellow-500/10", border: "border-yellow-500/20", color: "text-yellow-400" },
  { Icon: Zap,      bg: "bg-purple-500/10", border: "border-purple-500/20", color: "text-purple-400" },
] as const;

const STORAGE_KEY = "hw_tour_v1";

// ─── Component ────────────────────────────────────────────────────────────────

export default function OnboardingTour({ isPaid = false }: { isPaid?: boolean }) {
  const locale = useLocale();
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(0);

  const c = COPY[locale] ?? COPY.en;
  const totalSteps = c.steps.length;
  const isLast = step === totalSteps - 1;

  // Show tour once per browser (delay so page renders first)
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (localStorage.getItem(STORAGE_KEY)) return;
    const t = setTimeout(() => {
      setVisible(true);
      track("onboarding_tour_start", { locale });
    }, 900);
    return () => clearTimeout(t);
  }, [locale]);

  const dismiss = (method: "complete" | "skip") => {
    localStorage.setItem(STORAGE_KEY, "1");
    setVisible(false);
    track(`onboarding_tour_${method}`, { step, locale });
  };

  if (!visible) return null;

  const { title, body } = c.steps[step];
  const { Icon, bg, border, color } = STEP_CONFIG[step];
  const isRtl = locale === "ar";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={() => dismiss("skip")}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" />

      {/* Card */}
      <div
        className="relative bg-gray-900 border border-gray-700 rounded-2xl p-8 w-full max-w-md shadow-2xl"
        dir={isRtl ? "rtl" : "ltr"}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Skip button */}
        {!isLast && (
          <button
            onClick={() => dismiss("skip")}
            className="absolute top-4 right-4 text-gray-500 hover:text-gray-300 transition-colors"
            aria-label="Skip tour"
          >
            <X className="w-5 h-5" />
          </button>
        )}

        {/* Step icon */}
        <div className={`w-14 h-14 rounded-2xl border ${border} ${bg} flex items-center justify-center mb-6`}>
          <Icon className={`w-7 h-7 ${color}`} />
        </div>

        {/* Content */}
        <h2 className="text-xl font-bold text-white mb-3 leading-snug">{title}</h2>
        <p className="text-gray-400 text-sm leading-relaxed mb-8">{body}</p>

        {/* Step dots */}
        <div className="flex items-center justify-center gap-2 mb-6">
          {Array.from({ length: totalSteps }).map((_, i) => (
            <button
              key={i}
              onClick={() => setStep(i)}
              className={`rounded-full transition-all ${
                i === step
                  ? "w-5 h-2 bg-red-500"
                  : "w-2 h-2 bg-gray-700 hover:bg-gray-500"
              }`}
              aria-label={`Step ${i + 1}`}
            />
          ))}
        </div>

        {/* Navigation */}
        <div className="flex items-center gap-3">
          {step > 0 && (
            <button
              onClick={() => setStep((s) => s - 1)}
              className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-300 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
              {c.prev}
            </button>
          )}

          <div className="flex-1" />

          {isLast ? (
            <div className="flex flex-col items-center gap-3 w-full">
              {isPaid ? (
                <button
                  onClick={() => dismiss("complete")}
                  className="w-full flex items-center justify-center gap-2 bg-red-600 hover:bg-red-500 text-white font-bold py-3 rounded-xl transition-all text-sm"
                >
                  {c.finish}
                  <ArrowRight className="w-4 h-4" />
                </button>
              ) : (
                <>
                  <CheckoutButton
                    plan="pro"
                    locale={locale}
                    label={c.startTrial}
                    className="w-full flex items-center justify-center gap-2 bg-red-600 hover:bg-red-500 text-white font-bold py-3 rounded-xl transition-all text-sm"
                  />
                  <button
                    onClick={() => dismiss("complete")}
                    className="text-xs text-gray-500 hover:text-gray-400 transition-colors"
                  >
                    {c.finish}
                  </button>
                  <p className="text-xs text-gray-600 text-center">
                    {c.pilotNudge}{" "}
                    <Link
                      href={`/${locale}/pilot`}
                      className="text-gray-500 hover:text-gray-300 underline underline-offset-2 transition-colors"
                      onClick={() => { track("onboarding_tour_pilot_click", { locale }); dismiss("skip"); }}
                    >
                      {c.pilotLink}
                    </Link>
                  </p>
                </>
              )}
            </div>
          ) : (
            <button
              onClick={() => setStep((s) => s + 1)}
              className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 text-white font-semibold px-5 py-2.5 rounded-xl transition-colors text-sm"
            >
              {c.steps[step].cta}
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
