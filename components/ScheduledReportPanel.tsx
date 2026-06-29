"use client";

import { useState, useEffect } from "react";
import { Mail, Plus, Trash2, ChevronDown, ChevronUp, Loader2, AlertCircle, Check, ToggleLeft, ToggleRight } from "lucide-react";

interface ReportConfig {
  id: string;
  recipients: string[];
  locale: string;
  active: boolean;
  last_sent_at: string | null;
}

const COPY: Record<string, {
  title: string; subtitle: string; planError: string;
  addEmail: string; emailPlaceholder: string; save: string; saving: string;
  delete: string; noConfig: string; setup: string; cancel: string;
  lastSent: string; neverSent: string; toggle: string;
  limitNote: (n: number) => string; saved: string;
  invalidEmail: string; networkError: string;
}> = {
  fr: {
    title: "Sitrep automatique", subtitle: "Rapport épidémiologique hebdomadaire par email (chaque lundi).",
    planError: "Disponible sur les plans Pro, Équipe et Enterprise.",
    addEmail: "Ajouter", emailPlaceholder: "email@organisation.org",
    save: "Sauvegarder", saving: "Sauvegarde…",
    delete: "Supprimer la configuration", noConfig: "Aucun rapport configuré.",
    setup: "Configurer", cancel: "Annuler",
    lastSent: "Dernier envoi", neverSent: "Jamais envoyé",
    toggle: "Activer/désactiver",
    limitNote: (n) => n === 1 ? "Plan Pro — 1 destinataire max" : `Plan Team/Enterprise — jusqu'à ${n} destinataires`,
    saved: "Sauvegardé !", invalidEmail: "Email invalide", networkError: "Erreur réseau",
  },
  en: {
    title: "Automated sitrep", subtitle: "Weekly epidemic situation report by email (every Monday).",
    planError: "Available on Pro, Team, and Enterprise plans.",
    addEmail: "Add", emailPlaceholder: "email@organisation.org",
    save: "Save", saving: "Saving…",
    delete: "Delete configuration", noConfig: "No report configured.",
    setup: "Set up", cancel: "Cancel",
    lastSent: "Last sent", neverSent: "Never sent",
    toggle: "Enable/disable",
    limitNote: (n) => n === 1 ? "Pro plan — 1 recipient max" : `Team/Enterprise — up to ${n} recipients`,
    saved: "Saved!", invalidEmail: "Invalid email", networkError: "Network error",
  },
  es: {
    title: "Sitrep automático", subtitle: "Informe epidemiológico semanal por email (cada lunes).",
    planError: "Disponible en los planes Pro, Team y Enterprise.",
    addEmail: "Agregar", emailPlaceholder: "email@organización.org",
    save: "Guardar", saving: "Guardando…",
    delete: "Eliminar configuración", noConfig: "Sin informe configurado.",
    setup: "Configurar", cancel: "Cancelar",
    lastSent: "Último envío", neverSent: "Nunca enviado",
    toggle: "Activar/desactivar",
    limitNote: (n) => n === 1 ? "Plan Pro — 1 destinatario máx" : `Team/Enterprise — hasta ${n} destinatarios`,
    saved: "¡Guardado!", invalidEmail: "Email inválido", networkError: "Error de red",
  },
  ar: {
    title: "التقرير التلقائي", subtitle: "تقرير الوضع الوبائي الأسبوعي عبر البريد الإلكتروني (كل يوم الاثنين).",
    planError: "متاح في خطط Pro وTeam وEnterprise.",
    addEmail: "إضافة", emailPlaceholder: "email@organisation.org",
    save: "حفظ", saving: "جارٍ الحفظ…",
    delete: "حذف الإعداد", noConfig: "لا يوجد تقرير مُهيَّأ.",
    setup: "إعداد", cancel: "إلغاء",
    lastSent: "آخر إرسال", neverSent: "لم يُرسَل قط",
    toggle: "تفعيل/تعطيل",
    limitNote: (n) => n === 1 ? "خطة Pro — مستلم واحد" : `Team/Enterprise — حتى ${n} مستلمين`,
    saved: "تم الحفظ!", invalidEmail: "البريد الإلكتروني غير صالح", networkError: "خطأ في الشبكة",
  },
  id: {
    title: "Sitrep otomatis", subtitle: "Laporan situasi epidemi mingguan via email (setiap Senin).",
    planError: "Tersedia di paket Pro, Team, dan Enterprise.",
    addEmail: "Tambah", emailPlaceholder: "email@organisasi.org",
    save: "Simpan", saving: "Menyimpan…",
    delete: "Hapus konfigurasi", noConfig: "Tidak ada laporan yang dikonfigurasi.",
    setup: "Atur", cancel: "Batal",
    lastSent: "Terakhir dikirim", neverSent: "Belum pernah dikirim",
    toggle: "Aktifkan/nonaktifkan",
    limitNote: (n) => n === 1 ? "Paket Pro — 1 penerima maks" : `Team/Enterprise — hingga ${n} penerima`,
    saved: "Tersimpan!", invalidEmail: "Email tidak valid", networkError: "Kesalahan jaringan",
  },
};

