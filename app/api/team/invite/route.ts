import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { createClient as createService } from "@supabase/supabase-js";
import { buildTeamInviteEmail } from "@/lib/team-invite-email";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { errorMessage } from "@/lib/error";

export const dynamic = "force-dynamic";

const BOM      = String.fromCharCode(65279);
const clean    = (v: string | undefined) => (v || "").replace(new RegExp("^" + BOM), "").trim();
const BREVO_KEY = clean(process.env.BREVO_API_KEY);
const BASE_URL  = clean(process.env.NEXT_PUBLIC_BASE_URL) || "https://healthwatch-global.com";

function getService() {
  return createService(
    clean(process.env.NEXT_PUBLIC_SUPABASE_URL),
    clean(process.env.SUPABASE_SERVICE_ROLE_KEY)
  );
}

async function sendInviteEmail(to: string, subject: string, html: string) {
  if (!BREVO_KEY) return;
  await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "api-key": BREVO_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({
      sender:      { name: "HealthWatch Global", email: "alerts@healthwatch-global.com" },
      to:          [{ email: to }],
      subject,
      htmlContent: html,
    }),
  });
}

// POST /api/team/invite — create and send an invite
export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const rl = rateLimit(`team-invite:${ip}`, { limit: 20, windowMs: 60 * 60 * 1000 });
  if (!rl.allowed) return NextResponse.json({ error: "Rate limit exceeded." }, { status: 429 });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { email?: string; locale?: string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const email  = (body.email || "").trim().toLowerCase();
  const locale = body.locale || "en";

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Invalid email" }, { status: 400 });
  }

  const service = getService();

  // Verify caller has a team plan and owns a team
  const { data: profile } = await service
    .from("profiles")
    .select("plan, team_id")
    .eq("id", user.id)
    .single();

  if (profile?.plan !== "team") {
    return NextResponse.json({ error: "Team plan required" }, { status: 403 });
  }
  if (!profile?.team_id) {
    return NextResponse.json({ error: "No team found. Visit /account/team first." }, { status: 400 });
  }

  const { data: team } = await service
    .from("teams")
    .select("id, name, owner_id, max_seats")
    .eq("id", profile.team_id)
    .single();

  if (!team || team.owner_id !== user.id) {
    return NextResponse.json({ error: "Only the team owner can send invites" }, { status: 403 });
  }

  // Check seat capacity
  const { count: memberCount } = await service
    .from("team_members")
    .select("id", { count: "exact", head: true })
    .eq("team_id", team.id);

  if ((memberCount ?? 0) >= team.max_seats) {
    return NextResponse.json({ error: `Team full (${team.max_seats} seats max)` }, { status: 409 });
  }

  // Invitee already a member of this team?
  const { data: existingMemberProfile } = await service
    .from("profiles")
    .select("id, team_id")
    .eq("email", email)
    .maybeSingle();

  if (existingMemberProfile?.team_id === team.id) {
    return NextResponse.json({ error: "Already a member of this team" }, { status: 409 });
  }

  // Pending invite already exists?
  const { data: existingInvite } = await service
    .from("team_invites")
    .select("id")
    .eq("team_id", team.id)
    .eq("email", email)
    .is("accepted_at", null)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  if (existingInvite) {
    return NextResponse.json({ error: "A pending invite already exists for this email" }, { status: 409 });
  }

  // Create invite row
  const { data: invite, error: inviteErr } = await service
    .from("team_invites")
    .insert({ team_id: team.id, email, invited_by: user.id })
    .select("token")
    .single();

  if (inviteErr || !invite) {
    console.error("[team/invite] insert error:", inviteErr);
    return NextResponse.json({ error: "Failed to create invite" }, { status: 500 });
  }

  // Get inviter email for the email body
  const { data: inviterProfile } = await service
    .from("profiles")
    .select("email")
    .eq("id", user.id)
    .single();

  const inviterEmail = inviterProfile?.email || user.email || "A team member";
  const acceptUrl    = `${BASE_URL}/api/team/accept?token=${invite.token}&locale=${locale}`;

  try {
    const { subject, html } = buildTeamInviteEmail(inviterEmail, team.name, acceptUrl, locale);
    await sendInviteEmail(email, subject, html);
  } catch (err) {
    // Non-fatal — invite exists even if email fails
    console.error("[team/invite] email error:", errorMessage(err));
  }

  return NextResponse.json({ ok: true });
}

// DELETE /api/team/invite — revoke a pending invite
export async function DELETE(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { inviteId?: string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  if (!body.inviteId) return NextResponse.json({ error: "inviteId required" }, { status: 400 });

  const service = getService();

  const { data: invite } = await service
    .from("team_invites")
    .select("id, team_id")
    .eq("id", body.inviteId)
    .single();

  if (!invite) return NextResponse.json({ error: "Invite not found" }, { status: 404 });

  const { data: team } = await service
    .from("teams")
    .select("owner_id")
    .eq("id", invite.team_id)
    .single();

  if (team?.owner_id !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await service.from("team_invites").delete().eq("id", body.inviteId);

  return NextResponse.json({ ok: true });
}
