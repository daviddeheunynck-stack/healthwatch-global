const clean = (v: string | undefined) => (v ?? "").replace(/^﻿/, "").trim();

export interface SentryIssue {
  title:     string;
  culprit:   string;
  count:     string;
  level:     string;
  permalink: string;
  shortId:   string;
}

export interface SentryCheck {
  ok:     boolean;
  issues: SentryIssue[];
  error?: string;
}

/**
 * Reads unresolved issues that fired in the last 24h via the Sentry Issues API.
 * Requires SENTRY_AUTH_TOKEN to carry the `event:read` + `project:read` scopes —
 * the token used for build-time source map upload does not have these, so this
 * returns { ok: false, error: "Sentry API 403: ..." } until the token is widened.
 */
export async function fetchSentryIssues(): Promise<SentryCheck> {
  const token   = clean(process.env.SENTRY_AUTH_TOKEN);
  const org     = clean(process.env.SENTRY_ORG);
  const project = clean(process.env.SENTRY_PROJECT);
  const baseUrl = clean(process.env.SENTRY_URL) || "https://sentry.io/";
  if (!token || !org || !project) {
    return { ok: false, issues: [], error: "SENTRY_AUTH_TOKEN/SENTRY_ORG/SENTRY_PROJECT manquant(s)" };
  }
  try {
    const query = encodeURIComponent("is:unresolved lastSeen:-24h");
    // environment=production keeps local `next dev` servers out of the health
    // check: sentry.server.config.ts tags them `development`, but without this
    // filter their crashes land in the same feed as real prod errors and are
    // indistinguishable without inspecting metadata.filename on the Sentry API.
    // Preview deployments (VERCEL_ENV=preview) are excluded too, by design —
    // this endpoint watches the deployment behind the prod alias.
    const res = await fetch(
      `${baseUrl}api/0/projects/${org}/${project}/issues/?query=${query}&statsPeriod=24h&environment=production&limit=25`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!res.ok) {
      const body = await res.text();
      return { ok: false, issues: [], error: `Sentry API ${res.status}: ${body.slice(0, 200)}` };
    }
    const issues = (await res.json()) as SentryIssue[];
    return { ok: true, issues };
  } catch (err) {
    return { ok: false, issues: [], error: err instanceof Error ? err.message : String(err) };
  }
}
