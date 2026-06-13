"use client";

import { useState, useRef, useEffect } from "react";
import { Share2, MessageCircle, Link as LinkIcon, Check } from "lucide-react";

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
  riskLevel:  string;
  locale:     string;
  outbreakId?: string;
}

const RISK_EMOJI: Record<string, string> = {
  high:   "🔴",
  medium: "🟡",
  low:    "🟢",
};

const SHARE_COPY: Record<string, {
  tweet:    (disease: string, country: string, cases: number, risk: string) => string;
  copied:   string;
  copyLink: string;
}> = {
  fr: {
    tweet: (d, c, n, r) =>
      `${RISK_EMOJI[r] ?? "⚠️"} Foyer OMS : ${d} en ${c} — ${n.toLocaleString()} cas confirmés. Suivi quotidien sur HealthWatch Global.`,
    copied:   "Lien copié !",
    copyLink: "Copier le lien",
  },
  en: {
    tweet: (d, c, n, r) =>
      `${RISK_EMOJI[r] ?? "⚠️"} WHO outbreak: ${d} in ${c} — ${n.toLocaleString()} confirmed cases. Tracked daily on HealthWatch Global.`,
    copied:   "Link copied!",
    copyLink: "Copy link",
  },
  es: {
    tweet: (d, c, n, r) =>
      `${RISK_EMOJI[r] ?? "⚠️"} Brote OMS: ${d} en ${c} — ${n.toLocaleString()} casos confirmados. Seguimiento diario en HealthWatch Global.`,
    copied:   "¡Enlace copiado!",
    copyLink: "Copiar enlace",
  },
  ar: {
    tweet: (d, c, n, r) =>
      `${RISK_EMOJI[r] ?? "⚠️"} تفشٍّ OMS: ${d} في ${c} — ${n.toLocaleString()} حالة مؤكدة. متابعة فورية على HealthWatch Global.`,
    copied:   "تم نسخ الرابط!",
    copyLink: "نسخ الرابط",
  },
  id: {
    tweet: (d, c, n, r) =>
      `${RISK_EMOJI[r] ?? "⚠️"} Wabah WHO: ${d} di ${c} — ${n.toLocaleString()} kasus terkonfirmasi. Dipantau harian di HealthWatch Global.`,
    copied:   "Tautan disalin!",
    copyLink: "Salin tautan",
  },
};

const BASE_URL = "https://healthwatch-global.com";

export default function ShareOutbreakButton({ disease, country, cases, riskLevel, locale, outbreakId }: Props) {
  const [open,   setOpen]   = useState(false);
  const [copied, setCopied] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const c   = SHARE_COPY[locale] ?? SHARE_COPY.en;

  const text    = c.tweet(disease, country, cases, riskLevel);
  const pageUrl = outbreakId
    ? `${BASE_URL}/${locale}/outbreak/${outbreakId}`
    : `${BASE_URL}/${locale}`;
  const encoded = encodeURIComponent(text);
  const encodedUrl = encodeURIComponent(pageUrl);

  const twitterUrl  = `https://twitter.com/intent/tweet?text=${encoded}&url=${encodedUrl}`;
  const linkedinUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}&summary=${encoded}`;
  const whatsappUrl = `https://wa.me/?text=${encoded}%20${encodedUrl}`;

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  async function copyLink() {
    await navigator.clipboard.writeText(`${text}\n${pageUrl}`);
    setCopied(true);
    setTimeout(() => { setCopied(false); setOpen(false); }, 1500);
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        title="Partager"
        className="p-1.5 rounded hover:bg-gray-700 text-gray-500 hover:text-gray-300 transition-colors"
        aria-label="Share outbreak"
      >
        <Share2 className="w-3.5 h-3.5" />
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
        </div>
      )}
    </div>
  );
}
