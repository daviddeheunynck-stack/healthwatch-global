import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { extractNumbers } from "@/lib/outbreak-parser";
import { errorMessage } from "@/lib/error";
import * as Sentry from "@sentry/nextjs";
import { logCronRun, isRealProduction } from "@/lib/cron-monitor";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const BOM = String.fromCharCode(65279);
const clean = (v: string | undefined) => (v || "").replace(new RegExp("^" + BOM), "").trim();

const SUPABASE_URL        = clean(process.env.NEXT_PUBLIC_SUPABASE_URL);
const SUPABASE_SERVICE_KEY = clean(process.env.SUPABASE_SERVICE_ROLE_KEY);
const CRON_SECRET          = clean(process.env.CRON_SECRET);
const BREVO_API_KEY        = clean(process.env.BREVO_API_KEY);
const ADMIN_EMAILS         = clean(process.env.ADMIN_EMAILS);

function esc(s: string): string {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

const DON_RE = /^https:\/\/www\.who\.int\/emergencies\/disease-outbreak-news\/item\/\d{4}-DON\d+$/i;
const FETCH_HEADERS = {
  "User-Agent": "HealthWatch-Global/1.0 (health surveillance; contact@healthwatch-global.com)",
  "Accept": "text/html,*/*",
};

// ── Fetch and extract numbers + resolution signals from a WHO DON page ────────

interface DONResult {
  cases:     number;
  deaths:    number;
  resolved:  boolean; // formal "end of outbreak declared" language
  contained: boolean; // strong containment signal (contacts cleared, no new cases)
}

// Phrases that unambiguously indicate WHO has formally declared the outbreak over.
const RESOLUTION_PHRASES = [
  "the outbreak has been declared over",
  "this outbreak has been declared over",
  "outbreak is over",
  "end of the outbreak has been declared",
  "who has declared the end of the outbreak",
];

// Phrases indicating strong containment (contacts cleared, no secondary cases)
// but not necessarily a formal "end of outbreak" declaration yet.
const CONTAINMENT_PHRASES = [
  "all contacts have completed their follow-up period, with no additional cases",
  "no additional human cases have been reported",
  "quarantine and follow-up periods have been completed for everyone",
];

async function verifyFromDON(url: string): Promise<DONResult | null> {
  if (!DON_RE.test(url)) return null;
  try {
    const res = await fetch(url, {
      headers: FETCH_HEADERS,
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const html = await res.text();
    const bodyMatch = html.match(
      /(?:sf-content-block|article-content|content-block-article|don-content)([\s\S]{0,8000})/i,
    );
    // Fail closed like the sync-* extractors: if the selector no longer matches,
    // feeding the full page (nav/header chrome) into extractNumbers would produce
    // wrong case/death counts instead of the null this function already returns
    // for "no usable data".
    if (!bodyMatch) return null;
    const rawText = bodyMatch[1]
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    const lower    = rawText.toLowerCase();
    const nums     = extractNumbers(rawText);
    const resolved  = RESOLUTION_PHRASES.some(p => lower.includes(p));
    const contained = !resolved && CONTAINMENT_PHRASES.some(p => lower.includes(p));
    if (nums.cases === 0 && nums.deaths === 0 && !resolved && !contained) return null;
    return { cases: nums.cases, deaths: nums.deaths, resolved, contained };
  } catch {
    return null;
  }
}

// Rebuilds the English description from the corrected figures — same fix as
// buildEndemicDescription in sync-endemic-data: a cases/deaths update that leaves
// description untouched narrates stale numbers in prod indefinitely.
function buildDataQualityDescription(diseaseEn: string, countryEn: string, cases: number, deaths: number, date: string): string {
  const casesStr  = cases.toLocaleString("en");
  const deathsStr = deaths > 0 ? ` and ${deaths.toLocaleString("en")} death${deaths > 1 ? "s" : ""}` : "";
  return `${diseaseEn} in ${countryEn} — ${casesStr} cumulative case${cases > 1 ? "s" : ""}${deathsStr} reported as of ${date}.`;
}

// ── Send Brevo email ──────────────────────────────────────────────────────────

async function sendEmail(to: string, subject: string, html: string) {
  if (!BREVO_API_KEY || !to) return;
  await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    signal: AbortSignal.timeout(10_000),
    headers: { "api-key": BREVO_API_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({
      sender: { name: "HealthWatch Global", email: "alerts@healthwatch-global.com" },
      to: [{ email: to }],
      subject,
      htmlContent: html,
    }),
  }).catch((e) => {
    console.error("[data-quality] email send failed:", errorMessage(e));
    Sentry.captureException(e, { tags: { cron: "data-quality" } });
  });
}

// ── Main handler ──────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (!CRON_SECRET || auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error("[data-quality] Missing env: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    return NextResponse.json({ error: "env:missing" }, { status: 500 });
  }
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  // Defensive wrapper: catch any uncaught exception so logCronRun is always called.
  try {
    return await runDataQuality(req, supabase);
  } catch (err) {
    console.error("[data-quality] uncaught exception:", err);
    Sentry.captureException(err, { tags: { cron: "data-quality" } });
    await logCronRun(supabase, "data-quality", "error", 0,
      err instanceof Error ? err.message : String(err));
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}

interface OutbreakRowForFix {
  id: string;
  disease: string;
  disease_en: string | null;
  country: string;
  country_en: string | null;
  date: string;
  description: string | null;
}

// Applies a cases/deaths correction with description recompute (+ translation
// invalidation) in the same write, and reports whether the write actually landed —
// a source_priority guard blocking the write, or a genuine DB error, must never be
// silently counted as an applied fix in the admin report.
async function applyCaseUpdate(
  supabase: SupabaseClient,
  row: OutbreakRowForFix,
  newCases: number,
  newDeaths: number
): Promise<{ ok: boolean; error?: string }> {
  const description = buildDataQualityDescription(
    row.disease_en ?? row.disease, row.country_en ?? row.country, newCases, newDeaths, row.date
  );
  const payload: Record<string, unknown> = { cases: newCases, deaths: newDeaths, description };
  if (row.description !== description) {
    payload.description_fr = null;
    payload.description_es = null;
    payload.description_ar = null;
    payload.description_id = null;
  }
  const { data, error } = await supabase.from("outbreaks").update(payload).eq("id", row.id).select("id");
  if (error) return { ok: false, error: error.message };
  if (!data || data.length === 0) return { ok: false, error: "update blocked (0 lignes affectées)" };
  return { ok: true };
}

async function runDataQuality(_req: NextRequest, supabase: SupabaseClient) {
  const today    = new Date().toISOString().split("T")[0];
  const yesterday = new Date(Date.now() - 86_400_000).toISOString().split("T")[0];
  const adminEmail = ADMIN_EMAILS?.split(",")[0]?.trim();

  // ── 1. Load active rows ───────────────────────────────────────────────────
  const { data: rows, error: rowsErr } = await supabase
    .from("outbreaks")
    .select("id, disease, disease_en, country, country_en, cases, deaths, date, source, is_seed, is_pheic, source_priority, description, admin1")
    .eq("active", true);

  if (rowsErr) return NextResponse.json({ error: rowsErr.message }, { status: 500 });

  // ── 2. Load yesterday's snapshots ─────────────────────────────────────────
  const { data: snaps } = await supabase
    .from("outbreak_snapshots")
    .select("outbreak_id, cases, deaths")
    .eq("snapped_at", yesterday);

  const snapMap = new Map<string, { cases: number; deaths: number }>();
  for (const s of snaps ?? []) snapMap.set(s.outbreak_id, { cases: s.cases, deaths: s.deaths });

  // ── 3. Detect anomalies ───────────────────────────────────────────────────
  type Anomaly = {
    row: typeof rows[number];
    type: "deaths_gt_cases" | "zero_data" | "large_drop" | "spike";
    detail: string;
    snap: { cases: number; deaths: number } | undefined;
  };

  const anomalies: Anomaly[] = [];

  for (const row of rows ?? []) {
    const snap = snapMap.get(row.id);

    if (row.deaths > row.cases) {
      anomalies.push({ row, type: "deaths_gt_cases", detail: `${row.deaths} décès > ${row.cases} cas`, snap });
      continue;
    }
    if (row.cases === 0 && row.deaths === 0 && !row.is_seed) {
      anomalies.push({ row, type: "zero_data", detail: "0 cas et 0 décès (ligne pipeline)", snap });
      continue;
    }
    if (snap && snap.cases > 100) {
      const drop = (snap.cases - row.cases) / snap.cases;
      if (drop > 0.6) {
        anomalies.push({ row, type: "large_drop", detail: `${snap.cases} → ${row.cases} cas (−${Math.round(drop * 100)}%)`, snap });
        continue;
      }
      const spike = (row.cases - snap.cases) / snap.cases;
      if (spike > 9 && row.cases > 5000) {
        anomalies.push({ row, type: "spike", detail: `${snap.cases} → ${row.cases} cas (+${Math.round(spike * 100)}%)`, snap });
      }
    }
  }

  // ── 4. Verify + auto-fix ──────────────────────────────────────────────────
  type Fix = { label: string; before: string; after: string };
  type NeedsReview = { label: string; detail: string };

  const fixes: Fix[] = [];
  const needsReview: NeedsReview[] = [];

  for (const a of anomalies) {
    const { row, type, snap } = a;
    const label = `${row.disease} / ${row.country}`;

    // A row locked at source_priority=10 has an explicit human decision behind
    // it (verified against a primary source, often specifically BECAUSE its
    // automated source is unreliable) — this cron's auto-fixes must never
    // silently override that. Found 2026-07-17: this cron had zero awareness
    // of the locking convention used throughout 2026-07-15/16/17 (DR Congo/
    // Ebola, Uganda, Tanzania, Somalia rows), so a "spike"/"large_drop" false
    // positive against yesterday's snapshot could have blindly reverted a
    // deliberate correction the same day it was made.
    if ((row.source_priority ?? 0) >= 10) {
      needsReview.push({ label, detail: `${a.detail} — ligne verrouillée (source_priority=10), non auto-corrigée, vérifier manuellement` });
      continue;
    }

    const don = await verifyFromDON(row.source);

    if (type === "deaths_gt_cases") {
      if (don && don.cases > 0 && don.deaths <= don.cases) {
        const r = await applyCaseUpdate(supabase, row, don.cases, don.deaths);
        if (r.ok) fixes.push({ label, before: `${row.cases}c/${row.deaths}d`, after: `${don.cases}c/${don.deaths}d` });
        else needsReview.push({ label, detail: `${a.detail} — échec DB (${r.error})` });
      } else if (!don) {
        // No DON to verify — conservative fix: cap deaths at cases value
        const r = await applyCaseUpdate(supabase, row, row.cases, row.cases);
        if (r.ok) fixes.push({ label, before: `${row.cases}c/${row.deaths}d`, after: `${row.cases}c/${row.cases}d (décès plafonnés, DON inaccessible)` });
        else needsReview.push({ label, detail: `${a.detail} — échec DB (${r.error})` });
      } else {
        needsReview.push({ label, detail: `${a.detail} — DON ambigu (${don.cases}c/${don.deaths}d)` });
      }
    } else if (type === "zero_data") {
      if (don && don.cases > 0) {
        const r = await applyCaseUpdate(supabase, row, don.cases, don.deaths);
        if (r.ok) fixes.push({ label, before: "0c/0d", after: `${don.cases}c/${don.deaths}d` });
        else needsReview.push({ label, detail: `0/0 — échec DB (${r.error})` });
      } else {
        needsReview.push({ label, detail: `0/0 — DON ${don ? "ne confirme pas de chiffres" : "inaccessible"}` });
      }
    } else if (type === "large_drop") {
      if (don && snap && don.cases >= snap.cases * 0.7) {
        // DON confirms the old level — today's sync parsed wrong
        const r = await applyCaseUpdate(supabase, row, don.cases, don.deaths);
        if (r.ok) fixes.push({ label, before: `${row.cases}c (chute)`, after: `${don.cases}c (DON confirme)` });
        else needsReview.push({ label, detail: `${a.detail} — échec DB (${r.error})` });
      } else if (don && don.cases <= row.cases * 1.2) {
        // DON confirms the new lower value — legitimate decline
        needsReview.push({ label, detail: `${a.detail} — DON confirme le nouveau chiffre, baisse réelle ?` });
      } else {
        needsReview.push({ label, detail: `${a.detail} — DON inaccessible` });
      }
    } else if (type === "spike") {
      if (don && snap && don.cases <= snap.cases * 2) {
        // DON doesn't support the spike — parsing error, revert to snapshot
        const r = await applyCaseUpdate(supabase, row, snap.cases, snap.deaths);
        if (r.ok) fixes.push({ label, before: `${row.cases}c (spike)`, after: `${snap.cases}c (restauré depuis snapshot)` });
        else needsReview.push({ label, detail: `${a.detail} — échec DB (${r.error})` });
      } else {
        needsReview.push({ label, detail: `${a.detail} — ${don ? "DON ambigu" : "DON inaccessible"}` });
      }
    }

    await new Promise((r) => setTimeout(r, 150)); // polite delay
  }

  // ── 4b. Staleness check ───────────────────────────────────────────────────
  // Flag active entries whose `date` is older than threshold:
  //   - PHEIC events: 7 days (weekly sitreps, any gap is critical)
  //   - All others:   21 days (standard cron cadence)
  // Excludes: is_seed rows (manual), dashboard/tracker sources (non-article cadence)
  const STALE_DAYS_PHEIC = 7;
  const STALE_DAYS       = 21;
  const pheicThreshold = new Date(Date.now() - STALE_DAYS_PHEIC * 86_400_000).toISOString().split("T")[0];
  const staleThreshold = new Date(Date.now() - STALE_DAYS       * 86_400_000).toISOString().split("T")[0];
  const DASHBOARD_SOURCES = [
    "shinyapps.io",
    "ecdc.europa.eu/en/mpox/surveillance",
    "who.int/publications/m/item",          // WHO monthly situation reports (Mpox, etc.) — monthly cadence, 28d staleness expected
    "ecdc.europa.eu/en/news-events",        // ECDC epidemiological updates — quarterly cadence, 90d+ staleness expected
    "aphis.usda.gov/hpai-h5n1",             // USDA APHIS per-state HPAI livestock — date = last confirmed detection in that state, not a sync timestamp; many states legitimately go months/years without a new one
  ];

  for (const row of rows ?? []) {
    if (row.is_seed || !row.date || anomalies.some((a) => a.row.id === row.id)) continue;
    if (DASHBOARD_SOURCES.some((d) => (row.source ?? "").includes(d))) continue;
    const threshold = row.is_pheic ? pheicThreshold : staleThreshold;
    if (row.date <= threshold) {
      const daysSince = Math.round((Date.now() - new Date(row.date).getTime()) / 86_400_000);
      needsReview.push({
        label: `${row.disease} / ${row.country}`,
        detail: `Stale — dernière donnée il y a ${daysSince}j (${row.date}) — vérifier source : ${row.source ?? "N/A"}`,
      });
    }
  }

  // ── 4c. Duplication check ─────────────────────────────────────────────────
  // Flag active outbreaks where ≥3 DISTINCT countries share the exact same
  // case count from the same source domain — almost always signals a parser
  // distributing a regional total to individual country rows instead of one
  // aggregate row. Must dedupe by country (Set, not array): sub-national
  // breakdowns (USDA APHIS per US state, WHO DON per DRC health zone) push
  // the same country string many times on purpose, which used to trip this
  // check by row count alone even though it's the same single country.
  const dupGroups = new Map<string, Set<string>>();
  for (const row of rows ?? []) {
    if (!row.cases || row.cases === 0 || row.is_seed) continue;
    let domain = "unknown";
    try { domain = new URL(row.source ?? "").hostname; } catch { /* ignore */ }
    const key = `${(row.disease ?? "").toLowerCase()}|${domain}|${row.cases}`;
    const group = dupGroups.get(key) ?? new Set<string>();
    group.add(row.country ?? "?");
    dupGroups.set(key, group);
  }
  for (const [key, countrySet] of dupGroups.entries()) {
    const countries = [...countrySet];
    if (countries.length >= 3) {
      const [disease, domain] = key.split("|");
      needsReview.push({
        label: `Duplication suspecte — ${disease} (${domain})`,
        detail: `${countries.length} pays avec le même nombre de cas : ${countries.slice(0, 6).join(", ")}${countries.length > 6 ? "…" : ""}`,
      });
    }
  }

  // ── 4d. CFR plausibility check ───────────────────────────────────────────────
  // Diseases with a known high minimum CFR cannot legitimately show 0 deaths
  // once case counts are substantial. Catches artifacts like "Ebola Germany 1155/0".
  const HIGH_CFR_FLOOR: Record<string, number> = {
    "ebola":   40,  // observed range 25–90 %
    "marburg": 40,  // observed range 24–90 %
    "nipah":   40,  // observed range 40–75 %
  };
  for (const row of rows ?? []) {
    if (row.is_seed) continue;
    const name = (row.disease_en ?? row.disease ?? "").toLowerCase();
    for (const [key, floor] of Object.entries(HIGH_CFR_FLOOR)) {
      if (!name.includes(key)) continue;
      if (row.cases > 50 && row.deaths === 0) {
        needsReview.push({
          label: `${row.disease} / ${row.country}`,
          detail: `CFR impossible : ${row.cases.toLocaleString("fr-FR")} cas / 0 décès pour une maladie à CFR ≥${floor}% — probable artefact parsing (total d'un autre pays ?)`,
        });
      }
    }
  }

  // ── 4e. WHO DON resolution / containment detection ──────────────────────────
  // For active WHO DON rows not already flagged as anomalies:
  //   - Formal end-of-outbreak declaration → auto-deactivate
  //   - Strong containment signal          → flag for manual review
  const anomalyIds = new Set(anomalies.map((a) => a.row.id));
  for (const row of rows ?? []) {
    if (row.is_seed) continue;
    if (!DON_RE.test(row.source ?? "")) continue;
    if (anomalyIds.has(row.id)) continue;
    const label = `${row.disease} / ${row.country}`;
    if ((row.source_priority ?? 0) >= 10) continue; // locked row — never auto-deactivate, see 4. above
    const don = await verifyFromDON(row.source);
    if (don?.resolved) {
      // Same contract as applyCaseUpdate above: guard at the DB level too (the
      // source_priority check at the top of this loop reads a snapshot loaded
      // minutes earlier, before the per-row DON fetches — another cron can lock
      // the row in between), and verify the write actually landed before
      // reporting it as an applied fix. Without the .select("id") check a
      // blocked or failed deactivation was reported to David as "épidémie
      // désactivée" while the row stayed active in prod.
      const { data: deact, error: deactErr } = await supabase
        .from("outbreaks")
        .update({ active: false })
        .eq("id", row.id)
        .lte("source_priority", 9)
        .select("id");
      if (deactErr) {
        needsReview.push({ label, detail: `Fin d'épidémie déclarée (WHO DON) mais échec DB de la désactivation (${deactErr.message}) — vérifier manuellement : ${row.source}` });
      } else if (!deact || deact.length === 0) {
        needsReview.push({ label, detail: `Fin d'épidémie déclarée (WHO DON) mais désactivation bloquée (ligne verrouillée, 0 ligne affectée) — vérifier manuellement : ${row.source}` });
      } else {
        fixes.push({ label, before: "active", after: "inactive — fin d'épidémie déclarée (WHO DON)" });
      }
    } else if (don?.contained) {
      needsReview.push({
        label,
        detail: `Signal de containment détecté dans le DON — vérifier si l'épidémie est terminée : ${row.source}`,
      });
    }
    await new Promise((r) => setTimeout(r, 150));
  }

  // ── 4f. Seed data freshness check ────────────────────────────────────────────
  // Seeds managed by sync-who-regional / sync-endemic-data must stay current.
  // Two tiers:
  //   - High-frequency (InfoDengue, PAHO): flag if > 30 days without update
  //   - Annual reference (WHO GHO, etc.):  flag if > 730 days (data > 2 years old)
  // This catches bugs like the InfoDengue newest-first ordering bug (dengue Brazil
  // stuck at Jan 4) before they silently persist for months.
  const SEED_FRESH_DAYS_HIGH = 30;
  const SEED_FRESH_DAYS_REF  = 730;
  const HIGH_FREQ_SOURCES = ["info.dengue", "paho.org", "reliefweb.int"];
  // GHO annual indicators store the epidemiological year as date (e.g. 2024-01-01).
  // WHO GHO publishes data 1–2 years late, so the date is always "old" by design.
  // Staleness on GHO sources cannot be detected via the date field — skip them.
  const GHO_ANNUAL_SOURCES = ["who.int/data/gho", "who.int/data/global-health-estimates"];
  const seedFreshHigh = new Date(Date.now() - SEED_FRESH_DAYS_HIGH * 86_400_000).toISOString().split("T")[0];
  const seedFreshRef  = new Date(Date.now() - SEED_FRESH_DAYS_REF  * 86_400_000).toISOString().split("T")[0];

  for (const row of rows ?? []) {
    if (!row.is_seed || !row.date) continue;
    const src = (row.source ?? "").toLowerCase();
    if (GHO_ANNUAL_SOURCES.some(s => src.includes(s))) continue;
    const isHighFreq = HIGH_FREQ_SOURCES.some(s => src.includes(s));
    const threshold  = isHighFreq ? seedFreshHigh : seedFreshRef;
    if (row.date <= threshold) {
      const daysSince = Math.round((Date.now() - new Date(row.date).getTime()) / 86_400_000);
      const cadence   = isHighFreq ? `attendu toutes les ${SEED_FRESH_DAYS_HIGH}j` : `donnée de référence annuelle`;
      needsReview.push({
        label: `[SEED] ${row.disease} / ${row.country}`,
        detail: `Donnée périmée — ${daysSince}j sans mise à jour (date: ${row.date}, ${cadence}). Vérifier que le cron sync-who-regional tourne correctement.`,
      });
    }
  }

  // ── 4g. deaths=0 implausibilité pour maladies à mortalité connue ─────────────
  // Couvre TOUTES les lignes (seed + non-seed). La section 4d ne couvre que les
  // lignes non-seed pour ebola/marburg/nipah. Ce check élargit la couverture aux
  // données seed et aux maladies à mortalité modérée mais systématique.
  // deaths===0 = "zéro déclaré" (suspect) ; deaths===null = "non rapporté" (OK).
  const LETHALITY_RULES: Array<{
    pattern: RegExp;
    minCases: number;
    minCFRPct: number;
    note: string;
  }> = [
    { pattern: /ebola|marburg/i,             minCases: 5,    minCFRPct: 30,   note: "CFR 25-90%" },
    { pattern: /nipah/i,                     minCases: 5,    minCFRPct: 40,   note: "CFR 40-75%" },
    { pattern: /mers/i,                      minCases: 10,   minCFRPct: 20,   note: "CFR ~35%" },
    { pattern: /measles|rougeole|rubeola/i,  minCases: 1000, minCFRPct: 0.05, note: "CFR 0.05-1% selon région" },
    { pattern: /leishmaniasis/i,             minCases: 100,  minCFRPct: 1,    note: "LV : CFR ~2.8% traité, >95% sans" },
    { pattern: /cholera/i,                   minCases: 100,  minCFRPct: 0.5,  note: "CFR attendu 0.5-3% sans traitement rapide" },
    { pattern: /yellow fever|fièvre jaune/i, minCases: 10,   minCFRPct: 5,    note: "fièvre jaune sévère : CFR 20-50%" },
    { pattern: /diphtheria|diphtérie/i,      minCases: 50,   minCFRPct: 2,    note: "CFR 5-10% non vacciné" },
  ];

  // Verified exceptions: deaths=0 confirmed accurate against the primary source
  // (an explicit reported zero, not a parsing gap that should be NULL instead) —
  // without this, the check re-flags the same already-answered question every
  // single day forever, since the underlying count has no reason to change.
  // Re-verify against the source before ever removing an entry from this list.
  const VERIFIED_ZERO_DEATHS = new Set([
    // CDC explicitly states "0 confirmed deaths from measles in 2026" (measles_hosp.json) —
    // verified live 2026-07-10, see project_measles_us_description_drift_fixed memory.
    "measles|united states",
    // Cross-checked 2026-07-14 against the live WHO ArcGIS cholera feed
    // (cholera_adm0_week_view) that actually feeds this row — 151 cases / 0 deaths
    // over the only 2 reporting weeks Somalia has in 2026 (through 2026-01-12).
    // The field is a structured API value, not a text-parsing gap: WHO itself
    // reports zero, so NULL would be less accurate than 0 here.
    "cholera|somalia",
    // PAHO Situation Report #6 (2 July 2026), Table 3 — "Canada 1,079 0 — Endemic",
    // a positively-filled deaths column (not a dash/omission), itself sourced from
    // PHAC's own EW24 weekly report (cited as reference #19 in the sitrep). Cross-
    // checked against an independent source (Yale VMOC, 17 May 2026): this outbreak's
    // only 2 deaths occurred in 2025, outside the 2026 reporting window this row
    // covers. Verified 2026-07-15/17, see project_qc_2026_07_15_stale_items_verified
    // memory — the CFR-floor heuristic below is a false positive on this specific row.
    "measles|canada",
  ]);

  for (const row of rows ?? []) {
    if (row.is_seed) continue; // GHO annual data rarely tracks deaths — null preferred over 0, but skip to avoid noise
    if (row.deaths !== 0) continue;
    const name = (row.disease_en ?? row.disease ?? "").toLowerCase();
    const countryKey = (row.country_en ?? row.country ?? "").toLowerCase();
    if (VERIFIED_ZERO_DEATHS.has(`${name}|${countryKey}`)) continue;
    for (const rule of LETHALITY_RULES) {
      if (!rule.pattern.test(name)) continue;
      if ((row.cases ?? 0) < rule.minCases) continue;
      const expectedMin = Math.max(1, Math.round((row.cases ?? 0) * rule.minCFRPct / 100));
      const seedTag = row.is_seed ? " [SEED]" : "";
      const countryLabel = row.country_en ?? row.country ?? "?";
      needsReview.push({
        label: `[DEATHS=0?] ${row.disease_en ?? row.disease} / ${countryLabel}${seedTag}`,
        detail: `deaths=0 avec ${(row.cases ?? 0).toLocaleString("fr-FR")} cas — suspect (${rule.note}, min ~${expectedMin} décès attendus). Vérifier si la source ne rapporte pas les décès (→ mettre NULL au lieu de 0).`,
      });
      break;
    }
  }

  // ── 4h. Endemic GHO reference rows must never be active ──────────────────────
  // Annual WHO GHO indicator rows (malaria / measles-incidence / yellow-fever /
  // leishmaniasis / diphtheria) are reference statistics with placeholder AAAA-01-01
  // dates — NOT time-limited outbreak events. Since 2026-07-06 sync-who-regional
  // ingests them active=false (see project_is_seed_design_conflict). If any resurface
  // as ACTIVE is_seed rows, an ingestion path has regressed and is silently
  // repopulating the map with annual statistics dressed as current outbreaks — the
  // exact loop that required manual cleanup on 2026-07-05 (28 rows) and 07-06 (30).
  // The seed-freshness check (4f) deliberately skips GHO sources, so nothing else
  // catches this. Allowlisted exception: wild-poliovirus PAK/AFG — a genuine ongoing
  // PHEIC kept active on purpose.
  const GHO_INDICATOR_MARKER = "indicator-details";
  const WPV_POLIO_MARKER     = "poliomyelitis-by-wild-poliovirus";
  const strayEndemic = (rows ?? []).filter((row) =>
    row.is_seed &&
    (row.source ?? "").includes(GHO_INDICATOR_MARKER) &&
    !(row.source ?? "").includes(WPV_POLIO_MARKER),
  );
  if (strayEndemic.length > 0) {
    const sample = strayEndemic
      .slice(0, 8)
      .map((r) => `${r.disease_en ?? r.disease}/${r.country_en ?? r.country}`)
      .join(", ");
    needsReview.push({
      label: `[SEED ACTIF] ${strayEndemic.length} statistique(s) GHO annuelle(s) active(s)`,
      detail: `Devraient être inactives (référence endémique, pas un foyer en cours) : ${sample}${strayEndemic.length > 8 ? "…" : ""}. Régression d'ingestion — vérifier sync-who-regional (doit ingérer active=false) et les scripts de seed. Désactiver via id=eq.<uuid>.`,
    });
  }

  // ── 4i. Admin1 groundedness vs. description ──────────────────────────────────
  // Catches admin1 values that don't actually appear anywhere in the row's own
  // description — the exact signature of a confirmed hallucination bug (2026-07-27,
  // see project_truncated_descriptions_audit_2026_07_27): an Avian Influenza/US row
  // stored admin1="Utah" while its description was entirely about Washington State,
  // and "Utah" appeared nowhere in either the description or the source DON. Multi-
  // part admin1 values ("South Kivu, North Kivu") are checked part by part, flagging
  // only if NONE of the parts appear. Does not catch the "real place, wrong
  // paragraph" failure mode (e.g. a bulletin's historical-background sentence naming
  // a different province than the current case) — only a total mismatch.
  for (const row of rows ?? []) {
    const admin1 = (row.admin1 ?? "").trim();
    if (admin1.length < 3 || row.is_seed) continue;
    const desc = (row.description ?? "").toLowerCase();
    if (!desc) continue;
    const parts = admin1.split(/,|&|\s+and\s+/i).map((p: string) => p.trim().toLowerCase()).filter(Boolean);
    if (!parts.some((p: string) => desc.includes(p))) {
      needsReview.push({
        label: `[ADMIN1?] ${row.disease_en ?? row.disease} / ${row.country_en ?? row.country}`,
        detail: `admin1="${row.admin1}" n'apparaît nulle part dans la description — vérifier une éventuelle erreur d'extraction géographique (cf. bug Utah/Washington du 27/07).`,
      });
    }
  }

  // ── 5. Notable movements (top 5 largest absolute change, no anomaly) ──────
  type Movement = { label: string; before: number; after: number; delta: number };
  const movements: Movement[] = [];

  for (const row of rows ?? []) {
    if (anomalyIds.has(row.id)) continue;
    const snap = snapMap.get(row.id);
    if (!snap || snap.cases === 0) continue;
    const delta = row.cases - snap.cases;
    if (Math.abs(delta) > 0) {
      movements.push({ label: `${row.disease} / ${row.country}`, before: snap.cases, after: row.cases, delta });
    }
  }
  movements.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
  const topMovements = movements.slice(0, 5);

  // ── 6. Build and send email ───────────────────────────────────────────────
  const allClear = fixes.length === 0 && needsReview.length === 0;
  const subject = allClear
    ? `✅ HealthWatch — contrôle qualité RAS (${today})`
    : fixes.length > 0 && needsReview.length === 0
    ? `✅ HealthWatch — ${fixes.length} correction(s) appliquée(s) (${today})`
    : `⚠️ HealthWatch — ${needsReview.length} anomalie(s) à vérifier (${today})`;

  const fixesHtml = fixes.length > 0
    ? `<h3 style="color:#16a34a">✅ Corrections appliquées (${fixes.length})</h3><ul>` +
      fixes.map((f) => `<li><strong>${esc(f.label)}</strong> : ${f.before} → ${f.after}</li>`).join("") +
      `</ul>`
    : `<p style="color:#16a34a">✅ Aucune correction nécessaire.</p>`;

  const reviewHtml = needsReview.length > 0
    ? `<h3 style="color:#d97706">⚠️ À vérifier manuellement (${needsReview.length})</h3><ul>` +
      needsReview.map((r) => `<li><strong>${esc(r.label)}</strong> : ${r.detail}</li>`).join("") +
      `</ul>`
    : "";

  const movementsHtml = topMovements.length > 0
    ? `<h3 style="color:#2563eb">📈 Mouvements du jour (top ${topMovements.length})</h3><ul>` +
      topMovements.map((m) => {
        const pct = Math.round(((m.after - m.before) / m.before) * 100);
        const sign = pct >= 0 ? "+" : "";
        return `<li>${esc(m.label)} : ${m.before.toLocaleString("fr-FR")} → ${m.after.toLocaleString("fr-FR")} cas (${sign}${pct}%)</li>`;
      }).join("") +
      `</ul>`
    : "";

  const html = `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#1f2937">
      <h2 style="border-bottom:2px solid #e5e7eb;padding-bottom:8px">
        📊 Contrôle qualité HealthWatch Global — ${today}
      </h2>
      <p style="color:#6b7280">
        Lignes actives : <strong>${rows?.length ?? 0}</strong> &nbsp;|&nbsp;
        Anomalies détectées : <strong>${anomalies.length}</strong> &nbsp;|&nbsp;
        Corrections : <strong>${fixes.length}</strong>
      </p>
      ${fixesHtml}
      ${reviewHtml}
      ${movementsHtml}
      ${allClear ? '<p style="color:#6b7280;font-style:italic">Toutes les données sont cohérentes — aucune action requise.</p>' : ""}
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0">
      <p style="color:#9ca3af;font-size:12px">
        Généré automatiquement par le cron /api/cron/data-quality · ${new Date().toLocaleString("fr-FR", { timeZone: "Europe/Paris" })}
      </p>
    </div>`;

  if (adminEmail && isRealProduction) await sendEmail(adminEmail, subject, html);

  const result = {
    success: true,
    date: today,
    activeRows: rows?.length ?? 0,
    anomaliesDetected: anomalies.length,
    fixes: fixes.length,
    needsReview: needsReview.length,
    topMovements: topMovements.length,
    emailSent: !!adminEmail,
  };

  await logCronRun(supabase, "data-quality", "ok", fixes.length);
  console.log("[data-quality]", result);
  return NextResponse.json(result);
}
