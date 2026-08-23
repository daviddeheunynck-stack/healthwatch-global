// Pointe git sur .githooks/ pour cette copie du dépôt.
//
// `core.hooksPath` est une config LOCALE : elle ne suit pas le clone. Sans ce
// script, le hook commit-msg qui empêche une routine documentaire d'emporter du
// code applicatif (voir AGENTS.md, section Commits) ne serait actif que sur la
// machine où quelqu'un a pensé à taper la commande. Un garde-fou qui dépend
// d'un geste manuel n'en est pas un.
//
// Appelé par le script npm `prepare`, qui se déclenche après un `npm install`
// local et jamais quand le paquet est installé comme dépendance.
//
// Ne fait rien, sans échouer, hors d'un dépôt git ou en CI/build : Vercel
// exécute `prepare` pendant le build, et il n'y a rien à configurer là-bas.

import { execFileSync } from "child_process";
import { existsSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

if (process.env.CI || process.env.VERCEL) {
  process.exit(0);
}
if (!existsSync(join(repoRoot, ".git"))) {
  // Clone superficiel, worktree exotique, tarball — rien à faire, pas une erreur.
  process.exit(0);
}

try {
  const current = execFileSync("git", ["config", "--get", "core.hooksPath"], {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  }).trim();

  if (current === ".githooks") process.exit(0);

  // Quelqu'un a délibérément pointé ailleurs : on ne l'écrase pas en silence.
  if (current && current !== ".githooks") {
    console.warn(`[hooks] core.hooksPath vaut déjà "${current}" — laissé tel quel.`);
    console.warn(`[hooks] Pour activer les hooks du dépôt : git config core.hooksPath .githooks`);
    process.exit(0);
  }
} catch {
  // Pas de valeur configurée — c'est le cas courant, on continue.
}

try {
  execFileSync("git", ["config", "core.hooksPath", ".githooks"], { cwd: repoRoot, stdio: "ignore" });
  console.log("[hooks] core.hooksPath → .githooks");
} catch (err) {
  // Jamais bloquant : un `npm install` ne doit pas échouer parce qu'un hook
  // n'a pas pu être branché.
  console.warn("[hooks] configuration impossible :", err?.message ?? err);
}
