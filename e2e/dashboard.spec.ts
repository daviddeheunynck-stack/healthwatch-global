import { test, expect } from "@playwright/test";

test.describe("Dashboard", () => {
  test("charge et affiche les stats", async ({ page }) => {
    await page.goto("/fr");
    await expect(page.getByText("Épidémies Actives")).toBeVisible();
    await expect(page.getByText("Pays Touchés")).toBeVisible();
    await expect(page.getByText("Risque Élevé")).toBeVisible();
  });

  test("affiche la carte interactive", async ({ page }) => {
    await page.goto("/fr");
    await expect(page.locator(".leaflet-container")).toBeVisible({ timeout: 10000 });
  });

  test("affiche le tableau des alertes récentes", async ({ page }) => {
    await page.goto("/fr");
    await expect(page.getByText("Alertes Récentes")).toBeVisible();
  });

  test("redirige vers une locale depuis /", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/(fr|en|es|ar|id)/);
  });

  test("fonctionne en anglais", async ({ page }) => {
    await page.goto("/en");
    await expect(page.getByText("Active Outbreaks")).toBeVisible();
  });
});
