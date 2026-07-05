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
  "Singapore": { lat: 1.35, lng: 103.8, region: "asia", name_en: "Singapore", name_fr: "Singapour", name_ar: "سنغافورة" },
  "Hong Kong SAR": { lat: 22.3, lng: 114.2, region: "asia", name_en: "Hong Kong SAR", name_fr: "Hong Kong (Chine)", name_ar: "هونغ كونغ" },
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
  "Italy": { lat: 41.9, lng: 12.6, region: "europe", name_en: "Italy", name_fr: "Italie", name_ar: "إيطاليا" },
  "Spain": { lat: 40.5, lng: -3.7, region: "europe", name_en: "Spain", name_fr: "Espagne", name_ar: "إسبانيا" },
  "Netherlands": { lat: 52.1, lng: 5.3, region: "europe", name_en: "Netherlands", name_fr: "Pays-Bas", name_ar: "هولندا" },
  "Belgium": { lat: 50.5, lng: 4.5, region: "europe", name_en: "Belgium", name_fr: "Belgique", name_ar: "بلجيكا" },
  "Sweden": { lat: 60.1, lng: 18.6, region: "europe", name_en: "Sweden", name_fr: "Suède", name_ar: "السويد" },
  "Norway": { lat: 60.5, lng: 8.5, region: "europe", name_en: "Norway", name_fr: "Norvège", name_ar: "النرويج" },
  "Denmark": { lat: 56.3, lng: 9.5, region: "europe", name_en: "Denmark", name_fr: "Danemark", name_ar: "الدنمارك" },
  "Austria": { lat: 47.5, lng: 14.6, region: "europe", name_en: "Austria", name_fr: "Autriche", name_ar: "النمسا" },
  "Switzerland": { lat: 46.8, lng: 8.2, region: "europe", name_en: "Switzerland", name_fr: "Suisse", name_ar: "سويسرا" },
  "Greece": { lat: 39.1, lng: 21.8, region: "europe", name_en: "Greece", name_fr: "Grèce", name_ar: "اليونان" },
  "Portugal": { lat: 39.4, lng: -8.2, region: "europe", name_en: "Portugal", name_fr: "Portugal", name_ar: "البرتغال" },
  "Czech Republic": { lat: 49.8, lng: 15.5, region: "europe", name_en: "Czech Republic", name_fr: "Tchéquie", name_ar: "التشيك" },
  "Czechia": { lat: 49.8, lng: 15.5, region: "europe", name_en: "Czech Republic", name_fr: "Tchéquie", name_ar: "التشيك" },
  "Hungary": { lat: 47.2, lng: 19.5, region: "europe", name_en: "Hungary", name_fr: "Hongrie", name_ar: "المجر" },
  "Bulgaria": { lat: 42.7, lng: 25.5, region: "europe", name_en: "Bulgaria", name_fr: "Bulgarie", name_ar: "بلغاريا" },
  "Croatia": { lat: 45.1, lng: 15.2, region: "europe", name_en: "Croatia", name_fr: "Croatie", name_ar: "كرواتيا" },
  "Slovakia": { lat: 48.7, lng: 19.7, region: "europe", name_en: "Slovakia", name_fr: "Slovaquie", name_ar: "سلوفاكيا" },
  "Finland": { lat: 61.9, lng: 25.7, region: "europe", name_en: "Finland", name_fr: "Finlande", name_ar: "فنلندا" },
  "Ireland": { lat: 53.4, lng: -8.2, region: "europe", name_en: "Ireland", name_fr: "Irlande", name_ar: "أيرلندا" },
  "Belarus": { lat: 53.7, lng: 27.9, region: "europe", name_en: "Belarus", name_fr: "Biélorussie", name_ar: "بيلاروسيا" },
  "Moldova": { lat: 47.4, lng: 28.4, region: "europe", name_en: "Moldova", name_fr: "Moldavie", name_ar: "مولدوفا" },
  "Republic of Moldova": { lat: 47.4, lng: 28.4, region: "europe", name_en: "Moldova", name_fr: "Moldavie", name_ar: "مولدوفا" },
  "North Macedonia": { lat: 41.6, lng: 21.7, region: "europe", name_en: "North Macedonia", name_fr: "Macédoine du Nord", name_ar: "مقدونيا الشمالية" },
  "Bosnia and Herzegovina": { lat: 43.9, lng: 17.7, region: "europe", name_en: "Bosnia", name_fr: "Bosnie-Herzégovine", name_ar: "البوسنة والهرسك" },
  "Albania": { lat: 41.2, lng: 20.2, region: "europe", name_en: "Albania", name_fr: "Albanie", name_ar: "ألبانيا" },
  "Kosovo": { lat: 42.6, lng: 20.9, region: "europe", name_en: "Kosovo", name_fr: "Kosovo", name_ar: "كوسوفو" },
  "Georgia": { lat: 42.3, lng: 43.4, region: "europe", name_en: "Georgia", name_fr: "Géorgie", name_ar: "جورجيا" },
  "Armenia": { lat: 40.1, lng: 45.0, region: "europe", name_en: "Armenia", name_fr: "Arménie", name_ar: "أرمينيا" },

  // ── OCEANIA ──────────────────────────────────────────────────
  "Australia": { lat: -25.3, lng: 133.8, region: "oceania", name_en: "Australia", name_fr: "Australie", name_ar: "أستراليا" },
  "Fiji": { lat: -17.7, lng: 178.1, region: "oceania", name_en: "Fiji", name_fr: "Fidji", name_ar: "فiجي" },
  "Solomon Islands": { lat: -9.6, lng: 160.2, region: "oceania", name_en: "Solomon Islands", name_fr: "Îles Salomon", name_ar: "جزر سليمان" },
  "New Zealand": { lat: -40.9, lng: 174.9, region: "oceania", name_en: "New Zealand", name_fr: "Nouvelle-Zélande", name_ar: "نيوزيلندا" },

  // ── MIDDLE EAST (additional) ──────────────────────────────────
  "Kuwait": { lat: 29.3, lng: 47.5, region: "asia", name_en: "Kuwait", name_fr: "Koweït", name_ar: "الكويت" },
  "Qatar": { lat: 25.4, lng: 51.2, region: "asia", name_en: "Qatar", name_fr: "Qatar", name_ar: "قطر" },
  "United Arab Emirates": { lat: 23.4, lng: 53.8, region: "asia", name_en: "UAE", name_fr: "Émirats arabes unis", name_ar: "الإمارات" },
  "Oman": { lat: 21.5, lng: 55.9, region: "asia", name_en: "Oman", name_fr: "Oman", name_ar: "عُمان" },
  "Bahrain": { lat: 26.0, lng: 50.6, region: "asia", name_en: "Bahrain", name_fr: "Bahreïn", name_ar: "البحرين" },
  "Israel": { lat: 31.0, lng: 35.0, region: "asia", name_en: "Israel", name_fr: "Israël", name_ar: "إسرائيل" },
  "State of Palestine": { lat: 31.9, lng: 35.2, region: "asia", name_en: "Palestine", name_fr: "Palestine", name_ar: "فلسطين" },
  "Palestine": { lat: 31.9, lng: 35.2, region: "asia", name_en: "Palestine", name_fr: "Palestine", name_ar: "فلسطين" },
  "Sri Lanka": { lat: 7.9, lng: 80.8, region: "asia", name_en: "Sri Lanka", name_fr: "Sri Lanka", name_ar: "سريلانكا" },
  "Mongolia": { lat: 46.9, lng: 103.8, region: "asia", name_en: "Mongolia", name_fr: "Mongolie", name_ar: "منغوليا" },
  "Kyrgyzstan": { lat: 41.2, lng: 74.8, region: "asia", name_en: "Kyrgyzstan", name_fr: "Kirghizistan", name_ar: "قيرغيزستان" },
  "Turkmenistan": { lat: 38.97, lng: 59.56, region: "asia", name_en: "Turkmenistan", name_fr: "Turkménistan", name_ar: "تركمانستان" },
  "North Korea": { lat: 40.3, lng: 127.5, region: "asia", name_en: "North Korea", name_fr: "Corée du Nord", name_ar: "كوريا الشمالية" },
  "Democratic People's Republic of Korea": { lat: 40.3, lng: 127.5, region: "asia", name_en: "North Korea", name_fr: "Corée du Nord", name_ar: "كوريا الشمالية" },
  "Republic of Korea": { lat: 35.9, lng: 127.8, region: "asia", name_en: "South Korea", name_fr: "Corée du Sud", name_ar: "كوريا الجنوبية" },
  "South Korea": { lat: 35.9, lng: 127.8, region: "asia", name_en: "South Korea", name_fr: "Corée du Sud", name_ar: "كوريا الجنوبية" },
  "Japan": { lat: 36.2, lng: 138.3, region: "asia", name_en: "Japan", name_fr: "Japon", name_ar: "اليابان" },

  // ── AMERICAS (additional) ─────────────────────────────────────
  "Chile": { lat: -35.7, lng: -71.5, region: "americas", name_en: "Chile", name_fr: "Chili", name_ar: "تشيلي" },
  "Paraguay": { lat: -23.4, lng: -58.4, region: "americas", name_en: "Paraguay", name_fr: "Paraguay", name_ar: "باراغواي" },
  "Uruguay": { lat: -32.5, lng: -55.8, region: "americas", name_en: "Uruguay", name_fr: "Uruguay", name_ar: "أوروغواي" },
  "Panama": { lat: 8.5, lng: -80.8, region: "americas", name_en: "Panama", name_fr: "Panama", name_ar: "بنما" },
  "Costa Rica": { lat: 9.7, lng: -83.8, region: "americas", name_en: "Costa Rica", name_fr: "Costa Rica", name_ar: "كوستاريكا" },
  "Nicaragua": { lat: 12.9, lng: -85.2, region: "americas", name_en: "Nicaragua", name_fr: "Nicaragua", name_ar: "نيكاراغوا" },
  "El Salvador": { lat: 13.8, lng: -88.9, region: "americas", name_en: "El Salvador", name_fr: "Salvador", name_ar: "السلفادور" },
  "Trinidad and Tobago": { lat: 10.7, lng: -61.2, region: "americas", name_en: "Trinidad and Tobago", name_fr: "Trinité-et-Tobago", name_ar: "ترينيداد وتوباغو" },
  "Jamaica": { lat: 18.1, lng: -77.3, region: "americas", name_en: "Jamaica", name_fr: "Jamaïque", name_ar: "جامايكا" },

  // ── AFRICA (additional) ───────────────────────────────────────
  "Eritrea": { lat: 15.2, lng: 39.8, region: "africa", name_en: "Eritrea", name_fr: "Érythrée", name_ar: "إريتريا" },
  "Djibouti": { lat: 11.8, lng: 42.6, region: "africa", name_en: "Djibouti", name_fr: "Djibouti", name_ar: "جيبوتي" },
  "Mauritania": { lat: 21.0, lng: -10.9, region: "africa", name_en: "Mauritania", name_fr: "Mauritanie", name_ar: "موريتانيا" },
  "Cape Verde": { lat: 16.0, lng: -24.0, region: "africa", name_en: "Cape Verde", name_fr: "Cap-Vert", name_ar: "الرأس الأخضر" },
  "Cabo Verde": { lat: 16.0, lng: -24.0, region: "africa", name_en: "Cape Verde", name_fr: "Cap-Vert", name_ar: "الرأس الأخضر" },
  "Eswatini": { lat: -26.5, lng: 31.5, region: "africa", name_en: "Eswatini", name_fr: "Eswatini", name_ar: "إسواتيني" },
  "Lesotho": { lat: -29.6, lng: 28.2, region: "africa", name_en: "Lesotho", name_fr: "Lesotho", name_ar: "ليسوتو" },
  "Botswana": { lat: -22.3, lng: 24.7, region: "africa", name_en: "Botswana", name_fr: "Botswana", name_ar: "بوتسوانا" },
  "Namibia": { lat: -22.9, lng: 18.5, region: "africa", name_en: "Namibia", name_fr: "Namibie", name_ar: "ناميبيا" },

  // ── ADDITIONAL ASIA ───────────────────────────────────────────
  "Timor-Leste": { lat: -8.9, lng: 125.7, region: "asia", name_en: "Timor-Leste", name_fr: "Timor oriental", name_ar: "تيمور الشرقية" },
  "Democratic Timor-Leste": { lat: -8.9, lng: 125.7, region: "asia", name_en: "Timor-Leste", name_fr: "Timor oriental", name_ar: "تيمور الشرقية" },
  "Kingdom of Saudi Arabia": { lat: 23.9, lng: 45.1, region: "asia", name_en: "Saudi Arabia", name_fr: "Arabie Saoudite", name_ar: "المملكة العربية السعودية" },

  // ── FRENCH TERRITORIES ────────────────────────────────────────
  "La Réunion": { lat: -21.1, lng: 55.5, region: "africa", name_en: "Réunion", name_fr: "La Réunion", name_ar: "لا ريونيون" },
  "Reunion": { lat: -21.1, lng: 55.5, region: "africa", name_en: "Réunion", name_fr: "La Réunion", name_ar: "لا ريونيون" },
  "Mayotte": { lat: -12.8, lng: 45.2, region: "africa", name_en: "Mayotte", name_fr: "Mayotte", name_ar: "مايوت" },
  "French Polynesia": { lat: -17.7, lng: -149.4, region: "oceania", name_en: "French Polynesia", name_fr: "Polynésie française", name_ar: "بولينيزيا الفرنسية" },
  "New Caledonia": { lat: -20.9, lng: 165.6, region: "oceania", name_en: "New Caledonia", name_fr: "Nouvelle-Calédonie", name_ar: "كاليدونيا الجديدة" },

  // ── MULTI-COUNTRY / GLOBAL ────────────────────────────────────
  "EU/EEA": { lat: 50.85, lng: 4.35, region: "europe", name_en: "EU/EEA", name_fr: "UE/EEE", name_ar: "الاتحاد الأوروبي" },
  "Multi-country": { lat: 10.0, lng: -25.0, region: "africa", name_en: "Multiple countries", name_fr: "Plusieurs pays", name_ar: "دول متعددة" },
  "Global": { lat: 10.0, lng: -25.0, region: "africa", name_en: "Global", name_fr: "Mondial", name_ar: "عالمي" },
  "Global situation": { lat: 10.0, lng: -25.0, region: "africa", name_en: "Global", name_fr: "Mondial", name_ar: "عالمي" },
  "Global Situation": { lat: 10.0, lng: -25.0, region: "africa", name_en: "Global", name_fr: "Mondial", name_ar: "عالمي" },
  "Global update": { lat: 10.0, lng: -25.0, region: "africa", name_en: "Global", name_fr: "Mondial", name_ar: "عالمي" },
  "Global Update": { lat: 10.0, lng: -25.0, region: "africa", name_en: "Global", name_fr: "Mondial", name_ar: "عالمي" },
  "African Region": { lat: 0.0, lng: 20.0, region: "africa", name_en: "Africa (regional)", name_fr: "Région africaine", name_ar: "المنطقة الأفريقية" },
  "African Region (AFRO)": { lat: 0.0, lng: 20.0, region: "africa", name_en: "Africa (regional)", name_fr: "Région africaine", name_ar: "المنطقة الأفريقية" },
  "Region of the Americas": { lat: 0.0, lng: -60.0, region: "americas", name_en: "Americas (regional)", name_fr: "Région des Amériques", name_ar: "منطقة الأمريكتين" },
  // ── Territories / small island states absent from the initial list ─────────
  "French Guiana":  { lat: 3.9, lng: -53.1, region: "americas", name_en: "French Guiana", name_fr: "Guyane française", name_ar: "غويانا الفرنسية" },
  "Guyane française": { lat: 3.9, lng: -53.1, region: "americas", name_en: "French Guiana", name_fr: "Guyane française", name_ar: "غويانا الفرنسية" },
  "Mauritius":      { lat: -20.3, lng: 57.6, region: "africa", name_en: "Mauritius", name_fr: "Maurice", name_ar: "موريشيوس" },
  "Seychelles":     { lat: -4.7, lng: 55.5, region: "africa", name_en: "Seychelles", name_fr: "Seychelles", name_ar: "سيشل" },
  "Suriname":       { lat: 3.9, lng: -56.0, region: "americas", name_en: "Suriname", name_fr: "Suriname", name_ar: "سورينام" },
  "Vanuatu":        { lat: -15.4, lng: 166.9, region: "oceania", name_en: "Vanuatu", name_fr: "Vanuatu", name_ar: "فانواتو" },
};

