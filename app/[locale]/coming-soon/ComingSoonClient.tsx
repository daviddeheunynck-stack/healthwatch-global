"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

const LAUNCH_DATE = new Date("2026-06-25T07:30:00Z"); // 09:30 CEST

const COPY: Record<string, {
  eyebrow: string;
  title: string;
  subtitle: string;
  days: string;
  hours: string;
  minutes: string;
  seconds: string;
  demoBtn: string;
  phBtn: string;
  phNote: string;
}> = {
  en: {
    eyebrow: "Launching on Product Hunt",
    title: "HealthWatch Global goes live\non June 25, 2026",
    subtitle: "Real-time epidemic surveillance for epidemiologists, NGOs & health ministries.\nOfficially launching on Product Hunt in:",
    days: "Days", hours: "Hours", minutes: "Minutes", seconds: "Seconds",
    demoBtn: "Preview the live dashboard →",
    phBtn: "Follow us on Product Hunt",
    phNote: "Get notified the moment we go live",
  },
  fr: {
    eyebrow: "Lancement sur Product Hunt",
    title: "HealthWatch Global arrive\nle 25 juin 2026",
    subtitle: "Surveillance épidémique en temps réel pour épidémiologistes, ONG et ministères de la santé.\nLancement officiel sur Product Hunt dans :",
    days: "Jours", hours: "Heures", minutes: "Minutes", seconds: "Secondes",
    demoBtn: "Voir le tableau de bord en direct →",
    phBtn: "Nous suivre sur Product Hunt",
    phNote: "Soyez notifié dès le lancement",
  },
  es: {
    eyebrow: "Lanzamiento en Product Hunt",
    title: "HealthWatch Global llega\nel 25 de junio de 2026",
    subtitle: "Vigilancia epidémica en tiempo real para epidemiólogos, ONG y ministerios de salud.\nLanzamiento oficial en Product Hunt en:",
    days: "Días", hours: "Horas", minutes: "Minutos", seconds: "Segundos",
    demoBtn: "Ver el panel en directo →",
    phBtn: "Síguenos en Product Hunt",
    phNote: "Recibe una notificación cuando lancemos",
  },
  ar: {
    eyebrow: "الإطلاق على Product Hunt",
    title: "HealthWatch Global ينطلق\nفي 25 يونيو 2026",
    subtitle: "مراقبة وبائية في الوقت الفعلي للأوبئة والمنظمات غير الحكومية ووزارات الصحة.\nالإطلاق الرسمي على Product Hunt بعد:",
    days: "أيام", hours: "ساعات", minutes: "دقائق", seconds: "ثوان",
    demoBtn: "← تجربة لوحة التحكم مباشرةً",
    phBtn: "تابعنا على Product Hunt",
    phNote: "احصل على إشعار لحظة الإطلاق",
  },
  id: {
    eyebrow: "Peluncuran di Product Hunt",
    title: "HealthWatch Global hadir\n25 Juni 2026",
    subtitle: "Pemantauan wabah real-time untuk epidemiolog, LSM & kementerian kesehatan.\nPeluncuran resmi di Product Hunt dalam:",
    days: "Hari", hours: "Jam", minutes: "Menit", seconds: "Detik",
    demoBtn: "Coba dasbor langsung →",
    phBtn: "Ikuti kami di Product Hunt",
    phNote: "Dapatkan notifikasi saat kami meluncur",
  },
};

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function getTimeLeft() {
  const diff = Math.max(0, LAUNCH_DATE.getTime() - Date.now());
  return {
    days: Math.floor(diff / 86400000),
    hours: Math.floor((diff % 86400000) / 3600000),
    minutes: Math.floor((diff % 3600000) / 60000),
    seconds: Math.floor((diff % 60000) / 1000),
    done: diff === 0,
  };
}

export default function ComingSoonClient({ locale }: { locale: string }) {
  const c = COPY[locale] ?? COPY.en;
  const isRtl = locale === "ar";

  const [time, setTime] = useState(getTimeLeft);

  useEffect(() => {
    const t = setInterval(() => setTime(getTimeLeft()), 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <div
      dir={isRtl ? "rtl" : undefined}
      className="min-h-[70vh] flex flex-col items-center justify-center text-center px-4 py-16"
    >
      {/* Eyebrow */}
      <span className="inline-flex items-center gap-2 bg-[#ff6154]/10 text-[#ff6154] text-xs font-semibold tracking-widest uppercase px-4 py-1.5 rounded-full mb-6 border border-[#ff6154]/20">
        <span>🚀</span> {c.eyebrow}
      </span>

      {/* Title */}
      <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white leading-tight mb-4 whitespace-pre-line">
        {c.title}
      </h1>

      {/* Subtitle */}
      <p className="text-gray-400 text-sm sm:text-base max-w-xl mb-10 whitespace-pre-line leading-relaxed">
        {c.subtitle}
      </p>

      {/* Countdown */}
      {!time.done ? (
        <div className="flex items-start gap-4 sm:gap-8 mb-12">
          {[
            { value: time.days, label: c.days },
            { value: time.hours, label: c.hours },
            { value: time.minutes, label: c.minutes },
            { value: time.seconds, label: c.seconds },
          ].map(({ value, label }) => (
            <div key={label} className="flex flex-col items-center gap-1">
              <div className="bg-gray-800 border border-gray-700 rounded-xl w-16 sm:w-20 h-16 sm:h-20 flex items-center justify-center">
                <span className="text-2xl sm:text-3xl font-bold text-white tabular-nums">
                  {pad(value)}
                </span>
              </div>
              <span className="text-gray-500 text-xs uppercase tracking-wide">{label}</span>
            </div>
          ))}
        </div>
      ) : (
        <a
          href="https://www.producthunt.com/posts/healthwatch-global"
          target="_blank"
          rel="noopener noreferrer"
          className="text-2xl font-bold text-[#ff6154] mb-12 hover:underline"
        >
          🎉 We&apos;re live on Product Hunt →
        </a>
      )}

      {/* CTAs */}
      <div className="flex flex-col sm:flex-row items-center gap-4">
        <Link
          href={`/${locale}?demo=1`}
          className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold px-6 py-3 rounded-xl transition-colors text-sm"
        >
          {c.demoBtn}
        </Link>

        <a
          href="https://www.producthunt.com/products/healthwatch-global"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2.5 bg-[#ff6154] hover:bg-[#e5544a] text-white font-semibold px-6 py-3 rounded-xl transition-colors text-sm"
        >
          <svg viewBox="0 0 26 26" className="w-4 h-4 fill-current" aria-hidden="true">
            <path d="M13 0C5.82 0 0 5.82 0 13s5.82 13 13 13 13-5.82 13-13S20.18 0 13 0zm3.25 14.95h-2.6V18H11.7v-3.05H9.1V11.7h2.6V8.65h1.95v3.05h2.6v3.25z" />
          </svg>
          {c.phBtn}
        </a>
      </div>

      <p className="text-gray-600 text-xs mt-4">{c.phNote}</p>
    </div>
  );
}
