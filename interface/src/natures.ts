import type { PosesDesTypes } from "./api"

/** Une nature, telle que le serveur la décrit (`GET /api/characters/types`). */
export type NatureDuJeu = PosesDesTypes["types"][number]

/** **Les natures qu'on peut donner à un sujet** (rangement, D4).
 *
 *  Une matière est une image de la bibliothèque, plus un sujet : la choisir
 *  pour un sujet est refusé par le serveur. On ne la propose donc plus — sauf
 *  si le sujet l'a déjà, pour qu'un ancien sujet garde une case qui dit ce
 *  qu'il est. Tant que la liste n'est pas revenue, elle est vide et rien n'est
 *  retiré. */
export function naturesChoisissables(types: readonly NatureDuJeu[], actuelle: string | undefined | null): NatureDuJeu[] {
  return types.filter((t) => !t.capacites?.matiere || t.nom === actuelle)
}

/** Les natures dont les sujets n'existent plus (les matières) : leur ligne dans
 *  la colonne des sujets vaudrait toujours « — ». */
export function nomsDesNaturesMatiere(types: readonly NatureDuJeu[]): Set<string> {
  return new Set(types.filter((t) => t.capacites?.matiere).map((t) => t.nom))
}
