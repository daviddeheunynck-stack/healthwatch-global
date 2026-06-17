import { Terminal, Key, Zap, AlertTriangle, CheckCircle, ExternalLink } from "lucide-react";
import Link from "next/link";
import type { Metadata } from "next";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return {
    title: "API Documentation — HealthWatch Global",
    description: "REST API reference for the HealthWatch Global Enterprise plan. Access outbreak data updated every 6 hours, programmatically.",
    alternates: {
      canonical: `https://healthwatch-global.com/${locale}/docs`,
      languages: {
        en: "https://healthwatch-global.com/en/docs",
        fr: "https://healthwatch-global.com/fr/docs",
        es: "https://healthwatch-global.com/es/docs",
        ar: "https://healthwatch-global.com/ar/docs",
        id: "https://healthwatch-global.com/id/docs",
        "x-default": "https://healthwatch-global.com/en/docs",
      },
    },
    robots: { index: true, follow: true },
  };
}

const BASE = "https://healthwatch-global.com";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="space-y-4 scroll-mt-8">
      <h2 className="text-xl font-bold text-white border-b border-gray-800 pb-3">{title}</h2>
      {children}
    </section>
  );
}

function Code({ children, lang = "bash" }: { children: string; lang?: string }) {
  return (
    <div className="relative rounded-xl bg-gray-950 border border-gray-800 overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-800 bg-gray-900">
        <Terminal className="w-3.5 h-3.5 text-gray-500" />
        <span className="text-xs text-gray-500 font-mono">{lang}</span>
      </div>
      <pre className="p-4 text-sm text-gray-300 font-mono overflow-x-auto leading-relaxed">
        <code>{children}</code>
      </pre>
    </div>
  );
}

function ParamRow({ name, type, required, desc }: { name: string; type: string; required?: boolean; desc: string }) {
  return (
    <tr className="border-b border-gray-800">
      <td className="px-4 py-3 font-mono text-sm text-purple-300">{name}</td>
      <td className="px-4 py-3 font-mono text-xs text-blue-400">{type}</td>
      <td className="px-4 py-3 text-center">
        {required
          ? <span className="text-xs text-red-400 font-medium">required</span>
          : <span className="text-xs text-gray-600">optional</span>}
      </td>
      <td className="px-4 py-3 text-sm text-gray-400">{desc}</td>
    </tr>
  );
}

