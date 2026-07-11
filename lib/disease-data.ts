export type PathogenType = "virus_rna" | "virus_dna" | "bacteria" | "parasite" | "fungus";
export type AppRegion = "africa" | "asia" | "americas" | "europe" | "oceania";
export type TravelerRiskLevel = "high" | "moderate" | "low";
export type TransmissionMode =
  | "contact"       // direct contact with bodily fluids / infected animals
  | "droplet"       // respiratory droplets (< 1 m)
  | "airborne"      // aerosol / long-range
  | "vector"        // arthropod vector (mosquito, tick, sandfly, flea…)
  | "foodborne"     // contaminated food
  | "waterborne"    // contaminated water
  | "sexual"        // sexual transmission
  | "nosocomial"    // healthcare-associated
  | "fomite"        // contaminated surfaces / objects
  | "zoonotic";     // animal reservoir, no sustained human-to-human
export type VaccineStatus = "yes" | "no" | "experimental" | "conditional";
export type TreatmentStatus = "yes" | "no" | "supportive" | "experimental";

export interface DiseaseInfo {
  name_en: string;
  name_fr: string;
  name_es: string;
  name_ar: string;
  name_id: string;

  // Virology / microbiology
  pathogenType: PathogenType;
  family?: string;

  // Epidemiology
  transmission: TransmissionMode[];
  incubationMin?: number;  // days
  incubationMax?: number;  // days

  // Clinical reference (historical / literature, not current outbreak)
  cfr_ref?: string;        // e.g. "25–90 %"
  r0_ref?: string;         // basic reproduction number

  // Control
  vaccine: VaccineStatus;
  vaccineName?: string;
  treatment: TreatmentStatus;

  // Links
  whoFactsheet?: string;

  // Travel health — endemic risk for travelers by broad region
  travelerRisk?: Partial<Record<AppRegion, TravelerRiskLevel>>;
}

