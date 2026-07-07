"use client";

import { useState } from "react";
import { useLocale } from "next-intl";
import { CheckCircle, Loader2, ShieldOff, UserCheck, FileX, Radio } from "lucide-react";

const COPY = {
  en: {
    tag: "Field Signal Channel",
    title: "Something unusual on the ground?\nTell us before it's confirmed.",
    sub: "A direct line for people close to communities, farms, and clinics. Formal surveillance is often weeks behind what you're already seeing. If something feels off, this is where you flag it — no proof required.",
    strip: [
      { icon: "shield", text: "No patient data, ever" },
      { icon: "user", text: "Personal follow-up, fast" },
      { icon: "file", text: "Not a formal report" },
    ],
    formTitle: "Send a signal",
    labelName: "Full name",
    labelOrg: "Organization / role",
    placeholderOrg: "e.g. Veterinarian, community health worker...",
    labelEmail: "Email",
    labelLocation: "Location — country / region",
    placeholderLocation: "e.g. Kasese district, Uganda",
    labelMessage: "What are you seeing?",
    placeholderMessage: "e.g. Unusual number of sick cattle reported by farmers over the past 10 days, no formal case count yet...",
    submit: "Send signal →",
    submitting: "Sending…",
    successTitle: "Signal received.",
    successDesc: "Thank you. We'll follow up personally, usually within a day. Check your email for confirmation.",
    error: "Something went wrong. Please try again.",
  },
  fr: {
    tag: "Canal de signal terrain",
    title: "Quelque chose d'inhabituel sur le terrain ?\nDites-le-nous avant confirmation.",
    sub: "Une ligne directe pour les personnes proches des communautés, des exploitations agricoles et des cliniques. La surveillance formelle a souvent des semaines de retard sur ce que vous observez déjà. Si quelque chose vous semble anormal, c'est ici que vous le signalez — aucune preuve requise.",
    strip: [
      { icon: "shield", text: "Aucune donnée patient, jamais" },
      { icon: "user", text: "Retour personnel et rapide" },
      { icon: "file", text: "Pas un rapport formel" },
    ],
    formTitle: "Envoyer un signal",
    labelName: "Nom complet",
    labelOrg: "Organisation / rôle",
    placeholderOrg: "ex. Vétérinaire, agent de santé communautaire...",
    labelEmail: "Email",
    labelLocation: "Localisation — pays / région",
    placeholderLocation: "ex. District de Kasese, Ouganda",
    labelMessage: "Que constatez-vous ?",
    placeholderMessage: "ex. Nombre inhabituel de bovins malades signalé par des agriculteurs ces 10 derniers jours, pas encore de comptage formel...",
    submit: "Envoyer le signal →",
    submitting: "Envoi…",
    successTitle: "Signal reçu.",
    successDesc: "Merci. Nous reviendrons vers vous personnellement, en général sous 24 heures. Vérifiez votre email pour la confirmation.",
    error: "Une erreur est survenue. Réessayez.",
  },
  es: {
    tag: "Canal de señal de campo",
    title: "¿Algo inusual sobre el terreno?\nCuéntanoslo antes de la confirmación.",
    sub: "Una línea directa para personas cercanas a comunidades, granjas y clínicas. La vigilancia formal suele ir semanas por detrás de lo que ya estás viendo. Si algo te parece anormal, aquí es donde lo señalas, sin necesidad de pruebas.",
    strip: [
      { icon: "shield", text: "Ningún dato de pacientes, nunca" },
      { icon: "user", text: "Respuesta personal y rápida" },
      { icon: "file", text: "No es un informe formal" },
    ],
    formTitle: "Enviar una señal",
    labelName: "Nombre completo",
    labelOrg: "Organización / rol",
    placeholderOrg: "ej. Veterinario, agente comunitario de salud...",
    labelEmail: "Email",
    labelLocation: "Ubicación — país / región",
    placeholderLocation: "ej. Distrito de Kasese, Uganda",
    labelMessage: "¿Qué estás observando?",
    placeholderMessage: "ej. Número inusual de ganado enfermo reportado por agricultores en los últimos 10 días, aún sin conteo formal...",
    submit: "Enviar señal →",
    submitting: "Enviando…",
    successTitle: "Señal recibida.",
    successDesc: "Gracias. Nos pondremos en contacto personalmente, normalmente en menos de 24 horas. Revisa tu correo para la confirmación.",
    error: "Algo salió mal. Por favor, inténtalo de nuevo.",
  },
  ar: {
    tag: "قناة الإشارة الميدانية",
    title: "هل تلاحظ شيئاً غير معتاد ميدانياً؟\nأخبرنا قبل التأكيد الرسمي.",
    sub: "خط مباشر للأشخاص القريبين من المجتمعات والمزارع والعيادات. غالباً ما تتأخر المراقبة الرسمية أسابيع عما تلاحظه بالفعل. إذا شعرت أن شيئاً غير طبيعي، فهذا هو المكان للإبلاغ عنه — دون الحاجة لأي إثبات.",
    strip: [
      { icon: "shield", text: "لا بيانات مرضى، أبداً" },
      { icon: "user", text: "متابعة شخصية وسريعة" },
      { icon: "file", text: "ليس تقريراً رسمياً" },
    ],
    formTitle: "إرسال إشارة",
    labelName: "الاسم الكامل",
    labelOrg: "المنظمة / الدور",
    placeholderOrg: "مثال: طبيب بيطري، عامل صحي مجتمعي...",
    labelEmail: "البريد الإلكتروني",
    labelLocation: "الموقع — البلد / المنطقة",
    placeholderLocation: "مثال: منطقة كاسيسي، أوغندا",
    labelMessage: "ماذا تلاحظ؟",
    placeholderMessage: "مثال: عدد غير معتاد من الماشية المريضة أبلغ عنه المزارعون خلال الأيام العشرة الماضية، دون إحصاء رسمي بعد...",
    submit: "← إرسال الإشارة",
    submitting: "جارٍ الإرسال…",
    successTitle: "تم استلام الإشارة.",
    successDesc: "شكراً لك. سنتواصل معك شخصياً، عادةً خلال 24 ساعة. تحقق من بريدك الإلكتروني للتأكيد.",
    error: "حدث خطأ. يرجى المحاولة مجدداً.",
  },
  id: {
    tag: "Kanal Sinyal Lapangan",
    title: "Ada sesuatu yang tidak biasa di lapangan?\nBeri tahu kami sebelum dikonfirmasi.",
    sub: "Jalur langsung untuk orang-orang yang dekat dengan komunitas, peternakan, dan klinik. Pengawasan resmi seringkali tertinggal berminggu-minggu dari apa yang sudah Anda lihat. Jika ada yang terasa tidak biasa, di sinilah tempat melaporkannya — tanpa perlu bukti.",
    strip: [
      { icon: "shield", text: "Tanpa data pasien, selamanya" },
      { icon: "user", text: "Tindak lanjut pribadi, cepat" },
      { icon: "file", text: "Bukan laporan resmi" },
    ],
    formTitle: "Kirim sinyal",
    labelName: "Nama lengkap",
    labelOrg: "Organisasi / peran",
    placeholderOrg: "mis. Dokter hewan, petugas kesehatan masyarakat...",
    labelEmail: "Email",
    labelLocation: "Lokasi — negara / wilayah",
    placeholderLocation: "mis. Distrik Kasese, Uganda",
    labelMessage: "Apa yang Anda lihat?",
    placeholderMessage: "mis. Jumlah ternak sakit yang tidak biasa dilaporkan oleh petani selama 10 hari terakhir, belum ada jumlah kasus resmi...",
    submit: "Kirim sinyal →",
    submitting: "Mengirim…",
    successTitle: "Sinyal diterima.",
    successDesc: "Terima kasih. Kami akan menindaklanjuti secara pribadi, biasanya dalam satu hari. Cek email Anda untuk konfirmasi.",
    error: "Terjadi kesalahan. Silakan coba lagi.",
  },
} as const;

