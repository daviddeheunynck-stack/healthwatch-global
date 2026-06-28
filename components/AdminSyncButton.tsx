"use client";

import { useState } from "react";
import { RefreshCw, CheckCircle, AlertCircle } from "lucide-react";

export default function AdminSyncButton() {
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [result, setResult] = useState<string>("");

  const handleSync = async () => {
    setStatus("loading");
    setResult("");

    let res: Response;
    try {
      res = await fetch("/api/admin/sync", { method: "POST" });
    } catch (e: unknown) {
      setStatus("error");
      setResult(`Réseau : ${e instanceof Error ? e.message : String(e)}`);
      return;
    }

    let data: Record<string, unknown>;
    try {
      data = await res.json();
    } catch {
      setStatus("error");
      setResult(`Réponse non-JSON — HTTP ${res.status} ${res.statusText}`);
      return;
    }

    if (res.ok) {
      setStatus("success");
      setResult(`WHO DON : +${data.inserted} insérés · ${data.updated} mis à jour · ${data.staleDeactivated} désactivés — ECDC, PAHO & régional en cours…`);
    } else {
      setStatus("error");
      const detail = data.detail ? ` — ${String(data.detail).slice(0, 120)}` : "";
      setResult(`${String(data.error || "Erreur inconnue")}${detail}`);
    }
  };

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <button
        onClick={handleSync}
        disabled={status === "loading"}
        className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white font-semibold px-4 py-2 rounded-lg text-sm transition-colors"
      >
        <RefreshCw className={`w-4 h-4 ${status === "loading" ? "animate-spin" : ""}`} />
        {status === "loading" ? "Synchronisation…" : "Synchroniser toutes les sources"}
      </button>
      {status === "success" && (
        <div className="flex items-center gap-1.5 text-green-400 text-sm">
          <CheckCircle className="w-4 h-4" />
          {result}
        </div>
      )}
      {status === "error" && (
        <div className="flex items-center gap-1.5 text-red-400 text-sm">
          <AlertCircle className="w-4 h-4" />
          {result}
        </div>
      )}
    </div>
  );
}