const DISEASE_MAP: Array<{ patterns: string[]; info: DiseaseInfo }> = [
  {
    patterns: ["mpox", "monkeypox"],
    info: {
      name_en: "Mpox", name_fr: "Mpox", name_es: "Mpox", name_ar: "جدري القرود", name_id: "Mpox",
      pathogenType: "virus_dna", family: "Poxviridae",
      transmission: ["contact", "droplet", "sexual", "nosocomial"],
      incubationMin: 5, incubationMax: 21,
      cfr_ref: "0.1–10 % (selon le clade)",
      r0_ref: "1.1–2.4",
      vaccine: "yes", vaccineName: "MVA-BN (Jynneos / Imvamune)",
      treatment: "experimental",
      whoFactsheet: "https://www.who.int/news-room/fact-sheets/detail/mpox",
      travelerRisk: { africa: "high", asia: "low", americas: "low", europe: "low" },
    },
  },
  {
    patterns: ["ebola", "bundibugyo"],
    info: {
      name_en: "Ebola virus disease", name_fr: "Maladie à virus Ebola",
      name_es: "Enfermedad por virus del Ébola", name_ar: "مرض فيروس إيبولا",
      name_id: "Penyakit virus Ebola",
      pathogenType: "virus_rna", family: "Filoviridae",
      transmission: ["contact", "nosocomial"],
      incubationMin: 2, incubationMax: 21,
      cfr_ref: "25–90 %",
      r0_ref: "1.5–2.5",
      vaccine: "yes", vaccineName: "Ervebo (Zaïre strain only)",
      treatment: "experimental",
      whoFactsheet: "https://www.who.int/news-room/fact-sheets/detail/ebola-virus-disease",
      travelerRisk: { africa: "high", europe: "low" },
    },
  },
  {
    patterns: ["marburg"],
    info: {
      name_en: "Marburg virus disease", name_fr: "Maladie à virus Marburg",
      name_es: "Enfermedad por virus de Marburgo", name_ar: "مرض فيروس ماربورغ",
      name_id: "Penyakit virus Marburg",
      pathogenType: "virus_rna", family: "Filoviridae",
      transmission: ["contact", "nosocomial"],
      incubationMin: 2, incubationMax: 21,
      cfr_ref: "24–88 %",
      // Seule estimation formelle publiée à ce jour (Ajelli & Merler 2012, PLOS ONE, épidémie Angola 2004-05) — pas un consensus multi-études.
      r0_ref: "1.5–1.6",
      vaccine: "experimental",
      treatment: "supportive",
      whoFactsheet: "https://www.who.int/news-room/fact-sheets/detail/marburg-virus-disease",
      travelerRisk: { africa: "high" },
    },
  },
  {
    patterns: ["cholera"],
    info: {
      name_en: "Cholera", name_fr: "Choléra", name_es: "Cólera", name_ar: "الكوليرا", name_id: "Kolera",
      pathogenType: "bacteria", family: "Vibrionaceae",
      transmission: ["waterborne", "foodborne"],
      incubationMin: 0, incubationMax: 5,
      cfr_ref: "< 1 % si traité; 25–50 % sans traitement",
      r0_ref: "Non pertinent : dépend de l'accès à l'eau potable et à l'assainissement, pas d'une valeur consensuelle",
      vaccine: "yes", vaccineName: "Oral Cholera Vaccine (OCV)",
      treatment: "yes",
      whoFactsheet: "https://www.who.int/news-room/fact-sheets/detail/cholera",
      travelerRisk: { africa: "high", asia: "moderate", americas: "low" },
    },
  },
  {
    patterns: ["avian influenza", "h5n1", "h5n2", "h5n5", "h5n6", "h7n9", "h9n2", "h3n8", "h10n3"],
    info: {
      name_en: "Avian Influenza", name_fr: "Grippe aviaire",
      name_es: "Gripe aviar", name_ar: "إنفلونزا الطيور", name_id: "Flu Burung",
      pathogenType: "virus_rna", family: "Orthomyxoviridae",
      transmission: ["zoonotic", "contact"],
      incubationMin: 2, incubationMax: 8,
      cfr_ref: "~60 % (H5N1 humain)",
      r0_ref: "Aucune transmission interhumaine soutenue observée à ce jour",
      vaccine: "conditional", vaccineName: "Strategic stockpiles — limited use",
      treatment: "yes",
      whoFactsheet: "https://www.who.int/news-room/fact-sheets/detail/influenza-(avian-and-other-zoonotic)",
      travelerRisk: { asia: "high", africa: "moderate" },
    },
  },
  {
    patterns: ["mers", "middle east respiratory"],
    info: {
      name_en: "MERS-CoV", name_fr: "MERS-CoV",
      name_es: "MERS-CoV", name_ar: "فيروس كورونا (متلازمة الشرق الأوسط)", name_id: "MERS-CoV",
      pathogenType: "virus_rna", family: "Coronaviridae",
      transmission: ["zoonotic", "droplet", "nosocomial"],
      incubationMin: 2, incubationMax: 14,
      cfr_ref: "~35 %",
      r0_ref: "0.5–0.9",
      vaccine: "no",
      treatment: "supportive",
      whoFactsheet: "https://www.who.int/news-room/fact-sheets/detail/middle-east-respiratory-syndrome-coronavirus-(mers-cov)",
      travelerRisk: { asia: "high", africa: "low", europe: "low" },
    },
  },
  {
    patterns: ["influenza"],
    info: {
      name_en: "Influenza", name_fr: "Grippe",
      name_es: "Gripe / Influenza", name_ar: "الإنفلونزا", name_id: "Influenza",
      pathogenType: "virus_rna", family: "Orthomyxoviridae",
      transmission: ["airborne", "droplet", "fomite"],
      incubationMin: 1, incubationMax: 4,
      cfr_ref: "< 0,1 % (saisonnier)",
      r0_ref: "1.2–1.4",
      vaccine: "yes",
      treatment: "yes",
      whoFactsheet: "https://www.who.int/news-room/fact-sheets/detail/influenza-(seasonal)",
    },
  },
  {
    patterns: ["covid-19", "covid19", "sars-cov-2", "coronavirus"],
    info: {
      name_en: "COVID-19", name_fr: "COVID-19",
      name_es: "COVID-19", name_ar: "كوفيد-19", name_id: "COVID-19",
      pathogenType: "virus_rna", family: "Coronaviridae",
      transmission: ["airborne", "droplet", "fomite"],
      incubationMin: 1, incubationMax: 14,
      cfr_ref: "Variable selon le variant",
      r0_ref: "≈3 (souche initiale) → ≈5 (Delta) → ≈9–10 (Omicron)",
      vaccine: "yes",
      treatment: "yes",
      whoFactsheet: "https://www.who.int/news-room/fact-sheets/detail/coronavirus-disease-(covid-19)",
    },
  },
  {
    patterns: ["dengue"],
    info: {
      name_en: "Dengue fever", name_fr: "Dengue",
      name_es: "Dengue", name_ar: "حمى الضنك", name_id: "Demam Berdarah Dengue",
      pathogenType: "virus_rna", family: "Flaviviridae",
      transmission: ["vector"],
      incubationMin: 4, incubationMax: 14,
      cfr_ref: "< 1 % (pris en charge); dengue sévère : 2–5 %",
      r0_ref: "2–6",
      vaccine: "yes", vaccineName: "Dengvaxia, Qdenga",
      treatment: "supportive",
      whoFactsheet: "https://www.who.int/news-room/fact-sheets/detail/dengue-and-severe-dengue",
      travelerRisk: { africa: "moderate", asia: "high", americas: "high", oceania: "moderate" },
    },
  },
  {
    patterns: ["yellow fever"],
    info: {
      name_en: "Yellow fever", name_fr: "Fièvre jaune",
      name_es: "Fiebre amarilla", name_ar: "الحمى الصفراء", name_id: "Demam Kuning",
      pathogenType: "virus_rna", family: "Flaviviridae",
      transmission: ["vector"],
      incubationMin: 3, incubationMax: 6,
      cfr_ref: "3–7,5 % (phase toxique : 20–50 %)",
      // Cycle urbain (Aedes aegypti) uniquement — le cycle sylvatique a un R0 différent, non comparable.
      r0_ref: "2–5",
      vaccine: "yes", vaccineName: "YF-Vax / Stamaril (lifelong protection)",
      treatment: "supportive",
      whoFactsheet: "https://www.who.int/news-room/fact-sheets/detail/yellow-fever",
      travelerRisk: { africa: "high", americas: "moderate" },
    },
  },
  {
    patterns: ["lassa"],
    info: {
      name_en: "Lassa fever", name_fr: "Fièvre de Lassa",
      name_es: "Fiebre de Lassa", name_ar: "حمى لاسا", name_id: "Demam Lassa",
      pathogenType: "virus_rna", family: "Arenaviridae",
      transmission: ["contact", "zoonotic", "nosocomial"],
      incubationMin: 6, incubationMax: 21,
      cfr_ref: "~1 % global; 15 % hospitalisé",
      vaccine: "no",
      treatment: "yes", vaccineName: "Ribavirin (early phase)",
      whoFactsheet: "https://www.who.int/news-room/fact-sheets/detail/lassa-fever",
      travelerRisk: { africa: "high" },
    },
  },
  {
    patterns: ["meningitis", "meningococcal"],
    info: {
      name_en: "Meningitis", name_fr: "Méningite",
      name_es: "Meningitis", name_ar: "التهاب السحايا", name_id: "Meningitis",
      pathogenType: "bacteria", family: "Neisseriaceae",
      transmission: ["droplet"],
      incubationMin: 2, incubationMax: 10,
      cfr_ref: "5–15 % (méningococcique)",
      r0_ref: "Non calculé pour la ceinture méningitique africaine dans la littérature actuelle",
      vaccine: "yes",
      treatment: "yes",
      whoFactsheet: "https://www.who.int/news-room/fact-sheets/detail/meningitis",
      travelerRisk: { africa: "high", asia: "low", americas: "low" },
    },
  },
  {
    patterns: ["nipah"],
    info: {
      name_en: "Nipah virus", name_fr: "Virus Nipah",
      name_es: "Virus Nipah", name_ar: "فيروس نيباه", name_id: "Virus Nipah",
      pathogenType: "virus_rna", family: "Paramyxoviridae",
      transmission: ["zoonotic", "contact", "droplet"],
      incubationMin: 4, incubationMax: 14,
      cfr_ref: "40–75 %",
      r0_ref: "0.3–0.5",
      vaccine: "experimental",
      treatment: "supportive",
      whoFactsheet: "https://www.who.int/news-room/fact-sheets/detail/nipah-virus",
      travelerRisk: { asia: "high" },
    },
  },
  {
    patterns: ["plague"],
    info: {
      name_en: "Plague", name_fr: "Peste",
      name_es: "Peste", name_ar: "الطاعون", name_id: "Pes",
      pathogenType: "bacteria", family: "Yersiniaceae",
      transmission: ["vector", "droplet", "contact"],
      incubationMin: 1, incubationMax: 7,
      cfr_ref: "30–100 % (sans traitement)",
      vaccine: "no",
      treatment: "yes",
      whoFactsheet: "https://www.who.int/news-room/fact-sheets/detail/plague",
      travelerRisk: { africa: "moderate", asia: "low", americas: "low" },
    },
  },
  {
    patterns: ["typhoid"],
    info: {
      name_en: "Typhoid fever", name_fr: "Fièvre typhoïde",
      name_es: "Fiebre tifoidea", name_ar: "حمى التيفوئيد", name_id: "Demam Tifoid",
      pathogenType: "bacteria", family: "Enterobacteriaceae",
      transmission: ["waterborne", "foodborne"],
      incubationMin: 6, incubationMax: 30,
      cfr_ref: "< 1 % si traité; 10–30 % sans traitement",
      vaccine: "yes",
      treatment: "yes",
      whoFactsheet: "https://www.who.int/news-room/fact-sheets/detail/typhoid",
      travelerRisk: { africa: "moderate", asia: "high", americas: "low", oceania: "low" },
    },
  },
  {
    patterns: ["measles"],
    info: {
      name_en: "Measles", name_fr: "Rougeole",
      name_es: "Sarampión", name_ar: "الحصبة", name_id: "Campak",
      pathogenType: "virus_rna", family: "Paramyxoviridae",
      transmission: ["airborne", "droplet"],
      incubationMin: 7, incubationMax: 14,
      cfr_ref: "0,1 % (pays à revenus élevés) → 1–5 % (pays à faibles revenus)",
      r0_ref: "12–18",
      vaccine: "yes", vaccineName: "ROR / MMR",
      treatment: "supportive",
      whoFactsheet: "https://www.who.int/news-room/fact-sheets/detail/measles",
      travelerRisk: { africa: "high", asia: "moderate", americas: "low", europe: "low", oceania: "low" },
    },
  },
  {
    patterns: ["polio", "poliovirus"],
    info: {
      name_en: "Polio", name_fr: "Poliomyélite",
      name_es: "Poliomielitis", name_ar: "شلل الأطفال", name_id: "Polio",
      pathogenType: "virus_rna", family: "Picornaviridae",
      transmission: ["foodborne", "waterborne", "fomite"],
      incubationMin: 6, incubationMax: 20,
      cfr_ref: "< 1 % (paralytique : 2–5 %)",
      r0_ref: "5–7",
      vaccine: "yes", vaccineName: "OPV (oral) / IPV (injectable)",
      treatment: "supportive",
      whoFactsheet: "https://www.who.int/news-room/fact-sheets/detail/poliomyelitis",
      travelerRisk: { africa: "moderate", asia: "moderate" },
    },
  },
  {
    patterns: ["malaria"],
    info: {
      name_en: "Malaria", name_fr: "Paludisme",
      name_es: "Malaria / Paludismo", name_ar: "الملاريا", name_id: "Malaria",
      pathogenType: "parasite", family: "Plasmodium spp.",
      transmission: ["vector"],
      incubationMin: 7, incubationMax: 30,
      cfr_ref: "< 1 % si traité; P. falciparum sévère : 15–20 %",
      r0_ref: "Non pertinent : dépend de la densité vectorielle locale, pas d'une propriété intrinsèque du pathogène",
      vaccine: "yes", vaccineName: "RTS,S/AS01 (Mosquirix) / R21",
      treatment: "yes",
      whoFactsheet: "https://www.who.int/news-room/fact-sheets/detail/malaria",
      travelerRisk: { africa: "high", asia: "moderate", americas: "moderate", oceania: "moderate" },
    },
  },
  {
    patterns: ["rabies"],
    info: {
      name_en: "Rabies", name_fr: "Rage",
      name_es: "Rabia", name_ar: "داء الكلب", name_id: "Rabies",
      pathogenType: "virus_rna", family: "Rhabdoviridae",
      transmission: ["contact", "zoonotic"],
      incubationMin: 7, incubationMax: 365,
      cfr_ref: "~100 % (après apparition des symptômes)",
      vaccine: "yes", vaccineName: "Post-exposure prophylaxis (PEP)",
      treatment: "supportive",
      whoFactsheet: "https://www.who.int/news-room/fact-sheets/detail/rabies",
      travelerRisk: { africa: "high", asia: "high", americas: "moderate", europe: "low" },
    },
  },
  {
    patterns: ["anthrax"],
    info: {
      name_en: "Anthrax", name_fr: "Charbon bactéridien",
      name_es: "Ántrax", name_ar: "الجمرة الخبيثة", name_id: "Antraks",
      pathogenType: "bacteria", family: "Bacillaceae",
      transmission: ["contact", "zoonotic"],
      incubationMin: 1, incubationMax: 5,
      cfr_ref: "Cutané < 1 %; inhalation ~80 % (sans traitement)",
      vaccine: "yes", vaccineName: "Military / occupational use",
      treatment: "yes",
      whoFactsheet: "https://www.who.int/news-room/fact-sheets/detail/anthrax",
      travelerRisk: { africa: "low", asia: "low" },
    },
  },
  {
    patterns: ["chikungunya"],
    info: {
      name_en: "Chikungunya", name_fr: "Chikungunya",
      name_es: "Chikungunya", name_ar: "حمى تشيكونغونيا", name_id: "Chikungunya",
      pathogenType: "virus_rna", family: "Togaviridae",
      transmission: ["vector"],
      incubationMin: 2, incubationMax: 12,
      cfr_ref: "< 0,1 %",
      r0_ref: "2.4–4.2",
      vaccine: "yes", vaccineName: "Ixchiq (Valneva, 2023)",
      treatment: "supportive",
      whoFactsheet: "https://www.who.int/news-room/fact-sheets/detail/chikungunya",
      travelerRisk: { africa: "moderate", asia: "moderate", americas: "moderate", oceania: "low", europe: "low" },
    },
  },
  {
    patterns: ["zika"],
    info: {
      name_en: "Zika virus", name_fr: "Virus Zika",
      name_es: "Virus Zika", name_ar: "فيروس زيكا", name_id: "Virus Zika",
      pathogenType: "virus_rna", family: "Flaviviridae",
      transmission: ["vector", "sexual"],
      incubationMin: 3, incubationMax: 14,
      cfr_ref: "< 0,1 % (risque tératogène majeur en grossesse)",
      r0_ref: "1.4–6.6",
      vaccine: "no",
      treatment: "supportive",
      whoFactsheet: "https://www.who.int/news-room/fact-sheets/detail/zika-virus",
      travelerRisk: { americas: "moderate", asia: "low", africa: "low", oceania: "low" },
    },
  },
  {
    patterns: ["hepatitis"],
    info: {
      name_en: "Hepatitis", name_fr: "Hépatite",
      name_es: "Hepatitis", name_ar: "التهاب الكبد", name_id: "Hepatitis",
      pathogenType: "virus_rna", family: "Multiple (VHA, VHB, VHC, VHD, VHE)",
      transmission: ["waterborne", "foodborne", "contact", "sexual", "nosocomial"],
      incubationMin: 14, incubationMax: 180,
      cfr_ref: "Variable selon le type (VHE en grossesse : 20–25 %)",
      vaccine: "yes", vaccineName: "HAV, HBV vaccines (not for types C/D/E)",
      treatment: "yes",
      whoFactsheet: "https://www.who.int/health-topics/hepatitis",
      travelerRisk: { africa: "moderate", asia: "moderate", americas: "low" },
    },
  },
  {
    patterns: ["rift valley"],
    info: {
      name_en: "Rift Valley fever", name_fr: "Fièvre de la Vallée du Rift",
      name_es: "Fiebre del Valle del Rift", name_ar: "حمى الوادي المتصدع", name_id: "Demam Lembah Rift",
      pathogenType: "virus_rna", family: "Phenuiviridae",
      transmission: ["vector", "contact", "zoonotic"],
      incubationMin: 2, incubationMax: 6,
      cfr_ref: "~1 % globale; formes hémorragiques : 10–12 %",
      vaccine: "experimental",
      treatment: "supportive",
      whoFactsheet: "https://www.who.int/news-room/fact-sheets/detail/rift-valley-fever",
      travelerRisk: { africa: "high", asia: "low" },
    },
  },
  {
    patterns: ["crimean-congo", "cchf"],
    info: {
      name_en: "Crimean-Congo haemorrhagic fever", name_fr: "Fièvre hémorragique de Crimée-Congo",
      name_es: "Fiebre hemorrágica de Crimea-Congo", name_ar: "حمى القرم-الكونغو النزفية",
      name_id: "Demam Hemoragik Krimea-Kongo",
      pathogenType: "virus_rna", family: "Nairoviridae",
      transmission: ["vector", "contact", "nosocomial"],
      incubationMin: 1, incubationMax: 9,
      cfr_ref: "10–40 %",
      vaccine: "no",
      treatment: "experimental",
      whoFactsheet: "https://www.who.int/news-room/fact-sheets/detail/crimean-congo-haemorrhagic-fever",
      travelerRisk: { africa: "moderate", asia: "moderate", europe: "low" },
    },
  },
  {
    patterns: ["hantavirus"],
    info: {
      name_en: "Hantavirus", name_fr: "Hantavirus",
      name_es: "Hantavirus", name_ar: "فيروس هانتا", name_id: "Hantavirus",
      pathogenType: "virus_rna", family: "Hantaviridae",
      transmission: ["contact", "zoonotic"],
      incubationMin: 7, incubationMax: 35,
      cfr_ref: "FHSR 1–5 %; SPH 35–50 %",
      vaccine: "no",
      treatment: "supportive",
      whoFactsheet: "https://www.who.int/news-room/fact-sheets/detail/hantavirus-disease",
      travelerRisk: { americas: "moderate", asia: "low", europe: "low", africa: "low" },
    },
  },
  {
    patterns: ["shigella", "shigellosis", "bacillary dysentery"],
    info: {
      name_en: "Shigellosis", name_fr: "Shigellose",
      name_es: "Shigelosis", name_ar: "داء الشيغيلا", name_id: "Shigelosis",
      pathogenType: "bacteria", family: "Enterobacteriaceae",
      transmission: ["foodborne", "waterborne", "contact"],
      incubationMin: 1, incubationMax: 4,
      cfr_ref: "< 1 % (MDR strains: higher)",
      vaccine: "no",
      treatment: "supportive",
      whoFactsheet: "https://www.who.int/news-room/fact-sheets/detail/shigellosis",
      travelerRisk: { africa: "moderate", asia: "moderate", americas: "low", europe: "low" },
    },
  },
  {
    patterns: ["sudan virus", "bundibugyo"],
    info: {
      name_en: "Ebola virus disease", name_fr: "Maladie à virus Ebola",
      name_es: "Enfermedad por virus del Ébola", name_ar: "مرض فيروس إيبولا",
      name_id: "Penyakit virus Ebola",
      pathogenType: "virus_rna", family: "Filoviridae",
      transmission: ["contact", "nosocomial"],
      incubationMin: 2, incubationMax: 21,
      cfr_ref: "25–90 %",
      r0_ref: "1.5–2.5",
      vaccine: "experimental",
      treatment: "experimental",
      whoFactsheet: "https://www.who.int/news-room/fact-sheets/detail/ebola-virus-disease",
      travelerRisk: { africa: "high", europe: "low" },
    },
  },
  {
    patterns: ["diphtheria"],
    info: {
      name_en: "Diphtheria", name_fr: "Diphtérie",
      name_es: "Difteria", name_ar: "الخناق", name_id: "Difteri",
      pathogenType: "bacteria", family: "Corynebacteriaceae",
      transmission: ["droplet", "contact"],
      incubationMin: 2, incubationMax: 5,
      cfr_ref: "5–10 % (enfants non vaccinés)",
      // Valeur "manuel" (Anderson & May 1982). Une revue 2020 (Truelove et al.) recalcule plus bas (~2.6) — débat méthodologique non tranché.
      r0_ref: "4–7",
      vaccine: "yes", vaccineName: "DTP / DT",
      treatment: "yes",
      whoFactsheet: "https://www.who.int/news-room/fact-sheets/detail/diphtheria",
      travelerRisk: { africa: "moderate", asia: "moderate", americas: "low", oceania: "low" },
    },
  },
  {
    patterns: ["pertussis", "whooping cough"],
    info: {
      name_en: "Pertussis", name_fr: "Coqueluche",
      name_es: "Tos ferina", name_ar: "السعال الديكي", name_id: "Batuk Rejan",
      pathogenType: "bacteria", family: "Alcaligenaceae",
      transmission: ["airborne", "droplet"],
      incubationMin: 5, incubationMax: 10,
      cfr_ref: "< 1 % adultes; nourrissons < 1 an : 1–4 %",
      r0_ref: "5.5–17",
      vaccine: "yes", vaccineName: "DTP / Tdap",
      treatment: "yes",
      whoFactsheet: "https://www.who.int/news-room/fact-sheets/detail/pertussis",
      travelerRisk: { africa: "low", asia: "low", americas: "low" },
    },
  },
  {
    patterns: ["leishmaniasis", "leishmaniose"],
    info: {
      name_en: "Leishmaniasis", name_fr: "Leishmaniose",
      name_es: "Leishmaniasis", name_ar: "داء الليشمانيات", name_id: "Leishmaniasis",
      pathogenType: "parasite", family: "Leishmania spp.",
      transmission: ["vector"],
      incubationMin: 14, incubationMax: 180,
      cfr_ref: "Viscérale : 95 % si non traitée; cutanée : faible",
      r0_ref: "Non standardisé : varie fortement selon le contexte, y compris pour une même forme clinique",
      vaccine: "no",
      treatment: "yes",
      whoFactsheet: "https://www.who.int/news-room/fact-sheets/detail/leishmaniasis",
      travelerRisk: { africa: "moderate", asia: "moderate", americas: "moderate", europe: "low" },
    },
  },
  {
    patterns: ["trypanosomiasis", "sleeping sickness", "chagas"],
    info: {
      name_en: "Trypanosomiasis", name_fr: "Trypanosomose",
      name_es: "Tripanosomiasis", name_ar: "داء النوم", name_id: "Tripanosomiasis",
      pathogenType: "parasite", family: "Trypanosoma spp.",
      transmission: ["vector", "contact"],
      incubationMin: 1, incubationMax: 21,
      cfr_ref: "Quasi 100 % (HAT sans traitement)",
      vaccine: "no",
      treatment: "yes",
      whoFactsheet: "https://www.who.int/news-room/fact-sheets/detail/trypanosomiasis-human-african-(sleeping-sickness)",
      travelerRisk: { africa: "high", americas: "moderate" },
    },
  },
  {
    patterns: ["oropouche"],
    info: {
      name_en: "Oropouche virus disease", name_fr: "Maladie à virus Oropouche",
      name_es: "Enfermedad por virus Oropouche", name_ar: "مرض فيروس أوروبوشي",
      name_id: "Penyakit virus Oropouche",
      pathogenType: "virus_rna", family: "Peribunyaviridae",
      transmission: ["vector"],
      incubationMin: 3, incubationMax: 8,
      cfr_ref: "< 1 % (transmission verticale documentée en 2024)",
      vaccine: "no",
      treatment: "supportive",
      whoFactsheet: "https://www.who.int/news-room/fact-sheets/detail/oropouche-fever",
      travelerRisk: { americas: "high" },
    },
  },
  {
    patterns: ["west nile"],
    info: {
      name_en: "West Nile fever", name_fr: "Fièvre du Nil occidental",
      name_es: "Fiebre del Nilo Occidental", name_ar: "حمى غرب النيل", name_id: "Demam Nil Barat",
      pathogenType: "virus_rna", family: "Flaviviridae",
      transmission: ["vector"],
      incubationMin: 2, incubationMax: 14,
      cfr_ref: "< 1 % (neuro-invasive : 3–15 %)",
      vaccine: "no",
      treatment: "supportive",
      whoFactsheet: "https://www.who.int/news-room/fact-sheets/detail/west-nile-virus",
      travelerRisk: { americas: "moderate", europe: "moderate", africa: "low", asia: "low" },
    },
  },
  {
    patterns: ["powassan"],
    info: {
      name_en: "Powassan virus disease", name_fr: "Maladie à virus Powassan",
      name_es: "Enfermedad por virus Powassan", name_ar: "مرض فيروس بواسان",
      name_id: "Penyakit virus Powassan",
      pathogenType: "virus_rna", family: "Flaviviridae",
      transmission: ["vector"],
      incubationMin: 7, incubationMax: 34,
      cfr_ref: "~10 % (neuro-invasive)",
      vaccine: "no",
      treatment: "supportive",
      whoFactsheet: "https://www.who.int/news-room/fact-sheets/detail/tick-borne-encephalitis",
      travelerRisk: { americas: "low", asia: "low" },
    },
  },
  {
    patterns: ["leptospirosis", "leptospirose"],
    info: {
      name_en: "Leptospirosis", name_fr: "Leptospirose", name_es: "Leptospirosis",
      name_ar: "داء البريميات", name_id: "Leptospirosis",
      pathogenType: "bacteria", family: "Leptospiraceae",
      transmission: ["zoonotic", "contact", "waterborne"],
      incubationMin: 2, incubationMax: 30,
      cfr_ref: "< 1 % (formes bénignes); 10–15 % (maladie de Weil, traitée); jusqu'à 25–30 % si traitement tardif",
      vaccine: "no",
      treatment: "yes",
      whoFactsheet: "https://www.who.int/news-room/fact-sheets/detail/leptospirosis",
      travelerRisk: { africa: "moderate", asia: "high", americas: "moderate", oceania: "high" },
    },
  },
  {
    patterns: ["rocky mountain spotted fever", "rmsf", "fièvre pourprée des montagnes rocheuses"],
    info: {
      name_en: "Rocky Mountain spotted fever", name_fr: "Fièvre pourprée des montagnes Rocheuses",
      name_es: "Fiebre maculosa de las Montañas Rocosas", name_ar: "حمى جبال روكي المبقعة",
      name_id: "Demam berbintik Pegunungan Rocky",
      pathogenType: "bacteria", family: "Rickettsiaceae",
      transmission: ["vector", "zoonotic"],
      incubationMin: 3, incubationMax: 12,
      cfr_ref: "5–10 % (traité); 20–30 % (non traité); jusqu'à 40–50 % si traitement débuté après J8–9",
      vaccine: "no",
      treatment: "yes",
      whoFactsheet: "https://www.cdc.gov/rocky-mountain-spotted-fever/about/index.html",
      travelerRisk: { americas: "moderate" },
    },
  },
  {
    patterns: ["scrub typhus", "tsutsugamushi", "typhus des broussailles"],
    info: {
      name_en: "Scrub typhus", name_fr: "Typhus des broussailles",
      name_es: "Tifus de los matorrales", name_ar: "التيفوس الأكالي",
      name_id: "Tifus semak",
      pathogenType: "bacteria", family: "Rickettsiaceae (genre Orientia)",
      transmission: ["vector", "zoonotic"],
      incubationMin: 6, incubationMax: 21,
      cfr_ref: "6 % (médiane, non traité; jusqu'à 30–70 % formes sévères); < 1,5 % si traité par doxycycline",
      vaccine: "no",
      treatment: "yes",
      whoFactsheet: "https://www.cdc.gov/typhus/about/scrub.html",
      travelerRisk: { asia: "high", oceania: "moderate", africa: "low", europe: "low" },
    },
  },
  {
    patterns: ["japanese encephalitis", "encéphalite japonaise"],
    info: {
      name_en: "Japanese encephalitis", name_fr: "Encéphalite japonaise",
      name_es: "Encefalitis japonesa", name_ar: "التهاب الدماغ الياباني",
      name_id: "Ensefalitis Jepang",
      pathogenType: "virus_rna", family: "Flaviviridae",
      transmission: ["vector", "zoonotic"],
      incubationMin: 4, incubationMax: 14,
      cfr_ref: "20–30 % (parmi les cas d'encéphalite symptomatique)",
      vaccine: "yes", vaccineName: "IXIARO (inactivé, cellules Vero) / SA 14-14-2, CD-JEV (vivant atténué)",
      treatment: "supportive",
      whoFactsheet: "https://www.who.int/news-room/fact-sheets/detail/japanese-encephalitis",
      travelerRisk: { asia: "high", oceania: "moderate" },
    },
  },
];

