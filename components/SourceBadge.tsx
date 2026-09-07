// Provenance chip for the PUBLIC listing pages (country / disease / region).
//
// Why this exists (2026-09-07): sourceStatusOf() has sorted every row into
// don / official / press / unverified since 2026-08-12, and OutbreakTable renders all four
// as coloured chips — but only behind the login. On the three SEO page families, which is
// where search traffic lands, the publisher never left the database at all: neither the
// country page nor the region page even selected the `source` column. A row backed by a
// news article and a row backed by an ECDC bulletin rendered identically, under a banner
// repeating "WHO, ECDC, PAHO, Africa CDC".
//
// Asked for by ETIENNE GUENOU (Laboratoire National de Santé Publique, Cameroon) on
// 2026-08-20 — see marketing/product-feedback.md, 4th action item: "exposer le niveau de
// source dans l'interface (institutionnel / national / presse)".
//
// Deliberately NOT a link, unlike the dashboard's version: these cards are already covered
// edge-to-edge by an absolutely-positioned <Link> to the outbreak permalink, and nesting an
// anchor inside it is invalid HTML. The permalink one click away carries the outbound
// "Source : … ↗" link.
//
// Wording is copied verbatim from FILTER_COPY in app/[locale]/(dashboard)/page.tsx so the
// same row cannot be described one way in public and another way once signed in.

import { sourceStatusOf, sourceName } from "@/lib/source-trust";

type Copy = {
  srcPrefix: string;
  unverifiedBadge: string;
  unverifiedTooltip: string;
  officialTooltip: string;
  pressTooltip: string;
  donBadge: string;
  donTooltip: string;
};

const COPY: Record<string, Copy> = {
  en: {
    srcPrefix: "Source:",
    unverifiedBadge: "UNVERIFIED",
    unverifiedTooltip: "Unverified placeholder figures — not yet matched to a confirmed WHO/official report. Treat with caution.",
    officialTooltip: "Confirmed official source (WHO situation report, ECDC, or national Ministry of Health) — no WHO DON reference number.",
    pressTooltip: "General news outlet — a media report, not a health-authority bulletin. Cross-check against an official source before operational use.",
    donBadge: "WHO DON",
    donTooltip: "WHO Disease Outbreak News — officially citable WHO bulletin with a unique DON reference number.",
  },
  fr: {
    srcPrefix: "Source :",
    unverifiedBadge: "NON VÉRIFIÉ",
    unverifiedTooltip: "Chiffres provisoires non vérifiés — pas encore rattachés à un rapport OMS/officiel confirmé. À utiliser avec précaution.",
    officialTooltip: "Source officielle confirmée (rapport OMS, ECDC ou ministère de la santé) — sans numéro de bulletin DON.",
    pressTooltip: "Presse généraliste — information rapportée par un média, pas un bulletin d'agence sanitaire. À recouper avec une source officielle avant tout usage opérationnel.",
    donBadge: "WHO DON",
    donTooltip: "Bulletin officiel OMS Disease Outbreak News — source citable avec numéro de référence DON unique.",
  },
  es: {
    srcPrefix: "Fuente:",
    unverifiedBadge: "NO VERIFICADO",
    unverifiedTooltip: "Cifras provisionales no verificadas — aún no vinculadas a un informe oficial/OMS confirmado. Usar con precaución.",
    officialTooltip: "Fuente oficial confirmada (informe OMS, ECDC o ministerio de salud) — sin número de boletín DON.",
    pressTooltip: "Prensa generalista — información publicada por un medio, no un boletín de una agencia sanitaria. Verifíquela con una fuente oficial antes de usarla operativamente.",
    donBadge: "WHO DON",
    donTooltip: "Boletín oficial OMS Disease Outbreak News — fuente citable con número de referencia DON único.",
  },
  ar: {
    srcPrefix: "المصدر:",
    unverifiedBadge: "غير مؤكد",
    unverifiedTooltip: "أرقام تجريبية غير مؤكدة — لم تُربط بعد بتقرير رسمي مؤكد لمنظمة الصحة العالمية. يُرجى التعامل معها بحذر.",
    officialTooltip: "مصدر رسمي مؤكد (تقرير منظمة الصحة العالمية أو المركز الأوروبي أو وزارة الصحة) — بدون رقم نشرة DON.",
    pressTooltip: "مصدر صحفي عام — خبر نشره منبر إعلامي، وليس نشرة صادرة عن وكالة صحية. يجب التحقق منه من مصدر رسمي قبل أي استخدام تنفيذي.",
    donBadge: "WHO DON",
    donTooltip: "نشرة أخبار تفشي الأمراض الرسمية لمنظمة الصحة العالمية — مصدر قابل للاستشهاد برقم مرجعي DON فريد.",
  },
  id: {
    srcPrefix: "Sumber:",
    unverifiedBadge: "BELUM DIVERIFIKASI",
    unverifiedTooltip: "Angka sementara yang belum diverifikasi — belum dikaitkan dengan laporan resmi/WHO yang terkonfirmasi. Gunakan dengan hati-hati.",
    officialTooltip: "Sumber resmi yang dikonfirmasi (laporan WHO, ECDC, atau Kementerian Kesehatan) — tanpa nomor buletin DON WHO.",
    pressTooltip: "Media pers umum — laporan media, bukan buletin badan kesehatan. Verifikasi dengan sumber resmi sebelum digunakan secara operasional.",
    donBadge: "WHO DON",
    donTooltip: "Buletin resmi WHO Disease Outbreak News — sumber yang dapat dikutip dengan nomor referensi DON unik.",
  },
};

const STYLE: Record<string, string> = {
  don:        "bg-blue-900/30 border-blue-700/50 text-blue-400",
  official:   "bg-amber-900/30 border-amber-700/50 text-amber-400",
  press:      "bg-violet-900/30 border-violet-700/50 text-violet-400",
  unverified: "bg-gray-800 border-gray-600 text-gray-400",
};

export default function SourceBadge({
  source,
  locale,
  className = "",
}: {
  source: string | null | undefined;
  locale: string;
  className?: string;
}) {
  const c = COPY[locale] ?? COPY.en;
  const status = sourceStatusOf(source);

  const label =
    status === "don" ? c.donBadge :
    status === "unverified" ? c.unverifiedBadge :
    sourceName(source);
  if (!label) return null;

  const tooltip =
    status === "don" ? c.donTooltip :
    status === "official" ? c.officialTooltip :
    status === "press" ? c.pressTooltip :
    c.unverifiedTooltip;

  return (
    <span
      title={tooltip}
      aria-label={`${c.srcPrefix} ${label}`}
      className={`inline-flex items-center text-[10px] font-bold px-1.5 py-0.5 rounded border shrink-0 cursor-help whitespace-nowrap ${STYLE[status] ?? STYLE.unverified} ${className}`}
    >
      {label}
    </span>
  );
}
