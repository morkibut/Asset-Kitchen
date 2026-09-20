// Ce que la grille du jeu montre (B13) : le sujet posé sur les cases du
// moteur, ses voisins étiquetés de leur occupation, et le plafond réel
// d'occupation — le seul calcul neuf de la tranche, et il existe déjà
// (`occupationMax`, `interface/src/api.ts`). Aucun appel serveur : l'écran ne
// reçoit que des props déjà chargées, comme `Vitrine.tsx`.

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react"
import { afterEach, describe, expect, test, vi } from "vitest"

import { GrilleDuJeu } from "./GrilleDuJeu"
import { RECETTE_VIDE, type Asset, type Case, type Personnage, type Pose, type Univers } from "../api"

afterEach(cleanup)

function image(surplus: Partial<Asset> & { identifiant: string }): Asset {
  return {
    generation: "gen-1",
    rang: 0,
    largeur: 256,
    hauteur: 256,
    type_media: "image/png",
    label: `image ${surplus.identifiant}`,
    recette: RECETTE_VIDE,
    rendu_largeur: 64,
    rendu_hauteur: 64,
    cree_le: 200,
    cout_usd: 0.02,
    consomme: 0.02,
    unite: "usd",
    provenance: "auteur",
    modele: "gpt-image-2",
    personnage: "le-pelerin",
    pose: "repos",
    direction: "sud",
    piece: null,
    calque: null,
    lot: null,
    personnage_supprime: false,
    epingle: false,
    matiere: false,
    projet: "le-marais",
    collection: null,
    parent: null,
    parent_supprime: false,
    favori: false,
    supprime_le: null,
    traite: true,
    empreinte: "e1",
    ...surplus,
  }
}

function sienne(surplus: Partial<Case> & { pose: string }): Case {
  return {
    demandees: 1,
    images: [],
    bandes: [],
    bandes_ecartees: [],
    bandes_demandees: 1,
    calques: {},
    retenus: {},
    corps: null,
    origine: "type",
    directions: [],
    directions_rangees: [],
    sans_direction: [],
    ...surplus,
  }
}

const PLAN: Pose[] = [
  { identifiant: "repos", nom: "repos", images: 1, consigne: "", ecartees: [], images_avant: 0 },
]

function sujet(surplus: Partial<Personnage> = {}): Personnage {
  return {
    identifiant: "le-pelerin",
    projet: "le-marais",
    nom: "Le pèlerin",
    description: "",
    ecartees: [],
    concept_arts: [],
    references_ecartees: [],
    cree_le: 1_700_000_000,
    cases: [sienne({ pose: "repos", images: [image({ identifiant: "a" })], corps: "a" })],
    plan: PLAN,
    type: "personnage",
    ambiance: "",
    prend: "tout",
    textes: {},
    eteints: [],
    references: [],
    ajoutees: [],
    directions_ecartees: {},
    hors_calibrage: [],
    famille: "personnages",
    equipable: true,
    ...surplus,
  } as Personnage
}

function univers(surplus: Partial<Univers> = {}): Univers {
  return {
    bible: [],
    bareme: [
      { nom: "personnage", famille: "personnages", occupation: 100, silhouette: true },
      { nom: "créature", famille: "personnages", occupation: 90, silhouette: true },
      { nom: "décor", famille: "decors", occupation: 100, silhouette: false },
    ],
    style: "pixel",
    cible_px: 64,
    vue: "",
    couleurs: 24,
    methode_pixels: "proche",
    palette: [],
    palette_empreinte: "",
    fond: "#336633",
    modeles: {},
    ...surplus,
  } as unknown as Univers
}

function monter(
  surplusSujet: Partial<Personnage> = {},
  surplusUnivers: Partial<Univers> = {},
) {
  const onFermer = vi.fn()
  const onComparer = vi.fn()
  render(
    <GrilleDuJeu
      personnage={sujet(surplusSujet)}
      plan={PLAN}
      univers={univers(surplusUnivers)}
      onFermer={onFermer}
      onComparer={onComparer}
    />,
  )
  return { onFermer, onComparer }
}

