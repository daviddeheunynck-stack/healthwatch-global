"use client";

import { useState, useEffect } from "react";
import { Wrench, AlertCircle, Loader2 } from "lucide-react";

const LS_KEY = "qc_fixes_applied";

type Fix = {
  label: string;
  disease_en: string;
  country_en: string;
  cases?: number;
  deaths?: number;
  date?: string;
  source?: string;
  active?: boolean;
};

// RETIRÉ le 2026-08-23 — le correctif « Ebola / RD Congo — DON606 (534 cas /
// 93 morts, 8 juin 2026) ». DON606 est une édition WHO réelle mais périmée
// (mi-mai) : l'appliquer écrase la ligne phare PHEIC, à 5 021/2 378 selon le
// WHO AFRO Situation Report 14. C'est exactement ce qui s'est produit le
// 22/08 — un clic, huit heures de chiffre faux sur le bandeau d'accueil, et
// une matinée d'enquête (voir scripts/fix-ebola-drc-regression-2026-08-22.mjs).
//
// Deux défauts se cumulaient : ce tableau est écrit en dur, donc le bouton
// restait proposé indéfiniment ; et l'état « déjà appliqué » vit dans le
// localStorage du navigateur, donc il réapparaît intact sur toute autre
// machine ou après un nettoyage de cache. Un correctif ponctuel ne devrait
// pas survivre à son application — le retirer d'ici est la seule façon fiable
// de le désamorcer.
const FIXES: Fix[] = [
  {
    label: "Hantavirus / Cruise ship MV Hondius — désactiver (résolu, DON604)",
    disease_en: "Hantavirus",
    country_en: "Plusieurs pays",
    active: false,
  },
  {
    label: "Ebola / Allemagne — désactiver (ligne parasite ECDC, outbreak en RDC)",
    disease_en: "Ebola",
    country_en: "Germany",
    active: false,
  },
];

type Status = "idle" | "loading" | "success" | "error" | "blocked";

export default function AdminQCFixButton() {
  const [statuses, setStatuses] = useState<Record<number, Status>>({});
  const [messages, setMessages] = useState<Record<number, string>>({});
  const [blocked, setBlocked]   = useState<Record<number, string>>({});
  const [applied, setApplied] = useState<Set<string>>(new Set());

  useEffect(() => {
    try {
      const stored: string[] = JSON.parse(localStorage.getItem(LS_KEY) ?? "[]");
      setApplied(new Set(stored));
    } catch {}
  }, []);

  async function applyFix(idx: number, fix: Fix, force = false) {
    setStatuses((s) => ({ ...s, [idx]: "loading" }));
    setMessages((m) => ({ ...m, [idx]: "" }));
    setBlocked((b) => ({ ...b, [idx]: "" }));

    let res: Response;
    try {
      res = await fetch("/api/admin/patch-outbreak", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(force ? { ...fix, force: true } : fix),
      });
    } catch (e) {
      setStatuses((s) => ({ ...s, [idx]: "error" }));
      setMessages((m) => ({ ...m, [idx]: e instanceof Error ? e.message : String(e) }));
      return;
    }

    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      setStatuses((s) => ({ ...s, [idx]: "success" }));
      setMessages((m) => ({ ...m, [idx]: `OK — id ${data.id}` }));
      setApplied((prev) => {
        const next = new Set(prev).add(fix.label);
        try { localStorage.setItem(LS_KEY, JSON.stringify([...next])); } catch {}
        return next;
      });
    } else if (res.status === 409 && data.error === "regression_blocked") {
      // La garde anti-régression a refusé l'écriture. On montre ce que la ligne
      // vaut aujourd'hui face à ce qui allait l'écraser, plutôt qu'un message
      // d'erreur opaque — c'est la comparaison qui manquait le 22/08.
      setStatuses((s) => ({ ...s, [idx]: "blocked" }));
      setBlocked((b) => ({
        ...b,
        [idx]:
          `${data.reason} · actuel ${data.current?.cases ?? "?"} cas / ` +
          `${data.current?.deaths ?? "?"} morts (${data.current?.date ?? "?"}) ` +
          `→ tentative ${data.attempted?.cases ?? "?"} / ${data.attempted?.deaths ?? "?"} ` +
          `(${data.attempted?.date ?? "?"})`,
      }));
    } else {
      setStatuses((s) => ({ ...s, [idx]: "error" }));
      setMessages((m) => ({ ...m, [idx]: data.error ?? `HTTP ${res.status}` }));
    }
  }

  return (
    <div className="space-y-3">
      {FIXES.map((fix, idx) => {
        const st = statuses[idx] ?? "idle";
        if (st === "success" || applied.has(fix.label)) return null;
        return (
          <div key={idx} className="flex items-center gap-3 flex-wrap">
            <button
              onClick={() => applyFix(idx, fix)}
              disabled={st === "loading"}
              className="flex items-center gap-2 bg-amber-700 hover:bg-amber-600 disabled:opacity-60 text-white font-semibold px-4 py-2 rounded-lg text-sm transition-colors"
            >
              {st === "loading"
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <Wrench className="w-4 h-4" />}
              {fix.label}
            </button>
            {st === "error" && (
              <span className="flex items-center gap-1 text-red-400 text-xs">
                <AlertCircle className="w-3.5 h-3.5" /> {messages[idx]}
              </span>
            )}
            {st === "blocked" && (
              <div className="flex flex-col gap-2 w-full bg-orange-950/30 border border-orange-500/30 rounded-lg px-3 py-2">
                <span className="flex items-start gap-1.5 text-orange-300 text-xs">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <span>
                    <b>Écriture bloquée par la garde anti-régression.</b>
                    <br />
                    {blocked[idx]}
                  </span>
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => applyFix(idx, fix, true)}
                    className="bg-red-800 hover:bg-red-700 text-white text-xs font-semibold px-3 py-1.5 rounded transition-colors"
                  >
                    Forcer l&apos;écriture
                  </button>
                  <span className="text-[11px] text-gray-500">
                    À ne faire qu&apos;après avoir vérifié le chiffre à la source primaire.
                  </span>
                </div>
              </div>
            )}
          </div>
        );
      })}
      <p className="text-xs text-gray-600">
        Mpox stale : exclu automatiquement (source WHO mensuelle — délai normal).
      </p>
    </div>
  );
}
