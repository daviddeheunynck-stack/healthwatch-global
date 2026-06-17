// Envoie manuellement l'email de fin de trial à un utilisateur
// Usage: node scripts/send-trial-reminder.mjs

import { readFileSync } from "fs";

const env = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const vars = {};
env.split("\n").forEach((line) => {
  if (!line || line.startsWith("#")) return;
  const idx = line.indexOf("=");
  if (idx < 0) return;
  vars[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
});
const BOM   = "﻿";
const clean = (s) => (s || "").replace(BOM, "").trim();

const BREVO_KEY = clean(vars["BREVO_API_KEY"]);
const APP_URL   = "https://healthwatch-global.com";

// ── Email content (Indonesian) ─────────────────────────────────────────────
const trialEnd = "2026-06-19";
const locale   = "id";
const plan     = "pro";

const formatDate = (iso) => {
  const [y, m, d] = iso.split("T")[0].split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
};

const d = formatDate(trialEnd);

const subject  = "Uji coba Pro Anda berakhir dalam 3 hari";
const headline = "Uji coba Pro Anda berakhir dalam 3 hari.";
const intro    = `Akses Pro Anda berakhir pada <strong>${d}</strong>. Untuk tetap mengakses angka tepat, laporan PDF, dan peringatan, tambahkan metode pembayaran sekarang.`;
const highlights = [
  "Angka tepat (kasus & kematian) per wabah",
  "Ekspor CSV untuk analisis",
  "Laporan PDF siap pakai",
  "Peringatan email instan — semua wilayah",
  "Watchlist penyakit",
];
const ctaLabel    = "Tambahkan metode pembayaran →";
const reassurance = "14 hari uji coba gratis · tanpa biaya tersembunyi";
const closing     = "Tim HealthWatch Global";

const html = `<!DOCTYPE html>
<html lang="${locale}">
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#0f172a;color:#e2e8f0;margin:0;padding:32px 16px;">
  <div style="max-width:600px;margin:0 auto;background:#1e293b;border-radius:16px;overflow:hidden;border:1px solid #334155;">
    <div style="background:#dc2626;padding:28px 32px;">
      <h1 style="margin:0;font-size:22px;color:white;font-weight:700;">🌍 HealthWatch Global</h1>
    </div>
    <div style="padding:36px 32px;">
      <h2 style="margin:0 0 16px;font-size:20px;color:#f1f5f9;">${headline}</h2>
      <p style="color:#94a3b8;font-size:15px;line-height:1.7;margin:0 0 28px;">${intro}</p>

      <div style="background:#0f172a;border-radius:12px;padding:20px 24px;margin-bottom:28px;">
        <p style="margin:0 0 12px;font-size:13px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.05em;">Yang Anda akses saat ini</p>
        ${highlights.map(h => `<div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">
          <span style="color:#22c55e;font-size:16px;">✓</span>
          <span style="color:#e2e8f0;font-size:14px;">${h}</span>
        </div>`).join("")}
      </div>

      <div style="text-align:center;margin-bottom:12px;">
        <a href="${APP_URL}/${locale}/pricing"
           style="display:inline-block;background:#dc2626;color:white;text-decoration:none;
                  padding:14px 32px;border-radius:8px;font-weight:700;font-size:15px;">
          ${ctaLabel}
        </a>
      </div>
      <p style="text-align:center;font-size:12px;color:#64748b;margin:0 0 28px;">${reassurance}</p>
    </div>
    <div style="padding:20px 32px;border-top:1px solid #334155;">
      <p style="margin:0;font-size:13px;color:#e2e8f0;">${closing}</p>
    </div>
  </div>
</body>
</html>`;

// ── Send ───────────────────────────────────────────────────────────────────
const res = await fetch("https://api.brevo.com/v3/smtp/email", {
  method: "POST",
  headers: { "api-key": BREVO_KEY, "Content-Type": "application/json" },
  body: JSON.stringify({
    sender:      { name: "HealthWatch Global", email: "alerts@healthwatch-global.com" },
    to:          [{ email: "shintayuliawati28@gmail.com" }],
    subject,
    htmlContent: html,
  }),
});

if (res.ok) {
  console.log("✅ Email envoyé à shintayuliawati28@gmail.com");
  console.log(`   Sujet : ${subject}`);
} else {
  const err = await res.text();
  console.error("❌ Erreur Brevo :", err);
}
