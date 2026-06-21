import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

const VALID_REGIONS = ["all", "africa", "asia", "europe", "americas", "oceania"] as const;

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data } = await supabase
    .from("profiles")
    .select("display_filters, plan")
    .eq("id", user.id)
    .single();

  const isPaid = ["starter", "pro", "team", "enterprise"].includes(data?.plan ?? "");
  if (!isPaid) return NextResponse.json({ filters: null });

  return NextResponse.json({ filters: data?.display_filters ?? null });
}

export async function PUT(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("plan")
    .eq("id", user.id)
    .single();

  const isPaid = ["starter", "pro", "team", "enterprise"].includes(profile?.plan ?? "");
  if (!isPaid) return NextResponse.json({ error: "Pro plan required" }, { status: 403 });

  const body = await req.json();
  const region  = VALID_REGIONS.includes(body.region) ? body.region : "all";
  const country = typeof body.country === "string" ? body.country : "all";

  const filters = region === "all" && country === "all" ? null : { region, country };

  await supabase
    .from("profiles")
    .update({ display_filters: filters })
    .eq("id", user.id);

  return NextResponse.json({ ok: true, filters });
}
