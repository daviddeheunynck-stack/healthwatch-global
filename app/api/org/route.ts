import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { resolvedPlan } from "@/lib/resolved-plan";

export const dynamic = "force-dynamic";

const TEAM_PLANS = ["team", "enterprise"];
const MAX_SEATS: Record<string, number> = { team: 5, enterprise: 50 };

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles").select("plan").eq("id", user.id).single();
  const plan = profile?.plan ?? "free";

  // Find org (as owner or member)
  const { data: ownedOrg } = await supabase
    .from("organizations").select("id, name, owner_id, created_at").eq("owner_id", user.id).maybeSingle();

  if (ownedOrg) {
    const { data: members } = await supabase
      .from("organization_members")
      .select("id, invited_email, role, status, user_id, created_at")
      .eq("org_id", ownedOrg.id)
      .order("created_at", { ascending: true });

    return NextResponse.json({
      org: ownedOrg, role: "owner", plan,
      maxSeats: MAX_SEATS[plan] ?? 5,
      members: members ?? [],
    });
  }

  const { data: membership } = await supabase
    .from("organization_members")
    .select("id, org_id, role, status, organizations!inner(id, name, owner_id, created_at)")
    .eq("user_id", user.id).eq("status", "active").maybeSingle();

  if (membership) {
    const org = (membership as unknown as { organizations: { id: string; name: string; owner_id: string; created_at: string } }).organizations;
    const { data: members } = await supabase
      .from("organization_members")
      .select("id, invited_email, role, status, user_id, created_at")
      .eq("org_id", org.id)
      .order("created_at", { ascending: true });

    return NextResponse.json({
      org, role: membership.role, plan,
      maxSeats: MAX_SEATS[plan] ?? 5,
      members: members ?? [],
    });
  }

  return NextResponse.json({ org: null, role: null, plan, maxSeats: MAX_SEATS[plan] ?? 5, members: [] });
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles").select("plan, trial_ends_at, stripe_subscription_id").eq("id", user.id).single();
  if (!TEAM_PLANS.includes(resolvedPlan(profile)))
    return NextResponse.json({ error: "Team or Enterprise plan required" }, { status: 403 });

  const body = await req.json() as { name?: string };
  const name = (body.name ?? "").trim().slice(0, 80);
  if (!name) return NextResponse.json({ error: "Name required" }, { status: 400 });

  // One org per owner
  const { data: existing } = await supabase
    .from("organizations").select("id").eq("owner_id", user.id).maybeSingle();
  if (existing) return NextResponse.json({ error: "You already own an organization" }, { status: 409 });

  const { data, error } = await supabase
    .from("organizations")
    .insert({ name, owner_id: user.id })
    .select("id, name, owner_id, created_at").single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ org: data }, { status: 201 });
}
