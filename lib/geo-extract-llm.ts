import Anthropic from "@anthropic-ai/sdk";

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
]);

const SYSTEM_PROMPT =
  "Extract the specific sub-national location (province, state, region, district, or health zone) " +
  "from this WHO disease outbreak bulletin text. Return ONLY the location name " +
  "(e.g. 'North Kivu Province', 'Lagos State', 'Aden Governorate', 'Ayeyarwady Region') " +
  "or the word 'none' if no specific sub-national location is mentioned. " +
  "Do not include the country name. Do not explain. One line only.";

export async function extractAdmin1LLM(text: string): Promise<string | null> {
  const apiKey = (process.env.ANTHROPIC_API_KEY ?? "").trim();
  if (!apiKey) return null;

  try {
    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 60,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: text.slice(0, 3000) }],
    });

    const raw = (
      response.content[0]?.type === "text" ? response.content[0].text : ""
    ).trim();

    if (!raw) return null;
    if (NOISE_RESPONSES.has(raw.toLowerCase())) return null;
    // Sanity-check length: reject single words under 4 chars or extremely long strings
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
