import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { resolvedPlan } from "@/lib/resolved-plan";

const PAID_PLANS = ["starter", "pro", "team", "enterprise"];

export async function GET(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("plan, trial_ends_at, stripe_subscription_id")
    .eq("id", user.id)
    .single();

  if (!PAID_PLANS.includes(resolvedPlan(profile))) {
    return NextResponse.json({ error: "Pro plan required" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const outbreakId = searchParams.get("outbreak_id");
  if (!outbreakId) return NextResponse.json({ error: "Missing outbreak_id" }, { status: 400 });

  const { data, error } = await supabase
    .from("outbreak_notes")
    .select("id, note, status, author_email, user_id, created_at")
    .eq("outbreak_id", outbreakId)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ notes: data ?? [] });
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("plan, trial_ends_at, stripe_subscription_id, team_id, email")
    .eq("id", user.id)
    .single();

  if (!PAID_PLANS.includes(resolvedPlan(profile))) {
    return NextResponse.json({ error: "Pro plan required" }, { status: 403 });
  }

  const body = await req.json();
  const note  = typeof body.note === "string" ? body.note.trim().slice(0, 1000) : "";
  const outbreakId = typeof body.outbreak_id === "string" ? body.outbreak_id : null;
  const status = ["monitoring", "investigating", "closed"].includes(body.status)
    ? body.status as string : null;

  if (!note || !outbreakId) {
    return NextResponse.json({ error: "Missing note or outbreak_id" }, { status: 400 });
  }

  const isTeam = profile?.plan === "team" || profile?.plan === "enterprise";

  const { data, error } = await supabase
    .from("outbreak_notes")
    .insert({
      outbreak_id:  outbreakId,
      user_id:      user.id,
      team_id:      isTeam ? (profile?.team_id ?? null) : null,
      note,
      status:       status ?? null,
      author_email: profile?.email ?? user.email ?? "",
    })
    .select("id, note, status, author_email, user_id, created_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ note: data });
}
