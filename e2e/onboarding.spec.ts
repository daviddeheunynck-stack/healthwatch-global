/**
 * Onboarding E2E tests
 *
 * Covers:
 *  - Signup page renders correctly in each locale
 *  - Successful signup flow redirects to dashboard (requires TEST_USER_EMAIL / TEST_USER_PASSWORD)
 *  - Onboarding tour appears on first dashboard visit and is dismissed via localStorage
 *
 * To run the full authenticated suite:
 *   TEST_USER_EMAIL=test@... TEST_USER_PASSWORD=... npx playwright test e2e/onboarding.spec.ts
 */

import { test, expect } from "@playwright/test";

const TOUR_KEY = "hw_tour_v1";

// ─── Signup page (no auth required) ──────────────────────────────────────────

test.describe("Signup page", () => {
  test("affiche le formulaire d'inscription en français", async ({ page }) => {
    await page.goto("/fr/signup");
    await expect(page.locator("input[type='email']")).toBeVisible();
    await expect(page.locator("input[type='password']")).toBeVisible();
    await expect(page.getByRole("button", { name: /créer|commencer|s'inscrire/i })).toBeVisible();
  });

  test("affiche le formulaire d'inscription en anglais", async ({ page }) => {
    await page.goto("/en/signup");
    await expect(page.locator("input[type='email']")).toBeVisible();
    await expect(page.locator("input[type='password']")).toBeVisible();
  });

  test("affiche le badge essai gratuit", async ({ page }) => {
    await page.goto("/fr/signup");
    await expect(page.getByText(/14.*(jour|day|jours|days)/i).first()).toBeVisible();
  });

  test("affiche une erreur si email invalide", async ({ page }) => {
    await page.goto("/fr/signup");
    await page.fill("input[type='email']", "pasunemail");
    await page.fill("input[type='password']", "TestPass123!");
    await page.getByRole("button", { name: /créer|commencer|s'inscrire/i }).click();
    // Either browser validation or app-level error
    const emailInput = page.locator("input[type='email']");
    const isInvalid = await emailInput.evaluate((el: HTMLInputElement) => !el.validity.valid);
    if (!isInvalid) {
      // App-level error shown
      await expect(page.locator("[role='alert'], .text-red-400, .text-red-500")).toBeVisible({ timeout: 3000 });
    }
  });

  test("lien 'Déjà un compte' pointe vers /login", async ({ page }) => {
    await page.goto("/fr/signup");
    const loginLink = page.locator("a[href*='/login']").first();
    await expect(loginLink).toBeVisible();
  });
});

// ─── Onboarding tour (localStorage-based) ────────────────────────────────────

test.describe("Onboarding tour — localStorage", () => {
  test.beforeEach(async ({ page }) => {
    // Clear tour state before each test
    await page.addInitScript(() => {
      localStorage.removeItem("hw_tour_v1");
    });
  });

  test("ne s'affiche PAS si localStorage marqué comme vu", async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("hw_tour_v1", "1");
    });
    await page.goto("/fr");
    // Wait briefly — tour would appear after 900ms delay
    await page.waitForTimeout(1500);
    await expect(page.locator("text=Bienvenue sur HealthWatch Global")).not.toBeVisible();
  });
});

// ─── Full signup → dashboard → tour (requires test credentials) ──────────────

const testEmail = process.env.TEST_USER_EMAIL;
const testPassword = process.env.TEST_USER_PASSWORD;

test.describe("Onboarding flow complet (authentifié)", () => {
  test.skip(!testEmail || !testPassword, "TEST_USER_EMAIL / TEST_USER_PASSWORD non définis");

  test("connexion puis tableau de bord visible", async ({ page }) => {
    await page.goto("/fr/login");
    await page.fill("input[type='email']", testEmail!);
    await page.fill("input[type='password']", testPassword!);
    await page.getByRole("button", { name: /se connecter|connexion/i }).click();
    await page.waitForURL(/\/fr\/?$/, { timeout: 10000 });
    // Dashboard should show stats or map (not landing page)
    await expect(page.locator("[data-testid='world-map'], canvas, .leaflet-container").first()).toBeVisible({ timeout: 10000 });
  });

  test("tour s'affiche au premier accès et disparaît à la fermeture", async ({ page }) => {
    // Clear tour key
    await page.addInitScript(() => localStorage.removeItem("hw_tour_v1"));

    await page.goto("/fr/login");
    await page.fill("input[type='email']", testEmail!);
    await page.fill("input[type='password']", testPassword!);
    await page.getByRole("button", { name: /se connecter|connexion/i }).click();
    await page.waitForURL(/\/fr\/?$/, { timeout: 10000 });

    // Tour appears after 900ms delay
    await expect(page.locator("text=Bienvenue sur HealthWatch Global")).toBeVisible({ timeout: 3000 });

    // Navigate to step 2
    await page.getByRole("button", { name: /commencer/i }).click();
    await expect(page.locator("text=La carte mondiale interactive")).toBeVisible();

    // Skip via X button
    await page.locator("button[aria-label='Skip tour']").click();
    await expect(page.locator("text=Bienvenue sur HealthWatch Global")).not.toBeVisible();

    // localStorage should be marked
    const stored = await page.evaluate(() => localStorage.getItem("hw_tour_v1"));
    expect(stored).toBe("1");
  });

  test("tour ne réapparaît pas si localStorage marqué", async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem("hw_tour_v1", "1"));

    await page.goto("/fr/login");
    await page.fill("input[type='email']", testEmail!);
    await page.fill("input[type='password']", testPassword!);
    await page.getByRole("button", { name: /se connecter|connexion/i }).click();
    await page.waitForURL(/\/fr\/?$/, { timeout: 10000 });

    await page.waitForTimeout(1500);
    await expect(page.locator("text=Bienvenue sur HealthWatch Global")).not.toBeVisible();
  });

  test("tour complet — 4 étapes jusqu'au bouton final", async ({ page }) => {
    await page.addInitScript(() => localStorage.removeItem("hw_tour_v1"));

    await page.goto("/fr/login");
    await page.fill("input[type='email']", testEmail!);
    await page.fill("input[type='password']", testPassword!);
    await page.getByRole("button", { name: /se connecter|connexion/i }).click();
    await page.waitForURL(/\/fr\/?$/, { timeout: 10000 });

    await expect(page.locator("text=Bienvenue sur HealthWatch Global")).toBeVisible({ timeout: 3000 });
    await page.getByRole("button", { name: /commencer/i }).click();

    await expect(page.locator("text=La carte mondiale interactive")).toBeVisible();
    await page.getByRole("button", { name: /suivant/i }).click();

    await expect(page.locator("text=Le tableau de bord épidémiologique")).toBeVisible();
    await page.getByRole("button", { name: /suivant/i }).click();

    await expect(page.locator("text=Débloquez la surveillance complète")).toBeVisible();
    // Final step has "Accéder au tableau de bord" or CheckoutButton
    const finalButton = page.getByRole("button", { name: /tableau de bord|commencer l'essai/i });
    await expect(finalButton).toBeVisible();
    await finalButton.click();

    await expect(page.locator("text=Bienvenue sur HealthWatch Global")).not.toBeVisible();
    const stored = await page.evaluate(() => localStorage.getItem("hw_tour_v1"));
    expect(stored).toBe("1");
  });
});
