"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { Check, Copy, Code2, Globe, Layers, Monitor, ArrowRight } from "lucide-react";

const BASE_URL = "https://healthwatch-global.com";

const LOCALES = [
  { value: "en", label: "English" },
  { value: "fr", label: "Français" },
  { value: "es", label: "Español" },
  { value: "ar", label: "العربية" },
  { value: "id", label: "Bahasa Indonesia" },
];

const REGIONS = [
  { value: "",         label_en: "All regions",  label_fr: "Toutes régions", label_es: "Todas las regiones", label_ar: "جميع المناطق", label_id: "Semua wilayah" },
  { value: "africa",   label_en: "Africa",        label_fr: "Afrique",        label_es: "África",            label_ar: "أفريقيا",       label_id: "Afrika" },
  { value: "asia",     label_en: "Asia",          label_fr: "Asie",           label_es: "Asia",              label_ar: "آسيا",          label_id: "Asia" },
  { value: "americas", label_en: "Americas",      label_fr: "Amériques",      label_es: "Américas",          label_ar: "الأمريكتان",    label_id: "Amerika" },
  { value: "europe",   label_en: "Europe",        label_fr: "Europe",         label_es: "Europa",            label_ar: "أوروبا",        label_id: "Eropa" },
  { value: "oceania",  label_en: "Oceania",       label_fr: "Océanie",        label_es: "Oceanía",           label_ar: "أوقيانوسيا",    label_id: "Oseania" },
];

