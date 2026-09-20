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

// Quatre choses que `GU2` apporte — l'encadré de tête, les groupes, le repli,
// le lien de bulle — ne peuvent pas toutes se vérifier contre le vrai corpus :
// aucune de ses 229 fiches ne porte encore de `groupe`, et aucun écran n'a
// encore son résumé. Les deux s'écrivent écran par écran, de `GU4` à `GU15`.
//
// On ajoute donc quelques fiches d'essai sur « tableau-de-bord » — un écran
// que le corpus laissait vide — et un résumé pour lui, qui prend le pas sur
// celui que `GU4` lui a depuis donné : c'est lui que les essais lisent.
//
// **`GU4` a rempli les seize résumés du corpus** : il n'existe donc plus
// d'écran réel sans rien à montrer. L'essai qui vérifie ce cas-là neutralise
// « depenses » — vidé de son résumé pour l'occasion, ci-dessous — plutôt que
// de compter sur un écran resté vide par hasard. Le reste du corpus passe tel
// quel : les essais qui vérifient qui paraît où lisent toujours le vrai.
const essai = vi.hoisted(() => ({
  fiches: {
    "essai.pinceau.taille": {
      nom: "La taille du pinceau",
      groupe: "le pinceau",
      ou: "tableau-de-bord" as const,
      quoi: "La largeur du trait, en pixels.",
      change: "Rien à la génération.",
      origine: "toi · douze pixels au départ",
    },
    "essai.palette.teintes": {
      nom: "Les teintes tenues",
      groupe: "la palette",
      ou: "tableau-de-bord" as const,
      quoi: "Les couleurs que le trait a le droit de poser.",
      change: "Une couleur hors palette est ramenée à la plus proche.",
      origine: "univers · la palette du projet",
    },
    "essai.pinceau.durete": {
      nom: "La dureté du pinceau",
      groupe: "le pinceau",
      ou: "tableau-de-bord" as const,
      quoi: "La netteté du bord du trait.",
      change: "Rien à la génération.",
      origine: "toi · bord net au départ",
      long: "Un bord flou sur une image de seize pixels se voit comme une tache.",
    },
    "essai.pas-encore-rangee": {
      nom: "Un réglage pas encore rangé",
      ou: "tableau-de-bord" as const,
      quoi: "Une fiche que le chantier n'a pas encore visitée.",
      change: "Rien à la génération.",
      origine: "toi",
    },
  },
  resumes: {
    "tableau-de-bord": {
      aQuoi: "On y peint sur l'image qu'on vient de recevoir.",
      gestes: ["on choisit un pinceau", "on peint", "on garde la version"],
    },
  },
}))

vi.mock("../aide", async (reel) => {
  const vrai = await reel<typeof import("../aide")>()
  return {
    ...vrai,
    AIDE: { ...vrai.AIDE, ...essai.fiches },
    // `depenses` : vidé de son résumé pour l'essai qui a besoin d'un écran
    // sans rien — voir le commentaire ci-dessus.
    RESUMES: { ...vrai.RESUMES, ...essai.resumes, depenses: undefined },
  }
})

afterEach(() => {
  cleanup()
  reinitialiserGuide()
})

