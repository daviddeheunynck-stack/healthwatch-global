import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { isAdmin } from "@/lib/admin";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { GET as runSync } from "@/app/api/cron/sync-outbreaks/route";

export const dynamic = "force-dynamic";

const BOM = String.fromCharCode(65279);
const clean = (v: string | undefined) => (v || "").replace(new RegExp("^" + BOM), "").trim();

// Sync is expensive — max 5 manual triggers per IP per hour
export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const rl = rateLimit(`admin-sync:${ip}`, { limit: 5, windowMs: 60 * 60 * 1000 });
  if (!rl.allowed) return NextResponse.json({ error: "Too many sync requests — wait before retrying" }, { status: 429 });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!isAdmin(user?.email)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const baseUrl = clean(process.env.NEXT_PUBLIC_BASE_URL) || "http://localhost:3000";
  const secret = clean(process.env.CRON_SECRET);

  // Call the cron handler directly in-process — avoids HTTP self-referential
  // fetch (which can block in dev and timeout on Vercel serverless).
  const cronReq = new NextRequest(`${baseUrl}/api/cron/sync-outbreaks`, {
    headers: { Authorization: `Bearer ${secret}` },
  });
  return runSync(cronReq);
}
