#!/usr/bin/env node
/**
 * scan-deployed-bundle.mjs — cherche des secrets dans les chunks JS réellement servis
 * par la production.
 *
 * Pourquoi ce fichier existe (2026-08-08) : la routine `daily-security-audit-healthwatch`
 * décrivait ce contrôle en prose (« extraire les <script src>, fetch chaque chunk, chercher
 * les motifs ») et laissait chaque run réécrire son propre script. Le 08/08, une de ces
 * réimplémentations PowerShell a signalé `service_role` dans un chunk — alerte de gravité
 * maximale au sens du SKILL — infirmée ensuite par deux contrôles indépendants : le bundle
 * était propre, le script était faux. Dans l'autre sens, un faux *négatif* serait passé tout
 * aussi silencieusement. Un contrôle réinventé à chaque run n'a de fiabilité mesurable dans
 * aucun des deux sens ; il est donc figé ici, versionné, et la routine se contente de
 * l'exécuter.
 *
 * Les motifs et les pages scannées sont volontairement IDENTIQUES à ceux de
 * `scanDeployedBundleForSecrets()` dans app/api/cron/health-check/route.ts, qui fait le même
 * travail côté serveur. Si l'un des deux change, changer l'autre.
 *
 * Portée (héritée du contrôle serveur) : best-effort et volontairement étroit — seuls les
 * chunks référencés par les quatre pages ci-dessous sont scannés. Un secret inliné dans une
 * route peu fréquentée passerait au travers. C'est un filet, pas une preuve d'absence.
 *
 * Usage :
 *   node scripts/scan-deployed-bundle.mjs            # sortie lisible
 *   node scripts/scan-deployed-bundle.mjs --json     # sortie JSON
 * Codes de sortie : 0 = propre, 1 = au moins un motif trouvé, 2 = erreur d'exécution.
 */

const BUNDLE_SECRET_PATTERNS = ["sb_secret_", "service_role", "sk_live_", "rk_live_", "whsec_", "xkeysib-", "sntrys_"];
const BUNDLE_SCAN_PAGES = ["/en", "/en/signup", "/en/pricing", "/en/account"];
const APP_URL = (process.env.NEXT_PUBLIC_APP_URL || "https://healthwatch-global.com").trim();

const asJson = process.argv.includes("--json");

async function scan() {
  const matches = [];
  const chunksScanned = [];
  const seenChunks = new Set();
  const softErrors = [];

  for (const page of BUNDLE_SCAN_PAGES) {
    const res = await fetch(`${APP_URL}${page}`, { signal: AbortSignal.timeout(10_000) }).catch((e) => {
      softErrors.push(`${page}: ${e.message}`);
      return null;
    });
    if (!res?.ok) {
      if (res) softErrors.push(`${page}: HTTP ${res.status}`);
      continue;
    }
    const html = await res.text();
    const srcs = [...html.matchAll(/<script[^>]+src="([^"]+\.js[^"]*)"/g)].map((m) => m[1]);

    for (const src of srcs) {
      const chunkUrl = src.startsWith("http") ? src : `${APP_URL}${src}`;
      if (seenChunks.has(chunkUrl)) continue;
      seenChunks.add(chunkUrl);

      const chunkRes = await fetch(chunkUrl, { signal: AbortSignal.timeout(10_000) }).catch((e) => {
        softErrors.push(`${chunkUrl}: ${e.message}`);
        return null;
      });
      if (!chunkRes?.ok) {
        if (chunkRes) softErrors.push(`${chunkUrl}: HTTP ${chunkRes.status}`);
        continue;
      }

      // .text() décode explicitement en UTF-8 : c'est le point où la réimplémentation
      // PowerShell du 08/08 a dérapé (interaction entre `-match` et le type de .Content
      // renvoyé par Invoke-WebRequest). Ne pas remplacer par une lecture d'octets bruts.
      const js = await chunkRes.text();
      chunksScanned.push({ chunk: chunkUrl, bytes: js.length });

      for (const pattern of BUNDLE_SECRET_PATTERNS) {
        // Compte les occurrences plutôt qu'un booléen : un décompte rend le résultat
        // vérifiable à la main sur le chunk incriminé, ce qui est exactement ce qui a
        // permis d'infirmer le faux positif du 08/08.
        let count = 0;
        let i = js.indexOf(pattern);
        while (i !== -1) {
          count++;
          i = js.indexOf(pattern, i + pattern.length);
        }
        if (count > 0) matches.push({ page, chunk: chunkUrl, pattern, count });
      }
    }
  }

  return { matches, chunksScanned, softErrors };
}

try {
  const { matches, chunksScanned, softErrors } = await scan();

  if (asJson) {
    console.log(JSON.stringify({ ok: matches.length === 0, matches, chunksScanned, softErrors }, null, 2));
  } else {
    console.log(`Chunks scannés : ${chunksScanned.length} (${BUNDLE_SCAN_PAGES.join(", ")})`);
    console.log(`Motifs cherchés : ${BUNDLE_SECRET_PATTERNS.join(", ")}`);
    if (softErrors.length) {
      console.log(`\n⚠️  ${softErrors.length} ressource(s) non lue(s) — couverture incomplète :`);
      softErrors.forEach((e) => console.log(`   - ${e}`));
    }
    if (matches.length === 0) {
      console.log("\n✅ Aucun secret trouvé dans les chunks servis.");
    } else {
      console.log(`\n🔴 ${matches.length} occurrence(s) trouvée(s) :`);
      matches.forEach((m) => console.log(`   - ${m.pattern} ×${m.count} dans ${m.chunk} (via ${m.page})`));
      console.log("\nAvant d'alerter : re-fetch le chunk incriminé et confirme le décompte à la main.");
    }
  }

  process.exit(matches.length === 0 ? 0 : 1);
} catch (err) {
  console.error(`Erreur d'exécution : ${err instanceof Error ? err.message : String(err)}`);
  process.exit(2);
}
