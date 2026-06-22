import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase-server";

const PAID_PLANS   = ["pro", "team", "enterprise"];
const VALID_REGIONS = ["all", "africa", "asia", "americas", "europe", "oceania"] as const;

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { data } = await supabase
    .from("profiles")
    .select("plan, digest_region")
    .eq("id", user.id)
    .single();

  if (!PAID_PLANS.includes(data?.plan ?? ""))
    return Response.json({ error: "Pro plan required" }, { status: 403 });

  return Response.json({ digest_region: data?.digest_region ?? "all" });
}

export async function PATCH(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("plan").eq("id", user.id).single();
  if (!PAID_PLANS.includes(profile?.plan ?? ""))
    return Response.json({ error: "Pro plan required" }, { status: 403 });

  const body = await req.json() as { digest_region?: string };
  if (!VALID_REGIONS.includes(body.digest_region as typeof VALID_REGIONS[number]))
    return Response.json({ error: "Invalid region" }, { status: 400 });

  await supabase.from("profiles").update({ digest_region: body.digest_region }).eq("id", user.id);
  return Response.json({ digest_region: body.digest_region });
}
