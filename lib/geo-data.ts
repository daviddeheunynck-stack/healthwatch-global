export interface CountryGeo {
  lat: number;
  lng: number;
  region: "africa" | "asia" | "europe" | "americas" | "oceania";
  name_en: string;
  name_fr: string;
  name_ar: string;
}

// Keys are the exact country names as they appear in WHO DON RSS titles (English).
// Alternate spellings / WHO variants are listed at the bottom.
export const COUNTRIES: Record<string, CountryGeo> = {
  // ── AFRICA ──────────────────────────────────────────────────
  "Democratic Republic of the Congo": { lat: -4.0, lng: 21.8, region: "africa", name_en: "DR Congo", name_fr: "RD Congo", name_ar: "الكونغو الديمقراطية" },
  "Republic of the Congo": { lat: -0.2, lng: 15.8, region: "africa", name_en: "Congo", name_fr: "Congo", name_ar: "جمهورية الكونغو" },
  "Nigeria": { lat: 9.1, lng: 8.7, region: "africa", name_en: "Nigeria", name_fr: "Nigéria", name_ar: "نيجيريا" },
  "Uganda": { lat: 1.4, lng: 32.3, region: "africa", name_en: "Uganda", name_fr: "Ouganda", name_ar: "أوغندا" },
  "Ethiopia": { lat: 9.1, lng: 40.5, region: "africa", name_en: "Ethiopia", name_fr: "Éthiopie", name_ar: "إثيوبيا" },
  "South Sudan": { lat: 6.9, lng: 31.3, region: "africa", name_en: "South Sudan", name_fr: "Soudan du Sud", name_ar: "جنوب السودان" },
  "Sudan": { lat: 12.9, lng: 30.2, region: "africa", name_en: "Sudan", name_fr: "Soudan", name_ar: "السودان" },
  "Somalia": { lat: 5.2, lng: 46.2, region: "africa", name_en: "Somalia", name_fr: "Somalie", name_ar: "الصومال" },
  "Kenya": { lat: -1.3, lng: 36.8, region: "africa", name_en: "Kenya", name_fr: "Kenya", name_ar: "كينيا" },
  "Tanzania": { lat: -6.4, lng: 34.9, region: "africa", name_en: "Tanzania", name_fr: "Tanzanie", name_ar: "تنزانيا" },
  "United Republic of Tanzania": { lat: -6.4, lng: 34.9, region: "africa", name_en: "Tanzania", name_fr: "Tanzanie", name_ar: "تنزانيا" },
  "Rwanda": { lat: -1.9, lng: 29.9, region: "africa", name_en: "Rwanda", name_fr: "Rwanda", name_ar: "رواندا" },
  "Burundi": { lat: -3.4, lng: 29.9, region: "africa", name_en: "Burundi", name_fr: "Burundi", name_ar: "بوروندي" },
  "Guinea": { lat: 11.0, lng: -10.9, region: "africa", name_en: "Guinea", name_fr: "Guinée", name_ar: "غينيا" },
  "Guinea-Bissau": { lat: 11.8, lng: -15.2, region: "africa", name_en: "Guinea-Bissau", name_fr: "Guinée-Bissau", name_ar: "غينيا بيساو" },
  "Liberia": { lat: 6.4, lng: -9.4, region: "africa", name_en: "Liberia", name_fr: "Libéria", name_ar: "ليبيريا" },
  "Sierra Leone": { lat: 8.5, lng: -11.8, region: "africa", name_en: "Sierra Leone", name_fr: "Sierra Leone", name_ar: "سيراليون" },
  "Mali": { lat: 17.6, lng: -4.0, region: "africa", name_en: "Mali", name_fr: "Mali", name_ar: "مالي" },
  "Niger": { lat: 17.6, lng: 8.1, region: "africa", name_en: "Niger", name_fr: "Niger", name_ar: "النيجر" },
  "Burkina Faso": { lat: 12.4, lng: -1.6, region: "africa", name_en: "Burkina Faso", name_fr: "Burkina Faso", name_ar: "بوركينا فاسو" },
  "Chad": { lat: 15.5, lng: 18.7, region: "africa", name_en: "Chad", name_fr: "Tchad", name_ar: "تشاد" },
  "Cameroon": { lat: 7.4, lng: 12.4, region: "africa", name_en: "Cameroon", name_fr: "Cameroun", name_ar: "الكاميرون" },
  "Central African Republic": { lat: 6.6, lng: 20.9, region: "africa", name_en: "Central African Republic", name_fr: "RCA", name_ar: "أفريقيا الوسطى" },
  "Gabon": { lat: -0.8, lng: 11.6, region: "africa", name_en: "Gabon", name_fr: "Gabon", name_ar: "الغابون" },
  "Equatorial Guinea": { lat: 1.7, lng: 10.3, region: "africa", name_en: "Equatorial Guinea", name_fr: "Guinée équatoriale", name_ar: "غينيا الاستوائية" },
  "Angola": { lat: -11.2, lng: 17.9, region: "africa", name_en: "Angola", name_fr: "Angola", name_ar: "أنغولا" },
  "Zambia": { lat: -13.1, lng: 27.8, region: "africa", name_en: "Zambia", name_fr: "Zambie", name_ar: "زامبيا" },
  "Zimbabwe": { lat: -19.0, lng: 29.2, region: "africa", name_en: "Zimbabwe", name_fr: "Zimbabwe", name_ar: "زيمبابوي" },
  "Mozambique": { lat: -18.7, lng: 35.5, region: "africa", name_en: "Mozambique", name_fr: "Mozambique", name_ar: "موزمبيق" },
  "Madagascar": { lat: -18.8, lng: 46.9, region: "africa", name_en: "Madagascar", name_fr: "Madagascar", name_ar: "مدغشقر" },
  "South Africa": { lat: -30.6, lng: 22.9, region: "africa", name_en: "South Africa", name_fr: "Afrique du Sud", name_ar: "جنوب أفريقيا" },
  "Senegal": { lat: 14.5, lng: -14.5, region: "africa", name_en: "Senegal", name_fr: "Sénégal", name_ar: "السنغال" },
  "Ghana": { lat: 7.9, lng: -1.0, region: "africa", name_en: "Ghana", name_fr: "Ghana", name_ar: "غانا" },
  "Côte d'Ivoire": { lat: 7.5, lng: -5.5, region: "africa", name_en: "Côte d'Ivoire", name_fr: "Côte d'Ivoire", name_ar: "ساحل العاج" },
  "Ivory Coast": { lat: 7.5, lng: -5.5, region: "africa", name_en: "Côte d'Ivoire", name_fr: "Côte d'Ivoire", name_ar: "ساحل العاج" },
  "Togo": { lat: 8.6, lng: 0.8, region: "africa", name_en: "Togo", name_fr: "Togo", name_ar: "توغو" },
  "Benin": { lat: 9.3, lng: 2.3, region: "africa", name_en: "Benin", name_fr: "Bénin", name_ar: "بنين" },
  "Malawi": { lat: -13.3, lng: 34.3, region: "africa", name_en: "Malawi", name_fr: "Malawi", name_ar: "ملاوي" },
  "Egypt": { lat: 26.8, lng: 30.8, region: "africa", name_en: "Egypt", name_fr: "Égypte", name_ar: "مصر" },
  "Libya": { lat: 26.3, lng: 17.2, region: "africa", name_en: "Libya", name_fr: "Libye", name_ar: "ليبيا" },
  "Morocco": { lat: 31.8, lng: -7.1, region: "africa", name_en: "Morocco", name_fr: "Maroc", name_ar: "المغرب" },
  "Tunisia": { lat: 33.9, lng: 9.5, region: "africa", name_en: "Tunisia", name_fr: "Tunisie", name_ar: "تونس" },
  "Algeria": { lat: 28.0, lng: 1.7, region: "africa", name_en: "Algeria", name_fr: "Algérie", name_ar: "الجزائر" },

  // ── ASIA ─────────────────────────────────────────────────────
  "India": { lat: 20.6, lng: 78.9, region: "asia", name_en: "India", name_fr: "Inde", name_ar: "الهند" },
  "Bangladesh": { lat: 23.7, lng: 90.4, region: "asia", name_en: "Bangladesh", name_fr: "Bangladesh", name_ar: "بنغلاديش" },
  "Pakistan": { lat: 30.4, lng: 69.3, region: "asia", name_en: "Pakistan", name_fr: "Pakistan", name_ar: "باكستان" },
  "China": { lat: 35.9, lng: 104.2, region: "asia", name_en: "China", name_fr: "Chine", name_ar: "الصين" },
  "Indonesia": { lat: -0.8, lng: 113.9, region: "asia", name_en: "Indonesia", name_fr: "Indonésie", name_ar: "إندونيسيا" },
  "Philippines": { lat: 12.9, lng: 121.8, region: "asia", name_en: "Philippines", name_fr: "Philippines", name_ar: "الفلبين" },
  "Myanmar": { lat: 21.9, lng: 95.9, region: "asia", name_en: "Myanmar", name_fr: "Myanmar", name_ar: "ميانمار" },
  "Cambodia": { lat: 12.6, lng: 104.9, region: "asia", name_en: "Cambodia", name_fr: "Cambodge", name_ar: "كمبوديا" },
  "Viet Nam": { lat: 14.1, lng: 108.3, region: "asia", name_en: "Vietnam", name_fr: "Viêt Nam", name_ar: "فيتنام" },
  "Vietnam": { lat: 14.1, lng: 108.3, region: "asia", name_en: "Vietnam", name_fr: "Viêt Nam", name_ar: "فيتنام" },
  "Thailand": { lat: 15.9, lng: 100.9, region: "asia", name_en: "Thailand", name_fr: "Thaïlande", name_ar: "تايلاند" },
  "Malaysia": { lat: 4.2, lng: 101.9, region: "asia", name_en: "Malaysia", name_fr: "Malaisie", name_ar: "ماليزيا" },
  "Laos": { lat: 19.9, lng: 102.5, region: "asia", name_en: "Laos", name_fr: "Laos", name_ar: "لاوس" },
  "Lao People's Democratic Republic": { lat: 19.9, lng: 102.5, region: "asia", name_en: "Laos", name_fr: "Laos", name_ar: "لاوس" },
  "Nepal": { lat: 28.4, lng: 84.1, region: "asia", name_en: "Nepal", name_fr: "Népal", name_ar: "نيبال" },
  "Afghanistan": { lat: 33.9, lng: 67.7, region: "asia", name_en: "Afghanistan", name_fr: "Afghanistan", name_ar: "أفغانستان" },
  "Papua New Guinea": { lat: -6.3, lng: 143.9, region: "asia", name_en: "Papua New Guinea", name_fr: "Papouasie-Nouvelle-Guinée", name_ar: "بابوا غينيا الجديدة" },
  "Yemen": { lat: 15.6, lng: 48.5, region: "asia", name_en: "Yemen", name_fr: "Yémen", name_ar: "اليمن" },
  "Iraq": { lat: 33.2, lng: 43.7, region: "asia", name_en: "Iraq", name_fr: "Irak", name_ar: "العراق" },
  "Syria": { lat: 34.8, lng: 38.9, region: "asia", name_en: "Syria", name_fr: "Syrie", name_ar: "سوريا" },
  "Syrian Arab Republic": { lat: 34.8, lng: 38.9, region: "asia", name_en: "Syria", name_fr: "Syrie", name_ar: "سوريا" },
  "Jordan": { lat: 30.6, lng: 36.2, region: "asia", name_en: "Jordan", name_fr: "Jordanie", name_ar: "الأردن" },
  "Lebanon": { lat: 33.9, lng: 35.9, region: "asia", name_en: "Lebanon", name_fr: "Liban", name_ar: "لبنان" },
  "Turkey": { lat: 38.9, lng: 35.2, region: "asia", name_en: "Turkey", name_fr: "Turquie", name_ar: "تركيا" },
  "Türkiye": { lat: 38.9, lng: 35.2, region: "asia", name_en: "Turkey", name_fr: "Turquie", name_ar: "تركيا" },
  "Saudi Arabia": { lat: 23.9, lng: 45.1, region: "asia", name_en: "Saudi Arabia", name_fr: "Arabie Saoudite", name_ar: "المملكة العربية السعودية" },
  "Iran": { lat: 32.4, lng: 53.7, region: "asia", name_en: "Iran", name_fr: "Iran", name_ar: "إيران" },
  "Iran (Islamic Republic of)": { lat: 32.4, lng: 53.7, region: "asia", name_en: "Iran", name_fr: "Iran", name_ar: "إيران" },
  "Azerbaijan": { lat: 40.1, lng: 47.6, region: "asia", name_en: "Azerbaijan", name_fr: "Azerbaïdjan", name_ar: "أذربيجان" },
  "Kazakhstan": { lat: 48.0, lng: 66.9, region: "asia", name_en: "Kazakhstan", name_fr: "Kazakhstan", name_ar: "كازاخستان" },
  "Tajikistan": { lat: 38.9, lng: 71.3, region: "asia", name_en: "Tajikistan", name_fr: "Tadjikistan", name_ar: "طاجيكستان" },
  "Uzbekistan": { lat: 41.4, lng: 64.6, region: "asia", name_en: "Uzbekistan", name_fr: "Ouzbékistan", name_ar: "أوزبكستان" },

  // ── AMERICAS ─────────────────────────────────────────────────
  "Haiti": { lat: 18.9, lng: -72.3, region: "americas", name_en: "Haiti", name_fr: "Haïti", name_ar: "هايتي" },
  "Brazil": { lat: -14.2, lng: -51.9, region: "americas", name_en: "Brazil", name_fr: "Brésil", name_ar: "البرازيل" },
  "Colombia": { lat: 4.6, lng: -74.1, region: "americas", name_en: "Colombia", name_fr: "Colombie", name_ar: "كولومبيا" },
  "Peru": { lat: -9.2, lng: -75.0, region: "americas", name_en: "Peru", name_fr: "Pérou", name_ar: "بيرو" },
  "Bolivia": { lat: -16.3, lng: -63.6, region: "americas", name_en: "Bolivia", name_fr: "Bolivie", name_ar: "بوليفيا" },
  "Bolivia (Plurinational State of)": { lat: -16.3, lng: -63.6, region: "americas", name_en: "Bolivia", name_fr: "Bolivie", name_ar: "بوليفيا" },
  "Venezuela": { lat: 6.4, lng: -66.6, region: "americas", name_en: "Venezuela", name_fr: "Venezuela", name_ar: "فنزويلا" },
  "Venezuela (Bolivarian Republic of)": { lat: 6.4, lng: -66.6, region: "americas", name_en: "Venezuela", name_fr: "Venezuela", name_ar: "فنزويلا" },
  "Ecuador": { lat: -1.8, lng: -78.2, region: "americas", name_en: "Ecuador", name_fr: "Équateur", name_ar: "الإكوادور" },
  "Mexico": { lat: 23.6, lng: -102.6, region: "americas", name_en: "Mexico", name_fr: "Mexique", name_ar: "المكسيك" },
  "Guatemala": { lat: 15.8, lng: -90.2, region: "americas", name_en: "Guatemala", name_fr: "Guatemala", name_ar: "غواتيمالا" },
  "Honduras": { lat: 15.2, lng: -86.2, region: "americas", name_en: "Honduras", name_fr: "Honduras", name_ar: "هندوراس" },
  "Dominican Republic": { lat: 18.7, lng: -70.2, region: "americas", name_en: "Dominican Republic", name_fr: "République Dominicaine", name_ar: "جمهورية الدومينيكان" },
  "Cuba": { lat: 21.5, lng: -79.5, region: "americas", name_en: "Cuba", name_fr: "Cuba", name_ar: "كوبا" },
  "United States of America": { lat: 37.1, lng: -95.7, region: "americas", name_en: "United States", name_fr: "États-Unis", name_ar: "الولايات المتحدة" },
  "United States": { lat: 37.1, lng: -95.7, region: "americas", name_en: "United States", name_fr: "États-Unis", name_ar: "الولايات المتحدة" },
  "Canada": { lat: 56.1, lng: -106.3, region: "americas", name_en: "Canada", name_fr: "Canada", name_ar: "كندا" },
  "Argentina": { lat: -38.4, lng: -63.6, region: "americas", name_en: "Argentina", name_fr: "Argentine", name_ar: "الأرجنتين" },

  // ── EUROPE ───────────────────────────────────────────────────
  "Ukraine": { lat: 48.4, lng: 31.2, region: "europe", name_en: "Ukraine", name_fr: "Ukraine", name_ar: "أوكرانيا" },
  "France": { lat: 46.2, lng: 2.2, region: "europe", name_en: "France", name_fr: "France", name_ar: "فرنسا" },
  "Germany": { lat: 51.2, lng: 10.5, region: "europe", name_en: "Germany", name_fr: "Allemagne", name_ar: "ألمانيا" },
  "United Kingdom": { lat: 55.4, lng: -3.4, region: "europe", name_en: "United Kingdom", name_fr: "Royaume-Uni", name_ar: "المملكة المتحدة" },
  "Poland": { lat: 51.9, lng: 19.1, region: "europe", name_en: "Poland", name_fr: "Pologne", name_ar: "بولندا" },
  "Romania": { lat: 45.9, lng: 24.9, region: "europe", name_en: "Romania", name_fr: "Roumanie", name_ar: "رومانيا" },
  "Serbia": { lat: 44.0, lng: 21.0, region: "europe", name_en: "Serbia", name_fr: "Serbie", name_ar: "صربيا" },

  // ── OCEANIA ──────────────────────────────────────────────────
  "Australia": { lat: -25.3, lng: 133.8, region: "oceania", name_en: "Australia", name_fr: "Australie", name_ar: "أستراليا" },
  "Fiji": { lat: -17.7, lng: 178.1, region: "oceania", name_en: "Fiji", name_fr: "Fidji", name_ar: "فيجي" },
  "Solomon Islands": { lat: -9.6, lng: 160.2, region: "oceania", name_en: "Solomon Islands", name_fr: "Îles Salomon", name_ar: "جزر سليمان" },
};

// Fuzzy lookup: try exact match, then partial match
export function findCountry(name: string): CountryGeo | null {
  // Exact match
  if (COUNTRIES[name]) return COUNTRIES[name];

  // Case-insensitive exact
  const lower = name.toLowerCase();
  for (const [key, val] of Object.entries(COUNTRIES)) {
    if (key.toLowerCase() === lower) return val;
  }

  // Partial: the RSS name contains a known key (e.g. "the Democratic Republic of the Congo")
  for (const [key, val] of Object.entries(COUNTRIES)) {
    if (lower.includes(key.toLowerCase()) || key.toLowerCase().includes(lower)) return val;
  }

  return null;
}