const COPY: Record<string, {
  title: string;
  subtitle: string;
  livePreview: string;
  options: string;
  optLocale: string;
  optRegion: string;
  optTheme: string;
  optLimit: string;
  optWidth: string;
  dark: string;
  light: string;
  embedCode: string;
  copyCode: string;
  copied: string;
  paramTable: string;
  param: string;
  type: string;
  default: string;
  desc: string;
  params: { name: string; type: string; default: string; desc: string }[];
  useCases: string;
  useCasesItems: { title: string; desc: string }[];
  ctaBanner: string;
  ctaBannerSub: string;
  ctaBtn: string;
  ctaNoCc: string;
  freeBadge: string;
  apiBanner: string;
  apiLink: string;
}> = {
  en: {
    title: "Embed the outbreak widget",
    subtitle: "Add a live WHO/ECDC/PAHO outbreak feed to any website, intranet, or dashboard — one line of HTML, no API key required.",
    livePreview: "Live preview",
    options: "Customize",
    optLocale: "Language",
    optRegion: "Region",
    optTheme: "Theme",
    optLimit: "Max rows",
    optWidth: "Width",
    dark: "Dark",
    light: "Light",
    embedCode: "Embed code",
    copyCode: "Copy",
    copied: "Copied!",
    paramTable: "Parameters",
    param: "Parameter",
    type: "Type",
    default: "Default",
    desc: "Description",
    params: [
      { name: "locale", type: "string", default: "en", desc: "Interface language: en · fr · es · ar · id" },
      { name: "region", type: "string", default: "(all)", desc: "Filter by region: africa · asia · americas · europe · oceania" },
      { name: "theme",  type: "string", default: "dark",  desc: "Color scheme: dark · light" },
      { name: "limit",  type: "integer", default: "5",   desc: "Number of outbreaks to display (1–10)" },
    ],
    useCases: "Common use cases",
    useCasesItems: [
      { title: "WHO & PAHO regional portals", desc: "Embed a filtered regional outbreak feed in internal briefing pages. Auto-updates every 6 hours — no maintenance." },
      { title: "Humanitarian field operations", desc: "Field teams see active outbreaks in their deployment zone without needing an account or login." },
      { title: "Ministry of Health intranets",  desc: "Put official WHO/ECDC data on your surveillance team's homepage. One paste, always current." },
    ],
    ctaBanner: "The widget shows what's active. The full dashboard tells you what to do.",
    ctaBannerSub: "Pro subscribers get instant alerts by disease and region, PDF situation reports, CSV export, Slack integration, and team access — all on the same official data.",
    ctaBtn: "Start free trial →",
    ctaNoCc: "7 days free · No credit card",
    freeBadge: "No API key required — free for all plans",
    apiBanner: "Need programmatic access? The REST API (Enterprise) gives full JSON access to all outbreak data.",
    apiLink: "See API documentation →",
  },
  fr: {
    title: "Intégrer le widget de foyers",
    subtitle: "Ajoutez un flux en direct des foyers OMS/ECDC/PAHO à n'importe quel site, intranet ou tableau de bord — une ligne de HTML, sans clé API.",
    livePreview: "Aperçu en direct",
    options: "Personnaliser",
    optLocale: "Langue",
    optRegion: "Région",
    optTheme: "Thème",
    optLimit: "Lignes max",
    optWidth: "Largeur",
    dark: "Sombre",
    light: "Clair",
    embedCode: "Code d'intégration",
    copyCode: "Copier",
    copied: "Copié !",
    paramTable: "Paramètres",
    param: "Paramètre",
    type: "Type",
    default: "Défaut",
    desc: "Description",
    params: [
      { name: "locale", type: "string",  default: "en",    desc: "Langue de l'interface : en · fr · es · ar · id" },
      { name: "region", type: "string",  default: "(tous)", desc: "Filtrer par région : africa · asia · americas · europe · oceania" },
      { name: "theme",  type: "string",  default: "dark",  desc: "Thème visuel : dark · light" },
      { name: "limit",  type: "entier",  default: "5",     desc: "Nombre de foyers affichés (1–10)" },
    ],
    useCases: "Cas d'usage courants",
    useCasesItems: [
      { title: "Portails régionaux OMS & PAHO", desc: "Intégrez un flux de foyers filtré par région dans vos pages de briefing internes. Mise à jour automatique toutes les 6h." },
      { title: "Opérations humanitaires terrain", desc: "Les équipes terrain voient les foyers actifs dans leur zone de déploiement sans avoir besoin de compte." },
      { title: "Intranet ministères de la Santé",  desc: "Affichez les données OMS/ECDC officielles sur la page d'accueil de votre équipe de surveillance. Un copier-coller, toujours à jour." },
    ],
    ctaBanner: "Le widget montre ce qui est actif. Le tableau de bord complet vous dit quoi faire.",
    ctaBannerSub: "Les abonnés Pro reçoivent des alertes instantanées par maladie et région, des rapports PDF, l'export CSV, l'intégration Slack et l'accès équipe — sur les mêmes données officielles.",
    ctaBtn: "Commencer l'essai gratuit →",
    ctaNoCc: "7 jours gratuits · Sans carte bancaire",
    freeBadge: "Aucune clé API requise — gratuit pour tous les plans",
    apiBanner: "Besoin d'un accès programmatique ? L'API REST (Enterprise) donne accès JSON complet à toutes les données.",
    apiLink: "Voir la documentation API →",
  },
  es: {
    title: "Insertar el widget de brotes",
    subtitle: "Añade un feed en vivo de brotes OMS/ECDC/PAHO a cualquier web, intranet o panel — una línea de HTML, sin clave API.",
    livePreview: "Vista previa",
    options: "Personalizar",
    optLocale: "Idioma",
    optRegion: "Región",
    optTheme: "Tema",
    optLimit: "Filas máx",
    optWidth: "Ancho",
    dark: "Oscuro",
    light: "Claro",
    embedCode: "Código de inserción",
    copyCode: "Copiar",
    copied: "¡Copiado!",
    paramTable: "Parámetros",
    param: "Parámetro",
    type: "Tipo",
    default: "Defecto",
    desc: "Descripción",
    params: [
      { name: "locale", type: "string",  default: "en",     desc: "Idioma: en · fr · es · ar · id" },
      { name: "region", type: "string",  default: "(todas)", desc: "Filtrar por región: africa · asia · americas · europe · oceania" },
      { name: "theme",  type: "string",  default: "dark",   desc: "Tema: dark · light" },
      { name: "limit",  type: "entero",  default: "5",      desc: "Número de brotes a mostrar (1–10)" },
    ],
    useCases: "Casos de uso comunes",
    useCasesItems: [
      { title: "Portales regionales OMS & PAHO", desc: "Inserte un feed de brotes filtrado por región en páginas de briefing internas. Actualización automática cada 6 horas." },
      { title: "Operaciones humanitarias",        desc: "Los equipos de campo ven los brotes activos en su zona de despliegue sin necesidad de cuenta." },
      { title: "Intranets de Ministerios de Salud", desc: "Datos OMS/ECDC oficiales en la página de inicio de su equipo de vigilancia. Un pegado, siempre actualizado." },
    ],
    ctaBanner: "El widget muestra lo que está activo. El panel completo le dice qué hacer.",
    ctaBannerSub: "Los suscriptores Pro reciben alertas instantáneas por enfermedad y región, informes PDF, exportación CSV, integración Slack y acceso en equipo — con los mismos datos oficiales.",
    ctaBtn: "Iniciar prueba gratuita →",
    ctaNoCc: "7 días gratis · Sin tarjeta de crédito",
    freeBadge: "Sin clave API — gratuito para todos los planes",
    apiBanner: "¿Necesita acceso programático? La API REST (Enterprise) da acceso JSON completo a todos los datos.",
    apiLink: "Ver documentación de la API →",
  },
  ar: {
    title: "تضمين أداة التفشيات",
    subtitle: "أضف خلاصة حية لتفشيات منظمة الصحة العالمية/ECDC/PAHO إلى أي موقع أو شبكة داخلية — سطر HTML واحد، بدون مفتاح API.",
    livePreview: "معاينة مباشرة",
    options: "تخصيص",
    optLocale: "اللغة",
    optRegion: "المنطقة",
    optTheme: "السمة",
    optLimit: "الحد الأقصى للصفوف",
    optWidth: "العرض",
    dark: "داكن",
    light: "فاتح",
    embedCode: "كود التضمين",
    copyCode: "نسخ",
    copied: "تم النسخ!",
    paramTable: "المعاملات",
    param: "المعامل",
    type: "النوع",
    default: "الافتراضي",
    desc: "الوصف",
    params: [
      { name: "locale", type: "نص",   default: "en",      desc: "لغة الواجهة: en · fr · es · ar · id" },
      { name: "region", type: "نص",   default: "(الكل)",  desc: "تصفية حسب المنطقة: africa · asia · americas · europe · oceania" },
      { name: "theme",  type: "نص",   default: "dark",    desc: "نظام الألوان: dark · light" },
      { name: "limit",  type: "عدد صحيح", default: "5",  desc: "عدد التفشيات المعروضة (1–10)" },
    ],
    useCases: "حالات الاستخدام الشائعة",
    useCasesItems: [
      { title: "بوابات WHO وPAHO الإقليمية",       desc: "ضمِّن خلاصة تفشيات مُصفَّاة حسب المنطقة في صفحات الإحاطة الداخلية. تحديث تلقائي كل 6 ساعات." },
      { title: "العمليات الإنسانية الميدانية",     desc: "يرى أفراد الفرق الميدانية التفشيات النشطة في مناطق انتشارهم دون الحاجة إلى حساب." },
      { title: "شبكات وزارات الصحة الداخلية",      desc: "بيانات WHO/ECDC الرسمية على الصفحة الرئيسية لفريق المراقبة. لصق واحد، دائماً محدَّث." },
    ],
    ctaBanner: "الأداة تُظهر ما هو نشط. لوحة التحكم الكاملة تخبرك بما يجب فعله.",
    ctaBannerSub: "يحصل مشتركو Pro على تنبيهات فورية حسب المرض والمنطقة، وتقارير PDF، وتصدير CSV، وتكامل Slack، والوصول الجماعي — على نفس البيانات الرسمية.",
    ctaBtn: "← بدء التجربة المجانية",
    ctaNoCc: "7 أيام مجاناً · بدون بطاقة بنكية",
    freeBadge: "لا يلزم مفتاح API — مجاني لجميع الخطط",
    apiBanner: "تحتاج وصولاً برمجياً؟ تتيح واجهة برمجة REST (Enterprise) الوصول الكامل بصيغة JSON لجميع البيانات.",
    apiLink: "← رؤية وثائق API",
  },
  id: {
    title: "Sematkan widget wabah",
    subtitle: "Tambahkan feed wabah WHO/ECDC/PAHO secara langsung ke website, intranet, atau dasbor — satu baris HTML, tanpa kunci API.",
    livePreview: "Pratinjau langsung",
    options: "Kustomisasi",
    optLocale: "Bahasa",
    optRegion: "Wilayah",
    optTheme: "Tema",
    optLimit: "Maks baris",
    optWidth: "Lebar",
    dark: "Gelap",
    light: "Terang",
    embedCode: "Kode sematan",
    copyCode: "Salin",
    copied: "Disalin!",
    paramTable: "Parameter",
    param: "Parameter",
    type: "Tipe",
    default: "Default",
    desc: "Deskripsi",
    params: [
      { name: "locale", type: "string",  default: "en",         desc: "Bahasa antarmuka: en · fr · es · ar · id" },
      { name: "region", type: "string",  default: "(semua)",    desc: "Filter berdasarkan wilayah: africa · asia · americas · europe · oceania" },
      { name: "theme",  type: "string",  default: "dark",       desc: "Skema warna: dark · light" },
      { name: "limit",  type: "integer", default: "5",          desc: "Jumlah wabah yang ditampilkan (1–10)" },
    ],
    useCases: "Kasus penggunaan umum",
    useCasesItems: [
      { title: "Portal regional WHO & PAHO",     desc: "Sematkan feed wabah yang difilter per wilayah di halaman briefing internal. Diperbarui otomatis setiap 6 jam." },
      { title: "Operasi lapangan kemanusiaan",   desc: "Tim lapangan melihat wabah aktif di zona penempatan mereka tanpa perlu akun." },
      { title: "Intranet Kementerian Kesehatan", desc: "Data resmi WHO/ECDC di halaman utama tim surveilans Anda. Satu tempel, selalu terkini." },
    ],
    ctaBanner: "Widget menunjukkan apa yang aktif. Dasbor lengkap memberi tahu apa yang harus dilakukan.",
    ctaBannerSub: "Pelanggan Pro mendapat peringatan instan per penyakit dan wilayah, laporan PDF, ekspor CSV, integrasi Slack, dan akses tim — semua dengan data resmi yang sama.",
    ctaBtn: "Mulai uji coba gratis →",
    ctaNoCc: "7 hari gratis · Tanpa kartu kredit",
    freeBadge: "Tidak perlu kunci API — gratis untuk semua paket",
    apiBanner: "Perlu akses terprogram? REST API (Enterprise) memberikan akses JSON penuh ke semua data wabah.",
    apiLink: "Lihat dokumentasi API →",
  },
};

