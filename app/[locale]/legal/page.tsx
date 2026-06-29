import { getLocale } from "next-intl/server";
import Link from "next/link";
import { Scale, ArrowLeft } from "lucide-react";
import type { Metadata } from "next";

const LEGAL_META: Record<string, { title: string; description: string }> = {
  fr: { title: "Mentions légales", description: "Mentions légales de HealthWatch Global — éditeur, hébergeur, propriété intellectuelle, données personnelles." },
  en: { title: "Legal notices", description: "HealthWatch Global legal notices — publisher, hosting, intellectual property, personal data (French law LCEN)." },
  es: { title: "Avisos legales", description: "Avisos legales de HealthWatch Global — editor, alojamiento, propiedad intelectual, datos personales." },
  ar: { title: "الإشعارات القانونية", description: "الإشعارات القانونية لـ HealthWatch Global — الناشر، الاستضافة، الملكية الفكرية، البيانات الشخصية." },
  id: { title: "Pemberitahuan hukum", description: "Pemberitahuan hukum HealthWatch Global — penerbit, hosting, kekayaan intelektual, data pribadi." },
};

const NON_FR_NOTE: Record<string, string> = {
  en: "This legal notice is required by French law (LCEN). It is provided in French as legally mandated. For questions, contact contact@healthwatch-global.com.",
  es: "Este aviso legal es obligatorio según la ley francesa (LCEN). Se proporciona en francés según lo exige la ley. Contacto: contact@healthwatch-global.com.",
  ar: "هذا الإشعار القانوني مطلوب بموجب القانون الفرنسي (LCEN). يتم تقديمه باللغة الفرنسية كما يقتضي القانون. للتواصل: contact@healthwatch-global.com.",
  id: "Pemberitahuan hukum ini diwajibkan oleh hukum Prancis (LCEN). Disediakan dalam bahasa Prancis sesuai ketentuan hukum. Kontak: contact@healthwatch-global.com.",
};

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const m = LEGAL_META[locale] ?? LEGAL_META.en;
  const url = `https://healthwatch-global.com/${locale}/legal`;
  return {
    title: m.title,
    description: m.description,
    alternates: {
      canonical: url,
      languages: {
        en: "https://healthwatch-global.com/en/legal",
        fr: "https://healthwatch-global.com/fr/legal",
        es: "https://healthwatch-global.com/es/legal",
        ar: "https://healthwatch-global.com/ar/legal",
        id: "https://healthwatch-global.com/id/legal",
        "x-default": "https://healthwatch-global.com/en/legal",
      },
    },
    robots: { index: true, follow: true },
  };
}

const BACK_LABELS: Record<string, string> = {
  fr: "Retour au tableau de bord",
  en: "Back to dashboard",
  es: "Volver al panel",
  ar: "العودة إلى لوحة التحكم",
  id: "Kembali ke dasbor",
};

// ─── À COMPLÉTER dès réception du SIRET ──────────────────────────────────────
const SIRET = "879 502 912 00014";

