"use client";

import { useState } from "react";
import { Wrench, CheckCircle, AlertCircle, Loader2 } from "lucide-react";

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

const FIXES: Fix[] = [
  {
    label: "Ebola / RD Congo — DON606 (534 cas / 93 morts, 8 juin 2026)",
    disease_en: "Ebola",
    country_en: "Democratic Republic of the Congo",
    cases: 534,
    deaths: 93,
    date: "2026-06-08",
    source: "https://www.who.int/emergencies/disease-outbreak-news/item/2026-DON606",
    active: true,
  },
  {
    label: "Hantavirus / Cruise ship MV Hondius — désactiver (résolu, DON604)",
    disease_en: "Hantavirus",
    country_en: "Netherlands",
    active: false,
  },
];

type Status = "idle" | "loading" | "success" | "error";

export default function AdminQCFixButton() {
  const [statuses, setStatuses] = useState<Record<number, Status>>({});
  const [messages, setMessages] = useState<Record<number, string>>({});

  async function applyFix(idx: number, fix: Fix) {
    setStatuses((s) => ({ ...s, [idx]: "loading" }));
    setMessages((m) => ({ ...m, [idx]: "" }));

    let res: Response;
    try {
      res = await fetch("/api/admin/patch-outbreak", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fix),
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
    } else {
      setStatuses((s) => ({ ...s, [idx]: "error" }));
      setMessages((m) => ({ ...m, [idx]: data.error ?? `HTTP ${res.status}` }));
    }
  }

  return (
    <div className="space-y-3">
      {FIXES.map((fix, idx) => {
        const st = statuses[idx] ?? "idle";
        return (
          <div key={idx} className="flex items-center gap-3 flex-wrap">
            <button
              onClick={() => applyFix(idx, fix)}
              disabled={st === "loading" || st === "success"}
              className="flex items-center gap-2 bg-amber-700 hover:bg-amber-600 disabled:opacity-60 text-white font-semibold px-4 py-2 rounded-lg text-sm transition-colors"
            >
              {st === "loading"
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <Wrench className="w-4 h-4" />}
              {fix.label}
            </button>
            {st === "success" && (
              <span className="flex items-center gap-1 text-green-400 text-xs">
                <CheckCircle className="w-3.5 h-3.5" /> {messages[idx]}
              </span>
            )}
            {st === "error" && (
              <span className="flex items-center gap-1 text-red-400 text-xs">
                <AlertCircle className="w-3.5 h-3.5" /> {messages[idx]}
              </span>
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
