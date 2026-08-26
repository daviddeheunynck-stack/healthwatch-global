"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import { track } from "@vercel/analytics/react";
import { Activity, Loader2 } from "lucide-react";
import { regionPickerFor } from "@/lib/region-picker";

// Etape posee aux inscriptions OAuth juste apres le premier login, quand la
// question n'a pas pu etre posee avant (arrivee par /login, ou par un /signup
// ouvert avant le deploiement du 2026-08-26).
//
// Ce que ca repare : le correctif ebe0ab0 du 2026-08-25 a rendu la question
// obligatoire sur le formulaire d'inscription, mais un compte Google ne voit
// jamais ce formulaire — il repartait avec les cinq regions, soit la
// distribution plate mesuree la veille (2 091 couples (utilisateur, foyer) sur
// 25 comptes, ~115 chacun, actif ou jamais revenu).
//
// Ce n'est PAS un mur : la personne peut fermer la page, son compte reste
// utilisable et inscrit aux cinq regions — exactement l'etat d'avant. Un
// blocage dur sur un compte qui vient d'etre cree couterait plus que le
// sur-abonnement qu'il evite.
//
// Limite connue : activateTrial() a deja envoye le digest d'inscription sur les
// cinq regions au moment du callback, avant que cette page ne s'affiche. La
// personne recoit donc un premier e-mail large, puis des alertes resserrees.
// Le seul moyen de l'eviter serait de differer l'activation de l'essai jusqu'a
// cette reponse — ce qui priverait d'essai quiconque ferme la page. Le chemin
// /signup, lui, transmet la region avant l'activation et n'a pas ce defaut.

const COPY: Record<string, { title: string; subtitle: string; submit: string; skip: string; error: string }> = {
  en: {
    title: "One last thing",
    subtitle: "Your alerts are set to every region right now. Pick the one that matters and we will only send you what belongs to it.",
    submit: "Continue",
    skip: "Keep all regions",
    error: "Could not save your choice. Try again, or change it later in your account settings.",
  },
  fr: {
    title: "Une dernière chose",
    subtitle: "Vos alertes couvrent actuellement toutes les régions. Choisissez celle qui compte et nous ne vous enverrons que ce qui la concerne.",
    submit: "Continuer",
    skip: "Garder toutes les régions",
    error: "Votre choix n'a pas pu être enregistré. Réessayez, ou modifiez-le plus tard depuis votre compte.",
  },
  es: {
    title: "Una última cosa",
    subtitle: "Sus alertas cubren ahora todas las regiones. Elija la que importa y solo le enviaremos lo que le corresponde.",
    submit: "Continuar",
    skip: "Mantener todas las regiones",
    error: "No se pudo guardar su elección. Inténtelo de nuevo, o cámbielo más tarde en su cuenta.",
  },
  ar: {
    title: "أمر أخير",
    subtitle: "تنبيهاتك تغطي حالياً كل المناطق. اختر المنطقة التي تهمك ولن نرسل لك سوى ما يخصها.",
    submit: "متابعة",
    skip: "الإبقاء على كل المناطق",
    error: "تعذّر حفظ اختيارك. حاول مرة أخرى، أو غيّره لاحقاً من حسابك.",
  },
  id: {
    title: "Satu hal terakhir",
    subtitle: "Peringatan Anda saat ini mencakup semua wilayah. Pilih yang paling penting dan kami hanya akan mengirim yang terkait.",
    submit: "Lanjutkan",
    skip: "Pertahankan semua wilayah",
    error: "Pilihan Anda tidak dapat disimpan. Coba lagi, atau ubah nanti di akun Anda.",
  },
};

// Meme regle que safeInternalPath() sur la page de connexion : un "/" en tete
// ne prouve pas qu'une cible est interne ("/\evil.com" resout vers
// https://evil.com). Resolu contre l'origine reelle, conserve seulement si le
// resultat est encore de meme origine.
function safeInternalPath(raw: string | null): string | null {
  if (!raw || !raw.startsWith("/")) return null;
  try {
    const url = new URL(raw, window.location.origin);
    if (url.origin !== window.location.origin) return null;
    return url.pathname + url.search + url.hash;
  } catch {
    return null;
  }
}

export default function WelcomePage() {
  const locale = useLocale();
  const router = useRouter();
  const rp = regionPickerFor(locale);
  const copy = COPY[locale] ?? COPY.en;

  const [region, setRegion] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [next, setNext] = useState(`/${locale}`);

  useEffect(() => {
    const raw = new URLSearchParams(window.location.search).get("next");
    setNext(safeInternalPath(raw) ?? `/${locale}`);
  }, [locale]);

  const finish = async (chosen: string) => {
    setLoading(true);
    setError(false);
    track("oauth_region_step", { choice: chosen, locale });

    try {
      const res = await fetch("/api/user/priority-region", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ region: chosen }),
      });
      if (!res.ok) throw new Error(`priority-region responded ${res.status}`);
    } catch (err) {
      console.error("[welcome] priority region save failed:", err);
      setError(true);
      setLoading(false);
      return;
    }

    router.push(next);
    router.refresh();
  };

  return (
    <div className="min-h-[70vh] flex items-center justify-center">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Activity className="text-red-500 w-10 h-10 mx-auto mb-3" />
          <h1 className="text-2xl font-bold text-white">{copy.title}</h1>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 space-y-5">
          <p className="text-sm text-gray-400">{copy.subtitle}</p>

          <div>
            <label htmlFor="welcome-region" className="block text-sm text-gray-400 mb-1.5">{rp.label}</label>
            <select
              id="welcome-region"
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              disabled={loading}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-red-500 transition-colors disabled:opacity-50"
            >
              <option value="" disabled>{rp.prompt}</option>
              {Object.entries(rp.options).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>

          {error && <p className="text-red-400 text-sm">{copy.error}</p>}

          <button
            type="button"
            onClick={() => finish(region)}
            disabled={loading || !region}
            className="w-full bg-red-600 hover:bg-red-500 disabled:opacity-60 text-white font-semibold py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {copy.submit}
          </button>

          <button
            type="button"
            onClick={() => finish("all")}
            disabled={loading}
            className="w-full text-center text-xs text-gray-500 hover:text-gray-400 transition-colors"
          >
            {copy.skip}
          </button>
        </div>
      </div>
    </div>
  );
}
