import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { createClient as createService } from "@supabase/supabase-js";
import { errorMessage } from "@/lib/error";
import * as Sentry from "@sentry/nextjs";

export const dynamic = "force-dynamic";

const BOM   = String.fromCharCode(65279);
const clean = (v: string | undefined) => (v || "").replace(new RegExp("^" + BOM), "").trim();

function getService() {
  return createService(
    clean(process.env.NEXT_PUBLIC_SUPABASE_URL),
    clean(process.env.SUPABASE_SERVICE_ROLE_KEY)
  );
}

// GET /api/team/members — return team + members + pending invites for the caller's team
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const service = getService();

  const { data: profile } = await service
    .from("profiles")
    .select("team_id")
    .eq("id", user.id)
    .single();

  if (!profile?.team_id) return NextResponse.json({ error: "Not on a team" }, { status: 404 });

  const [teamRes, membersRes, invitesRes] = await Promise.all([
    service
      .from("teams")
      .select("id, name, owner_id, max_seats, created_at")
      .eq("id", profile.team_id)
      .single(),
    service
      .from("team_members")
      .select("id, user_id, role, joined_at")
      .eq("team_id", profile.team_id)
      .order("joined_at"),
    service
      .from("team_invites")
      .select("id, email, created_at, expires_at")
      .eq("team_id", profile.team_id)
      .is("accepted_at", null)
      .gt("expires_at", new Date().toISOString())
      .order("created_at"),
  ]);

  // Fetch member emails separately (team_members.user_id → auth.users, not directly profiles)
  const memberIds = (membersRes.data ?? []).map((m) => m.user_id);
  const { data: profilesData } = memberIds.length > 0
    ? await service.from("profiles").select("id, email").in("id", memberIds)
    : { data: [] };

  const profileMap = Object.fromEntries((profilesData ?? []).map((p) => [p.id, p.email ?? ""]));
  const members = (membersRes.data ?? []).map((m) => ({
    ...m,
    email: profileMap[m.user_id] ?? "",
  }));

  return NextResponse.json({
    team:    teamRes.data,
    members,
    invites: invitesRes.data ?? [],
    isOwner: teamRes.data?.owner_id === user.id,
  });
}

// DELETE /api/team/members — remove a member (owner only)
export async function DELETE(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { userId?: string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  if (!body.userId) return NextResponse.json({ error: "userId required" }, { status: 400 });
  if (body.userId === user.id) return NextResponse.json({ error: "Cannot remove yourself" }, { status: 400 });

  const service = getService();

  const { data: callerProfile } = await service
    .from("profiles")
    .select("team_id")
    .eq("id", user.id)
    .single();

  if (!callerProfile?.team_id) return NextResponse.json({ error: "Not on a team" }, { status: 404 });

  const { data: team } = await service
    .from("teams")
    .select("owner_id")
    .eq("id", callerProfile.team_id)
    .single();

  if (team?.owner_id !== user.id) {
    return NextResponse.json({ error: "Only the team owner can remove members" }, { status: 403 });
  }

  const { error: removeErr } = await service
    .from("team_members")
    .delete()
    .eq("team_id", callerProfile.team_id)
    .eq("user_id", body.userId);

  if (removeErr) {
    console.error("[team/members] remove error:", errorMessage(removeErr));
    Sentry.captureException(removeErr, { tags: { route: "team-members" } });
    return NextResponse.json({ error: "Failed to remove member" }, { status: 500 });
  }

  // Reset removed member's plan — preserve if they have an active individual Stripe subscription
  const { data: removedProfile } = await service
    .from("profiles")
    .select("plan, stripe_subscription_id")
    .eq("id", body.userId)
    .single();
  const restoredPlan = removedProfile?.stripe_subscription_id ? removedProfile.plan : "free";
  await service
    .from("profiles")
    .update({ plan: restoredPlan, team_id: null })
    .eq("id", body.userId);

  return NextResponse.json({ ok: true });
}
