export type DiseaseCategory = "respiratory" | "hemorrhagic" | "waterborne" | "vector-borne" | "zoonotic" | "other";

const RESPIRATORY = /influenza|covid|sars|mers|pneumonia|measles|tuberculosis|pertussis|whooping|diphtheria|rsv|parainfluenza|adenovirus|rhinovirus/i;
const HEMORRHAGIC = /ebola|marburg|lassa|rift valley|crimean.congo|yellow fever|dengue.*hemorrhagic|viral hemorrhagic/i;
const WATERBORNE  = /cholera|typhoid|hepatitis\s*a|rotavirus|norovirus|e\.?\s*coli|shigella|cryptosporidium|giardia|legionella/i;
const VECTOR      = /malaria|dengue|zika|chikungunya|west nile|leishmaniasis|trypanosomiasis|sleeping sickness|chagas|filariasis|onchocerciasis|schistosomiasis/i;
const ZOONOTIC    = /rabies|anthrax|brucellosis|q fever|nipah|hendra|mpox|monkeypox|avian influenza|bird flu|plague|tularemia|glanders|melioidosis/i;

export function getDiseaseCategory(diseaseEn: string | null | undefined): DiseaseCategory {
  if (!diseaseEn) return "other";
  if (RESPIRATORY.test(diseaseEn)) return "respiratory";
  if (HEMORRHAGIC.test(diseaseEn)) return "hemorrhagic";
  if (WATERBORNE.test(diseaseEn))  return "waterborne";
  if (VECTOR.test(diseaseEn))      return "vector-borne";
  if (ZOONOTIC.test(diseaseEn))    return "zoonotic";
  return "other";
}

export const DISEASE_CATEGORIES: DiseaseCategory[] = [
  "respiratory", "hemorrhagic", "waterborne", "vector-borne", "zoonotic", "other",
];

export const CATEGORY_LABELS: Record<DiseaseCategory, Record<string, string>> = {
  respiratory:  { en: "Respiratory",   fr: "Respiratoire",  es: "Respiratorio",  ar: "تنفسية",    id: "Pernapasan"   },
  hemorrhagic:  { en: "Hemorrhagic",   fr: "Hémorragique",  es: "Hemorrágico",   ar: "نزيفية",    id: "Hemoragik"    },
  waterborne:   { en: "Waterborne",    fr: "Hydrique",      es: "Hídrico",       ar: "مائية",     id: "Air"          },
  "vector-borne": { en: "Vector-borne", fr: "Vectorielle",  es: "Vectorial",     ar: "ناقل",      id: "Vektor"       },
  zoonotic:     { en: "Zoonotic",      fr: "Zoonotique",    es: "Zoonótico",     ar: "حيوانية",   id: "Zoonosis"     },
  other:        { en: "Other",         fr: "Autre",         es: "Otro",          ar: "أخرى",      id: "Lainnya"      },
};
