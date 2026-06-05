import { test, expect } from "@playwright/test";

test.describe("API Routes", () => {

  // ── Health endpoint ──────────────────────────────────────────────────────────
  test("GET /api/health retourne 200 avec tous les services ok", async ({ request }) => {
    const res = await request.get("/api/health");
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("ok");
    expect(body.checks.supabase).toBe("ok");
    expect(body.checks.stripe).toBe("ok");
    // Brevo: "ok" or "unconfigured" (never "error")
    expect(["ok", "unconfigured"]).toContain(body.checks.brevo);
    expect(body.timestamp).toBeTruthy();
  });

  // ── Subscribe ────────────────────────────────────────────────────────────────
  test("POST /api/subscribe — email manquant retourne 400", async ({ request }) => {
    const res = await request.post("/api/subscribe", {
      data: { region: "africa" },
    });
    expect(res.status()).toBe(400);
  });

  test("POST /api/subscribe — région manquante retourne 400", async ({ request }) => {
    const res = await request.post("/api/subscribe", {
      data: { email: "test@example.com" },
    });
    expect(res.status()).toBe(400);
  });

  // ── Checkout ─────────────────────────────────────────────────────────────────
  test("POST /api/checkout — plan invalide retourne 400", async ({ request }) => {
    const res = await request.post("/api/checkout", {
      data: { plan: "invalid", locale: "fr" },
    });
    expect(res.status()).toBe(400);
  });

  test("POST /api/checkout — plan absent retourne 400", async ({ request }) => {
    const res = await request.post("/api/checkout", {
      data: { locale: "fr" },
    });
    expect(res.status()).toBe(400);
  });

  // ── Webhook ──────────────────────────────────────────────────────────────────
  test("POST /api/webhook — sans signature retourne 400", async ({ request }) => {
    const res = await request.post("/api/webhook", {
      data: {},
    });
    expect(res.status()).toBe(400);
  });

  // ── Cron auth guards ─────────────────────────────────────────────────────────
  test("GET /api/cron/sync-outbreaks — sans secret retourne 401", async ({ request }) => {
    const res = await request.get("/api/cron/sync-outbreaks");
    expect(res.status()).toBe(401);
  });

  test("GET /api/cron/weekly-digest — sans secret retourne 401", async ({ request }) => {
    const res = await request.get("/api/cron/weekly-digest");
    expect(res.status()).toBe(401);
  });

  test("GET /api/cron/regional-alerts — sans secret retourne 401", async ({ request }) => {
    const res = await request.get("/api/cron/regional-alerts");
    expect(res.status()).toBe(401);
  });

  test("GET /api/cron/trial-reminders — sans secret retourne 401", async ({ request }) => {
    const res = await request.get("/api/cron/trial-reminders");
    expect(res.status()).toBe(401);
  });

  test("GET /api/cron/disease-alerts — sans secret retourne 401", async ({ request }) => {
    const res = await request.get("/api/cron/disease-alerts");
    expect(res.status()).toBe(401);
  });

  // ── Disease alerts API ───────────────────────────────────────────────────────
  test("GET /api/alert-diseases — non authentifié retourne 401", async ({ request }) => {
    const res = await request.get("/api/alert-diseases");
    expect(res.status()).toBe(401);
  });

  test("POST /api/alert-diseases — non authentifié retourne 401", async ({ request }) => {
    const res = await request.post("/api/alert-diseases", {
      data: { disease_en: "Ebola virus disease" },
    });
    expect(res.status()).toBe(401);
  });

  // ── Contact form ─────────────────────────────────────────────────────────────
  test("POST /api/contact — champs manquants retourne 400", async ({ request }) => {
    const res = await request.post("/api/contact", {
      data: { name: "Test" }, // missing email + message
    });
    expect(res.status()).toBe(400);
  });

  // ── Public API v1 ────────────────────────────────────────────────────────────
  test("GET /api/v1/outbreaks — sans API key retourne 401", async ({ request }) => {
    const res = await request.get("/api/v1/outbreaks");
    expect(res.status()).toBe(401);
  });

  test("GET /api/v1/outbreaks — API key invalide retourne 401", async ({ request }) => {
    const res = await request.get("/api/v1/outbreaks", {
      headers: { "X-API-Key": "hwg_invalide123" },
    });
    expect(res.status()).toBe(401);
  });

  // ── Unsubscribe ──────────────────────────────────────────────────────────────
  test("GET /api/unsubscribe — sans id retourne 400", async ({ request }) => {
    const res = await request.get("/api/unsubscribe");
    expect(res.status()).toBe(400);
  });

  test("GET /api/unsubscribe — id non-UUID retourne 400", async ({ request }) => {
    const res = await request.get("/api/unsubscribe?id=not-a-uuid&locale=fr");
    expect(res.status()).toBe(400);
  });
});
