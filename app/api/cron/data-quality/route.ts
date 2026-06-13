import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { extractNumbers } from "@/lib/outbreak-parser";
import { errorMessage } from "@/lib/error";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const BOM = String.fromCharCode(65279);
const clean = (v: string | undefined) => (v || "").replace(new RegExp("^" + BOM), "").trim();

const SUPABASE_URL        = clean(process.env.NEXT_PUBLIC_SUPABASE_URL);
const SUPABASE_SERVICE_KEY = clean(process.env.SUPABASE_SERVICE_ROLE_KEY);
const CRON_SECRET          = clean(process.env.CRON_SECRET);
const BREVO_API_KEY        = clean(process.env.BREVO_API_KEY);
const ADMIN_EMAILS         = clean(process.env.ADMIN_EMAILS);

const DON_RE = /^https:\/\/www\.who\.int\/emergencies\/disease-outbreak-news\/item\/\d{4}-DON\d+$/i;
const FETCH_HEADERS = {
  "User-Agent": "HealthWatch-Global/1.0 (health surveillance; contact@healthwatch-global.com)",
  "Accept": "text/html,*/*",
};

// ── Fetch and extract numbers from a WHO DON page ─────────────────────────────

async function verifyFromDON(url: string): Promise<{ cases: number; deaths: number } | null> {
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
    const text = (bodyMatch ? bodyMatch[1] : html)
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    const nums = extractNumbers(text);
    return nums.cases > 0 || nums.deaths > 0 ? nums : null;
  } catch {
    return null;
  }
}

// ── Send Brevo email ──────────────────────────────────────────────────────────

async function sendEmail(to: string, subject: string, html: string) {
  if (!BREVO_API_KEY || !to) return;
  await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "api-key": BREVO_API_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({
      sender: { name: "HealthWatch Global", email: "alerts@healthwatch-global.com" },
      to: [{ email: to }],
      subject,
      htmlContent: html,
    }),
  }).catch((e) => console.error("[data-quality] email send failed:", errorMessage(e)));
}

// ── Main handler ──────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (CRON_SECRET && auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const today    = new Date().toISOString().split("T")[0];
  const yesterday = new Date(Date.now() - 86_400_000).toISOString().split("T")[0];
  const adminEmail = ADMIN_EMAILS?.split(",")[0]?.trim();

  // ── 1. Load active rows ───────────────────────────────────────────────────
  const { data: rows, error: rowsErr } = await supabase
    .from("outbreaks")
    .select("id, disease, country, cases, deaths, source, is_seed")
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
    const don = await verifyFromDON(row.source);

    if (type === "deaths_gt_cases") {
      if (don && don.cases > 0 && don.deaths <= don.cases) {
        await supabase.from("outbreaks").update({ cases: don.cases, deaths: don.deaths }).eq("id", row.id);
        fixes.push({ label, before: `${row.cases}c/${row.deaths}d`, after: `${don.cases}c/${don.deaths}d` });
      } else if (!don) {
        // No DON to verify — conservative fix: cap deaths at cases value
        await supabase.from("outbreaks").update({ deaths: row.cases }).eq("id", row.id);
        fixes.push({ label, before: `${row.cases}c/${row.deaths}d`, after: `${row.cases}c/${row.cases}d (décès plafonnés, DON inaccessible)` });
      } else {
        needsReview.push({ label, detail: `${a.detail} — DON ambigu (${don.cases}c/${don.deaths}d)` });
      }
    } else if (type === "zero_data") {
      if (don && don.cases > 0) {
        await supabase.from("outbreaks").update({ cases: don.cases, deaths: don.deaths }).eq("id", row.id);
        fixes.push({ label, before: "0c/0d", after: `${don.cases}c/${don.deaths}d` });
      } else {
        needsReview.push({ label, detail: `0/0 — DON ${don ? "ne confirme pas de chiffres" : "inaccessible"}` });
      }
    } else if (type === "large_drop") {
      if (don && snap && don.cases >= snap.cases * 0.7) {
        // DON confirms the old level — today's sync parsed wrong
        await supabase.from("outbreaks").update({ cases: don.cases, deaths: don.deaths }).eq("id", row.id);
        fixes.push({ label, before: `${row.cases}c (chute)`, after: `${don.cases}c (DON confirme)` });
      } else if (don && don.cases <= row.cases * 1.2) {
        // DON confirms the new lower value — legitimate decline
        needsReview.push({ label, detail: `${a.detail} — DON confirme le nouveau chiffre, baisse réelle ?` });
      } else {
        needsReview.push({ label, detail: `${a.detail} — DON inaccessible` });
      }
    } else if (type === "spike") {
      if (don && snap && don.cases <= snap.cases * 2) {
        // DON doesn't support the spike — parsing error, revert to snapshot
        await supabase.from("outbreaks").update({ cases: snap.cases, deaths: snap.deaths }).eq("id", row.id);
        fixes.push({ label, before: `${row.cases}c (spike)`, after: `${snap.cases}c (restauré depuis snapshot)` });
      } else {
        needsReview.push({ label, detail: `${a.detail} — ${don ? "DON ambigu" : "DON inaccessible"}` });
      }
    }

    await new Promise((r) => setTimeout(r, 150)); // polite delay
  }

  // ── 5. Notable movements (top 5 largest absolute change, no anomaly) ──────
  type Movement = { label: string; before: number; after: number; delta: number };
  const movements: Movement[] = [];

  const anomalyIds = new Set(anomalies.map((a) => a.row.id));
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
      fixes.map((f) => `<li><strong>${f.label}</strong> : ${f.before} → ${f.after}</li>`).join("") +
      `</ul>`
    : `<p style="color:#16a34a">✅ Aucune correction nécessaire.</p>`;

  const reviewHtml = needsReview.length > 0
    ? `<h3 style="color:#d97706">⚠️ À vérifier manuellement (${needsReview.length})</h3><ul>` +
      needsReview.map((r) => `<li><strong>${r.label}</strong> : ${r.detail}</li>`).join("") +
      `</ul>`
    : "";

  const movementsHtml = topMovements.length > 0
    ? `<h3 style="color:#2563eb">📈 Mouvements du jour (top ${topMovements.length})</h3><ul>` +
      topMovements.map((m) => {
        const pct = Math.round(((m.after - m.before) / m.before) * 100);
        const sign = pct >= 0 ? "+" : "";
        return `<li>${m.label} : ${m.before.toLocaleString("fr-FR")} → ${m.after.toLocaleString("fr-FR")} cas (${sign}${pct}%)</li>`;
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

  if (adminEmail) await sendEmail(adminEmail, subject, html);

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

  console.log("[data-quality]", result);
  return NextResponse.json(result);
}
