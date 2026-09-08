// Ce que Comparer fait (B13) : deux sujets côte à côte, même pose, même
// zoom, avec l'écart chiffré et l'action qui le corrige — ou deux images d'un
// même sujet, quand le second choix est le premier. Quatre écarts, tous tirés
// de nombres que le produit calcule déjà (`Asset.rendu_hauteur`/
// `rendu_largeur`, `recette.contours`, `recette.quantification.couleurs`).
// Aucun appel serveur : comme `GrilleDuJeu.test.tsx`, l'écran ne reçoit que
// des props déjà chargées.

import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, test, vi } from "vitest"

import { Comparer } from "./Comparer"
import {
  RECETTE_VIDE,
  type Asset,
  type Case,
  type Personnage,
  type Pose,
  type Univers,
} from "../api"

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
    rendu_largeur: 34,
    rendu_hauteur: 62,
    cree_le: 200,
    cout_usd: 0,
    consomme: 0,
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
  { identifiant: "repos", nom: "Repos", images: 1, consigne: "", ecartees: [], images_avant: 0 },
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

const LE_GARDE = sujet({
  identifiant: "le-garde",
  nom: "Le garde",
  cases: [
    sienne({
      pose: "repos",
      images: [image({ identifiant: "b", rendu_hauteur: 66, rendu_largeur: 38 })],
      corps: "b",
    }),
  ],
})

function monter(
  options: {
    sujetA?: Personnage
    autres?: Personnage[]
    univers?: Univers
    onOuvrirCase?: () => void
  } = {},
) {
  const onFermer = vi.fn()
  const onGrille = vi.fn()
  const onOuvrirCase = vi.fn()
  const sujetA = options.sujetA ?? sujet()
  render(
    <Comparer
      personnage={sujetA}
      personnages={[sujetA, ...(options.autres ?? [LE_GARDE])]}
      plan={PLAN}
      univers={options.univers ?? univers()}
      onFermer={onFermer}
      onGrille={onGrille}
      onOuvrirCase={onOuvrirCase}
    />,
  )
  return { onFermer, onGrille, onOuvrirCase, sujetA }
}

describe("deux sujets côte à côte", () => {
  test("s'ouvre sur le second sujet du jeu, par défaut", () => {
    monter()
    expect(screen.getByText("Deux côte à côte")).toBeTruthy()
    expect(screen.getAllByText("Le pèlerin").length).toBeGreaterThan(0)
    expect(screen.getByRole("combobox", { name: "Comparer avec" })).toHaveValue("le-garde")
  })

  test("les écarts de hauteur et de largeur sont ceux des images réelles", () => {
    monter()
    // Hauteur : 62 contre 66, un écart de +4. Largeur : 34 contre 38, pareil.
    expect(screen.getByText("62 px")).toBeTruthy()
    expect(screen.getByText("66 px")).toBeTruthy()
    expect(screen.getAllByText("+4 px")).toHaveLength(2)
    expect(screen.getByText("34 px")).toBeTruthy()
    expect(screen.getByText("38 px")).toBeTruthy()
  })

  test("une hauteur qui dépasse la case du jeu porte l'action qui la corrige", () => {
    const { onOuvrirCase } = monter()
    // 66 px pour une case de 64 : le garde dépasse sa tuile.
    expect(screen.getByText(/dépasse sa case/)).toBeTruthy()
    fireEvent.click(screen.getByRole("button", { name: "La retoucher" }))
    // **Le sujet propriétaire voyage avec l'image** : sans lui, l'appelant ne
    // peut pas savoir qu'il faut changer de page avant d'ouvrir la case —
    // exactement le bug trouvé au navigateur sur l'atelier jetable de B13.
    expect(onOuvrirCase).toHaveBeenCalledWith("le-garde", "b")
  })

  test("un contour d'un seul côté est un écart, pas « le même »", () => {
    // Le bug trouvé au navigateur sur l'atelier jetable de B13 : la règle
    // exigeait les deux contours non nuls avant de comparer, donc « un
    // détouré, l'autre pas » — le cas le plus courant — passait pour
    // identique.
    monter({
      autres: [
        sujet({
          identifiant: "le-garde",
          nom: "Le garde",
          cases: [
            sienne({
              pose: "repos",
              images: [
                image({
                  identifiant: "b",
                  recette: { ...RECETTE_VIDE, contours: { epaisseur: 2, couleur: "#1a1a1a", position: "externe", trous: "cercles" } },
                }),
              ],
              corps: "b",
            }),
          ],
        }),
      ],
    })
    expect(screen.getByText("aucun")).toBeTruthy()
    expect(screen.getByText("2 px")).toBeTruthy()
    expect(screen.getByText("deux traits différents")).toBeTruthy()
    expect(screen.getByText("Son contour n'est pas le même")).toBeTruthy()
  })

  test("rien ne dépasse : le panneau le dit, sans carte de correction", () => {
    monter({
      autres: [
        sujet({
          identifiant: "le-passeur",
          nom: "Le passeur",
          cases: [
            sienne({
              pose: "repos",
              images: [image({ identifiant: "c", rendu_hauteur: 60, rendu_largeur: 36 })],
              corps: "c",
            }),
          ],
        }),
      ],
    })
    fireEvent.change(screen.getByRole("combobox", { name: "Comparer avec" }), {
      target: { value: "le-passeur" },
    })
    expect(screen.getByText(/Rien ne dépasse ici/)).toBeTruthy()
    expect(screen.queryByRole("button", { name: "La retoucher" })).toBeNull()
  })
})

describe("choisir deux fois le même sujet", () => {
  test("bascule en comparaison de deux de ses images", () => {
    monter({
      sujetA: sujet({
        cases: [
          sienne({
            pose: "repos",
            images: [
              image({ identifiant: "a", cree_le: 100 }),
              image({ identifiant: "a2", cree_le: 200 }),
            ],
          }),
        ],
      }),
    })
    fireEvent.change(screen.getByRole("combobox", { name: "Comparer avec" }), {
      target: { value: "le-pelerin" },
    })
    expect(screen.getByText("Le même, deux fois")).toBeTruthy()
    expect(screen.getByRole("combobox", { name: "La première image" })).toBeTruthy()
    expect(screen.getByRole("combobox", { name: "La seconde image" })).toBeTruthy()
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
})

describe("ça ne modifie rien", () => {
  test("aucun appel réseau ne part de cet écran", () => {
    const fetchDouble = vi.fn()
    vi.stubGlobal("fetch", fetchDouble)
    monter()
    fireEvent.click(screen.getByRole("button", { name: "×8" }))
    fireEvent.change(screen.getByRole("combobox", { name: "Comparer avec" }), {
      target: { value: "le-pelerin" },
    })
    expect(fetchDouble).not.toHaveBeenCalled()
    expect(screen.getByText(/Comparer ne modifie rien/)).toBeTruthy()
    vi.unstubAllGlobals()
  })
})

describe("les portes", () => {
  test("‹ Sa page ferme l'écran, Voir la grille du jeu l'ouvre", () => {
    const { onFermer, onGrille } = monter()
    fireEvent.click(screen.getByRole("button", { name: "‹ Sa page" }))
    expect(onFermer).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole("button", { name: "Voir la grille du jeu" }))
    expect(onGrille).toHaveBeenCalledTimes(1)
  })
})
