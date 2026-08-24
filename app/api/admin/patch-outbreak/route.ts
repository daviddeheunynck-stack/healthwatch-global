import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase-server";
import { isAdmin } from "@/lib/admin";
import { errorMessage } from "@/lib/error";
import {
  lockedRowRegressionGuard,
  regressionGuard,
  deathsNeverDecreaseGuard,
  implausibleDeathsGuard,
} from "@/lib/outbreak-guards";

export const dynamic = "force-dynamic";

const BOM   = String.fromCharCode(65279);
const clean = (v: string | undefined) => (v ?? "").replace(new RegExp("^" + BOM), "").trim();

const SUPABASE_URL         = clean(process.env.NEXT_PUBLIC_SUPABASE_URL);
const SUPABASE_SERVICE_KEY = clean(process.env.SUPABASE_SERVICE_ROLE_KEY);

// POST /api/admin/patch-outbreak
// Body: { disease_en, country_en, cases, deaths, date, source?, active? }
// Updates the matching active outbreak row by disease_en + country_en.
export async function POST(req: NextRequest) {
  const supabaseAuth = await createServerClient();
  const { data: { user } } = await supabaseAuth.auth.getUser().catch(() => ({ data: { user: null } }));
  if (!isAdmin(user?.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return NextResponse.json({ error: "env:missing" }, { status: 500 });
  }

  let body: {
    disease_en: string;
    country_en: string;
    // Cible exacte. Requis dès que disease_en + country_en ramènent plusieurs
    // lignes — voir la résolution de ligne plus bas.
    id?: string;
    cases?: number;
    deaths?: number;
    date?: string;
    source?: string;
    active?: boolean;
    description?: string;
    // Explicit override for the guard chain below. Never defaulted, never
    // inferred: a caller has to state that it knows the write is a regression
    // and means it anyway.
    force?: boolean;
    // Escape hatch for the description-coherence check below. Separate from
    // `force`, which asserts something different — see that block.
    keep_description?: boolean;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { disease_en, country_en } = body;
  if (!disease_en || !country_en) {
    return NextResponse.json({ error: "disease_en and country_en are required" }, { status: 400 });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  // Strip characters significant to PostgREST's .or() filter syntax (same as
  // the public search endpoint, app/api/outbreaks/route.ts) so a value like
  // "x%,active.eq.true" can't inject an extra filter clause.
  const safeDisease = disease_en.replace(/[,()]/g, "");
  const safeCountry = country_en.replace(/[,()]/g, "");

  // Find the matching row (active OR recently active).
  // Search both disease_en/country_en (English) and disease/country (French)
  // because some rows are inserted with only the French columns populated.
  //
  // 2026-08-23: was `.limit(1)`, so an `ilike` on "Ebola" + "DR Congo" — which
  // matches five rows, four of them historical snapshots — silently picked
  // whichever the sort surfaced first and wrote to it. The caller had no way to
  // know which row it was about to touch until after the fact. Fetching the
  // candidates and refusing a genuinely ambiguous match is the difference
  // between "patch an outbreak" and "patch AN outbreak".
  const { data: rows, error: fetchErr } = await supabase
    .from("outbreaks")
    .select("id, disease_en, country_en, cases, deaths, date, active, source_priority, description")
    .or(`disease_en.ilike.%${safeDisease}%,disease.ilike.%${safeDisease}%`)
    .or(`country_en.ilike.%${safeCountry}%,country.ilike.%${safeCountry}%`)
    .order("active", { ascending: false })
    .limit(10);

  if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  if (!rows || rows.length === 0) {
    return NextResponse.json({ error: `No row found for ${disease_en} / ${country_en}` }, { status: 404 });
  }

  // `id` resolves ambiguity outright and is the only way to target a specific
  // historical snapshot. Deliberately NOT bypassable by `force`: forcing a
  // write onto an unidentified row is worse than forcing a downward revision
  // onto a known one.
  const active = rows.filter((r) => r.active);

  // Quand `id` est fourni il est CONTRAIGNANT : pas de repli. Un `??` en
  // cascade ferait retomber un id erroné sur la ligne active, c'est-à-dire
  // écrire sur une ligne que l'appelant n'a pas demandée — exactement le
  // défaut que ce bloc corrige. Trouvé en rejouant la résolution sur les
  // vraies lignes Ebola/RDC avant commit.
  let row: (typeof rows)[number] | undefined;
  if (body.id) {
    row = rows.find((r) => r.id === body.id);
    if (!row) {
      return NextResponse.json(
        { error: "id_not_in_match", message: `id ${body.id} ne fait pas partie des lignes trouvées pour ${disease_en} / ${country_en}` },
        { status: 404 },
      );
    }
  } else {
    row = rows.length === 1 ? rows[0] : active.length === 1 ? active[0] : undefined;
  }

  if (!row) {
    return NextResponse.json(
      {
        error: "ambiguous_match",
        message: `${rows.length} lignes correspondent à ${disease_en} / ${country_en} (${active.length} active(s)) — préciser \`id\`.`,
        candidates: rows.map((r) => ({
          id: r.id, disease_en: r.disease_en, country_en: r.country_en,
          cases: r.cases, deaths: r.deaths, date: r.date, active: r.active,
          source_priority: r.source_priority,
        })),
      },
      { status: 409 },
    );
  }
  const patch: Record<string, unknown> = {};
  if (body.cases       !== undefined) patch.cases       = body.cases;
  if (body.deaths      !== undefined) patch.deaths      = body.deaths;
  if (body.date        !== undefined) patch.date        = body.date;
  if (body.source      !== undefined) patch.source      = body.source;
  if (body.active      !== undefined) patch.active      = body.active;
  if (body.description !== undefined) patch.description = body.description;

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "Nothing to patch" }, { status: 400 });
  }

  // ── Anti-regression guards ────────────────────────────────────────────────
  // Added 2026-08-23 after this endpoint overwrote the Ebola/DR Congo PHEIC row
  // (source_priority 10) with 534 cases / 93 deaths dated 2026-06-08, sourced
  // from DON606 — a real but superseded mid-May WHO edition. One click on a
  // "Correctifs QC" button in the admin panel, no confirmation, no trace. The
  // row had been at 5,021/2,378 (WHO AFRO Situation Report 14). It stayed wrong
  // for eight hours, on the dashboard's headline PHEIC banner, and cost a
  // morning of forensics that never found the cause — see
  // scripts/fix-ebola-drc-regression-2026-08-22.mjs, whose header rules out
  // every automated write path precisely because this one wasn't guarded.
  //
  // Every cron that writes cases/deaths runs these same guards; this endpoint
  // ran none, while being the ONLY writer a human can trigger by accident. The
  // guard chain caught an identical regression on West Nile/France in the very
  // same run that this endpoint let through.
  //
  // A downward correction IS sometimes the point of a manual QC fix, so this
  // blocks rather than forbids: the reason comes back to the caller, and
  // `force: true` applies the write anyway. The default is refusal.
  // `date` compte autant que cases/deaths : reculer la date seule est une
  // régression que dateFloorGuard attrape, et c'était précisément une des
  // quatre gardes qui auraient bloqué l'écriture du 22/08 (date de juin
  // réécrite par-dessus une ligne d'août).
  if (!body.force && (body.cases !== undefined || body.deaths !== undefined || body.date !== undefined)) {
    // Guards compare complete figures. When only one of the two is being
    // patched, the other keeps its current value — that is exactly the state
    // the row would end up in.
    const incoming = {
      cases:  body.cases  ?? row.cases  ?? 0,
      deaths: body.deaths ?? row.deaths ?? 0,
      date:   body.date   ?? row.date,
    };
    const blocked =
      lockedRowRegressionGuard(incoming, row) ??
      regressionGuard(incoming, row) ??
      deathsNeverDecreaseGuard(incoming, row) ??
      implausibleDeathsGuard(incoming) ??
      null;

    if (blocked) {
      return NextResponse.json(
        {
          error: "regression_blocked",
          reason: blocked,
          id: row.id,
          current: { cases: row.cases, deaths: row.deaths, date: row.date, source_priority: row.source_priority },
          attempted: { cases: incoming.cases, deaths: incoming.deaths, date: incoming.date },
          hint: "Relancer avec force: true si la correction à la baisse est intentionnelle et vérifiée à la source.",
        },
        { status: 409 },
      );
    }
  }

  // ── Description / figures coherence ───────────────────────────────────────
  // Item 15 of the daily security audit ("description figée après update des
  // chiffres"), on the one write path a human triggers by hand. Every
  // description this project writes restates the figures and the date in
  // prose, in all five locales — see buildMainDescriptions in
  // sync-drc-sitrep/route.ts: "5,021 confirmed cases and 2,378 deaths […] as
  // of 2026-08-17". Patch `cases` without patching `description` and the row
  // renders its new number in the counter and its old one in the paragraph
  // directly underneath, on the public outbreak page and in every alert email
  // built from it.
  //
  // Every cron writes the two together in one payload. This endpoint only
  // ASKED callers to, in a comment ("pass `description` explicitly alongside
  // cases/deaths"), which is the same convention-not-enforcement that let the
  // 22/08 Ebola/DR Congo write through — the guard chain above exists because
  // a convention on this endpoint had already failed once.
  //
  // Same shape as that guard chain, deliberately: refuse by default, name the
  // reason, offer an explicit override. `keep_description` is separate from
  // `force` on purpose — `force` asserts "this regression is intentional",
  // which says nothing about whether the prose still matches. Conflating them
  // would let one override silently carry the other.
  const figuresChanged =
    (body.cases  !== undefined && body.cases  !== row.cases) ||
    (body.deaths !== undefined && body.deaths !== row.deaths) ||
    (body.date   !== undefined && body.date   !== row.date);

  if (figuresChanged && body.description === undefined && !body.keep_description) {
    return NextResponse.json(
      {
        error: "description_would_contradict",
        message:
          "Les chiffres changent mais la description reste celle des anciens chiffres — elle les cite en toutes lettres dans les 5 langues. Fournir `description` (recalculée sur les nouveaux chiffres), ou `keep_description: true` si la description ne mentionne réellement aucun chiffre.",
        id: row.id,
        current: { cases: row.cases, deaths: row.deaths, date: row.date },
        attempted: {
          cases:  body.cases  ?? row.cases,
          deaths: body.deaths ?? row.deaths,
          date:   body.date   ?? row.date,
        },
        current_description: row.description,
      },
      { status: 409 },
    );
  }

  // Editing the English description invalidates existing FR/ES/AR/ID
  // translations — null them so sync-outbreaks' backfill sweep re-translates
  // from the new text (same pattern as admin/outbreaks/[id]). This endpoint
  // previously had no way to touch description at all, so a cases/deaths
  // correction here always left the old description text stale. Passing
  // `description` alongside the figures is no longer merely advised: the
  // coherence check above refuses the write without it.
  if ("description" in patch) {
    patch.description_fr = null;
    patch.description_es = null;
    patch.description_ar = null;
    patch.description_id = null;
  }

  try {
    const { error: updateErr } = await supabase
      .from("outbreaks")
      .update(patch)
      .eq("id", row.id);

    if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });

    return NextResponse.json({
      ok: true,
      id: row.id,
      before: { cases: row.cases, deaths: row.deaths, date: row.date, active: row.active },
      after: patch,
    });
  } catch (e) {
    return NextResponse.json({ error: errorMessage(e) }, { status: 500 });
  }
}
