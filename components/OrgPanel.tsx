"use client";
import { useState } from "react";
import { ChevronDown, ChevronRight, Users, Mail, Link2, Trash2, UserCheck } from "lucide-react";

interface ActivityEntry {
  id: string;
  user_id: string;
  action: string;
  metadata: { user_email?: string; disease?: string; country?: string };
  created_at: string;
}

const ACTIVITY_COPY: Record<string, { title: string; noActivity: string; viewed: string }> = {
  fr: { title: "Activité récente", noActivity: "Aucune activité pour l'instant", viewed: "a consulté" },
  en: { title: "Recent activity",  noActivity: "No activity yet",               viewed: "viewed" },
  es: { title: "Actividad reciente", noActivity: "Sin actividad aún",           viewed: "consultó" },
  ar: { title: "النشاط الأخير",   noActivity: "لا يوجد نشاط بعد",             viewed: "اطّلع على" },
  id: { title: "Aktivitas terbaru", noActivity: "Belum ada aktivitas",          viewed: "melihat" },
};

function timeAgo(iso: string, locale: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60)  return { fr: "à l'instant", en: "just now", es: "ahora mismo", ar: "الآن", id: "baru saja" }[locale] ?? "just now";
  if (diff < 3600) {
    const m = Math.floor(diff / 60);
    return { fr: `il y a ${m} min`, en: `${m}m ago`, es: `hace ${m} min`, ar: `منذ ${m} دق`, id: `${m} mnt lalu` }[locale] ?? `${m}m ago`;
  }
  const h = Math.floor(diff / 3600);
  if (h < 24) return { fr: `il y a ${h}h`, en: `${h}h ago`, es: `hace ${h}h`, ar: `منذ ${h}س`, id: `${h}j lalu` }[locale] ?? `${h}h ago`;
  const d = Math.floor(h / 24);
  return { fr: `il y a ${d}j`, en: `${d}d ago`, es: `hace ${d}d`, ar: `منذ ${d}ي`, id: `${d}h lalu` }[locale] ?? `${d}d ago`;
}

interface OrgInfo { id: string; name: string; owner_id: string; created_at: string }
interface MemberInfo { id: string; invited_email: string; role: string; status: string; user_id: string | null; invite_token?: string; created_at: string }

