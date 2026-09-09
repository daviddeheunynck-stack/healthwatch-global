// HealthWatch Global shuts down at this instant (David's decision, 2026-09-09
// — see app/[locale]/layout.tsx, the single choke point that replaces every
// page under [locale] with a shutdown notice from this date on, no
// exceptions). Single source of truth so the date only ever needs changing
// in one place — it has already moved once (93a5512: 18/09 -> 12/09) and a
// second, uncentralized copy is exactly how that kind of edit gets missed
// somewhere.
//
// Anything that would email, push, or otherwise reach a real person about a
// product that page now tells every visitor has shut down must check
// isShutDown() too — layout.tsx only gates page renders, not the ~50 Vercel
// crons under app/api/cron/, which run on their own schedule regardless.
export const SHUTDOWN_AT = "2026-09-12T00:00:00Z";

export function isShutDown(): boolean {
  return Date.now() >= Date.parse(SHUTDOWN_AT);
}
