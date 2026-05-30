import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { isAdmin } from "@/lib/admin";

export const dynamic = "force-dynamic";

const BOM = String.fromCharCode(65279);
const clean = (v: string | undefined) => (v || "").replace(new RegExp("^" + BOM), "").trim();

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!isAdmin(user?.email)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const baseUrl = clean(process.env.NEXT_PUBLIC_BASE_URL) || "http://localhost:3000";
  const secret = clean(process.env.CRON_SECRET);

  const res = await fetch(`${baseUrl}/api/cron/sync-outbreaks`, {
    headers: { Authorization: `Bearer ${secret}` },
  });

  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
