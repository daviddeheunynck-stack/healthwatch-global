// Supprime les lignes test parasites de la table subscriptions
// Usage: node scripts/cleanup-test-subs.mjs

import { readFileSync } from "fs";
import { createClient } from "@supabase/supabase-js";

const env = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const vars = {};
env.split("\n").forEach((line) => {
  if (!line || line.startsWith("#")) return;
  const idx = line.indexOf("=");
  if (idx < 0) return;
  vars[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
});

const BOM = "﻿";
const clean = (s) => (s || "").replace(BOM, "").trim();

const supabase = createClient(
  clean(vars["NEXT_PUBLIC_SUPABASE_URL"]),
  clean(vars["SUPABASE_SERVICE_ROLE_KEY"])
);

const TEST_EMAILS = [
  "test@example.com",
  "stripe@example.com",
  "stripe-webhook-test@healthwatch-global.com",
];

const { error, count } = await supabase
  .from("subscriptions")
  .delete({ count: "exact" })
  .in("email", TEST_EMAILS);

if (error) {
  console.error("Erreur:", error);
  process.exit(1);
}

console.log(`✅ ${count ?? "?"} ligne(s) test supprimée(s) : ${TEST_EMAILS.join(", ")}`);
