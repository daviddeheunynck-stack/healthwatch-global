import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { createClient as createService } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const BOM      = String.fromCharCode(65279);
const clean    = (v: string | undefined) => (v || "").replace(new RegExp("^" + BOM), "").trim();
const BASE_URL = clean(process.env.NEXT_PUBLIC_BASE_URL) || "https://healthwatch-global.com";

function getService() {
  return createService(
    clean(process.env.NEXT_PUBLIC_SUPABASE_URL),
    clean(process.env.SUPABASE_SERVICE_ROLE_KEY)
  );
}

// GET /api/team/accept?token=XXX&locale=fr
// Accepts a team invite for the authenticated user.
// If not authenticated, redirects to login with this URL as the redirect target.
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const token  = searchParams.get("token");
  const locale = searchParams.get("locale") || "en";

  if (!token) {
    return NextResponse.redirect(`${BASE_URL}/${locale}?error=invalid_invite`);
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    const self = encodeURIComponent(`/api/team/accept?token=${token}&locale=${locale}`);
    return NextResponse.redirect(`${BASE_URL}/${locale}/login?redirect=${self}`);
  }

  const service = getService();

  // Validate invite
  const { data: invite } = await service
    .from("team_invites")
    .select("id, team_id, email, accepted_at, expires_at")
    .eq("token", token)
    .single();

  if (!invite) {
    return NextResponse.redirect(`${BASE_URL}/${locale}/account/team?error=invite_not_found`);
  }
  if (invite.accepted_at) {
    return NextResponse.redirect(`${BASE_URL}/${locale}/account/team?error=invite_already_accepted`);
  }
  if (new Date(invite.expires_at) < new Date()) {
    return NextResponse.redirect(`${BASE_URL}/${locale}/account/team?error=invite_expired`);
  }

  // Get team
  const { data: team } = await service
    .from("teams")
    .select("id, name, max_seats")
    .eq("id", invite.team_id)
    .single();

  if (!team) {
    return NextResponse.redirect(`${BASE_URL}/${locale}/account/team?error=team_not_found`);
  }

  // Already a member?
  const { data: existing } = await service
    .from("team_members")
    .select("id")
    .eq("team_id", team.id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (existing) {
    return NextResponse.redirect(`${BASE_URL}/${locale}/account/team`);
  }

  // Check seat capacity
  const { count } = await service
    .from("team_members")
    .select("id", { count: "exact", head: true })
    .eq("team_id", team.id);

  if ((count ?? 0) >= team.max_seats) {
    return NextResponse.redirect(`${BASE_URL}/${locale}/account/team?error=team_full`);
  }

  // Add to team
  const { error: memberErr } = await service
    .from("team_members")
    .insert({ team_id: team.id, user_id: user.id, role: "member" });

  if (memberErr) {
    console.error("[team/accept] insert member:", memberErr);
    return NextResponse.redirect(`${BASE_URL}/${locale}/account/team?error=server_error`);
  }

  // Upgrade invitee's profile to team
  await service
    .from("profiles")
    .update({ plan: "team", team_id: team.id })
    .eq("id", user.id);

  // Mark invite accepted
  await service
    .from("team_invites")
    .update({ accepted_at: new Date().toISOString() })
    .eq("id", invite.id);

  return NextResponse.redirect(`${BASE_URL}/${locale}/account/team`);
}
