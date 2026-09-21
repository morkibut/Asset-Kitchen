// RV1 — une vidéo ratée reste visible dans sa rangée, au lieu de disparaître
// sans bruit. `clipsNonMontes` l'écartait avant (seul `echouee` sans
// `clip.controle` en sort) ; `etatDeLaCase` doit dire « ratee » plutôt que
// « à juger » ou « à fabriquer ».

import { describe, expect, test } from "vitest"

import type { Generation, Personnage } from "../api"
import { clipsNonMontes, etatDeLaCase } from "./AnimerEnLot"

function personnage(): Personnage {
  return {
    identifiant: "pelerin",
    projet: "le-marais",
    cases: [],
  } as unknown as Personnage
}

function clip(surplus: Record<string, unknown> & { identifiant: string }): Generation {
  return {
    modele: "maison/wan-2.2-i2v-14b-pixel",
    personnage: "pelerin",
    pose: "repos",
    direction: null,
    statut: "reussie",
    emplacements: [{ raison: null }],
    clip: { jete: false },
    ...surplus,
  } as unknown as Generation
}

describe("clipsNonMontes — une vidéo ratée au contrôle reste visible", () => {
  test("un clip échoué avec `clip.controle` paraît dans la rangée", () => {
    const ratee = clip({
      identifiant: "rate-1",
      statut: "echouee",
      clip: { jete: false, controle: "noire" },
      emplacements: [{ raison: "la vidéo est revenue noire" }],
    })
    const trouves = clipsNonMontes([ratee], personnage())
    expect(trouves.map((g) => g.identifiant)).toEqual(["rate-1"])
  })

  test("un clip échoué pour une autre raison (sans `clip.controle`) reste absent", () => {
    const autre = clip({
      identifiant: "refus-fournisseur",
      statut: "echouee",
      clip: { jete: false },
      emplacements: [{ raison: "le fournisseur a refusé la demande" }],
    })
    expect(clipsNonMontes([autre], personnage())).toEqual([])
  })
})

describe("etatDeLaCase — « ratee » avant « à juger »", () => {
  const rangeeVide = { pose: "repos", direction: null, retenue: null, compte: 0 }

  test("une case dont le seul clip non monté est raté se dit « ratee »", () => {
    const ratee = clip({
      identifiant: "rate-1",
      pose: "repos",
      direction: null,
      statut: "echouee",
      clip: { jete: false, controle: "vide" },
    })
    expect(etatDeLaCase(rangeeVide, [ratee])).toBe("ratee")
  })

  test("une retenue prime sur un clip raté de la même rangée", () => {
    const ratee = clip({ identifiant: "rate-1", statut: "echouee", clip: { jete: false, controle: "immobile" } })
    const avecRetenue = { ...rangeeVide, retenue: {} as never }
    expect(etatDeLaCase(avecRetenue, [ratee])).toBe("retenue")
  })
})
