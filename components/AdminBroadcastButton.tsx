"use client";

import { useState } from "react";
import { Send, CheckCircle, AlertCircle } from "lucide-react";

export default function AdminBroadcastButton() {
  const [status, setStatus] = useState<"idle" | "dry" | "loading" | "success" | "error">("idle");
  const [result, setResult] = useState<string>("");

  const run = async (dry: boolean) => {
    setStatus(dry ? "dry" : "loading");
    setResult("");

    let res: Response;
    try {
      res = await fetch(`/api/admin/broadcast-launch${dry ? "?dry=1" : ""}`, {
        method: "POST",
      });
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
      setResult(`Réponse non-JSON — HTTP ${res.status}`);
      return;
    }

    if (res.ok) {
      if (dry) {
        setStatus("idle");
        setResult(`Dry run : ${data.total} destinataires · aperçu : ${(data.preview as string[]).join(", ")}`);
      } else {
        setStatus("success");
        setResult(`✅ ${data.sent} envoyés · ${data.failed} erreurs · ${data.total} total`);
      }
    } else {
      setStatus("error");
      setResult(String(data.error || "Erreur inconnue"));
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3 flex-wrap">
        <button
          onClick={() => run(true)}
          disabled={status === "loading" || status === "dry"}
          className="flex items-center gap-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-60 text-white font-semibold px-4 py-2 rounded-lg text-sm transition-colors"
        >
          <Send className="w-4 h-4" />
          Dry run
        </button>
        <button
          onClick={() => run(false)}
          disabled={status === "loading" || status === "dry"}
          className="flex items-center gap-2 bg-[#ff6154] hover:bg-[#e5544a] disabled:opacity-60 text-white font-semibold px-4 py-2 rounded-lg text-sm transition-colors"
        >
          <Send className={`w-4 h-4 ${status === "loading" ? "animate-pulse" : ""}`} />
          {status === "loading" ? "Envoi en cours…" : "Envoyer email PH launch"}
        </button>
      </div>
      {result && (
        <div className={`flex items-start gap-1.5 text-sm ${status === "error" ? "text-red-400" : status === "success" ? "text-green-400" : "text-gray-400"}`}>
          {status === "error" ? <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /> : status === "success" ? <CheckCircle className="w-4 h-4 mt-0.5 shrink-0" /> : null}
          {result}
        </div>
      )}
    </div>
  );
}
