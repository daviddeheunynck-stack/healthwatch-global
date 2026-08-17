import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { resolvedPlan } from "@/lib/resolved-plan";

export const dynamic = "force-dynamic";

const PAID_PLANS = ["pro", "team", "enterprise"];

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles").select("plan, trial_ends_at, stripe_subscription_id").eq("id", user.id).single();
  if (!PAID_PLANS.includes(resolvedPlan(profile)))
    return NextResponse.json({ error: "Pro plan required" }, { status: 403 });

  const { id } = await params;
  // The `as { active?: boolean }` cast was a compile-time assertion only: nothing
  // checked the runtime type. A body of `{}` serialized `active: undefined`, which
  // JSON.stringify drops — the update became a no-op that still answered
  // `{ ok: true }`. A non-boolean value reached Postgres and came back as a raw
  // driver 500 instead of a 400.
  const body = await req.json().catch(() => null) as { active?: unknown } | null;
  if (typeof body?.active !== "boolean")
    return NextResponse.json({ error: "active must be a boolean" }, { status: 400 });

  // .select("id") so an id that doesn't exist (or belongs to another user, which
  // the user_id filter turns into the same 0-row outcome) is visible as 0 affected
  // rows rather than reported as a successful toggle — same pattern the outbreaks
  // writes use for their source_priority guard.
  const { data: updated, error } = await supabase
    .from("webhooks")
    .update({ active: body.active })
    .eq("id", id)
    .eq("user_id", user.id)
    .select("id");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!updated || updated.length === 0)
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const { error } = await supabase
    .from("webhooks")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
