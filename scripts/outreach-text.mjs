// Frontières de mot compatibles Unicode, pour les contrôles de messages sortants.
//
// `\b` en JavaScript est une frontière ASCII : « é », « à », « ô » y comptent
// pour des caractères non-mot, même avec le drapeau `u`. Le piège joue dans les
// deux sens, et les deux font des dégâts :
//
//   /\btes\b/i.test("hôtes")       → true   — faux positif
//   /\bimpacté\b/i.test("impacté") → false  — le contrôle ne se déclenche jamais
//
// Incident du 2026-08-29 (run 17 h de linkedin-hwg-followup-check-2) : un post
// LinkedIn parlant de « vents, hôtes et virus circulant autour de l'Europe » a
// été classé « tutoiement » sur le « tes » de « hôtes », et un brouillon
// correctement vouvoyé s'est fait bloquer sur context.register.
//
// UWB est la même assertion que `\b`, mais avec la définition Unicode du mot
// (lettre, chiffre, souligné). Elle est symétrique — elle vaut à gauche comme à
// droite d'un motif — ce qui permet de réécrire un motif existant sans avoir à
// décider de quel côté chaque `\b` se trouvait.

const W = "\\p{L}\\p{N}_";
export const UWB = `(?:(?<=[${W}])(?![${W}])|(?<![${W}])(?=[${W}]))`;

// Compile un motif écrit avec des `\b` en remplaçant chaque frontière par son
// équivalent Unicode. Le drapeau `u` est ajouté d'office : `\p{L}` l'exige.
// L'alternance consomme d'abord les antislashs échappés, pour ne pas confondre
// un antislash littéral suivi d'un b avec une frontière. Reste hors de portée,
// faute d'usage ici : `[\b]` (le retour arrière) dans une classe de caractères,
// qui serait réécrit à tort.
export const uwb = (source, flags = "") =>
  new RegExp(
    source.replace(/\\\\|\\b/g, (m) => (m === "\\b" ? UWB : m)),
    flags.includes("u") ? flags : `${flags}u`
  );

// Tutoiement / vouvoiement : on compte les marqueurs des deux registres et on
// tranche à la majorité. Aucun marqueur, ou autant des deux, ne dit rien — d'où
// le null, qui vaut « ne pas comparer ce texte au fil ».
const TU_RE = uwb("\\b(tu|ton|ta|tes|toi|t'as)\\b", "gi");
const VOUS_RE = uwb("\\b(vous|votre|vos)\\b", "gi");

export const detectRegister = (t) => {
  const tu = (t.match(TU_RE) ?? []).length;
  const vous = (t.match(VOUS_RE) ?? []).length;
  return tu === vous ? null : tu > vous ? "tutoiement" : "vouvoiement";
};