// Common abbreviations / display names → canonical COUNTRIES key
const COUNTRY_ALIASES: Record<string, string> = {
  "drc":                            "Democratic Republic of the Congo",
  "rdc":                            "Democratic Republic of the Congo",
  "dr congo":                       "Democratic Republic of the Congo",
  "democratic republic of congo":   "Democratic Republic of the Congo",
  "congo dr":                       "Democratic Republic of the Congo",
  "uk":                             "United Kingdom",
  "usa":                            "United States of America",
  "uae":                            "United Arab Emirates",
  "united kingdom of great britain and northern ireland": "United Kingdom",
};

// Synthetic COUNTRIES entries that stand in for "not a single real place"
// (multi-country DONs, global situation updates, regional roll-ups). Must be
// excluded when scanning free text for "which countries are named here" —
// otherwise boilerplate like "the global cholera situation" or "the African
// Region recorded..." spuriously matches on nearly every article.
const AGGREGATE_NAMES_EN = new Set([
  "Multiple countries", "Global", "Africa (regional)", "Americas (regional)",
]);

export function isAggregateCountry(geo: CountryGeo): boolean {
  return AGGREGATE_NAMES_EN.has(geo.name_en);
}

// Sorted longest-first so e.g. "Democratic Republic of the Congo" is checked
// (and matched) before the shorter "Congo".
const COUNTRY_KEYS_BY_LENGTH = Object.keys(COUNTRIES).sort((a, b) => b.length - a.length);