function buildWidgetUrl(locale: string, region: string, theme: string, limit: number): string {
  const p = new URLSearchParams({ locale, theme, limit: String(limit) });
  if (region) p.set("region", region);
  return `${BASE_URL}/widget?${p.toString()}`;
}

const WIDTH_OPTIONS = [
  { value: 280, label: "280px" },
  { value: 400, label: "400px" },
  { value: 600, label: "600px" },
] as const;

function buildEmbedCode(locale: string, region: string, theme: string, limit: number, width: number): string {
  const src = buildWidgetUrl(locale, region, theme, limit);
  const titleMap: Record<string, string> = {
    en: "Active disease outbreaks — HealthWatch Global",
    fr: "Foyers de maladies actifs — HealthWatch Global",
    es: "Brotes de enfermedades activos — HealthWatch Global",
    ar: "تفشيات الأمراض النشطة — HealthWatch Global",
    id: "Wabah penyakit aktif — HealthWatch Global",
  };
  const title = titleMap[locale] ?? titleMap.en;
  const height = Math.max(240, 100 + limit * 52);
  return `<iframe\n  src="${src}"\n  width="${width}"\n  height="${height}"\n  frameborder="0"\n  style="border:none;border-radius:12px;"\n  title="${title}"\n></iframe>`;
}

