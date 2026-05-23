"use client";

import { useTranslations, useLocale } from "next-intl";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, Bell, FileText, Globe, CreditCard } from "lucide-react";

const LOCALES = [
  { code: "fr", label: "FR" },
  { code: "en", label: "EN" },
  { code: "es", label: "ES" },
  { code: "ar", label: "AR" },
  { code: "id", label: "ID" },
];

const VALID_LOCALES = ["fr", "en", "es", "ar", "id"];

export default function Navbar() {
  const t = useTranslations("nav");
  const locale = useLocale();
  const pathname = usePathname(); // e.g. /fr/alerts

  const switchLocale = (newLocale: string) => {
    const segments = pathname.split("/");
    // segments[0] = "", segments[1] = locale, segments[2+] = rest
    if (VALID_LOCALES.includes(segments[1])) {
      segments[1] = newLocale;
    } else {
      segments.splice(1, 0, newLocale);
    }
    window.location.href = segments.join("/") || "/";
  };

  const navLinks = [
    { href: `/${locale}`, label: t("dashboard"), icon: Activity },
    { href: `/${locale}/alerts`, label: t("alerts"), icon: Bell },
    { href: `/${locale}/reports`, label: t("reports"), icon: FileText },
    { href: `/${locale}/pricing`, label: t("pricing"), icon: CreditCard },
  ];

  return (
    <nav className="bg-gray-900 border-b border-gray-800 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 flex items-center justify-between h-16">
        <div className="flex items-center gap-2">
          <Activity className="text-red-500 w-6 h-6" />
          <span className="font-bold text-lg text-white">{t("title")}</span>
        </div>

        <div className="flex items-center gap-6">
          {navLinks.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-1.5 text-sm font-medium transition-colors ${
                pathname === href.replace(`/${locale}`, "") || (pathname === "/" && href === `/${locale}`)
                  ? "text-red-400"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <Globe className="w-4 h-4 text-gray-400" />
          {LOCALES.map((loc) => (
            <button
              key={loc.code}
              onClick={() => switchLocale(loc.code)}
              className={`text-xs px-2 py-1 rounded font-medium transition-colors ${
                locale === loc.code
                  ? "bg-red-600 text-white"
                  : "text-gray-400 hover:text-white hover:bg-gray-700"
              }`}
            >
              {loc.label}
            </button>
          ))}
        </div>
      </div>
    </nav>
  );
}
