// Le guide — devenu un volet (B7) : ce qu'il montre dépend de l'écran ouvert,
// jamais de tout le corpus à la fois.
//
// `App.test.tsx` reste le seul endroit qui monte l'atelier entier et vérifie
// que `?` et le bouton du carnet ouvrent bien ce volet-ci, sur le bon écran.
// Ce fichier-ci monte le volet seul, contre le **vrai** corpus (`aide.ts`) :
// c'est lui qui décide de qui paraît où, jamais une donnée fabriquée pour
// l'essai — un texte recopié ici divergerait du corpus sans que rien ne le
// dise.

import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, test, vi } from "vitest"

import { VoletGuide, ouvrirGuide, reinitialiserGuide } from "./Guide"
import { AIDE, SANS_ENTREE, type Explication } from "../aide"

afterEach(() => {
  cleanup()
  reinitialiserGuide()
})

describe("il montre ce qui concerne l'écran ouvert, pas un sommaire", () => {
  test("un écran sans aucune entrée ne montre rien à expliquer", () => {
    // "depenses" existe comme lieu, mais aucune entrée du corpus n'y est
    // encore adressée aujourd'hui.
    render(<VoletGuide onFermer={vi.fn()} ecran="depenses" />)

    expect(screen.getByText("Rien à expliquer ici pour l'instant.")).toBeTruthy()
  })

  test("un écran qui a des entrées ne montre que les siennes", () => {
    render(<VoletGuide onFermer={vi.fn()} ecran="ambiances" />)

    expect(screen.getByRole("heading", { name: "Une palette" })).toBeTruthy()
    expect(screen.getByRole("heading", { name: "Une ambiance" })).toBeTruthy()
    // "Le codex" est une entrée de l'écran "codex", pas de "ambiances".
    expect(screen.queryByRole("heading", { name: "Le codex" })).toBeNull()
  })

  test("changer d'écran change ce qui paraît", () => {
    const { rerender } = render(<VoletGuide onFermer={vi.fn()} ecran="codex" />)
    expect(screen.getByRole("heading", { name: "Le codex" })).toBeTruthy()

    rerender(<VoletGuide onFermer={vi.fn()} ecran="bande" />)
    expect(screen.queryByRole("heading", { name: "Le codex" })).toBeNull()
    expect(screen.getByRole("heading", { name: "Le nom de l'animation" })).toBeTruthy()
  })

  test("sans écran calculé, aucune entrée ne paraît", () => {
    render(<VoletGuide onFermer={vi.fn()} ecran={null} />)

    expect(screen.getByText("Rien à expliquer ici pour l'instant.")).toBeTruthy()
  })

  test("le texte rendu est exactement celui du corpus, jamais recopié", () => {
    render(<VoletGuide onFermer={vi.fn()} ecran="ambiances" />)

    expect(screen.getByText(AIDE["univers.palette"].quoi)).toBeTruthy()
    expect(screen.getByText(AIDE["univers.palette"].change)).toBeTruthy()
  })
})

describe("il ne recouvre jamais l'écran qu'il documente", () => {
  test("il est posé à droite, en largeur fixe — jamais plein écran", () => {
    render(<VoletGuide onFermer={vi.fn()} ecran="galerie" />)

    const volet = document.querySelector("[data-volet-du-guide]")!
    expect(volet.className).toContain("w-[380px]")
    expect(volet.className).not.toContain("inset-0")
  })

  test("Échap le referme, comme tout écran du produit", () => {
    const onFermer = vi.fn()
    render(<VoletGuide onFermer={onFermer} ecran="galerie" />)

    fireEvent.keyDown(window, { key: "Escape" })

    expect(onFermer).toHaveBeenCalled()
  })

  test("le bouton fermer referme aussi", () => {
    const onFermer = vi.fn()
    render(<VoletGuide onFermer={onFermer} ecran="galerie" />)

    fireEvent.click(screen.getByRole("button", { name: /fermer/ }))

    expect(onFermer).toHaveBeenCalled()
  })
})

describe("le panneau des touches — B7", () => {
  test("un écran qui a des touches réelles les montre", () => {
    render(<VoletGuide onFermer={vi.fn()} ecran="montage" />)

    expect(screen.getByText("Les touches de cet écran")).toBeTruthy()
    expect(screen.getByText("← →")).toBeTruthy()
    expect(screen.getByText("espace")).toBeTruthy()
  })

  test("un écran sans touche ne montre pas le bloc du tout", () => {
    render(<VoletGuide onFermer={vi.fn()} ecran="ambiances" />)

    expect(screen.queryByText("Les touches de cet écran")).toBeNull()
  })
})

describe("ce qui n'est pas écrit reste dit", () => {
  test("la liste de ce qui manque paraît, quel que soit l'écran", () => {
    render(<VoletGuide onFermer={vi.fn()} ecran="galerie" />)

    expect(SANS_ENTREE.length).toBeGreaterThan(0)
    for (const manque of SANS_ENTREE) {
      expect(screen.getByText(manque)).toBeTruthy()
    }
  })
})

describe("le lien d'une bulle retombe toujours juste", () => {
  test("ouvrir sur une clé force l'écran de cette entrée, pas celui qu'on regardait", () => {
    // "univers.palette" vit dans "ambiances" ; on ouvre depuis un écran qui
    // n'a rien à voir, et le volet doit quand même la montrer.
    ouvrirGuide("univers.palette")

    render(<VoletGuide onFermer={vi.fn()} ecran="codex" />)

    expect(screen.getByRole("heading", { name: "Une palette" })).toBeTruthy()
  })
})

describe("une entrée mal adressée ne casse rien", () => {
  test("un ou inconnu — que le type ferme à la compilation — dégrade plutôt que de planter", () => {
    const inconnu = "un-lieu-qui-nexiste-pas" as unknown as Explication["ou"]

    render(<VoletGuide onFermer={vi.fn()} ecran={inconnu} />)

    expect(screen.getByText("Rien à expliquer ici pour l'instant.")).toBeTruthy()
  })
})
