import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";

// Module-level cache so Supabase isn't hit on every call within one function invocation
let _cachedKey: string | null = null;

async function resolveAnthropicKey(): Promise<string> {
  // 1. process.env (local dev + works if Vercel ever picks it up)
  const envKey = (process.env.ANTHROPIC_API_KEY ?? "").trim();
  if (envKey) return envKey;

  // 2. In-process cache
  if (_cachedKey !== null) return _cachedKey;

  // 3. Supabase app_settings fallback (used in Vercel production)
  try {
    const url = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();
    const svc = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim();
    if (!url || !svc) return "";
    const supabase = createClient(url, svc);
    const { data } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "ANTHROPIC_API_KEY")
      .single();
    _cachedKey = (data?.value ?? "").trim() || "";
    return _cachedKey;
  } catch {
    return "";
  }
}

// Responses Haiku gives when no specific sub-national location is found
const NOISE_RESPONSES = new Set([
  "none",
  "n/a",
  "unknown",
  "not mentioned",
  "not specified",
  "not available",
  "no specific location",
  "no sub-national location",
  "no specific sub-national location",
  // WHO/PAHO regional constructs — not sub-national locations
  "who region",
  "who african region",
  "who american region",
  "who european region",
  "who eastern mediterranean region",
  "who south-east asia region",
  "who western pacific region",
  "african region",
  "european region",
  "americas region",
  "eastern mediterranean region",
  "south-east asia region",
  "western pacific region",
  "the state",
  "the province",
  "the region",
  "the district",
  "the zone",
]);

export async function extractAdmin1LLM(
  text: string,
  countryEn?: string
): Promise<string | null> {
  const apiKey = await resolveAnthropicKey();
  if (!apiKey) return null;

  const countryClause = countryEn
    ? ` within ${countryEn} (ignore sub-national locations from neighboring or other countries)`
    : "";
  const systemPrompt =
    `Extract the single most specific sub-national location (province, state, region, district, or health zone)` +
    ` WHERE THE OUTBREAK IS OCCURRING${countryClause} from this WHO disease outbreak bulletin text.` +
    ` If the outbreak spans multiple provinces, return only the PRIMARY or FIRST one mentioned.` +
    ` Return ONLY the location name (e.g. 'North Kivu Province', 'Lagos State', 'Aden Governorate')` +
    ` or the word 'none' if no specific sub-national location is mentioned.` +
    ` Do not include the country name. Do not list multiple locations. Do not explain. One line only.`;

  try {
    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 60,
      system: systemPrompt,
      messages: [{ role: "user", content: text.slice(0, 3000) }],
    });

    const raw = (
      response.content[0]?.type === "text" ? response.content[0].text : ""
    ).trim();

    if (!raw) return null;
    if (NOISE_RESPONSES.has(raw.toLowerCase())) return null;
    // Sanity-check length
    if (raw.length < 4 || raw.length > 80) return null;

    return raw;
  } catch (err) {
    console.warn(
      "[geo-extract-llm] Haiku API error:",
      err instanceof Error ? err.message : String(err)
    );
    return null;
  }
}
