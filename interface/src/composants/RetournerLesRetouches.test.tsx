import { expect, test } from "vitest"
import { RECETTE_VIDE, type Prise, type Recette } from "../api"
import { priseRetournee } from "./RetournerLesRetouches"

const sans = RECETTE_VIDE
const miroir = { ...sans, retournement: { sens: "gauche-droite" } } as Recette

const prise: Prise = {
  numero: 0, clip: "c", dx: 3, dy: -2,
  main_apres_placement: {
    opacite: [{ garde: false, rayon: 0, points: [[2, 3]], couleur: "" }],
    calques: [{ nom: "calque 1", visible: true, passages: [{ garde: true, rayon: 1, points: [[10, 12]], couleur: "#00ff00" }] }],
  },
}

test("retourner une frame retourne son décalage et sa Main", () => {
  const apres = priseRetournee(prise, sans, miroir, 16, 16)
  expect([apres.dx, apres.dy]).toEqual([-3, -2])
  expect(apres.main_apres_placement?.opacite[0].points).toEqual([[13, 3]])
  expect(apres.main_apres_placement?.calques[0].passages[0].points).toEqual([[5, 12]])
  // Et la retourner encore rend la frame de départ.
  expect(priseRetournee(apres, miroir, sans, 16, 16)).toEqual(prise)
})

test("sans changement de sens, ou pour un quart de tour, rien ne bouge", () => {
  expect(priseRetournee(prise, miroir, miroir, 16, 16)).toBe(prise)
  expect(priseRetournee(prise, sans, { ...sans, retournement: { sens: "quart-droite" } } as Recette, 16, 16)).toBe(prise)
})
