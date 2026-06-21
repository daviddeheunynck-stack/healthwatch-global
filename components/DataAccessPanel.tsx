"use client";

import { useState, useEffect } from "react";
import { Download, ChevronDown, ChevronUp, Copy, Check, Loader2, Key, Plus, Trash2, FileBarChart2, LayoutDashboard } from "lucide-react";
import { track } from "@vercel/analytics/react";

const COPY: Record<string, {
  title: string; subtitle: string; csv: string; json: string;
  snippets: string; r: string; python: string; copied: string; error: string;
  apiTitle: string; generate: string; revoke: string; apiCopied: string;
  keyOnce: string; apiPlan: string; noKeys: string; generating: string;
  apiMode: string; fileMode: string;
}> = {
  fr: {
    title: "Accès aux données", subtitle: "Téléchargez l'ensemble des foyers actifs ou intégrez-les dans votre pipeline R / Python.",
    csv: "Télécharger CSV", json: "Télécharger JSON", snippets: "Snippets R & Python",
    r: "R", python: "Python", copied: "Copié !", error: "Échec",
    apiTitle: "Clé API", generate: "Générer une clé", revoke: "Révoquer",
    apiCopied: "Clé copiée", keyOnce: "Copiez cette clé maintenant — elle ne s'affichera plus après fermeture de ce panneau.",
    apiPlan: "Accès API disponible sur les plans Pro, Équipe et Enterprise.",
    noKeys: "Aucune clé active", generating: "Génération…",
    apiMode: "Via API", fileMode: "Via fichier",
  },
  en: {
    title: "Data access", subtitle: "Download all active outbreaks or pipe them into your R / Python workflow.",
    csv: "Download CSV", json: "Download JSON", snippets: "R & Python snippets",
    r: "R", python: "Python", copied: "Copied!", error: "Failed",
    apiTitle: "API key", generate: "Generate a key", revoke: "Revoke",
    apiCopied: "Key copied", keyOnce: "Copy this key now — it will not be shown again after you close this panel.",
    apiPlan: "API access is available on Pro, Team, and Enterprise plans.",
    noKeys: "No active keys", generating: "Generating…",
    apiMode: "Via API", fileMode: "Via file",
  },
  es: {
    title: "Acceso a datos", subtitle: "Descargue todos los brotes activos o intégrelos en su flujo R / Python.",
    csv: "Descargar CSV", json: "Descargar JSON", snippets: "Fragmentos R & Python",
    r: "R", python: "Python", copied: "¡Copiado!", error: "Error",
    apiTitle: "Clave API", generate: "Generar una clave", revoke: "Revocar",
    apiCopied: "Clave copiada", keyOnce: "Copie esta clave ahora — no se mostrará de nuevo al cerrar este panel.",
    apiPlan: "Acceso API disponible en los planes Pro, Equipo y Enterprise.",
    noKeys: "Sin claves activas", generating: "Generando…",
    apiMode: "Vía API", fileMode: "Vía archivo",
  },
  ar: {
    title: "الوصول إلى البيانات", subtitle: "نزّل جميع التفشيات النشطة أو ادمجها في سير عمل R / Python.",
    csv: "تنزيل CSV", json: "تنزيل JSON", snippets: "مقاطع R و Python",
    r: "R", python: "Python", copied: "تم النسخ!", error: "فشل",
    apiTitle: "مفتاح API", generate: "إنشاء مفتاح", revoke: "إلغاء",
    apiCopied: "تم نسخ المفتاح", keyOnce: "انسخ هذا المفتاح الآن — لن يُعرض مجدداً بعد إغلاق هذا اللوح.",
    apiPlan: "الوصول بمفتاح API متاح في خطط Pro وTeam وEnterprise.",
    noKeys: "لا توجد مفاتيح نشطة", generating: "جارٍ الإنشاء…",
    apiMode: "عبر API", fileMode: "عبر ملف",
  },
  id: {
    title: "Akses data", subtitle: "Unduh semua wabah aktif atau integrasikan ke alur kerja R / Python Anda.",
    csv: "Unduh CSV", json: "Unduh JSON", snippets: "Cuplikan R & Python",
    r: "R", python: "Python", copied: "Disalin!", error: "Gagal",
    apiTitle: "Kunci API", generate: "Buat kunci", revoke: "Cabut",
    apiCopied: "Kunci disalin", keyOnce: "Salin kunci ini sekarang — tidak akan ditampilkan lagi setelah panel ini ditutup.",
    apiPlan: "Akses API tersedia di paket Pro, Team, dan Enterprise.",
    noKeys: "Tidak ada kunci aktif", generating: "Membuat…",
    apiMode: "Via API", fileMode: "Via file",
  },
};

