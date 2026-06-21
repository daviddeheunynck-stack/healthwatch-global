import Link from "next/link";
import { TrendingUp } from "lucide-react";
import { computeRiskScore, getLocalizedDisease, getLocalizedCountry } from "@/lib/outbreaks";
import type { Outbreak } from "@/lib/outbreaks";
import type { OutbreakTrend } from "@/lib/outbreak-trend";

const COPY: Record<string, {
  title: string;
  sub: string;
  newLabel: string;
  worseningLabel: string;
}> = {
  en: { title: "New this week",         sub: "Outbreaks added or worsening in the last 7 days",          newLabel: "NEW",     worseningLabel: "WORSENING" },
  fr: { title: "Nouveautés cette semaine", sub: "Foyers apparus ou aggravés ces 7 derniers jours",        newLabel: "NOUVEAU", worseningLabel: "EN HAUSSE" },
  es: { title: "Novedades esta semana",  sub: "Brotes nuevos o que empeoran en los últimos 7 días",       newLabel: "NUEVO",   worseningLabel: "EMPEORANDO" },
  ar: { title: "جديد هذا الأسبوع",      sub: "تفشيات جديدة أو متصاعدة خلال الأيام السبعة الماضية",      newLabel: "جديد",    worseningLabel: "تصاعد" },
  id: { title: "Baru minggu ini",        sub: "Wabah baru atau yang memburuk dalam 7 hari terakhir",      newLabel: "BARU",    worseningLabel: "MEMBURUK" },
};

interface Props {
  outbreaks: Outbreak[];
  locale: string;
  trends: Record<string, OutbreakTrend>;
}

export default function NewThisWeekWidget({ outbreaks, locale, trends }: Props) {
  const c = COPY[locale] ?? COPY.en;
  const isRtl = locale === "ar";
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const relevant = outbreaks
    .map((o) => {
      const trend = trends[o.id];
      const isNew = o.created_at ? new Date(o.created_at) >= sevenDaysAgo : false;
      const isWorsening = trend?.direction === "up";
      return { o, trend, isNew, isWorsening, score: computeRiskScore(o, trend) };
    })
    .filter(({ isNew, isWorsening }) => isNew || isWorsening)
    .sort((a, b) => b.score - a.score)
    .slice(0, 6);

  if (relevant.length === 0) return null;

  return (
    <section className="space-y-3" dir={isRtl ? "rtl" : undefined}>
      <div>
        <h2 className="text-lg font-semibold text-white">{c.title}</h2>
        <p className="text-xs text-gray-500 mt-0.5">{c.sub}</p>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
        {relevant.map(({ o, isNew, isWorsening, score }) => {
          const borderBg =
            o.risk_level === "high"   ? "border-red-800/40 bg-red-950/15 hover:border-red-700/60" :
            o.risk_level === "medium" ? "border-yellow-800/40 bg-yellow-950/10 hover:border-yellow-700/50" :
                                        "border-gray-700/60 bg-gray-900/40 hover:border-gray-600";
          const scoreCls =
            score >= 8 ? "bg-red-900/50 border-red-700/60 text-red-300" :
            score >= 5 ? "bg-orange-900/40 border-orange-700/50 text-orange-300" :
                         "bg-yellow-900/30 border-yellow-700/40 text-yellow-400";

          return (
            <Link
              key={o.id}
              href={`/${locale}/outbreak/${o.id}`}
              className={`flex items-start gap-3 rounded-xl border p-3.5 transition-colors ${borderBg}`}
            >
              <div className={`shrink-0 w-8 h-8 rounded-lg border flex items-center justify-center text-xs font-bold tabular-nums ${scoreCls}`}>
                {score}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                  <span className="text-sm font-semibold text-white truncate">
                    {getLocalizedDisease(o, locale)}
                  </span>
                  {isNew && (
                    <span className="inline-flex text-[10px] font-bold px-1.5 py-0.5 rounded bg-green-900/50 border border-green-700/50 text-green-300 shrink-0 animate-pulse">
                      {c.newLabel}
                    </span>
                  )}
                  {isWorsening && (
                    <span className="inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-900/40 border border-red-700/40 text-red-300 shrink-0">
                      <TrendingUp className="w-2.5 h-2.5" aria-hidden />
                      {c.worseningLabel}
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-400 truncate">{getLocalizedCountry(o, locale)}</p>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
