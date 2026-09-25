// La fiche d'une image **née transparente dont une partie du sujet est sortie
// transparente** (TN4, `docs/PLAN-transparence-native.md`) : elle le dit, et
// propose « Refaire sur fond coloré ».
//
// Monté seul, sans `App` — comme `Fiche.tn3.test.tsx`. La mesure elle-même
// (le vide enfermé derrière un trait mince) est éprouvée côté serveur par
// `tests/test_tn4_trou_dans_le_sujet.py` ; ce que le geste arme ensuite, par
// `src/tn4-fond-colore.test.tsx`.

import { cleanup, fireEvent, render, screen } from "@testing-library/react"
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

const LE_MAGE: Asset = {
  identifiant: "bbbb2222-0",
  generation: "bbbb2222",
  rang: 0,
  largeur: 1024,
  hauteur: 1024,
  type_media: "image/png",
  label: "un mage champignon",
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
  empreinte: "def456",
}

const impose = (troue: boolean): Impose => ({
  impose: NEE_TRANSPARENTE,
  echelle: "",
  nature: "image",
  detourage: { passe: PASSE_PAR_DEFAUT, origine: "produit", famille: "" },
  detouree_par_le_modele: true,
  sujet_troue: troue,
})

const fiche = (onRefaire?: () => void) => (
  <Fiche
    asset={LE_MAGE}
    univers={UNIVERS_VIDE}
    plan={[]}
    personnages={[]}
    onFermer={() => {}}
    onErreur={() => {}}
    onReinjecter={() => {}}
    onReglages={() => {}}
    onRefaireSurFondColore={onRefaire}
    onSupprimer={() => {}}
    onRetoucher={() => {}}
    onOuvrir={() => {}}
  />
)

describe("la fiche — une partie du sujet est sortie transparente (TN4)", () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  test("elle le dit, et « Refaire sur fond coloré » arme le geste sans rien payer", async () => {
    vi.spyOn(api, "generation").mockRejectedValue(new Error("essai : aucun serveur"))
    vi.spyOn(api, "imposeSurAsset").mockResolvedValue(impose(true))
    const payer = vi.spyOn(api, "generer")
    const refaire = vi.fn()
    render(fiche(refaire))

    expect(
      await screen.findByText("Une partie du sujet est sortie transparente"),
    ).toBeInTheDocument()
    // La découpe endormie est toujours là, à côté : les deux se lisent ensemble.
    expect(screen.getByText("Détourée par le modèle")).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Refaire sur fond coloré" }))
    expect(refaire).toHaveBeenCalledTimes(1)
    // **T1 et l'argent** : rien ne part de la fiche — c'est la barre qui paie.
    expect(payer).not.toHaveBeenCalled()
  })

  test("sans trou, la fiche ne dit rien", async () => {
    vi.spyOn(api, "generation").mockRejectedValue(new Error("essai : aucun serveur"))
    vi.spyOn(api, "imposeSurAsset").mockResolvedValue(impose(false))
    render(fiche(() => {}))

    expect(await screen.findByText("Détourée par le modèle")).toBeInTheDocument()
    expect(screen.queryByText("Une partie du sujet est sortie transparente")).toBeNull()
    expect(screen.queryByRole("button", { name: "Refaire sur fond coloré" })).toBeNull()
  })

  test("sans le geste, le trou se dit quand même", async () => {
    vi.spyOn(api, "generation").mockRejectedValue(new Error("essai : aucun serveur"))
    vi.spyOn(api, "imposeSurAsset").mockResolvedValue(impose(true))
    render(fiche(undefined))

    expect(
      await screen.findByText("Une partie du sujet est sortie transparente"),
    ).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Refaire sur fond coloré" })).toBeNull()
  })
})
