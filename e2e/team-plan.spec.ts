/**
 * Team plan E2E tests
 *
 * Validates that:
 *  - Team plan is visible and correctly described on the pricing page
 *  - Paywall banners on locked pages mention both Pro and Team (not Pro-only)
 *  - The locked copy in the account page mentions Team (authenticated suite)
 *
 * Auth-gated tests require TEST_USER_EMAIL / TEST_USER_PASSWORD (free-plan user).
 */

import { test, expect } from "@playwright/test";

// ─── Pricing page — Team card (no auth required) ─────────────────────────────

test.describe("Plan Team — page tarifs", () => {
  test("carte Team visible en français avec les 4 plans", async ({ page }) => {
    await page.goto("/fr/pricing");
    await expect(page.getByText("Team", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Pro", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Enterprise", { exact: true }).first()).toBeVisible();
  });

  test("prix Team mensuel affiché après bascule", async ({ page }) => {
    await page.goto("/fr/pricing");
    await page.getByRole("button", { name: /mensuel/i }).click();
    await expect(page.getByText("149 €", { exact: true })).toBeVisible();
  });

  test("prix Team annuel affiché par défaut", async ({ page }) => {
    await page.goto("/fr/pricing");
    await expect(page.getByText("1 290 €", { exact: true })).toBeVisible();
  });

  test("fonctionnalités Team — 5 sièges + facture institutionnelle", async ({ page }) => {
    await page.goto("/fr/pricing");
    // Target the feature <li> specifically — the text also appears in teamDesc paragraph
    await expect(page.locator("li").filter({ hasText: "5 sièges inclus" })).toBeVisible();
    await expect(page.locator("li").filter({ hasText: "Une seule facture institutionnelle" })).toBeVisible();
  });

  test("fonctionnalités Team — EN: 5 seats + single invoice", async ({ page }) => {
    await page.goto("/en/pricing");
    await expect(page.locator("li").filter({ hasText: "5 seats included" })).toBeVisible();
    await expect(page.locator("li").filter({ hasText: "Single institutional invoice" })).toBeVisible();
  });

  test("prix Team ES — €149/mois après bascule mensuel", async ({ page }) => {
    // EN locale shows USD ($165); use ES locale to verify €149 monthly price
    await page.goto("/es/pricing");
    await page.getByRole("button", { name: /mensual/i }).click();
    await expect(page.getByText("€149", { exact: true })).toBeVisible();
  });
});

// ─── Reports page paywall — mentions Pro et Team (no auth required) ───────────

test.describe("Rapports — bannière paywall mentionne Pro et Team", () => {
  test("FR — bannière cite les plans Pro et Team", async ({ page }) => {
    await page.goto("/fr/reports");
    // Paywall banner is shown to unauthenticated / free users
    await expect(page.getByText(/plans Pro et Team/i)).toBeVisible({ timeout: 10000 });
  });

  test("EN — banner mentions Pro and Team plans", async ({ page }) => {
    await page.goto("/en/reports");
    await expect(page.getByText(/Pro and Team plans/i)).toBeVisible({ timeout: 10000 });
  });

  test("ES — banner menciona planes Pro y Team", async ({ page }) => {
    await page.goto("/es/reports");
    await expect(page.getByText(/planes Pro y Team/i)).toBeVisible({ timeout: 10000 });
  });

  test("rapports — bouton CTA unlock visible", async ({ page }) => {
    await page.goto("/fr/reports");
    await expect(page.getByRole("button", { name: /Débloquer Pro/i }).first()).toBeVisible({ timeout: 10000 });
  });

  test("rapports — locked download label mentionne Pro/Team", async ({ page }) => {
    await page.goto("/fr/reports");
    await expect(page.getByText(/Pro\/Team.*débloquer|débloquer.*Pro\/Team/i).first()).toBeVisible({ timeout: 10000 });
  });
});

// ─── Account page locked copy (authenticated — free plan user) ───────────────

const testEmail = process.env.TEST_USER_EMAIL;
const testPassword = process.env.TEST_USER_PASSWORD;

test.describe("Compte — copy verrouillée mentionne Pro et Team (authentifié)", () => {
  test.skip(!testEmail || !testPassword, "TEST_USER_EMAIL / TEST_USER_PASSWORD non définis");

  test.beforeEach(async ({ page }) => {
    await page.goto("/fr/login");
    await page.fill("input[type='email']", testEmail!);
    await page.fill("input[type='password']", testPassword!);
    await page.getByRole("button", { name: /se connecter|connexion/i }).click();
    await page.waitForURL(/\/fr\/?$/, { timeout: 10000 });
  });

  test("alertes régionales — message verrouillé cite Pro et Team", async ({ page }) => {
    await page.goto("/fr/account");
    await expect(page.getByText(/plans Pro et Team/i)).toBeVisible({ timeout: 8000 });
  });

  test("intégration Slack — message verrouillé cite Pro et Team", async ({ page }) => {
    await page.goto("/fr/account");
    // Both ALERT_LABELS and SLACK_LABELS use the same phrasing
    const matches = page.getByText(/plans Pro et Team/i);
    await expect(matches.first()).toBeVisible({ timeout: 8000 });
    // At least 2 locked sections (alerts + Slack)
    await expect(matches).toHaveCount(2);
  });

  test("alertes par maladie — message verrouillé cite Pro et Team", async ({ page }) => {
    await page.goto("/fr/account");
    await expect(page.getByText(/plans Pro et Team|Pro et Team/i).first()).toBeVisible({ timeout: 8000 });
  });

  test("EN account — locked copy mentions Pro and Team plans", async ({ page }) => {
    await page.goto("/en/account");
    await expect(page.getByText(/Pro and Team plans/i).first()).toBeVisible({ timeout: 8000 });
  });
});

// ─── isPaid gate — Team user sees unlocked content (requires Team test creds) ─

const teamEmail = process.env.TEST_TEAM_EMAIL;
const teamPassword = process.env.TEST_TEAM_PASSWORD;

test.describe("Accès Team — contenu déverrouillé (authentifié Team)", () => {
  test.skip(!teamEmail || !teamPassword, "TEST_TEAM_EMAIL / TEST_TEAM_PASSWORD non définis");

  test.beforeEach(async ({ page }) => {
    await page.goto("/fr/login");
    await page.fill("input[type='email']", teamEmail!);
    await page.fill("input[type='password']", teamPassword!);
    await page.getByRole("button", { name: /se connecter|connexion/i }).click();
    await page.waitForURL(/\/fr\/?$/, { timeout: 10000 });
  });

  test("rapports — pas de bannière paywall pour un utilisateur Team", async ({ page }) => {
    await page.goto("/fr/reports");
    await expect(page.getByText(/plans Pro et Team/i)).not.toBeVisible({ timeout: 8000 });
  });

  test("compte — badge plan Team affiché", async ({ page }) => {
    await page.goto("/fr/account");
    await expect(page.getByText("Team", { exact: true }).first()).toBeVisible({ timeout: 8000 });
  });

  test("compte — section sièges de l'équipe visible", async ({ page }) => {
    await page.goto("/fr/account");
    await expect(page.getByText(/sièges de l'équipe/i)).toBeVisible({ timeout: 8000 });
  });
});
