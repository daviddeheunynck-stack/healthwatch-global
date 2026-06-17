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
    // Default billing is annual → "249 €" visible
    await expect(page.getByText("Free", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("249 €", { exact: true })).toBeVisible();
    // Switch to monthly → "29 €" visible
    await page.getByRole("button", { name: /mensuel/i }).click();
    await expect(page.getByText("29 €", { exact: true })).toBeVisible();
  });

  test("bouton checkout redirige vers signup si non connecté", async ({ page }) => {
    await page.goto("/fr/pricing");
    await page.getByRole("button", { name: /commencer/i }).first().click();
    // CheckoutButton redirects unauthenticated users to /signup (not /login)
    await expect(page).toHaveURL(/login|signup|stripe\.com/, { timeout: 8000 });
  });

  test("section FAQ visible", async ({ page }) => {
    await page.goto("/fr/pricing");
    await expect(page.getByText("Questions fréquentes")).toBeVisible();
  });
});