/** "Rift Valley fever" → "rift-valley-fever" */
export function diseaseToSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

/** Returns the canonical DiseaseInfo for a slug, or null if not found. */
export function slugToDisease(slug: string): DiseaseInfo | null {
  for (const entry of DISEASE_MAP) {
    if (diseaseToSlug(entry.info.name_en) === slug) return entry.info;
  }
  return null;
}

/** All unique canonical disease infos (deduped). */
export function allDiseases(): DiseaseInfo[] {
  const seen = new Set<string>();
  const result: DiseaseInfo[] = [];
  for (const entry of DISEASE_MAP) {
    if (!seen.has(entry.info.name_en)) {
      seen.add(entry.info.name_en);
      result.push(entry.info);
    }
  }
  return result;
}

/** Returns { info, matched: true } when found in DISEASE_MAP, { info (fallback), matched: false } otherwise. */
export function matchDisease(rawName: string): { info: DiseaseInfo; matched: boolean } {
  const lower = rawName.toLowerCase();
  for (const entry of DISEASE_MAP) {
    if (entry.patterns.some((p) => lower.includes(p))) {
      return { info: entry.info, matched: true };
    }
  }
  return {
    info: {
      name_en: rawName, name_fr: rawName, name_es: rawName, name_ar: rawName, name_id: rawName,
      pathogenType: "virus_rna",
      transmission: ["contact"],
      vaccine: "no",
      treatment: "supportive",
    },
    matched: false,
  };
}

