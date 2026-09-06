interface Props {
  cases: string;
  deaths: string;
  cfr: string;
  labels: {
    cases: string;
    deaths: string;
    cfr: string;
  };
}

// Plain display — no plan check, no blur. Cases/deaths/CFR are public on
// this page (and on /disease, /country, /region, /api/rss, the outbreak-card
// OG image — every active row has one), so there is nothing to gate here.
// The page's own OutbreakBottomCta already carries the alerts/Pro-trial
// pitch; this component used to duplicate a second, blur-gated one around
// these three tiles, fetching the real figures client-side from a
// Pro-gated route once auth resolved. Removed 2026-09-05.
export default function OutbreakStatsGrid({ cases, deaths, cfr, labels }: Props) {
  return (
    <div className="grid grid-cols-3 gap-4 mb-6">
      {([
        { label: labels.cases,  value: cases,  cls: "text-white"     },
        { label: labels.deaths, value: deaths, cls: "text-red-400"   },
        { label: labels.cfr,    value: cfr,    cls: "text-amber-400" },
      ] as const).map(({ label, value, cls }) => (
        <div key={label} className="bg-gray-800/50 rounded-lg p-4 border border-gray-700/50 text-center">
          <div className="text-xs text-gray-400 uppercase tracking-wide mb-1">{label}</div>
          <div className={`text-2xl font-bold ${cls}`}>{value}</div>
        </div>
      ))}
    </div>
  );
}
