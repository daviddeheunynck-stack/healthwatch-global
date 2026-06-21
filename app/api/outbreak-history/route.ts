import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { createClient as createService } from "@supabase/supabase-js";

export async function GET(req: Request) {
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

  const { searchParams } = new URL(req.url);
  const outbreakId = searchParams.get("outbreak_id");
  const diseaseEn  = searchParams.get("disease_en");
  const countryEn  = searchParams.get("country_en");

  if (!outbreakId) return NextResponse.json({ error: "Missing outbreak_id" }, { status: 400 });

  // outbreak_snapshots has RLS with no public policy — needs service role
  const service = createService(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const [snapshotsRes, pastRes] = await Promise.all([
    service
      .from("outbreak_snapshots")
      .select("cases, deaths, snapped_at")
      .eq("outbreak_id", outbreakId)
      .order("snapped_at", { ascending: true })
      .limit(90),

    diseaseEn && countryEn
      ? service
          .from("outbreaks")
          .select("id, date, cases, deaths, risk_level")
          .eq("disease_en", diseaseEn)
          .eq("country_en", countryEn)
          .neq("id", outbreakId)
          .order("date", { ascending: false })
          .limit(5)
      : Promise.resolve({ data: [] }),
  ]);

  return NextResponse.json({
    snapshots:     snapshotsRes.data ?? [],
    pastOutbreaks: pastRes.data       ?? [],
  });
}
