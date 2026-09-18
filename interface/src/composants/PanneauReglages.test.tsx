import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, expect, test, vi } from "vitest"
import { PanneauReglages } from "./PanneauReglages"
import { toutReplier } from "./pieces"
import { api, UNIVERS_VIDE, type Modele } from "../api"
import { stylesLocaux, type ProfilWorkflow, type StyleLocal } from "../api-workflows"

vi.mock("../api-workflows", async () => {
  const reel = await vi.importActual<typeof import("../api-workflows")>("../api-workflows")
  return { ...reel, stylesLocaux: { lister: vi.fn(), installer: vi.fn(), installerPrets: vi.fn() } }
})

afterEach(cleanup)

// Un style local « part de l'image » (Z-Image, FLUX.1-dev, SDXL) — l'option
// « force » n'existe que sur cette forme-là.
const modeleLocalDepart: Modele = {
  identifiant: "ComfyUI:zimage-pixel@v1", nom: "Pixel art net et rapide", fournisseur: "ComfyUI", chez_lui: "",
  references_max: 1, references_min: 0, locale: true, indisponible: null,
  proportions: ["1:1"], resolutions: ["512"], variations_max: 1,
  options: { force: { nom: "force", genre: "intervalle", valeurs: [], minimum: 0, maximum: 1 } },
  refus: null, repli: false, recu_le: 0, unite: "jeton",
  // `reference` n'est pas encore déclaré sur `Modele` (`api.ts`, occupé) —
  // voir `../api-workflows`, `ModeleAvecReference`.
  ...( { reference: "depart" } as Record<string, unknown> ),
} as Modele

const modeleDistant: Modele = {
  identifiant: "OpenRouter:openai/gpt-image-2", nom: "GPT Image", fournisseur: "OpenRouter", chez_lui: "gpt-image-2",
  references_max: 4, proportions: ["1:1"], resolutions: [], variations_max: 4, options: {},
  refus: null, repli: false, recu_le: 0, unite: "usd",
}

const stylePret: StyleLocal = { identifiant: "zimage-pixel", nom: "Pixel art net et rapide", famille: "zimage", genre: "sprite", vitesse: "environ 30 secondes par image", reference: "depart", pret: true, manque: [], modele: null }
const styleManquant: StyleLocal = { identifiant: "sdxl-toon", nom: "Toon SDXL", famille: "sdxl", genre: "sprite", vitesse: "environ 40 secondes par image", reference: "depart", pret: false, manque: ["le checkpoint SDXL de base"], modele: null }

const props = {
  modeles: [modeleDistant], choisi: modeleDistant, onChoisir: vi.fn(),
  proportions: "1:1", onProportions: vi.fn(), variations: 1, onVariations: vi.fn(),
  options: {}, onOptions: vi.fn(), references: 0, projet: "jeu", univers: UNIVERS_VIDE,
  echelle: "", onEchelle: vi.fn(), compte: null, cases: 0, cout: null, cible: null,
  ecarteesGeneration: null, onEcarterGeneration: vi.fn(), onErreur: vi.fn(),
}

beforeEach(() => {
  vi.clearAllMocks()
  toutReplier()
  vi.mocked(stylesLocaux.lister).mockResolvedValue({ styles: [stylePret, styleManquant] })
  vi.spyOn(api, "rafraichirCatalogue").mockResolvedValue({} as never)
})

test("les styles locaux sont groupés par moteur, repliés, avec leur état et leur temps", async () => {
  render(<PanneauReglages {...props} />)
  fireEvent.click(screen.getByRole("button", { name: /Modèle/ }))
  await screen.findByText("styles locaux (sc-clone)")
  const resume = screen.getByText("Z-Image Turbo", { exact: false, selector: "summary" })
  expect(resume.closest("details")).not.toHaveAttribute("open")
  fireEvent.click(resume)
  const ligne = (await screen.findByText("Pixel art net et rapide")).closest("li")!
  expect(ligne).toHaveTextContent("prêt")
  expect(ligne).toHaveTextContent("environ 30 secondes par image")
  expect(ligne).toHaveTextContent("installer")
})

test("un style prêt s’installe d’un clic et devient le modèle choisi", async () => {
  vi.mocked(stylesLocaux.installer).mockResolvedValue({ modele: "ComfyUI:zimage-pixel@v1" } as ProfilWorkflow)
  render(<PanneauReglages {...props} />)
  fireEvent.click(screen.getByRole("button", { name: /Modèle/ }))
  fireEvent.click(await screen.findByText("Z-Image Turbo", { exact: false, selector: "summary" }))
  fireEvent.click(await screen.findByText("installer"))
  await waitFor(() => expect(stylesLocaux.installer).toHaveBeenCalledWith("zimage-pixel"))
  expect(api.rafraichirCatalogue).toHaveBeenCalled()
  expect(props.onChoisir).toHaveBeenCalledWith("ComfyUI:zimage-pixel@v1")
})

test("un style manquant dit ce qu’il lui manque, sans bouton d’installation", async () => {
  render(<PanneauReglages {...props} />)
  fireEvent.click(screen.getByRole("button", { name: /Modèle/ }))
  fireEvent.click(await screen.findByText("SDXL", { exact: false, selector: "summary" }))
  const ligne = (await screen.findByText("Toon SDXL")).closest("li")!
  expect(ligne).toHaveTextContent("il manque le checkpoint SDXL de base")
  expect(ligne).not.toHaveTextContent("installer")
})

test("la force n’apparaît que pour un style « part de l’image » avec une image jointe", () => {
  const { rerender } = render(<PanneauReglages {...props} choisi={modeleLocalDepart} references={0} />)
  expect(screen.queryByText("force")).not.toBeInTheDocument()
  rerender(<PanneauReglages {...props} choisi={modeleLocalDepart} references={1} />)
  expect(screen.getByText("force")).toBeInTheDocument()
  rerender(<PanneauReglages {...props} choisi={modeleDistant} references={1} />)
  expect(screen.queryByText("force")).not.toBeInTheDocument()
})
