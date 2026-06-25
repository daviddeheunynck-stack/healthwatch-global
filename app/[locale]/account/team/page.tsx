import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import { createClient as createService } from "@supabase/supabase-js";
import Link from "next/link";
import { Users } from "lucide-react";
import TeamActions from "@/components/TeamActions";
import type { Metadata } from "next";

const BOM   = String.fromCharCode(65279);
const clean = (v: string | undefined) => (v || "").replace(new RegExp("^" + BOM), "").trim();

function getService() {
  return createService(
    clean(process.env.NEXT_PUBLIC_SUPABASE_URL),
    clean(process.env.SUPABASE_SERVICE_ROLE_KEY)
  );
}

const PAGE_META: Record<string, { title: string }> = {
  en: { title: "Team Management" },
  fr: { title: "Gestion de l'équipe" },
  es: { title: "Gestión del equipo" },
  ar: { title: "إدارة الفريق" },
  id: { title: "Manajemen Tim" },
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const m = PAGE_META[locale] ?? PAGE_META.en;
  return { title: m.title, robots: { index: false, follow: false } };
}

const L: Record<string, {
  title:        string;
  backAccount:  string;
  upgradeTitle: string;
  upgradeDesc:  string;
  upgradeBtn:   string;
  errorCreate:  string;
}> = {
  fr: {
    title:        "Gestion de l'équipe",
    backAccount:  "← Mon compte",
    upgradeTitle: "Fonctionnalité Team",
    upgradeDesc:  "Le plan Team inclut 5 sièges Pro sur une seule facture institutionnelle — idéal pour les équipes épidémiologiques.",
    upgradeBtn:   "Voir les tarifs →",
    errorCreate:  "Impossible de créer l'équipe. Rechargez la page.",
  },
  en: {
    title:        "Team Management",
    backAccount:  "← My account",
    upgradeTitle: "Team feature",
    upgradeDesc:  "The Team plan includes 5 Pro seats on a single institutional invoice — ideal for epidemiology teams.",
    upgradeBtn:   "See pricing →",
    errorCreate:  "Could not create team. Reload the page.",
  },
  es: {
    title:        "Gestión del equipo",
    backAccount:  "← Mi cuenta",
    upgradeTitle: "Función de equipo",
    upgradeDesc:  "El plan Team incluye 5 puestos Pro en una sola factura institucional — ideal para equipos de epidemiología.",
    upgradeBtn:   "Ver precios →",
    errorCreate:  "No se pudo crear el equipo. Recargue la página.",
  },
  ar: {
    title:        "إدارة الفريق",
    backAccount:  "→ حسابي",
    upgradeTitle: "ميزة الفريق",
    upgradeDesc:  "خطة Team تشمل 5 مقاعد Pro في فاتورة مؤسسية واحدة — مثالية لفرق علم الأوبئة.",
    upgradeBtn:   "← عرض الأسعار",
    errorCreate:  "تعذّر إنشاء الفريق. أعد تحميل الصفحة.",
  },
  id: {
    title:        "Manajemen Tim",
    backAccount:  "← Akun saya",
    upgradeTitle: "Fitur Tim",
    upgradeDesc:  "Paket Team mencakup 5 kursi Pro dalam satu faktur institusional — ideal untuk tim epidemiologi.",
    upgradeBtn:   "Lihat harga →",
    errorCreate:  "Tidak dapat membuat tim. Muat ulang halaman.",
  },
};

