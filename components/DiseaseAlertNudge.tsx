"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase-browser";
import Link from "next/link";

const COPY: Record<string, (name: string) => string> = {
  en: (n) => `Get alerted when ${n} cases are reported in your region`,
  fr: (n) => `Recevoir une alerte si des cas de ${n} sont signalés dans votre région`,
  es: (n) => `Recibir alertas cuando se reporten casos de ${n} en su región`,
  ar: (n) => `احصل على تنبيه عند الإبلاغ عن حالات ${n} في منطقتك`,
  id: (n) => `Dapatkan peringatan jika kasus ${n} dilaporkan di wilayah Anda`,
};

interface Props {
  locale: string;
  diseaseName: string;
}

export default function DiseaseAlertNudge({ locale, diseaseName }: Props) {
  const [show, setShow] = useState(true);

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
        setShow(false);
      }
    });
  }, []);

  if (!show) return null;

  const text = (COPY[locale] ?? COPY.en)(diseaseName);

  return (
    <p className="text-xs text-right -mt-1">
      <Link
        href={`/${locale}/pricing`}
        className="text-red-400/70 hover:text-red-300 transition-colors"
      >
        {text} →
      </Link>
    </p>
  );
}
