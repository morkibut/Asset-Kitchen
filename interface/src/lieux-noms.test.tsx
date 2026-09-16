// Comment un lieu se nomme — et, surtout, ce qu'il ne redit pas.
//
// Le fil d'Ariane nomme des **étages**. Deux d'entre eux se descendent depuis
// la page d'un sujet, qui a déjà écrit son nom : *Sur la grille du jeu* et
// *Comparer*. Ils le réécrivaient, et le fil disait deux fois la même chose —
// « Personnages › Le pèlerin › Le pèlerin › Sur la grille du jeu », vu à
// l'écran le 16 septembre 2026. C'est la garde que `case "codex"` tient déjà
// pour la même raison.

import { describe, expect, test } from "vitest"

import { nommerLeLieu } from "./lieux-noms"
import { filDAriane, type Lieu } from "./lieux"
import type { Personnage } from "./api"

const pelerin = { identifiant: "le-pelerin", nom: "Le pèlerin", famille: "personnages" } as unknown as Personnage

const nommer = nommerLeLieu({
  choseOuverte: pelerin,
  collectionOuverte: null,
  groupesDeLaFamille: [],
  grille: [],
  personnages: [pelerin],
  pieces: [],
  vestiaireDuJeu: null,
})

/** Les noms du fil, dans l'ordre, nom du jeu compris. */
function fil(pile: readonly Lieu[]): string[] {
  return filDAriane(pile, "Le Marais du Vieux Moulin", nommer).map((e) => e.libelle)
}

const DEPUIS_LA_FICHE: readonly Lieu[] = [
  { genre: "codex" },
  { genre: "sujet", sujet: "le-pelerin" },
]

describe("le fil d'Ariane ne dit pas deux fois le nom du sujet", () => {
  test("la grille du jeu, descendue de la fiche", () => {
    expect(fil([...DEPUIS_LA_FICHE, { genre: "grille", sujet: "le-pelerin" }])).toEqual([
      "Le Marais du Vieux Moulin",
      "Personnages",
      "Le pèlerin",
      "Sur la grille du jeu",
    ])
  })

  test("comparer, descendu de la fiche", () => {
    expect(fil([...DEPUIS_LA_FICHE, { genre: "comparer", sujet: "le-pelerin" }])).toEqual([
      "Le Marais du Vieux Moulin",
      "Personnages",
      "Le pèlerin",
      "Comparer",
    ])
  })

  // Et le nom reste quand personne ne l'a écrit au-dessus : la grille porte
  // alors les deux étages à elle seule, comme avant. (Le codex, lui, ne nomme
  // rien ici : sa rubrique se lit du sujet ouvert **au-dessus** de lui, et il
  // n'y en a pas dans cette pile-là.)
  test("sans la fiche au-dessus, la grille nomme encore le sujet", () => {
    expect(fil([{ genre: "codex" }, { genre: "grille", sujet: "le-pelerin" }])).toEqual([
      "Le Marais du Vieux Moulin",
      "Le pèlerin",
      "Sur la grille du jeu",
    ])
  })
})