interface ApiKeyEntry {
  id: string;
  name: string;
  key_prefix: string;
  last_used_at: string | null;
  created_at: string;
}

// ── Snippet generators ────────────────────────────────────────────────────────

function rFileSnippet(date: string) {
  return `library(jsonlite)

# Load the downloaded JSON snapshot
df <- fromJSON("healthwatch-outbreaks-${date}.json")$data

# Filter high-risk outbreaks
high_risk <- subset(df, risk_level == "high")

cat(nrow(df), "active outbreaks —", nrow(high_risk), "high risk\\n")
print(high_risk[, c("disease", "country", "cases", "cfr_pct")])`;
}

function pythonFileSnippet(date: string) {
  return `import json, pandas as pd

# Load the downloaded JSON snapshot
with open("healthwatch-outbreaks-${date}.json") as f:
    payload = json.load(f)

df = pd.DataFrame(payload["data"])
df["date"] = pd.to_datetime(df["date"])

high_risk = df[df["risk_level"] == "high"]
print(f"{len(df)} active outbreaks — {len(high_risk)} high risk")
print(high_risk[["disease", "country", "cases", "cfr_pct"]].to_string())`;
}

function rApiSnippet(key: string) {
  return `library(httr2)

API_KEY <- "${key}"

resp <- request("https://healthwatch-global.com/api/export") |>
  req_headers(\`X-API-Key\` = API_KEY) |>
  req_url_query(format = "json") |>
  req_perform()

df <- as.data.frame(resp_body_json(resp, simplifyVector = TRUE)$data)
df$date <- as.Date(df$date)

high_risk <- subset(df, risk_level == "high")
cat(nrow(df), "active outbreaks —", nrow(high_risk), "high risk\\n")
print(high_risk[, c("disease", "country", "cases", "cfr_pct")])`;
}

function pythonApiSnippet(key: string) {
  return `import requests, pandas as pd

API_KEY = "${key}"

resp = requests.get(
    "https://healthwatch-global.com/api/export",
    params={"format": "json"},
    headers={"X-API-Key": API_KEY},
)
df = pd.DataFrame(resp.json()["data"])
df["date"] = pd.to_datetime(df["date"])

high_risk = df[df["risk_level"] == "high"]
print(f"{len(df)} active outbreaks — {len(high_risk)} high risk")
print(high_risk[["disease", "country", "cases", "cfr_pct"]].to_string())`;
}

interface Props {
  locale: string;
}

