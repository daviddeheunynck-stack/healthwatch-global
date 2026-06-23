import { createClient } from "@/lib/supabase-server";
import AcceptInviteButton from "@/components/AcceptInviteButton";
import Link from "next/link";

export const dynamic = "force-dynamic";

const COPY: Record<string, {
  title: string; invitedTo: string; login: string; loginCTA: string; invalid: string; already: string;
}> = {
  fr: {
    title: "Invitation HealthWatch Global",
    invitedTo: "Vous êtes invité à rejoindre",
    login: "Connectez-vous pour accepter cette invitation.",
    loginCTA: "Se connecter",
    invalid: "Ce lien d'invitation est invalide ou a déjà été utilisé.",
    already: "Vous êtes déjà membre de cette organisation.",
  },
  en: {
    title: "HealthWatch Global Invitation",
    invitedTo: "You have been invited to join",
    login: "Log in to accept this invitation.",
    loginCTA: "Log in",
    invalid: "This invitation link is invalid or has already been used.",
    already: "You are already a member of this organisation.",
  },
  es: {
    title: "Invitación HealthWatch Global",
    invitedTo: "Has sido invitado a unirte a",
    login: "Inicia sesión para aceptar esta invitación.",
    loginCTA: "Iniciar sesión",
    invalid: "Este enlace de invitación no es válido o ya fue usado.",
    already: "Ya eres miembro de esta organización.",
  },
  ar: {
    title: "دعوة HealthWatch Global",
    invitedTo: "لقد دُعيت للانضمام إلى",
    login: "سجّل الدخول لقبول هذه الدعوة.",
    loginCTA: "تسجيل الدخول",
    invalid: "رابط الدعوة غير صالح أو استُخدم بالفعل.",
    already: "أنت بالفعل عضو في هذه المنظمة.",
  },
  id: {
    title: "Undangan HealthWatch Global",
    invitedTo: "Anda diundang bergabung dengan",
    login: "Masuk untuk menerima undangan ini.",
    loginCTA: "Masuk",
    invalid: "Tautan undangan ini tidak valid atau sudah digunakan.",
    already: "Anda sudah menjadi anggota organisasi ini.",
  },
};

export default async function InvitePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  const sp = searchParams ? await searchParams : {};
  const token = typeof sp.token === "string" ? sp.token : "";
  const c = COPY[locale] ?? COPY.en;

  // Fetch org info for this token
  let orgName: string | null = null;
  if (token) {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/api/org/accept-invite?token=${token}`,
      { cache: "no-store" }
    );
    const j = await res.json() as { org?: { name: string } | null };
    orgName = j.org?.name ?? null;
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <main className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-gray-900 border border-gray-800 rounded-2xl p-8 space-y-6">
        <p className="text-xs text-gray-500 uppercase tracking-widest font-medium">HEALTHWATCH GLOBAL</p>
        <h1 className="text-xl font-bold text-white">{c.title}</h1>

        {!token || !orgName ? (
          <p className="text-red-400">{c.invalid}</p>
        ) : (
          <>
            <p className="text-gray-300">
              {c.invitedTo}{" "}
              <span className="font-semibold text-white">{orgName}</span>.
            </p>
            {!user ? (
              <div className="space-y-3">
                <p className="text-gray-400 text-sm">{c.login}</p>
                <Link
                  href={`/${locale}/login?next=${encodeURIComponent(`/${locale}/invite?token=${token}`)}`}
                  className="block w-full text-center px-6 py-3 bg-red-600 hover:bg-red-500 text-white font-semibold rounded-lg transition-colors"
                >
                  {c.loginCTA}
                </Link>
              </div>
            ) : (
              <AcceptInviteButton token={token} locale={locale} />
            )}
          </>
        )}
      </div>
    </main>
  );
}