export function normalizeDisease(rawName: string): DiseaseInfo {
  return matchDisease(rawName).info;
}

/** Returns the localized disease name for a given locale, falling back to EN. */
export function localizedDiseaseName(info: DiseaseInfo, locale: string): string {
  const map: Record<string, keyof Pick<DiseaseInfo, "name_fr" | "name_es" | "name_ar" | "name_id">> = {
    fr: "name_fr", es: "name_es", ar: "name_ar", id: "name_id",
  };
  const key = map[locale];
  return key ? (info[key] as string) || info.name_en : info.name_en;
}

export type ContagiosityLevel = "very-high" | "high" | "moderate" | "low";

/**
 * Buckets a free-text r0_ref range (e.g. "12–18") into a coarse category using its
 * upper bound — gives readers a quick-scan signal without requiring R0 literacy.
 * Thresholds follow common epidemiological usage (measles/pertussis ≈ very-high,
 * polio/dengue/zika ≈ high, mpox ≈ moderate, seasonal flu ≈ low).
 */
export function getContagiosityLevel(r0_ref?: string): ContagiosityLevel | undefined {
  if (!r0_ref) return undefined;
  const numbers = r0_ref.match(/\d+(\.\d+)?/g);
  if (!numbers || numbers.length === 0) return undefined;
  const upperBound = Math.max(...numbers.map(Number));
  if (upperBound >= 10) return "very-high";
  if (upperBound >= 4) return "high";
  if (upperBound >= 2) return "moderate";
  return "low";
}