// Shorthand worth recognizing in free text beyond the canonical COUNTRIES
// keys (these aren't legitimate WHO DON title spellings, so they don't
// belong in COUNTRY_ALIASES above, which is keyed for findCountry()).
const TEXT_ALIASES: Record<string, string> = {
  " ksa ":       "Saudi Arabia",
  " saudi ":     "Saudi Arabia",
  " uae ":       "United Arab Emirates",
  " emirates ":  "United Arab Emirates",
  " west bank":  "State of Palestine",
  " gaza ":      "State of Palestine",
  " palestine ": "State of Palestine",
};

// Scans free text for every known, real (non-aggregate) country mentioned,
// deduped by canonical identity. Used to find which countries a multi-country
// report actually names — e.g. distinguishing the 5 countries a WHO DON gives
// their own case/death figures to from the 26 others only folded into a
// regional roll-up total.
export function findMentionedCountries(text: string): CountryGeo[] {
  const lower = ` ${text.toLowerCase()} `;
  const found: CountryGeo[] = [];
  const seen = new Set<string>();

  const addIfNew = (geo: CountryGeo | undefined | null) => {
    if (geo && !isAggregateCountry(geo) && !seen.has(geo.name_en)) {
      found.push(geo);
      seen.add(geo.name_en);
    }
  };

  for (const [alias, canonicalKey] of Object.entries(TEXT_ALIASES)) {
    if (lower.includes(alias)) addIfNew(COUNTRIES[canonicalKey]);
  }
  for (const key of COUNTRY_KEYS_BY_LENGTH) {
    if (lower.includes(` ${key.toLowerCase()} `) || lower.includes(` ${key.toLowerCase()},`)) {
      addIfNew(COUNTRIES[key]);
    }
  }
  return found;
}

