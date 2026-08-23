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
  /** Vraies exceptions : ce qui a planté. Seul champ qui décide de la santé. */
  issues: SentryIssue[];
  /**
   * Constats émis par le système sur lui-même (gardes déclenchées, sondes de
   * couverture, canaux de livraison) — voir captureSelfReport() dans
   * lib/cron-monitor.ts. Remontés pour information, jamais comptés comme une
   * panne : une garde anti-régression qui bloque une écriture est un succès,
   * et faisait pourtant passer /api/health au rouge avant le 2026-08-23.
   */
  selfReports: SentryIssue[];
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
    return { ok: false, issues: [], selfReports: [], error: "SENTRY_AUTH_TOKEN/SENTRY_ORG/SENTRY_PROJECT manquant(s)" };
  }
  try {
    // `!self_report:true` écarte les constats du système sur lui-même. Les
    // incidents ANTÉRIEURS au 2026-08-23 n'ont pas le tag et resteront donc
    // comptés comme des erreurs jusqu'à ce qu'ils soient résolus ou qu'ils
    // refirent avec le tag — c'est voulu : filtrer aussi sur le libellé
    // (`[health-check]`, `[who-regional]`…) marcherait aujourd'hui et
    // masquerait demain une vraie exception dont le message commence par un
    // crochet.
    const query = encodeURIComponent("is:unresolved lastSeen:-24h !self_report:true");
    // environment=production keeps local `next dev` servers out of the health
    // check: sentry.server.config.ts tags them `development`, but without this
    // filter their crashes land in the same feed as real prod errors and are
    // indistinguishable without inspecting metadata.filename on the Sentry API.
    // Preview deployments (VERCEL_ENV=preview) are excluded too, by design —
    // this endpoint watches the deployment behind the prod alias.
    const selfQuery = encodeURIComponent("is:unresolved lastSeen:-24h self_report:true");
    const url = (q: string) =>
      `${baseUrl}api/0/projects/${org}/${project}/issues/?query=${q}&statsPeriod=24h&environment=production&limit=25`;
    const auth = { headers: { Authorization: `Bearer ${token}` } };

    // Les constats ne doivent jamais faire échouer le contrôle : si leur
    // requête part en erreur, on rend quand même les vraies exceptions.
    const [res, selfRes] = await Promise.all([
      fetch(url(query), auth),
      fetch(url(selfQuery), auth).catch(() => null),
    ]);
    if (!res.ok) {
      const body = await res.text();
      return { ok: false, issues: [], selfReports: [], error: `Sentry API ${res.status}: ${body.slice(0, 200)}` };
    }
    const issues = (await res.json()) as SentryIssue[];
    const selfReports = selfRes?.ok ? ((await selfRes.json()) as SentryIssue[]) : [];
    return { ok: true, issues, selfReports };
  } catch (err) {
    return { ok: false, issues: [], selfReports: [], error: err instanceof Error ? err.message : String(err) };
  }
}
