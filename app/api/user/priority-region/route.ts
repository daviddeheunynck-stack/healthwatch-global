import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import * as Sentry from "@sentry/nextjs";
import { ALL_REGIONS } from "@/lib/activate-trial";

export const dynamic = "force-dynamic";

// POST /api/user/priority-region — resserre l'inscription aux alertes sur une
// seule region, pour les comptes crees par OAuth qui n'ont jamais vu la question
// du formulaire d'inscription (voir app/[locale]/welcome).
//
// activateTrial() les a deja inscrits aux cinq regions au moment du callback :
// cette route REMPLACE ces lignes, elle n'en ajoute pas. "all" est un choix
// explicite et ne touche a rien — c'est deja l'etat en base.
//
// Ecrit avec le client de session, pas le service role : la RLS de
// user_alert_regions autorise deja le proprietaire a supprimer ses propres
// lignes (meme chemin que PUT /api/alert-prefs), et il n'y a aucune raison
// d'elever les droits pour une preference que l'utilisateur pose lui-meme.
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let region: string | null = null;
  try {
    const body = await req.json() as { region?: string };
    if (typeof body?.region === "string") region = body.region;
  } catch { /* corps absent ou illisible — traite comme invalide ci-dessous */ }

  if (region === "all") {
    return NextResponse.json({ ok: true, regions: [...ALL_REGIONS] });
  }

  if (!region || !(ALL_REGIONS as readonly string[]).includes(region)) {
    return NextResponse.json({ error: "Invalid region" }, { status: 400 });
  }

  // Inserer AVANT de supprimer : si la suppression passe et que l'insertion
  // echoue, le compte se retrouve avec zero region et ne recoit plus jamais
  // d'alerte regionale sans que rien ne le signale — exactement la panne
  // silencieuse decrite dans PUT /api/alert-prefs. Dans l'autre ordre, le pire
  // cas est un sur-abonnement visible et corrigeable depuis la page compte.
  const { error: upsertErr } = await supabase
    .from("user_alert_regions")
    .upsert({ user_id: user.id, region, min_risk: "medium" }, { onConflict: "user_id,region" });

  if (upsertErr) {
    console.error("[user/priority-region] upsert failed:", upsertErr.message);
    Sentry.captureException(new Error(`[user/priority-region] upsert failed: ${upsertErr.message}`), {
      tags: { route: "user/priority-region", user_id: user.id },
    });
    await Sentry.flush(2000);
    return NextResponse.json({ error: "Failed to save" }, { status: 500 });
  }

  const others = ALL_REGIONS.filter((r) => r !== region);
  const { error: deleteErr } = await supabase
    .from("user_alert_regions")
    .delete()
    .eq("user_id", user.id)
    .in("region", others);

  if (deleteErr) {
    console.error("[user/priority-region] delete failed:", deleteErr.message);
    Sentry.captureException(new Error(`[user/priority-region] delete failed: ${deleteErr.message}`), {
      tags: { route: "user/priority-region", user_id: user.id },
    });
    await Sentry.flush(2000);
    // La region demandee est bien inscrite : ne pas renvoyer une erreur qui
    // ferait recommencer l'utilisateur. Le sur-abonnement restant est visible
    // et corrigeable depuis /account#regional-alerts.
    return NextResponse.json({ ok: true, partial: true, regions: [region] });
  }

  return NextResponse.json({ ok: true, regions: [region] });
}
