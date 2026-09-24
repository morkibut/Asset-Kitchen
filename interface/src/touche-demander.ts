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
export function estLaToucheDemander(e: KeyboardEvent): boolean {
  return Boolean((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && e.key === "/")
}

/** La réponse exacte d'une question hors sujet (`atelier/domaine/coup_de_main.py`,
 *  `JE_NE_SAIS_PAS`) — comparée sans casse ni ponctuation finale, jamais recopiée
 *  deux fois. */
export const JE_NE_SAIS_PAS = "je ne sais pas"
