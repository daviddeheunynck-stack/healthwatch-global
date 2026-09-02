// NCDC (Nigeria Centre for Disease Control) sync — SUSPENDU depuis le 2026-09-02.
// Nigeria est un pays a forte charge d'epidemies (Lassa, cholera, mpox, diphterie,
// rougeole, meningite, fievre jaune) et NCDC publie des rapports de situation
// hebdomadaires avec des chiffres cumules souvent absents du DON de l'OMS ou plus
// recents que lui. L'implementation complete (parsing PDF, garde-fous anti-regression,
// dedup) reste dans l'historique git de ce fichier — voir avant le commit du 2026-09-02.
//
// ARRET LEGAL (2026-09-02) — CE QUI A CHANGE PAR RAPPORT AU "LEGAL" CI-DESSOUS :
// le PDF de chaque sitrep NCDC (verifie sur Diphterie Epi Week 3 et Lassa Epi Week 34,
// meme mention sur les deux) porte cette clause verbatim :
//   "The information contained in this document is confidential, privileged, and only
//    for the intended recipient and may not be used, published, or redistributed to
//    the public. A redacted version is available at http://ncdc.gov.ng/diseases/sitreps"
// Ce n'est pas une clause de CGU de site (ce que le paragraphe LEGAL ci-dessous avait
// verifie le 2026-07-06) mais une clause de confidentialite imprimee sur le DOCUMENT
// lui-meme, qui revendique le caractere privilegie du CONTENU, pas seulement de sa
// mise en forme — plus fort qu'un copyright classique sur la prose. Trouve en session
// interactive le 2026-09-02 en verifiant Diphterie/Nigeria et Polio/RDC a la demande de
// David ; confirme sur la ligne Fievre de Lassa/Nigeria (id 4dee8751-...), reecrite par
// ce cron le matin meme avec le PDF confidentiel cite tel quel dans le champ `source`
// public. David a valide l'arret ("Corrige").
//
// Ingestion desactivee (le handler ne fait plus que logguer un run "ok" pour que le
// health-check ne le voie pas comme mort). L'implementation retiree reste reutilisable
// via git history si une source de remplacement legitimement publique est trouvee (la
// page de listing ncdc.gov.ng/diseases/sitreps/?cat=N, elle, ne porte pas cette clause,
// mais pointer vers elle sans changer ce qui est extrait du PDF ne resoudrait pas le
// probleme : le contenu lui-meme, pas seulement l'URL du fichier, est revendique
// confidentiel). Ne pas reactiver sans nouvelle decision explicite de David — meme
// famille que legal_reliefweb_noncommercial et legal_cdc_australia_commercial_use_restriction.
//
// ── Ancien commentaire LEGAL (2026-07-06), conserve pour tracabilite — INCOMPLET,
//    ne couvrait que les CGU du site, pas la clause de confidentialite par document :
// "NCDC's terms of use are a user-conduct policy with no restriction on reusing its
//  published epidemiological data. We ingest only FACTS (cumulative confirmed cases,
//  deaths, CFR, reporting date) plus a link to NCDC's own sitrep page — facts are not
//  copyrightable and no NCDC ToS/licence forbids this."

import { NextRequest, NextResponse } from "next/server";
import { logCronRun } from "@/lib/cron-monitor";
import * as Sentry from "@sentry/nextjs";
import { createClient } from "@supabase/supabase-js";

export const dynamic     = "force-dynamic";
export const maxDuration = 120;

const BOM   = String.fromCharCode(65279);
const clean = (v: string | undefined) => (v ?? "").replace(new RegExp("^" + BOM), "").trim();

const SUPABASE_URL         = clean(process.env.NEXT_PUBLIC_SUPABASE_URL);
const SUPABASE_SERVICE_KEY = clean(process.env.SUPABASE_SERVICE_ROLE_KEY);
const CRON_SECRET          = clean(process.env.CRON_SECRET);

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (!CRON_SECRET || auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return NextResponse.json({ error: "env:missing" }, { status: 500 });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    const detail =
      "suspendu 2026-09-02 : chaque sitrep NCDC porte une clause de confidentialite sur son " +
      "contenu (voir en-tete du fichier) — aucune ingestion tant que non resolu";
    await logCronRun(supabase, "sync-ncdc", "ok", 0, detail);
    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      suspended: true,
      reason: "NCDC sitreps carry a per-document confidentiality clause — see file header, 2026-09-02",
    });
  } catch (err) {
    console.error("[sync-ncdc] uncaught exception:", err);
    Sentry.captureException(err, { tags: { cron: "sync-ncdc" } });
    await logCronRun(supabase, "sync-ncdc", "error", 0,
      err instanceof Error ? err.message : String(err));
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
