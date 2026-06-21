"use client";

import { useState, useEffect } from "react";
import { Check, ChevronRight, ChevronDown, Loader2, X } from "lucide-react";

type StepKey =
  | "investigation"
  | "lab_confirmation"
  | "ihr_notification"
  | "measures_deployed"
  | "closed";

interface WorkflowStep {
  id: string;
  step: StepKey;
  responsible_email: string | null;
  notes: string | null;
  completed_at: string;
}

const ORDERED_STEPS: StepKey[] = [
  "investigation",
  "lab_confirmation",
  "ihr_notification",
  "measures_deployed",
  "closed",
];

const STEP_LABELS: Record<string, Record<StepKey, string>> = {
  fr: { investigation: "Investigation", lab_confirmation: "Confirmation labo", ihr_notification: "Notification IHR", measures_deployed: "Mesures déployées", closed: "Clôturé" },
  en: { investigation: "Investigation", lab_confirmation: "Lab confirmation", ihr_notification: "IHR notification", measures_deployed: "Measures deployed", closed: "Closed" },
  es: { investigation: "Investigación", lab_confirmation: "Confirmación labo", ihr_notification: "Notificación RSI", measures_deployed: "Medidas desplegadas", closed: "Cerrado" },
  ar: { investigation: "التحقيق", lab_confirmation: "تأكيد المختبر", ihr_notification: "إخطار اللوائح الصحية", measures_deployed: "تدابير مُطبَّقة", closed: "مغلق" },
  id: { investigation: "Investigasi", lab_confirmation: "Konfirmasi lab", ihr_notification: "Notifikasi IHR", measures_deployed: "Tindakan diterapkan", closed: "Ditutup" },
};

const WF_COPY: Record<string, {
  title: string; responsible: string; notesLabel: string;
  markDone: string; undo: string; rPh: string; nPh: string; progress: string;
}> = {
  fr: { title: "Suivi de réponse", responsible: "Responsable", notesLabel: "Note", markDone: "Valider", undo: "Annuler", rPh: "email@organisme.org", nPh: "Détail optionnel…", progress: "étape(s)" },
  en: { title: "Response workflow", responsible: "Responsible", notesLabel: "Note", markDone: "Mark done", undo: "Undo", rPh: "email@organisation.org", nPh: "Optional detail…", progress: "step(s)" },
  es: { title: "Seguimiento de respuesta", responsible: "Responsable", notesLabel: "Nota", markDone: "Marcar", undo: "Deshacer", rPh: "email@organismo.org", nPh: "Detalle opcional…", progress: "etapa(s)" },
  ar: { title: "تتبع الاستجابة", responsible: "المسؤول", notesLabel: "ملاحظة", markDone: "تأكيد", undo: "تراجع", rPh: "email@المنظمة.org", nPh: "تفصيل اختياري…", progress: "خطوة" },
  id: { title: "Pelacakan respons", responsible: "Penanggung jawab", notesLabel: "Catatan", markDone: "Tandai selesai", undo: "Batalkan", rPh: "email@organisasi.org", nPh: "Detail opsional…", progress: "langkah" },
};

interface Props { outbreakId: string; locale: string; }