// Matches WHO's "Name (N), Name (N), and Name (N)" list format (seen in some
// multi-country food-safety/toxin DONs, e.g. "Austria (9), Brazil (5), China,
// Hong Kong SAR, (1), ... and the United Kingdom of Great Britain and
// Northern Ireland (61)"). Anchors on each "(N)" and looks backward for the
// country name immediately preceding it, rather than forward from each
// country mention — a long article can mention a country elsewhere for
// unrelated reasons, but a number in parentheses right after a country name
// in this list format is unambiguous. Includes COUNTRY_ALIASES (not just
// COUNTRIES keys) so official long-form names (e.g. the UK's) resolve too.
// Cases only — this format hasn't been observed pairing deaths per country.
const PAREN_ALIAS_KEYS_BY_LENGTH = [...Object.keys(COUNTRIES), ...Object.keys(COUNTRY_ALIASES)].sort(
  (a, b) => b.length - a.length
);

// A bare "Name (N)" isn't necessarily a case count — e.g. DON586 (Influenza)
// has "22 sequences of subclade K have been reported in GISAID from Nepal
// (1), India (4) and Thailand (17)", which is a genomic-sequence tally, not
// disease cases. Require a case-related word somewhere in a window before
// the whole list before trusting any match in it.
const PAREN_CASE_CONTEXT_SIGNALS = ["case", "confirmed", "suspected", "intoxication"];
const PAREN_CASE_CONTEXT_WINDOW = 220;