export default async function TeamPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const l     = L[locale] ?? L.en;
  const isRtl = locale === "ar";

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/login?next=/${locale}/account/team`);

  const service = getService();

  const { data: profile } = await service
    .from("profiles")
    .select("plan, team_id, email")
    .eq("id", user.id)
    .single();

  const plan   = profile?.plan || "free";
  let   teamId = profile?.team_id as string | null | undefined;

  // Not on team plan and no team membership → upgrade prompt
  if (plan !== "team" && !teamId) {
    return (
      <div className="max-w-2xl mx-auto space-y-6 py-4" dir={isRtl ? "rtl" : "ltr"}>
        <Link href={`/${locale}/account`} className="text-sm text-gray-500 hover:text-gray-300 transition-colors">
          {l.backAccount}
        </Link>
        <div className="bg-gray-900 border border-amber-600/20 rounded-2xl p-10 text-center space-y-5">
          <div className="w-14 h-14 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mx-auto">
            <Users className="w-7 h-7 text-amber-400" />
          </div>
          <h2 className="text-xl font-bold text-white">{l.upgradeTitle}</h2>
          <p className="text-gray-400 text-sm max-w-sm mx-auto leading-relaxed">{l.upgradeDesc}</p>
          <Link
            href={`/${locale}/pricing`}
            className="inline-flex items-center gap-2 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 font-semibold px-5 py-2.5 rounded-lg text-sm transition-colors"
          >
            {l.upgradeBtn}
          </Link>
        </div>
      </div>
    );
  }

  // Team plan owner with no team yet → auto-create
  if (plan === "team" && !teamId) {
    const email    = profile?.email || user.email || "";
    const domain   = email.split("@")[1];
    const teamName = domain || "My Team";

    const { data: newTeam, error: createErr } = await service
      .from("teams")
      .insert({ name: teamName, owner_id: user.id })
      .select("id")
      .single();

    if (createErr || !newTeam) {
      return (
        <div className="max-w-2xl mx-auto py-4" dir={isRtl ? "rtl" : "ltr"}>
          <Link href={`/${locale}/account`} className="text-sm text-gray-500 hover:text-gray-300 mb-4 inline-block">
            {l.backAccount}
          </Link>
          <p className="text-red-400 text-sm">{l.errorCreate}</p>
        </div>
      );
    }

    await Promise.all([
      service.from("team_members").insert({ team_id: newTeam.id, user_id: user.id, role: "owner" }),
      service.from("profiles").update({ team_id: newTeam.id }).eq("id", user.id),
    ]);

    teamId = newTeam.id;
  }

  if (!teamId) redirect(`/${locale}/account`);

  // Fetch team, members, and pending invites
  const [teamResult, membersResult, invitesResult] = await Promise.all([
    service
      .from("teams")
      .select("id, name, owner_id, max_seats, created_at")
      .eq("id", teamId!)
      .single(),
    service
      .from("team_members")
      .select("id, user_id, role, joined_at")
      .eq("team_id", teamId!)
      .order("joined_at"),
    service
      .from("team_invites")
      .select("id, email, created_at, expires_at")
      .eq("team_id", teamId!)
      .is("accepted_at", null)
      .gt("expires_at", new Date().toISOString())
      .order("created_at"),
  ]);

  const team    = teamResult.data;
  const invites = invitesResult.data ?? [];

  // Fetch member emails via profiles (two-step for reliability)
  const memberRows   = membersResult.data ?? [];
  const memberIds    = memberRows.map((m) => m.user_id);
  const { data: profilesData } = memberIds.length > 0
    ? await service.from("profiles").select("id, email").in("id", memberIds)
    : { data: [] };

  const profileMap = Object.fromEntries(
    (profilesData ?? []).map((p) => [p.id, p.email ?? ""])
  );

  const members = memberRows.map((m) => ({
    id:        m.id,
    user_id:   m.user_id,
    role:      m.role,
    joined_at: m.joined_at,
    email:     profileMap[m.user_id] ?? "",
  }));

  const isOwner = team?.owner_id === user.id;

  return (
    <div className="max-w-2xl mx-auto space-y-6 py-4" dir={isRtl ? "rtl" : "ltr"}>

      <Link href={`/${locale}/account`} className="text-sm text-gray-500 hover:text-gray-300 transition-colors">
        {l.backAccount}
      </Link>

      {/* Page header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
          <Users className="w-5 h-5 text-amber-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">{team?.name ?? l.title}</h1>
          <p className="text-sm text-gray-500">{l.title}</p>
        </div>
      </div>

      {team && (
        <TeamActions
          team={team}
          members={members}
          invites={invites}
          isOwner={isOwner}
          locale={locale}
          userId={user.id}
        />
      )}
    </div>
  );
}
