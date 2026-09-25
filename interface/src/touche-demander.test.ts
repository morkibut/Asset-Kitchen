// CM4 — la preuve que `Ctrl+/` est libre (`docs/PLAN-assistant.md` § CM4, point dur).
//
// Deux essais, pour les deux moitiés de la preuve :
//
// 1. **Dans le produit** : la liste ci-dessous recopie, à la main, chaque combinaison
//    de touches qu'un composant du dépôt écoute déjà (relevé par une recherche de
//    `keydown`, `key ===`, `ctrlKey`, `metaKey` dans `interface/src`, le 25 septembre
//    2026 — le recensement complet, avec le fichier et la ligne de chacune, est écrit
//    sous CM4 dans `docs/PLAN-assistant.md`). Aucune n'est `Ctrl+/` : si une future
//    touche venait à l'utiliser, ce serait à elle de mettre à jour cette liste, et
//    l'essai la comparerait alors à `estLaToucheDemander` pour le dire.
// 2. **Dans les trois navigateurs visés** (Chrome, Edge, Firefox, sous Windows) :
//    `Ctrl+/` n'apparaît dans aucune liste de raccourcis réservés publiée par les
//    trois — contrairement à `Ctrl+N/T/W/F/S/P/O/U/R/L/D/K/E/H/J`, `Ctrl+Shift+*`,
//    `Alt+←/→` (retour/avance) et les touches `F1..F12`, qui sont réservées par l'un
//    ou l'autre. C'est un fait externe, pas exécutable ; il est noté ici pour que la
//    preuve reste à un seul endroit avec celle du produit.
import { describe, expect, test } from "vitest"
import { estLaToucheDemander } from "./touche-demander"

/** Chaque raccourci déjà posé dans le produit, tel que `estLaToucheDemander`
 *  le verrait s'il l'écoutait — recopié du relevé, pas deviné. */
const TOUCHES_DEJA_PRISES: { touche: string; ou: string; e: Partial<KeyboardEvent> }[] = [
  { touche: "?", ou: "App.tsx — ouvrir le guide", e: { key: "?" } },
  { touche: "Ctrl+Z / Cmd+Z", ou: "App.tsx, AtelierDeBande.tsx, EditeurDePixels.tsx, Retouche.tsx, Toile.tsx — défaire", e: { key: "z", ctrlKey: true } },
  { touche: "Ctrl+Shift+Z / Cmd+Shift+Z", ou: "les mêmes — refaire", e: { key: "z", ctrlKey: true, shiftKey: true } },
  { touche: "Ctrl+Y", ou: "EditeurDePixels.tsx — refaire", e: { key: "y", ctrlKey: true } },
  { touche: "Ctrl+Enter / Cmd+Enter", ou: "BarreQuiPaie.tsx, ChampPrompt.tsx — générer", e: { key: "Enter", ctrlKey: true } },
  { touche: "Alt+ArrowLeft / Alt+ArrowRight", ou: "AtelierUnifieRetouche.tsx, Montage.tsx — déplacer d'un cran", e: { key: "ArrowLeft", altKey: true } },
  { touche: "Espace", ou: "Apercu.tsx, GrilleEcoute.tsx, Montage.tsx, SurfaceZoomable.tsx — lire/panoramiquer", e: { key: " " } },
  { touche: "g / G", ou: "GrilleEcoute.tsx — geste de la grille d'écoute", e: { key: "g" } },
  { touche: "Shift+S", ou: "EssaiDuSujet.tsx — mode court", e: { key: "s", shiftKey: true } },
  { touche: "Escape", ou: "une vingtaine d'écrans — fermer", e: { key: "Escape" } },
]

describe("CM4 — `Ctrl+/` est libre dans le produit", () => {
  test.each(TOUCHES_DEJA_PRISES)("« $touche » ($ou) n'est pas `Ctrl+/`", ({ e }) => {
    expect(estLaToucheDemander(e as KeyboardEvent)).toBe(false)
  })

  test("`Ctrl+/` déclenche la touche demander", () => {
    expect(estLaToucheDemander({ key: "/", ctrlKey: true } as KeyboardEvent)).toBe(true)
    expect(estLaToucheDemander({ key: "/", metaKey: true } as KeyboardEvent)).toBe(true)
  })

  test("un caractère imprimable seul — taper « / » dans un champ — ne la déclenche pas", () => {
    // Le piège nommé par le plan : sans modificateur, ce n'est qu'un caractère tapé.
    expect(estLaToucheDemander({ key: "/" } as KeyboardEvent)).toBe(false)
  })

  test("sur un clavier français, Ctrl+Maj+: donne « / » avec Maj — la touche doit répondre", () => {
    // Relecture croisée : `!shiftKey` rendait la touche injoignable sans pavé numérique.
    expect(estLaToucheDemander({ key: "/", ctrlKey: true, shiftKey: true, code: "Period" } as KeyboardEvent)).toBe(true)
  })

  test("sur un clavier américain, Ctrl+Maj+/ donne « ? » — la touche ne répond pas", () => {
    expect(estLaToucheDemander({ key: "?", ctrlKey: true, shiftKey: true, code: "Slash" } as KeyboardEvent)).toBe(false)
  })

  test("Ctrl+/ avec Alt en plus ne la déclenche pas — un raccourci du système d'exploitation reste possible", () => {
    expect(estLaToucheDemander({ key: "/", ctrlKey: true, altKey: true } as KeyboardEvent)).toBe(false)
  })
})
