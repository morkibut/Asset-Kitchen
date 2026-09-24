// La phrase sous « Découper à l'arrivée » (RS9, 18 septembre 2026).
//
// **Elle annonce ce que RS7/RS8 vont faire, avant qu'on coche.** Trois formes
// dégradées : l'ordre des vues connu (compte et directions), pas d'ordre du
// tout (« ses vues », sans direction, et pourquoi), et la recette du sujet qui
// s'ajoute ou s'efface selon qu'il en porte une.

import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, expect, test, vi } from "vitest"
import { api, UNIVERS_VIDE, type Modele, type Personnage, type ReferencesDeLaChose } from "../api"
import { BarreQuiPaie } from "./BarreQuiPaie"

// CM7 : le champ de prompt porte désormais le coup de main, qui interroge
// `/api/assist` au montage — doublé, indisponible, pour rester sans réseau.
beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ disponible: false, raison: null, modele: "" }))))
})
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

const modele: Modele = {
  identifiant: "OpenRouter:openai/gpt-image-2", nom: "GPT Image", fournisseur: "OpenRouter", chez_lui: "gpt-image-2",
  references_max: 4, proportions: ["1:1"], resolutions: [], variations_max: 4, options: {},
  refus: null, repli: false, recu_le: 0, unite: "usd",
}

const CHAMPY = {
  identifiant: "champy",
  nom: "Champy",
  projet: "bac-a-sable",
  description: "",
  ecartees: [],
  cases: [],
  plan: [],
  type: "",
  ambiance: "",
  recette: "champy 01",
} as unknown as Personnage

function props(personnageCible: Personnage | null) {
  return {
    presentation: "preparation" as const,
    modeles: [modele],
    modele,
    onChoisirModele: vi.fn(),
    proportions: "1:1", onProportions: vi.fn(), variations: 1, onVariations: vi.fn(),
    options: {}, onOptions: vi.fn(),
    reinjections: [], grille: [], onRetirerReinjection: vi.fn(), onRoleReinjection: vi.fn(),
    projetNom: "jeu", univers: UNIVERS_VIDE, echelle: "", onEchelle: vi.fn(),
    compteReferences: null, cout: null, reserve: null, cases: 0,
    personnageCible, posesCible: [], onRetirerPose: vi.fn(), onDesarmer: vi.fn(),
    ecarteesGeneration: null, onEcarterGeneration: vi.fn(), onErreur: vi.fn(),
    prompt: "", onPrompt: vi.fn(), promptNegatif: "", onPromptNegatif: vi.fn(),
    repris: false, onRendre: vi.fn(), refus: null, provenance: null,
    onDefaireProvenance: vi.fn(), onGenerer: vi.fn(),
    garderMiseEnPage: true,
    onGarderMiseEnPage: vi.fn(),
    decouperALArrivee: true,
    onDecouperALArrivee: vi.fn(),
  }
}

function references(ordre_des_vues?: string[]): ReferencesDeLaChose {
  return {
    personnage: "champy",
    lignes: [
      {
        reference: "aaaa1111-0",
        genre: "asset",
        provenance: "image promue",
        detail: "",
        ecartee: false,
        montre: null,
        usage: "planche",
        usage_nom: "planche",
        ordre_des_vues,
      },
    ],
    propositions: [],
    disponibles: 0,
  }
}

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

test("ordre des vues réglé : le compte, les directions, et la recette du sujet", async () => {
  vi.spyOn(api, "referencesDeLaChose").mockResolvedValue(references(["sud", "est", "nord", "ouest"]))

  render(<BarreQuiPaie {...props(CHAMPY)} />)

  expect(
    await screen.findByText(
      "Elle sera coupée en 4, chaque image rangée dans sa direction, avec la recette champy 01.",
    ),
  ).toBeInTheDocument()
})

test("aucun ordre réglé : « ses vues », sans direction, et pourquoi", async () => {
  vi.spyOn(api, "referencesDeLaChose").mockResolvedValue(references(undefined))

  render(<BarreQuiPaie {...props(CHAMPY)} />)

  expect(
    await screen.findByText(
      "Elle sera coupée en ses vues, sans direction (ordre des vues non réglé sur la fiche du sujet), avec la recette champy 01.",
    ),
  ).toBeInTheDocument()
})

test("sujet sans recette : la troisième clause disparaît", async () => {
  vi.spyOn(api, "referencesDeLaChose").mockResolvedValue(references(["sud", "nord"]))
  const sansRecette = { ...CHAMPY, recette: undefined } as unknown as Personnage

  render(<BarreQuiPaie {...props(sansRecette)} />)

  expect(
    await screen.findByText("Elle sera coupée en 2, chaque image rangée dans sa direction."),
  ).toBeInTheDocument()
})

test("décochée, la phrase ne paraît pas", async () => {
  vi.spyOn(api, "referencesDeLaChose").mockResolvedValue(references(["sud", "nord"]))

  render(<BarreQuiPaie {...props(CHAMPY)} decouperALArrivee={false} />)

  await new Promise((r) => setTimeout(r, 0))
  expect(screen.queryByText(/Elle sera coupée/)).not.toBeInTheDocument()
})

test("aucun sujet visé : la phrase ne paraît pas, et rien n'est demandé au serveur", async () => {
  const espion = vi.spyOn(api, "referencesDeLaChose")

  render(<BarreQuiPaie {...props(null)} />)

  await new Promise((r) => setTimeout(r, 0))
  expect(screen.queryByText(/Elle sera coupée/)).not.toBeInTheDocument()
  expect(espion).not.toHaveBeenCalled()
})
