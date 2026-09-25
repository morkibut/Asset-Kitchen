// La fiche d'une image **née transparente** (TN3,
// `docs/PLAN-transparence-native.md`) : elle dit « détourée par le modèle », la
// découpe du contour est en sommeil, et l'interrupteur des tables de la retouche
// la réveille.
//
// Monté seul, sans `App` — comme `Fiche.test.tsx` : ce que la naissance pose
// (la veille, le fond du modèle) est vérifié côté serveur par
// `tests/test_tn3_detourage_endormi.py`.

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, test, vi } from "vitest"

import { api, PASSE_PAR_DEFAUT, UNIVERS_VIDE, type Asset, type Impose, type Recette } from "../api"
import { Fiche } from "./Fiche"

const NEE_TRANSPARENTE: Recette = {
  passes: [PASSE_PAR_DEFAUT],
  difference: null,
  recadrage: { marge: 0, boite: null } as unknown as Recette["recadrage"],
  grille: null,
  quantification: null,
  bords: null,
  contours: null,
  retournement: null,
  main: null,
  veille: ["detourage"],
  nom: null,
  fond_du_modele: true,
}

const UN_ASSET: Asset = {
  identifiant: "aaaa1111-0",
  generation: "aaaa1111",
  rang: 0,
  largeur: 1024,
  hauteur: 1024,
  type_media: "image/png",
  label: "un chevalier",
  recette: NEE_TRANSPARENTE,
  rendu_largeur: 0,
  rendu_hauteur: 0,
  cree_le: 1_787_800_100,
  cout_usd: 0,
  consomme: 0,
  unite: "jeton",
  provenance: "auteur",
  modele: "ComfyUI:qwen-image-21@v1",
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
  traite: true,
  empreinte: "abc123",
}

const impose = (detouree: boolean, recette: Recette = NEE_TRANSPARENTE): Impose => ({
  impose: recette,
  echelle: "",
  nature: "image",
  detourage: { passe: PASSE_PAR_DEFAUT, origine: "produit", famille: "" },
  detouree_par_le_modele: detouree,
})

const fiche = (asset: Asset, onErreur: (r: string) => void = () => {}) => (
  <Fiche
    asset={asset}
    univers={UNIVERS_VIDE}
    plan={[]}
    personnages={[]}
    onFermer={() => {}}
    onErreur={onErreur}
    onReinjecter={() => {}}
    onReglages={() => {}}
    onSupprimer={() => {}}
    onRetoucher={() => {}}
    onOuvrir={() => {}}
  />
)

describe("la fiche — une image détourée par le modèle (TN3)", () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  test("elle le dit, la découpe est en sommeil, et un clic la réveille", async () => {
    vi.spyOn(api, "generation").mockRejectedValue(new Error("essai : aucun serveur"))
    vi.spyOn(api, "imposeSurAsset").mockResolvedValue(impose(true))
    const poser = vi.spyOn(api, "poserRecette").mockResolvedValue(UN_ASSET)
    render(fiche(UN_ASSET))

    expect(await screen.findByText("Détourée par le modèle")).toBeInTheDocument()
    expect(screen.getByText("découpe en sommeil")).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "La réveiller" }))

    await waitFor(() => expect(poser).toHaveBeenCalledTimes(1))
    const [identifiant, recette] = poser.mock.calls[0]
    expect(identifiant).toBe("aaaa1111-0")
    // La place se rallume sans se vider : la passe est toujours là.
    expect(recette.veille).toEqual([])
    expect(recette.passes).toEqual([PASSE_PAR_DEFAUT])
  })

  test("la ligne du bloc dit pourquoi la découpe dort, sans la dire réglée à la main", async () => {
    vi.spyOn(api, "generation").mockRejectedValue(new Error("essai : aucun serveur"))
    vi.spyOn(api, "imposeSurAsset").mockResolvedValue(impose(true))
    render(fiche(UN_ASSET))

    fireEvent.click(await screen.findByRole("button", { name: /Ce que le jeu lui a fait/ }))

    expect(await screen.findByText("en sommeil — détourée par le modèle")).toBeInTheDocument()
    expect(screen.queryByText("réglé à la main")).toBeNull()
  })

  test("réveillée par l'auteur, elle se dit réveillée et l'interrupteur la rendort", async () => {
    vi.spyOn(api, "generation").mockRejectedValue(new Error("essai : aucun serveur"))
    vi.spyOn(api, "imposeSurAsset").mockResolvedValue(impose(true))
    const reveillee = { ...UN_ASSET, recette: { ...NEE_TRANSPARENTE, veille: [] } }
    render(fiche(reveillee))

    expect(await screen.findByText("découpe réveillée")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "L'endormir" })).toBeInTheDocument()
  })

  test("une image que le modèle n'a pas détourée n'a ni la phrase ni l'interrupteur", async () => {
    vi.spyOn(api, "generation").mockRejectedValue(new Error("essai : aucun serveur"))
    const lu = vi.spyOn(api, "imposeSurAsset").mockResolvedValue(
      impose(false, { ...NEE_TRANSPARENTE, veille: [], fond_du_modele: undefined }),
    )
    render(fiche({ ...UN_ASSET, recette: { ...NEE_TRANSPARENTE, veille: [], fond_du_modele: undefined } }))

    await waitFor(() => expect(lu).toHaveBeenCalled())
    await new Promise((r) => setTimeout(r, 0))
    expect(screen.queryByText("Détourée par le modèle")).toBeNull()
    expect(screen.queryByRole("button", { name: "La réveiller" })).toBeNull()
  })

  test("un refus du serveur se lit avec sa phrase", async () => {
    vi.spyOn(api, "generation").mockRejectedValue(new Error("essai : aucun serveur"))
    vi.spyOn(api, "imposeSurAsset").mockResolvedValue(impose(true))
    vi.spyOn(api, "poserRecette").mockRejectedValue(new Error("l'atelier ne répond pas"))
    const onErreur = vi.fn()
    render(fiche(UN_ASSET, onErreur))

    fireEvent.click(await screen.findByRole("button", { name: "La réveiller" }))

    await waitFor(() => expect(onErreur).toHaveBeenCalledWith("l'atelier ne répond pas"))
  })
})
