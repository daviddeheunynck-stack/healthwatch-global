import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const envLines = readFileSync(join(__dirname, "../.env.local"), "utf8").split("\n");
const env = {};
for (const line of envLines) {
  const m = line.match(/^([^#=\s]+)\s*=\s*(.*)$/);
  if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
}

const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const { data, error } = await sb.from("outbreaks")
  .select("disease,disease_en,country")
  .eq("active", true)
  .order("disease");

if (error) { console.error("DB error:", error.message); process.exit(1); }
console.log("Total active rows fetched:", data?.length ?? 0);
const active = data ?? [];

console.log("Active outbreaks — disease field audit:");
for (const o of active) {
  const flag = (!o.disease_en || o.disease_en === o.disease) ? "⚠️ NO EN" : "✓";
  console.log(`  ${flag}  disease="${o.disease}"  disease_en="${o.disease_en ?? "NULL"}"  country="${o.country}"`);
}
