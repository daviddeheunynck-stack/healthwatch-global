"use client";

import { useState, useEffect } from "react";
import { useLocale } from "next-intl";
import { getLocalizedDisease, getLocalizedCountry } from "@/lib/outbreaks";
import { getIncidenceRate } from "@/lib/population-data";
import RiskBadge from "@/components/RiskBadge";
import LockedUpgradeButton from "@/components/LockedUpgradeButton";
import { useUpgradeModal } from "@/lib/upgrade-modal-context";
import { ArrowLeftRight, TrendingUp, Users, Skull, Activity, Globe, Calendar, AlertTriangle, Link as LinkIcon, Check, Lock } from "lucide-react";

// Shape returned by /api/compare-outbreaks — cases/deaths/masked_cfr_pct are
// already masked (or not) server-side per viewer plan, see that route.
interface CompareOutbreak {
  id: string;
  disease: string; disease_en: string | null; disease_ar: string | null;
  country: string; country_en: string | null; country_ar: string | null;
  region: string;
  risk_level: "high" | "medium" | "low";
  is_pheic: boolean;
  date: string;
  cases: number;
  deaths: number | null;
  masked_cfr_pct: number | null;
  is_free_featured: boolean;
}

const LABELS: Record<string, {
  title: string; subtitle: string; selectA: string; selectB: string;
  all: string; cases: string; deaths: string; cfr: string; incidence: string;
  date: string; region: string; pheic: string;
  winner: string; lower: string; selectBoth: string; share: string; copied: string;
  lockedCta: string; lockedBanner: string;
}> = {
  fr: { title: "Comparer des foyers", subtitle: "Analysez deux épidémies côte à côte", selectA: "Foyer A", selectB: "Foyer B", all: "Choisir un foyer…", cases: "Cas", deaths: "Décès", cfr: "Létalité", incidence: "Incidence / 100 000", date: "Date", region: "Région", pheic: "PHEIC", winner: "↓ Moins", lower: "↑ Plus", selectBoth: "Sélectionnez deux foyers pour comparer.", share: "Partager", copied: "Copié !", lockedCta: "Débloquer Pro →", lockedBanner: "Cas confirmés · Décès · Létalité · Incidence pour 100 000 habitants" },
  en: { title: "Compare outbreaks", subtitle: "Analyse two epidemics side by side", selectA: "Outbreak A", selectB: "Outbreak B", all: "Choose an outbreak…", cases: "Cases", deaths: "Deaths", cfr: "CFR", incidence: "Incidence / 100,000", date: "Date", region: "Region", pheic: "PHEIC", winner: "↓ Lower", lower: "↑ Higher", selectBoth: "Select two outbreaks to compare.", share: "Share", copied: "Copied!", lockedCta: "Unlock Pro →", lockedBanner: "Confirmed cases · Deaths · Fatality rate · Incidence per 100,000" },
  es: { title: "Comparar brotes", subtitle: "Analice dos epidemias lado a lado", selectA: "Brote A", selectB: "Brote B", all: "Elige un brote…", cases: "Casos", deaths: "Muertes", cfr: "Letalidad", incidence: "Incidencia / 100.000", date: "Fecha", region: "Región", pheic: "PHEIC", winner: "↓ Menor", lower: "↑ Mayor", selectBoth: "Seleccione dos brotes para comparar.", share: "Compartir", copied: "¡Copiado!", lockedCta: "Desbloquear Pro →", lockedBanner: "Casos confirmados · Muertes · Letalidad · Incidencia por 100.000" },
  ar: { title: "مقارنة التفشيات", subtitle: "تحليل وباءين جنباً إلى جنب", selectA: "التفشي A", selectB: "التفشي B", all: "اختر تفشياً…", cases: "الحالات", deaths: "الوفيات", cfr: "معدل الوفيات", incidence: "الإصابة / 100,000", date: "التاريخ", region: "المنطقة", pheic: "PHEIC", winner: "↓ أقل", lower: "↑ أكثر", selectBoth: "اختر تفشيين للمقارنة.", share: "مشاركة", copied: "تم النسخ!", lockedCta: "← فتح Pro", lockedBanner: "الحالات المؤكدة · الوفيات · معدل الفتك · معدل الإصابة لكل 100,000" },
  id: { title: "Bandingkan Wabah", subtitle: "Analisis dua epidemi secara berdampingan", selectA: "Wabah A", selectB: "Wabah B", all: "Pilih wabah…", cases: "Kasus", deaths: "Kematian", cfr: "CFR", incidence: "Insidensi / 100.000", date: "Tanggal", region: "Wilayah", pheic: "PHEIC", winner: "↓ Lebih rendah", lower: "↑ Lebih tinggi", selectBoth: "Pilih dua wabah untuk dibandingkan.", share: "Bagikan", copied: "Disalin!", lockedCta: "Buka Pro →", lockedBanner: "Kasus terkonfirmasi · Kematian · Tingkat fatalitas · Insidensi per 100.000" },
};

