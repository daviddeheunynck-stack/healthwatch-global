"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

const CTA: Record<string, string> = {
  fr: "Rejoindre l'organisation",
  en: "Join organisation",
  es: "Unirse a la organización",
  ar: "انضم إلى المنظمة",
  id: "Bergabung dengan organisasi",
};
const JOINING: Record<string, string> = {
  fr: "Adhésion…", en: "Joining…", es: "Uniéndose…", ar: "انضمام…", id: "Bergabung…",
};
const DONE: Record<string, string> = {
  fr: "Bienvenue dans l'organisation !", en: "Welcome to the organisation!", es: "¡Bienvenido!", ar: "مرحباً بك!", id: "Selamat datang!",
};

export default function AcceptInviteButton({ token, locale }: { token: string; locale: string }) {
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [err, setErr] = useState("");
  const router = useRouter();

  async function accept() {
    setState("loading");
    const res = await fetch("/api/org/accept-invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
    if (res.ok) {
      setState("done");
      setTimeout(() => router.push(`/${locale}`), 1500);
    } else {
      const j = await res.json() as { error?: string };
      setErr(j.error ?? "Error");
      setState("error");
    }
  }

  if (state === "done")
    return <p className="text-green-400 font-medium">{DONE[locale] ?? DONE.en}</p>;

  return (
    <div className="flex flex-col gap-2">
      <button
        onClick={accept}
        disabled={state === "loading"}
        className="px-6 py-3 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-semibold rounded-lg transition-colors"
      >
        {state === "loading" ? (JOINING[locale] ?? JOINING.en) : (CTA[locale] ?? CTA.en)}
      </button>
      {state === "error" && <p className="text-red-400 text-sm">{err}</p>}
    </div>
  );
}
