// La touche du coup de main « demander » (CM4, `docs/PLAN-assistant.md` § CM4) — un
// seul endroit qui la nomme, pour que le recensement qui la prouve libre
// (`DemanderIci.test.tsx`) et le geste qui l'ouvre (`DemanderIci.tsx`) ne puissent
// pas diverger.
//
// **`Ctrl+/`** (`Cmd+/` sur Mac, pour qui en a un). Une combinaison, jamais un
// caractère seul (le piège nommé par le plan) : elle ne peut donc pas se
// déclencher en tapant du texte dans un champ. Le recensement complet — chaque
// raccourci déjà posé dans le produit, et les raccourcis réservés de Chrome, Edge
// et Firefox sous Windows — est écrit sous CM4 dans `docs/PLAN-assistant.md` ;
// aucun des deux ne porte `Ctrl+/`.
//
// ⚠️ **`Maj` est permise, et c'est voulu** (relecture croisée, 25 septembre 2026).
// Sur un clavier **français**, « / » ne se tape qu'avec `Maj` (la touche « : ») ou
// sur le pavé numérique : en exigeant `!shiftKey`, la touche n'était joignable,
// chez l'auteur, que par un pavé que son portable n'a pas. On lit le caractère
// produit (`key`), pas la position : `Ctrl+Maj+/` sur un clavier américain donne
// `?`, et ne la déclenche donc toujours pas.
export function estLaToucheDemander(e: KeyboardEvent): boolean {
  return Boolean((e.ctrlKey || e.metaKey) && !e.altKey && e.key === "/")
}

/** La réponse exacte d'une question hors sujet (`atelier/domaine/coup_de_main.py`,
 *  `JE_NE_SAIS_PAS`) — comparée sans casse ni ponctuation finale, jamais recopiée
 *  deux fois. */
export const JE_NE_SAIS_PAS = "je ne sais pas"
