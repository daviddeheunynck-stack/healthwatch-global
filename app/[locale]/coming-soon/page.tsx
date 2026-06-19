import ComingSoonClient from "./ComingSoonClient";

export default async function ComingSoonPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return <ComingSoonClient locale={locale} />;
}
