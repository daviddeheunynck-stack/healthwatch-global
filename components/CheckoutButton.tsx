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

  const handleClick = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan, locale }),
      });
      const { url, error } = await res.json();
      if (error) throw new Error(error);
      window.location.href = url;
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className={`${className} flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer`}
    >
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : icon}
      {label}
    </button>
  );
}
