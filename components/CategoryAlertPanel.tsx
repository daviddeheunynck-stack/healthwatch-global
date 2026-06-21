"use client";

import { useState, useEffect } from "react";
import { Bell, Plus, Trash2, Loader2 } from "lucide-react";
import { DISEASE_CATEGORIES, CATEGORY_LABELS, type DiseaseCategory } from "@/lib/disease-category";

interface Alert {
  id: string; disease_category: string; region: string;
  min_cases: number; email: string; last_fired_at: string | null; created_at: string;
}

const REGIONS = ["all", "africa", "asia", "europe", "americas", "oceania"] as const;

const COPY: Record<string, {
  title: string; category: string; region: string; minCases: string; email: string;
  add: string; adding: string; remove: string; noAlerts: string; lastFired: string; never: string; allRegions: string;
}> = {
  fr: { title: "Alertes par catégorie", category: "Catégorie", region: "Région", minCases: "Seuil (cas)", email: "Email", add: "Ajouter", adding: "Ajout…", remove: "Supprimer", noAlerts: "Aucune alerte configurée", lastFired: "Dernier envoi", never: "Jamais", allRegions: "Toutes régions" },
  en: { title: "Category alerts", category: "Category", region: "Region", minCases: "Threshold (cases)", email: "Email", add: "Add", adding: "Adding…", remove: "Remove", noAlerts: "No alerts configured", lastFired: "Last fired", never: "Never", allRegions: "All regions" },
  es: { title: "Alertas por categoría", category: "Categoría", region: "Región", minCases: "Umbral (casos)", email: "Email", add: "Agregar", adding: "Agregando…", remove: "Eliminar", noAlerts: "Sin alertas configuradas", lastFired: "Último envío", never: "Nunca", allRegions: "Todas las regiones" },
  ar: { title: "تنبيهات الفئة", category: "الفئة", region: "المنطقة", minCases: "العتبة (الحالات)", email: "البريد الإلكتروني", add: "إضافة", adding: "جارٍ…", remove: "حذف", noAlerts: "لا تنبيهات", lastFired: "آخر إرسال", never: "أبدًا", allRegions: "كل المناطق" },
  id: { title: "Peringatan kategori", category: "Kategori", region: "Wilayah", minCases: "Ambang batas (kasus)", email: "Email", add: "Tambah", adding: "Menambahkan…", remove: "Hapus", noAlerts: "Tidak ada peringatan", lastFired: "Terakhir dikirim", never: "Tidak pernah", allRegions: "Semua wilayah" },
};

export default function CategoryAlertPanel({ locale, userEmail }: { locale: string; userEmail?: string }) {
  const c = COPY[locale] ?? COPY.en;
  const [alerts,   setAlerts]   = useState<Alert[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [adding,   setAdding]   = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);
  const [category, setCategory] = useState<DiseaseCategory>("respiratory");
  const [region,   setRegion]   = useState("all");
  const [minCases, setMinCases] = useState<number | "">("");
  const [email,    setEmail]    = useState(userEmail ?? "");

  useEffect(() => {
    fetch("/api/category-alerts")
      .then((r) => r.json())
      .then((d) => setAlerts(d.alerts ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function add() {
    if (!minCases || !email) return;
    setAdding(true);
    try {
      const res  = await fetch("/api/category-alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ disease_category: category, region, min_cases: Number(minCases), email }),
      });
      const data = await res.json();
      if (data.alert) setAlerts((prev) => [data.alert, ...prev]);
    } catch { /* ignore */ } finally { setAdding(false); }
  }

  async function remove(id: string) {
    setRemoving(id);
    try {
      await fetch(`/api/category-alerts?id=${id}`, { method: "DELETE" });
      setAlerts((prev) => prev.filter((a) => a.id !== id));
    } catch { /* ignore */ } finally { setRemoving(null); }
  }

  return (
    <div className="rounded-xl border border-gray-700/50 bg-gray-900/60 p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Bell className="w-4 h-4 text-gray-500" />
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{c.title}</p>
      </div>

      {/* Add form */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <select value={category} onChange={(e) => setCategory(e.target.value as DiseaseCategory)}
          className="bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500">
          {DISEASE_CATEGORIES.map((cat) => (
            <option key={cat} value={cat}>{CATEGORY_LABELS[cat][locale] ?? CATEGORY_LABELS[cat].en}</option>
          ))}
        </select>
        <select value={region} onChange={(e) => setRegion(e.target.value)}
          className="bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500">
          {REGIONS.map((r) => (
            <option key={r} value={r}>{r === "all" ? c.allRegions : r.charAt(0).toUpperCase() + r.slice(1)}</option>
          ))}
        </select>
        <input type="number" min="1" value={minCases} onChange={(e) => setMinCases(e.target.value === "" ? "" : Number(e.target.value))}
          placeholder={c.minCases}
          className="bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-blue-500" />
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
          placeholder={c.email}
          className="bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-blue-500" />
      </div>
      <button onClick={add} disabled={adding || !minCases || !email}
        className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-blue-700/50 hover:bg-blue-700/70 disabled:opacity-40 border border-blue-700/40 text-blue-300 rounded-lg transition-colors">
        {adding ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
        {adding ? c.adding : c.add}
      </button>

      {/* Alert list */}
      {loading ? (
        <div className="h-4 w-24 bg-gray-800 rounded animate-pulse" />
      ) : alerts.length === 0 ? (
        <p className="text-xs text-gray-600 italic">{c.noAlerts}</p>
      ) : (
        <div className="space-y-2">
          {alerts.map((a) => (
            <div key={a.id} className="flex items-center justify-between gap-2 p-2.5 rounded-lg border border-gray-700/40 bg-gray-800/30">
              <div className="text-xs space-y-0.5 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="font-medium text-gray-200">
                    {CATEGORY_LABELS[a.disease_category as DiseaseCategory]?.[locale] ?? a.disease_category}
                  </span>
                  {a.region !== "all" && <span className="text-gray-500">· {a.region}</span>}
                  <span className="text-red-400 font-semibold">≥ {a.min_cases.toLocaleString("en")}</span>
                </div>
                <p className="text-[10px] text-gray-600">{a.email} · {c.lastFired}: {a.last_fired_at ? new Date(a.last_fired_at).toLocaleDateString() : c.never}</p>
              </div>
              <button onClick={() => remove(a.id)} disabled={!!removing}
                className="p-1.5 text-gray-600 hover:text-red-400 transition-colors shrink-0">
                {removing === a.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
