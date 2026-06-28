import TravelRiskFullPage from "@/components/TravelRiskFullPage";

export default async function TravelRiskPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return <TravelRiskFullPage locale={locale} />;
}
