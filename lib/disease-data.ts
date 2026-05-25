export interface DiseaseInfo {
  name_en: string;
  name_fr: string;
  name_ar: string;
}

// Keys: lowercase normalized English name (as it appears in WHO DON titles)
// Partial/prefix matching is used, so "avian influenza" matches "Avian Influenza A(H5N1)"
const DISEASE_MAP: Array<{ patterns: string[]; info: DiseaseInfo }> = [
  {
    patterns: ["mpox", "monkeypox"],
    info: { name_en: "Mpox", name_fr: "Mpox", name_ar: "جدري القرود" },
  },
  {
    patterns: ["ebola"],
    info: { name_en: "Ebola virus disease", name_fr: "Maladie à virus Ebola", name_ar: "مرض فيروس إيبولا" },
  },
  {
    patterns: ["marburg"],
    info: { name_en: "Marburg virus disease", name_fr: "Maladie à virus Marburg", name_ar: "مرض فيروس ماربورغ" },
  },
  {
    patterns: ["cholera"],
    info: { name_en: "Cholera", name_fr: "Choléra", name_ar: "الكوليرا" },
  },
  {
    patterns: ["avian influenza", "h5n1", "h5n2", "h5n5", "h5n6", "h7n9", "h9n2", "h3n8", "h10n3"],
    info: { name_en: "Avian Influenza", name_fr: "Grippe aviaire", name_ar: "إنفلونزا الطيور" },
  },
  {
    // MERS must be before generic "coronavirus" to avoid misclassification
    patterns: ["mers", "middle east respiratory"],
    info: { name_en: "MERS-CoV", name_fr: "MERS-CoV", name_ar: "فيروس كورونا (متلازمة الشرق الأوسط)" },
  },
  {
    patterns: ["influenza"],
    info: { name_en: "Influenza", name_fr: "Grippe", name_ar: "الإنفلونزا" },
  },
  {
    patterns: ["covid-19", "covid19", "sars-cov-2", "coronavirus"],
    info: { name_en: "COVID-19", name_fr: "COVID-19", name_ar: "كوفيد-19" },
  },
  {
    patterns: ["dengue"],
    info: { name_en: "Dengue fever", name_fr: "Dengue", name_ar: "حمى الضنك" },
  },
  {
    patterns: ["yellow fever"],
    info: { name_en: "Yellow fever", name_fr: "Fièvre jaune", name_ar: "الحمى الصفراء" },
  },
  {
    patterns: ["lassa"],
    info: { name_en: "Lassa fever", name_fr: "Fièvre de Lassa", name_ar: "حمى لاسا" },
  },
  {
    patterns: ["meningitis", "meningococcal"],
    info: { name_en: "Meningitis", name_fr: "Méningite", name_ar: "التهاب السحايا" },
  },
  {
    patterns: ["nipah"],
    info: { name_en: "Nipah virus", name_fr: "Virus Nipah", name_ar: "فيروس نيباه" },
  },
  {
    patterns: ["plague"],
    info: { name_en: "Plague", name_fr: "Peste", name_ar: "الطاعون" },
  },
  {
    patterns: ["typhoid"],
    info: { name_en: "Typhoid fever", name_fr: "Fièvre typhoïde", name_ar: "حمى التيفوئيد" },
  },
  {
    patterns: ["measles"],
    info: { name_en: "Measles", name_fr: "Rougeole", name_ar: "الحصبة" },
  },
  {
    patterns: ["polio", "poliovirus"],
    info: { name_en: "Polio", name_fr: "Poliomyélite", name_ar: "شلل الأطفال" },
  },
  {
    patterns: ["malaria"],
    info: { name_en: "Malaria", name_fr: "Paludisme", name_ar: "الملاريا" },
  },
  {
    patterns: ["rabies"],
    info: { name_en: "Rabies", name_fr: "Rage", name_ar: "داء الكلب" },
  },
  {
    patterns: ["anthrax"],
    info: { name_en: "Anthrax", name_fr: "Charbon bactéridien", name_ar: "الجمرة الخبيثة" },
  },
  {
    patterns: ["chikungunya"],
    info: { name_en: "Chikungunya", name_fr: "Chikungunya", name_ar: "حمى تشيكونغونيا" },
  },
  {
    patterns: ["zika"],
    info: { name_en: "Zika virus", name_fr: "Virus Zika", name_ar: "فيروس زيكا" },
  },
  {
    patterns: ["hepatitis"],
    info: { name_en: "Hepatitis", name_fr: "Hépatite", name_ar: "التهاب الكبد" },
  },
  {
    patterns: ["rift valley"],
    info: { name_en: "Rift Valley fever", name_fr: "Fièvre de la Vallée du Rift", name_ar: "حمى الوادي المتصدع" },
  },
  {
    patterns: ["crimean-congo", "cchf"],
    info: { name_en: "Crimean-Congo haemorrhagic fever", name_fr: "Fièvre hémorragique de Crimée-Congo", name_ar: "حمى القرم-الكونغو النزفية" },
  },
  {
    patterns: ["hantavirus"],
    info: { name_en: "Hantavirus", name_fr: "Hantavirus", name_ar: "فيروس هانتا" },
  },
  {
    patterns: ["sudan virus", "bundibugyo"],
    info: { name_en: "Ebola virus disease", name_fr: "Maladie à virus Ebola", name_ar: "مرض فيروس إيبولا" },
  },
  {
    patterns: ["diphtheria"],
    info: { name_en: "Diphtheria", name_fr: "Diphtérie", name_ar: "الخناق" },
  },
  {
    patterns: ["pertussis", "whooping cough"],
    info: { name_en: "Pertussis", name_fr: "Coqueluche", name_ar: "السعال الديكي" },
  },
];

export function normalizeDisease(rawName: string): DiseaseInfo {
  const lower = rawName.toLowerCase();
  for (const entry of DISEASE_MAP) {
    if (entry.patterns.some((p) => lower.includes(p))) {
      return entry.info;
    }
  }
  // Fallback: use the raw name as-is for all languages
  return { name_en: rawName, name_fr: rawName, name_ar: rawName };
}
