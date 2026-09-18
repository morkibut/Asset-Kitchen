import { expect, test } from "vitest"
import type { Main, Trait } from "../api"
import { couverture, passagesEnAttente, rejouer } from "./MainVivante"

const trait = (points: [number, number][], rayon = 0, garde = true, couleur = ""): Trait => ({ points, rayon, garde, couleur })

test("un trait relie ses points, et le rayon pose un carré sur chaque pixel", () => {
  const ligne = couverture(6, 3, trait([[0, 1], [3, 1]]))
  expect([...ligne.slice(6, 12)]).toEqual([1, 1, 1, 1, 0, 0])
  const carre = couverture(5, 5, trait([[2, 2]], 1))
  expect(carre.reduce((n, v) => n + v, 0)).toBe(9)
})

test("seuls les passages ajoutés après le rendu sont rejoués ; après un « défaire », rien", () => {
  const a = trait([[0, 0]]), b = trait([[1, 1]])
  const rendue: Main = { opacite: [a], calques: [] }
  expect(passagesEnAttente(rendue, { opacite: [a, b], calques: [] })?.opacite).toEqual([b])
  expect(passagesEnAttente({ opacite: [a, b], calques: [] }, { opacite: [a], calques: [] })).toBeNull()
})

test("rejouer efface l'opacité et peint les calques", () => {
  const pixels = new Uint8ClampedArray(2 * 1 * 4).fill(200)
  rejouer(pixels, 2, 1, {
    opacite: [trait([[0, 0]], 0, false)],
    calques: [{ visible: true, passages: [trait([[1, 0]], 0, true, "#ff0000")] }],
  })
  expect([...pixels]).toEqual([200, 200, 200, 0, 255, 0, 0, 255])
})
