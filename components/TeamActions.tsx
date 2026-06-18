"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { UserPlus, Crown, Trash2, Clock, Loader2, CheckCircle2, AlertCircle } from "lucide-react";

export interface TeamMember {
  id: string;
  user_id: string;
  role: string;
  joined_at: string;
  email: string;
}

export interface TeamInvite {
  id: string;
  email: string;
  created_at: string;
  expires_at: string;
}

export interface Team {
  id: string;
  name: string;
  owner_id: string;
  max_seats: number;
}

interface Props {
  team:     Team;
  members:  TeamMember[];
  invites:  TeamInvite[];
  isOwner:  boolean;
  locale:   string;
  userId:   string;
}

const L: Record<string, {
  inviteTitle:   string;
  inviteDesc:    string;
  emailPh:       string;
  inviteBtn:     string;
  membersTitle:  string;
  pendingTitle:  string;
  ownerBadge:    string;
  memberBadge:   string;
  joinedOn:      string;
  expiresOn:     string;
  removeBtn:     string;
  revokeBtn:     string;
  removeConfirm: string;
  revokeConfirm: string;
  seats:         (used: number, max: number) => string;
  errGeneric:    string;
  okInvite:      string;
  okRemove:      string;
  okRevoke:      string;
}> = {
  fr: {
    inviteTitle:   "Inviter un membre",
    inviteDesc:    "L'invité recevra un email avec un lien valable 7 jours.",
    emailPh:       "email@institution.org",
    inviteBtn:     "Envoyer l'invitation",
    membersTitle:  "Membres actifs",
    pendingTitle:  "Invitations en attente",
    ownerBadge:    "Propriétaire",
    memberBadge:   "Membre",
    joinedOn:      "Rejoint le",
    expiresOn:     "Expire le",
    removeBtn:     "Retirer",
    revokeBtn:     "Révoquer",
    removeConfirm: "Retirer ce membre ? Son accès Team sera révoqué.",
    revokeConfirm: "Révoquer cette invitation ?",
    seats:         (u, m) => `${u} / ${m} sièges`,
    errGeneric:    "Erreur. Réessayez.",
    okInvite:      "Invitation envoyée.",
    okRemove:      "Membre retiré.",
    okRevoke:      "Invitation révoquée.",
  },
  en: {
    inviteTitle:   "Invite a member",
    inviteDesc:    "The invitee will receive an email with a link valid for 7 days.",
    emailPh:       "email@institution.org",
    inviteBtn:     "Send invitation",
    membersTitle:  "Active members",
    pendingTitle:  "Pending invitations",
    ownerBadge:    "Owner",
    memberBadge:   "Member",
    joinedOn:      "Joined",
    expiresOn:     "Expires",
    removeBtn:     "Remove",
    revokeBtn:     "Revoke",
    removeConfirm: "Remove this member? Their Team access will be revoked.",
    revokeConfirm: "Revoke this invitation?",
    seats:         (u, m) => `${u} / ${m} seats`,
    errGeneric:    "An error occurred. Try again.",
    okInvite:      "Invitation sent.",
    okRemove:      "Member removed.",
    okRevoke:      "Invitation revoked.",
  },
  es: {
    inviteTitle:   "Invitar un miembro",
    inviteDesc:    "El invitado recibirá un correo con un enlace válido por 7 días.",
    emailPh:       "email@institución.org",
    inviteBtn:     "Enviar invitación",
    membersTitle:  "Miembros activos",
    pendingTitle:  "Invitaciones pendientes",
    ownerBadge:    "Propietario",
    memberBadge:   "Miembro",
    joinedOn:      "Se unió el",
    expiresOn:     "Expira el",
    removeBtn:     "Eliminar",
    revokeBtn:     "Revocar",
    removeConfirm: "¿Eliminar este miembro? Se revocará su acceso Team.",
    revokeConfirm: "¿Revocar esta invitación?",
    seats:         (u, m) => `${u} / ${m} puestos`,
    errGeneric:    "Error. Inténtelo de nuevo.",
    okInvite:      "Invitación enviada.",
    okRemove:      "Miembro eliminado.",
    okRevoke:      "Invitación revocada.",
  },
  ar: {
    inviteTitle:   "دعوة عضو",
    inviteDesc:    "سيتلقى المدعو بريداً إلكترونياً برابط صالح لمدة 7 أيام.",
    emailPh:       "email@institution.org",
    inviteBtn:     "إرسال الدعوة",
    membersTitle:  "الأعضاء النشطون",
    pendingTitle:  "الدعوات المعلقة",
    ownerBadge:    "المالك",
    memberBadge:   "عضو",
    joinedOn:      "انضم في",
    expiresOn:     "تنتهي في",
    removeBtn:     "إزالة",
    revokeBtn:     "إلغاء",
    removeConfirm: "إزالة هذا العضو؟ سيُلغى وصوله إلى Team.",
    revokeConfirm: "إلغاء هذه الدعوة؟",
    seats:         (u, m) => `${u} / ${m} مقاعد`,
    errGeneric:    "حدث خطأ. يرجى المحاولة مجدداً.",
    okInvite:      "تم إرسال الدعوة.",
    okRemove:      "تم إزالة العضو.",
    okRevoke:      "تم إلغاء الدعوة.",
  },
  id: {
    inviteTitle:   "Undang anggota",
    inviteDesc:    "Orang yang diundang akan menerima email dengan tautan yang berlaku 7 hari.",
    emailPh:       "email@institusi.org",
    inviteBtn:     "Kirim undangan",
    membersTitle:  "Anggota aktif",
    pendingTitle:  "Undangan tertunda",
    ownerBadge:    "Pemilik",
    memberBadge:   "Anggota",
    joinedOn:      "Bergabung",
    expiresOn:     "Kedaluwarsa",
    removeBtn:     "Hapus",
    revokeBtn:     "Batalkan",
    removeConfirm: "Hapus anggota ini? Akses Team mereka akan dicabut.",
    revokeConfirm: "Batalkan undangan ini?",
    seats:         (u, m) => `${u} / ${m} kursi`,
    errGeneric:    "Terjadi kesalahan. Coba lagi.",
    okInvite:      "Undangan terkirim.",
    okRemove:      "Anggota dihapus.",
    okRevoke:      "Undangan dibatalkan.",
  },
};