export default async function LegalPage() {
  const locale = await getLocale();
  const backLabel = BACK_LABELS[locale] ?? BACK_LABELS.en;

  return (
    <div className="max-w-3xl mx-auto space-y-10">

      <div>
        <Link
          href={`/${locale}`}
          className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          {backLabel}
        </Link>

        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-red-600/10 border border-red-600/20 flex items-center justify-center">
            <Scale className="w-5 h-5 text-red-400" />
          </div>
          <h1 className="text-3xl font-bold text-white">Mentions légales</h1>
        </div>
        <p className="text-gray-500 text-sm">Conformément à la loi n° 2004-575 du 21 juin 2004 pour la confiance dans l&apos;économie numérique (LCEN)</p>
      </div>

      {locale !== "fr" && NON_FR_NOTE[locale] && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-3 text-sm text-amber-300">
          {NON_FR_NOTE[locale]}
        </div>
      )}

      <div className="space-y-8 text-sm text-gray-400 leading-relaxed">

        {/* 1. Éditeur */}
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-white">1. Éditeur du site</h2>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-2">
            <p><span className="text-gray-300 font-medium">Nom :</span> David Deheunynck</p>
            <p><span className="text-gray-300 font-medium">Statut :</span> Micro-entrepreneur</p>
            <p><span className="text-gray-300 font-medium">Adresse :</span> 90b avenue Becquart, 59130 Lambersart, France</p>
            <p>
              <span className="text-gray-300 font-medium">SIRET :</span>{" "}
              <span className={SIRET.startsWith("À") ? "text-amber-400 italic" : ""}>{SIRET}</span>
            </p>
            <p>
              <span className="text-gray-300 font-medium">Téléphone :</span>{" "}
              <a href="tel:+33681314231" className="text-red-400 hover:text-red-300">
                +33 6 81 31 42 31
              </a>
            </p>
            <p>
              <span className="text-gray-300 font-medium">Email :</span>{" "}
              <a href="mailto:contact@healthwatch-global.com" className="text-red-400 hover:text-red-300">
                contact@healthwatch-global.com
              </a>
            </p>
            <p><span className="text-gray-300 font-medium">Directeur de la publication :</span> David Deheunynck</p>
          </div>
        </section>

        {/* 2. Hébergeur */}
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-white">2. Hébergeur</h2>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-2">
            <p><span className="text-gray-300 font-medium">Société :</span> Vercel Inc.</p>
            <p><span className="text-gray-300 font-medium">Adresse :</span> 340 S Lemon Ave #4133, Walnut, CA 91789, États-Unis</p>
            <p>
              <span className="text-gray-300 font-medium">Site web :</span>{" "}
              <a href="https://vercel.com" target="_blank" rel="noopener noreferrer" className="text-red-400 hover:text-red-300">
                vercel.com
              </a>
            </p>
          </div>
        </section>

        {/* 3. Propriété intellectuelle */}
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-white">3. Propriété intellectuelle</h2>
          <p>
            L&apos;ensemble du contenu de ce site (textes, graphiques, logiciels, code source, marques, logos) est la propriété
            exclusive de David Deheunynck, sous réserve des données issues de sources tierces (Organisation Mondiale de la
            Santé, CDC, ECDC) qui demeurent la propriété de leurs auteurs respectifs.
          </p>
          <p>
            Toute reproduction, représentation, modification, publication ou adaptation de tout ou partie des éléments du
            site, quel que soit le moyen ou le procédé utilisé, est interdite sans l&apos;autorisation écrite préalable de
            David Deheunynck.
          </p>
        </section>

        {/* 4. Données de santé */}
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-white">4. Données épidémiologiques — avertissement</h2>
          <p>
            Les données épidémiologiques affichées sur HealthWatch Global proviennent exclusivement de sources officielles
            et publiques (OMS Disease Outbreak News, ECDC, PAHO et Africa CDC). Elles sont fournies à titre informatif
            uniquement et ne constituent pas un avis médical.
          </p>
          <p>
            HealthWatch Global décline toute responsabilité quant à l&apos;utilisation faite de ces données dans un contexte
            clinique ou de prise de décision médicale.
          </p>
        </section>

        {/* 5. Données personnelles */}
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-white">5. Données personnelles</h2>
          <p>
            Le traitement des données personnelles des utilisateurs est décrit dans notre{" "}
            <Link href={`/${locale}/privacy`} className="text-red-400 hover:text-red-300">
              Politique de confidentialité
            </Link>
            , conformément au Règlement Général sur la Protection des Données (RGPD — UE 2016/679).
          </p>
          <p>
            Pour toute demande relative à vos données (accès, rectification, suppression, portabilité), contactez :{" "}
            <a href="mailto:contact@healthwatch-global.com" className="text-red-400 hover:text-red-300">
              contact@healthwatch-global.com
            </a>
          </p>
        </section>

        {/* 6. Cookies */}
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-white">6. Cookies</h2>
          <p>
            Ce site utilise des cookies de mesure d&apos;audience (Vercel Analytics) uniquement avec votre consentement explicite.
            Vous pouvez modifier vos préférences à tout moment via le lien &quot;Paramètres cookies&quot; en bas de page.
          </p>
        </section>

        {/* 7. Droit applicable */}
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-white">7. Droit applicable et juridiction</h2>
          <p>
            Les présentes mentions légales sont régies par le droit français. En cas de litige, et à défaut de résolution
            amiable, les tribunaux français seront compétents.
          </p>
        </section>

        <p className="text-xs text-gray-600 pt-4 border-t border-gray-800">
          Dernière mise à jour : 25 mai 2026
        </p>

      </div>
    </div>
  );
}
