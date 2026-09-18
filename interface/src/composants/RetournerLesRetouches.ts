/**
 * **Retourner une frame à l'identique** (16 septembre 2026).
 *
 * Le serveur retourne l'image, *puis* pose le décalage et la Main. Sans ce
 * module, retourner une frame retouchée gardait les pixels peints et le
 * décalage à leur ancienne place. Ici, quand le retournement d'une frame
 * change, ses retouches changent avec lui.
 *
 * Seuls les miroirs se transposent : gauche-droite, haut-bas et demi-tour.
 * Les quarts de tour, la diagonale, le repli, les zones et les rotations
 * libres laissent les retouches où elles sont.
 */

import type { Main, Prise, Recette, Trait } from "../api"
import { dort } from "../recette"

type Miroir = { x: boolean; y: boolean }

/** Le miroir que cette recette applique, ou `null` s'il ne se transpose pas. */
export function miroirDe(recette: Recette | null | undefined): Miroir | null {
  const r = recette?.retournement
  if (!recette || !r || (recette.veille && dort(recette, "retournement"))) return { x: false, y: false }
  if (r.sens === "gauche-droite") return { x: true, y: false }
  if (r.sens === "haut-bas") return { x: false, y: true }
  if (r.sens === "demi-tour") return { x: true, y: true }
  return null
}

const trait = (t: Trait, m: Miroir, large: number, haut: number): Trait => ({
  ...t,
  points: t.points.map(([x, y]) => [m.x ? large - 1 - x : x, m.y ? haut - 1 - y : y]),
})

export function mainRetournee(main: Main, m: Miroir, large: number, haut: number): Main {
  return {
    opacite: main.opacite.map((t) => trait(t, m, large, haut)),
    calques: main.calques.map((c) => ({ ...c, passages: c.passages.map((t) => trait(t, m, large, haut)) })),
  }
}

/** La prise dont le retournement passe de `avant` à `apres`, retouches suivies. */
export function priseRetournee(prise: Prise, avant: Recette | null | undefined, apres: Recette | null | undefined, large: number, haut: number): Prise {
  const a = miroirDe(avant)
  const b = miroirDe(apres)
  if (!a || !b) return prise
  const m = { x: a.x !== b.x, y: a.y !== b.y }
  if (!m.x && !m.y) return prise
  return {
    ...prise,
    dx: m.x ? -prise.dx : prise.dx,
    dy: m.y ? -prise.dy : prise.dy,
    main_apres_placement: prise.main_apres_placement ? mainRetournee(prise.main_apres_placement, m, large, haut) : prise.main_apres_placement,
  }
}
