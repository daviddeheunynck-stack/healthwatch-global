import { redirect } from "next/navigation";

export default async function ComingSoonPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  redirect(`/${locale}`);
}
