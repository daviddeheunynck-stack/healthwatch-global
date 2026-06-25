"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase-browser";
import { track } from "@vercel/analytics/react";

const ERROR_LABELS: Record<string, string> = {
  en: "An unexpected error occurred.",
  fr: "Une erreur inattendue s'est produite.",
  es: "Se produjo un error inesperado.",
  ar: "حدث خطأ غير متوقع.",
  id: "Terjadi kesalahan yang tidak terduga.",
};

interface CheckoutButtonProps {
  plan: "pro" | "team";
  locale: string;
  label: string;
  className: string;
  billing?: "monthly" | "annual";
  icon?: React.ReactNode;
}

export default function CheckoutButton({ plan, locale, label, className, billing = "annual", icon }: CheckoutButtonProps) {
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const router = useRouter();

  const handleClick = async () => {
    setLoading(true);
    setErrorMsg("");

    try {
      // Require login before checkout
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        router.push(`/${locale}/login?next=/${locale}/pricing`);
        return;
      }

      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan, locale, billing }),
      });

      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || `HTTP ${res.status}`);
      track("checkout_start", { plan, billing, locale });
      window.location.href = data.url;
    } catch (err: unknown) {
      console.error("Checkout error:", err);
      // User-facing string: only trust .message from real Error instances —
      // anything else (a thrown string/object from somewhere unexpected)
      // falls through to the localized generic label rather than leaking
      // a raw, possibly-ugly value into the UI.
      const message = err instanceof Error ? err.message : undefined;
      setErrorMsg(message || ERROR_LABELS[locale] || ERROR_LABELS.en);
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
