// P1c (V3.5) — le retour en arrière du dépliage, sur l'écran.
//
// Trois choses à prouver : **la liste des découpages d'une planche**, avec la
// suppression de l'un d'eux ; **le bouton absent et la raison affichée** quand
// la planche ne peut plus se redécouper ; et **le rappel d'une ligne** sur une
// image sortie d'un découpage, qui mène à sa planche. Refaire le découpage
// lui-même — la proposition préremplie, valider qui envoie les coupes — est
// prouvé dans `Decoupe.test.tsx`, qui porte l'éditeur de rectangles réutilisé
// ici par sa troisième famille.

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, expect, test, vi } from "vitest"
import { api, RECETTE_VIDE, type Asset, type Depliages } from "../api"
import { toutReplier } from "./pieces"
import { LesDecoupagesDeLaPlanche } from "./Depliages"

afterEach(() => {
  cleanup()
  toutReplier()
  vi.restoreAllMocks()
})

const planche = (partiel: Partial<Asset> = {}) =>
  ({
    identifiant: "planche-1",
    label: "planche",
    empreinte: "e",
    largeur: 100,
    hauteur: 50,
    recette: RECETTE_VIDE,
    ...partiel,
  } as Asset)

const ETAT: Depliages = {
  planche: "planche-1",
  generation: "g1",
  largeur: 100,
  hauteur: 50,
  refaisable: true,
  raison: null,
  dependants: { depliees: 8, derivees: 0, total: 8 },
  depliages: [
    {
      numero: 1,
      identifiant: "planche-1-d1",
      planche: "planche-1",
      origine: "auto",
      coupes: [],
      rangs: [1, 2, 3, 4, 5, 6, 7, 8],
      cree_le: 0,
      images: new Array(8).fill(0).map((_, i) => ({ identifiant: `img${i}` }) as Asset),
      supprimees: 0,
      supprime: false,
    },
    {
      numero: 2,
      identifiant: "planche-1-d2",
      planche: "planche-1",
      origine: "main",
      coupes: [],
      rangs: [9, 10, 11, 12, 13, 14, 15],
      cree_le: 1,
      images: new Array(7).fill(0).map((_, i) => ({ identifiant: `img2-${i}` }) as Asset),
      supprimees: 0,
      supprime: false,
    },
  ],
}

test("la fiche d'une planche liste ses découpages, et en supprimer un appelle la route", async () => {
  vi.spyOn(api, "depliagesDe").mockResolvedValue(ETAT)
  const supprimer = vi.spyOn(api, "depliageSupprimer").mockResolvedValue({
    supprimes: ["img2-0"], annulation_s: 8, expire_le: 1, depliage: ETAT.depliages[1],
  })

  render(
    <LesDecoupagesDeLaPlanche
      asset={planche()}
      onErreur={vi.fn()}
      onOuvrir={vi.fn()}
      onChangee={vi.fn()}
    />,
  )

  fireEvent.click(await screen.findByRole("button", { name: /Ses découpages/ }))
  expect(await screen.findByText("Découpage n°1 · auto · 8 images")).toBeInTheDocument()
  expect(screen.getByText("Découpage n°2 · à la main · 7 images")).toBeInTheDocument()
  expect(screen.getByRole("button", { name: "Refaire le découpage" })).toBeInTheDocument()

  const boutons = screen.getAllByRole("button", { name: "supprimer ce découpage" })
  fireEvent.click(boutons[1])
  await waitFor(() => expect(supprimer).toHaveBeenCalledWith("planche-1", 2))
})

test("bouton absent et raison affichée quand la planche ne peut plus se redécouper", async () => {
  vi.spyOn(api, "depliagesDe").mockResolvedValue({
    ...ETAT,
    refaisable: false,
    raison: "une planche d'équipement se recale, elle ne se redécoupe pas",
  })

  render(
    <LesDecoupagesDeLaPlanche
      asset={planche()}
      onErreur={vi.fn()}
      onOuvrir={vi.fn()}
      onChangee={vi.fn()}
    />,
  )

  fireEvent.click(await screen.findByRole("button", { name: /Ses découpages/ }))
  expect(screen.queryByRole("button", { name: "Refaire le découpage" })).toBeNull()
  expect(
    await screen.findByText("une planche d'équipement se recale, elle ne se redécoupe pas"),
  ).toBeInTheDocument()
})

test("une image sortie d'un découpage dit sa planche et son numéro, et y mène", async () => {
  const onOuvrir = vi.fn()
  render(
    <LesDecoupagesDeLaPlanche
      asset={planche({
        identifiant: "planche-1-8",
        planche: "planche-1",
        depliage: "planche-1-d2",
      })}
      onErreur={vi.fn()}
      onOuvrir={onOuvrir}
      onChangee={vi.fn()}
    />,
  )

  fireEvent.click(await screen.findByRole("button", { name: /Sa planche/ }))
  expect(await screen.findByText(/découpage n°2/)).toBeInTheDocument()
  fireEvent.click(screen.getByRole("button", { name: "planche-1" }))
  expect(onOuvrir).toHaveBeenCalledWith("planche-1")
})