function StatRow({ label, valA, valB, icon, fmt = (v: number) => v.toLocaleString("en"), higherIsBad = true, lockedA = false, lockedB = false, onLockClick }: {
  label: string; valA: number | null; valB: number | null; icon: React.ReactNode;
  fmt?: (v: number) => string; higherIsBad?: boolean;
  lockedA?: boolean; lockedB?: boolean;
  onLockClick?: () => void;
}) {
  // Only color a winner/loser when both sides are actually visible — a
  // masked row next to a real (featured) one isn't a fair comparison to
  // highlight either way.
  const both = !lockedA && !lockedB && valA !== null && valB !== null && valA > 0 && valB > 0;
  const aWorse = both && (higherIsBad ? valA! > valB! : valA! < valB!);
  const bWorse = both && (higherIsBad ? valB! > valA! : valB! < valA!);

  const cell = (v: number | null, locked: boolean) => {
    if (!v || v <= 0) return "—";
    return locked
      ? <span className="blur-sm select-none cursor-pointer" onClick={onLockClick}>{fmt(v).replace(/\d/g, "•")}</span>
      : fmt(v);
  };

  return (
    <tr className="border-b border-gray-800">
      <td className="px-4 py-3 text-gray-500 text-sm"><div className="flex items-center gap-2">{icon}{label}</div></td>
      <td className={`px-4 py-3 text-center font-bold text-lg ${lockedA ? "text-gray-600" : aWorse ? "text-red-400" : bWorse ? "text-green-400" : "text-white"}`}>
        {cell(valA, lockedA)}
      </td>
      <td className="px-4 py-3 text-center text-gray-600 text-xs">vs</td>
      <td className={`px-4 py-3 text-center font-bold text-lg ${lockedB ? "text-gray-600" : bWorse ? "text-red-400" : aWorse ? "text-green-400" : "text-white"}`}>
        {cell(valB, lockedB)}
      </td>
    </tr>
  );
}

