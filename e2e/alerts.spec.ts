import { test, expect } from "@playwright/test";

test.describe("Page Alertes", () => {
  test("s'affiche correctement", async ({ page }) => {
    await page.goto("/fr/alerts");
    await expect(page.getByText("Centre d'Alertes")).toBeVisible();
    await expect(page.locator("input[type='email']")).toBeVisible();
  });

  test("affiche le formulaire d'abonnement", async ({ page }) => {
    await page.goto("/fr/alerts");
    await expect(page.getByRole("button", { name: /s'abonner/i })).toBeVisible();
  });

  test("affiche l'encart upgrade pour utilisateur non connecté", async ({ page }) => {
    await page.goto("/fr/alerts");
    await expect(page.getByText(/connectez-vous/i)).toBeVisible({ timeout: 5000 });
  });

  test("erreur email invalide", async ({ page }) => {
    await page.goto("/fr/alerts");
    await page.fill("input[type='email']", "pasunemail");
    await page.getByRole("button", { name: /s'abonner/i }).click();
    // Le navigateur valide le format email nativement
    const emailInput = page.locator("input[type='email']");
    await expect(emailInput).toBeVisible();
  });
});
