"use client";

import dynamic from "next/dynamic";
import { Activity } from "lucide-react";
import Link from "next/link";
import type { Outbreak } from "@/lib/outbreaks";

const LandingMapLeaflet = dynamic(() => import("./LandingMapLeaflet"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[300px] sm:h-[400px] rounded-xl bg-gray-900 border border-gray-800 animate-pulse" />
  ),
});

const MAP_COPY: Record<string, { title: string; sub: string; legend: { h: string; m: string; l: string }; cta: string }> = {
  en: {
    title: "Active outbreaks, mapped in real time",
    sub: "Every dot is a confirmed outbreak from WHO, ECDC, PAHO or Africa CDC.",
    legend: { h: "High risk", m: "Medium", l: "Low" },
    cta: "Explore the dashboard →",
  },
  fr: {
    title: "Foyers actifs, cartographiés en temps réel",
    sub: "Chaque point est un foyer confirmé par l'OMS, l'ECDC, l'OPAS ou l'Africa CDC.",
    legend: { h: "Risque élevé", m: "Modéré", l: "Faible" },
    cta: "Explorer le tableau de bord →",
  },
  es: {
    title: "Brotes activos, cartografiados en tiempo real",
    sub: "Cada punto es un brote confirmado por la OMS, ECDC, PAHO o Africa CDC.",
    legend: { h: "Riesgo alto", m: "Moderado", l: "Bajo" },
    cta: "Explorar el panel →",
  },
  ar: {
    title: "التفشيات النشطة على الخريطة في الوقت الفعلي",
    sub: "كل نقطة تمثل تفشياً مؤكداً من WHO أو ECDC أو PAHO أو Africa CDC.",
    legend: { h: "خطر عالٍ", m: "متوسط", l: "منخفض" },
    cta: "← استكشف لوحة التحكم",
  },
  id: {
    title: "Wabah aktif, dipetakan secara real-time",
    sub: "Setiap titik adalah wabah yang dikonfirmasi oleh WHO, ECDC, PAHO atau Africa CDC.",
    legend: { h: "Risiko tinggi", m: "Sedang", l: "Rendah" },
    cta: "Jelajahi dasbor →",
  },
};

interface Props {
  outbreaks: Outbreak[];
  locale: string;
}

export default function LandingMapSection({ outbreaks, locale }: Props) {
  const copy = MAP_COPY[locale] ?? MAP_COPY.en;
  const isRtl = locale === "ar";

  // Only outbreaks that have coordinates
  const mappable = outbreaks.filter((o) => o.lat && o.lng);

  return (
    <section className="space-y-5" dir={isRtl ? "rtl" : undefined}>
      <div className="text-center space-y-2">
        <div className="inline-flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-full px-3 py-1 text-xs text-red-400 font-medium">
          <Activity className="w-3.5 h-3.5" />
          <span>{mappable.length} active</span>
        </div>
        <h2 className="text-2xl md:text-3xl font-bold text-white">{copy.title}</h2>
        <p className="text-gray-400 text-sm max-w-xl mx-auto">{copy.sub}</p>
      </div>

      <div className="relative isolate">
        <LandingMapLeaflet outbreaks={mappable} locale={locale} />

        {/* Legend overlay */}
        <div className={`absolute bottom-4 ${isRtl ? "right-4" : "left-4"} flex gap-3 bg-gray-900/90 backdrop-blur-sm rounded-lg px-3 py-2 text-xs border border-gray-700/50`}>
          {[
            { color: "#ef4444", label: copy.legend.h },
            { color: "#f59e0b", label: copy.legend.m },
            { color: "#22c55e", label: copy.legend.l },
          ].map(({ color, label }) => (
            <span key={label} className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
              <span className="text-gray-300">{label}</span>
            </span>
          ))}
        </div>

        {/* CTA overlay */}
        <Link
          href={`/${locale}/signup`}
          className={`absolute top-4 ${isRtl ? "left-4" : "right-4"} bg-red-600/90 hover:bg-red-500 backdrop-blur-sm text-white text-xs font-semibold px-3 py-2 rounded-lg transition-colors shadow-lg`}
        >
          {copy.cta}
        </Link>
      </div>
    </section>
  );
}
