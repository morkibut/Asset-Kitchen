// Ce qui remplit vraiment une case — un calcul partagé, pour ne jamais en
// avoir deux qui donnent deux chiffres pour la même case.
//
// **Sorti de `EtabliDuSujet.tsx`** (RV10, retrait de « Cases et planches ») :
// l'écran a disparu, mais `Planche.tsx` lit encore ce compte pour dire
// combien de cases une feuille achetée a déjà remplies.

import type { Case } from "./api"

/** Ce qui remplit vraiment une case — **et ce n'est pas toujours le nombre
 *  d'images qu'elle porte** (E10).
 *
 *  Avec des directions, une image ne compte que si elle est rangée dans une
 *  direction que cette chose tient encore : sans ça, une image restée dans une
 *  direction rangée ferait afficher *quatre sur trois*. Sans direction
 *  déclarée, c'est la longueur de la liste, comme avant. */
export function faitesDeLaCase(case_: Case | undefined): number {
  if (!case_) return 0
  if (case_.directions.length + case_.directions_rangees.length > 1)
    return case_.directions.reduce((somme, a) => somme + a.images.length, 0)
  return case_.images.length
}
