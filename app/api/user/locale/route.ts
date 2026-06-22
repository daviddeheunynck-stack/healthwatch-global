import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase-server";

const PAID_PLANS = ["pro", "team", "enterprise"];
const VALID_LOCALES = ["en", "fr", "es", "ar", "id"] as const;

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { data } = await supabase
    .from("profiles")
    .select("plan, alert_locale")
    .eq("id", user.id)
    .single();

  if (!PAID_PLANS.includes(data?.plan ?? ""))
    return Response.json({ error: "Pro plan required" }, { status: 403 });

  return Response.json({ alert_locale: data?.alert_locale ?? "en" });
}

export async function PATCH(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("plan").eq("id", user.id).single();
  if (!PAID_PLANS.includes(profile?.plan ?? ""))
    return Response.json({ error: "Pro plan required" }, { status: 403 });

  const body = await req.json() as { alert_locale?: string };
  if (!VALID_LOCALES.includes(body.alert_locale as typeof VALID_LOCALES[number]))
    return Response.json({ error: "Invalid locale" }, { status: 400 });

  await supabase
    .from("profiles")
    .update({ alert_locale: body.alert_locale })
    .eq("id", user.id);

  return Response.json({ alert_locale: body.alert_locale });
}
