import { getRequestConfig } from "next-intl/server";
import { routing } from "./i18n.routing";

export default getRequestConfig(async ({ requestLocale }) => {
  let locale = await requestLocale;
  // Same widen-the-array idiom as app/[locale]/layout.tsx — `locale` here is
  // `string | undefined`, wider than the `routing.locales` literal-tuple type.
  if (!locale || !(routing.locales as readonly string[]).includes(locale)) {
    locale = routing.defaultLocale;
  }
  return {
    locale,
    messages: (await import(`./messages/${locale}.json`)).default,
  };
});