const VALID_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface Props { locale: string }

export default function ScheduledReportPanel({ locale }: Props) {
  const c = COPY[locale] ?? COPY.en;

  const [open,         setOpen]         = useState(false);
  const [report,       setReport]       = useState<ReportConfig | null>(null);
  const [_plan,        setPlan]         = useState("pro");
  const [maxR,         setMaxR]         = useState(1);
  const [loading,      setLoading]      = useState(false);
  const [planError,    setPlanError]    = useState(false);
  const [saving,       setSaving]       = useState(false);
  const [saved,        setSaved]        = useState(false);
  const [error,        setError]        = useState("");
  const [showForm,     setShowForm]     = useState(false);
  const [emailInput,   setEmailInput]   = useState("");
  const [recipients,   setRecipients]   = useState<string[]>([]);
  const [togglingActive, setTogglingActive] = useState(false);
  const [deletingConf, setDeletingConf] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setPlanError(false);
    fetch("/api/scheduled-reports")
      .then(async (r) => {
        if (r.status === 403) { setPlanError(true); return; }
        const d = await r.json();
        if (d.report) { setReport(d.report); setRecipients(d.report.recipients ?? []); }
        if (d.plan) setPlan(d.plan);
        if (d.maxRecipients) setMaxR(d.maxRecipients);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [open]);

  function addEmail() {
    const email = emailInput.trim().toLowerCase();
    if (!VALID_EMAIL.test(email)) { setError(c.invalidEmail); return; }
    if (recipients.includes(email)) { setEmailInput(""); return; }
    if (recipients.length >= maxR) { setError(c.limitNote(maxR)); return; }
    setRecipients((prev) => [...prev, email]);
    setEmailInput("");
    setError("");
  }

  function removeRecipient(email: string) {
    setRecipients((prev) => prev.filter((e) => e !== email));
  }

  async function saveConfig() {
    setSaving(true); setError(""); setSaved(false);
    try {
      const res = await fetch("/api/scheduled-reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipients, locale, active: report?.active ?? true }),
      });
      const d = await res.json();
      if (d.error) { setError(d.error); return; }
      if (d.report) { setReport(d.report); setRecipients(d.report.recipients); }
      setSaved(true);
      setShowForm(false);
      setTimeout(() => setSaved(false), 3000);
    } catch { setError(c.networkError); } finally { setSaving(false); }
  }

  async function toggleActive() {
    if (!report) return;
    setTogglingActive(true);
    try {
      const res = await fetch("/api/scheduled-reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipients: report.recipients, locale: report.locale, active: !report.active }),
      });
      const d = await res.json();
      if (d.report) setReport(d.report);
    } catch { /* ignore */ } finally { setTogglingActive(false); }
  }

  async function deleteConfig() {
    setDeletingConf(true);
    try {
      await fetch("/api/scheduled-reports", { method: "DELETE" });
      setReport(null);
      setRecipients([]);
      setShowForm(false);
    } catch { /* ignore */ } finally { setDeletingConf(false); }
  }

  function fmtDate(ts: string | null) {
    if (!ts) return c.neverSent;
    return new Date(ts).toLocaleDateString(
      locale === "fr" ? "fr-FR" : locale === "es" ? "es-ES" : locale === "ar" ? "ar-SA" : locale === "id" ? "id-ID" : "en-GB",
      { day: "numeric", month: "short", year: "numeric" }
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
          <Mail className="w-4 h-4 text-gray-500 shrink-0" />
          <span className="text-sm font-semibold text-gray-300">{c.title}</span>
          {!open && report?.active && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-900/30 border border-green-700/40 text-green-400">
              {report.recipients.length} {locale === "fr" ? "dest." : "recip."}
            </span>
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
              {/* Plan limit badge */}
              <p className="text-[10px] text-gray-600">{c.limitNote(maxR)}</p>

              {/* Saved feedback */}
              {saved && (
                <div className="flex items-center gap-1.5 text-xs text-green-400">
                  <Check className="w-3.5 h-3.5" /> {c.saved}
                </div>
              )}

              {report ? (
                <div className="space-y-3">
                  {/* Active toggle */}
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500 flex items-center gap-1.5">
                      {c.lastSent}: {fmtDate(report.last_sent_at)}
                    </span>
                    <button
                      onClick={toggleActive}
                      disabled={togglingActive}
                      title={c.toggle}
                      className="p-1 rounded text-gray-500 hover:text-gray-300 transition-colors"
                    >
                      {togglingActive
                        ? <Loader2 className="w-4 h-4 animate-spin" />
                        : report.active
                          ? <ToggleRight className="w-4 h-4 text-green-500" />
                          : <ToggleLeft className="w-4 h-4 text-gray-600" />
                      }
                    </button>
                  </div>

                  {/* Recipients list */}
                  <div className="space-y-1.5">
                    {recipients.map((email) => (
                      <div key={email} className="flex items-center justify-between gap-2 px-3 py-1.5 bg-gray-800/60 rounded-lg border border-gray-700/40">
                        <span className="text-xs text-gray-300 font-mono truncate">{email}</span>
                        <button
                          onClick={() => removeRecipient(email)}
                          className="shrink-0 text-gray-600 hover:text-red-400 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* Add recipient input */}
                  {recipients.length < maxR && (
                    <div className="flex gap-2">
                      <input
                        type="email"
                        value={emailInput}
                        onChange={(e) => setEmailInput(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && addEmail()}
                        placeholder={c.emailPlaceholder}
                        className="flex-1 min-w-0 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-gray-500 transition-colors"
                      />
                      <button
                        onClick={addEmail}
                        className="flex items-center gap-1 px-3 py-2 bg-gray-700 hover:bg-gray-600 border border-gray-600 text-gray-300 text-xs rounded-lg transition-colors shrink-0"
                      >
                        <Plus className="w-3.5 h-3.5" /> {c.addEmail}
                      </button>
                    </div>
                  )}

                  {error && (
                    <div className="flex items-center gap-1.5 text-xs text-red-400">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      {error}
                    </div>
                  )}

                  <div className="flex items-center justify-between gap-3 pt-1">
                    <button
                      onClick={deleteConfig}
                      disabled={deletingConf}
                      className="text-[10px] text-red-700 hover:text-red-500 transition-colors flex items-center gap-1"
                    >
                      {deletingConf ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                      {c.delete}
                    </button>
                    <button
                      onClick={saveConfig}
                      disabled={saving}
                      className="px-3 py-1.5 bg-red-600 hover:bg-red-500 disabled:opacity-40 text-white text-xs font-semibold rounded-lg transition-colors"
                    >
                      {saving ? c.saving : c.save}
                    </button>
                  </div>
                </div>
              ) : showForm ? (
                <div className="space-y-3">
                  {/* Recipients input */}
                  <div className="flex gap-2">
                    <input
                      type="email"
                      value={emailInput}
                      onChange={(e) => setEmailInput(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && addEmail()}
                      placeholder={c.emailPlaceholder}
                      className="flex-1 min-w-0 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-gray-500 transition-colors"
                    />
                    <button
                      onClick={addEmail}
                      className="flex items-center gap-1 px-3 py-2 bg-gray-700 hover:bg-gray-600 border border-gray-600 text-gray-300 text-xs rounded-lg transition-colors shrink-0"
                    >
                      <Plus className="w-3.5 h-3.5" /> {c.addEmail}
                    </button>
                  </div>

                  {recipients.map((email) => (
                    <div key={email} className="flex items-center justify-between gap-2 px-3 py-1.5 bg-gray-800/60 rounded-lg border border-gray-700/40">
                      <span className="text-xs text-gray-300 font-mono truncate">{email}</span>
                      <button onClick={() => removeRecipient(email)} className="shrink-0 text-gray-600 hover:text-red-400 transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}

                  {error && (
                    <div className="flex items-center gap-1.5 text-xs text-red-400">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {error}
                    </div>
                  )}

                  <div className="flex items-center gap-2 justify-end">
                    <button
                      onClick={() => { setShowForm(false); setRecipients([]); setEmailInput(""); setError(""); }}
                      className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
                    >
                      {c.cancel}
                    </button>
                    <button
                      onClick={saveConfig}
                      disabled={saving || recipients.length === 0}
                      className="px-3 py-1.5 bg-red-600 hover:bg-red-500 disabled:opacity-40 text-white text-xs font-semibold rounded-lg transition-colors"
                    >
                      {saving ? c.saving : c.save}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs text-gray-600 italic">{c.noConfig}</p>
                  <button
                    onClick={() => setShowForm(true)}
                    className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-200 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" /> {c.setup}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
