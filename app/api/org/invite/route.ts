import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { randomBytes } from "crypto";
import { Resend } from "resend";

export const dynamic = "force-dynamic";

const BOM   = String.fromCharCode(65279);
const clean = (v: string | undefined) => (v || "").replace(new RegExp("^" + BOM), "").trim();

const RESEND_KEY = clean(process.env.RESEND_API_KEY);
const APP_URL    = clean(process.env.NEXT_PUBLIC_APP_URL) || "https://healthwatch-global.com";
const MAX_SEATS: Record<string, number> = { team: 5, enterprise: 50 };

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
const TEAM_PLANS = ["team", "enterprise"];

function resolvedPlan(profile: { plan?: string | null; trial_ends_at?: string | null; stripe_subscription_id?: string | null } | null): string {
  const plan = profile?.plan ?? "free";
  if (plan !== "free" && profile?.trial_ends_at && new Date(profile.trial_ends_at).getTime() < Date.now() && !profile?.stripe_subscription_id) return "free";
  return plan;
}

const INVITE_SUBJECT: Record<string, (org: string) => string> = {
  fr: (org) => `Invitation à rejoindre ${org} sur HealthWatch Global`,
  en: (org) => `You're invited to join ${org} on HealthWatch Global`,
  es: (org) => `Te invitan a unirte a ${org} en HealthWatch Global`,
  ar: (org) => `دعوة للانضمام إلى ${org} على HealthWatch Global`,
  id: (org) => `Anda diundang bergabung dengan ${org} di HealthWatch Global`,
};

function buildInviteEmail(orgName: string, inviteUrl: string, locale: string): string {
  const subject = (INVITE_SUBJECT[locale] ?? INVITE_SUBJECT.en)(orgName);
  const safeOrgName = esc(orgName);
  const body = {
    fr: `Vous avez été invité à rejoindre l'organisation <strong>${safeOrgName}</strong> sur HealthWatch Global.`,
    en: `You have been invited to join <strong>${safeOrgName}</strong> on HealthWatch Global.`,
    es: `Has sido invitado a unirte a <strong>${safeOrgName}</strong> en HealthWatch Global.`,
    ar: `لقد تمت دعوتك للانضمام إلى <strong>${safeOrgName}</strong> على HealthWatch Global.`,
    id: `Anda telah diundang untuk bergabung dengan <strong>${safeOrgName}</strong> di HealthWatch Global.`,
  }[locale] ?? `You have been invited to join <strong>${safeOrgName}</strong> on HealthWatch Global.`;

  const cta = { fr: "Accepter l'invitation", en: "Accept invitation", es: "Aceptar invitación", ar: "قبول الدعوة", id: "Terima undangan" }[locale] ?? "Accept invitation";

  const isRtl = locale === "ar";
  return `<!DOCTYPE html><html lang="${locale}" dir="${isRtl ? "rtl" : "ltr"}"><head><meta charset="utf-8"/></head>
<body style="margin:0;padding:0;background:#111827;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#f9fafb;direction:${isRtl ? "rtl" : "ltr"}">
  <div style="max-width:480px;margin:0 auto;padding:40px 20px;text-align:${isRtl ? "right" : "left"}">
    <p style="margin:0 0 4px;font-size:11px;color:#6b7280;letter-spacing:0.1em;text-transform:uppercase">HEALTHWATCH GLOBAL</p>
    <h1 style="margin:0 0 16px;font-size:20px;font-weight:700">${esc(subject)}</h1>
    <p style="margin:0 0 24px;font-size:14px;color:#d1d5db">${body}</p>
    <a href="${inviteUrl}" style="display:inline-block;padding:12px 24px;background:#dc2626;color:#fff;font-weight:600;font-size:14px;text-decoration:none;border-radius:8px">${cta}</a>
    <p style="margin:32px 0 0;font-size:11px;color:#6b7280">Powered by <strong style="color:#9ca3af">HealthWatch Global</strong> · <a href="${APP_URL}" style="color:#6b7280">${APP_URL.replace("https://", "")}</a></p>
  </div>
</body></html>`;
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles").select("plan, trial_ends_at, stripe_subscription_id").eq("id", user.id).single();
  if (!TEAM_PLANS.includes(resolvedPlan(profile)))
    return NextResponse.json({ error: "Team or Enterprise plan required" }, { status: 403 });

  // Must be org owner
  const { data: org } = await supabase
    .from("organizations").select("id, name").eq("owner_id", user.id).maybeSingle();
  if (!org) return NextResponse.json({ error: "No organization found" }, { status: 404 });

  const plan = resolvedPlan(profile);
  const maxSeats = MAX_SEATS[plan] ?? 5;

  const body = await req.json() as { email?: string; locale?: string };
  const email = (body.email ?? "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return NextResponse.json({ error: "Invalid email" }, { status: 400 });

  // Check seat count
  const { count } = await supabase
    .from("organization_members")
    .select("id", { count: "exact", head: true })
    .eq("org_id", org.id)
    .in("status", ["pending", "active"]);

  if ((count ?? 0) >= maxSeats)
    return NextResponse.json({ error: `Seat limit reached (${maxSeats})` }, { status: 422 });

  // Already invited?
  const { data: existing } = await supabase
    .from("organization_members")
    .select("id, status").eq("org_id", org.id).eq("invited_email", email).maybeSingle();
  if (existing)
    return NextResponse.json({ error: "Already invited or member" }, { status: 409 });

  const invite_token = randomBytes(24).toString("hex");
  const locale = body.locale ?? "en";
  const inviteUrl = `${APP_URL}/${locale}/invite?token=${invite_token}`;

  const { data: member, error } = await supabase
    .from("organization_members")
    .insert({ org_id: org.id, invited_email: email, role: "member", status: "pending", invite_token })
    .select("id, invited_email, role, status, created_at").single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Send invite email
  if (RESEND_KEY) {
    const resend = new Resend(RESEND_KEY);
    await resend.emails.send({
      from: "HealthWatch Global <alerts@healthwatch-global.com>",
      to: [email],
      subject: (INVITE_SUBJECT[locale] ?? INVITE_SUBJECT.en)(org.name),
      html: buildInviteEmail(org.name, inviteUrl, locale),
    }).catch(() => {});
  }

  return NextResponse.json({ member, inviteUrl }, { status: 201 });
}