// Phrases WHO uses to flag a figure as not part of the official count (e.g.
// DON596: "In other countries, including Denmark (32) and the Netherlands
// (221) the number of suspected cases is based on self-reporting and is
// therefore not comparable with the INFOSAN case definition."). Checked only
// up to the next sentence boundary — Spain/UK's own "(N)" entries end their
// sentence with a period before this disclaimer sentence even starts, so a
// naive fixed-size lookahead would wrongly disclaim them too (tested and
// caught via scripts/dryrun-check-4-older-dons-2026-07-05.ts).
const PAREN_DISCLAIMER_SIGNALS = ["not comparable", "self-report", "self report"];
const PAREN_DISCLAIMER_MAX_WINDOW = 250;

export function findCountryParentheticals(text: string): Map<string, number> {
  const result = new Map<string, number>();
  const re = /\(\s*(\d[\d,]*)\s*\)/g;

  for (const m of text.matchAll(re)) {
    const idx = m.index ?? 0;

    const caseContext = text.slice(Math.max(0, idx - PAREN_CASE_CONTEXT_WINDOW), idx).toLowerCase();
    if (!PAREN_CASE_CONTEXT_SIGNALS.some((s) => caseContext.includes(s))) continue;

    const before = text
      .slice(Math.max(0, idx - 80), idx)
      .replace(/,\s*$/, "")
      .replace(/\s+and\s*$/i, "")
      .trim()
      .toLowerCase();

    const lookahead = text.slice(idx, idx + PAREN_DISCLAIMER_MAX_WINDOW);
    const sentenceEnd = lookahead.indexOf(".");
    const after = (sentenceEnd === -1 ? lookahead : lookahead.slice(0, sentenceEnd)).toLowerCase();
    if (PAREN_DISCLAIMER_SIGNALS.some((s) => after.includes(s))) continue;

    for (const key of PAREN_ALIAS_KEYS_BY_LENGTH) {
      if (before.endsWith(key.toLowerCase())) {
        const geo = findCountry(key);
        if (geo && !isAggregateCountry(geo) && !result.has(geo.name_en)) {
          result.set(geo.name_en, parseInt(m[1].replace(/,/g, ""), 10));
        }
        break;
      }
    }
  }
  return result;
}

