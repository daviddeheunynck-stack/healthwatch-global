// Crée ou remet à zéro le compte test E2E via Supabase Admin API
// Usage: node scripts/setup-test-user.mjs
// Résultat : TEST_USER_EMAIL=e2e@healthwatch-global.com TEST_USER_PASSWORD=HWGtest2026!

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

const BOM   = "﻿";
const clean = (s) => (s || "").replace(BOM, "").trim().replace(/^"(.*)"$/, "$1");

const supabase = createClient(
  clean(vars["NEXT_PUBLIC_SUPABASE_URL"]),
  clean(vars["SUPABASE_SERVICE_ROLE_KEY"]),
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const TEST_EMAIL    = "e2e@healthwatch-global.com";
const TEST_PASSWORD = "HWGtest2026!";

// 1. Supprimer l'ancien compte si existant
const { data: existing } = await supabase.auth.admin.listUsers();
const old = existing?.users?.find(u => u.email === TEST_EMAIL);
if (old) {
  await supabase.auth.admin.deleteUser(old.id);
  console.log(`🗑  Ancien compte supprimé : ${old.id}`);
}

// 2. Créer le nouveau compte (email confirmé d'office)
const { data: created, error } = await supabase.auth.admin.createUser({
  email:          TEST_EMAIL,
  password:       TEST_PASSWORD,
  email_confirm:  true,
});

if (error || !created?.user) {
  console.error("❌ Erreur création user :", error);
  process.exit(1);
}

const userId = created.user.id;
console.log(`✅ Compte créé : ${TEST_EMAIL} (id=${userId})`);

// 3. Créer le profil avec plan=pro (simule un trial actif)
const trialEnd = new Date(Date.now() + 14 * 86_400_000).toISOString();
const { error: profileErr } = await supabase
  .from("profiles")
  .upsert({
    id:            userId,
    email:         TEST_EMAIL,
    plan:          "pro",
    trial_ends_at: trialEnd,
    locale:        "fr",
  }, { onConflict: "id" });

if (profileErr) {
  console.error("❌ Erreur profil :", profileErr);
  process.exit(1);
}

console.log(`✅ Profil créé : plan=pro, trial_ends=${trialEnd.slice(0, 10)}`);
console.log("\n─────────────────────────────────────────");
console.log("Commande pour lancer les tests :");
console.log(`  TEST_USER_EMAIL=${TEST_EMAIL} TEST_USER_PASSWORD=${TEST_PASSWORD} npx playwright test e2e/onboarding.spec.ts`);
console.log("─────────────────────────────────────────");
