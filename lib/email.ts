/**
 * Shared Brevo transactional email sender for cron routes.
 * Centralizing the HTTP call, payload shape, and default sender means future
 * Brevo changes (retries, rate limits, sender rotation, etc.) are a one-file
 * edit instead of a sweep across every cron route.
 */

import { isRealProduction } from "@/lib/cron-monitor";

const BOM   = String.fromCharCode(65279);
const clean = (v: string | undefined) => (v ?? "").replace(new RegExp("^" + BOM), "").trim();

const BREVO_API_KEY = clean(process.env.BREVO_API_KEY);

export interface BrevoSender {
  name: string;
  email: string;
}

export interface SendBrevoEmailParams {
  to: string | string[];
  subject: string;
  html: string;
  sender?: BrevoSender;
}

const DEFAULT_SENDER: BrevoSender = { name: "HealthWatch Global", email: "alerts@healthwatch-global.com" };

export function isBrevoConfigured(): boolean {
  return !!BREVO_API_KEY;
}

/**
 * Raw Brevo API call with no isRealProduction or key-presence gating — for
 * routes with their own bespoke gating/reporting (e.g. health-check).
 * Throws if BREVO_API_KEY is unset or Brevo responds with a non-2xx status.
 */
export async function postBrevoEmail({ to, subject, html, sender = DEFAULT_SENDER }: SendBrevoEmailParams): Promise<void> {
  if (!BREVO_API_KEY) throw new Error("BREVO_API_KEY not set");
  const recipients = (Array.isArray(to) ? to : [to]).map((email) => ({ email }));
  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "api-key": BREVO_API_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ sender, to: recipients, subject, htmlContent: html }),
  });
  if (!res.ok) {
    throw new Error(`Brevo error ${res.status}: ${await res.text()}`);
  }
}

/**
 * Standard cron-facing helper. No-ops outside real production (dev/preview
 * never send real email) and for an empty/missing recipient, then delegates
 * to postBrevoEmail.
 */
export async function sendBrevoEmail(params: SendBrevoEmailParams): Promise<void> {
  if (!isRealProduction) return;
  const { to } = params;
  if (!to || (Array.isArray(to) && to.length === 0)) return;
  await postBrevoEmail(params);
}
