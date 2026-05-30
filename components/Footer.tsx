"use client";

import Link from "next/link";
import { Activity } from "lucide-react";
import { STORAGE_KEY } from "@/components/CookieBanner";

interface FooterProps {
  locale: string;
}

const LABELS: Record<string, {
  about: string;
  privacy: string;
  terms: string;
  legal: string;
  contact: string;
  cookies: string;
}> = {
  en: { about: "About", privacy: "Privacy Policy", terms: "Terms of Service", legal: "Legal notice", contact: "Contact", cookies: "Cookie settings" },
  fr: { about: "À propos", privacy: "Politique de confidentialité", terms: "CGU", legal: "Mentions légales", contact: "Contact", cookies: "Paramètres cookies" },
  es: { about: "Acerca de", privacy: "Política de privacidad", terms: "Términos de uso", legal: "Aviso legal", contact: "Contacto", cookies: "Configuración de cookies" },
  ar: { about: "حول المنصة", privacy: "سياسة الخصوصية", terms: "شروط الاستخدام", legal: "الإشعار القانوني", contact: "تواصل معنا", cookies: "إعدادات ملفات الارتباط" },
  id: { about: "Tentang", privacy: "Kebijakan Privasi", terms: "Syarat Penggunaan", legal: "Pemberitahuan hukum", contact: "Kontak", cookies: "Pengaturan cookie" },
};

export default function Footer({ locale }: FooterProps) {
  const l = LABELS[locale] ?? LABELS.en;

  function resetCookieConsent() {
    localStorage.removeItem(STORAGE_KEY);
    // Reload so CookieBanner re-appears
    window.location.reload();
  }

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
          <nav className="flex items-center gap-5 text-xs text-gray-500 flex-wrap justify-center" dir={locale === "ar" ? "rtl" : undefined}>
            <Link href={`/${locale}/about`} className="hover:text-gray-300 transition-colors">
              {l.about}
            </Link>
            <Link href={`/${locale}/privacy`} className="hover:text-gray-300 transition-colors">
              {l.privacy}
            </Link>
            <Link href={`/${locale}/terms`} className="hover:text-gray-300 transition-colors">
              {l.terms}
            </Link>
            <Link href={`/${locale}/legal`} className="hover:text-gray-300 transition-colors">
              {l.legal}
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
            {/* Cookie settings — allows users to withdraw GDPR consent */}
            <button
              onClick={resetCookieConsent}
              className="hover:text-gray-300 transition-colors text-left"
            >
              {l.cookies}
            </button>
          </nav>

        </div>
      </div>
    </footer>
  );
}
