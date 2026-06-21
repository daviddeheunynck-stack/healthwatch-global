import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Must be org owner
  const { data: org } = await supabase
    .from("organizations").select("id").eq("owner_id", user.id).maybeSingle();
  if (!org) return NextResponse.json({ error: "Not an org owner" }, { status: 403 });

  const { error } = await supabase
    .from("organization_members")
    .delete()
    .eq("id", id)
    .eq("org_id", org.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
