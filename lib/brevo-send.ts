// Shared Brevo transactional-send helper. Every cron used to duplicate its own
// fetch("https://api.brevo.com/v3/smtp/email") — none of them set List-Unsubscribe,
// so mail clients (Gmail/Yahoo/Outlook) had no native one-click unsubscribe to
// offer, and the only unsubscribe path was the link inside the email body itself.
// That link being a plain GET is what let a corporate email security gateway
// (which prefetches every URL in a message to scan it) silently unsubscribe a
// real institutional subscriber (IOM, 2026-08-03) without any human intent.
//
// List-Unsubscribe-Post: List-Unsubscribe=One-Click (RFC 8058) tells the mail
// client "you may POST to the List-Unsubscribe URL directly, no page load
// required" — but crucially, security-gateway prefetchers that only ever issue
// GET requests to scan links can no longer trigger the unsubscribe, since the
// action now requires a POST. The GET routes still render a confirmation page
// for a human clicking the in-body link (see app/api/unsubscribe*/route.ts).
export async function sendBrevoEmail(opts: {
  to: string;
  subject: string;
  html: string;
  apiKey: string;
  unsubscribeUrl?: string;
  // Defaults to the long-standing alerts@ identity every caller used before
  // this param existed. onboarding-sequence is the only caller that overrides
  // it (2026-08-23) — see its header comment: healthwatch-global.com is fully
  // domain-authenticated in Brevo (SPF/DKIM via DNS), so any @healthwatch-
  // global.com local part sends without extra per-address setup.
  senderEmail?: string;
  senderName?: string;
}): Promise<void> {
  const { to, subject, html, apiKey, unsubscribeUrl, senderEmail, senderName } = opts;
  if (!apiKey) throw new Error("BREVO_API_KEY not set");

  const headers: Record<string, string> = {};
  if (unsubscribeUrl) {
    headers["List-Unsubscribe"] = `<${unsubscribeUrl}>`;
    headers["List-Unsubscribe-Post"] = "List-Unsubscribe=One-Click";
  }

  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    signal: AbortSignal.timeout(10_000),
    headers: { "api-key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({
      sender: { name: senderName ?? "HealthWatch Global", email: senderEmail ?? "alerts@healthwatch-global.com" },
      to: [{ email: to }],
      subject,
      htmlContent: html,
      ...(unsubscribeUrl ? { headers } : {}),
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Brevo error: ${err}`);
  }
}
