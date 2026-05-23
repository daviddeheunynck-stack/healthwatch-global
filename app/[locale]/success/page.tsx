import { getTranslations, getLocale } from "next-intl/server";
import { CheckCircle } from "lucide-react";
import Link from "next/link";

export default async function SuccessPage() {
  const locale = await getLocale();
  const t = await getTranslations("success");

  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="text-center space-y-6 max-w-md">
        <div className="flex justify-center">
          <CheckCircle className="w-20 h-20 text-green-400" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-white">{t("title")}</h1>
          <p className="text-gray-400 mt-2">{t("subtitle")}</p>
          <p className="text-gray-500 text-sm mt-1">{t("email")}</p>
        </div>
        <Link
          href={`/${locale}`}
          className="inline-block bg-red-600 hover:bg-red-500 text-white font-semibold px-8 py-3 rounded-lg transition-colors"
        >
          {t("cta")}
        </Link>
      </div>
    </div>
  );
}