describe("le plafond réel d'occupation", () => {
  test("sur une case de 64, le plafond du métier gagne : 800 %", () => {
    monter({}, { cible_px: 64 })
    expect(screen.getByText("800 %")).toBeTruthy()
    expect(screen.getByText(/huit personnages de haut/i)).toBeTruthy()
  })

  test("sur une case de 512, le plafond de la toile gagne : 400 %, et le dit", () => {
    monter({}, { cible_px: 512 })
    expect(screen.getByText("400 %")).toBeTruthy()
    expect(screen.getByText(/2 048 px de côté/)).toBeTruthy()
    expect(screen.getByText(/descend de 800 %.*à 400 %/)).toBeTruthy()
  })
})

describe("ce qu'il occupe", () => {
  test("lit le type, l'occupation de son barème et la case du jeu", () => {
    monter()
    // « personnage » paraît deux fois (son type, et sa ligne du barème) : on
    // vise la valeur par sa voisine, l'étiquette qui la précède dans la grille.
    expect(screen.getByText("Son type de sujet").nextElementSibling?.textContent).toBe(
      "personnage",
    )
    expect(screen.getByText("100 % d'une case")).toBeTruthy()
    expect(screen.getByText("64 px")).toBeTruthy()
  })

  test("sans case imposée, le dit plutôt que d'inventer un nombre", () => {
    monter({}, { cible_px: 0 })
    expect(screen.getByText("aucune imposée")).toBeTruthy()
  })
})

describe("le zoom", () => {
  test("quatre crans entiers, et seulement quatre", () => {
    monter()
    ;["×1", "×2", "×4", "×8"].forEach((libelle) => {
      expect(screen.getByRole("button", { name: libelle })).toBeTruthy()
    })
    expect(screen.queryByRole("button", { name: "×3" })).toBeNull()
  })

  test("×2 est le cran de départ", () => {
    monter()
    expect(screen.getByRole("button", { name: "×2" })).toHaveAttribute("aria-pressed", "true")
  })

  test("cliquer un cran l'active", () => {
    monter()
    fireEvent.click(screen.getByRole("button", { name: "×8" }))
    expect(screen.getByRole("button", { name: "×8" })).toHaveAttribute("aria-pressed", "true")
    expect(screen.getByRole("button", { name: "×2" })).toHaveAttribute("aria-pressed", "false")
  })
})

describe("les voisins", () => {
  test("un chip par autre type du barème, avec son occupation", () => {
    monter()
    expect(screen.getByRole("button", { name: /créature · 90 %/ })).toBeTruthy()
    expect(screen.getByRole("button", { name: /décor · 100 %/ })).toBeTruthy()
    // Le sien n'est pas listé comme voisin de lui-même.
    expect(screen.queryByRole("button", { name: /^personnage ·/ })).toBeNull()
  })

  test("cliqué, un voisin apparaît dans la scène", () => {
    monter()
    const scene = document.querySelector("[data-scene-de-la-grille]") as HTMLElement
    expect(within(scene).queryByText(/créature/)).toBeNull()
    fireEvent.click(screen.getByRole("button", { name: /créature · 90 %/ }))
    expect(within(scene).getByText(/créature/)).toBeTruthy()
  })
})

describe("les portes", () => {
  test("‹ Sa page ferme l'écran", () => {
    const { onFermer } = monter()
    fireEvent.click(screen.getByRole("button", { name: "‹ Le pèlerin" }))
    expect(onFermer).toHaveBeenCalledTimes(1)
  })

  test("Comparer › ouvre le comparateur", () => {
    const { onComparer } = monter()
    fireEvent.click(screen.getByRole("button", { name: "Comparer ›" }))
    expect(onComparer).toHaveBeenCalledTimes(1)
  })
})

test("un sujet sans image affiche un espace réservé, sans planter", () => {
  monter({ cases: [sienne({ pose: "repos" })] })
  expect(document.querySelector("[data-grille-du-jeu]")).toBeTruthy()
})
