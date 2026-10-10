// La fiche d'une image **seule ou pavée 3 × 3** (10 octobre 2026) — une tuile se
// juge répétée. Payé sur Cœur de Pierre : un mur trop sombre et trois gravats
// sur quatre ne se voyaient pas sur une case seule, et c'est une planche faite
// à la main, hors de l'atelier, qui les a montrés.
//
// Monté seul, sans `App` — comme `Fiche.tn3.test.tsx`. Ce que le serveur dit de
// la nature (`bord_a_bord`) est vérifié par `tests/test_bord_a_bord.py`.

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, test, vi } from "vitest"

import { api, UNIVERS_VIDE, type Asset, type Impose } from "../api"
import { Fiche } from "./Fiche"

const UN_ASSET: Asset = {
  identifiant: "bbbb2222-0",
  generation: "bbbb2222",
  rang: 0,
  largeur: 512,
  hauteur: 512,
  type_media: "image/png",
  label: "une paroi de cristal",
  recette: {
    passes: [],
    difference: null,
    recadrage: null,
    grille: null,
    quantification: null,
    bords: null,
    contours: null,
    retournement: null,
    main: null,
    veille: [],
    nom: null,
  } as unknown as Asset["recette"],
  rendu_largeur: 0,
  rendu_hauteur: 0,
  cree_le: 1_791_600_000,
  cout_usd: 0,
  consomme: 0,
  unite: "seconde",
  provenance: "auteur",
  modele: "ComfyUI:klein9b-tiles@v1",
  personnage: null,
  pose: null,
  direction: null,
  piece: null,
  calque: null,
  lot: null,
  personnage_supprime: false,
  epingle: false,
  matiere: false,
  projet: "bac-a-sable",
  collection: null,
  parent: null,
  parent_supprime: false,
  favori: false,
  supprime_le: null,
  traite: false,
  empreinte: "def456",
}

const UN_PERSONNAGE: Asset = {
  ...UN_ASSET,
  identifiant: "cccc3333-0",
  generation: "cccc3333",
  label: "un nain",
}

const impose = (bordABord: boolean): Impose => ({
  impose: null,
  echelle: bordABord ? "tuile" : "personnage",
  nature: "image",
  detourage: null,
  bord_a_bord: bordABord,
})

const fiche = (asset: Asset) => (
  <Fiche
    asset={asset}
    univers={UNIVERS_VIDE}
    plan={[]}
    personnages={[]}
    onFermer={() => {}}
    onErreur={() => {}}
    onReinjecter={() => {}}
    onReglages={() => {}}
    onSupprimer={() => {}}
    onRetoucher={() => {}}
    onOuvrir={() => {}}
  />
)

const pavage = () => document.querySelector("[data-pavage]")

describe("la fiche — seule ou pavée 3 × 3", () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  test("une tuile s'ouvre pavée : neuf fois la même image, bord contre bord", async () => {
    vi.spyOn(api, "generation").mockRejectedValue(new Error("essai : aucun serveur"))
    vi.spyOn(api, "imposeSurAsset").mockResolvedValue(impose(true))
    render(fiche(UN_ASSET))

    await waitFor(() => expect(pavage()).not.toBeNull())
    const images = pavage()!.querySelectorAll("img")
    expect(images).toHaveLength(9)
    expect(new Set([...images].map((i) => i.getAttribute("src"))).size).toBe(1)

    fireEvent.click(screen.getByText("seule"))
    expect(pavage()).toBeNull()
  })

  test("un personnage s'ouvre seul, et se pave d'un clic", async () => {
    vi.spyOn(api, "generation").mockRejectedValue(new Error("essai : aucun serveur"))
    const lire = vi.spyOn(api, "imposeSurAsset").mockResolvedValue(impose(false))
    render(fiche(UN_PERSONNAGE))

    await waitFor(() => expect(lire).toHaveBeenCalled())
    expect(pavage()).toBeNull()

    fireEvent.click(screen.getByText("pavée 3×3"))
    expect(pavage()!.querySelectorAll("img")).toHaveLength(9)
  })

  test("le choix de l'auteur ne suit pas l'image suivante : elle rouvre selon sa nature", async () => {
    vi.spyOn(api, "generation").mockRejectedValue(new Error("essai : aucun serveur"))
    vi.spyOn(api, "imposeSurAsset").mockImplementation(async (id: string) =>
      impose(id === UN_ASSET.identifiant),
    )
    const { rerender } = render(fiche(UN_PERSONNAGE))
    fireEvent.click(screen.getByText("pavée 3×3"))
    expect(pavage()).not.toBeNull()

    rerender(fiche(UN_ASSET))
    await waitFor(() => expect(pavage()).not.toBeNull())
    rerender(fiche(UN_PERSONNAGE))
    await waitFor(() => expect(pavage()).toBeNull())
  })
})