function formatDate(iso: string, locale: string) {
  return new Date(iso).toLocaleDateString(locale === "ar" ? "ar-SA" : locale, {
    day: "numeric", month: "short", year: "numeric",
  });
}

type Flash = { type: "ok" | "err"; msg: string } | null;

export default function TeamActions({ team, members, invites, isOwner, locale, userId }: Props) {
  const router           = useRouter();
  const l                = L[locale] ?? L.en;
  const isRtl            = locale === "ar";
  const [email, setEmail]       = useState("");
  const [inviting, setInviting] = useState(false);
  const [flash, setFlash]       = useState<Flash>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const [revoking, setRevoking] = useState<string | null>(null);

  function showFlash(type: "ok" | "err", msg: string) {
    setFlash({ type, msg });
    setTimeout(() => setFlash(null), 4000);
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setInviting(true);
    try {
      const res = await fetch("/api/team/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), locale }),
      });
      const data = await res.json();
      if (!res.ok) { showFlash("err", data.error || l.errGeneric); return; }
      setEmail("");
      showFlash("ok", l.okInvite);
      router.refresh();
    } catch { showFlash("err", l.errGeneric); }
    finally { setInviting(false); }
  }

  async function handleRemove(memberId: string) {
    if (!confirm(l.removeConfirm)) return;
    setRemoving(memberId);
    try {
      const res = await fetch("/api/team/members", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: memberId }),
      });
      const data = await res.json();
      if (!res.ok) { showFlash("err", data.error || l.errGeneric); return; }
      showFlash("ok", l.okRemove);
      router.refresh();
    } catch { showFlash("err", l.errGeneric); }
    finally { setRemoving(null); }
  }

  async function handleRevoke(inviteId: string) {
    if (!confirm(l.revokeConfirm)) return;
    setRevoking(inviteId);
    try {
      const res = await fetch("/api/team/invite", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inviteId }),
      });
      const data = await res.json();
      if (!res.ok) { showFlash("err", data.error || l.errGeneric); return; }
      showFlash("ok", l.okRevoke);
      router.refresh();
    } catch { showFlash("err", l.errGeneric); }
    finally { setRevoking(null); }
  }

  const seatsUsed = members.length;

  return (
    <div dir={isRtl ? "rtl" : "ltr"} className="space-y-6">

      {/* Flash message */}
      {flash && (
        <div className={`flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium ${
          flash.type === "ok"
            ? "bg-green-500/10 border border-green-500/30 text-green-400"
            : "bg-red-500/10 border border-red-500/30 text-red-400"
        }`}>
          {flash.type === "ok"
            ? <CheckCircle2 className="w-4 h-4 shrink-0" />
            : <AlertCircle className="w-4 h-4 shrink-0" />}
          {flash.msg}
        </div>
      )}

      {/* Members */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
        <div className="px-6 py-4 flex items-center justify-between border-b border-gray-800">
          <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">
            {l.membersTitle}
          </h3>
          <span className="text-xs text-amber-400 font-medium bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-full">
            {l.seats(seatsUsed, team.max_seats)}
          </span>
        </div>
        <ul className="divide-y divide-gray-800/60">
          {members.map((m) => (
            <li key={m.id} className="flex items-center justify-between px-6 py-3 gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-full bg-amber-500/20 border border-amber-500/30 flex items-center justify-center shrink-0">
                  <span className="text-xs font-bold text-amber-300">
                    {(m.email || "?")[0].toUpperCase()}
                  </span>
                </div>
                <div className="min-w-0">
                  <p className="text-sm text-white truncate">{m.email}</p>
                  <p className="text-xs text-gray-500">{l.joinedOn} {formatDate(m.joined_at, locale)}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {m.role === "owner"
                  ? <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full">
                      <Crown className="w-3 h-3" />{l.ownerBadge}
                    </span>
                  : <span className="text-xs text-gray-500 border border-gray-700 px-2 py-0.5 rounded-full">{l.memberBadge}</span>
                }
                {isOwner && m.user_id !== userId && (
                  <button
                    onClick={() => handleRemove(m.user_id)}
                    disabled={removing === m.user_id}
                    className="p-1.5 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-40"
                    aria-label={l.removeBtn}
                  >
                    {removing === m.user_id
                      ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      : <Trash2 className="w-3.5 h-3.5" />}
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      </div>

      {/* Pending invites */}
      {isOwner && invites.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-800">
            <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wide flex items-center gap-2">
              <Clock className="w-4 h-4 text-gray-500" />
              {l.pendingTitle}
            </h3>
          </div>
          <ul className="divide-y divide-gray-800/60">
            {invites.map((inv) => (
              <li key={inv.id} className="flex items-center justify-between px-6 py-3 gap-3">
                <div className="min-w-0">
                  <p className="text-sm text-gray-300 truncate">{inv.email}</p>
                  <p className="text-xs text-gray-600">{l.expiresOn} {formatDate(inv.expires_at, locale)}</p>
                </div>
                <button
                  onClick={() => handleRevoke(inv.id)}
                  disabled={revoking === inv.id}
                  className="text-xs text-gray-500 hover:text-red-400 border border-gray-700 hover:border-red-800 px-2.5 py-1 rounded-lg transition-colors disabled:opacity-40 shrink-0"
                >
                  {revoking === inv.id
                    ? <Loader2 className="w-3.5 h-3.5 animate-spin inline" />
                    : l.revokeBtn}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Invite form — owner only, if seats available */}
      {isOwner && seatsUsed < team.max_seats && (
        <div className="bg-gray-900 border border-amber-600/20 rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-1">
            <UserPlus className="w-4 h-4 text-amber-400" />
            <h3 className="text-sm font-semibold text-amber-400/90">{l.inviteTitle}</h3>
          </div>
          <p className="text-sm text-gray-500 mb-4">{l.inviteDesc}</p>
          <form onSubmit={handleInvite} className="flex gap-2">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={l.emailPh}
              required
              className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-amber-500/50 transition-colors"
            />
            <button
              type="submit"
              disabled={inviting || !email.trim()}
              className="inline-flex items-center gap-2 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 font-semibold px-4 py-2.5 rounded-lg text-sm transition-colors disabled:opacity-40 whitespace-nowrap"
            >
              {inviting ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
              {l.inviteBtn}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
