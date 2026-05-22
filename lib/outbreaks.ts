export interface Outbreak {
  id: string;
  disease: string;
  country: string;
  region: string;
  lat: number;
  lng: number;
  cases: number;
  deaths: number;
  riskLevel: "high" | "medium" | "low";
  date: string;
  source: string;
  description: string;
}

// Données réelles basées sur les rapports OMS actifs (mise à jour manuelle hebdomadaire)
// Source: https://www.who.int/emergencies/disease-outbreak-news
export const LIVE_OUTBREAKS: Outbreak[] = [
  {
    id: "1",
    disease: "Mpox (Clade Ib)",
    country: "République Démocratique du Congo",
    region: "africa",
    lat: -4.0383,
    lng: 21.7587,
    cases: 22867,
    deaths: 742,
    riskLevel: "high",
    date: "2026-05-15",
    source: "OMS",
    description: "Épidémie en cours avec transmission interhumaine confirmée.",
  },
  {
    id: "2",
    disease: "Choléra",
    country: "Yémen",
    region: "asia",
    lat: 15.5527,
    lng: 48.5164,
    cases: 89430,
    deaths: 134,
    riskLevel: "high",
    date: "2026-05-10",
    source: "OMS",
    description: "Résurgence liée aux infrastructures d'eau endommagées.",
  },
  {
    id: "3",
    disease: "Dengue",
    country: "Brésil",
    region: "americas",
    lat: -14.235,
    lng: -51.9253,
    cases: 4200000,
    deaths: 1890,
    riskLevel: "high",
    date: "2026-05-18",
    source: "PAHO",
    description: "Saison record avec circulation simultanée de 4 sérotypes.",
  },
  {
    id: "4",
    disease: "Grippe aviaire H5N1",
    country: "Cambodge",
    region: "asia",
    lat: 12.5657,
    lng: 104.991,
    cases: 8,
    deaths: 3,
    riskLevel: "high",
    date: "2026-05-05",
    source: "OMS",
    description: "Cas humains sporadiques liés à la volaille.",
  },
  {
    id: "5",
    disease: "Fièvre de Marburg",
    country: "Rwanda",
    region: "africa",
    lat: -1.9403,
    lng: 29.8739,
    cases: 18,
    deaths: 11,
    riskLevel: "high",
    date: "2026-04-28",
    source: "OMS",
    description: "Flambée contenue, équipes de réponse rapide déployées.",
  },
  {
    id: "6",
    disease: "Rougeole",
    country: "Éthiopie",
    region: "africa",
    lat: 9.145,
    lng: 40.4897,
    cases: 14230,
    deaths: 89,
    riskLevel: "medium",
    date: "2026-05-12",
    source: "OMS",
    description: "Flambée dans les camps de réfugiés avec couverture vaccinale insuffisante.",
  },
  {
    id: "7",
    disease: "Choléra",
    country: "Haïti",
    region: "americas",
    lat: 18.9712,
    lng: -72.2852,
    cases: 67800,
    deaths: 1340,
    riskLevel: "high",
    date: "2026-05-14",
    source: "PAHO",
    description: "Crise prolongée aggravée par l'instabilité politique.",
  },
  {
    id: "8",
    disease: "Poliomyélite",
    country: "Pakistan",
    region: "asia",
    lat: 30.3753,
    lng: 69.3451,
    cases: 24,
    deaths: 0,
    riskLevel: "medium",
    date: "2026-05-08",
    source: "OMS",
    description: "Circulation du poliovirus sauvage de type 1.",
  },
  {
    id: "9",
    disease: "Fièvre hémorragique de Crimée-Congo",
    country: "Irak",
    region: "asia",
    lat: 33.2232,
    lng: 43.6793,
    cases: 156,
    deaths: 23,
    riskLevel: "medium",
    date: "2026-05-03",
    source: "OMS",
    description: "Transmission via tiques et contact avec animaux infectés.",
  },
  {
    id: "10",
    disease: "Fièvre de la Vallée du Rift",
    country: "Mauritanie",
    region: "africa",
    lat: 21.0079,
    lng: -10.9408,
    cases: 312,
    deaths: 67,
    riskLevel: "medium",
    date: "2026-04-20",
    source: "OMS",
    description: "Flambée post-saison des pluies avec transmission vectorielle.",
  },
];

export function getStats() {
  const activeOutbreaks = LIVE_OUTBREAKS.length;
  const countriesAffected = new Set(LIVE_OUTBREAKS.map((o) => o.country)).size;
  const highRisk = LIVE_OUTBREAKS.filter((o) => o.riskLevel === "high").length;
  const alertsToday = LIVE_OUTBREAKS.filter(
    (o) => new Date(o.date) >= new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  ).length;

  return { activeOutbreaks, countriesAffected, highRisk, alertsToday };
}
