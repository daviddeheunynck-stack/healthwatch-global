// Vérifie l'état des profils dans Supabase pour valider les webhook DB updates
// Usage: node scripts/check-webhook-db.mjs

import { readFileSync } from "fs";
import { createClient } from "@supabase/supabase-js";

// Lire .env.local manuellement
const env = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const vars = {};
env.split("\n").forEach((line) => {
  if (!line || line.startsWith("#")) return;
  const idx = line.indexOf("=");
  if (idx < 0) return;
  const k = line.slice(0, idx).trim();
  const v = line.slice(idx + 1).trim();
  vars[k] = v;
});

const BOM = "﻿";
const clean = (s) => (s || "").replace(BOM, "").trim();

const supabase = createClient(
  clean(vars["NEXT_PUBLIC_SUPABASE_URL"]),
  clean(vars["SUPABASE_SERVICE_ROLE_KEY"])
);

async function main() {
  console.log("\n=== WEBHOOK DB VALIDATION ===\n");

  // 1. Profils avec plan != free
  const { data: paidProfiles, error: e1 } = await supabase
    .from("profiles")
    .select("id, email, plan, stripe_customer_id, stripe_subscription_id, trial_ends_at, created_at")
    .neq("plan", "free");

  if (e1) { console.error("Error querying profiles:", e1); process.exit(1); }

  console.log(`Profils avec plan payant : ${paidProfiles.length}`);
  if (paidProfiles.length > 0) {
    paidProfiles.forEach((p) => {
      console.log(`  - ${p.email} | plan=${p.plan} | customer=${p.stripe_customer_id || "NULL"} | sub=${p.stripe_subscription_id || "NULL"} | trial_ends=${p.trial_ends_at || "NULL"}`);
    });
  }

  // 2. Profils avec stripe_customer_id (webhook a lié le customer)
  const { data: linkedProfiles, error: e2 } = await supabase
    .from("profiles")
    .select("id, email, plan, stripe_customer_id")
    .not("stripe_customer_id", "is", null);

  if (e2) { console.error("Error:", e2); process.exit(1); }

  console.log(`\nProfils avec stripe_customer_id lié : ${linkedProfiles.length}`);
  if (linkedProfiles.length > 0) {
    linkedProfiles.forEach((p) => {
      const ok = p.plan !== "free" ? "✅" : "⚠️  plan=free malgré customer lié";
      console.log(`  ${ok} ${p.email} | plan=${p.plan} | customer=${p.stripe_customer_id}`);
    });
  }

  // 3. Total profils
  const { count } = await supabase
    .from("profiles")
    .select("*", { count: "exact", head: true });
  console.log(`\nTotal profils en DB : ${count}`);

  // 4. Subscriptions table (digest)
  const { data: subs, error: e3 } = await supabase
    .from("subscriptions")
    .select("email, region, locale, active")
    .limit(10);

  if (!e3) {
    console.log(`\nSubscriptions digest (10 premières) : ${subs.length}`);
    subs.forEach((s) => console.log(`  - ${s.email} | region=${s.region} | locale=${s.locale} | active=${s.active}`));
  }

  // 5. Diagnostic webhook logic
  console.log("\n=== DIAGNOSTIC ===");
  if (paidProfiles.length === 0 && linkedProfiles.length === 0) {
    console.log("⚠️  Aucun profil payant ni customer lié.");
    console.log("   → Les webhooks retournent 200 MAIS metadata.user_id était absent lors des stripe trigger tests.");
    console.log("   → Le webhook ne peut pas mettre à jour la DB sans user_id dans les métadonnées.");
    console.log("\n   PROCHAINE ÉTAPE : tester avec un checkout réel depuis l'UI (mode test Stripe).");
  } else if (paidProfiles.length > 0) {
    const allLinked = paidProfiles.every((p) => p.stripe_customer_id);
    console.log(`✅ ${paidProfiles.length} profil(s) avec plan payant trouvé(s).`);
    console.log(`   stripe_customer_id lié : ${allLinked ? "OUI pour tous" : "PARTIEL ⚠️"}`);
  }
}

main().catch(console.error);
