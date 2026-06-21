import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

// GET /api/org/accept-invite?token=X — public, returns org name for display
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token") ?? "";
  if (!token) return NextResponse.json({ org: null });

  const supabase = await createClient();
  const { data } = await supabase
    .from("organization_members")
    .select("id, status, organizations!inner(name)")
    .eq("invite_token", token)
    .eq("status", "pending")
    .maybeSingle();

  if (!data) return NextResponse.json({ org: null });
  const orgName = (data as unknown as { organizations: { name: string } }).organizations.name;
  return NextResponse.json({ org: { name: orgName } });
}

// POST /api/org/accept-invite — requires auth
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json() as { token?: string };
  const token = (body.token ?? "").trim();
  if (!token) return NextResponse.json({ error: "Token required" }, { status: 400 });

  const { data: member } = await supabase
    .from("organization_members")
    .select("id, status, invited_email")
    .eq("invite_token", token)
    .eq("status", "pending")
    .maybeSingle();

  if (!member) return NextResponse.json({ error: "Invalid or expired invitation" }, { status: 404 });

  const { error } = await supabase
    .from("organization_members")
    .update({ status: "active", user_id: user.id })
    .eq("id", member.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
