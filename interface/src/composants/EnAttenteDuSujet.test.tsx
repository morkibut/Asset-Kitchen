// Le bandeau « Pas encore rangé » (RV12), et ses deux gestes de fin (RV22) :
// « Écarter » — l'image quitte le sujet et retourne à la Galerie, intacte —
// et « Supprimer » — le geste de jugement de la Galerie, à l'identique,
// avec sa même annulation. `api` est doublé méthode par méthode, jamais
// `fetch` : aucun essai ne coûte un centime.

import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { afterEach, expect, test, vi } from "vitest"

import { EnAttenteDuSujet } from "./EnAttenteDuSujet"
import {
  api,
  PlancheAConfirmer,
  RECETTE_VIDE,
  type Asset,
  type Bande,
  type Generation,
  type Personnage,
  type Pose,
} from "../api"

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

function image(surplus: Partial<Asset> & { identifiant: string }): Asset {
  return {
    generation: "gen-1",
    rang: 0,
    largeur: 64,
    hauteur: 64,
    type_media: "image/png",
    label: `image ${surplus.identifiant}`,
    recette: RECETTE_VIDE,
    rendu_largeur: 64,
    rendu_hauteur: 64,
    cree_le: 200,
    cout_usd: 0,
    consomme: 0,
    unite: "usd",
    provenance: "auteur",
    modele: "gpt-image-2",
    personnage: "le-pelerin",
    pose: null,
    direction: null,
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

const PLAN: Pose[] = [
  { identifiant: "repos", nom: "repos", images: 1, consigne: "", ecartees: [], images_avant: 0 },
]

function sujet(surplus: Partial<Personnage> = {}): Personnage {
  return {
    identifiant: "le-pelerin",
    projet: "le-marais",
    nom: "Le pèlerin",
    pieces: [],
    description: "",
    ecartees: [],
    concept_arts: [],
    references_ecartees: [],
    cree_le: 1_700_000_000,
    cases: [],
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

const VIDE: { personnage: string; images: Asset[]; clips: Generation[]; animations: Bande[] } = {
  personnage: "le-pelerin",
  images: [],
  clips: [],
  animations: [],
}

function monter(surplus: Partial<Personnage> = {}) {
  const onChange = vi.fn()
  const onErreur = vi.fn()
  render(
    <EnAttenteDuSujet
      personnage={sujet(surplus)}
      plan={PLAN}
      onOuvrir={vi.fn()}
      onChange={onChange}
      onErreur={onErreur}
    />,
  )
  return { onChange, onErreur }
}

const ouvrirLeBandeau = async () =>
  fireEvent.click(await screen.findByRole("button", { name: /Pas encore rangé/ }))

test("chaque image du bandeau porte Écarter et Supprimer, à côté de Ranger dans…", async () => {
  vi.spyOn(api, "enAttenteDuSujet").mockResolvedValue({ ...VIDE, images: [image({ identifiant: "a1" })] })
  monter()
  await ouvrirLeBandeau()
  const carte = screen.getByText("image a1").closest("article") as HTMLElement
  expect(within(carte).getByRole("combobox")).toBeTruthy()
  expect(within(carte).getByRole("button", { name: "Écarter" })).toBeEnabled()
  expect(within(carte).getByRole("button", { name: "Supprimer" })).toBeEnabled()
})

test("Écarter détache l'image du sujet (personnage: null) et la fait disparaître du bandeau", async () => {
  vi.spyOn(api, "enAttenteDuSujet")
    .mockResolvedValueOnce({ ...VIDE, images: [image({ identifiant: "a1" })] })
    .mockResolvedValueOnce(VIDE)
  const designer = vi.spyOn(api, "designer").mockResolvedValue(image({ identifiant: "a1", personnage: null }))
  const { onChange } = monter()
  await ouvrirLeBandeau()
  fireEvent.click(screen.getByRole("button", { name: "Écarter" }))
  expect(designer).toHaveBeenCalledWith("a1", null, null, null)
  await waitFor(() => expect(onChange).toHaveBeenCalled())
  // Rien à ranger, aucune suppression en cours : le bandeau s'efface entier.
  await waitFor(() => expect(document.querySelector("[data-bandeau-pas-encore-range]")).toBeNull())
})

test("Supprimer rejoue le geste de jugement de la Galerie, avec sa même annulation", async () => {
  vi.spyOn(api, "enAttenteDuSujet")
    .mockResolvedValueOnce({ ...VIDE, images: [image({ identifiant: "a1" })] })
    .mockResolvedValueOnce(VIDE)
  const supprimer = vi.spyOn(api, "supprimerAssetsConfirmable").mockResolvedValue({
    supprimes: ["a1"],
    annulation_s: 8,
    expire_le: Date.now() / 1000 + 8,
  })
  const { onChange } = monter()
  await ouvrirLeBandeau()
  fireEvent.click(screen.getByRole("button", { name: "Supprimer" }))
  expect(supprimer).toHaveBeenCalledWith(["a1"])
  // Le bandeau se vide (l'image est partie) mais reste monté : l'annulation
  // y vit encore, un instant.
  expect(await screen.findByText("Plus rien à ranger pour Le pèlerin.")).toBeTruthy()
  expect(screen.getByText(/1 supprimé/)).toBeTruthy()
  await waitFor(() => expect(onChange).toHaveBeenCalled())
})

test("Annuler la suppression restaure l'image, comme dans la Galerie", async () => {
  vi.spyOn(api, "enAttenteDuSujet")
    .mockResolvedValueOnce({ ...VIDE, images: [image({ identifiant: "a1" })] })
    .mockResolvedValueOnce(VIDE)
    .mockResolvedValueOnce({ ...VIDE, images: [image({ identifiant: "a1" })] })
  vi.spyOn(api, "supprimerAssetsConfirmable").mockResolvedValue({
    supprimes: ["a1"],
    annulation_s: 8,
    expire_le: Date.now() / 1000 + 8,
  })
  const restaurer = vi.spyOn(api, "restaurer").mockResolvedValue({ assets: [image({ identifiant: "a1" })] })
  monter()
  await ouvrirLeBandeau()
  fireEvent.click(screen.getByRole("button", { name: "Supprimer" }))
  const annuler = await screen.findByRole("button", { name: "Annuler ›" })
  fireEvent.click(annuler)
  expect(restaurer).toHaveBeenCalledWith(["a1"])
  // L'annulation a fait son geste : elle disparaît, et l'image revient.
  await waitFor(() => expect(screen.queryByText(/1 supprimé/)).toBeNull())
  expect(await screen.findByText("image a1")).toBeTruthy()
})

test("une planche partagée refuse la suppression ici et renvoie vers la Galerie", async () => {
  vi.spyOn(api, "enAttenteDuSujet").mockResolvedValue({ ...VIDE, images: [image({ identifiant: "a1" })] })
  vi.spyOn(api, "supprimerAssetsConfirmable").mockRejectedValue(
    new PlancheAConfirmer("planche partagée", "planche_a_confirmer", null, "p1", { depliees: 2, derivees: 0, total: 2 }),
  )
  const { onErreur } = monter()
  await ouvrirLeBandeau()
  fireEvent.click(screen.getByRole("button", { name: "Supprimer" }))
  await waitFor(() =>
    expect(onErreur).toHaveBeenCalledWith(
      expect.any(PlancheAConfirmer),
      expect.stringContaining("Galerie"),
    ),
  )
})
