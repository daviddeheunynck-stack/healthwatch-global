"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";
import { createClient } from "@/lib/supabase-browser";

export default function SentryUserIdentifier({ locale }: { locale: string }) {
  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      Sentry.setTag("locale", locale);

      if (!user) {
        Sentry.setUser(null);
        return;
      }

      Sentry.setUser({ id: user.id, email: user.email });

      supabase
        .from("profiles")
        .select("plan")
        .eq("id", user.id)
        .single()
        .then(({ data }) => {
          if (data?.plan) Sentry.setTag("plan", data.plan);
        });
    })();
  }, [locale]);

  return null;
}
