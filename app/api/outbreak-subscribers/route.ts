import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

const MAX_EMAILS = 50;

export async function GET(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const outbreakId = searchParams.get("outbreak_id") ?? "";
  if (!outbreakId) return NextResponse.json({ subscriber: null });

  const { data } = await supabase
    .from("outbreak_subscribers")
    .select("id, emails, locale")
    .eq("user_id", user.id)
    .eq("outbreak_id", outbreakId)
    .maybeSingle();

  return NextResponse.json({ subscriber: data ?? null });
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json() as {
    outbreak_id?: string;
    emails?: string[];
    locale?: string;
  };

  const outbreak_id = typeof body.outbreak_id === "string" ? body.outbreak_id.trim() : "";
  const rawEmails   = Array.isArray(body.emails) ? body.emails : [];
  const emails      = rawEmails
    .filter((e) => typeof e === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e))
    .slice(0, MAX_EMAILS);
  const locale = typeof body.locale === "string" ? body.locale.slice(0, 5) : "en";

  if (!outbreak_id) return NextResponse.json({ error: "outbreak_id required" }, { status: 400 });

  const { data, error } = await supabase
    .from("outbreak_subscribers")
    .upsert({ user_id: user.id, outbreak_id, emails, locale }, { onConflict: "user_id,outbreak_id" })
    .select("id, emails, locale")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ subscriber: data }, { status: 201 });
}

export async function DELETE(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const outbreakId = searchParams.get("outbreak_id") ?? "";

  const { error } = await supabase
    .from("outbreak_subscribers")
    .delete()
    .eq("user_id", user.id)
    .eq("outbreak_id", outbreakId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
