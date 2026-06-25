"use client";

import { useState, useEffect } from "react";
import { MapPin, Plus, Trash2, Loader2, ChevronDown, ChevronUp, Clock } from "lucide-react";

interface GeofenceAlert {
  id: string;
  label: string;
  lat: number;
  lng: number;
  radius_km: number;
  email: string;
  last_fired_at: string | null;
  created_at: string;
}

const COPY: Record<string, {
  title: string; subtitle: string; add: string; cancel: string; create: string; creating: string;
  noAlerts: string; delete: string; lastFired: string; neverFired: string; planError: string;
  labelPlaceholder: string; latLabel: string; lngLabel: string; radiusLabel: string; emailLabel: string;
  emailPlaceholder: string;
}> = {
  fr: {
    title: "Alertes géofence",
    subtitle: "Recevez un email quand un foyer actif apparaît dans le rayon de vos zones d'opération.",
    add: "Ajouter une zone", cancel: "Annuler", create: "Créer", creating: "Création…",
    noAlerts: "Aucune zone configurée",
    delete: "Supprimer", lastFired: "Dernier envoi", neverFired: "Jamais déclenché",
    planError: "Alertes géofence disponibles sur les plans Pro, Équipe et Enterprise.",
    labelPlaceholder: "ex: Zone DRC opérations", latLabel: "Latitude", lngLabel: "Longitude",
    radiusLabel: "Rayon (km)", emailLabel: "Email d'alerte", emailPlaceholder: "vous@organisation.org",
  },
  en: {
    title: "Geofence alerts",
    subtitle: "Get an email when an active outbreak appears within your operational zone radius.",
    add: "Add a zone", cancel: "Cancel", create: "Create", creating: "Creating…",
    noAlerts: "No zones configured",
    delete: "Delete", lastFired: "Last delivery", neverFired: "Never triggered",
    planError: "Geofence alerts are available on Pro, Team, and Enterprise plans.",
    labelPlaceholder: "e.g. DRC operations zone", latLabel: "Latitude", lngLabel: "Longitude",
    radiusLabel: "Radius (km)", emailLabel: "Alert email", emailPlaceholder: "you@organisation.org",
  },
  es: {
    title: "Alertas de geovalla",
    subtitle: "Reciba un email cuando aparezca un brote activo dentro del radio de su zona operacional.",
    add: "Añadir zona", cancel: "Cancelar", create: "Crear", creating: "Creando…",
    noAlerts: "Sin zonas configuradas",
    delete: "Eliminar", lastFired: "Último envío", neverFired: "Nunca activado",
    planError: "Las alertas de geovalla están disponibles en los planes Pro, Team y Enterprise.",
    labelPlaceholder: "ej: Zona operacional RDC", latLabel: "Latitud", lngLabel: "Longitud",
    radiusLabel: "Radio (km)", emailLabel: "Email de alerta", emailPlaceholder: "usted@organizacion.org",
  },
  ar: {
    title: "تنبيهات السياج الجغرافي",
    subtitle: "احصل على بريد إلكتروني عند ظهور تفشٍّ نشط ضمن نطاق منطقة عملياتك.",
    add: "إضافة منطقة", cancel: "إلغاء", create: "إنشاء", creating: "جارٍ الإنشاء…",
    noAlerts: "لا توجد مناطق مُهيَّأة",
    delete: "حذف", lastFired: "آخر تسليم", neverFired: "لم يُطلَق قط",
    planError: "تنبيهات السياج الجغرافي متاحة في خطط Pro وTeam وEnterprise.",
    labelPlaceholder: "مثال: منطقة عمليات الكونغو", latLabel: "خط العرض", lngLabel: "خط الطول",
    radiusLabel: "النطاق (كم)", emailLabel: "البريد الإلكتروني للتنبيه", emailPlaceholder: "you@org.org",
  },
  id: {
    title: "Peringatan geofence",
    subtitle: "Terima email saat wabah aktif muncul dalam radius zona operasional Anda.",
    add: "Tambah zona", cancel: "Batal", create: "Buat", creating: "Membuat…",
    noAlerts: "Tidak ada zona yang dikonfigurasi",
    delete: "Hapus", lastFired: "Pengiriman terakhir", neverFired: "Belum pernah dipicu",
    planError: "Peringatan geofence tersedia di paket Pro, Team, dan Enterprise.",
    labelPlaceholder: "mis. Zona operasi DRC", latLabel: "Lintang", lngLabel: "Bujur",
    radiusLabel: "Radius (km)", emailLabel: "Email peringatan", emailPlaceholder: "anda@organisasi.org",
  },
};

interface Props { locale: string; userEmail?: string }

