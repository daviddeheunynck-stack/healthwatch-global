import { test, expect } from "@playwright/test";

test.describe("Dashboard — Landing page (unauthenticated)", () => {
  test("affiche le hero de la landing page en français", async ({ page }) => {
    await page.goto("/fr");
    await expect(page.getByText("Anticipez les épidémies.")).toBeVisible();
    await expect(page.getByText("Ne réagissez plus.")).toBeVisible();
  });

  test("affiche la barre de stats", async ({ page }) => {
    await page.goto("/fr");
    // Stats bar: the label is a <p class="text-xs text-gray-500"> inside the stats grid
    // Use exact match to avoid matching newsletterSub which also contains "foyers actifs"
    const statLabel = page.locator("p.text-xs.text-gray-500", { hasText: "foyers actifs" }).first();
    await expect(statLabel).toBeVisible({ timeout: 10000 });
  });

  test("affiche la section preview des données", async ({ page }) => {
    await page.goto("/fr");
    // previewTitle is always rendered (static copy, no data dependency)
    await expect(page.getByText("Ce que vos équipes verront en temps réel")).toBeVisible({ timeout: 10000 });
  });

  test("redirige vers une locale depuis /", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/(fr|en|es|ar|id)/);
  });

  test("fonctionne en anglais", async ({ page }) => {
    await page.goto("/en");
    await expect(page.getByText("Anticipate outbreaks.")).toBeVisible();
    // previewTitle (static, no data dependency)
    await expect(page.getByText("What your teams will see in real time")).toBeVisible({ timeout: 10000 });
  });
});
