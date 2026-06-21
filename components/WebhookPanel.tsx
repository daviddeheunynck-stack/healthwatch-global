"use client";

import { useState, useEffect } from "react";
import {
  Webhook, Plus, Trash2, Copy, Check, ChevronDown, ChevronUp,
  Loader2, ToggleLeft, ToggleRight, AlertCircle, Clock,
} from "lucide-react";

interface WebhookEntry {
  id: string;
  name: string;
  url: string;
  filters: { regions?: string[]; risk_levels?: string[]; rt_threshold?: number; disease_thresholds?: { disease_en: string; min_cases: number }[]; proximity?: { lat: number; lng: number; radius_km: number; label?: string }; min_change_pct?: number };
  active: boolean;
  last_triggered_at: string | null;
  last_status_code: number | null;
  created_at: string;
}

const COPY: Record<string, {
  title: string; subtitle: string; add: string; cancel: string;
  namePlaceholder: string; urlPlaceholder: string; secretNote: string;
  region: string; risk: string; allRegions: string; allRisks: string;
  create: string; creating: string; noWebhooks: string; delete: string;
  lastFired: string; neverFired: string; planError: string;
  secretLabel: string; secretCopied: string; copySecret: string;
  toggle: string; status: (code: number | null) => string;
  rtThreshold: string; rtNote: string; diseaseThresholds: string; diseasePlaceholder: string; minCasesLabel: string;
  proximity: string; proxLat: string; proxLng: string; proxRadius: string; proxLabelInput: string;
  minChangePct: string; minChangePctNote: string;
}> = {
  fr: {
    title: "Webhooks", subtitle: "Recevez un push HTTPS chaque fois qu'un foyer atteint le niveau de risque configuré.",
    add: "Ajouter un webhook", cancel: "Annuler",
    namePlaceholder: "Nom (ex: Alerte PAHO)", urlPlaceholder: "https://mon-systeme.org/webhook",
    secretNote: "Copiez le secret maintenant — il ne s'affichera plus.",
    region: "Région", risk: "Niveau de risque", allRegions: "Toutes régions", allRisks: "Tous niveaux",
    create: "Créer", creating: "Création…", noWebhooks: "Aucun webhook configuré",
    delete: "Supprimer", lastFired: "Dernier envoi", neverFired: "Jamais déclenché",
    planError: "Webhooks disponibles sur les plans Pro, Équipe et Enterprise.",
    secretLabel: "Secret HMAC", secretCopied: "Copié", copySecret: "Copier le secret",
    toggle: "Activer/désactiver",
    rtThreshold: "Seuil Rt", rtNote: "Déclencher si Rt ≥ ce seuil (ex: 1.5)",
    diseaseThresholds: "Seuils IHR par maladie", diseasePlaceholder: "Ebola", minCasesLabel: "cas min",
    proximity: "Alerte de proximité", proxLat: "Latitude", proxLng: "Longitude", proxRadius: "Rayon (km)", proxLabelInput: "Lieu (optionnel)",
    minChangePct: "Seuil de variation", minChangePctNote: "Déclencher si les cas augmentent de ≥ X % ou si le niveau de risque change (évite les alertes répétitives)",
    status: (c) => c === null ? "—" : c >= 200 && c < 300 ? `✓ ${c}` : `✗ ${c}`,
  },
  en: {
    title: "Webhooks", subtitle: "Receive an HTTPS push every time an outbreak reaches your configured risk level.",
    add: "Add a webhook", cancel: "Cancel",
    namePlaceholder: "Name (e.g. PAHO alert)", urlPlaceholder: "https://my-system.org/webhook",
    secretNote: "Copy the secret now — it won't be shown again.",
    region: "Region", risk: "Risk level", allRegions: "All regions", allRisks: "All levels",
    create: "Create", creating: "Creating…", noWebhooks: "No webhooks configured",
    delete: "Delete", lastFired: "Last delivery", neverFired: "Never triggered",
    planError: "Webhooks are available on Pro, Team, and Enterprise plans.",
    secretLabel: "HMAC secret", secretCopied: "Copied", copySecret: "Copy secret",
    toggle: "Enable/disable",
    rtThreshold: "Rt threshold", rtNote: "Trigger if Rt ≥ value (e.g. 1.5)",
    diseaseThresholds: "IHR thresholds per disease", diseasePlaceholder: "Ebola", minCasesLabel: "min cases",
    proximity: "Proximity alert", proxLat: "Latitude", proxLng: "Longitude", proxRadius: "Radius (km)", proxLabelInput: "Label (optional)",
    minChangePct: "Change threshold", minChangePctNote: "Fire only if cases increase by ≥ X % or risk level changes (reduces alert fatigue)",
    status: (c) => c === null ? "—" : c >= 200 && c < 300 ? `✓ ${c}` : `✗ ${c}`,
  },
  es: {
    title: "Webhooks", subtitle: "Reciba un push HTTPS cada vez que un brote alcanza el nivel de riesgo configurado.",
    add: "Añadir un webhook", cancel: "Cancelar",
    namePlaceholder: "Nombre (ej: Alerta OPS)", urlPlaceholder: "https://mi-sistema.org/webhook",
    secretNote: "Copie el secreto ahora — no se mostrará de nuevo.",
    region: "Región", risk: "Nivel de riesgo", allRegions: "Todas las regiones", allRisks: "Todos los niveles",
    create: "Crear", creating: "Creando…", noWebhooks: "Sin webhooks configurados",
    delete: "Eliminar", lastFired: "Último envío", neverFired: "Nunca activado",
    planError: "Los webhooks están disponibles en los planes Pro, Team y Enterprise.",
    secretLabel: "Secreto HMAC", secretCopied: "Copiado", copySecret: "Copiar secreto",
    toggle: "Activar/desactivar",
    rtThreshold: "Umbral Rt", rtNote: "Activar si Rt ≥ umbral (ej: 1.5)",
    diseaseThresholds: "Umbrales IHR por enfermedad", diseasePlaceholder: "Ebola", minCasesLabel: "casos mín",
    proximity: "Alerta de proximidad", proxLat: "Latitud", proxLng: "Longitud", proxRadius: "Radio (km)", proxLabelInput: "Lugar (opcional)",
    minChangePct: "Umbral de variación", minChangePctNote: "Disparar si los casos aumentan ≥ X % o cambia el nivel de riesgo (reduce alertas repetidas)",
    status: (c) => c === null ? "—" : c >= 200 && c < 300 ? `✓ ${c}` : `✗ ${c}`,
  },
  ar: {
    title: "Webhooks", subtitle: "استلم push HTTPS في كل مرة يصل فيها تفشٍّ إلى مستوى الخطر المُهيَّأ.",
    add: "إضافة webhook", cancel: "إلغاء",
    namePlaceholder: "الاسم (مثال: تنبيه PAHO)", urlPlaceholder: "https://my-system.org/webhook",
    secretNote: "انسخ السر الآن — لن يُعرض مجدداً.",
    region: "المنطقة", risk: "مستوى الخطر", allRegions: "جميع المناطق", allRisks: "جميع المستويات",
    create: "إنشاء", creating: "جارٍ الإنشاء…", noWebhooks: "لا توجد webhooks مُهيَّأة",
    delete: "حذف", lastFired: "آخر تسليم", neverFired: "لم يُطلَق قط",
    planError: "Webhooks متاحة في خطط Pro وTeam وEnterprise.",
    secretLabel: "السر HMAC", secretCopied: "تم النسخ", copySecret: "نسخ السر",
    toggle: "تفعيل/تعطيل",
    rtThreshold: "عتبة Rt", rtNote: "تشغيل إذا Rt ≥ العتبة",
    diseaseThresholds: "عتبات IHR لكل مرض", diseasePlaceholder: "Ebola", minCasesLabel: "حالات دنيا",
    proximity: "تنبيه القرب", proxLat: "خط العرض", proxLng: "خط الطول", proxRadius: "نطاق (كم)", proxLabelInput: "المكان (اختياري)",
    minChangePct: "حد التغيير", minChangePctNote: "إطلاق التنبيه عند زيادة الحالات بنسبة ≥ X٪ أو تغيير مستوى الخطر",
    status: (c) => c === null ? "—" : c !== null && c >= 200 && c < 300 ? `✓ ${c}` : `✗ ${c}`,
  },
  id: {
    title: "Webhooks", subtitle: "Terima push HTTPS setiap kali wabah mencapai tingkat risiko yang dikonfigurasi.",
    add: "Tambah webhook", cancel: "Batal",
    namePlaceholder: "Nama (mis: Alert PAHO)", urlPlaceholder: "https://sistem-saya.org/webhook",
    secretNote: "Salin secret sekarang — tidak akan ditampilkan lagi.",
    region: "Wilayah", risk: "Tingkat risiko", allRegions: "Semua wilayah", allRisks: "Semua tingkat",
    create: "Buat", creating: "Membuat…", noWebhooks: "Tidak ada webhook yang dikonfigurasi",
    delete: "Hapus", lastFired: "Pengiriman terakhir", neverFired: "Belum pernah dipicu",
    planError: "Webhook tersedia di paket Pro, Team, dan Enterprise.",
    secretLabel: "Rahasia HMAC", secretCopied: "Disalin", copySecret: "Salin secret",
    toggle: "Aktifkan/nonaktifkan",
    rtThreshold: "Ambang Rt", rtNote: "Aktifkan jika Rt ≥ nilai (mis. 1.5)",
    diseaseThresholds: "Ambang IHR per penyakit", diseasePlaceholder: "Ebola", minCasesLabel: "kasus min",
    proximity: "Peringatan kedekatan", proxLat: "Lintang", proxLng: "Bujur", proxRadius: "Radius (km)", proxLabelInput: "Lokasi (opsional)",
    minChangePct: "Ambang perubahan", minChangePctNote: "Picu jika kasus naik ≥ X% atau tingkat risiko berubah (kurangi kelelahan peringatan)",
    status: (c) => c === null ? "—" : c !== null && c >= 200 && c < 300 ? `✓ ${c}` : `✗ ${c}`,
  },
};

