import Link from "next/link";
import { Activity } from "lucide-react";

interface FooterProps {
  locale: string;
}

const LABELS: Record<string, {
  about: string;
  privacy: string;
  terms: string;
  contact: string;
}> = {
  en: { about: "About", privacy: "Privacy Policy", terms: "Terms of Service", contact: "Contact" },
  fr: { about: "À propos", privacy: "Politique de confidentialité", terms: "Conditions d'utilisation", contact: "Contact" },
  es: { about: "Acerca de", privacy: "Política de privacidad", terms: "Términos de uso", contact: "Contacto" },
  ar: { about: "حول المنصة", privacy: "سياسة الخصوصية", terms: "شروط الاستخدام", contact: "تواصل معنا" },
  id: { about: "Tentang", privacy: "Kebijakan Privasi", terms: "Syarat Penggunaan", contact: "Kontak" },
};

export default function Footer({ locale }: FooterProps) {
  const l = LABELS[locale] ?? LABELS.en;

  return (
    <footer className="border-t border-gray-800 bg-gray-900/50 mt-16">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">

          {/* Brand */}
          <div className="flex items-center gap-2 text-gray-500 text-sm">
            <Activity className="w-4 h-4 text-red-500" />
            <span className="font-semibold text-gray-400">HealthWatch Global</span>
            <span>·</span>
            <span>© {new Date().getFullYear()}</span>
          </div>

          {/* Links */}
          <nav className="flex items-center gap-5 text-xs text-gray-500" dir={locale === "ar" ? "rtl" : undefined}>
            <Link href={`/${locale}/about`} className="hover:text-gray-300 transition-colors">
              {l.about}
            </Link>
            <Link href={`/${locale}/privacy`} className="hover:text-gray-300 transition-colors">
              {l.privacy}
            </Link>
            <Link href={`/${locale}/terms`} className="hover:text-gray-300 transition-colors">
              {l.terms}
            </Link>
            <Link href={`/${locale}/contact`} className="hover:text-gray-300 transition-colors">
              {l.contact}
            </Link>
            <a
              href="mailto:contact@healthwatch-global.com"
              className="hover:text-gray-300 transition-colors hidden md:inline"
            >
              contact@healthwatch-global.com
            </a>
          </nav>

        </div>
      </div>
    </footer>
  );
}
