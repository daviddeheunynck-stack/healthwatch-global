import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { isAdmin } from "@/lib/admin";

export const dynamic = "force-dynamic";

const VALID_REGIONS = new Set(["africa", "asia", "europe", "americas", "oceania"]);
const VALID_RISK    = new Set(["high", "medium", "low"]);
const DATE_RE       = /^\d{4}-\d{2}-\d{2}$/;

const ALLOWED_FIELDS = new Set([
  "disease", "disease_en", "disease_ar",
  "country", "country_en", "country_ar",
  "region", "risk_level", "cases", "deaths",
  "lat", "lng", "date", "source", "description", "active",
]);

function pick(body: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(body).filter(([k]) => ALLOWED_FIELDS.has(k))
  );
}

function validatePatch(body: Record<string, unknown>): string | null {
  if (body.region     !== undefined && !VALID_REGIONS.has(body.region as string))     return `region must be one of: ${[...VALID_REGIONS].join(", ")}`;
  if (body.risk_level !== undefined && !VALID_RISK.has(body.risk_level as string))     return `risk_level must be one of: ${[...VALID_RISK].join(", ")}`;
  if (body.cases      !== undefined && (typeof body.cases  !== "number" || (body.cases  as number) < 0)) return "cases must be a non-negative number";
  if (body.deaths     !== undefined && (typeof body.deaths !== "number" || (body.deaths as number) < 0)) return "deaths must be a non-negative number";
  if (body.lat        !== undefined && (typeof body.lat !== "number" || (body.lat as number) < -90  || (body.lat  as number) > 90))  return "lat must be between -90 and 90";
  if (body.lng        !== undefined && (typeof body.lng !== "number" || (body.lng as number) < -180 || (body.lng  as number) > 180)) return "lng must be between -180 and 180";
  if (body.date       !== undefined && !DATE_RE.test(body.date as string))             return "date must be YYYY-MM-DD";
  if (body.active     !== undefined && typeof body.active !== "boolean")               return "active must be a boolean";
  if (Object.keys(pick(body)).length === 0)                                            return "no valid fields to update";
  return null;
}

// ─── PATCH — update outbreak (partial) ───────────────────────────────────────

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!isAdmin(user?.email)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;

  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 }); }

  const err = validatePatch(body);
  if (err) return NextResponse.json({ error: err }, { status: 422 });

  const safe = pick(body);
  const { error, data } = await supabase
    .from("outbreaks")
    .update(safe)
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// ─── DELETE — soft-delete (active = false) ────────────────────────────────────
// Physical deletion is intentionally avoided — preserves audit trail and
// prevents broken FK references in outbreak_alert_log.

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!isAdmin(user?.email)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;

  const { error, data } = await supabase
    .from("outbreaks")
    .update({ active: false })
    .eq("id", id)
    .select("id, active")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, ...data });
}