export default function DataAccessPanel({ locale }: Props) {
  const c = COPY[locale] ?? COPY.en;
  const today = new Date().toISOString().split("T")[0];

  const [open,        setOpen]        = useState(false);
  const [snippetTab,  setSnippetTab]  = useState<"r" | "python">("r");
  const [csvLoading,  setCsvLoading]  = useState(false);
  const [jsonLoading, setJsonLoading] = useState(false);
  const [csvError,    setCsvError]    = useState("");
  const [jsonError,   setJsonError]   = useState("");
  const [copied,      setCopied]      = useState(false);

  // API key state
  const [apiKeys,       setApiKeys]       = useState<ApiKeyEntry[]>([]);
  const [loadingKeys,   setLoadingKeys]   = useState(false);
  const [keyPlanError,  setKeyPlanError]  = useState(false);
  const [newKeyValue,   setNewKeyValue]   = useState<string | null>(null);
  const [keyCopied,     setKeyCopied]     = useState(false);
  const [creatingKey,   setCreatingKey]   = useState(false);
  const [revokingId,    setRevokingId]    = useState<string | null>(null);

  // Load keys when panel opens
  useEffect(() => {
    if (!open) return;
    setLoadingKeys(true);
    setKeyPlanError(false);
    fetch("/api/api-keys")
      .then(async (r) => {
        if (r.status === 403) { setKeyPlanError(true); return; }
        const d = await r.json();
        if (d.keys) setApiKeys(d.keys);
      })
      .catch(() => {})
      .finally(() => setLoadingKeys(false));
  }, [open]);

  async function download(format: "csv" | "json") {
    const setLoading = format === "csv" ? setCsvLoading : setJsonLoading;
    const setError   = format === "csv" ? setCsvError   : setJsonError;
    setLoading(true); setError("");
    try {
      const url = format === "json" ? "/api/export?format=json" : "/api/export";
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `healthwatch-outbreaks-${today}.${format}`;
      a.click();
      URL.revokeObjectURL(a.href);
      track(`export_${format}`, { locale });
    } catch {
      setError(c.error);
    } finally {
      setLoading(false);
    }
  }

  async function generateKey() {
    if (creatingKey || apiKeys.length >= 5) return;
    setCreatingKey(true);
    setNewKeyValue(null);
    try {
      const res = await fetch("/api/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Export pipeline" }),
      });
      const d = await res.json();
      if (d.key) {
        setNewKeyValue(d.key);
        // Re-fetch list to get the actual id for future revoke
        const listRes = await fetch("/api/api-keys");
        const listD = await listRes.json();
        if (listD.keys) setApiKeys(listD.keys);
      }
    } catch { /* ignore */ } finally {
      setCreatingKey(false);
    }
  }

  async function revokeKey(id: string) {
    setRevokingId(id);
    try {
      await fetch(`/api/api-keys/${id}`, { method: "DELETE" });
      setApiKeys((prev) => prev.filter((k) => k.id !== id));
      if (newKeyValue && apiKeys.find((k) => k.id === id)) setNewKeyValue(null);
    } catch { /* ignore */ } finally {
      setRevokingId(null);
    }
  }

  async function copySnippet() {
    const activeKey = newKeyValue ?? (apiKeys.length > 0 ? `${apiKeys[0].key_prefix}...replace_with_full_key` : null);
    const snippet = snippetTab === "r"
      ? (activeKey ? rApiSnippet(activeKey) : rFileSnippet(today))
      : (activeKey ? pythonApiSnippet(activeKey) : pythonFileSnippet(today));
    await navigator.clipboard.writeText(snippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function copyKey() {
    if (!newKeyValue) return;
    await navigator.clipboard.writeText(newKeyValue);
    setKeyCopied(true);
    setTimeout(() => setKeyCopied(false), 3000);
  }

  const activeKey = newKeyValue ?? (apiKeys.length > 0 ? `${apiKeys[0].key_prefix}...` : null);
  const currentSnippet = snippetTab === "r"
    ? (activeKey ? rApiSnippet(activeKey) : rFileSnippet(today))
    : (activeKey ? pythonApiSnippet(activeKey) : pythonFileSnippet(today));

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900/40">
      {/* Header toggle */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-800/30 transition-colors rounded-xl"
      >
        <div>
          <span className="text-sm font-semibold text-gray-300">{c.title}</span>
          {!open && <span className="ml-2 text-xs text-gray-600">{c.subtitle}</span>}
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-gray-500 shrink-0" /> : <ChevronDown className="w-4 h-4 text-gray-500 shrink-0" />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-4 border-t border-gray-800 pt-4">
          <p className="text-xs text-gray-500">{c.subtitle}</p>

          {/* Download buttons */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => download("csv")}
              disabled={csvLoading}
              className="flex items-center gap-1.5 px-3 py-2 text-xs bg-gray-800 hover:bg-gray-700 disabled:opacity-50 border border-gray-700 text-gray-300 rounded-lg transition-colors"
            >
              {csvLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
              {c.csv}
            </button>
            <button
              onClick={() => download("json")}
              disabled={jsonLoading}
              className="flex items-center gap-1.5 px-3 py-2 text-xs bg-gray-800 hover:bg-gray-700 disabled:opacity-50 border border-gray-700 text-gray-300 rounded-lg transition-colors"
            >
              {jsonLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
              {c.json}
            </button>
            {csvError  && <span className="text-xs text-red-400 self-center">{csvError}</span>}
            {jsonError && <span className="text-xs text-red-400 self-center">{jsonError}</span>}
            <a
              href={`/${locale}/sitrep`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-2 text-xs bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 rounded-lg transition-colors"
            >
              <FileBarChart2 className="w-3.5 h-3.5" />
              {{ fr: "Sitrep hebdo", en: "Weekly sitrep", es: "Sitrep semanal", ar: "تقرير أسبوعي", id: "Sitrep mingguan" }[locale] ?? "Weekly sitrep"}
            </a>
            <a
              href={`/${locale}/briefing`}
              className="flex items-center gap-1.5 px-3 py-2 text-xs bg-red-900/30 hover:bg-red-900/50 border border-red-700/40 text-red-300 hover:text-red-200 rounded-lg transition-colors"
            >
              <LayoutDashboard className="w-3.5 h-3.5" />
              {{ fr: "Briefing exécutif", en: "Executive briefing", es: "Informe ejecutivo", ar: "إحاطة تنفيذية", id: "Laporan eksekutif" }[locale] ?? "Executive briefing"}
            </a>
          </div>

          {/* Code snippets */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{c.snippets}</p>
                {activeKey && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-900/30 border border-green-700/40 text-green-400">
                    {c.apiMode}
                  </span>
                )}
              </div>
              <div className="flex gap-1">
                {(["r", "python"] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setSnippetTab(tab)}
                    className={`text-xs px-2.5 py-1 rounded-md transition-colors ${
                      snippetTab === tab ? "bg-gray-700 text-white" : "text-gray-500 hover:text-gray-300"
                    }`}
                  >
                    {tab === "r" ? c.r : c.python}
                  </button>
                ))}
              </div>
            </div>

            <div className="relative">
              <pre className="bg-gray-950 border border-gray-800 rounded-lg p-3 text-[11px] text-gray-300 overflow-x-auto leading-relaxed font-mono">
                {currentSnippet}
              </pre>
              <button
                onClick={copySnippet}
                className="absolute top-2 right-2 p-1.5 rounded-md bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
                title="Copy"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          {/* ── API Key section ─────────────────────────────────────────────── */}
          <div className="pt-3 border-t border-gray-800 space-y-2">
            <div className="flex items-center gap-2">
              <Key className="w-3.5 h-3.5 text-gray-500" />
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{c.apiTitle}</p>
            </div>

            {keyPlanError ? (
              <p className="text-[11px] text-gray-600">{c.apiPlan}</p>
            ) : loadingKeys ? (
              <div className="h-7 w-40 bg-gray-800 rounded animate-pulse" />
            ) : (
              <div className="space-y-2">
                {/* New key banner — shown only right after generation */}
                {newKeyValue && (
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 bg-gray-950 border border-amber-700/40 rounded-lg px-3 py-2">
                      <code className="text-[11px] text-amber-400 flex-1 min-w-0 truncate font-mono">{newKeyValue}</code>
                      <button
                        onClick={copyKey}
                        className="shrink-0 p-1 rounded hover:bg-gray-800 text-gray-400 hover:text-white transition-colors"
                        title={c.apiCopied}
                      >
                        {keyCopied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                    <p className="text-[10px] text-amber-500/80">{c.keyOnce}</p>
                  </div>
                )}

                {/* Existing keys list */}
                {apiKeys.length > 0 && (
                  <div className="space-y-1">
                    {apiKeys.map((k) => (
                      <div key={k.id} className="flex items-center justify-between gap-2 text-xs text-gray-400">
                        <div className="flex items-center gap-2 min-w-0">
                          <code className="text-gray-300 font-mono shrink-0">{k.key_prefix}…</code>
                          <span className="text-gray-600 truncate">{k.name}</span>
                        </div>
                        <button
                          onClick={() => revokeKey(k.id)}
                          disabled={revokingId === k.id}
                          className="shrink-0 p-1 rounded hover:bg-red-900/20 text-gray-600 hover:text-red-400 transition-colors disabled:opacity-40"
                          title={c.revoke}
                        >
                          {revokingId === k.id
                            ? <Loader2 className="w-3 h-3 animate-spin" />
                            : <Trash2 className="w-3 h-3" />
                          }
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Generate button */}
                {apiKeys.length === 0 && !newKeyValue && (
                  <button
                    onClick={generateKey}
                    disabled={creatingKey}
                    className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-200 disabled:opacity-40 transition-colors"
                  >
                    {creatingKey
                      ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />{c.generating}</>
                      : <><Plus className="w-3.5 h-3.5" />{c.generate}</>
                    }
                  </button>
                )}
                {apiKeys.length > 0 && apiKeys.length < 5 && (
                  <button
                    onClick={generateKey}
                    disabled={creatingKey}
                    className="flex items-center gap-1.5 text-[11px] text-gray-600 hover:text-gray-400 disabled:opacity-40 transition-colors"
                  >
                    {creatingKey
                      ? <><Loader2 className="w-3 h-3 animate-spin" />{c.generating}</>
                      : <><Plus className="w-3 h-3" />{c.generate}</>
                    }
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
