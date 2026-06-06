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
  plan: "starter" | "pro";
  locale: string;
  label: string;
  className: string;
  billing?: "monthly" | "annual";
  icon?: React.ReactNode;
}

export default function CheckoutButton({ plan, locale, label, className, billing = "monthly", icon }: CheckoutButtonProps) {
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
        router.push(`/${locale}/login`);
        return;
      }

      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan,
          locale,
          billing,
          userId: user.id,
          userEmail: user.email,
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || `HTTP ${res.status}`);
      track("checkout_start", { plan, billing, locale });
      window.location.href = data.url;
    } catch (err: any) {
      console.error("Checkout error:", err);
      setErrorMsg(err.message || ERROR_LABELS[locale] || ERROR_LABELS.en);
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
