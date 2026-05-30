import { test, expect } from "@playwright/test";

test.describe("API Routes", () => {
  test("GET /api/health retourne 200", async ({ request }) => {
    const res = await request.get("/api/health");
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("ok");
    expect(body.checks.supabase).toBe("ok");
    expect(body.checks.stripe).toBe("ok");
  });

  test("POST /api/subscribe — email manquant retourne 400", async ({ request }) => {
    const res = await request.post("/api/subscribe", {
      data: { region: "africa" },
    });
    expect(res.status()).toBe(400);
  });

  test("POST /api/checkout — plan invalide retourne 400", async ({ request }) => {
    const res = await request.post("/api/checkout", {
      data: { plan: "invalid", locale: "fr" },
    });
    expect(res.status()).toBe(400);
  });

  test("POST /api/webhook — sans signature retourne 400", async ({ request }) => {
    const res = await request.post("/api/webhook", {
      data: {},
    });
    expect(res.status()).toBe(400);
  });

  test("GET /api/cron/sync-outbreaks — sans secret retourne 401", async ({ request }) => {
    const res = await request.get("/api/cron/sync-outbreaks");
    expect(res.status()).toBe(401);
  });

  test("GET /api/cron/weekly-digest — sans secret retourne 401", async ({ request }) => {
    const res = await request.get("/api/cron/weekly-digest");
    expect(res.status()).toBe(401);
  });
});
