import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { createClient as createService } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const BOM   = String.fromCharCode(65279);
const clean = (v: string | undefined) => (v || "").replace(new RegExp("^" + BOM), "").trim();
const SUPABASE_URL     = clean(process.env.NEXT_PUBLIC_SUPABASE_URL);
const SUPABASE_SERVICE = clean(process.env.SUPABASE_SERVICE_ROLE_KEY);

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Find user's org
  const { data: membership } = await supabase
    .from("organization_members")
    .select("org_id")
    .eq("user_id", user.id)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();

  if (!membership) return NextResponse.json({ activity: [] });

  const svc = createService(SUPABASE_URL, SUPABASE_SERVICE);
  const { data: activity } = await svc
    .from("org_activity_log")
    .select("id, user_id, action, metadata, created_at")
    .eq("org_id", membership.org_id)
    .order("created_at", { ascending: false })
    .limit(20);

  return NextResponse.json({ activity: activity ?? [] });
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: membership } = await supabase
    .from("organization_members")
    .select("org_id")
    .eq("user_id", user.id)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();

  if (!membership) return NextResponse.json({ ok: false });

  const body = await req.json() as { action?: string; metadata?: Record<string, unknown> };
  const action = typeof body.action === "string" ? body.action.slice(0, 64) : "view_outbreak";
  const metadata = {
    ...(body.metadata ?? {}),
    user_email: user.email ?? "",
  };

  const svc = createService(SUPABASE_URL, SUPABASE_SERVICE);
  const { error } = await svc.from("org_activity_log").insert({
    org_id:  membership.org_id,
    user_id: user.id,
    action,
    metadata,
  });
  if (error) console.error("[org/activity] insert failed:", error.message);

  return NextResponse.json({ ok: true });
}
