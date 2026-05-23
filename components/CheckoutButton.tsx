"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";

interface CheckoutButtonProps {
  plan: "starter" | "pro";
  locale: string;
  label: string;
  className: string;
  icon?: React.ReactNode;
}

export default function CheckoutButton({ plan, locale, label, className, icon }: CheckoutButtonProps) {
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handleClick = async () => {
    setLoading(true);
    setErrorMsg("");
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan, locale }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || `HTTP ${res.status}`);
      window.location.href = data.url;
    } catch (err: any) {
      console.error("Checkout error:", err);
      setErrorMsg(err.message || "Erreur inattendue.");
      setLoading(false);
    }
  };

  return (
    <div className="space-y-2">
      <button
        onClick={handleClick}
        disabled={loading}
        className={`${className} flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer`}
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : icon}
        {label}
      </button>
      {errorMsg && (
        <p className="text-red-400 text-xs text-center">{errorMsg}</p>
      )}
    </div>
  );
}
