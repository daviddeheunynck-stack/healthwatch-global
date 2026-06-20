import { test, expect } from "@playwright/test";

test.describe("Authentification", () => {
  test("page login s'affiche", async ({ page }) => {
    await page.goto("/fr/login");
    await expect(page.getByText("Connexion")).toBeVisible();
    await expect(page.locator("input[type='email']")).toBeVisible();
    await expect(page.locator("input[type='password']")).toBeVisible();
  });

  test("page signup s'affiche", async ({ page }) => {
    await page.goto("/fr/signup");
    await expect(page.locator("h1")).toContainText("Créer un compte");
  });

  test("erreur avec mauvaises credentials", async ({ page }) => {
    await page.goto("/fr/login");
    await page.fill("input[type='email']", "wrong@example.com");
    await page.fill("input[type='password']", "wrongpassword");
    await page.getByRole("button", { name: /se connecter/i }).click();
    await expect(page.getByText(/incorrect|invalide|erreur/i)).toBeVisible({ timeout: 5000 });
  });

  test("lien mot de passe oublié fonctionne", async ({ page }) => {
    await page.goto("/fr/login");
    await Promise.all([
      page.waitForURL(/forgot-password/, { timeout: 10000 }),
      page.locator("a[href*='forgot-password']").click(),
    ]);
  });

  test("page forgot-password s'affiche", async ({ page }) => {
    await page.goto("/fr/forgot-password");
    await expect(page.locator("input[type='email']")).toBeVisible();
  });
});
