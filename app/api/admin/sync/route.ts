import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { isAdmin } from "@/lib/admin";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { errorMessage } from "@/lib/error";

export const dynamic = "force-dynamic";

const BOM = String.fromCharCode(65279);
const clean = (v: string | undefined) => (v || "").replace(new RegExp("^" + BOM), "").trim();

// Sync is expensive — max 5 manual triggers per IP per hour
export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const rl = await rateLimit(`admin-sync:${ip}`, { limit: 5, windowMs: 60 * 60 * 1000 });
  if (!rl.allowed) return NextResponse.json({ error: "Too many sync requests — wait before retrying" }, { status: 429 });

  const supabase = await createClient();
  const authResult = await supabase.auth.getUser().catch(() => null);
  if (!authResult) return NextResponse.json({ error: "Auth service unreachable" }, { status: 503 });
  const { data: { user } } = authResult;
  if (!isAdmin(user?.email)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Derive base URL from the incoming request host — correct in every environment
  // (avoids NEXT_PUBLIC_BASE_URL falling back to http://localhost:3000 in serverless)
  const host   = req.headers.get("host") ?? "localhost:3000";
  const proto  = host.startsWith("localhost") ? "http" : "https";
  const baseUrl = `${proto}://${host}`;
  const secret  = clean(process.env.CRON_SECRET);

  // Fire all supplementary scrapers as independent Vercel function invocations —
  // none of these block the response; each runs to its own maxDuration.
  const supplementary = [
    "/api/cron/sync-who-regional",   // endemic disease targets — Americas + Asia + EU (150s)
    "/api/cron/sync-ecdc-threats",   // ECDC epidemiological updates RSS — EU/EEA (60s)
    "/api/cron/sync-paho-alerts",    // PAHO epidemiological alerts — Americas (60s)
  ];
  for (const path of supplementary) {
    fetch(`${baseUrl}${path}`, { headers: { Authorization: `Bearer ${secret}` } })
      .catch((e) => console.error(`[admin-sync] ${path}:`, errorMessage(e)));
  }

  let res: Response;
  try {
    res = await fetch(`${baseUrl}/api/cron/sync-outbreaks`, {
      headers: { Authorization: `Bearer ${secret}` },
      signal: AbortSignal.timeout(120_000),
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: `Cron endpoint unreachable: ${errorMessage(e)}` },
      { status: 502 }
    );
  }

  const text = await res.text();
  try {
    const data = JSON.parse(text);
    return NextResponse.json(
      { ...data, regional_sync: "started" },
      { status: res.status }
    );
  } catch {
    return NextResponse.json(
      { error: `Sync HTTP ${res.status}`, detail: text.slice(0, 400) },
      { status: 502 }
    );
  }
}
