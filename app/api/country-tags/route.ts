import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data } = await supabase
    .from("user_country_tags")
    .select("country_en, label")
    .eq("user_id", user.id)
    .order("country_en");

  return NextResponse.json({ tags: (data ?? []) as { country_en: string; label: string }[] });
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json() as { country_en?: string; label?: string };
  const country_en = typeof body.country_en === "string" ? body.country_en.trim() : "";
  const label      = typeof body.label      === "string" ? body.label.trim().slice(0, 80) : "";

  if (!country_en || !label)
    return NextResponse.json({ error: "country_en and label required" }, { status: 400 });

  const { error } = await supabase
    .from("user_country_tags")
    .upsert({ user_id: user.id, country_en, label }, { onConflict: "user_id,country_en" });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const country_en = searchParams.get("country_en") ?? "";

  const { error } = await supabase
    .from("user_country_tags")
    .delete()
    .eq("user_id", user.id)
    .eq("country_en", country_en);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