interface Props { locale: string }

export default function EmbedClient({ locale }: Props) {
  const c = COPY[locale] ?? COPY.en;
  const isRtl = locale === "ar";

  const [embedLocale, setEmbedLocale] = useState(locale);
  const [region,      setRegion]      = useState("");
  const [theme,       setTheme]       = useState<"dark" | "light">("dark");
  const [limit,       setLimit]       = useState(5);
  const [width,       setWidth]       = useState(400);
  const [copied,      setCopied]      = useState(false);

  const widgetUrl  = buildWidgetUrl(embedLocale, region, theme, limit);
  const embedCode  = buildEmbedCode(embedLocale, region, theme, limit, width);

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(embedCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [embedCode]);

  const regionLabel = (r: typeof REGIONS[number]) => {
    const key = `label_${embedLocale}` as keyof typeof r;
    return (r[key] as string) ?? r.label_en;
  };

  const selectCls = "bg-gray-800 border border-gray-700 text-gray-200 text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:border-gray-500 w-full";

  return (
    <div className="max-w-4xl mx-auto py-4 space-y-12" dir={isRtl ? "rtl" : "ltr"}>

      {/* Header */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-xs text-red-400 font-semibold uppercase tracking-widest">
          <Code2 className="w-3.5 h-3.5" />
          Free · No API key required
        </div>
        <h1 className="text-4xl font-bold text-white">{c.title}</h1>
        <p className="text-gray-400 text-lg leading-relaxed max-w-2xl">{c.subtitle}</p>
        <div className="inline-flex items-center gap-2 text-sm text-green-400 bg-green-500/10 border border-green-500/20 rounded-full px-4 py-1.5">
          <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
          {c.freeBadge}
        </div>
      </div>

      {/* Preview + config */}
      <div className="grid lg:grid-cols-2 gap-8 items-start">

        {/* Left: live preview */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-gray-300">
            <Monitor className="w-4 h-4 text-gray-500" />
            {c.livePreview}
          </div>
          <div className="bg-gray-950 border border-gray-800 rounded-2xl p-4 flex items-center justify-center min-h-[360px] overflow-hidden">
            <iframe
              key={`${widgetUrl}-${width}-${limit}`}
              src={widgetUrl}
              width={Math.min(width, 560)}
              height={Math.max(240, 100 + limit * 52)}
              style={{ border: "none", borderRadius: 12, display: "block", maxWidth: "100%" }}
              title="Widget preview"
            />
          </div>
        </div>

        {/* Right: options + embed code */}
        <div className="space-y-6">

          {/* Options */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-gray-300">
              <Layers className="w-4 h-4 text-gray-500" />
              {c.options}
            </div>

            <div className="grid grid-cols-2 gap-3">
              {/* Locale */}
              <div className="space-y-1.5">
                <label className="text-xs text-gray-500 font-medium">{c.optLocale}</label>
                <select value={embedLocale} onChange={(e) => setEmbedLocale(e.target.value)} className={selectCls}>
                  {LOCALES.map((l) => (
                    <option key={l.value} value={l.value}>{l.label}</option>
                  ))}
                </select>
              </div>

              {/* Region */}
              <div className="space-y-1.5">
                <label className="text-xs text-gray-500 font-medium">{c.optRegion}</label>
                <select value={region} onChange={(e) => setRegion(e.target.value)} className={selectCls}>
                  {REGIONS.map((r) => (
                    <option key={r.value} value={r.value}>{regionLabel(r)}</option>
                  ))}
                </select>
              </div>

              {/* Theme */}
              <div className="space-y-1.5">
                <label className="text-xs text-gray-500 font-medium">{c.optTheme}</label>
                <div className="flex rounded-lg overflow-hidden border border-gray-700">
                  {(["dark", "light"] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => setTheme(t)}
                      className={`flex-1 py-1.5 text-sm font-medium transition-colors ${
                        theme === t
                          ? "bg-gray-700 text-white"
                          : "bg-gray-800 text-gray-400 hover:text-gray-200"
                      }`}
                    >
                      {t === "dark" ? c.dark : c.light}
                    </button>
                  ))}
                </div>
              </div>

              {/* Limit */}
              <div className="space-y-1.5">
                <label className="text-xs text-gray-500 font-medium">{c.optLimit}: {limit}</label>
                <input
                  type="range"
                  min={1}
                  max={10}
                  value={limit}
                  onChange={(e) => setLimit(parseInt(e.target.value, 10))}
                  className="w-full accent-red-500 mt-1"
                />
              </div>

              {/* Width */}
              <div className="space-y-1.5 col-span-2">
                <label className="text-xs text-gray-500 font-medium">{c.optWidth}</label>
                <div className="flex gap-2">
                  {WIDTH_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setWidth(opt.value)}
                      className={`flex-1 py-1.5 text-sm font-medium rounded-lg border transition-colors ${
                        width === opt.value
                          ? "bg-gray-700 border-gray-500 text-white"
                          : "bg-gray-800 border-gray-700 text-gray-400 hover:text-gray-200"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Embed code */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-semibold text-gray-300">
                <Code2 className="w-4 h-4 text-gray-500" />
                {c.embedCode}
              </div>
              <button
                onClick={handleCopy}
                className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ${
                  copied
                    ? "bg-green-500/20 text-green-400 border border-green-500/30"
                    : "bg-gray-700 hover:bg-gray-600 text-gray-300 border border-gray-600"
                }`}
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? c.copied : c.copyCode}
              </button>
            </div>
            <pre className="bg-gray-950 border border-gray-800 rounded-xl p-4 text-xs text-gray-300 font-mono overflow-x-auto leading-relaxed whitespace-pre">
              {embedCode}
            </pre>
          </div>
        </div>
      </div>

      {/* Parameters table */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold text-white border-b border-gray-800 pb-3">{c.paramTable}</h2>
        <div className="rounded-xl border border-gray-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-900 border-b border-gray-800">
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{c.param}</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{c.type}</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{c.default}</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{c.desc}</th>
              </tr>
            </thead>
            <tbody>
              {c.params.map((p) => (
                <tr key={p.name} className="border-b border-gray-800 last:border-0">
                  <td className="px-4 py-3 font-mono text-red-300 text-xs">{p.name}</td>
                  <td className="px-4 py-3 font-mono text-blue-400 text-xs">{p.type}</td>
                  <td className="px-4 py-3 font-mono text-gray-400 text-xs">{p.default}</td>
                  <td className="px-4 py-3 text-gray-400 text-xs">{p.desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Use cases */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold text-white border-b border-gray-800 pb-3">{c.useCases}</h2>
        <div className="grid sm:grid-cols-3 gap-4">
          {c.useCasesItems.map((item) => (
            <div key={item.title} className="bg-gray-900/60 border border-gray-800 rounded-xl p-4 space-y-2">
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-red-400 shrink-0" />
                <span className="text-sm font-semibold text-white">{item.title}</span>
              </div>
              <p className="text-sm text-gray-400 leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Acquisition CTA */}
      <div className="bg-gradient-to-r from-red-950/50 via-gray-900/60 to-transparent border border-red-700/30 rounded-2xl p-8 space-y-4">
        <h2 className="text-xl font-bold text-white">{c.ctaBanner}</h2>
        <p className="text-gray-400 text-sm leading-relaxed max-w-2xl">{c.ctaBannerSub}</p>
        <div className="flex items-center gap-4 flex-wrap">
          <Link
            href={`/${locale}/signup`}
            className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-500 text-white font-bold px-6 py-3 rounded-xl transition-colors text-sm"
          >
            {c.ctaBtn}
            <ArrowRight className="w-4 h-4" />
          </Link>
          <span className="text-xs text-gray-500">{c.ctaNoCc}</span>
        </div>
      </div>

      {/* API banner */}
      <div className="bg-gradient-to-r from-purple-950/40 via-gray-900/60 to-transparent border border-purple-700/30 rounded-2xl p-6 flex items-start justify-between gap-4 flex-wrap">
        <p className="text-gray-400 text-sm leading-relaxed max-w-xl">{c.apiBanner}</p>
        <a
          href={`/${locale}/docs`}
          className="shrink-0 text-purple-400 hover:text-purple-300 text-sm font-semibold transition-colors"
        >
          {c.apiLink}
        </a>
      </div>

    </div>
  );
}
