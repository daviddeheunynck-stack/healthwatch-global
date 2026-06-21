import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

const PAID_PLANS  = ["pro", "team", "enterprise"];
const VALID_STEPS = new Set([
  "investigation",
  "lab_confirmation",
  "ihr_notification",
  "measures_deployed",
  "closed",
]);

export async function GET(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const outbreak_id = new URL(req.url).searchParams.get("outbreak_id");
  if (!outbreak_id) return NextResponse.json({ error: "outbreak_id required" }, { status: 400 });

  const { data: profile } = await supabase
    .from("profiles").select("plan").eq("id", user.id).single();
  if (!PAID_PLANS.includes(profile?.plan ?? ""))
    return NextResponse.json({ error: "Pro plan required" }, { status: 403 });

  const { data, error } = await supabase
    .from("outbreak_workflow")
    .select("id, step, responsible_email, notes, completed_by, completed_at")
    .eq("outbreak_id", outbreak_id)
    .order("completed_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ steps: data ?? [] });
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles").select("plan").eq("id", user.id).single();
  if (!PAID_PLANS.includes(profile?.plan ?? ""))
    return NextResponse.json({ error: "Pro plan required" }, { status: 403 });

  const body = await req.json() as {
    outbreak_id?: string;
    step?: string;
    responsible_email?: string;
    notes?: string;
  };

  if (!body.outbreak_id)
    return NextResponse.json({ error: "outbreak_id required" }, { status: 400 });
  if (!body.step || !VALID_STEPS.has(body.step))
    return NextResponse.json({ error: "Invalid step" }, { status: 400 });

  const { data, error } = await supabase
    .from("outbreak_workflow")
    .insert({
      outbreak_id:       body.outbreak_id,
      step:              body.step,
      responsible_email: body.responsible_email?.trim().slice(0, 255) || null,
      notes:             body.notes?.trim().slice(0, 500) || null,
      completed_by:      user.id,
    })
    .select("id, step, responsible_email, notes, completed_by, completed_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ step: data }, { status: 201 });
}
