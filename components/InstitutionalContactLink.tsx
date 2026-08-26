"use client";

import Link from "next/link";
import { track } from "@vercel/analytics/react";

// Ligne institutionnelle sous les formulaires de connexion et d'inscription,
// ajoutee le 2026-08-26 en meme temps que le retrait du bouton GitHub.
//
// Pourquoi ici : le chemin institutionnel existe en entier (/institutional,
// /contact, DPA, facture au nom de l'organisation) mais n'etait qu'un lien gris
// en bas de page jusqu'au 2026-08-25, ou "Demander un devis" est devenu l'action
// principale de la carte Team de /pricing. Les acheteurs reels — cinq contrats
// vendus a la main, pas une croissance en libre-service — passent par /login et
// /signup avant de voir /pricing. C'est du texte, pas un bouton : il ne doit
// jamais concurrencer l'action principale de la page.
//
// Meme evenement que la carte Team (`quote_request_click`) pour que les deux
// entrees s'additionnent dans la meme mesure ; `source` les distingue.

const LABELS: Record<string, { question: string; cta: string }> = {
  en: { question: "Signing up for an organization?", cta: "Request team access" },
  fr: { question: "Vous représentez une organisation ?", cta: "Demander un accès équipe" },
  es: { question: "¿Se registra en nombre de una organización?", cta: "Solicitar acceso para el equipo" },
  ar: { question: "هل تسجّل باسم مؤسسة؟", cta: "طلب وصول للفريق" },
  id: { question: "Mendaftar untuk sebuah organisasi?", cta: "Minta akses tim" },
};

type Props = { locale: string; source: "login" | "signup" };

export default function InstitutionalContactLink({ locale, source }: Props) {
  const l = LABELS[locale] ?? LABELS.en;

  return (
    <p className="text-center text-xs text-gray-600">
      {l.question}{" "}
      <Link
        href={`/${locale}/contact?devis=team`}
        onClick={() => track("quote_request_click", { source, locale })}
        className="underline underline-offset-2 hover:text-gray-400 transition-colors"
      >
        {l.cta}
      </Link>
    </p>
  );
}
