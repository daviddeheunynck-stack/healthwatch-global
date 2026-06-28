"use client";

import { useState } from "react";
import { Eye, EyeOff, Pencil, Trash2, Plus, X, Check, ChevronUp, ChevronDown, ArrowUpDown } from "lucide-react";
import RiskBadge from "@/components/RiskBadge";
import type { Outbreak } from "@/lib/outbreaks";

type SortKey = "disease_en" | "country_en" | "region" | "cases" | "deaths" | "risk_level" | "date" | "active";
type SortDir = "asc" | "desc";
const RISK_ORDER: Record<string, number> = { high: 3, medium: 2, low: 1 };

const REGIONS = ["africa", "asia", "europe", "americas", "oceania"];
const RISKS = ["high", "medium", "low"] as const;

const EMPTY: Partial<Outbreak> = {
  disease: "", disease_en: "", disease_ar: "",
  country: "", country_en: "", country_ar: "",
  region: "africa", lat: 0, lng: 0, cases: 0, deaths: 0,
  risk_level: "medium", date: new Date().toISOString().split("T")[0],
  source: "", description: "", active: true,
};

export default function AdminOutbreakTable({ initial }: { initial: Outbreak[] }) {
  const [outbreaks, setOutbreaks] = useState<Outbreak[]>(initial);
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<Outbreak>>(EMPTY);
  const [adding, setAdding] = useState(false);
  const [loading, setLoading] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("cases");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  function handleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("desc"); }
  }

  const sortedOutbreaks = [...outbreaks].sort((a, b) => {
    let v = 0;
    switch (sortKey) {
      case "disease_en": v = (a.disease_en || a.disease || "").localeCompare(b.disease_en || b.disease || ""); break;
      case "country_en": v = (a.country_en || a.country || "").localeCompare(b.country_en || b.country || ""); break;
      case "region":     v = (a.region || "").localeCompare(b.region || ""); break;
      case "cases":      v = a.cases - b.cases; break;
      case "deaths":     v = a.deaths - b.deaths; break;
      case "risk_level": v = (RISK_ORDER[a.risk_level ?? ""] ?? 0) - (RISK_ORDER[b.risk_level ?? ""] ?? 0); break;
      case "date":       v = a.date.localeCompare(b.date); break;
      case "active":     v = (a.active ? 1 : 0) - (b.active ? 1 : 0); break;
    }
    return sortDir === "asc" ? v : -v;
  });

  function ColHeader({ col, label, align = "left" }: { col: SortKey; label: string; align?: "left" | "right" | "center" }) {
    const active = sortKey === col;
    const Icon = active ? (sortDir === "asc" ? ChevronUp : ChevronDown) : ArrowUpDown;
    return (
      <th
        onClick={() => handleSort(col)}
        className={`px-4 py-3 text-${align} cursor-pointer select-none hover:text-white group whitespace-nowrap`}
      >
        <span className={`inline-flex items-center gap-1 ${align === "right" ? "flex-row-reverse" : ""}`}>
          {label}
          <Icon className={`w-3 h-3 shrink-0 ${active ? "text-white" : "opacity-30 group-hover:opacity-60"}`} />
        </span>
      </th>
    );
  }

  const toggleActive = async (o: Outbreak) => {
    setLoading(o.id);
    const res = await fetch(`/api/admin/outbreaks/${o.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !o.active }),
    });
    if (res.ok) {
      setOutbreaks((prev) => prev.map((x) => x.id === o.id ? { ...x, active: !o.active } : x));
    }
    setLoading(null);
  };

  const deleteOutbreak = async (id: string) => {
    if (!confirm("Désactiver cette épidémie ?")) return;
    setLoading(id);
    const res = await fetch(`/api/admin/outbreaks/${id}`, { method: "DELETE" });
    // Soft-delete: keep the row, just flip active to false
    if (res.ok) setOutbreaks((prev) => prev.map((x) => x.id === id ? { ...x, active: false } : x));
    setLoading(null);
  };

  const startEdit = (o: Outbreak) => { setEditing(o.id); setForm(o); setAdding(false); setFormError(null); };
  const cancelEdit = () => { setEditing(null); setForm(EMPTY); setFormError(null); };

  const saveEdit = async () => {
    if (!editing) return;
    setLoading(editing);
    setFormError(null);
    const res = await fetch(`/api/admin/outbreaks/${editing}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (res.ok) {
      const updated = await res.json();
      setOutbreaks((prev) => prev.map((x) => x.id === editing ? updated : x));
      cancelEdit();
    } else {
      const data = await res.json().catch(() => ({}));
      setFormError(data.error ?? `Erreur ${res.status}`);
    }
    setLoading(null);
  };

  const saveNew = async () => {
    setLoading("new");
    setFormError(null);
    const res = await fetch("/api/admin/outbreaks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (res.ok) {
      const created = await res.json();
      setOutbreaks((prev) => [created, ...prev]);
      setAdding(false);
      setForm(EMPTY);
    } else {
      const data = await res.json().catch(() => ({}));
      setFormError(data.error ?? `Erreur ${res.status}`);
    }
    setLoading(null);
  };

  const field = (key: keyof Outbreak, label: string, type = "text") => (
    <div className="flex flex-col gap-1">
      <label className="text-xs text-gray-500">{label}</label>
      <input
        type={type}
        value={(form[key] as string | number) ?? ""}
        onChange={(e) => setForm((f) => ({ ...f, [key]: type === "number" ? Number(e.target.value) : e.target.value }))}
        className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-white text-sm focus:outline-none focus:border-red-500"
      />
    </div>
  );

  const OutbreakForm = () => (
    <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 space-y-3">
      <div className="grid grid-cols-3 gap-3">
        {field("disease",    "Maladie (FR)")}
        {field("disease_en", "Maladie (EN)")}
        {field("disease_ar", "Maladie (AR)")}
      </div>
      <div className="grid grid-cols-3 gap-3">
        {field("country",    "Pays (FR)")}
        {field("country_en", "Pays (EN)")}
        {field("country_ar", "Pays (AR)")}
      </div>
      <div className="grid grid-cols-3 gap-3">
        {field("cases", "Cas", "number")}
        {field("deaths", "Décès", "number")}
        {field("date", "Date", "date")}
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-500">Région</label>
          <select value={form.region} onChange={(e) => setForm((f) => ({ ...f, region: e.target.value }))}
            className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-white text-sm focus:outline-none">
            {REGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-500">Risque</label>
          <select value={form.risk_level} onChange={(e) => setForm((f) => ({ ...f, risk_level: e.target.value as typeof RISKS[number] }))}
            className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-white text-sm focus:outline-none">
            {RISKS.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-500">Actif</label>
          <select value={form.active ? "true" : "false"} onChange={(e) => setForm((f) => ({ ...f, active: e.target.value === "true" }))}
            className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-white text-sm focus:outline-none">
            <option value="true">Oui</option>
            <option value="false">Non</option>
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {field("lat", "Latitude", "number")}
        {field("lng", "Longitude", "number")}
      </div>
      {field("source", "Source (URL)")}
      <div className="flex flex-col gap-1">
        <label className="text-xs text-gray-500">Description</label>
        <textarea value={form.description ?? ""} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          rows={2}
          className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-white text-sm focus:outline-none focus:border-red-500 resize-none" />
      </div>
      {formError && (
        <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
          ⚠ {formError}
        </p>
      )}
      <div className="flex gap-2 pt-1">
        <button onClick={editing ? saveEdit : saveNew} disabled={!!loading}
          className="flex items-center gap-1.5 bg-green-600 hover:bg-green-500 disabled:opacity-60 text-white text-sm font-semibold px-3 py-1.5 rounded-lg transition-colors">
          <Check className="w-3.5 h-3.5" /> Enregistrer
        </button>
        <button onClick={cancelEdit}
          className="flex items-center gap-1.5 bg-gray-700 hover:bg-gray-600 text-white text-sm px-3 py-1.5 rounded-lg transition-colors">
          <X className="w-3.5 h-3.5" /> Annuler
        </button>
      </div>
    </div>
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-400">{outbreaks.length} épidémies</span>
        <button onClick={() => { setAdding(true); setEditing(null); setForm(EMPTY); }}
          className="flex items-center gap-1.5 bg-red-600 hover:bg-red-500 text-white text-sm font-semibold px-3 py-1.5 rounded-lg transition-colors">
          <Plus className="w-4 h-4" /> Ajouter
        </button>
      </div>

      {adding && <OutbreakForm />}

      <div className="rounded-xl border border-gray-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-900 text-gray-400 text-xs uppercase tracking-wide">
                <ColHeader col="disease_en" label="Maladie" />
                <ColHeader col="country_en" label="Pays" />
                <ColHeader col="region"     label="Région" />
                <ColHeader col="cases"      label="Cas"    align="right" />
                <ColHeader col="deaths"     label="Décès"  align="right" />
                <ColHeader col="risk_level" label="Risque" />
                <ColHeader col="date"       label="Date" />
                <ColHeader col="active"     label="Statut" align="center" />
                <th className="px-4 py-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {sortedOutbreaks.map((o) => (
                <>
                  <tr key={o.id} className={`hover:bg-gray-800/50 transition-colors ${!o.active ? "opacity-50" : ""}`}>
                    <td className="px-4 py-3 text-white font-medium">{o.disease_en || o.disease}</td>
                    <td className="px-4 py-3 text-gray-300">{o.country_en || o.country}</td>
                    <td className="px-4 py-3 text-gray-400 capitalize">{o.region}</td>
                    <td className="px-4 py-3 text-right text-gray-300">{o.cases.toLocaleString("en")}</td>
                    <td className="px-4 py-3 text-right text-gray-400">{o.deaths.toLocaleString("en")}</td>
                    <td className="px-4 py-3"><RiskBadge level={o.risk_level as "high" | "medium" | "low"} /></td>
                    <td className="px-4 py-3 text-gray-400">{o.date}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${o.active ? "bg-green-500/10 text-green-400" : "bg-gray-700 text-gray-500"}`}>
                        {o.active ? "Actif" : "Inactif"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={() => toggleActive(o)} disabled={loading === o.id} title={o.active ? "Désactiver" : "Activer"}
                          className="p-1.5 hover:bg-gray-700 rounded transition-colors text-gray-400 hover:text-white disabled:opacity-50">
                          {o.active ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                        {/* PHEIC toggle */}
                        <button
                          onClick={async () => {
                            await fetch(`/api/admin/outbreaks/${o.id}`, {
                              method: "PATCH",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ is_pheic: !o.is_pheic }),
                            });
                            setOutbreaks((prev) => prev.map((x) => x.id === o.id ? { ...x, is_pheic: !x.is_pheic } : x));
                          }}
                          title={o.is_pheic ? "Retirer PHEIC" : "Déclarer PHEIC"}
                          className={`p-1.5 rounded transition-colors text-xs font-bold ${o.is_pheic ? "text-purple-400 hover:text-purple-300 hover:bg-purple-900/30" : "text-gray-600 hover:text-purple-400 hover:bg-gray-700"}`}
                        >
                          🚨
                        </button>
                        <button onClick={() => startEdit(o)} title="Modifier"
                          className="p-1.5 hover:bg-gray-700 rounded transition-colors text-gray-400 hover:text-blue-400">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => deleteOutbreak(o.id)} disabled={loading === o.id} title="Supprimer"
                          className="p-1.5 hover:bg-gray-700 rounded transition-colors text-gray-400 hover:text-red-400 disabled:opacity-50">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                  {editing === o.id && (
                    <tr key={`${o.id}-edit`}>
                      <td colSpan={9} className="px-4 py-3 bg-gray-900">
                        <OutbreakForm />
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