const COPY: Record<string, {
  title: string; subtitle: string;
  planRequired: string; upgrade: string;
  createLabel: string; namePlaceholder: string; createBtn: string; creating: string;
  membersTitle: string; inviteLabel: string; invitePlaceholder: string; inviteBtn: string; inviting: string;
  remove: string; resend: string; leave: string;
  pending: string; active: string; noMembers: string;
  copyLink: string; copied: string; inviteSent: string;
  seatsOf: string;
}> = {
  fr: {
    title: "Organisation",
    subtitle: "Partagez investigations et alertes avec votre équipe.",
    planRequired: "Disponible sur les plans Team et Enterprise.",
    upgrade: "Mettre à niveau",
    createLabel: "Créer une organisation",
    namePlaceholder: "Institut Pasteur Paris",
    createBtn: "Créer",
    creating: "Création…",
    membersTitle: "Membres",
    inviteLabel: "Inviter un membre",
    invitePlaceholder: "email@organisation.org",
    inviteBtn: "Inviter",
    inviting: "Envoi…",
    remove: "Retirer",
    resend: "Renvoyer",
    leave: "Quitter l'organisation",
    pending: "En attente",
    active: "Actif",
    noMembers: "Aucun membre pour l'instant.",
    copyLink: "Copier le lien",
    copied: "Lien copié !",
    inviteSent: "Invitation envoyée",
    seatsOf: "sièges sur",
  },
  en: {
    title: "Organisation",
    subtitle: "Share investigations and alerts with your team.",
    planRequired: "Available on Team and Enterprise plans.",
    upgrade: "Upgrade",
    createLabel: "Create an organisation",
    namePlaceholder: "WHO Western Pacific Region",
    createBtn: "Create",
    creating: "Creating…",
    membersTitle: "Members",
    inviteLabel: "Invite a member",
    invitePlaceholder: "email@organisation.org",
    inviteBtn: "Invite",
    inviting: "Sending…",
    remove: "Remove",
    resend: "Resend",
    leave: "Leave organisation",
    pending: "Pending",
    active: "Active",
    noMembers: "No members yet.",
    copyLink: "Copy link",
    copied: "Link copied!",
    inviteSent: "Invitation sent",
    seatsOf: "seats of",
  },
  es: {
    title: "Organización",
    subtitle: "Comparte investigaciones y alertas con tu equipo.",
    planRequired: "Disponible en los planes Team y Enterprise.",
    upgrade: "Actualizar",
    createLabel: "Crear una organización",
    namePlaceholder: "OPS México",
    createBtn: "Crear",
    creating: "Creando…",
    membersTitle: "Miembros",
    inviteLabel: "Invitar a un miembro",
    invitePlaceholder: "email@organizacion.org",
    inviteBtn: "Invitar",
    inviting: "Enviando…",
    remove: "Eliminar",
    resend: "Reenviar",
    leave: "Salir de la organización",
    pending: "Pendiente",
    active: "Activo",
    noMembers: "Ningún miembro aún.",
    copyLink: "Copiar enlace",
    copied: "¡Enlace copiado!",
    inviteSent: "Invitación enviada",
    seatsOf: "plazas de",
  },
  ar: {
    title: "المنظمة",
    subtitle: "شارك التحقيقات والتنبيهات مع فريقك.",
    planRequired: "متاح في خطتَي Team وEnterprise.",
    upgrade: "ترقية",
    createLabel: "إنشاء منظمة",
    namePlaceholder: "منظمة الصحة العالمية",
    createBtn: "إنشاء",
    creating: "جارٍ الإنشاء…",
    membersTitle: "الأعضاء",
    inviteLabel: "دعوة عضو",
    invitePlaceholder: "email@organisation.org",
    inviteBtn: "دعوة",
    inviting: "إرسال…",
    remove: "إزالة",
    resend: "إعادة إرسال",
    leave: "مغادرة المنظمة",
    pending: "معلّق",
    active: "نشط",
    noMembers: "لا أعضاء بعد.",
    copyLink: "نسخ الرابط",
    copied: "تم نسخ الرابط!",
    inviteSent: "تم إرسال الدعوة",
    seatsOf: "مقاعد من",
  },
  id: {
    title: "Organisasi",
    subtitle: "Bagikan investigasi dan peringatan dengan tim Anda.",
    planRequired: "Tersedia di paket Team dan Enterprise.",
    upgrade: "Tingkatkan",
    createLabel: "Buat organisasi",
    namePlaceholder: "Kemenkes Indonesia",
    createBtn: "Buat",
    creating: "Membuat…",
    membersTitle: "Anggota",
    inviteLabel: "Undang anggota",
    invitePlaceholder: "email@organisasi.org",
    inviteBtn: "Undang",
    inviting: "Mengirim…",
    remove: "Hapus",
    resend: "Kirim ulang",
    leave: "Keluar dari organisasi",
    pending: "Menunggu",
    active: "Aktif",
    noMembers: "Belum ada anggota.",
    copyLink: "Salin tautan",
    copied: "Tautan disalin!",
    inviteSent: "Undangan terkirim",
    seatsOf: "kursi dari",
  },
};

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://healthwatch-global.com";