describe("il montre ce qui concerne l'écran ouvert, pas un sommaire", () => {
  test("un écran sans aucune entrée ne montre rien à expliquer", () => {
    // "depenses" existe comme lieu ; ni fiche ni résumé n'y sont adressés
    // dans cet essai — le mock ci-dessus vide son résumé pour l'occasion.
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
    expect(screen.getByRole("heading", { name: "L'image choisie" })).toBeTruthy()
  })

  test("sans écran calculé, aucune entrée ne paraît", () => {
    render(<VoletGuide onFermer={vi.fn()} ecran={null} />)

    expect(screen.getByText("Rien à expliquer ici pour l'instant.")).toBeTruthy()
  })

  test("le texte rendu est exactement celui du corpus, jamais recopié", () => {
    render(<VoletGuide onFermer={vi.fn()} ecran="ambiances" />)

    expect(screen.getByText(AIDE["univers.palette"].quoi)).toBeTruthy()
    fireEvent.click(screen.getByRole("button", { name: "Une palette" }))
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

  test("la fiche visée arrive déjà dépliée, pas seulement sous les yeux", () => {
    ouvrirGuide("univers.palette")

    render(<VoletGuide onFermer={vi.fn()} ecran="codex" />)

    // Dépliée : ce que ça change et d'où ça sort sont là sans avoir cliqué.
    expect(screen.getByText(AIDE["univers.palette"].change)).toBeTruthy()
    expect(screen.getByRole("button", { name: "Une palette" }).getAttribute("aria-expanded")).toBe(
      "true",
    )
  })

  test("les fiches voisines, elles, restent repliées", () => {
    ouvrirGuide("univers.palette")

    render(<VoletGuide onFermer={vi.fn()} ecran="ambiances" />)

    expect(screen.getByRole("button", { name: "Une ambiance" }).getAttribute("aria-expanded")).toBe(
      "false",
    )
  })
})

// ── Ce que GU2 ajoute ──────────────────────────────────────────────────────

describe("l'encadré de tête — à quoi sert la page", () => {
  test("le résumé de l'écran paraît, avant tout réglage", () => {
    render(<VoletGuide onFermer={vi.fn()} ecran="tableau-de-bord" />)

    const resume = screen.getByText(essai.resumes["tableau-de-bord"].aQuoi)
    for (const geste of essai.resumes["tableau-de-bord"].gestes) {
      expect(screen.getByText(geste)).toBeTruthy()
    }

    // « Avant tout réglage » se vérifie, sinon ce n'est qu'une intention.
    const premiereFiche = screen.getByRole("heading", { name: "La taille du pinceau" })
    expect(resume.compareDocumentPosition(premiereFiche)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    )
  })

  test("un écran sans résumé n'en invente pas et ouvre sur ses réglages", () => {
    render(<VoletGuide onFermer={vi.fn()} ecran="ambiances" />)

    expect(screen.queryByText(essai.resumes["tableau-de-bord"].aQuoi)).toBeNull()
    expect(screen.getByRole("heading", { name: "Une palette" })).toBeTruthy()
  })
})

describe("les groupes — les fiches d'une même zone sous un même titre", () => {
  test("deux fiches du même groupe se retrouvent sous le seul titre de ce groupe", () => {
    render(<VoletGuide onFermer={vi.fn()} ecran="tableau-de-bord" />)

    const titre = screen.getByRole("heading", { name: "le pinceau" })
    const zone = titre.closest("section")!

    expect(zone.contains(screen.getByRole("heading", { name: "La taille du pinceau" }))).toBe(true)
    expect(zone.contains(screen.getByRole("heading", { name: "La dureté du pinceau" }))).toBe(true)
    // Elles sont séparées dans le fichier : un seul titre, pas deux identiques.
    expect(screen.getAllByRole("heading", { name: "le pinceau" })).toHaveLength(1)
    expect(zone.contains(screen.getByRole("heading", { name: "Les teintes tenues" }))).toBe(false)
  })

  test("l'ordre des groupes est celui du fichier, jamais l'alphabet", () => {
    render(<VoletGuide onFermer={vi.fn()} ecran="tableau-de-bord" />)

    const pinceau = screen.getByRole("heading", { name: "le pinceau" })
    const palette = screen.getByRole("heading", { name: "la palette" })

    expect(pinceau.compareDocumentPosition(palette)).toBe(Node.DOCUMENT_POSITION_FOLLOWING)
  })

  test("une fiche pas encore rangée passe à la fin, sous un titre honnête", () => {
    render(<VoletGuide onFermer={vi.fn()} ecran="tableau-de-bord" />)

    const reste = screen.getByRole("heading", { name: "Le reste de cet écran" })
    expect(reste.closest("section")!.contains(
      screen.getByRole("heading", { name: "Un réglage pas encore rangé" }),
    )).toBe(true)

    const palette = screen.getByRole("heading", { name: "la palette" })
    expect(palette.compareDocumentPosition(reste)).toBe(Node.DOCUMENT_POSITION_FOLLOWING)
  })

  test("un écran dont aucune fiche n'est rangée ne montre aucun titre de zone", () => {
    render(<VoletGuide onFermer={vi.fn()} ecran="ambiances" />)

    expect(screen.queryByRole("heading", { name: "Le reste de cet écran" })).toBeNull()
    expect(screen.getByRole("heading", { name: "Une palette" })).toBeTruthy()
  })
})

describe("le repli — on parcourt, on ne lit pas", () => {
  test("une fiche repliée montre son nom et ce que c'est, rien d'autre", () => {
    render(<VoletGuide onFermer={vi.fn()} ecran="tableau-de-bord" />)

    expect(screen.getByRole("heading", { name: "La dureté du pinceau" })).toBeTruthy()
    expect(screen.getByText("La netteté du bord du trait.")).toBeTruthy()

    expect(screen.queryByText("toi · bord net au départ")).toBeNull()
    expect(
      screen.queryByText("Un bord flou sur une image de seize pixels se voit comme une tache."),
    ).toBeNull()
  })

  test("un clic la déplie sur ce que ça change, d'où ça sort et l'à savoir", () => {
    render(<VoletGuide onFermer={vi.fn()} ecran="tableau-de-bord" />)

    fireEvent.click(screen.getByRole("button", { name: "La dureté du pinceau" }))

    expect(screen.getByText("toi · bord net au départ")).toBeTruthy()
    expect(
      screen.getByText("Un bord flou sur une image de seize pixels se voit comme une tache."),
    ).toBeTruthy()
  })

  test("un second clic la referme", () => {
    render(<VoletGuide onFermer={vi.fn()} ecran="tableau-de-bord" />)

    const ligne = screen.getByRole("button", { name: "La dureté du pinceau" })
    fireEvent.click(ligne)
    fireEvent.click(ligne)

    expect(screen.queryByText("toi · bord net au départ")).toBeNull()
  })
})

describe("une entrée mal adressée ne casse rien", () => {
  test("un ou inconnu — que le type ferme à la compilation — dégrade plutôt que de planter", () => {
    const inconnu = "un-lieu-qui-nexiste-pas" as unknown as Explication["ou"]

    render(<VoletGuide onFermer={vi.fn()} ecran={inconnu} />)

    expect(screen.getByText("Rien à expliquer ici pour l'instant.")).toBeTruthy()
  })
})