export default function OutbreakWorkflow({ outbreakId, locale }: Props) {
  const c  = WF_COPY[locale]     ?? WF_COPY.en;
  const sl = STEP_LABELS[locale] ?? STEP_LABELS.en;

  const [steps,       setSteps]       = useState<WorkflowStep[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [expanded,    setExpanded]    = useState<StepKey | null>(null);
  const [responsible, setResponsible] = useState("");
  const [noteInput,   setNoteInput]   = useState("");
  const [saving,      setSaving]      = useState<StepKey | null>(null);
  const [removing,    setRemoving]    = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/outbreak-workflow?outbreak_id=${outbreakId}`)
      .then((r) => r.json())
      .then((d) => { if (d.steps) setSteps(d.steps); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [outbreakId]);

  const isDone  = (s: StepKey)  => steps.some((e) => e.step === s);
  const getEntry= (s: StepKey)  => steps.find((e) => e.step === s) ?? null;
  const doneCount = steps.length;

  async function markDone(step: StepKey) {
    setSaving(step);
    try {
      const res = await fetch("/api/outbreak-workflow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          outbreak_id: outbreakId, step,
          responsible_email: responsible.trim() || null,
          notes: noteInput.trim() || null,
        }),
      });
      const d = await res.json();
      if (d.step) {
        setSteps((prev) => [...prev, d.step as WorkflowStep]);
        setExpanded(null); setResponsible(""); setNoteInput("");
      }
    } catch { /* ignore */ } finally { setSaving(null); }
  }

  async function undoStep(id: string) {
    setRemoving(id);
    try {
      await fetch(`/api/outbreak-workflow/${id}`, { method: "DELETE" });
      setSteps((prev) => prev.filter((s) => s.id !== id));
    } catch { /* ignore */ } finally { setRemoving(null); }
  }

  return (
    <div className="px-5 pb-4">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{c.title}</p>
        {loading
          ? <Loader2 className="w-3.5 h-3.5 animate-spin text-gray-600" />
          : <span className="text-[10px] text-gray-600">{doneCount}/{ORDERED_STEPS.length} {c.progress}</span>
        }
      </div>

      {!loading && (
        <div className="space-y-1.5">
          {ORDERED_STEPS.map((step, idx) => {
            const done      = isDone(step);
            const entry     = getEntry(step);
            const isExpanded = expanded === step;
            // A step is locked if the previous one isn't done yet (sequential enforcement)
            const isLocked  = !done && idx > 0 && !isDone(ORDERED_STEPS[idx - 1]);

            return (
              <div key={step}>
                <div className={`flex items-center gap-2.5 rounded-xl px-3 py-2 transition-colors border ${
                  done       ? "bg-green-900/20 border-green-700/30" :
                  isExpanded ? "bg-gray-800 border-gray-600" :
                  isLocked   ? "border-gray-800 opacity-40" :
                               "border-gray-800 hover:border-gray-700"
                }`}>
                  {/* Checkmark / step number */}
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                    done       ? "border-green-500 bg-green-500/20" :
                    isExpanded ? "border-gray-400" : "border-gray-700"
                  }`}>
                    {done
                      ? <Check className="w-3 h-3 text-green-400" />
                      : <span className="text-[10px] text-gray-600 font-medium">{idx + 1}</span>
                    }
                  </div>

                  {/* Step label */}
                  <span className={`text-xs flex-1 ${done ? "text-green-300 font-medium" : isLocked ? "text-gray-600" : "text-gray-300"}`}>
                    {sl[step]}
                  </span>

                  {/* Date when done */}
                  {done && entry && (
                    <span className="text-[10px] text-gray-600 shrink-0">
                      {new Date(entry.completed_at).toLocaleDateString(
                        locale === "fr" ? "fr-FR" : locale === "es" ? "es-ES" : locale === "ar" ? "ar-SA" : locale === "id" ? "id-ID" : "en-GB",
                        { day: "numeric", month: "short" }
                      )}
                    </span>
                  )}

                  {/* Action: expand to mark done, or undo */}
                  {done ? (
                    <button
                      onClick={() => undoStep(entry!.id)}
                      disabled={removing === entry?.id}
                      className="text-gray-600 hover:text-red-400 transition-colors p-0.5 shrink-0"
                      title={c.undo}
                    >
                      {removing === entry?.id
                        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        : <X className="w-3.5 h-3.5" />
                      }
                    </button>
                  ) : !isLocked ? (
                    <button
                      onClick={() => setExpanded(isExpanded ? null : step)}
                      className="text-gray-600 hover:text-gray-300 transition-colors p-0.5 shrink-0"
                    >
                      {isExpanded
                        ? <ChevronDown className="w-3.5 h-3.5" />
                        : <ChevronRight className="w-3.5 h-3.5" />
                      }
                    </button>
                  ) : null}
                </div>

                {/* Expand form */}
                {isExpanded && !done && (
                  <div className="mt-1 ml-8 space-y-1.5 pb-1">
                    <input
                      value={responsible}
                      onChange={(e) => setResponsible(e.target.value)}
                      placeholder={`${c.responsible} — ${c.rPh}`}
                      maxLength={255}
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-gray-500 transition-colors"
                    />
                    <input
                      value={noteInput}
                      onChange={(e) => setNoteInput(e.target.value)}
                      placeholder={`${c.notesLabel} — ${c.nPh}`}
                      maxLength={500}
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-gray-500 transition-colors"
                    />
                    <button
                      onClick={() => markDone(step)}
                      disabled={saving === step}
                      className="px-3 py-1.5 bg-green-700 hover:bg-green-600 disabled:opacity-40 text-white text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5"
                    >
                      {saving === step && <Loader2 className="w-3 h-3 animate-spin" />}
                      {c.markDone}
                    </button>
                  </div>
                )}

                {/* Completed detail row */}
                {done && entry && (entry.responsible_email || entry.notes) && (
                  <div className="ml-8 mt-0.5 space-y-0.5 text-[10px] text-gray-600">
                    {entry.responsible_email && <p>→ {entry.responsible_email}</p>}
                    {entry.notes && <p className="text-gray-500 italic">{entry.notes}</p>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