export default function ComparePage() {
  const locale = useLocale();
  const l = LABELS[locale] ?? LABELS.en;
  const isRtl = locale === "ar";
  const { openModal } = useUpgradeModal();

  const [outbreaks, setOutbreaks] = useState<CompareOutbreak[]>([]);
  const [idA, setIdA] = useState("");
  const [idB, setIdB] = useState("");
  const [copied, setCopied] = useState(false);
  const [ready, setReady] = useState(false);
  const [isPaid, setIsPaid] = useState(false);

  // Cases/deaths/CFR (and, by extension, incidence — derived from cases) are
  // paid-only, exactly like the dashboard table — /api/compare-outbreaks
  // does that masking server-side (magnitude-bucketed, one featured disease
  // per continent unlocked) so this component never receives the real
  // figure for a row it isn't allowed to show, unlike the old direct
  // client-side Supabase query this replaced (see that route's comment).
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    fetch("/api/compare-outbreaks")
      .then((r) => r.json())
      .then(({ outbreaks: list, isPaid: paid }: { outbreaks: CompareOutbreak[]; isPaid: boolean }) => {
        setOutbreaks(list ?? []);
        setIsPaid(!!paid);
        // Pre-select from URL or default to top 2 PHEIC/high-risk outbreaks
        const urlA = sp.get("a");
        const urlB = sp.get("b");
        if (urlA) { setIdA(urlA); }
        else if (list.length > 0) {
          const pheic = list.filter(o => o.is_pheic);
          const high  = list.filter(o => o.risk_level === "high");
          const pool  = pheic.length >= 2 ? pheic : [...pheic, ...high.filter(o => !pheic.includes(o))];
          if (pool[0]) setIdA(pool[0].id);
        }
        if (urlB) { setIdB(urlB); }
        else if (list.length > 1) {
          const pheic = list.filter(o => o.is_pheic);
          const high  = list.filter(o => o.risk_level === "high");
          const pool  = pheic.length >= 2 ? pheic : [...pheic, ...high.filter(o => !pheic.includes(o))];
          if (pool[1]) setIdB(pool[1].id);
        }
        // Only flip `ready` once idA/idB hold their *real* selection. Setting
        // it synchronously above (the old code) raced this fetch: the URL-sync
        // effect below would fire first with idA=idB="" and momentarily strip
        // a shared link's `?a=...&b=...` from the address bar before this
        // resolved and corrected it. Also moves the setState out of the effect
        // body and into an async callback, which react-hooks/set-state-in-effect
        // doesn't (and shouldn't) flag — it's reacting to the fetch settling,
        // not deriving state synchronously on every effect run.
        setReady(true);
      });
  }, []);

  useEffect(() => {
    if (!ready) return;
    const p = new URLSearchParams();
    if (idA) p.set("a", idA);
    if (idB) p.set("b", idB);
    window.history.replaceState(null, "", p.toString() ? `?${p}` : window.location.pathname);
  }, [idA, idB, ready]);

  const oA = outbreaks.find(o => o.id === idA) ?? null;
  const oB = outbreaks.find(o => o.id === idB) ?? null;
  // A featured row's cases/deaths are already real (server-side, see
  // /api/compare-outbreaks) — compute CFR from them directly rather than
  // using masked_cfr_pct, which that route only fills in for locked rows.
  const unlockedA = isPaid || (oA?.is_free_featured ?? false);
  const unlockedB = isPaid || (oB?.is_free_featured ?? false);
  const cfrA = oA ? (unlockedA ? (oA.cases > 0 && oA.deaths !== null ? oA.deaths / oA.cases * 100 : null) : oA.masked_cfr_pct) : null;
  const cfrB = oB ? (unlockedB ? (oB.cases > 0 && oB.deaths !== null ? oB.deaths / oB.cases * 100 : null) : oB.masked_cfr_pct) : null;
  const incA = oA ? getIncidenceRate(oA.cases, oA.country_en) : null;
  const incB = oB ? getIncidenceRate(oB.cases, oB.country_en) : null;
  const options = outbreaks
    .map(o => ({ id: o.id, label: `${getLocalizedDisease(o, locale)} — ${getLocalizedCountry(o, locale)}` }))
    .sort((a, b) => a.label.localeCompare(b.label));

  return (
    <div className="space-y-6 max-w-4xl mx-auto" dir={isRtl ? "rtl" : undefined}>
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <ArrowLeftRight className="w-6 h-6 text-red-400" />{l.title}
          </h1>
          <p className="text-gray-400 text-sm mt-1">{l.subtitle}</p>
        </div>
        {oA && oB && (
          <button onClick={async () => { await navigator.clipboard.writeText(window.location.href); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
            className="flex items-center gap-2 text-sm px-4 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 rounded-xl transition-colors">
            {copied ? <Check className="w-4 h-4 text-green-400" /> : <LinkIcon className="w-4 h-4" />}
            {copied ? l.copied : l.share}
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {[{ label: l.selectA, value: idA, set: setIdA, other: idB }, { label: l.selectB, value: idB, set: setIdB, other: idA }].map(({ label, value, set, other }) => (
          <div key={label} className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</label>
            <select value={value} onChange={e => set(e.target.value)}
              className="w-full bg-gray-900 border border-gray-700 text-gray-200 text-sm rounded-xl px-4 py-3 focus:outline-none focus:border-red-500 transition-colors">
              <option value="">{l.all}</option>
              {options.filter(o => o.id !== other).map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
            </select>
          </div>
        ))}
      </div>

      {(!oA || !oB) && (
        <div className="text-center py-16 text-gray-600 text-sm">
          <ArrowLeftRight className="w-12 h-12 mx-auto mb-4 opacity-20" />{l.selectBoth}
        </div>
      )}

      {oA && oB && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="relative bg-blue-900/20 border border-blue-700/30 rounded-2xl p-4 space-y-2 hover:border-blue-500/50 transition-colors">
              <a href={`/${locale}/outbreak/${oA.id}`} className="absolute inset-0 rounded-2xl" aria-label={getLocalizedDisease(oA, locale) ?? ""} />
              <RiskBadge level={oA.risk_level} />
              <h3 className="text-white font-bold text-lg leading-tight">{getLocalizedDisease(oA, locale)}</h3>
              <p className="text-gray-400 text-sm">📍 {getLocalizedCountry(oA, locale)}</p>
              {oA.is_pheic && <span className="text-xs text-purple-400">🚨 {l.pheic}</span>}
            </div>
            <div className="flex items-center justify-center">
              <div className="w-10 h-10 rounded-full bg-gray-800 border border-gray-700 flex items-center justify-center">
                <ArrowLeftRight className="w-4 h-4 text-gray-500" />
              </div>
            </div>
            <div className="relative bg-amber-900/20 border border-amber-700/30 rounded-2xl p-4 space-y-2 hover:border-amber-500/50 transition-colors">
              <a href={`/${locale}/outbreak/${oB.id}`} className="absolute inset-0 rounded-2xl" aria-label={getLocalizedDisease(oB, locale) ?? ""} />
              <RiskBadge level={oB.risk_level} />
              <h3 className="text-white font-bold text-lg leading-tight">{getLocalizedDisease(oB, locale)}</h3>
              <p className="text-gray-400 text-sm">📍 {getLocalizedCountry(oB, locale)}</p>
              {oB.is_pheic && <span className="text-xs text-purple-400">🚨 {l.pheic}</span>}
            </div>
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
            <table className="w-full">
              <thead><tr className="border-b border-gray-800">
                <th className="px-4 py-3 text-left w-1/3"></th>
                <th className="px-4 py-3 text-center text-blue-400 font-bold text-sm">A</th>
                <th className="px-4 py-3 text-center w-12"></th>
                <th className="px-4 py-3 text-center text-amber-400 font-bold text-sm">B</th>
              </tr></thead>
              <tbody>
                <StatRow label={l.cases} valA={oA.cases} valB={oB.cases} icon={<Users className="w-3.5 h-3.5" />} fmt={v => v.toLocaleString(locale === "ar" ? "ar-SA" : locale)} lockedA={!unlockedA} lockedB={!unlockedB} onLockClick={() => openModal("compare")} />
                <StatRow label={l.deaths} valA={oA.deaths} valB={oB.deaths} icon={<Skull className="w-3.5 h-3.5" />} fmt={v => v.toLocaleString(locale === "ar" ? "ar-SA" : locale)} lockedA={!unlockedA} lockedB={!unlockedB} onLockClick={() => openModal("compare")} />
                <StatRow label={l.cfr} valA={cfrA} valB={cfrB} icon={<TrendingUp className="w-3.5 h-3.5" />} fmt={v => v.toFixed(1) + "%"} lockedA={!unlockedA} lockedB={!unlockedB} onLockClick={() => openModal("compare")} />
                <StatRow label={l.incidence} valA={incA} valB={incB} icon={<Activity className="w-3.5 h-3.5" />} fmt={v => v.toFixed(2)} lockedA={!unlockedA} lockedB={!unlockedB} onLockClick={() => openModal("compare")} />
                <tr className="border-b border-gray-800">
                  <td className="px-4 py-3 text-gray-500 text-sm"><div className="flex items-center gap-2"><Calendar className="w-3.5 h-3.5" />{l.date}</div></td>
                  <td className="px-4 py-3 text-center text-white text-sm">{oA.date}</td>
                  <td className="px-4 py-3 text-center text-gray-600 text-xs">vs</td>
                  <td className="px-4 py-3 text-center text-white text-sm">{oB.date}</td>
                </tr>
                <tr className="border-b border-gray-800">
                  <td className="px-4 py-3 text-gray-500 text-sm"><div className="flex items-center gap-2"><Globe className="w-3.5 h-3.5" />{l.region}</div></td>
                  <td className="px-4 py-3 text-center text-gray-300 text-sm capitalize">{oA.region}</td>
                  <td className="px-4 py-3 text-center text-gray-600 text-xs">vs</td>
                  <td className="px-4 py-3 text-center text-gray-300 text-sm capitalize">{oB.region}</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 text-gray-500 text-sm"><div className="flex items-center gap-2"><AlertTriangle className="w-3.5 h-3.5" />Status</div></td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex flex-col gap-1 items-center">
                      {oA.is_pheic ? <span className="text-xs text-purple-400">🚨 PHEIC</span> : <span className="text-gray-600 text-xs">—</span>}
                    </div>
                  </td>
                  <td></td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex flex-col gap-1 items-center">
                      {oB.is_pheic ? <span className="text-xs text-purple-400">🚨 PHEIC</span> : <span className="text-gray-600 text-xs">—</span>}
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          {/* Legend only makes sense once the win/lose colours are actually visible (paid plan) */}
          {isPaid && <p className="text-xs text-gray-600 text-center">🟢 = {l.winner} · 🔴 = {l.lower}</p>}

          {/* ── Upgrade banner — shown right when engagement peaks: user just picked 2 outbreaks ── */}
          {!isPaid && (
            <div className="rounded-xl border border-amber-700/40 bg-gradient-to-r from-amber-950/50 via-amber-900/20 to-transparent p-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0 mt-0.5">
                    <Lock className="w-4 h-4 text-amber-400" />
                  </div>
                  <p className="text-sm font-semibold text-amber-300">{l.lockedBanner}</p>
                </div>
                <LockedUpgradeButton feature="compare" label={l.lockedCta} variant="banner" />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
