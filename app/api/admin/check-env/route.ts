import { NextRequest, NextResponse } from "next/server";

const CRON_SECRET = (process.env.CRON_SECRET ?? "").trim();

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (!CRON_SECRET || auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const key = (process.env.ANTHROPIC_API_KEY ?? "").trim();
  const cron = (process.env.CRON_SECRET ?? "").trim();
  const supaUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();
  return NextResponse.json({
    llm_active: !!key,
    key_prefix: key ? key.slice(0, 14) + "..." : "(empty)",
    cron_present: !!cron,
    supabase_present: !!supaUrl,
    node_env: process.env.NODE_ENV,
    env_key_count: Object.keys(process.env).filter(k => k.includes("ANTHROPIC")).join(",") || "(none)",
  });
}
