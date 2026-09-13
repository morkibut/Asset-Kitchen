/**
 * Le vocabulaire des familles.
 *
 * Vivait dans le carnet — la colonne de gauche de la V4, remplacée par
 * `NavigationAtelier.tsx`. Le composant est parti avec elle, mais ces noms et
 * ce type restent : plusieurs écrans les lisent encore pour nommer une
 * famille dans leur propre affichage.
 */

/**
 * Comment une famille se nomme **dans le carnet**, et nulle part ailleurs.
 *
 * Avec son article, comme la planche l'écrit. Ce n'est pas de la coquetterie :
 * la grille du codex a déjà des boutons nommés *Personnages*, et deux gestes
 * différents portant le même nom dans la même fenêtre ne se distinguent ni à
 * l'œil ni à l'oreille.
 */
export const NOM_DANS_LE_CARNET: Record<string, string> = {
  personnages: "Les personnages",
  objets: "Les objets",
  decors: "Les décors",
  interface: "L'interface",
  equipement: "Les équipements",
}

/**
 * Les cinq familles, sans article — reprises de l'ancien `Codex.tsx` (`C3`),
 * qui les portait seul avant que le carnet et `Famille.tsx` ne les montrent
 * chacun à leur tour. `NOM_DANS_LE_CARNET` ci-dessus porte l'article pour la
 * ligne du carnet ; ces noms-ci servent au fil d'Ariane, qui n'en veut pas.
 */
export const FAMILLES = [
  { cle: "personnages", nom: "Personnages" },
  { cle: "decors", nom: "Décors" },
  { cle: "objets", nom: "Objets" },
  { cle: "interface", nom: "Interface" },
  { cle: "equipement", nom: "Équipement" },
] as const

/** Le nom d'une famille ou d'un équipement pour le fil d'Ariane, sans article. */
export const NOM_DE_LA_RUBRIQUE: Record<string, string> = Object.fromEntries(
  FAMILLES.map((f) => [f.cle, f.nom]),
)

/** Ce qu'une ligne de famille montre. */
export type LigneDeFamille = {
  cle: string
  nom: string
  /** Le compte, ou `null` quand il n'y en a aucun — la ligne écrit « aucun »
   *  plutôt que zéro : *un chiffre affiché est un chiffre compté*, et zéro se
   *  dit mieux avec un mot. */
  compte: number | null
}
