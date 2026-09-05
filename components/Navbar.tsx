"use client";

import React from "react";
import { useTranslations, useLocale } from "next-intl";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Activity, Globe, LogOut, Menu, X, Settings } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase-browser";
import type { User as SupabaseUser } from "@supabase/supabase-js";
import * as Sentry from "@sentry/nextjs";
import NotificationBell from "@/components/NotificationBell";
import GlobalSearch from "@/components/GlobalSearch";

const LOCALES = [
  { code: "fr", label: "FR" },
  { code: "en", label: "EN" },
  { code: "es", label: "ES" },
  { code: "ar", label: "AR" },
  { code: "id", label: "ID" },
];

const VALID_LOCALES = ["fr", "en", "es", "ar", "id"];

const ABOUT_LABEL: Record<string, string> = {
  fr: "À propos", en: "About", es: "Acerca de", ar: "حول المنصة", id: "Tentang",
};

const PLAN_BADGE: Record<string, string> = {
  free: "bg-gray-700 text-gray-300",
  starter: "bg-blue-900 text-blue-300",
  pro: "bg-amber-900 text-amber-300",
  team: "bg-emerald-900 text-emerald-300",
  enterprise: "bg-purple-900 text-purple-300",
};

export default function Navbar() {
  const t = useTranslations("nav");
  const tAuth = useTranslations("auth");
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [plan, setPlan] = useState<string>("free");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [localeDropOpen, setLocaleDropOpen] = useState(false);
  const localeDropRef = useRef<HTMLDivElement>(null);
  const desktopLocaleDropRef = useRef<HTMLDivElement>(null);

  // Close the mobile menu on route change. Adjusting state *while rendering* —
  // comparing against the last-seen pathname and calling setState immediately
  // when it differs — is React's documented replacement for
  // `useEffect(() => setMobileOpen(false), [pathname])`: React detects the
  // mismatch and re-renders right away, before the browser paints, so there's
  // no flash of the still-open menu and no synchronous setState inside an
  // effect (which is what react-hooks/set-state-in-effect was flagging here).
  // https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes
  const [prevPathname, setPrevPathname] = useState(pathname);
  if (pathname !== prevPathname) {
    setPrevPathname(pathname);
    setMobileOpen(false);
  }

  useEffect(() => {
    if (!localeDropOpen) return;
    function handleOutside(e: MouseEvent) {
      const target = e.target as Node;
      const insideMobile = localeDropRef.current?.contains(target) ?? false;
      const insideDesktop = desktopLocaleDropRef.current?.contains(target) ?? false;
      if (!insideMobile && !insideDesktop) {
        setLocaleDropOpen(false);
      }
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [localeDropOpen]);

  async function fetchPlan(userId: string, supabase: ReturnType<typeof createClient>) {
    const { data } = await supabase
      .from("profiles")
      .select("plan, trial_ends_at, stripe_subscription_id")
      .eq("id", userId)
      .single();
    let p = data?.plan ?? "free";
    if (
      p !== "free" &&
      data?.trial_ends_at &&
      new Date(data.trial_ends_at).getTime() < Date.now() &&
      !data?.stripe_subscription_id
    ) {
      p = "free";
    }
    setPlan(p);
  }

  useEffect(() => {
    const supabase = createClient();

    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
      if (user) {
        Sentry.setUser({ id: user.id, email: user.email });
        fetchPlan(user.id, supabase);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        Sentry.setUser({ id: session.user.id, email: session.user.email });
        fetchPlan(session.user.id, supabase);
      } else {
        Sentry.setUser(null);
        setPlan("free");
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleLogout = async () => {
    // Best-effort: release this device's push subscription before signing
    // out — see the same comment in SignOutButton.tsx. Without it, a shared
    // device's next user silently takes over this user's push subscription.
    try {
      const reg = await navigator.serviceWorker?.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/push/unsubscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        }).catch(() => {});
        await sub.unsubscribe().catch(() => {});
      }
    } catch { /* best-effort only */ }

    const supabase = createClient();
    await supabase.auth.signOut();
    setMobileOpen(false);
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
    // eslint-disable-next-line react-hooks/immutability
    window.location.href = (segments.join("/") || "/") + window.location.search;
  };

  const navLinks: { href: string; label: string; icon: React.ElementType | null }[] = [
    { href: `/${locale}`,           label: t("dashboard"), icon: null },
    // Moved up from 8th of 9 to 2nd, 2026-09-06 (David) — pricing needs to be
    // seen, not found at the end of a long row after every feature link.
    { href: `/${locale}/pricing`, label: t("pricing"),   icon: null },
    { href: `/${locale}/diseases`,  label: t("diseases"),  icon: null },
    { href: `/${locale}/countries`,   label: t("countries"), icon: null },
    { href: `/${locale}/travel-risk`, label: t("travel"),   icon: null },
    { href: `/${locale}/alerts`,      label: t("alerts"),   icon: null },
    { href: `/${locale}/compare`, label: t("compare"),   icon: null },
    { href: `/${locale}/reports`, label: t("reports"),   icon: null },
    { href: `/${locale}/about`,   label: ABOUT_LABEL[locale] ?? "About", icon: null },
    ...(["pro", "team", "enterprise"].includes(plan ?? "")
      ? [{ href: `/${locale}/docs`, label: "API Docs", icon: null }]
      : []),
  ];

  return (
    <nav className="bg-gray-900 border-b border-gray-800 sticky top-0 z-50">
      {/* Main row */}
      <div className="max-w-7xl mx-auto px-4 flex items-center justify-between h-16">

        {/* Logo */}
        <Link href={`/${locale}`} className="flex items-center gap-2 shrink-0">
          <Activity className="text-red-500 w-6 h-6" />
          <span className="font-bold text-lg text-white">{t("title")}</span>
        </Link>

        {/* Desktop: nav links */}
        <div className="hidden xl:flex items-center gap-1">
          {navLinks.map(({ href, label, icon: Icon }) => {
            const isPricingUpsell = plan === "free" && href === `/${locale}/pricing`;
            return (
              <Link
                key={href}
                href={href}
                className={`relative flex items-center gap-1.5 text-sm font-medium transition-colors whitespace-nowrap px-1.5 py-1.5 rounded-md ${
                  isPricingUpsell
                    ? "text-red-400 hover:text-red-300 bg-red-950/40 hover:bg-red-950/60"
                    : pathname === href
                    ? "text-white bg-gray-800"
                    : "text-gray-400 hover:text-white hover:bg-gray-800/60"
                }`}
              >
                {Icon && <Icon className="w-4 h-4" />}
                {label}
                {pathname === href && !isPricingUpsell && (
                  <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-red-500 rounded-full" />
                )}
              </Link>
            );
          })}
        </div>

        {/* Desktop: locale + auth */}
        <div className="hidden xl:flex items-center gap-3">
          <GlobalSearch />
          <div ref={desktopLocaleDropRef} className="relative">
            <button
              onClick={() => setLocaleDropOpen(!localeDropOpen)}
              className={`flex items-center gap-1 text-xs font-semibold px-2 py-1.5 rounded-lg border transition-colors ${
                localeDropOpen
                  ? "border-gray-600 text-white bg-gray-800"
                  : "border-gray-700 text-gray-300 hover:text-white hover:bg-gray-800/60"
              }`}
            >
              <Globe className="w-4 h-4" />
              {locale.toUpperCase()}
            </button>
            {localeDropOpen && (
              <div className="absolute right-0 top-10 bg-gray-900 border border-gray-700 rounded-xl p-2 flex gap-1.5 z-50 shadow-xl">
                {LOCALES.map((loc) => (
                  <button
                    key={loc.code}
                    onClick={() => { switchLocale(loc.code); setLocaleDropOpen(false); }}
                    className={`text-xs px-2.5 py-1.5 rounded-lg font-semibold transition-colors ${
                      locale === loc.code
                        ? "bg-red-600 text-white"
                        : "text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700"
                    }`}
                  >
                    {loc.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="border-l border-gray-700 pl-3">
            {user ? (
              <div className="flex items-center gap-2">
                <Link
                  href={plan === "free" ? `/${locale}/pricing` : `/${locale}/account`}
                  className={`text-xs px-2 py-1 rounded font-semibold ${PLAN_BADGE[plan] || PLAN_BADGE.free}`}
                >
                  {tAuth(`plan.${plan}`)}
                </Link>
                <Link
                  href={`/${locale}/settings`}
                  className="text-gray-400 hover:text-gray-200 transition-colors"
                  title="Settings"
                >
                  <Settings className="w-4 h-4" />
                </Link>
                <NotificationBell locale={locale} />
                <button
                  onClick={handleLogout}
                  className="text-gray-400 hover:text-red-400 transition-colors"
                  title={tAuth("logout")}
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  href={`/${locale}/login`}
                  className="text-sm text-gray-400 hover:text-white transition-colors px-2 py-1"
                >
                  {tAuth("login")}
                </Link>
                <Link
                  href={`/${locale}/pilot`}
                  className="text-sm text-amber-400 hover:text-amber-300 border border-amber-500/30 hover:border-amber-400/60 font-semibold px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap"
                >
                  {locale === "fr" ? "Pilote →" : locale === "es" ? "Piloto →" : locale === "ar" ? "← تجريبي" : locale === "id" ? "Pilot →" : "Pilot →"}
                </Link>
                <Link
                  href={`/${locale}/signup`}
                  className="text-sm bg-red-600 hover:bg-red-500 text-white font-semibold px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap"
                >
                  {tAuth("signup")}
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Mobile: auth badge + search + hamburger */}
        <div className="flex xl:hidden items-center gap-3">
          {user && (
            <Link href={`/${locale}/account`} className={`text-xs px-2 py-0.5 rounded font-semibold ${PLAN_BADGE[plan] || PLAN_BADGE.free}`}>
              {tAuth(`plan.${plan}`)}
            </Link>
          )}
          <GlobalSearch />
          {/* Locale quick-switcher — visible without opening the hamburger */}
          <div ref={localeDropRef} className="relative">
            <button
              onClick={() => { setLocaleDropOpen(!localeDropOpen); setMobileOpen(false); }}
              className={`transition-colors p-1 ${localeDropOpen ? "text-white" : "text-gray-400 hover:text-white"}`}
              aria-label="Change language"
            >
              <Globe className="w-5 h-5" />
            </button>
            {localeDropOpen && (
              <div className="absolute right-0 top-8 bg-gray-900 border border-gray-700 rounded-xl p-2 flex gap-1.5 z-50 shadow-xl">
                {LOCALES.map((loc) => (
                  <button
                    key={loc.code}
                    onClick={() => { switchLocale(loc.code); setLocaleDropOpen(false); }}
                    className={`text-xs px-2.5 py-1.5 rounded-lg font-semibold transition-colors ${
                      locale === loc.code
                        ? "bg-red-600 text-white"
                        : "text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700"
                    }`}
                  >
                    {loc.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button
            onClick={() => { setMobileOpen(!mobileOpen); setLocaleDropOpen(false); }}
            className="text-gray-400 hover:text-white transition-colors p-1"
            aria-label="Menu"
          >
            {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile dropdown menu */}
      {mobileOpen && (
        <div className="xl:hidden border-t border-gray-800 bg-gray-900 px-4 py-4 space-y-4">

          {/* Nav links */}
          <div className="space-y-1">
            {navLinks.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  pathname === href
                    ? "bg-gray-800 text-red-400"
                    : "text-gray-400 hover:text-white hover:bg-gray-800"
                }`}
              >
                {Icon && <Icon className="w-4 h-4" />}
                {label}
              </Link>
            ))}
          </div>

          {/* Locale switcher */}
          <div className="border-t border-gray-800 pt-3">
            <div className="flex items-center gap-2 flex-wrap">
              <Globe className="w-4 h-4 text-gray-500" />
              {LOCALES.map((loc) => (
                <button
                  key={loc.code}
                  onClick={() => switchLocale(loc.code)}
                  className={`text-xs px-3 py-1.5 rounded font-medium transition-colors ${
                    locale === loc.code
                      ? "bg-red-600 text-white"
                      : "text-gray-400 hover:text-white bg-gray-800"
                  }`}
                >
                  {loc.label}
                </button>
              ))}
            </div>
          </div>

          {/* Auth */}
          <div className="border-t border-gray-800 pt-3">
            {user ? (
              <div className="space-y-3">
                {plan === "free" && (
                  <Link
                    href={`/${locale}/pricing`}
                    className="flex items-center justify-center gap-2 w-full py-2.5 text-sm font-semibold text-white bg-red-600 hover:bg-red-500 rounded-lg transition-colors"
                    onClick={() => setMobileOpen(false)}
                  >
                    {locale === "fr" ? "Passer à Pro — essai gratuit →" :
                     locale === "es" ? "Actualizar a Pro — prueba gratis →" :
                     locale === "ar" ? "← ترقية إلى Pro مجاناً" :
                     locale === "id" ? "Upgrade ke Pro — coba gratis →" :
                     "Upgrade to Pro — free trial →"}
                  </Link>
                )}
                <div className="flex items-center justify-end gap-2">
                  <NotificationBell locale={locale} dropUp />
                  <button
                    onClick={handleLogout}
                    className="flex items-center gap-2 text-sm text-gray-400 hover:text-red-400 transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                    {tAuth("logout")}
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <Link
                  href={`/${locale}/pilot`}
                  className="block w-full text-center py-2.5 text-sm font-semibold text-amber-400 border border-amber-500/30 rounded-lg hover:border-amber-400/60 transition-colors"
                  onClick={() => setMobileOpen(false)}
                >
                  {locale === "fr" ? "Programme pilote institutionnel →" : locale === "es" ? "Programa piloto institucional →" : locale === "ar" ? "← البرنامج التجريبي المؤسسي" : locale === "id" ? "Program pilot institusional →" : "Institutional pilot program →"}
                </Link>
                <div className="flex gap-3">
                  <Link
                    href={`/${locale}/login`}
                    className="flex-1 text-center py-2 text-sm text-gray-400 hover:text-white bg-gray-800 rounded-lg transition-colors"
                  >
                    {tAuth("login")}
                  </Link>
                  <Link
                    href={`/${locale}/signup`}
                    className="flex-1 text-center py-2 text-sm text-white bg-red-600 hover:bg-red-500 rounded-lg transition-colors"
                  >
                    {tAuth("signup")}
                  </Link>
                </div>
              </div>
            )}
          </div>

        </div>
      )}
    </nav>
  );
}