export default function GeofenceAlertPanel({ locale, userEmail }: Props) {
  const c = COPY[locale] ?? COPY.en;

  const [open,      setOpen]      = useState(false);
  const [alerts,    setAlerts]    = useState<GeofenceAlert[]>([]);
  const [loading,   setLoading]   = useState(false);
  const [planError, setPlanError] = useState(false);
  const [showForm,  setShowForm]  = useState(false);

  const [label,    setLabel]    = useState("");
  const [lat,      setLat]      = useState<number | "">("");
  const [lng,      setLng]      = useState<number | "">("");
  const [radiusKm, setRadiusKm] = useState<number | "">(500);
  const [email,    setEmail]    = useState(userEmail ?? "");
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setPlanError(false);
    fetch("/api/geofence-alerts")
      .then(async (r) => {
        if (r.status === 403) { setPlanError(true); return; }
        const d = await r.json();
        if (d.alerts) setAlerts(d.alerts);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [open]);

  async function createAlert() {
    if (creating) return;
    if (lat === "" || lng === "" || !email.trim()) { setFormError("All fields required"); return; }
    setCreating(true); setFormError("");
    try {
      const res = await fetch("/api/geofence-alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: label.trim() || "Zone", lat: Number(lat), lng: Number(lng), radius_km: Number(radiusKm) || 500, email: email.trim() }),
      });
      const d = await res.json();
      if (d.error) { setFormError(d.error); return; }
      if (d.alert) {
        setAlerts((prev) => [d.alert, ...prev]);
        setLabel(""); setLat(""); setLng(""); setRadiusKm(500); setEmail("");
        setShowForm(false);
      }
    } catch { setFormError("Network error"); } finally { setCreating(false); }
  }

  async function deleteAlert(id: string) {
    setDeletingId(id);
    try {
      await fetch(`/api/geofence-alerts?id=${id}`, { method: "DELETE" });
      setAlerts((prev) => prev.filter((a) => a.id !== id));
    } catch { /* ignore */ } finally { setDeletingId(null); }
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
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-800/30 transition-colors rounded-xl"
      >
        <div className="flex items-center gap-2">
          <MapPin className="w-4 h-4 text-gray-500 shrink-0" />
          <span className="text-sm font-semibold text-gray-300">{c.title}</span>
          {!open && alerts.length > 0 && (
            <span className="text-xs text-gray-600">({alerts.length})</span>
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
              {alerts.length === 0 && !showForm && (
                <p className="text-xs text-gray-600 italic">{c.noAlerts}</p>
              )}
              {alerts.length > 0 && (
                <div className="space-y-2">
                  {alerts.map((a) => (
                    <div key={a.id} className="border border-gray-800 rounded-xl px-3 py-2.5 space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-gray-300 truncate">{a.label}</p>
                          <p className="text-[10px] text-gray-600 font-mono">{a.lat.toFixed(4)}, {a.lng.toFixed(4)} · {a.radius_km} km</p>
                        </div>
                        <button
                          onClick={() => deleteAlert(a.id)}
                          disabled={deletingId === a.id}
                          title={c.delete}
                          className="p-1 rounded text-gray-600 hover:text-red-400 transition-colors shrink-0"
                        >
                          {deletingId === a.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                      <div className="flex items-center gap-3 text-[10px] text-gray-600 flex-wrap">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {fmt(a.last_fired_at)}
                        </span>
                        <span className="px-1.5 py-0.5 rounded bg-blue-900/20 border border-blue-700/30 text-blue-400">
                          📍 ≤ {a.radius_km} km
                        </span>
                        <span className="text-gray-700 truncate">{a.email}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {showForm ? (
                <div className="border border-gray-700 rounded-xl p-3 space-y-3">
                  <input
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                    placeholder={c.labelPlaceholder}
                    maxLength={64}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-gray-500 transition-colors"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-0.5">
                      <p className="text-[9px] text-gray-600 uppercase tracking-wide">{c.latLabel}</p>
                      <input
                        type="number" min="-90" max="90" step="0.0001"
                        value={lat}
                        onChange={(e) => setLat(e.target.value === "" ? "" : Number(e.target.value))}
                        placeholder="-4.32"
                        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-gray-500"
                      />
                    </div>
                    <div className="space-y-0.5">
                      <p className="text-[9px] text-gray-600 uppercase tracking-wide">{c.lngLabel}</p>
                      <input
                        type="number" min="-180" max="180" step="0.0001"
                        value={lng}
                        onChange={(e) => setLng(e.target.value === "" ? "" : Number(e.target.value))}
                        placeholder="15.32"
                        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-gray-500"
                      />
                    </div>
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-[9px] text-gray-600 uppercase tracking-wide">{c.radiusLabel}</p>
                    <input
                      type="number" min="1" max="5000" step="50"
                      value={radiusKm}
                      onChange={(e) => setRadiusKm(e.target.value === "" ? "" : Number(e.target.value))}
                      placeholder="500"
                      className="w-32 bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-gray-500"
                    />
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-[9px] text-gray-600 uppercase tracking-wide">{c.emailLabel}</p>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder={c.emailPlaceholder}
                      maxLength={254}
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-gray-500 transition-colors"
                    />
                  </div>

                  {formError && (
                    <p className="text-xs text-red-400">{formError}</p>
                  )}

                  <div className="flex items-center gap-2 justify-end">
                    <button
                      onClick={() => { setShowForm(false); setFormError(""); }}
                      className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
                    >
                      {c.cancel}
                    </button>
                    <button
                      onClick={createAlert}
                      disabled={lat === "" || lng === "" || !email.trim() || creating}
                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-xs font-semibold rounded-lg transition-colors"
                    >
                      {creating ? c.creating : c.create}
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => { setShowForm(true); }}
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
