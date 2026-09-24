// L'aimant de la toile, et le défaut qu'un essai d'écran ne peut pas voir (TS13).
//
// « Repasser par Ambiances et couleurs, puis revenir sur Inspiration, laisse la
// toile vide sur "la toile se règle sur la grille…" » — le défaut porté par
// `crans`, dans `useCrans` (`./Toile`). Un essai d'écran qui clique les deux
// onglets dans `App.test.tsx` ne le voit **pas** : `<Toile>` est démontée puis
// remontée en entier avec le changement d'onglet (elle vit dans le même bloc
// conditionnel que la réserve), et au remontage elle reçoit tout de suite la
// dernière valeur non nulle de `crans` — celle que l'écran parent, lui, n'a
// jamais reperdue puisqu'il ne démonte pas. Le placeholder ne paraît donc
// jamais à l'écran, alors que la vraie mesure, elle, est restée figée sur ce
// qu'elle valait avant l'aller-retour. Le défaut ne vit que **dans le
// crochet** ; c'est là qu'on l'essaie.
//
// jsdom ne met rien en page (`Toile.test.tsx` l'explique) : `getComputedStyle`
// doit être doublé pour rendre une largeur de colonne, comme `doublerLaGrille`
// le fait dans `App.test.tsx` — réduit ici au seul crochet.

import { createRef } from "react"
import { act, renderHook } from "@testing-library/react"
import { afterEach, describe, expect, test, vi } from "vitest"

import { useCrans } from "./Toile"

function doublerLaColonne(largeur: number) {
  const vrai = window.getComputedStyle.bind(window)
  vi.spyOn(window, "getComputedStyle").mockImplementation(((
    element: Element,
    pseudo?: string | null,
  ) => {
    if (element instanceof HTMLElement && element.dataset.grille !== undefined)
      return {
        gridTemplateColumns: `${largeur}px ${largeur}px`,
        getPropertyValue: () => "",
      } as unknown as CSSStyleDeclaration
    return vrai(element, pseudo)
  }) as typeof window.getComputedStyle)
}

function grille(): HTMLDivElement {
  const el = document.createElement("div")
  el.dataset.grille = ""
  return el
}

describe("useCrans — le retour d'un onglet qui démonte le cadre (TS13)", () => {
  afterEach(() => vi.restoreAllMocks())

  test("le cadre redevient disponible sans que `vue` change : la mesure reprend", () => {
    doublerLaColonne(160)
    const cadre = createRef<HTMLDivElement>()
    cadre.current = grille()

    const { result, rerender } = renderHook(
      ({ actif }: { actif: boolean }) => useCrans(cadre, "toile", actif),
      { initialProps: { actif: true } },
    )
    expect(result.current).toEqual({ 1: 160, 2: 329, 4: 667 })

    // L'onglet « Ambiances et couleurs » démonte le cadre — `cote !==
    // "inspiration"` dans `Univers.tsx`.
    cadre.current = null
    act(() => rerender({ actif: false }))
    expect(result.current).toEqual({ 1: 160, 2: 329, 4: 667 }) // rien ne bouge pendant l'absence

    // Il remonte, avec une grille plus large — la fenêtre a bougé pendant
    // l'absence, ou c'est simplement une nouvelle instance du nœud.
    doublerLaColonne(200)
    cadre.current = grille()
    act(() => rerender({ actif: true }))

    // Sans le correctif (deps `[cadre, vue]` seules), rien ne redéclenche la
    // mesure ici — ni `cadre` ni `vue` n'ont changé d'identité — et la toile
    // resterait sur les 160 d'avant l'aller-retour au lieu des 200 réels.
    expect(result.current).toEqual({ 1: 200, 2: 409, 4: 827 })
  })

  test("sans le troisième argument, la mesure se prend une fois pour toutes (comportement par défaut)", () => {
    // `actif` est optionnel, à `true` par défaut — un appelant qui ne le
    // fournit pas retrouve exactement les trois déclencheurs d'avant TS13.
    doublerLaColonne(160)
    const cadre = createRef<HTMLDivElement>()
    cadre.current = grille()

    const { result } = renderHook(() => useCrans(cadre, "toile"))
    expect(result.current).toEqual({ 1: 160, 2: 329, 4: 667 })
  })
})

// Relecture du 24 septembre 2026 (défaut 3) : le détail d'une carte ou d'un
// îlot démonte la réserve exactement comme « Ambiances et couleurs » le
// fait pour TS13 ci-dessus — la même case de grille change de contenu sans
// que `vue` bouge. `Univers.tsx` doit donc composer `actif` avec le même
// booléen que `detailOuvert`, sans quoi le mécanisme d'actif ci-dessus ne
// se déclenche jamais : la réserve resterait mesurée sur `null` (ou sur sa
// dernière valeur d'avant l'ouverture du détail) après la fermeture. Comme
// pour TS13, un essai d'écran classique ne voit pas ce défaut — `Toile` ne
// se démonte pas, seule la réserve à l'intérieur d'`Univers` le fait — donc
// on l'essaie ici, au niveau du crochet, avec la composition exacte
// qu'`Univers.tsx` calcule (`cote === "inspiration" && !detailOuvert`).
describe("useCrans — le détail d'une carte ferme la réserve sans changer `vue` (TS15 × TS13, défaut 3)", () => {
  afterEach(() => vi.restoreAllMocks())

  test("fermer le détail (`detailOuvert` redevient faux) reprend la mesure", () => {
    doublerLaColonne(160)
    const cadre = createRef<HTMLDivElement>()
    cadre.current = grille()
    const cote: "inspiration" | "ambiances" = "inspiration"

    const { result, rerender } = renderHook(
      ({ detailOuvert }: { detailOuvert: boolean }) =>
        useCrans(cadre, "toile", cote === "inspiration" && !detailOuvert),
      { initialProps: { detailOuvert: false } },
    )
    expect(result.current).toEqual({ 1: 160, 2: 329, 4: 667 })

    // On choisit une carte : le détail prend la place de la réserve, qui se
    // démonte (`!detailOuvert && <Reserve … cadre={grilleReserve} />`).
    cadre.current = null
    act(() => rerender({ detailOuvert: true }))
    expect(result.current).toEqual({ 1: 160, 2: 329, 4: 667 }) // rien ne bouge, détail ouvert

    // On referme le détail : la réserve remonte, avec une grille plus large
    // (la fenêtre a bougé pendant qu'elle était cachée).
    doublerLaColonne(200)
    cadre.current = grille()
    act(() => rerender({ detailOuvert: false }))

    // Sans `!detailOuvert` dans l'expression passée à `useCrans` (donc
    // `actif` resté vrai tout du long), rien ne redéclenche la mesure ici :
    // la toile resterait sur les 160 d'avant l'ouverture du détail.
    expect(result.current).toEqual({ 1: 200, 2: 409, 4: 827 })
  })
})
