import { test, expect } from "@playwright/test";

test.describe("Page Tarifs", () => {
  test("s'affiche avec les 3 plans Free/Pro/Enterprise", async ({ page }) => {
    await page.goto("/fr/pricing");
    await expect(page.getByText("Free", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Pro", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Enterprise", { exact: true }).first()).toBeVisible();
  });

  test("affiche les prix", async ({ page }) => {
    await page.goto("/fr/pricing");
    // Free card heading "Free" and Pro price "49 €"
    await expect(page.getByText("Free", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("49 €", { exact: true })).toBeVisible();
  });

  test("bouton checkout redirige vers login si non connecté", async ({ page }) => {
    await page.goto("/fr/pricing");
    await page.getByRole("button", { name: /commencer/i }).first().click();
    await expect(page).toHaveURL(/login|stripe\.com/, { timeout: 8000 });
  });

  test("section FAQ visible", async ({ page }) => {
    await page.goto("/fr/pricing");
    await expect(page.getByText("Questions fréquentes")).toBeVisible();
  });
});
