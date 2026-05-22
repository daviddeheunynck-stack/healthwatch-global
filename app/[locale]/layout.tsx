import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/i18n.routing";
import Navbar from "@/components/Navbar";
import "../globals.css";

export const metadata: Metadata = {
  title: "HealthWatch Global",
  description: "Real-time global health surveillance platform",
};

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  if (!routing.locales.includes(locale as any)) {
    notFound();
  }

  const messages = await getMessages();
  const isRTL = locale === "ar";

  return (
    <html lang={locale} dir={isRTL ? "rtl" : "ltr"}>
      <body className="bg-gray-950 text-gray-100 min-h-screen">
        <NextIntlClientProvider messages={messages}>
          <Navbar />
          <main className="max-w-7xl mx-auto px-4 py-8">{children}</main>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