const STRIP_ICONS = {
  shield: ShieldOff,
  user: UserCheck,
  file: FileX,
};

export default function FieldSignalPage() {
  const locale = useLocale() as keyof typeof COPY;
  const c = COPY[locale] ?? COPY.en;
  const isRtl = locale === "ar";

  const [form, setForm] = useState({ name: "", organization: "", email: "", location: "", message: "" });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/field-signal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, locale }),
      });
      if (!res.ok) throw new Error();
      setSuccess(true);
    } catch {
      setError(c.error);
    } finally {
      setLoading(false);
    }
  };

  const inputClass = "w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-green-500 transition-colors text-sm";

  return (
    <div className={`max-w-2xl mx-auto space-y-10${isRtl ? " text-right" : ""}`} dir={isRtl ? "rtl" : "ltr"}>

      {/* Hero */}
      <div className="text-center space-y-4">
        <div className="inline-flex items-center gap-2 text-xs font-bold px-3 py-1.5 rounded-full bg-green-500/10 border border-green-500/30 text-green-400 uppercase tracking-widest">
          <Radio className="w-3.5 h-3.5" />
          {c.tag}
        </div>
        <h1 className="text-3xl md:text-4xl font-bold text-white whitespace-pre-line leading-tight">
          {c.title}
        </h1>
        <p className="text-gray-400 text-base max-w-xl mx-auto leading-relaxed">{c.sub}</p>
      </div>

      {/* Reassurance strip */}
      <div className="flex flex-wrap justify-center gap-6 border-y border-gray-800/60 py-5">
        {c.strip.map(({ icon, text }) => {
          const Icon = STRIP_ICONS[icon as keyof typeof STRIP_ICONS];
          return (
            <div key={text} className="flex items-center gap-2 text-sm text-gray-400">
              <Icon className="w-4 h-4 text-green-500 shrink-0" />
              <span>{text}</span>
            </div>
          );
        })}
      </div>

      {/* Form */}
      <div className="bg-gray-800/30 rounded-2xl border border-gray-700/50 p-8">
        <h2 className="text-xl font-bold text-white mb-6">{c.formTitle}</h2>

        {success ? (
          <div className="text-center py-10 space-y-3">
            <CheckCircle className="w-12 h-12 text-green-400 mx-auto" />
            <p className="text-lg font-semibold text-white">{c.successTitle}</p>
            <p className="text-gray-400 text-sm">{c.successDesc}</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">{c.labelName} *</label>
                <input required className={inputClass} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">{c.labelOrg}</label>
                <input className={inputClass} placeholder={c.placeholderOrg} value={form.organization} onChange={e => setForm(f => ({ ...f, organization: e.target.value }))} />
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">{c.labelEmail} *</label>
                <input required type="email" className={inputClass} value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">{c.labelLocation} *</label>
                <input required className={inputClass} placeholder={c.placeholderLocation} value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">{c.labelMessage} *</label>
              <textarea
                required
                rows={4}
                className={`${inputClass} resize-none`}
                placeholder={c.placeholderMessage}
                value={form.message}
                onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
              />
            </div>

            {error && <p className="text-red-400 text-sm">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white font-semibold px-6 py-2.5 rounded-lg transition-colors text-sm"
            >
              {loading ? <><Loader2 className="w-4 h-4 animate-spin" />{c.submitting}</> : c.submit}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
