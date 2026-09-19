// Commander une planche de plusieurs objets (P2, V3.5).
//
// Deux choses à prouver : le choix de plusieurs objets part en `sujets`, et le
// prix par objet s'affiche à côté du prix de la planche — avant tout envoi.

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, expect, test, vi } from "vitest"
import { api, type Envoi, type GrilleDeFamille, type Modele } from "../api"
import { PlancheDePlusieursObjets } from "./PlancheDePlusieursObjets"

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

const MODELE: Modele = {
  identifiant: "m1",
  nom: "Modèle d'essai",
  fournisseur: "Essai",
  chez_lui: "m1",
  references_max: 3,
  proportions: ["1:1"],
  resolutions: [],
  variations_max: 1,
  options: {},
  refus: null,
  repli: false,
  recu_le: 0,
  unite: "usd",
}

const grille = (noms: string[]): GrilleDeFamille => ({
  personnages: noms.map((nom, i) => ({
    identifiant: `obj-${i}`,
    projet: "jeu-1",
    nom,
    description: "",
    type: "",
    cree_le: 0,
    compte: {} as never,
    collections: [],
    vignette: null,
  })),
  groupes: [],
  filtres: { tous: noms.length, incomplets: 0, "sans-description": 0 },
  total: noms.length,
})

const ENVOI: Envoi = {
  texte: "",
  parties: [],
  lignes: [],
  groupes: [],
  images: {
    lignes: [], places: 0, cochees: 0, rang_gabarit: null, rang_palette: null,
    jointe: null, partent: 0, gabarit: 0, palette: 0, prix: null, avertissements: [],
  },
  options: [],
  retour: [],
  avertissements: [],
  prix: {
    total: 0.02,
    appels: 1,
    images: null,
    mesure: { unite: "usd", prix: 0.02, bas: 0.02, haut: 0.02, appels: 1, base: null, par_image: null, sur_base: 0, sur_jointes: 0 },
    sujets: 4,
    par_sujet: 0.005,
  },
  reserve: null,
  modele: { identifiant: "m1", nom: "Modèle d'essai", references_max: 3 },
  ambiance: null,
} as unknown as Envoi

test("choisir plusieurs objets part en `sujets`, et le prix par objet s'affiche", async () => {
  vi.spyOn(api, "familleDeSujets").mockResolvedValue(grille(["Potion bleue", "Clé dorée"]))
  const envoyer = vi.spyOn(api, "envoi").mockResolvedValue(ENVOI)
  const generer = vi.spyOn(api, "generer").mockResolvedValue({ identifiant: "g1" } as never)
  const onLancee = vi.fn()

  render(
    <PlancheDePlusieursObjets
      projet="jeu-1"
      modeles={[MODELE]}
      onFermer={vi.fn()}
      onLancee={onLancee}
    />,
  )

  const boutons = await screen.findAllByRole("button", { name: "ajouter ›" })
  fireEvent.click(boutons[0])
  fireEvent.click(boutons[1])

  await waitFor(() =>
    expect(envoyer).toHaveBeenCalledWith(
      expect.objectContaining({ sujets: ["obj-0", "obj-1"] }),
    ),
  )

  expect(await screen.findByText(/soit \$0,0050 par objet/)).toBeInTheDocument()
  expect(generer).not.toHaveBeenCalled()

  fireEvent.click(screen.getByRole("button", { name: /Payer et lancer/ }))
  await waitFor(() =>
    expect(generer).toHaveBeenCalledWith(
      expect.objectContaining({ sujets: ["obj-0", "obj-1"], modele: "m1", prompt: expect.stringMatching(/\S/) }),
    ),
  )
  expect(onLancee).toHaveBeenCalledWith("g1")
})

test("la commande part sur le défaut du jeu pour une planche, avec ses réglages", async () => {
  // Banc payé du 19 septembre 2026 : l'écran prenait le premier modèle de la
  // liste et partait sans réglage — sans « qualité basse », donc à la qualité
  // que le fournisseur choisit.
  const autre = { ...MODELE, identifiant: "m0", nom: "Premier de la liste" }
  const catalogue = vi
    .spyOn(api, "modeles")
    .mockResolvedValue({ defaut: { modele: "m1", options: { quality: "low" } } } as never)
  vi.spyOn(api, "familleDeSujets").mockResolvedValue(grille(["Potion bleue", "Clé dorée"]))
  vi.spyOn(api, "envoi").mockResolvedValue(ENVOI)
  const generer = vi.spyOn(api, "generer").mockResolvedValue({ identifiant: "g1" } as never)

  render(
    <PlancheDePlusieursObjets projet="jeu-1" modeles={[autre, MODELE]} onFermer={vi.fn()} onLancee={vi.fn()} />,
  )

  // Une planche : le serveur répond avec le modèle de planche du jeu.
  await waitFor(() => expect(catalogue).toHaveBeenCalledWith("1:1", 0, "", "", 2))
  await waitFor(() => expect(screen.getByRole("combobox")).toHaveValue("m1"))
  const boutons = await screen.findAllByRole("button", { name: "ajouter ›" })
  fireEvent.click(boutons[0])
  fireEvent.click(boutons[1])
  await screen.findByText(/par objet/)
  fireEvent.click(screen.getByRole("button", { name: /Payer et lancer/ }))

  await waitFor(() =>
    expect(generer).toHaveBeenCalledWith(
      expect.objectContaining({ modele: "m1", options: { quality: "low" } }),
    ),
  )
})
