"use client";

import { useState } from "react";
import { CreditCard, Loader2 } from "lucide-react";

const ERROR_LABELS: Record<string, { generic: string; network: string }> = {
  en: { generic: "An error occurred", network: "Network error" },
  fr: { generic: "Une erreur s'est produite", network: "Erreur réseau" },
  es: { generic: "Se produjo un error", network: "Error de red" },
  ar: { generic: "حدث خطأ ما", network: "خطأ في الشبكة" },
  id: { generic: "Terjadi kesalahan", network: "Kesalahan jaringan" },
};

export default function BillingPortalButton({
  locale,
  label,
}: {
  locale: string;
  label: string;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const err = ERROR_LABELS[locale] ?? ERROR_LABELS.en;

  async function handleClick() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/billing-portal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        setError(data.error || err.generic);
        setLoading(false);
      }
    } catch {
      setError(err.network);
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        onClick={handleClick}
        disabled={loading}
        className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-60
                   text-white font-semibold px-5 py-2.5 rounded-lg transition-colors text-sm"
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4" />}
        {label}
      </button>
      {error && <p className="text-red-400 text-xs mt-2">{error}</p>}
    </div>
  );
}
