import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { isAdmin } from "@/lib/admin";
import { errorMessage } from "@/lib/error";

export const dynamic = "force-dynamic";
export const maxDuration = 65;

const BOM = String.fromCharCode(65279);
const clean = (v: string | undefined) => (v ?? "").replace(new RegExp("^" + BOM), "").trim();

// GET /api/admin/test-ecdc
// Runs the ECDC scraper synchronously and returns full logs — for debugging only.
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser().catch(() => ({ data: { user: null } }));
  if (!isAdmin(user?.email)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const host    = req.headers.get("host") ?? "localhost:3000";
  const proto   = host.startsWith("localhost") ? "http" : "https";
  const baseUrl = `${proto}://${host}`;
  const secret  = clean(process.env.CRON_SECRET);

  try {
    const res = await fetch(`${baseUrl}/api/cron/sync-ecdc-threats`, {
      headers: { Authorization: `Bearer ${secret}` },
      signal: AbortSignal.timeout(60_000),
    });
    const text = await res.text();
    try {
      return NextResponse.json({ httpStatus: res.status, ...JSON.parse(text) });
    } catch {
      return NextResponse.json({ httpStatus: res.status, raw: text.slice(0, 2000) });
    }
  } catch (e) {
    return NextResponse.json({ error: errorMessage(e) }, { status: 502 });
  }
}