const REGIONS = ["africa", "asia", "americas", "europe", "oceania"];
const REGION_LABELS: Record<string, Record<string, string>> = {
  fr: { africa: "Afrique", asia: "Asie", americas: "Amériques", europe: "Europe", oceania: "Océanie" },
  en: { africa: "Africa",  asia: "Asia", americas: "Americas",  europe: "Europe", oceania: "Oceania" },
  es: { africa: "África",  asia: "Asia", americas: "Américas",  europe: "Europa", oceania: "Oceanía" },
  ar: { africa: "أفريقيا", asia: "آسيا", americas: "الأمريكتان", europe: "أوروبا", oceania: "أوقيانوسيا" },
  id: { africa: "Afrika",  asia: "Asia", americas: "Amerika",   europe: "Eropa",  oceania: "Oseania" },
};
const RISK_LABELS: Record<string, Record<string, string>> = {
  fr: { high: "Élevé", medium: "Moyen", low: "Faible" },
  en: { high: "High",  medium: "Medium", low: "Low"  },
  es: { high: "Alto",  medium: "Medio",  low: "Bajo" },
  ar: { high: "عالٍ",  medium: "متوسط", low: "منخفض" },
  id: { high: "Tinggi", medium: "Sedang", low: "Rendah" },
};

interface Props { locale: string }

