import { createClient } from "@supabase/supabase-js";
import { CRON_WINDOWS } from "@/lib/cron-monitor";

const BOM   = String.fromCharCode(65279);
const clean = (v: string | undefined) => (v || "").replace(new RegExp("^" + BOM), "").trim();

function getServiceClient() {
  return createClient(
    clean(process.env.NEXT_PUBLIC_SUPABASE_URL),
    clean(process.env.SUPABASE_SERVICE_ROLE_KEY)
  );
}

/**
 * Human-readable source name for a stored outbreak.source URL.
 * AFRO/EMRO must be checked before the generic who.int fallback —
 * both live under who.int subdomains distinct from /emergencies/disease-outbreak-news.
 */
export function inferSource(source: string | null): string {
  if (!source) return "Other";
  if (/who\.int\/emergencies|disease-outbreak-news/i.test(source)) return "WHO DON";
  if (/afro\.who\.int/i.test(source))            return "WHO AFRO";
  if (/emro\.who\.int/i.test(source))            return "WHO EMRO";
  if (/ecdc\.europa/i.test(source))              return "ECDC";
  if (/paho\.org/i.test(source))                 return "PAHO";
  if (/africacdc\.org|africa-cdc/i.test(source)) return "Africa CDC";
  if (/cdc\.gov/i.test(source))                  return "US CDC";
  if (/who\.int/i.test(source))                  return "WHO Official";
  return "Other";
}

// Maps the public-facing source name to the cron job that syncs it, so
// freshness reflects "did the pipeline run" (site_config cron:run: log) —
// not "did any row's data change" (outbreaks.updated_at). A cron can run
// successfully every hour with nothing new to write; using updated_at as
// the freshness signal would falsely show that source as delayed, which is
// exactly the kind of silent-looking failure this page exists to rule out.
const SOURCE_TO_CRON: Record<string, string> = {
  "WHO DON":    "sync-outbreaks",
  "WHO AFRO":   "sync-who-afro",
  "WHO EMRO":   "sync-who-emro",
  "ECDC":       "sync-ecdc-threats",
  "PAHO":       "sync-paho-alerts",
  "Africa CDC": "sync-africa-cdc",
};

export const STATUS_SOURCE_ORDER = ["WHO DON", "WHO AFRO", "WHO EMRO", "ECDC", "PAHO", "Africa CDC"];

export type SourceFreshness = "ok" | "delayed" | "unknown";

export interface SourceStatusRow {
  name: string;
  last_synced_at: string | null;
  count: number;
  age_hours: number | null;
  window_hours: number;
  freshness: SourceFreshness;
  // Most recent `outbreaks.date` (the data's own as-of date, not our sync
  // time) across this source's active rows. A source can keep its rows and
  // log "ok" forever while this value stops advancing — the failure mode
  // that froze 7 ECDC WNV rows for 9 days (2026-08-27 -> 09-05) and the PAHO
  // measles sitrep for 16 days, both found by accident. `last_synced_at`
  // above cannot see it: the cron did run, it just parsed nothing usable.
  max_as_of: string | null;
}

interface CronRun {
  ts: string;
  status: "ok" | "error" | "no_data";
  rows: number;
  error?: string;
}

export async function getDataSourceStatus(): Promise<{ sources: SourceStatusRow[]; checked_at: string }> {
  const supabase = getServiceClient();

  const cronKeys = Object.values(SOURCE_TO_CRON).map((c) => `cron:run:${c}`);
  const [{ data: outbreakRows }, { data: cronRows }] = await Promise.all([
    supabase.from("outbreaks").select("source, date").eq("active", true),
    supabase.from("site_config").select("key,value").in("key", cronKeys),
  ]);

  const countBySource = new Map<string, number>();
  const maxAsOfBySource = new Map<string, string>();
  for (const row of (outbreakRows ?? []) as { source: string | null; date: string | null }[]) {
    const src = inferSource(row.source);
    countBySource.set(src, (countBySource.get(src) ?? 0) + 1);
    // Dates are ISO "YYYY-MM-DD", so a string compare is a date compare.
    if (row.date && row.date > (maxAsOfBySource.get(src) ?? "")) maxAsOfBySource.set(src, row.date);
  }

  const cronByKey = new Map<string, CronRun>();
  for (const row of (cronRows ?? []) as { key: string; value: string }[]) {
    try {
      cronByKey.set(row.key, JSON.parse(row.value));
    } catch { /* malformed entry, skip */ }
  }

  const now = Date.now();
  const sources: SourceStatusRow[] = STATUS_SOURCE_ORDER.map((name) => {
    const cronName   = SOURCE_TO_CRON[name];
    const windowHours = CRON_WINDOWS[cronName] ?? 26;
    const run = cronByKey.get(`cron:run:${cronName}`);
    const count = countBySource.get(name) ?? 0;
    const maxAsOf = maxAsOfBySource.get(name) ?? null;

    if (!run) {
      return { name, last_synced_at: null, count, age_hours: null, window_hours: windowHours, freshness: "unknown" as SourceFreshness, max_as_of: maxAsOf };
    }
    const ageHours = (now - new Date(run.ts).getTime()) / 3_600_000;
    const freshness: SourceFreshness = run.status === "error" ? "delayed" : ageHours <= windowHours ? "ok" : "delayed";
    return {
      name,
      last_synced_at: run.ts,
      count,
      age_hours: Math.round(ageHours),
      window_hours: windowHours,
      freshness,
      max_as_of: maxAsOf,
    };
  });

  return { sources, checked_at: new Date().toISOString() };
}
