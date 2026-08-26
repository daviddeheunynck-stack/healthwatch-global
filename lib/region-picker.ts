// Libelles du choix de region prioritaire, partages par le formulaire
// d'inscription (app/[locale]/signup/page.tsx) et l'etape posee aux
// inscriptions OAuth juste apres le premier login (app/[locale]/welcome).
// Extrait de signup/page.tsx le 2026-08-26 : les deux surfaces doivent poser
// exactement la meme question, sans quoi la reponse ne veut pas dire la meme
// chose selon le chemin d'entree.
//
// Meme taxonomie a 5 regions que ALL_REGIONS (lib/activate-trial.ts),
// AlertRegionToggles et la page compte.
//
// REQUIS depuis le 2026-08-25, apres mesure. Ce champ etait facultatif et son
// option vide valait "toutes les regions" : presque personne ne repondait, donc
// presque tout le monde etait inscrit aux cinq. Releve sur 30 jours ce jour-la :
// 2 091 couples (utilisateur, foyer) pousses sur 25 comptes, avec une
// distribution PLATE — 117, 117, 117, 116, 115, 115, 115... Tout le monde
// recevait la meme chose. Sur ~32 comptes reels, 4 adresses bloquees chez Brevo,
// dont une conversion institutionnelle en essai Pro qui n'avait jamais ouvert le
// produit. Un compte sur huit : un taux sain se compte en fractions de pour cent.
//
// Le cablage vers activate-trial existait et fonctionnait ; c'est le defaut
// silencieux qui le vidait de son sens. "Toutes les regions" reste disponible,
// mais comme un choix explicite — pas comme ce qu'on obtient en ne repondant pas,
// et libelle "inclus pendant l'essai" : /pricing vend "Toutes les regions
// mondiales" comme le differenciateur Pro face a "1 region surveillee" en Gratuit,
// donc l'offrir sans mention au premier ecran donnait gratuitement l'argument
// vendu au troisieme. Sans effet fonctionnel : regional-alerts filtre deja sur
// plan in (starter, pro, team, enterprise), un compte gratuit ne recoit aucune
// alerte regionale quoi qu'il ait choisi.
// L'intention etait deja ecrite dans lib/activate-trial.ts : "un e-mail
// hebdomadaire sur un pays que vous avez demande est un produit ; un e-mail sur
// cinq continents ressemble a une newsletter."

export type RegionPickerLabels = {
  label: string;
  prompt: string;
  required: string;
  all: string;
  options: Record<string, string>;
};

export const REGION_PICKER: Record<string, RegionPickerLabels> = {
  en: {
    label: "Which region matters most to you?",
    prompt: "Select a region",
    required: "Please choose a region — it decides which alerts you get.",
    all: "All regions — included during your trial",
    options: { africa: "Africa", asia: "Asia", americas: "Americas", europe: "Europe", oceania: "Oceania" },
  },
  fr: {
    label: "Quelle région vous intéresse en priorité ?",
    prompt: "Choisissez une région",
    required: "Choisissez une région — c’est elle qui détermine vos alertes.",
    all: "Toutes les régions — inclus pendant l’essai",
    options: { africa: "Afrique", asia: "Asie", americas: "Amériques", europe: "Europe", oceania: "Océanie" },
  },
  es: {
    label: "¿Qué región le interesa prioritariamente?",
    prompt: "Elija una región",
    required: "Elija una región — determina las alertas que recibirá.",
    all: "Todas las regiones — incluido durante la prueba",
    options: { africa: "África", asia: "Asia", americas: "Américas", europe: "Europa", oceania: "Oceanía" },
  },
  ar: {
    label: "ما المنطقة الأهم بالنسبة لك؟",
    prompt: "اختر منطقة",
    required: "اختر منطقة — هي التي تحدد التنبيهات التي تصلك.",
    all: "كل المناطق — مشمولة خلال الفترة التجريبية",
    options: { africa: "أفريقيا", asia: "آسيا", americas: "الأمريكتين", europe: "أوروبا", oceania: "أوقيانوسيا" },
  },
  id: {
    label: "Wilayah mana yang paling penting bagi Anda?",
    prompt: "Pilih wilayah",
    required: "Pilih wilayah — ini menentukan peringatan yang Anda terima.",
    all: "Semua wilayah — termasuk selama masa uji coba",
    options: { africa: "Afrika", asia: "Asia", americas: "Amerika", europe: "Eropa", oceania: "Oseania" },
  },
};

export function regionPickerFor(locale: string): RegionPickerLabels {
  return REGION_PICKER[locale] ?? REGION_PICKER.en;
}