export default function WebhookPanel({ locale }: Props) {
  const c = COPY[locale] ?? COPY.en;
  const rl = REGION_LABELS[locale] ?? REGION_LABELS.en;
  const riskL = RISK_LABELS[locale] ?? RISK_LABELS.en;

  const [open,       setOpen]       = useState(false);
  const [webhooks,   setWebhooks]   = useState<WebhookEntry[]>([]);
  const [loading,    setLoading]    = useState(false);
  const [planError,  setPlanError]  = useState(false);
  const [showForm,   setShowForm]   = useState(false);

  // New webhook form state
  const [name,         setName]         = useState("");
  const [url,          setUrl]          = useState("");
  const [selRegions,   setSelRegions]   = useState<string[]>([]);
  const [selRisks,     setSelRisks]     = useState<string[]>(["high"]);
  const [creating,     setCreating]     = useState(false);
  const [formError,    setFormError]    = useState("");
  const [newSecret,    setNewSecret]    = useState<string | null>(null);
  const [secretCopied, setSecretCopied] = useState(false);
  const [deletingId,   setDeletingId]   = useState<string | null>(null);
  const [togglingId,   setTogglingId]   = useState<string | null>(null);
  const [rtThreshold,  setRtThreshold]  = useState<number | "">("");
  const [disThresholds, setDisThresholds] = useState<{ disease_en: string; min_cases: number }[]>([]);
  const [newDisEn,      setNewDisEn]      = useState("");
  const [newMinCases,   setNewMinCases]   = useState<number | "">(1);
  const [enableProximity, setEnableProximity] = useState(false);
  const [proxLat,   setProxLat]   = useState<number | "">("");
  const [proxLng,   setProxLng]   = useState<number | "">("");
  const [proxRadius, setProxRadius] = useState<number | "">(500);
  const [proxLabel, setProxLabel]  = useState("");
  const [minChangePct, setMinChangePct] = useState<number | "">("");

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setPlanError(false);
    fetch("/api/webhooks")
      .then(async (r) => {
        if (r.status === 403) { setPlanError(true); return; }
        const d = await r.json();
        if (d.webhooks) setWebhooks(d.webhooks);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [open]);

  function toggleRegion(r: string) {
    setSelRegions((prev) => prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r]);
  }
  function toggleRisk(r: string) {
    setSelRisks((prev) => prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r]);
  }

  function addDisThreshold() {
    const disease = newDisEn.trim();
    if (!disease) return;
    const cases = typeof newMinCases === "number" && newMinCases > 0 ? Math.round(newMinCases) : 1;
    setDisThresholds((prev) => [...prev, { disease_en: disease, min_cases: cases }]);
    setNewDisEn(""); setNewMinCases(1);
  }
  function removeDisThreshold(idx: number) {
    setDisThresholds((prev) => prev.filter((_, i) => i !== idx));
  }

  async function createWebhook() {
    if (creating) return;
    if (!url.startsWith("https://")) { setFormError("URL must start with https://"); return; }
    setCreating(true); setFormError("");
    try {
      const res = await fetch("/api/webhooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim() || "My webhook",
          url: url.trim(),
          regions: selRegions,
          risk_levels: selRisks.length > 0 ? selRisks : ["high"],
          rt_threshold: rtThreshold !== "" ? Number(rtThreshold) : undefined,
          disease_thresholds: disThresholds.length > 0 ? disThresholds : undefined,
          proximity: enableProximity && proxLat !== "" && proxLng !== "" ? {
            lat: Number(proxLat),
            lng: Number(proxLng),
            radius_km: proxRadius !== "" ? Number(proxRadius) : 500,
            label: proxLabel.trim() || undefined,
          } : undefined,
          min_change_pct: minChangePct !== "" ? Number(minChangePct) : undefined,
        }),
      });
      const d = await res.json();
      if (d.error) { setFormError(d.error); return; }
      if (d.webhook) {
        setWebhooks((prev) => [d.webhook, ...prev]);
        setNewSecret(d.secret);
        setName(""); setUrl(""); setSelRegions([]); setSelRisks(["high"]); setRtThreshold(""); setDisThresholds([]); setNewDisEn(""); setNewMinCases(1);
        setEnableProximity(false); setProxLat(""); setProxLng(""); setProxRadius(500); setProxLabel("");
        setMinChangePct("");
        setShowForm(false);
      }
    } catch { setFormError("Network error"); } finally { setCreating(false); }
  }

  async function deleteWebhook(id: string) {
    setDeletingId(id);
    try {
      await fetch(`/api/webhooks/${id}`, { method: "DELETE" });
      setWebhooks((prev) => prev.filter((w) => w.id !== id));
      if (newSecret) setNewSecret(null);
    } catch { /* ignore */ } finally { setDeletingId(null); }
  }

  async function toggleWebhook(id: string, active: boolean) {
    setTogglingId(id);
    try {
      await fetch(`/api/webhooks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !active }),
      });
      setWebhooks((prev) => prev.map((w) => w.id === id ? { ...w, active: !active } : w));
    } catch { /* ignore */ } finally { setTogglingId(null); }
  }

  async function copySecret() {
    if (!newSecret) return;
    await navigator.clipboard.writeText(newSecret);
    setSecretCopied(true);
    setTimeout(() => setSecretCopied(false), 3000);
  }

  function fmt(ts: string | null) {
    if (!ts) return c.neverFired;
    return new Date(ts).toLocaleString(
      locale === "ar" ? "ar-SA" : locale === "fr" ? "fr-FR" : locale === "es" ? "es-ES" : locale === "id" ? "id-ID" : "en-GB",
      { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }
    );
  }

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900/40">
      {/* Header toggle */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-800/30 transition-colors rounded-xl"
      >
        <div className="flex items-center gap-2">
          <Webhook className="w-4 h-4 text-gray-500 shrink-0" />
          <span className="text-sm font-semibold text-gray-300">{c.title}</span>
          {!open && webhooks.length > 0 && (
            <span className="text-xs text-gray-600">({webhooks.length})</span>
          )}
          {!open && <span className="ml-1 text-xs text-gray-600">{c.subtitle}</span>}
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-gray-500 shrink-0" /> : <ChevronDown className="w-4 h-4 text-gray-500 shrink-0" />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-4 border-t border-gray-800 pt-4">
          <p className="text-xs text-gray-500">{c.subtitle}</p>

          {planError ? (
            <p className="text-[11px] text-gray-600">{c.planError}</p>
          ) : loading ? (
            <div className="h-8 w-40 bg-gray-800 rounded animate-pulse" />
          ) : (
            <>
              {/* New secret banner */}
              {newSecret && (
                <div className="space-y-1.5 p-3 bg-amber-950/30 border border-amber-700/30 rounded-xl">
                  <p className="text-[11px] font-semibold text-amber-400">{c.secretLabel}</p>
                  <div className="flex items-center gap-2 bg-gray-950 rounded-lg px-3 py-2">
                    <code className="text-[11px] text-amber-300 font-mono flex-1 min-w-0 truncate">{newSecret}</code>
                    <button onClick={copySecret} className="shrink-0 p-1 rounded hover:bg-gray-800 text-gray-400 hover:text-white transition-colors">
                      {secretCopied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  <p className="text-[10px] text-amber-500/80">{c.secretNote}</p>
                </div>
              )}

              {/* Existing webhooks */}
              {webhooks.length === 0 && !showForm && (
                <p className="text-xs text-gray-600 italic">{c.noWebhooks}</p>
              )}
              {webhooks.length > 0 && (
                <div className="space-y-2">
                  {webhooks.map((w) => (
                    <div key={w.id} className="border border-gray-800 rounded-xl px-3 py-2.5 space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-gray-300 truncate">{w.name}</p>
                          <p className="text-[10px] text-gray-600 truncate">{w.url}</p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => toggleWebhook(w.id, w.active)}
                            disabled={togglingId === w.id}
                            title={c.toggle}
                            className="p-1 rounded text-gray-500 hover:text-gray-300 transition-colors"
                          >
                            {togglingId === w.id
                              ? <Loader2 className="w-4 h-4 animate-spin" />
                              : w.active
                                ? <ToggleRight className="w-4 h-4 text-green-500" />
                                : <ToggleLeft className="w-4 h-4 text-gray-600" />
                            }
                          </button>
                          <button
                            onClick={() => deleteWebhook(w.id)}
                            disabled={deletingId === w.id}
                            title={c.delete}
                            className="p-1 rounded text-gray-600 hover:text-red-400 transition-colors"
                          >
                            {deletingId === w.id
                              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              : <Trash2 className="w-3.5 h-3.5" />
                            }
                          </button>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 text-[10px] text-gray-600 flex-wrap">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {fmt(w.last_triggered_at)}
                        </span>
                        {w.last_status_code !== null && (
                          <span className={w.last_status_code >= 200 && w.last_status_code < 300 ? "text-green-600" : "text-red-500"}>
                            {c.status(w.last_status_code)}
                          </span>
                        )}
                        {/* Filter chips */}
                        {(w.filters?.regions ?? []).map((r) => (
                          <span key={r} className="px-1.5 py-0.5 rounded bg-gray-800 border border-gray-700">{rl[r] ?? r}</span>
                        ))}
                        {(w.filters?.risk_levels ?? []).map((r) => (
                          <span key={r} className={`px-1.5 py-0.5 rounded border ${
                            r === "high" ? "bg-red-900/20 border-red-700/30 text-red-400" :
                            r === "medium" ? "bg-amber-900/20 border-amber-700/30 text-amber-400" :
                            "bg-gray-800 border-gray-700"
                          }`}>{riskL[r] ?? r}</span>
                        ))}
                        {w.filters?.rt_threshold !== undefined && (
                          <span className="px-1.5 py-0.5 rounded bg-purple-900/20 border border-purple-700/30 text-purple-400">
                            {`Rt ≥ ${w.filters.rt_threshold}`}
                          </span>
                        )}
                        {(w.filters?.disease_thresholds ?? []).map((dt, i) => (
                          <span key={i} className="px-1.5 py-0.5 rounded bg-purple-900/20 border border-purple-700/30 text-purple-400">
                            {dt.disease_en} ≥{dt.min_cases}
                          </span>
                        ))}
                        {w.filters?.proximity && (
                          <span className="px-1.5 py-0.5 rounded bg-blue-900/20 border border-blue-700/30 text-blue-400">
                            📍 {w.filters.proximity.label || "proximity"} ≤{w.filters.proximity.radius_km}km
                          </span>
                        )}
                        {w.filters?.min_change_pct !== undefined && (
                          <span className="px-1.5 py-0.5 rounded bg-teal-900/20 border border-teal-700/30 text-teal-400">
                            Δ ≥{w.filters.min_change_pct}%
                          </span>
                        )}
                        {!w.active && (
                          <span className="px-1.5 py-0.5 rounded bg-gray-800 border border-gray-700 text-gray-500">
                            {locale === "fr" ? "Désactivé" : locale === "es" ? "Desactivado" : locale === "ar" ? "معطَّل" : locale === "id" ? "Nonaktif" : "Disabled"}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Add form */}
              {showForm ? (
                <div className="border border-gray-700 rounded-xl p-3 space-y-3">
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={c.namePlaceholder}
                    maxLength={64}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-gray-500 transition-colors"
                  />
                  <input
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder={c.urlPlaceholder}
                    type="url"
                    maxLength={2048}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-gray-500 transition-colors"
                  />

                  {/* Region filter */}
                  <div className="space-y-1">
                    <p className="text-[10px] text-gray-500 uppercase tracking-wide">{c.region}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {REGIONS.map((r) => (
                        <button
                          key={r}
                          type="button"
                          onClick={() => toggleRegion(r)}
                          className={`text-[10px] px-2 py-1 rounded-full border transition-colors ${
                            selRegions.includes(r)
                              ? "bg-blue-900/40 border-blue-700/50 text-blue-300"
                              : "border-gray-700 text-gray-500 hover:border-gray-500 hover:text-gray-300"
                          }`}
                        >
                          {rl[r]}
                        </button>
                      ))}
                      <span className="text-[10px] text-gray-600 self-center">
                        {selRegions.length === 0 ? c.allRegions : ""}
                      </span>
                    </div>
                  </div>

                  {/* Risk level filter */}
                  <div className="space-y-1">
                    <p className="text-[10px] text-gray-500 uppercase tracking-wide">{c.risk}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {(["high", "medium", "low"] as const).map((r) => (
                        <button
                          key={r}
                          type="button"
                          onClick={() => toggleRisk(r)}
                          className={`text-[10px] px-2 py-1 rounded-full border transition-colors ${
                            selRisks.includes(r)
                              ? r === "high"   ? "bg-red-900/40 border-red-700/50 text-red-300"
                              : r === "medium" ? "bg-amber-900/40 border-amber-700/50 text-amber-300"
                              :                  "bg-gray-700 border-gray-500 text-gray-300"
                              : "border-gray-700 text-gray-500 hover:border-gray-500 hover:text-gray-300"
                          }`}
                        >
                          {riskL[r]}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Rt threshold */}
                  <div className="space-y-1">
                    <p className="text-[10px] text-gray-500 uppercase tracking-wide">{c.rtThreshold}</p>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] text-gray-400">Rt ≥</span>
                      <input
                        type="number"
                        min="1"
                        max="10"
                        step="0.1"
                        value={rtThreshold}
                        onChange={(e) => setRtThreshold(e.target.value === "" ? "" : Number(e.target.value))}
                        placeholder="1.5"
                        className="w-20 bg-gray-800 border border-gray-700 rounded-lg px-2 py-1 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-gray-500 transition-colors"
                      />
                      <span className="text-[10px] text-gray-600">{c.rtNote}</span>
                    </div>
                  </div>

                  {/* IHR disease thresholds */}
                  <div className="space-y-1.5">
                    <p className="text-[10px] text-gray-500 uppercase tracking-wide">{c.diseaseThresholds}</p>
                    {disThresholds.map((dt, idx) => (
                      <div key={idx} className="flex items-center justify-between gap-2 px-2.5 py-1.5 bg-purple-900/20 border border-purple-700/30 rounded-lg">
                        <span className="text-[10px] text-purple-300 font-mono">{dt.disease_en} ≥ {dt.min_cases} cas</span>
                        <button type="button" onClick={() => removeDisThreshold(idx)} className="text-purple-700 hover:text-purple-400 text-sm leading-none">×</button>
                      </div>
                    ))}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <input
                        value={newDisEn}
                        onChange={(e) => setNewDisEn(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && addDisThreshold()}
                        placeholder={c.diseasePlaceholder}
                        maxLength={64}
                        className="flex-1 min-w-[80px] bg-gray-800 border border-gray-700 rounded-lg px-2 py-1 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-gray-500"
                      />
                      <input
                        type="number" min="1" max="1000000"
                        value={newMinCases}
                        onChange={(e) => setNewMinCases(e.target.value === "" ? "" : Number(e.target.value))}
                        placeholder="1"
                        className="w-16 bg-gray-800 border border-gray-700 rounded-lg px-2 py-1 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-gray-500"
                      />
                      <span className="text-[10px] text-gray-600">{c.minCasesLabel}</span>
                      <button
                        type="button"
                        onClick={addDisThreshold}
                        disabled={!newDisEn.trim()}
                        className="px-2 py-1 bg-purple-900/40 hover:bg-purple-900/60 disabled:opacity-40 border border-purple-700/40 text-purple-300 text-xs rounded-lg transition-colors"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  {/* Proximity alert */}
                  <div className="space-y-1.5">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={enableProximity}
                        onChange={(e) => setEnableProximity(e.target.checked)}
                        className="rounded border-gray-600"
                      />
                      <span className="text-[10px] text-gray-400 uppercase tracking-wide">{c.proximity}</span>
                    </label>
                    {enableProximity && (
                      <div className="grid grid-cols-2 gap-1.5">
                        <div className="space-y-0.5">
                          <p className="text-[9px] text-gray-600">{c.proxLat}</p>
                          <input
                            type="number" min="-90" max="90" step="0.0001"
                            value={proxLat}
                            onChange={(e) => setProxLat(e.target.value === "" ? "" : Number(e.target.value))}
                            placeholder="-1.68"
                            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-2 py-1 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-blue-500"
                          />
                        </div>
                        <div className="space-y-0.5">
                          <p className="text-[9px] text-gray-600">{c.proxLng}</p>
                          <input
                            type="number" min="-180" max="180" step="0.0001"
                            value={proxLng}
                            onChange={(e) => setProxLng(e.target.value === "" ? "" : Number(e.target.value))}
                            placeholder="29.23"
                            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-2 py-1 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-blue-500"
                          />
                        </div>
                        <div className="space-y-0.5">
                          <p className="text-[9px] text-gray-600">{c.proxRadius}</p>
                          <input
                            type="number" min="1" max="5000" step="1"
                            value={proxRadius}
                            onChange={(e) => setProxRadius(e.target.value === "" ? "" : Number(e.target.value))}
                            placeholder="500"
                            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-2 py-1 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-blue-500"
                          />
                        </div>
                        <div className="space-y-0.5">
                          <p className="text-[9px] text-gray-600">{c.proxLabelInput}</p>
                          <input
                            type="text" maxLength={64}
                            value={proxLabel}
                            onChange={(e) => setProxLabel(e.target.value)}
                            placeholder="Goma"
                            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-2 py-1 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-blue-500"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Alert fatigue threshold */}
                  <div className="space-y-1">
                    <p className="text-[10px] text-gray-500 uppercase tracking-wide">{c.minChangePct}</p>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] text-gray-400">Δ ≥</span>
                      <input
                        type="number"
                        min="1"
                        max="1000"
                        step="1"
                        value={minChangePct}
                        onChange={(e) => setMinChangePct(e.target.value === "" ? "" : Number(e.target.value))}
                        placeholder="25"
                        className="w-20 bg-gray-800 border border-gray-700 rounded-lg px-2 py-1 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-gray-500 transition-colors"
                      />
                      <span className="text-[10px] text-gray-500">%</span>
                      <span className="text-[10px] text-gray-600">{c.minChangePctNote}</span>
                    </div>
                  </div>

                  {formError && (
                    <div className="flex items-center gap-1.5 text-xs text-red-400">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      {formError}
                    </div>
                  )}

                  <div className="flex items-center gap-2 justify-end">
                    <button
                      onClick={() => { setShowForm(false); setFormError(""); }}
                      className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
                    >
                      {c.cancel}
                    </button>
                    <button
                      onClick={createWebhook}
                      disabled={!url.trim() || creating}
                      className="px-3 py-1.5 bg-red-600 hover:bg-red-500 disabled:opacity-40 text-white text-xs font-semibold rounded-lg transition-colors"
                    >
                      {creating ? c.creating : c.create}
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => { setShowForm(true); setNewSecret(null); }}
                  className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-200 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  {c.add}
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
