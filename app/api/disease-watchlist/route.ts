import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

const PAID_PLANS = ["starter", "pro", "team", "enterprise"];

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("disease_watchlist")
    .eq("id", user.id)
    .single();

  return NextResponse.json({ watchlist: profile?.disease_watchlist ?? [] });
}

export async function PUT(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles").select("plan").eq("id", user.id).single();
  if (!PAID_PLANS.includes(profile?.plan ?? ""))
    return NextResponse.json({ error: "Pro plan required" }, { status: 403 });

  const body = await req.json() as { watchlist?: unknown };
  const watchlist = Array.isArray(body.watchlist)
    ? (body.watchlist as unknown[])
        .filter((d): d is string => typeof d === "string" && d.trim().length > 0)
        .map((d) => d.trim().slice(0, 64))
        .slice(0, 50)
    : [];

  const { error } = await supabase
    .from("profiles")
    .update({ disease_watchlist: watchlist })
    .eq("id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ watchlist });
}
