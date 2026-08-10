import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { isAdmin } from "@/lib/admin";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

// Admin write operations: max 30 per IP per 10 minutes
function adminRateLimit(req: NextRequest) {
  const ip = getClientIp(req);
  return rateLimit(`admin:${ip}`, { limit: 30, windowMs: 10 * 60 * 1000 }); // Promise<Result> — callers must await
}

export const dynamic = "force-dynamic";

// ─── Validation ───────────────────────────────────────────────────────────────

const VALID_REGIONS    = new Set(["africa", "asia", "europe", "americas", "oceania"]);
const VALID_RISK       = new Set(["high", "medium", "low"]);
const DATE_RE          = /^\d{4}-\d{2}-\d{2}$/;

type OutbreakBody = {
  disease:      string;
  disease_en?:  string | null;
  disease_ar?:  string | null;
  country:      string;
  country_en?:  string | null;
  country_ar?:  string | null;
  region:       string;
  risk_level:   string;
  cases:        number;
  deaths:       number;
  lat:          number;
  lng:          number;
  date:         string;
  source?:      string | null;
  description?: string | null;
  active?:      boolean;
};

function validate(body: Partial<OutbreakBody>, requireAll = true): string | null {
  if (requireAll) {
    if (!body.disease?.trim())            return "disease is required";
    if (!body.country?.trim())            return "country is required";
    if (!body.region)                     return "region is required";
    if (!body.risk_level)                 return "risk_level is required";
    if (body.cases    === undefined)      return "cases is required";
    if (body.deaths   === undefined)      return "deaths is required";
    if (body.lat      === undefined)      return "lat is required";
    if (body.lng      === undefined)      return "lng is required";
    if (!body.date)                       return "date is required";
  }

  if (body.region    !== undefined && !VALID_REGIONS.has(body.region))     return `region must be one of: ${[...VALID_REGIONS].join(", ")}`;
  if (body.risk_level !== undefined && !VALID_RISK.has(body.risk_level))   return `risk_level must be one of: ${[...VALID_RISK].join(", ")}`;
  if (body.cases     !== undefined && (typeof body.cases  !== "number" || body.cases  < 0)) return "cases must be a non-negative number";
  if (body.deaths    !== undefined && (typeof body.deaths !== "number" || body.deaths < 0)) return "deaths must be a non-negative number";
  if (body.lat       !== undefined && (typeof body.lat !== "number" || body.lat < -90  || body.lat > 90))  return "lat must be between -90 and 90";
  if (body.lng       !== undefined && (typeof body.lng !== "number" || body.lng < -180 || body.lng > 180)) return "lng must be between -180 and 180";
  if (body.date      !== undefined && !DATE_RE.test(body.date))            return "date must be YYYY-MM-DD";

  return null;
}

// ─── Allowed fields for insert/update (prevent mass-assignment) ───────────────

const ALLOWED_FIELDS = new Set([
  "disease", "disease_en", "disease_ar",
  "country", "country_en", "country_ar",
  "region", "risk_level", "cases", "deaths",
  "lat", "lng", "date", "source", "description", "active",
]);

function pick(body: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(body).filter(([k]) => ALLOWED_FIELDS.has(k))
  );
}

// ─── GET — list all outbreaks (active + inactive) ─────────────────────────────

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!isAdmin(user?.email)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data, error } = await supabase
    .from("outbreaks")
    .select("*")
    .order("date", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// ─── POST — create outbreak ────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const rl = await adminRateLimit(req);
  if (!rl.allowed) return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!isAdmin(user?.email)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 }); }

  const err = validate(body as Partial<OutbreakBody>, true);
  if (err) return NextResponse.json({ error: err }, { status: 422 });

  const safe = pick(body);
  const { error, data } = await supabase.from("outbreaks").insert(safe).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
