"use client";

import { useState, useRef, useEffect } from "react";
import { Share2, MessageCircle, Link as LinkIcon, Check, FileText, ExternalLink } from "lucide-react";

// Twitter/X SVG (not in lucide-react)
const XIcon = () => (
  <svg className="w-4 h-4 text-sky-400 shrink-0" viewBox="0 0 24 24" fill="currentColor">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.737-8.857L1.254 2.25H8.08l4.259 5.63 5.905-5.63zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

// LinkedIn SVG
const LinkedInIcon = () => (
  <svg className="w-4 h-4 text-blue-400 shrink-0" viewBox="0 0 24 24" fill="currentColor">
    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
  </svg>
);

interface Props {
  disease:    string;
  country:    string;
  cases:      number;
  deaths?:    number;
  riskLevel:  string;
  locale:     string;
  outbreakId?: string;
  pageUrl?:   string;
  compact?:    boolean;
  updatedAt?:  string;
  reportDate?: string;
}

const RISK_EMOJI: Record<string, string> = {
  high:   "🔴",
  medium: "🟡",
  low:    "🟢",
};

function relativeTime(iso: string, locale: string): string {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  const lb = ({
    en: { m: (n: number) => `${n}m ago`,        h: (n: number) => `${n}h ago`,      d: (n: number) => `${n}d ago`      },
    fr: { m: (n: number) => `il y a ${n} min`,  h: (n: number) => `il y a ${n}h`,   d: (n: number) => `il y a ${n}j`   },
    es: { m: (n: number) => `hace ${n} min`,     h: (n: number) => `hace ${n}h`,     d: (n: number) => `hace ${n}d`     },
    ar: { m: (n: number) => `منذ ${n} دق`,       h: (n: number) => `منذ ${n}س`,      d: (n: number) => `منذ ${n}ي`      },
    id: { m: (n: number) => `${n} mnt lalu`,     h: (n: number) => `${n}j lalu`,     d: (n: number) => `${n}h lalu`    },
  } as Record<string, { m: (n: number) => string; h: (n: number) => string; d: (n: number) => string }>)[locale] ?? { m: (n) => `${n}m ago`, h: (n) => `${n}h ago`, d: (n) => `${n}d ago` };
  if (mins < 60) return lb.m(mins);
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return lb.h(hrs);
  return lb.d(Math.floor(hrs / 24));
}

const RISK_LABEL: Record<string, Record<string, string>> = {
  en: { high: "HIGH",    medium: "MEDIUM",  low: "LOW"    },
  fr: { high: "ÉLEVÉ",   medium: "MODÉRÉ",  low: "FAIBLE" },
  es: { high: "ALTO",    medium: "MEDIO",   low: "BAJO"   },
  ar: { high: "مرتفع",   medium: "متوسط",   low: "منخفض"  },
  id: { high: "TINGGI",  medium: "SEDANG",  low: "RENDAH" },
};

const SHARE_COPY: Record<string, {
  tweet:        (disease: string, country: string, cases: number, deaths: number | undefined, risk: string) => string;
  report:       (disease: string, country: string, cases: number, deaths: number | undefined, risk: string, lastSync: string, url: string, reportDate?: string) => string;
  copied:       string;
  copiedReport: string;
  copyLink:     string;
  copyReport:   string;
  shareLabel:   string;
  cardImage:    string;
}> = {
  fr: {
    tweet: (d, c, n, deaths, r) => {
      const cfr = (deaths && n > 0) ? ` · ${deaths} décès · létalité ${(deaths / n * 100).toFixed(1)}%` : "";
      return `${RISK_EMOJI[r] ?? "⚠️"} Foyer OMS : ${d} en ${c} — ${n.toLocaleString("fr")} cas${cfr}. Suivi en temps réel sur HealthWatch Global.`;
    },
    report: (d, c, n, deaths, r, lastSync, url, reportDate) => {
      const risk = RISK_LABEL.fr[r] ?? r.toUpperCase();
      const asOf = reportDate ? ` (au ${reportDate})` : "";
      const caseLine = (deaths && n > 0)
        ? `Cas${asOf} : ${n.toLocaleString("fr")} | Décès : ${deaths} | Létalité : ${(deaths / n * 100).toFixed(1)}%`
        : `Cas${asOf} : ${n.toLocaleString("fr")}`;
      const syncLine = lastSync ? `\nSource : OMS DON | Dernière MAJ : ${lastSync}` : `\nSource : OMS DON`;
      return `[HealthWatch Global — Rapport de situation]\nMaladie : ${d} | Pays : ${c} | Risque : ${risk}\n${caseLine}${syncLine}\nFiche complète : ${url}`;
    },
    copied:       "Lien copié !",
    copiedReport: "Rapport copié !",
    copyLink:     "Copier le lien",
    copyReport:   "Copier pour rapport",
    shareLabel:   "Partager",
    cardImage:    "Image de carte (PNG)",
  },
  en: {
    tweet: (d, c, n, deaths, r) => {
      const cfr = (deaths && n > 0) ? ` · ${deaths} deaths · CFR ${(deaths / n * 100).toFixed(1)}%` : "";
      return `${RISK_EMOJI[r] ?? "⚠️"} WHO outbreak: ${d} in ${c} — ${n.toLocaleString("en")} cases${cfr}. Live on HealthWatch Global.`;
    },
    report: (d, c, n, deaths, r, lastSync, url, reportDate) => {
      const risk = RISK_LABEL.en[r] ?? r.toUpperCase();
      const asOf = reportDate ? ` (as of ${reportDate})` : "";
      const caseLine = (deaths && n > 0)
        ? `Cases${asOf}: ${n.toLocaleString("en")} | Deaths: ${deaths} | CFR: ${(deaths / n * 100).toFixed(1)}%`
        : `Cases${asOf}: ${n.toLocaleString("en")}`;
      const syncLine = lastSync ? `\nSource: WHO DON | Last updated: ${lastSync}` : `\nSource: WHO DON`;
      return `[HealthWatch Global — Situation Report]\nDisease: ${d} | Country: ${c} | Risk: ${risk}\n${caseLine}${syncLine}\nFull brief: ${url}`;
    },
    copied:       "Link copied!",
    copiedReport: "Report copied!",
    copyLink:     "Copy link",
    copyReport:   "Copy for report",
    shareLabel:   "Share",
    cardImage:    "Card image (PNG)",
  },
  es: {
    tweet: (d, c, n, deaths, r) => {
      const cfr = (deaths && n > 0) ? ` · ${deaths} fallecidos · letalidad ${(deaths / n * 100).toFixed(1)}%` : "";
      return `${RISK_EMOJI[r] ?? "⚠️"} Brote OMS: ${d} en ${c} — ${n.toLocaleString("es")} casos${cfr}. Seguimiento en tiempo real en HealthWatch Global.`;
    },
    report: (d, c, n, deaths, r, lastSync, url, reportDate) => {
      const risk = RISK_LABEL.es[r] ?? r.toUpperCase();
      const asOf = reportDate ? ` (al ${reportDate})` : "";
      const caseLine = (deaths && n > 0)
        ? `Casos${asOf}: ${n.toLocaleString("es")} | Fallecidos: ${deaths} | Letalidad: ${(deaths / n * 100).toFixed(1)}%`
        : `Casos${asOf}: ${n.toLocaleString("es")}`;
      const syncLine = lastSync ? `\nFuente: OMS DON | Última actualización: ${lastSync}` : `\nFuente: OMS DON`;
      return `[HealthWatch Global — Informe de situación]\nEnfermedad: ${d} | País: ${c} | Riesgo: ${risk}\n${caseLine}${syncLine}\nInforme completo: ${url}`;
    },
    copied:       "¡Enlace copiado!",
    copiedReport: "¡Informe copiado!",
    copyLink:     "Copiar enlace",
    copyReport:   "Copiar para informe",
    shareLabel:   "Compartir",
    cardImage:    "Imagen de tarjeta (PNG)",
  },
  ar: {
    tweet: (d, c, n, deaths, r) => {
      const cfr = (deaths && n > 0) ? ` · ${deaths} وفاة · معدل الوفيات ${(deaths / n * 100).toFixed(1)}%` : "";
      return `${RISK_EMOJI[r] ?? "⚠️"} تفشٍّ OMS: ${d} في ${c} — ${n.toLocaleString("ar-SA")} حالة${cfr}. متابعة مباشرة على HealthWatch Global.`;
    },
    report: (d, c, n, deaths, r, lastSync, url, reportDate) => {
      const risk = RISK_LABEL.ar[r] ?? r;
      const asOf = reportDate ? ` (بتاريخ ${reportDate})` : "";
      const caseLine = (deaths && n > 0)
        ? `الحالات${asOf}: ${n.toLocaleString("ar-SA")} | الوفيات: ${deaths} | معدل الوفيات: ${(deaths / n * 100).toFixed(1)}%`
        : `الحالات${asOf}: ${n.toLocaleString("ar-SA")}`;
      const syncLine = lastSync ? `\nالمصدر: WHO DON | آخر تحديث: ${lastSync}` : `\nالمصدر: WHO DON`;
      return `[HealthWatch Global — تقرير الوضع الوبائي]\nالمرض: ${d} | البلد: ${c} | المخاطر: ${risk}\n${caseLine}${syncLine}\nالتقرير الكامل: ${url}`;
    },
    copied:       "تم نسخ الرابط!",
    copiedReport: "تم نسخ التقرير!",
    copyLink:     "نسخ الرابط",
    copyReport:   "نسخ للتقرير",
    shareLabel:   "مشاركة",
    cardImage:    "صورة البطاقة (PNG)",
  },
  id: {
    tweet: (d, c, n, deaths, r) => {
      const cfr = (deaths && n > 0) ? ` · ${deaths} kematian · CFR ${(deaths / n * 100).toFixed(1)}%` : "";
      return `${RISK_EMOJI[r] ?? "⚠️"} Wabah WHO: ${d} di ${c} — ${n.toLocaleString("id")} kasus${cfr}. Dipantau langsung di HealthWatch Global.`;
    },
    report: (d, c, n, deaths, r, lastSync, url, reportDate) => {
      const risk = RISK_LABEL.id[r] ?? r.toUpperCase();
      const asOf = reportDate ? ` (per ${reportDate})` : "";
      const caseLine = (deaths && n > 0)
        ? `Kasus${asOf}: ${n.toLocaleString("id")} | Kematian: ${deaths} | CFR: ${(deaths / n * 100).toFixed(1)}%`
        : `Kasus${asOf}: ${n.toLocaleString("id")}`;
      const syncLine = lastSync ? `\nSumber: WHO DON | Diperbarui: ${lastSync}` : `\nSumber: WHO DON`;
      return `[HealthWatch Global — Laporan Situasi]\nPenyakit: ${d} | Negara: ${c} | Risiko: ${risk}\n${caseLine}${syncLine}\nLaporan lengkap: ${url}`;
    },
    copied:       "Tautan disalin!",
    copiedReport: "Laporan disalin!",
    copyLink:     "Salin tautan",
    copyReport:   "Salin untuk laporan",
    shareLabel:   "Bagikan",
    cardImage:    "Gambar kartu (PNG)",
  },
};

const BASE_URL = "https://healthwatch-global.com";

export default function ShareOutbreakButton({ disease, country, cases, deaths, riskLevel, locale, outbreakId, pageUrl: pageUrlProp, compact = true, updatedAt, reportDate }: Props) {
  const [open,         setOpen]         = useState(false);
  const [copied,       setCopied]       = useState(false);
  const [copiedReport, setCopiedReport] = useState(false);
  const [canShare,     setCanShare]     = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const c   = SHARE_COPY[locale] ?? SHARE_COPY.en;

  const text    = c.tweet(disease, country, cases, deaths, riskLevel);
  const pageUrl = pageUrlProp
    ?? (outbreakId ? `${BASE_URL}/${locale}/outbreak/${outbreakId}` : `${BASE_URL}/${locale}`);
  const lastSync   = updatedAt ? relativeTime(updatedAt, locale) : "";
  const reportText = c.report(disease, country, cases, deaths, riskLevel, lastSync, pageUrl, reportDate);
  const encoded = encodeURIComponent(text);
  const encodedUrl = encodeURIComponent(pageUrl);

  const twitterUrl  = `https://twitter.com/intent/tweet?text=${encoded}&url=${encodedUrl}`;
  const linkedinUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}&summary=${encoded}`;
  const whatsappUrl = `https://wa.me/?text=${encoded}%20${encodedUrl}`;

  // Detect Web Share API (available on mobile browsers)
  useEffect(() => {
    setCanShare(typeof navigator.share === "function");
  }, []);

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  async function nativeShare() {
    try {
      await navigator.share({ title: `${disease} — ${country}`, text, url: pageUrl });
    } catch {
      // user cancelled — no-op
    }
  }

  async function copyLink() {
    await navigator.clipboard.writeText(`${text}\n${pageUrl}`);
    setCopied(true);
    setTimeout(() => { setCopied(false); setOpen(false); }, 1500);
  }

  async function copyReport() {
    await navigator.clipboard.writeText(reportText);
    setCopiedReport(true);
    setTimeout(() => { setCopiedReport(false); setOpen(false); }, 1500);
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => canShare ? nativeShare() : setOpen(!open)}
        title="Partager"
        className={compact
          ? "p-1.5 rounded hover:bg-gray-700 text-gray-500 hover:text-gray-300 transition-colors"
          : "inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-700 hover:border-gray-500 bg-gray-800/60 hover:bg-gray-700 text-gray-300 hover:text-white text-xs font-medium transition-colors"
        }
        aria-label="Share outbreak"
      >
        <Share2 className={compact ? "w-3.5 h-3.5" : "w-3.5 h-3.5 shrink-0"} />
        {!compact && <span>{c.shareLabel}</span>}
      </button>

      {open && (
        <div className="absolute right-0 top-8 z-50 bg-gray-800 border border-gray-700 rounded-xl shadow-2xl p-2 w-44 space-y-0.5">
          {/* Twitter / X */}
          <a
            href={twitterUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-gray-700 text-gray-300 hover:text-white transition-colors text-sm"
            onClick={() => setOpen(false)}
          >
            <XIcon />
            Twitter / X
          </a>

          {/* LinkedIn */}
          <a
            href={linkedinUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-gray-700 text-gray-300 hover:text-white transition-colors text-sm"
            onClick={() => setOpen(false)}
          >
            <LinkedInIcon />
            LinkedIn
          </a>

          {/* WhatsApp */}
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-gray-700 text-gray-300 hover:text-white transition-colors text-sm"
            onClick={() => setOpen(false)}
          >
            <MessageCircle className="w-4 h-4 text-green-400 shrink-0" />
            WhatsApp
          </a>

          {/* Copy link */}
          <button
            onClick={copyLink}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-gray-700 text-gray-300 hover:text-white transition-colors text-sm"
          >
            {copied
              ? <Check className="w-4 h-4 text-green-400 shrink-0" />
              : <LinkIcon className="w-4 h-4 text-gray-400 shrink-0" />
            }
            {copied ? c.copied : c.copyLink}
          </button>

          {/* Copy for report */}
          <button
            onClick={copyReport}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-gray-700 text-gray-300 hover:text-white transition-colors text-sm"
          >
            {copiedReport
              ? <Check className="w-4 h-4 text-green-400 shrink-0" />
              : <FileText className="w-4 h-4 text-gray-400 shrink-0" />
            }
            {copiedReport ? c.copiedReport : c.copyReport}
          </button>

          {/* Card image — only shown when outbreakId is available */}
          {outbreakId && (
            <a
              href={`${BASE_URL}/api/outbreak-card/${outbreakId}?locale=${locale}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-gray-700 text-gray-300 hover:text-white transition-colors text-sm"
              onClick={() => setOpen(false)}
            >
              <ExternalLink className="w-4 h-4 text-gray-400 shrink-0" />
              {c.cardImage}
            </a>
          )}
        </div>
      )}
    </div>
  );
}