// Fuzzy lookup: try exact match, alias, name_en, then partial match
export function findCountry(name: string): CountryGeo | null {
  if (!name) return null;

  // Exact match on canonical key
  if (COUNTRIES[name]) return COUNTRIES[name];

  const lower = name.toLowerCase();

  // Alias lookup (abbreviations + display names like "DR Congo")
  const aliasKey = COUNTRY_ALIASES[lower];
  if (aliasKey) return COUNTRIES[aliasKey] ?? null;

  // Case-insensitive exact match on canonical key
  for (const [key, val] of Object.entries(COUNTRIES)) {
    if (key.toLowerCase() === lower) return val;
  }

  // Match on display name (name_en) — fixes double-lookup when routes store geo.name_en
  for (const [, val] of Object.entries(COUNTRIES)) {
    if (val.name_en.toLowerCase() === lower) return val;
  }

  // Partial: the RSS name contains a known key (e.g. "the Democratic Republic of the Congo")
  for (const [key, val] of Object.entries(COUNTRIES)) {
    if (lower.includes(key.toLowerCase()) || key.toLowerCase().includes(lower)) return val;
  }

  return null;
}

// ISO 3166-1 alpha-2 → HealthWatch region
// Used to geo-detect the visitor's region from the Vercel x-vercel-ip-country header.
export const ISO_REGION: Record<string, "africa" | "asia" | "americas" | "europe" | "oceania"> = {
  // ── AFRICA ──────────────────────────────────────────────────────────────────
  DZ: "africa", AO: "africa", BJ: "africa", BW: "africa", BF: "africa",
  BI: "africa", CM: "africa", CV: "africa", CF: "africa", TD: "africa",
  KM: "africa", CG: "africa", CD: "africa", CI: "africa", DJ: "africa",
  EG: "africa", GQ: "africa", ER: "africa", SZ: "africa", ET: "africa",
  GA: "africa", GM: "africa", GH: "africa", GN: "africa", GW: "africa",
  KE: "africa", LS: "africa", LR: "africa", LY: "africa", MG: "africa",
  MW: "africa", ML: "africa", MR: "africa", MU: "africa", MA: "africa",
  MZ: "africa", NA: "africa", NE: "africa", NG: "africa", RW: "africa",
  ST: "africa", SN: "africa", SC: "africa", SL: "africa", SO: "africa",
  ZA: "africa", SS: "africa", SD: "africa", TZ: "africa", TG: "africa",
  TN: "africa", UG: "africa", ZM: "africa", ZW: "africa",
  YT: "africa", RE: "africa", EH: "africa", SH: "africa",
  // ── ASIA (incl. Middle East & Central Asia) ──────────────────────────────
  AE: "asia", AF: "asia", AM: "asia", AZ: "asia", BH: "asia", BD: "asia",
  BT: "asia", BN: "asia", KH: "asia", CN: "asia", CY: "asia", GE: "asia",
  HK: "asia", IN: "asia", ID: "asia", IR: "asia", IQ: "asia", IL: "asia",
  JP: "asia", JO: "asia", KZ: "asia", KW: "asia", KG: "asia", LA: "asia",
  LB: "asia", MO: "asia", MY: "asia", MV: "asia", MN: "asia", MM: "asia",
  NP: "asia", KP: "asia", OM: "asia", PK: "asia", PS: "asia", PH: "asia",
  QA: "asia", SA: "asia", SG: "asia", KR: "asia", LK: "asia", SY: "asia",
  TW: "asia", TJ: "asia", TH: "asia", TL: "asia", TR: "asia", TM: "asia",
  UZ: "asia", VN: "asia", YE: "asia",
  // ── EUROPE ───────────────────────────────────────────────────────────────
  AL: "europe", AD: "europe", AT: "europe", BY: "europe", BE: "europe",
  BA: "europe", BG: "europe", HR: "europe", CZ: "europe", DK: "europe",
  EE: "europe", FI: "europe", FR: "europe", DE: "europe", GR: "europe",
  HU: "europe", IS: "europe", IE: "europe", IT: "europe", XK: "europe",
  LV: "europe", LI: "europe", LT: "europe", LU: "europe", MK: "europe",
  MT: "europe", MD: "europe", MC: "europe", ME: "europe", NL: "europe",
  NO: "europe", PL: "europe", PT: "europe", RO: "europe", RU: "europe",
  SM: "europe", RS: "europe", SK: "europe", SI: "europe", ES: "europe",
  SE: "europe", CH: "europe", UA: "europe", GB: "europe", VA: "europe",
  AX: "europe", GG: "europe", JE: "europe", IM: "europe", GI: "europe",
  FO: "europe",
  // ── AMERICAS ─────────────────────────────────────────────────────────────
  AG: "americas", AR: "americas", AW: "americas", BS: "americas", BB: "americas",
  BZ: "americas", BO: "americas", BR: "americas", CA: "americas", KY: "americas",
  CL: "americas", CO: "americas", CR: "americas", CU: "americas", DM: "americas",
  DO: "americas", EC: "americas", SV: "americas", GD: "americas", GF: "americas",
  GT: "americas", GY: "americas", HT: "americas", HN: "americas", JM: "americas",
  MX: "americas", MS: "americas", NI: "americas", PA: "americas", PY: "americas",
  PE: "americas", PR: "americas", KN: "americas", LC: "americas", VC: "americas",
  SR: "americas", TT: "americas", TC: "americas", US: "americas", UY: "americas",
  VE: "americas", VI: "americas", VG: "americas", FK: "americas",
  GP: "americas", MQ: "americas", BL: "americas", MF: "americas",
  // ── OCEANIA ──────────────────────────────────────────────────────────────
  AU: "oceania", FJ: "oceania", GU: "oceania", KI: "oceania", MH: "oceania",
  FM: "oceania", NR: "oceania", NC: "oceania", NZ: "oceania", NU: "oceania",
  NF: "oceania", MP: "oceania", PW: "oceania", PG: "oceania", WS: "oceania",
  AS: "oceania", SB: "oceania", TO: "oceania", TV: "oceania", VU: "oceania",
  WF: "oceania", CK: "oceania", PF: "oceania",
};
