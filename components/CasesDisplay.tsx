"use client";

// Small display cells for a single outbreak row's cases/deaths on the
// disease/country/region hub pages. Each reads the shared RealStatsProvider
// context to decide, per its own `id`, whether to show the real figure
// (already-real for a featured row; upgraded in place for a confirmed-paid
// viewer once the provider's fetch resolves) or the server-computed band —
// never a plausible-but-fake number (see magnitudeBand's doc comment in
// lib/outbreaks.ts). Only the row's `id` and its band cross the Server→
// Client boundary for a masked row; the real cases/deaths for that id are
// never a prop here, only ever read back from the paid-gated fetch.
import { useRealStats } from "@/components/RealStatsProvider";
import { MagnitudeDots, SeverityWord, type CfrSeverityBand } from "@/components/MagnitudeIndicator";

interface BaseProps {
  id: string;
  isFeatured: boolean;
  // Real values, safe to pass as-is ONLY when isFeatured (already public on
  // this page regardless of viewer) — 0/null for a masked row, harmless.
  cases: number;
  deaths: number | null;
  casesBand: number | null;
  deathsBand: number | null;
  numLocale: string;
}

function useEffectiveCasesDeaths(p: BaseProps): { cases: number; deaths: number | null; unlocked: boolean } {
  const real = useRealStats();
  if (p.isFeatured) return { cases: p.cases, deaths: p.deaths, unlocked: true };
  const r = real?.get(p.id);
  if (r) return { cases: r.cases, deaths: r.deaths, unlocked: true };
  return { cases: p.cases, deaths: p.deaths, unlocked: false };
}

// "{cases} cases · {deaths} deaths" inline, or a dot scale — disease/region
// active-outbreak rows.
export function CasesDeathsInline({
  id, isFeatured, cases, deaths, casesBand, numLocale, unitCases, unitDeaths, className = "",
}: BaseProps & { unitCases: string; unitDeaths: string; className?: string }) {
  const eff = useEffectiveCasesDeaths({ id, isFeatured, cases, deaths, casesBand, deathsBand: null, numLocale });
  if (!eff.unlocked) return <MagnitudeDots band={casesBand} className={className} />;
  return (
    <span className={className}>
      {eff.cases > 0 && <span>{eff.cases.toLocaleString(numLocale)} {unitCases}</span>}
      {eff.deaths !== null && eff.deaths > 0 && <span className="text-gray-500">{eff.cases > 0 ? " · " : ""}{eff.deaths.toLocaleString(numLocale)} {unitDeaths}</span>}
    </span>
  );
}

// "{cases} cases" only, or a dot scale — disease/region/country history rows.
export function CasesOnlyInline({
  id, isFeatured, cases, deaths, casesBand, numLocale, unitLabel, noDataLabel, className = "",
}: BaseProps & { unitLabel: string; noDataLabel: string; className?: string }) {
  const eff = useEffectiveCasesDeaths({ id, isFeatured, cases, deaths, casesBand, deathsBand: null, numLocale });
  if (!eff.unlocked) return <MagnitudeDots band={casesBand} className={className} />;
  return <span className={className}>{eff.cases > 0 ? `${eff.cases.toLocaleString(numLocale)} ${unitLabel}` : noDataLabel}</span>;
}

// Cases number + CFR sub-line — country page active-outbreak rows.
export function CasesCfrBlock({
  id, isFeatured, cases, deaths, casesBand, numLocale, noDataLabel,
}: BaseProps & { noDataLabel: string }) {
  const eff = useEffectiveCasesDeaths({ id, isFeatured, cases, deaths, casesBand, deathsBand: null, numLocale });
  if (!eff.unlocked) return <MagnitudeDots band={casesBand} />;
  if (eff.cases <= 0) return null;
  const cfr1 = eff.cases > 0 && eff.deaths !== null ? (eff.deaths / eff.cases * 100).toFixed(1) + "%" : noDataLabel;
  return (
    <div className="text-right">
      <p className="text-sm font-bold text-white">{eff.cases.toLocaleString(numLocale)}</p>
      <p className="text-xs text-gray-500">{cfr1}</p>
    </div>
  );
}

// Sum across a set of ids (a disease's/country's/region's aggregate total)
// for the stat-bar tiles — computed entirely client-side from the paid-
// gated fetch, so the real total (which would otherwise let
// `total - sum(featured rows)` recover a masked row's figure by
// subtraction, see aggregateNeedsMasking's doc comment) never exists as a
// number anywhere in the page's own cache or props until a paid viewer's
// own fetch resolves it.
export function AggregateStat({
  ids, kind, numLocale, casesBand, deathsBand, cfrBand, noDataLabel, locale, className = "",
}: {
  ids: string[];
  kind: "cases" | "deaths" | "cfr";
  numLocale: string;
  casesBand: number | null;
  deathsBand: number | null;
  cfrBand: CfrSeverityBand | null;
  noDataLabel: string;
  locale: string;
  className?: string;
}) {
  const real = useRealStats();
  const rows = real ? ids.map((id) => real.get(id)).filter((r): r is { cases: number; deaths: number | null } => !!r) : null;
  const complete = rows !== null && rows.length === ids.length;

  if (!complete) {
    if (kind === "cfr") return <SeverityWord band={cfrBand} locale={locale} className={className} />;
    return <MagnitudeDots band={kind === "cases" ? casesBand : deathsBand} className={className} />;
  }

  const totalCases  = rows!.reduce((s, r) => s + (r.cases ?? 0), 0);
  const totalDeaths = rows!.reduce((s, r) => s + (r.deaths ?? 0), 0);

  if (kind === "cases")  return <p className={className}>{totalCases  > 0 ? totalCases.toLocaleString(numLocale)  : noDataLabel}</p>;
  if (kind === "deaths") return <p className={className}>{totalDeaths > 0 ? totalDeaths.toLocaleString(numLocale) : noDataLabel}</p>;
  const cfr = totalCases > 0 ? (totalDeaths / totalCases * 100).toFixed(1) + "%" : noDataLabel;
  return <p className={className}>{cfr}</p>;
}
