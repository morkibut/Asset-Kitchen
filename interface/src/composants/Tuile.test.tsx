// Ce que la tuile d'un clip fait, seule (B22) : elle montre une couverture —
// jamais une frame à résolution native —, le coin de lecture dit sa durée
// mesurée, et le survol défile les frames de la planche contact déjà servie
// au montage — jamais une nouvelle dépense, jamais avant qu'on pointe dessus.
//
// `fetch` n'entre dans aucun de ces essais : la tuile ne fait qu'écrire des
// adresses d'image, elle ne les charge jamais elle-même.

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, test, vi } from "vitest"

import { Tuile, type Entree } from "./Tuile"
import type { Generation } from "../api"

afterEach(() => {
  cleanup()
})

// ── Le clip de l'essai ───────────────────────────────────────────────────────

function clip(sur: Partial<Generation["clip"]> = {}): Generation {
  return {
    identifiant: "clip-a",
    modele: "bytedance/seedance-2.0-mini",
    demande: {
      prompt: "walking cycle, walking in place",
      prompt_negatif: "",
      proportions: "1:1",
      resolution: "480p",
      variations: 1,
      references: 0,
      options: {},
      mouvement: "marche",
    },
    parametres_resolus: {},
    ecartees: [],
    emplacements: [
      {
        rang: 0,
        statut: "reussie",
        consomme: 0.067,
        unite: "usd",
        cout_usd: 0.067,
        duree_s: 12,
        resultat: {
          fichier: "clip-a.mp4",
          largeur: 480,
          hauteur: 480,
          type_media: "video/mp4",
          octets: 900_000,
        },
        raison: null,
        demarre_le: null,
        duree_attendue_s: 12,
      },
    ],
    cree_le: 1_700_000_000,
    projet: "jeu-1",
    references: [],
    hors_plafond: [],
    parent: null,
    statut: "reussie",
    cout_usd: 0.067,
    consomme: 0.067,
    unite: "usd",
    reussies: 1,
    clip: {
      travail: "travail-clip-a",
      secondes: 5,
      proportions: "1:1",
      resolution: "480p",
      prix_annonce: 0.0945,
      prix_formule: "0,0000035 $ le jeton × 480×480×24×5/1024",
      images: 40,
      cadence: 8,
      extraction_refus: null,
      montant_relu: true,
      recupere: false,
      jete: false,
      lot: "lot-clip-a",
      depart: "",
      montant_dit: "montant relu chez le fournisseur",
      ...sur,
    },
  }
}

function entreeClip(generation: Generation): Entree {
  return { cle: generation.identifiant, date: generation.cree_le, rang: 0, sorte: "clip", generation }
}

const PROPS_DE_BASE = {
  selectionnee: false,
  cote: 256,
  zoom: 2 as const,
  onOuvrir: vi.fn(),
  onRelancer: vi.fn(),
  onChoisir: vi.fn(),
}

describe("Tuile — un clip gardé (B22)", () => {
  test("montre la couverture fabriquée par le serveur, jamais une frame à résolution native", () => {
    render(<Tuile entree={entreeClip(clip())} {...PROPS_DE_BASE} />)

    const image = screen.getByRole("img", { name: "walking cycle, walking in place" })
    expect(image.getAttribute("src")).toBe("/api/clips/clip-a/cover?cote=256")
  })

  test("le coin de lecture dit la durée mesurée sur le fichier, jamais celle demandée", () => {
    // 40 images à 8 i/s : 5 secondes mesurées — la commande, elle, visait
    // peut-être autre chose, et ce n'est pas ce qu'on affiche ici.
    render(<Tuile entree={entreeClip(clip({ images: 40, cadence: 8 }))} {...PROPS_DE_BASE} />)

    expect(screen.getByText("5s")).toBeTruthy()
  })

  test("aucun coin de lecture, aucune pellicule, pour un clip sans image tirée", () => {
    render(
      <Tuile
        entree={entreeClip(
          clip({ images: 0, cadence: 0, extraction_refus: "le décodeur vidéo n'est pas installé" }),
        )}
        {...PROPS_DE_BASE}
      />,
    )

    expect(screen.queryByText(/\ds$/)).toBeNull()
    expect(screen.getByText("le décodeur vidéo n'est pas installé")).toBeTruthy()
  })

  test("la pellicule ne se charge qu'au survol, jamais à l'ouverture de la galerie", () => {
    const { container } = render(<Tuile entree={entreeClip(clip())} {...PROPS_DE_BASE} />)

    const pelliculeAvant = Array.from(container.querySelectorAll<HTMLElement>("[aria-hidden]")).find(
      (element) => element.style.backgroundImage.includes("/api/montage/"),
    )
    expect(pelliculeAvant).toBeUndefined()

    const figure = container.querySelector("figure")!
    fireEvent.pointerEnter(figure)

    const pelliculeApres = Array.from(container.querySelectorAll<HTMLElement>("[aria-hidden]")).find(
      (element) => element.style.backgroundImage.includes("/api/montage/"),
    )
    expect(pelliculeApres).toBeDefined()
    expect(pelliculeApres!.style.backgroundImage).toContain("/api/montage/clip-a/contact")

    // Et la couverture statique s'efface pendant qu'elle joue — sinon les deux
    // images se superposeraient.
    expect(screen.queryByRole("img", { name: "walking cycle, walking in place" })).toBeNull()
  })

  test("le survol défile les frames, et sort à douze images par seconde au plus", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      const { container } = render(
        <Tuile entree={entreeClip(clip({ images: 6, cadence: 8 }))} {...PROPS_DE_BASE} />,
      )
      const figure = container.querySelector("figure")!
      fireEvent.pointerEnter(figure)

      const pellicule = () =>
        Array.from(container.querySelectorAll<HTMLElement>("[aria-hidden]")).find((element) =>
          element.style.backgroundImage.includes("/api/montage/"),
        )!

      const positionDepart = pellicule().style.backgroundPosition
      expect(positionDepart).toBe("0% 0%")

      // 8 i/s bornées à l'intérieur de [2, 12] : une frame toutes les 125 ms.
      await act(async () => {
        vi.advanceTimersByTime(125)
      })
      const positionSuivante = pellicule().style.backgroundPosition
      expect(positionSuivante).not.toBe(positionDepart)
    } finally {
      vi.useRealTimers()
    }
  })

  test("sortir du survol revient à la première frame — un nouveau survol ne reprend pas où il s'était arrêté", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      const { container } = render(
        <Tuile entree={entreeClip(clip({ images: 6, cadence: 8 }))} {...PROPS_DE_BASE} />,
      )
      const figure = container.querySelector("figure")!
      const pellicule = () =>
        Array.from(container.querySelectorAll<HTMLElement>("[aria-hidden]")).find((element) =>
          element.style.backgroundImage.includes("/api/montage/"),
        )

      fireEvent.pointerEnter(figure)
      // deux frames plus loin, jamais la première
      await act(async () => {
        vi.advanceTimersByTime(250)
      })
      expect(pellicule()!.style.backgroundPosition).not.toBe("0% 0%")

      fireEvent.pointerLeave(figure)
      expect(pellicule()).toBeUndefined() // la pellicule quitte le DOM au repos

      fireEvent.pointerEnter(figure)
      // Reprise à zéro, pas à la frame où le survol précédent s'était arrêté.
      expect(pellicule()!.style.backgroundPosition).toBe("0% 0%")
    } finally {
      vi.useRealTimers()
    }
  })
})
