#!/usr/bin/env node
// Cross-checks every "Schedule: <cron-expr>" comment against vercel.json —
// the actual source of truth Vercel itself reads to register Cron Jobs, so
// it can't be replaced by a second registry file without creating a new
// thing to keep in sync instead of fixing the old one.
//
// Added 2026-08-23 after fixing the same drift twice in one day
// (fix(crons) 313117a, then again the same day): vercel.json's schedule
// changes, a route file's comment describing it in prose doesn't, and
// nothing ever pointed that out until someone happened to read both side
// by side. "Schedule: <cron-expr>" was already the convention several
// files used (sync-malaysia-dengue, sync-who-regional, pilot-follow-up,
// disease-coverage, sync-pacific-surveillance, ...) — this just checks it
// and extends it to the files that only had the same fact in free prose.
//
// Opt-in, not a mandate: only lines that already carry a "Schedule: X"
// comment are checked. A cron with no such comment is silently skipped —
// this doesn't force every one of the ~50 crons to be tagged today, it
// just stops the ones that already are from drifting again unnoticed.
//
// Run manually:    node scripts/check-cron-schedule.mjs
// Run on commit:   .githooks/pre-commit, when vercel.json or a tagged
//                  file is staged.

import { readFileSync, readdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

const vercelConfig = JSON.parse(readFileSync(join(repoRoot, "vercel.json"), "utf8"));
const scheduleByPath = new Map(vercelConfig.crons.map((c) => [c.path, c.schedule]));

// 5 whitespace-separated cron fields, each made of digits/*/,/-/. Stops
// naturally at the first character outside that set (a paren, an em dash,
// end of line), so trailing prose after the expression is never captured.
const SCHEDULE_RE = /Schedule:\s*([0-9*/,-]+\s+[0-9*/,-]+\s+[0-9*/,-]+\s+[0-9*/,-]+\s+[0-9*/,-]+)/;

const mismatches = [];
let checked = 0;

function checkRouteFiles(baseDir, pathPrefix) {
  const full = join(repoRoot, baseDir);
  let entries;
  try {
    entries = readdirSync(full, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    let content;
    try {
      content = readFileSync(join(full, entry.name, "route.ts"), "utf8");
    } catch {
      continue;
    }
    const match = content.match(SCHEDULE_RE);
    if (!match) continue;
    checked++;
    const path = `${pathPrefix}/${entry.name}`;
    const declared = match[1].trim().replace(/\s+/g, " ");
    const real = scheduleByPath.get(path);
    if (real === undefined) {
      mismatches.push(`${path}/route.ts: tagged "Schedule: ${declared}" but vercel.json has no cron for this path`);
    } else if (real !== declared) {
      mismatches.push(`${path}/route.ts: comment says "${declared}", vercel.json says "${real}"`);
    }
  }
}

checkRouteFiles("app/api/cron", "/api/cron");
checkRouteFiles("app/api/admin", "/api/admin");

// lib/cron-monitor.ts: one CRON_WINDOWS entry per line, "<cron-name>": N, // Schedule: ...
// — the cron name is the object key on that same line.
const cronMonitorLines = readFileSync(join(repoRoot, "lib/cron-monitor.ts"), "utf8").split("\n");
const KEY_RE = /^\s*"([a-z0-9-]+)":/;
for (const line of cronMonitorLines) {
  const scheduleMatch = line.match(SCHEDULE_RE);
  if (!scheduleMatch) continue;
  const keyMatch = line.match(KEY_RE);
  if (!keyMatch) continue;
  checked++;
  const name = keyMatch[1];
  const declared = scheduleMatch[1].trim().replace(/\s+/g, " ");
  const candidatePaths = [`/api/cron/${name}`, `/api/admin/${name}`];
  const path = candidatePaths.find((p) => scheduleByPath.has(p));
  if (!path) {
    mismatches.push(`lib/cron-monitor.ts "${name}": tagged "Schedule: ${declared}" but vercel.json has no cron at ${candidatePaths.join(" or ")}`);
    continue;
  }
  const real = scheduleByPath.get(path);
  if (real !== declared) {
    mismatches.push(`lib/cron-monitor.ts "${name}": comment says "${declared}", vercel.json says "${real}"`);
  }
}

if (mismatches.length > 0) {
  console.error("\ncron schedule drift — comment(s) disagree with vercel.json:\n");
  for (const m of mismatches) console.error(`  ✗ ${m}`);
  console.error(`\n${mismatches.length} mismatch(es) out of ${checked} tagged "Schedule:" comment(s) checked.`);
  console.error("Fix whichever one is wrong (the comment, or vercel.json) so they agree.\n");
  process.exit(1);
}

console.log(`[check-cron-schedule] ${checked} tagged "Schedule:" comment(s) match vercel.json.`);
process.exit(0);
