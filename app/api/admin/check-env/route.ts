import { NextRequest, NextResponse } from "next/server";

const CRON_SECRET = (process.env.CRON_SECRET ?? "").trim();

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (!CRON_SECRET || auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const envKey = (process.env.ANTHROPIC_API_KEY ?? "").trim();
  const cron = (process.env.CRON_SECRET ?? "").trim();
  const supaUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();

  // Try Supabase fallback
  let supaKey = "";
  if (!envKey && supaUrl && (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim()) {
    const { createClient } = await import("@supabase/supabase-js");
    const sb = createClient(supaUrl, (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim());
    const { data } = await sb.from("app_settings").select("value").eq("key", "ANTHROPIC_API_KEY").single();
    supaKey = (data?.value ?? "").trim();
  }

  const resolvedKey = envKey || supaKey;
  return NextResponse.json({
    llm_active: !!resolvedKey,
    key_source: envKey ? "env" : supaKey ? "supabase" : "none",
    key_prefix: resolvedKey ? resolvedKey.slice(0, 14) + "..." : "(empty)",
    cron_present: !!cron,
    supabase_present: !!supaUrl,
    node_env: process.env.NODE_ENV,
  });
}
