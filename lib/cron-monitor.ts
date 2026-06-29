/**
 * Cron monitoring utility.
 * Each sync cron calls logCronRun() at the end of its execution.
 * The health-check reads these entries and alerts on overdue crons.
 *
 * Storage: site_config table, key = "cron:run:{cronName}"
 * Value: JSON { ts, status, rows, error? }
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export type CronStatus = "ok" | "error" | "no_data";

export interface CronRun {
  ts: string;
  status: CronStatus;
  rows: number;
  error?: string;
}

/**
 * Log a cron execution result to site_config.
 * Call this at the end of every sync cron, success or failure.
 */
export async function logCronRun(
  supabase: SupabaseClient,
  cronName: string,
  status: CronStatus,
  rowsUpdated = 0,
  errorMsg?: string,
): Promise<void> {
  const value: CronRun = {
    ts: new Date().toISOString(),
    status,
    rows: rowsUpdated,
    ...(errorMsg ? { error: errorMsg.slice(0, 500) } : {}),
  };
  await supabase
    .from("site_config")
    .upsert({ key: `cron:run:${cronName}`, value: JSON.stringify(value) }, { onConflict: "key" })
    .then(({ error }) => {
      if (error) console.error(`[cron-monitor] failed to log ${cronName}:`, error.message);
    });
}

/**
 * Expected max gap (hours) before a cron is considered overdue.
 * Set to 1.5× the schedule interval to absorb Vercel timing jitter.
 */
export const CRON_WINDOWS: Record<string, number> = {
  "sync-outbreaks":    2,    // hourly
  "sync-signals":      9,    // every 6h
  "sync-cdc-han":      7,    // every 4h
  "sync-ukhsa":        14,   // twice daily
  "sync-spf":          14,   // twice daily
  "sync-cdc-notices":  30,   // daily
  "sync-who-afro":     80,   // Mon/Wed/Fri — max gap 72h (Fri→Mon)
  "sync-who-emro":     80,   // Mon/Wed/Fri — max gap 72h (Fri→Mon)
  "sync-africa-cdc":   110,  // Wed/Sat — max gap 96h (Sat→Wed)
  "sync-who-regional": 80,   // Mon/Wed/Fri — max gap 72h (updated from Tue/Fri)
  "check-mpox-sitrep": 110,  // Wed/Sat — max gap 96h (Sat→Wed)
  "sync-paho-alerts":  110,  // Tue/Fri — max gap 96h (updated from weekly)
  "sync-ecdc-threats": 192,  // weekly Fri
  "sync-drc-sitrep":   26,   // daily — PHEIC cadence
  "sync-endemic-data": 192,  // weekly Mon
  "sync-usda-aphis":   192,  // weekly Mon
};
