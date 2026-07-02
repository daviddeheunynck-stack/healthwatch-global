"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase-browser";
import Link from "next/link";

const COPY: Record<string, (name: string) => string> = {
  en: (n) => `Get email alerts when new outbreaks are reported in ${n}`,
  fr: (n) => `Recevoir des alertes pour les nouveaux foyers signalés en ${n}`,
  es: (n) => `Recibir alertas de nuevos brotes reportados en ${n}`,
  ar: (n) => `احصل على تنبيهات للتفشيات الجديدة في ${n}`,
  id: (n) => `Dapatkan peringatan wabah baru yang dilaporkan di ${n}`,
};

interface Props {
  locale: string;
  countryName: string;
}

type State = "show-pricing" | "show-account" | "hidden";

export default function CountryAlertNudge({ locale, countryName }: Props) {
  const [state, setState] = useState<State>("show-pricing");

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) return;
      const { data: profile } = await supabase
        .from("profiles")
        .select("plan, stripe_subscription_id")
        .eq("id", session.user.id)
        .single();
      const isPaid = ["starter", "pro", "team", "enterprise"].includes(profile?.plan ?? "");
      if (isPaid && !!profile?.stripe_subscription_id) {
        setState("hidden");
      } else if (isPaid) {
        setState("show-account");
      }
    });
  }, []);

  if (state === "hidden") return null;

  const text = (COPY[locale] ?? COPY.en)(countryName);
  const href = state === "show-account"
    ? `/${locale}/account#regional-alerts`
    : `/${locale}/pricing`;

  return (
    <p className="text-xs text-right -mt-1">
      <Link href={href} className="text-red-400/70 hover:text-red-300 transition-colors">
        {text} →
      </Link>
    </p>
  );
}