function ErrorRow({ code, meaning }: { code: number; meaning: string }) {
  return (
    <tr className="border-b border-gray-800">
      <td className="px-4 py-3 font-mono text-sm text-yellow-400">{code}</td>
      <td className="px-4 py-3 text-sm text-gray-400">{meaning}</td>
    </tr>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DocsPage({ params }: { params: Promise<{ locale: string }> }) {
  return (
    <div className="max-w-4xl mx-auto py-4 space-y-12">

      {/* Header */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-xs text-purple-400 font-semibold uppercase tracking-widest">
          <Key className="w-3.5 h-3.5" />
          Enterprise · API Reference
        </div>
        <h1 className="text-4xl font-bold text-white">API Documentation</h1>
        <p className="text-gray-400 text-lg leading-relaxed max-w-2xl">
          Programmatic access to WHO outbreak data, synced daily. Available on the{" "}
          <span className="text-purple-400 font-semibold">Enterprise plan</span>.
          Manage your API keys from{" "}
          <Link href="account" className="text-red-400 hover:text-red-300 underline underline-offset-2">
            your account
          </Link>.
        </p>
      </div>

      {/* Quick-start */}
      <div className="bg-gradient-to-r from-purple-950/40 via-gray-900/60 to-transparent border border-purple-700/30 rounded-2xl p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-purple-400" />
          <span className="text-sm font-bold text-purple-300 uppercase tracking-wide">Quick start</span>
        </div>
        <Code lang="bash">{`curl https://healthwatch-global.com/api/v1/outbreaks \\
  -H "X-API-Key: hwg_your_key_here"`}</Code>
        <p className="text-sm text-gray-500">
          Replace <code className="text-purple-300 font-mono">hwg_your_key_here</code> with a key generated in your account settings.
        </p>
      </div>

      {/* TOC */}
      <nav className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">Contents</p>
        <ul className="space-y-1.5 text-sm">
          {[
            ["#authentication",   "Authentication"],
            ["#base-url",         "Base URL"],
            ["#endpoints",        "Endpoints"],
            ["#parameters",       "Query parameters"],
            ["#response",         "Response schema"],
            ["#code-examples",    "Code examples"],
            ["#rate-limits",      "Rate limits"],
            ["#errors",           "Error codes"],
          ].map(([href, label]) => (
            <li key={href}>
              <a href={href} className="text-gray-400 hover:text-white transition-colors">
                {label}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      {/* ── Authentication ──────────────────────────────────────────────────── */}
      <Section id="authentication" title="Authentication">
        <p className="text-gray-400">
          All API requests must include your API key in the <code className="text-purple-300 font-mono">X-API-Key</code> header.
          Keys are prefixed with <code className="text-purple-300 font-mono">hwg_</code> and can be created and revoked at any time
          from your account settings.
        </p>
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="rounded-xl border border-green-500/20 bg-green-500/5 p-4 space-y-1">
            <div className="flex items-center gap-2 text-green-400 text-sm font-semibold">
              <CheckCircle className="w-4 h-4" /> Do
            </div>
            <ul className="text-sm text-gray-400 space-y-1 list-disc list-inside">
              <li>Store keys in environment variables</li>
              <li>Rotate keys periodically</li>
              <li>Use one key per environment (prod / staging)</li>
              <li>Revoke unused keys immediately</li>
            </ul>
          </div>
          <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4 space-y-1">
            <div className="flex items-center gap-2 text-red-400 text-sm font-semibold">
              <AlertTriangle className="w-4 h-4" /> Don&apos;t
            </div>
            <ul className="text-sm text-gray-400 space-y-1 list-disc list-inside">
              <li>Commit keys to source control</li>
              <li>Expose keys client-side (browser, mobile)</li>
              <li>Share keys between team members</li>
              <li>Log raw key values in production</li>
            </ul>
          </div>
        </div>
      </Section>

      {/* ── Base URL ────────────────────────────────────────────────────────── */}
      <Section id="base-url" title="Base URL">
        <div className="rounded-xl bg-gray-950 border border-gray-800 px-4 py-3 font-mono text-sm text-gray-300">
          {BASE}/api/v1
        </div>
        <p className="text-sm text-gray-500">
          All endpoints are versioned. The current version is <code className="text-purple-300">v1</code>. Breaking changes will increment the version.
        </p>
      </Section>

      {/* ── Endpoints ───────────────────────────────────────────────────────── */}
      <Section id="endpoints" title="Endpoints">
        <div className="rounded-xl border border-gray-800 overflow-hidden">
          <div className="flex items-center gap-3 px-4 py-3 bg-gray-900 border-b border-gray-800">
            <span className="text-xs font-bold text-green-400 bg-green-500/10 border border-green-500/20 px-2 py-0.5 rounded">GET</span>
            <code className="font-mono text-sm text-white">/api/v1/outbreaks</code>
          </div>
          <div className="px-4 py-4 space-y-2">
            <p className="text-sm text-gray-400">
              Returns a paginated list of active disease outbreaks sourced from the WHO, sorted by date descending.
            </p>
            <p className="text-sm text-gray-500">
              Data is refreshed daily via the WHO Disease Outbreak News feed.
            </p>
          </div>
        </div>
      </Section>

      {/* ── Parameters ──────────────────────────────────────────────────────── */}
      <Section id="parameters" title="Query parameters">
        <div className="rounded-xl border border-gray-800 overflow-hidden overflow-x-auto">
          <table className="w-full text-sm min-w-[500px]">
            <thead className="bg-gray-900 border-b border-gray-800">
              <tr>
                <th className="px-4 py-3 text-left text-xs text-gray-500 uppercase tracking-wide">Parameter</th>
                <th className="px-4 py-3 text-left text-xs text-gray-500 uppercase tracking-wide">Type</th>
                <th className="px-4 py-3 text-center text-xs text-gray-500 uppercase tracking-wide">Required</th>
                <th className="px-4 py-3 text-left text-xs text-gray-500 uppercase tracking-wide">Description</th>
              </tr>
            </thead>
            <tbody>
              <ParamRow name="region" type="string" desc="Filter by region: africa · asia · americas · europe · oceania" />
              <ParamRow name="risk"   type="string" desc="Filter by risk level: high · medium · low" />
              <ParamRow name="limit"  type="integer" desc="Number of results per page (1–100, default 50)" />
              <ParamRow name="offset" type="integer" desc="Pagination offset — number of records to skip (default 0)" />
            </tbody>
          </table>
        </div>
      </Section>

      {/* ── Response schema ─────────────────────────────────────────────────── */}
      <Section id="response" title="Response schema">
        <Code lang="json">{`{
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "disease": "Ebola virus disease",
      "country": "DR Congo",
      "region": "africa",
      "lat": -4.0,
      "lng": 21.8,
      "risk_level": "high",
      "cases": 381,
      "deaths": 64,
      "date": "2026-06-03",
      "source": "https://www.who.int/emergencies/disease-outbreak-news/item/2026-DON603",
      "description": "As of 3 June 2026, the Ministry of Health DRC...",
      "is_pheic": false,
      "active": true
    }
  ],
  "total": 39,
  "limit": 50,
  "offset": 0
}`}</Code>

        <div className="rounded-xl border border-gray-800 overflow-hidden overflow-x-auto">
          <table className="w-full text-sm min-w-[500px]">
            <thead className="bg-gray-900 border-b border-gray-800">
              <tr>
                <th className="px-4 py-3 text-left text-xs text-gray-500 uppercase tracking-wide">Field</th>
                <th className="px-4 py-3 text-left text-xs text-gray-500 uppercase tracking-wide">Type</th>
                <th className="px-4 py-3 text-left text-xs text-gray-500 uppercase tracking-wide">Description</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["id",            "string",  "Unique UUID identifier"],
                ["disease",       "string",  "Disease name (English)"],
                ["country",       "string",  "Affected country (English)"],
                ["region",        "string",  "Continent: africa · asia · americas · europe · oceania"],
                ["lat / lng",     "number",  "Geographic coordinates of the country centroid"],
                ["risk_level",    "string",  "WHO risk assessment: high · medium · low"],
                ["cases",         "integer", "Confirmed case count (0 = not reported in this bulletin)"],
                ["deaths",        "integer", "Confirmed death count"],
                ["date",          "string",  "Report publication date (ISO 8601: YYYY-MM-DD)"],
                ["source",        "string",  "WHO Disease Outbreak News article URL"],
                ["description",   "string",  "Summary extracted from the WHO bulletin (≤ 400 chars)"],
                ["is_pheic",      "boolean", "True when WHO has declared a Public Health Emergency of International Concern"],
                ["active",        "boolean", "False for deactivated / resolved outbreaks"],
              ].map(([field, type, desc]) => (
                <tr key={field} className="border-b border-gray-800">
                  <td className="px-4 py-3 font-mono text-sm text-purple-300">{field}</td>
                  <td className="px-4 py-3 font-mono text-xs text-blue-400">{type}</td>
                  <td className="px-4 py-3 text-sm text-gray-400">{desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      {/* ── Code examples ───────────────────────────────────────────────────── */}
      <Section id="code-examples" title="Code examples">

        <h3 className="text-base font-semibold text-gray-300">cURL</h3>
        <Code lang="bash">{`# All active outbreaks
curl "https://healthwatch-global.com/api/v1/outbreaks" \\
  -H "X-API-Key: hwg_your_key_here"

# High-risk outbreaks in Africa, first 10
curl "https://healthwatch-global.com/api/v1/outbreaks?region=africa&risk=high&limit=10" \\
  -H "X-API-Key: hwg_your_key_here"

# Paginate: skip first 50, get next 50
curl "https://healthwatch-global.com/api/v1/outbreaks?limit=50&offset=50" \\
  -H "X-API-Key: hwg_your_key_here"`}</Code>

        <h3 className="text-base font-semibold text-gray-300 mt-6">Python</h3>
        <Code lang="python">{`import requests

API_KEY = "hwg_your_key_here"
BASE    = "https://healthwatch-global.com/api/v1"

def get_outbreaks(region=None, risk=None, limit=50, offset=0):
    params = {"limit": limit, "offset": offset}
    if region: params["region"] = region
    if risk:   params["risk"]   = risk

    resp = requests.get(
        f"{BASE}/outbreaks",
        headers={"X-API-Key": API_KEY},
        params=params,
        timeout=10,
    )
    resp.raise_for_status()
    return resp.json()

# Example: all high-risk outbreaks
result = get_outbreaks(risk="high")
for outbreak in result["data"]:
    print(f"{outbreak['disease']} — {outbreak['country']} ({outbreak['risk_level']})")`}</Code>

        <h3 className="text-base font-semibold text-gray-300 mt-6">JavaScript / TypeScript</h3>
        <Code lang="typescript">{`const API_KEY = process.env.HEALTHWATCH_API_KEY; // never expose client-side
const BASE    = "https://healthwatch-global.com/api/v1";

interface Outbreak {
  id: string;
  disease: string;
  country: string;
  region: string;
  lat: number;
  lng: number;
  risk_level: "high" | "medium" | "low";
  cases: number;
  deaths: number;
  date: string;
  source: string;
  description: string;
  is_pheic: boolean;
  active: boolean;
}

interface OutbreakResponse {
  data: Outbreak[];
  total: number;
  limit: number;
  offset: number;
}

async function getOutbreaks(params?: {
  region?: "africa" | "asia" | "americas" | "europe" | "oceania";
  risk?: "high" | "medium" | "low";
  limit?: number;
  offset?: number;
}): Promise<OutbreakResponse> {
  const url = new URL(\`\${BASE}/outbreaks\`);
  if (params?.region) url.searchParams.set("region", params.region);
  if (params?.risk)   url.searchParams.set("risk",   params.risk);
  if (params?.limit)  url.searchParams.set("limit",  String(params.limit));
  if (params?.offset) url.searchParams.set("offset", String(params.offset));

  const res = await fetch(url.toString(), {
    headers: { "X-API-Key": API_KEY! },
    next: { revalidate: 3600 }, // cache 1h in Next.js
  });

  if (!res.ok) throw new Error(\`API error: \${res.status}\`);
  return res.json();
}

// Example
const { data } = await getOutbreaks({ region: "africa", risk: "high" });
console.log(data);`}</Code>
      </Section>

      {/* ── Rate limits ─────────────────────────────────────────────────────── */}
      <Section id="rate-limits" title="Rate limits">
        <div className="rounded-xl border border-gray-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-900 border-b border-gray-800">
              <tr>
                <th className="px-4 py-3 text-left text-xs text-gray-500 uppercase tracking-wide">Limit</th>
                <th className="px-4 py-3 text-left text-xs text-gray-500 uppercase tracking-wide">Value</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["Requests per minute (per key)", "300"],
                ["Max results per request",       "100"],
                ["Max API keys per account",       "5"],
              ].map(([label, val]) => (
                <tr key={label} className="border-b border-gray-800">
                  <td className="px-4 py-3 text-gray-400">{label}</td>
                  <td className="px-4 py-3 font-mono text-white font-semibold">{val}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-sm text-gray-500">
          When a rate limit is exceeded, the API returns HTTP <code className="text-yellow-400">429</code> with a{" "}
          <code className="text-purple-300 font-mono">Retry-After: 60</code> header.
          The <code className="text-purple-300 font-mono">X-RateLimit-Remaining</code> response header shows remaining requests in the current window.
        </p>
      </Section>

      {/* ── Errors ──────────────────────────────────────────────────────────── */}
      <Section id="errors" title="Error codes">
        <div className="rounded-xl border border-gray-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-900 border-b border-gray-800">
              <tr>
                <th className="px-4 py-3 text-left text-xs text-gray-500 uppercase tracking-wide">HTTP Status</th>
                <th className="px-4 py-3 text-left text-xs text-gray-500 uppercase tracking-wide">Meaning</th>
              </tr>
            </thead>
            <tbody>
              <ErrorRow code={200} meaning="Success — response body contains requested data" />
              <ErrorRow code={400} meaning="Bad request — invalid query parameter value" />
              <ErrorRow code={401} meaning="Unauthorized — missing or invalid X-API-Key header" />
              <ErrorRow code={403} meaning="Forbidden — API key valid but Enterprise subscription is not active" />
              <ErrorRow code={429} meaning="Rate limit exceeded — retry after the value in the Retry-After header" />
              <ErrorRow code={500} meaning="Internal server error — contact support if this persists" />
            </tbody>
          </table>
        </div>
        <p className="text-sm text-gray-500">
          All error responses include a JSON body: <code className="text-purple-300 font-mono">{"{ \"error\": \"human-readable message\" }"}</code>
        </p>
      </Section>

      {/* ── Embeddable widget ───────────────────────────────────────────────── */}
      <Section id="widget" title="Embeddable widget">
        <p className="text-gray-400 text-sm mb-4">
          Embed a live outbreak feed on any website — no API key required.
          Copy the snippet below and paste it into your HTML.
        </p>

        <h3 className="text-base font-semibold text-gray-300 mb-2">Basic embed</h3>
        <Code lang="html">{`<iframe
  src="https://healthwatch-global.com/widget?locale=en"
  width="400"
  height="320"
  frameborder="0"
  style="border-radius:12px;overflow:hidden;"
  title="HealthWatch Global — Live outbreak feed"
></iframe>`}</Code>

        <h3 className="text-base font-semibold text-gray-300 mt-6 mb-2">Parameters</h3>
        <div className="rounded-xl border border-gray-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-900 border-b border-gray-800">
              <tr>
                <th className="px-4 py-3 text-left text-xs text-gray-500 uppercase">Param</th>
                <th className="px-4 py-3 text-left text-xs text-gray-500 uppercase">Values</th>
                <th className="px-4 py-3 text-left text-xs text-gray-500 uppercase">Default</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["locale", "fr · en · es · ar · id", "en"],
                ["region", "africa · asia · europe · americas · oceania · all", "all"],
                ["theme", "dark · light", "dark"],
                ["limit", "1 – 10", "5"],
              ].map(([p, v, d]) => (
                <tr key={p} className="border-b border-gray-800">
                  <td className="px-4 py-3 font-mono text-purple-300">{p}</td>
                  <td className="px-4 py-3 text-gray-400 font-mono text-xs">{v}</td>
                  <td className="px-4 py-3 text-gray-500">{d}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h3 className="text-base font-semibold text-gray-300 mt-6 mb-2">Example — Africa, French, light theme</h3>
        <Code lang="html">{`<iframe
  src="https://healthwatch-global.com/widget?locale=fr&region=africa&theme=light&limit=7"
  width="380"
  height="400"
  frameborder="0"
  style="border-radius:12px;"
  title="Foyers épidémiques en Afrique — HealthWatch Global"
></iframe>`}</Code>
      </Section>

      {/* Footer CTA */}
      <div className="rounded-2xl border border-purple-700/30 bg-gradient-to-r from-purple-950/40 to-transparent p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-white font-semibold">Ready to integrate?</p>
          <p className="text-sm text-gray-400 mt-0.5">
            Generate your first API key from your account settings.
          </p>
        </div>
        <Link
          href="account"
          className="flex items-center gap-2 bg-purple-600 hover:bg-purple-500 text-white font-semibold px-5 py-2.5 rounded-xl transition-colors text-sm shrink-0"
        >
          Go to account settings
          <ExternalLink className="w-4 h-4" />
        </Link>
      </div>

    </div>
  );
}
