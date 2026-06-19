"use client";

import { useState } from "react";
import { CalendarPlus } from "lucide-react";

export default function AdminExtendTrialButton({ email }: { email: string }) {
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [msg, setMsg] = useState("");

  async function handleClick() {
    if (!confirm(`Prolonger l'essai de ${email} de 14 jours ?`)) return;
    setState("loading");
    try {
      const res = await fetch("/api/admin/extend-trial", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, days: 14 }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg(data.error ?? "Erreur");
        setState("error");
      } else {
        const d = new Date(data.trial_ends_at).toLocaleDateString("fr");
        setMsg(`→ ${d}`);
        setState("done");
      }
    } catch {
      setMsg("Erreur réseau");
      setState("error");
    }
  }

  if (state === "done") {
    return <span className="text-xs text-green-400 font-medium">{msg}</span>;
  }
  if (state === "error") {
    return <span className="text-xs text-red-400">{msg}</span>;
  }

  return (
    <button
      onClick={handleClick}
      disabled={state === "loading"}
      title={`Prolonger l'essai de ${email} (+14j)`}
      className="p-1 rounded text-gray-600 hover:text-blue-400 hover:bg-blue-500/10 transition-colors disabled:opacity-40"
    >
      <CalendarPlus className="w-3.5 h-3.5" />
    </button>
  );
}
