// USDA APHIS migrated its HPAI livestock detections page to a Tableau Public
// dashboard embed around 2026-06-27 — the CSV/HTML formats sync-usda-aphis
// originally scraped no longer exist (see project notes, 2026-07-11).
//
// This drives a real headless browser through the dashboard's own "Download
// crosstab" UI feature (the same button a human would click) rather than
// replaying Tableau's internal session/export API — the latter was flagged
// as reverse-engineering an undocumented endpoint and is out of scope here.
//
// Flow: open the embedded view → click "Télécharger le tableau croisé" →
// pick the "Table Details by Date" worksheet → pick CSV format → click
// "Télécharger" → capture the resulting CSV from the network response
// instead of handling a real file download.

import chromium from "@sparticuz/chromium";
import type { Browser } from "puppeteer-core";

const TABLEAU_VIEW_URL =
  "https://publicdashboards.dl.usda.gov/t/MRP_PUB/views/VS_Cattle_HPAIConfirmedDetections2024/HPAI2022ConfirmedDetections?:embed=y";

const USER_AGENT =
  "Mozilla/5.0 (compatible; HealthWatch-Global/1.0; +https://healthwatch-global.com)";

async function launchBrowser(): Promise<Browser> {
  const puppeteer = await import("puppeteer-core");
  // Local dev has no Lambda-compatible Chromium binary — fall back to a
  // system Chrome if one is configured via env, otherwise this only runs
  // on Vercel where @sparticuz/chromium provides the binary. chromium.args
  // is tuned for the Lambda sandbox (--single-process etc.) and changes
  // rendering/timing enough to break the flow against a real desktop
  // Chrome, so it's only applied when actually using the sparticuz binary.
  const localExecutable = process.env.LOCAL_CHROME_PATH;
  if (localExecutable) {
    return puppeteer.launch({ executablePath: localExecutable, headless: true });
  }
  return puppeteer.launch({
    args: chromium.args,
    executablePath: await chromium.executablePath(),
    // chromium.args already bakes in --headless='shell' — omit the headless
    // option entirely so Puppeteer doesn't add a second, conflicting flag.
  });
}

/** Selects the sheet option matching `text` inside the export dialog's listbox. */
async function selectSheet(page: import("puppeteer-core").Page, text: string): Promise<boolean> {
  return page.evaluate((sheetText) => {
    const opts = [...document.querySelectorAll('[role="option"]')];
    const el = opts.find((o) => (o.textContent || "").trim() === sheetText);
    if (!el) return false;
    (el as HTMLElement).scrollIntoView();
    (el as HTMLElement).click();
    return true;
  }, text);
}

/** Selects the CSV radio button inside the export dialog's format radiogroup. */
async function selectCsvFormat(page: import("puppeteer-core").Page): Promise<boolean> {
  return page.evaluate(() => {
    const rg = document.querySelector('[role="radiogroup"]');
    if (!rg) return false;
    const candidates = [...rg.querySelectorAll("label")];
    const target = candidates.find((el) => (el.textContent || "").trim().toLowerCase() === "csv");
    if (!target) return false;
    (target as HTMLElement).scrollIntoView();
    (target as HTMLElement).click();
    return true;
  });
}

/** Clicks the dialog's "Télécharger" confirm button (scoped to the dialog to
 * avoid re-matching the toolbar button that opened it — both share the
 * substring "Télécharger"). */
async function clickConfirmDownload(page: import("puppeteer-core").Page): Promise<boolean> {
  return page.evaluate(() => {
    const dlg = document.querySelector('[role="dialog"]');
    if (!dlg) return false;
    const btns = [...dlg.querySelectorAll('button, [role="button"]')];
    const target = btns.find((el) => (el.textContent || "").trim() === "Télécharger");
    if (!target) return false;
    (target as HTMLElement).scrollIntoView();
    (target as HTMLElement).click();
    return true;
  });
}

/**
 * Downloads the "Table Details by Date" worksheet as CSV via the Tableau
 * dashboard's own export UI. Throws on any step failure — callers should
 * fall back to the existing "no data" path rather than propagate a crash.
 */
