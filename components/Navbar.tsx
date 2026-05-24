"use client";

import { useTranslations, useLocale } from "next-intl";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Activity, Bell, FileText, Globe, CreditCard, LogOut, User } from "lucide-react";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase-browser";
import type { User as SupabaseUser } from "@supabase/supabase-js";

const LOCALES = [
  { code: "fr", label: "FR" },
  { code: "en", label: "EN" },
  { code: "es", label: "ES" },
  { code: "ar", label: "AR" },
  { code: "id", label: "ID" },
];

const VALID_LOCALES = ["fr", "en", "es", "ar", "id"];

const PLAN_BADGE: Record<string, string> = {
  free: "bg-gray-700 text-gray-300",
  starter: "bg-blue-900 text-blue-300",
  pro: "bg-amber-900 text-amber-300",
};

export default function Navbar() {
  const t = useTranslations("nav");
  const tAuth = useTranslations("auth");
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [plan, setPlan] = useState<string>("free");

  useEffect(() => {
    const supabase = createClient();

    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
      if (user) fetchPlan(user.id, supabase);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) fetchPlan(session.user.id, supabase);
      else setPlan("free");
    });

    return () => subscription.unsubscribe();
  }, []);

  async function fetchPlan(userId: string, supabase: ReturnType<typeof createClient>) {
    const { data } = await supabase
      .from("profiles")
      .select("plan")
      .eq("id", userId)
      .single();
    if (data?.plan) setPlan(data.plan);
  }

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push(`/${locale}`);
    router.refresh();
  };

  const switchLocale = (newLocale: string) => {
    const segments = pathname.split("/");
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

        {/* Logo */}
        <div className="flex items-center gap-2 shrink-0">
          <Activity className="text-red-500 w-6 h-6" />
          <span className="font-bold text-lg text-white">{t("title")}</span>
        </div>

        {/* Nav links */}
        <div className="flex items-center gap-5">
          {navLinks.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-1.5 text-sm font-medium transition-colors ${
                pathname === href ? "text-red-400" : "text-gray-400 hover:text-white"
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </Link>
          ))}
        </div>

        {/* Right side */}
        <div className="flex items-center gap-3">
          {/* Locale switcher */}
          <div className="flex items-center gap-1">
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

          {/* Auth */}
          <div className="border-l border-gray-700 pl-3">
            {user ? (
              <div className="flex items-center gap-2">
                <span className={`text-xs px-2 py-1 rounded font-semibold ${PLAN_BADGE[plan] || PLAN_BADGE.free}`}>
                  {tAuth(`plan.${plan}`)}
                </span>
                <span className="text-xs text-gray-400 hidden lg:block max-w-32 truncate">
                  {user.email}
                </span>
                <button
                  onClick={handleLogout}
                  className="text-gray-400 hover:text-red-400 transition-colors"
                  title={tAuth("logout")}
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <Link
                href={`/${locale}/login`}
                className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-white transition-colors"
              >
                <User className="w-4 h-4" />
                {tAuth("login")}
              </Link>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