export default function OrgPanel({ locale }: { locale: string }) {
  const c = COPY[locale] ?? COPY.en;

  const [open, setOpen]         = useState(false);
  const [loaded, setLoaded]     = useState(false);
  const [org, setOrg]           = useState<OrgInfo | null>(null);
  const [role, setRole]         = useState<string | null>(null);
  const [plan, setPlan]         = useState("free");
  const [maxSeats, setMaxSeats] = useState(5);
  const [members, setMembers]   = useState<MemberInfo[]>([]);

  const [orgNameInput, setOrgNameInput] = useState("");
  const [creating, setCreating]         = useState(false);
  const [createErr, setCreateErr]       = useState("");

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviting, setInviting]       = useState(false);
  const [inviteErr, setInviteErr]     = useState("");
  const [inviteSent, setInviteSent]   = useState("");

  const [removing, setRemoving] = useState<Set<string>>(new Set());
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [activity, setActivity] = useState<ActivityEntry[]>([]);

  async function load() {
    if (loaded) return;
    const [res, actRes] = await Promise.all([fetch("/api/org"), fetch("/api/org/activity")]);
    const data    = await res.json() as { org: OrgInfo | null; role: string | null; plan: string; maxSeats: number; members: MemberInfo[] };
    const actData = await actRes.json() as { activity?: ActivityEntry[] };
    setOrg(data.org);
    setRole(data.role);
    setPlan(data.plan);
    setMaxSeats(data.maxSeats);
    setMembers(data.members);
    setActivity(actData.activity ?? []);
    setLoaded(true);
  }

  function toggle() {
    if (!open) load();
    setOpen((v) => !v);
  }

  async function createOrg() {
    setCreating(true); setCreateErr("");
    const res = await fetch("/api/org", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: orgNameInput }),
    });
    const data = await res.json() as { org?: OrgInfo; error?: string };
    if (data.org) {
      setOrg(data.org); setRole("owner"); setMembers([]);
    } else {
      setCreateErr(data.error ?? "Error");
    }
    setCreating(false);
  }

  async function inviteMember() {
    setInviting(true); setInviteErr(""); setInviteSent("");
    const res = await fetch("/api/org/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: inviteEmail, locale }),
    });
    const data = await res.json() as { member?: MemberInfo; inviteUrl?: string; error?: string };
    if (data.member) {
      setMembers((prev) => [...prev, data.member!]);
      setInviteEmail("");
      setInviteSent(inviteEmail);
    } else {
      setInviteErr(data.error ?? "Error");
    }
    setInviting(false);
  }

  async function removeMember(id: string) {
    setRemoving((prev) => new Set([...prev, id]));
    await fetch(`/api/org/members/${id}`, { method: "DELETE" });
    setMembers((prev) => prev.filter((m) => m.id !== id));
    setRemoving((prev) => { const s = new Set(prev); s.delete(id); return s; });
  }

  function copyInviteLink(member: MemberInfo) {
    if (!member.invite_token) return;
    const url = `${APP_URL}/${locale}/invite?token=${member.invite_token}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedId(member.id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  }

  const isTeamPlan = ["team", "enterprise"].includes(plan);
  const totalCount  = members.length;

  return (
    <div className="border border-gray-800 rounded-xl overflow-hidden bg-gray-900/50">
      {/* Header */}
      <button
        onClick={toggle}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-800/50 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <Users className="w-4 h-4 text-purple-400" />
          <span className="text-sm font-medium text-gray-200">{c.title}</span>
          {org && (
            <span className="text-xs text-gray-500">{org.name}</span>
          )}
        </div>
        {open ? <ChevronDown className="w-4 h-4 text-gray-500" /> : <ChevronRight className="w-4 h-4 text-gray-500" />}
      </button>

      {open && (
        <div className="border-t border-gray-800 p-4 space-y-4">
          <p className="text-xs text-gray-500">{c.subtitle}</p>

          {!loaded ? (
            <p className="text-xs text-gray-600 animate-pulse">…</p>
          ) : !org && !isTeamPlan ? (
            /* Not on a qualifying plan */
            <div className="rounded-lg bg-purple-950/30 border border-purple-800/30 p-3 text-xs text-purple-300 flex items-center justify-between gap-2">
              <span>{c.planRequired}</span>
              <a href={`/${locale}/pricing`} className="shrink-0 underline text-purple-400 hover:text-purple-300">{c.upgrade}</a>
            </div>
          ) : !org ? (
            /* No org yet — create form */
            <div className="space-y-2">
              <p className="text-xs font-medium text-gray-300">{c.createLabel}</p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={orgNameInput}
                  onChange={(e) => setOrgNameInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && orgNameInput.trim() && !creating && createOrg()}
                  placeholder={c.namePlaceholder}
                  maxLength={80}
                  className="flex-1 text-xs bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-gray-200 placeholder-gray-600 focus:outline-none focus:border-purple-500"
                />
                <button
                  onClick={createOrg}
                  disabled={!orgNameInput.trim() || creating}
                  className="px-3 py-2 text-xs bg-purple-700 hover:bg-purple-600 disabled:opacity-50 text-white rounded-lg transition-colors whitespace-nowrap"
                >
                  {creating ? c.creating : c.createBtn}
                </button>
              </div>
              {createErr && <p className="text-xs text-red-400">{createErr}</p>}
            </div>
          ) : (
            /* Has org */
            <div className="space-y-4">
              {/* Org name + seat count */}
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-white">{org.name}</span>
                {role === "owner" && (
                  <span className="text-xs text-gray-500">
                    {totalCount} {c.seatsOf} {maxSeats}
                  </span>
                )}
              </div>

              {/* Members list */}
              <div className="space-y-1">
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">{c.membersTitle}</p>
                {members.length === 0 ? (
                  <p className="text-xs text-gray-600 italic">{c.noMembers}</p>
                ) : (
                  <div className="space-y-1">
                    {members.map((m) => (
                      <div key={m.id} className="flex items-center justify-between gap-2 py-1.5 border-b border-gray-800/60 last:border-0">
                        <div className="flex items-center gap-2 min-w-0">
                          <UserCheck className={`w-3.5 h-3.5 shrink-0 ${m.status === "active" ? "text-green-400" : "text-yellow-500/70"}`} />
                          <span className="text-xs text-gray-300 truncate">{m.invited_email}</span>
                          <span className={`text-xs px-1.5 py-0.5 rounded font-medium shrink-0 ${m.status === "active" ? "bg-green-900/30 text-green-400 border border-green-700/30" : "bg-yellow-900/20 text-yellow-500 border border-yellow-700/20"}`}>
                            {m.status === "active" ? c.active : c.pending}
                          </span>
                        </div>
                        {role === "owner" && (
                          <div className="flex items-center gap-1 shrink-0">
                            {m.status === "pending" && (
                              <button
                                onClick={() => copyInviteLink(m)}
                                title={c.copyLink}
                                className="p-1 rounded hover:bg-gray-700 text-gray-500 hover:text-gray-300 transition-colors"
                              >
                                <Link2 className="w-3 h-3" />
                              </button>
                            )}
                            {copiedId === m.id && (
                              <span className="text-xs text-green-400">{c.copied}</span>
                            )}
                            <button
                              onClick={() => removeMember(m.id)}
                              disabled={removing.has(m.id)}
                              title={c.remove}
                              className="p-1 rounded hover:bg-red-900/30 text-gray-600 hover:text-red-400 disabled:opacity-40 transition-colors"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Invite form (owner only, if seats available) */}
              {role === "owner" && totalCount < maxSeats && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-gray-300">{c.inviteLabel}</p>
                  <div className="flex gap-2">
                    <input
                      type="email"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && inviteEmail.trim() && !inviting && inviteMember()}
                      placeholder={c.invitePlaceholder}
                      className="flex-1 text-xs bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-gray-200 placeholder-gray-600 focus:outline-none focus:border-purple-500"
                    />
                    <button
                      onClick={inviteMember}
                      disabled={!inviteEmail.trim() || inviting}
                      className="px-3 py-2 text-xs bg-purple-700 hover:bg-purple-600 disabled:opacity-50 text-white rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap"
                    >
                      <Mail className="w-3 h-3" />
                      {inviting ? c.inviting : c.inviteBtn}
                    </button>
                  </div>
                  {inviteSent && <p className="text-xs text-green-400">{c.inviteSent}: {inviteSent}</p>}
                  {inviteErr && <p className="text-xs text-red-400">{inviteErr}</p>}
                </div>
              )}

              {/* Full (owner) */}
              {role === "owner" && totalCount >= maxSeats && (
                <p className="text-xs text-gray-500 italic">{totalCount}/{maxSeats} — {plan === "team" ? "Enterprise plan unlocks 50 seats." : "Seat limit reached."}</p>
              )}

              {/* Activity log */}
              {activity.length > 0 && (() => {
                const ac = ACTIVITY_COPY[locale] ?? ACTIVITY_COPY.en;
                return (
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">{ac.title}</p>
                    <div className="space-y-1">
                      {activity.slice(0, 10).map((a) => {
                        const email   = a.metadata.user_email ?? "—";
                        const name    = email.split("@")[0];
                        const disease = a.metadata.disease ?? "";
                        const country = a.metadata.country ?? "";
                        return (
                          <div key={a.id} className="flex items-start justify-between gap-2 text-[10px] py-1 border-b border-gray-800/40 last:border-0">
                            <span className="text-gray-400 min-w-0">
                              <span className="text-gray-300 font-medium">{name}</span>
                              {" "}{ac.viewed}{" "}
                              <span className="text-gray-300">{disease}{country ? ` — ${country}` : ""}</span>
                            </span>
                            <span className="text-gray-600 shrink-0 whitespace-nowrap">{timeAgo(a.created_at, locale)}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