export async function scrapeAphisTableauCsv(): Promise<string> {
  const browser = await launchBrowser();

  try {
    const page = await browser.newPage();
    await page.setUserAgent(USER_AGENT);
    await page.setViewport({ width: 1280, height: 900 });

    let csvText: string | null = null;
    page.on("response", (res) => {
      if (csvText !== null) return;
      const url = res.url();
      if (!url.includes("/tempfile/sessions/")) return;
      const ct = res.headers()["content-type"] ?? "";
      if (ct.includes("image/")) return;
      res.text().then((t) => { csvText = t; }).catch(() => { /* response body unavailable — ignore */ });
    });

    const pageErrors: string[] = [];
    page.on("console", (msg) => { if (msg.type() === "error") pageErrors.push(`console: ${msg.text().slice(0, 200)}`); });
    page.on("pageerror", (err) => { pageErrors.push(`pageerror: ${String(err).slice(0, 200)}`); });
    page.on("requestfailed", (req) => { pageErrors.push(`requestfailed: ${req.url().slice(0, 120)} ${req.failure()?.errorText ?? ""}`); });

    await page.goto(TABLEAU_VIEW_URL, { waitUntil: "networkidle2", timeout: 60_000 });

    // --single-process (required in the Lambda sandbox) renders noticeably
    // slower than a normal desktop Chrome — give this more headroom.
    const downloadBtn = await page.waitForSelector("aria/Télécharger le tableau croisé", { timeout: 40_000 }).catch(() => null);
    if (!downloadBtn) {
      const title = await page.title().catch(() => "?");
      const bodyText = await page.evaluate(() => document.body?.innerText?.slice(0, 300) ?? "").catch(() => "?");
      throw new Error(
        `download button not found — title="${title}" body="${bodyText.replace(/\s+/g, " ")}" errors=[${pageErrors.slice(0, 5).join(" | ")}]`
      );
    }
    await downloadBtn.click();

    // The export dialog's listbox can take a moment to populate after the
    // dialog opens — poll instead of a single fixed-delay check.
    let sheetSelected = false;
    const sheetDeadline = Date.now() + 8_000;
    while (!sheetSelected && Date.now() < sheetDeadline) {
      await new Promise((r) => setTimeout(r, 500));
      sheetSelected = await selectSheet(page, "Table Details by Date");
    }
    if (!sheetSelected) {
      const dump = await page.evaluate(() =>
        [...document.querySelectorAll('[role="option"]')].map((o) => (o.textContent || "").trim()).join(" | ")
      );
      throw new Error(`'Table Details by Date' sheet option not found (options seen: ${dump || "none"})`);
    }

    await new Promise((r) => setTimeout(r, 300));
    if (!(await selectCsvFormat(page))) {
      throw new Error("csv format radio not found");
    }

    await new Promise((r) => setTimeout(r, 300));
    if (!(await clickConfirmDownload(page))) {
      throw new Error("confirm download button not found");
    }

    const deadline = Date.now() + 25_000;
    while (csvText === null && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 500));
    }
    if (csvText === null) throw new Error("timed out waiting for CSV export response");

    return csvText;
  } finally {
    await browser.close();
  }
}

export interface CrosstabRow {
  date:       string; // "DD-Mon-YY"
  state:      string;
  premiseId:  string;
  production: string;
}

/** Parses the tab-separated "Table Details by Date" crosstab export — a
 * 2-row header (species group labels, then column names) followed by one
 * data row per confirmed premises. */
export function parseCrosstabCsv(text: string): CrosstabRow[] {
  const lines = text.replace(/\r\n/g, "\n").split("\n").filter((l) => l.trim());
  if (lines.length < 3) return [];

  const rows: CrosstabRow[] = [];
  // Row 0 = species group header, row 1 = column names — data starts at row 2.
  for (let i = 2; i < lines.length; i++) {
    const cols = lines[i].split("\t");
    const [date, state, premiseId, production] = cols;
    if (!date || !state) continue;
    rows.push({ date: date.trim(), state: state.trim(), premiseId: (premiseId ?? "").trim(), production: (production ?? "").trim() });
  }
  return rows;
}

const MONTHS: Record<string, string> = {
  jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
  jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
};

/** Converts APHIS's "DD-Mon-YY" date format to ISO "YYYY-MM-DD". Returns
 * null if the string doesn't match the expected shape. */
export function parseCrosstabDate(raw: string): string | null {
  const m = /^(\d{1,2})-([A-Za-z]{3})-(\d{2})$/.exec(raw.trim());
  if (!m) return null;
  const [, day, monAbbr, yy] = m;
  const mon = MONTHS[monAbbr.toLowerCase()];
  if (!mon) return null;
  return `20${yy}-${mon}-${day.padStart(2, "0")}`;
}

export interface CrosstabStateAggregate {
  state:      string;
  herds:      number;
  latestDate: string; // ISO
  herdTypes:  Set<string>;
}

/** Aggregates per-premises crosstab rows into one entry per state — herd
 * count = number of distinct premises detected, since this worksheet has
 * no per-premises animal headcount column. */
export function aggregateCrosstabByState(rows: CrosstabRow[]): CrosstabStateAggregate[] {
  const map = new Map<string, CrosstabStateAggregate>();
  const today = new Date().toISOString().substring(0, 10);

  for (const row of rows) {
    const isoDate = parseCrosstabDate(row.date) ?? today;
    const existing = map.get(row.state);
    if (existing) {
      existing.herds += 1;
      if (isoDate > existing.latestDate) existing.latestDate = isoDate;
      if (row.production) existing.herdTypes.add(row.production);
    } else {
      map.set(row.state, {
        state:      row.state,
        herds:      1,
        latestDate: isoDate,
        herdTypes:  new Set(row.production ? [row.production] : []),
      });
    }
  }

  return [...map.values()];
}
