// MO2 · La page « Moteurs » — les moteurs d'image groupés sur cette machine
// ou en ligne, `fetch` doublé. Reprend les essais de `StylesDeScClone`
// (`WorkflowsLocaux.test.tsx`, avant que MO2 ne les fonde ici) : groupement
// par moteur, installer/réinstaller un style, et ce que MO2 ajoute — les
// cartes « En ligne » et le renvoi signalé depuis un outil.

import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { afterEach, beforeEach, expect, test, vi } from "vitest"
import type { Modele } from "../api"
import { stylesLocaux, type StyleLocal } from "../api-workflows"
import { api } from "../api"
import { PageDesMoteurs } from "./Moteurs"

vi.mock("../api-workflows", async () => {
  const reel = await vi.importActual<typeof import("../api-workflows")>("../api-workflows")
  return { ...reel, stylesLocaux: { lister: vi.fn(), installer: vi.fn(), installerPrets: vi.fn() } }
})

const stylePret: StyleLocal = { identifiant: "zimage-pixel", nom: "Pixel art net et rapide", famille: "zimage", genre: "sprite", vitesse: "environ 30 secondes par image", reference: "depart", pret: true, manque: [], modele: null, repeint: true }
const styleInstalle: StyleLocal = { identifiant: "klein-portrait", nom: "Portrait Klein", famille: "klein", genre: "sprite", vitesse: "1 à 3 minutes par image", reference: "sujet", pret: true, manque: [], modele: "ComfyUI:klein-portrait@v1", repeint: true }
const styleManquant: StyleLocal = { identifiant: "sdxl-toon", nom: "Toon SDXL", famille: "sdxl", genre: "sprite", vitesse: "environ 40 secondes par image", reference: "depart", pret: false, manque: ["le checkpoint SDXL de base"], modele: null, repeint: true }

const modeleEnLigne: Modele = {
  identifiant: "OpenRouter:openai/gpt-image-2", nom: "GPT Image", fournisseur: "OpenRouter", chez_lui: "gpt-image-2",
  references_max: 4, proportions: ["1:1"], resolutions: [], variations_max: 4, options: {},
  refus: null, repli: false, recu_le: 0, unite: "usd",
}
const modeleEnLigneIndisponible: Modele = {
  identifiant: "OpenRouter:openai/gpt-image-2.5-sunburst", nom: "GPT Image Sunburst", fournisseur: "OpenRouter", chez_lui: "gpt-image-2.5-sunburst",
  references_max: 4, proportions: ["1:1"], resolutions: [], variations_max: 4, options: {},
  refus: "aucune clé OpenRouter", repli: false, recu_le: 0, unite: "usd", masque: true,
}

function monter(modeles: Modele[] = [modeleEnLigne], signale: string | null = null) {
  const onSignale = vi.fn()
  render(<PageDesMoteurs modeles={modeles} signale={signale} onSignale={onSignale} />)
  return { onSignale }
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(stylesLocaux.lister).mockResolvedValue({ styles: [stylePret, styleInstalle, styleManquant] })
  vi.spyOn(api, "rafraichirCatalogue").mockResolvedValue({} as never)
})
afterEach(cleanup)

test("les moteurs se groupent bien machine/en ligne", async () => {
  monter([modeleEnLigne, modeleEnLigneIndisponible])
  await screen.findByRole("heading", { name: "Sur cette machine" })
  screen.getByRole("heading", { name: "En ligne" })
  // Sur cette machine : un moteur par famille, jamais un par style — trois
  // styles de trois familles font trois cartes, pas trois lignes à plat.
  const zimage = (await screen.findByText("Z-Image Turbo")).closest("article")!
  expect(zimage).toHaveTextContent("Pixel art net et rapide")
  expect(zimage.querySelectorAll("article").length).toBe(0)
  // En ligne : le même catalogue que la barre qui paie, un modèle par carte.
  const gpt = screen.getByText("GPT Image").closest("article")!
  expect(gpt).toHaveTextContent("Installé")
  const sunburst = screen.getByText("GPT Image Sunburst").closest("article")!
  expect(sunburst).toHaveTextContent("aucune clé OpenRouter")
})

test("un moteur non installé montre le bon bouton — installer, réinstaller, ou rien (fichiers manquants)", async () => {
  vi.mocked(stylesLocaux.installer).mockResolvedValue({ modele: "ComfyUI:zimage-pixel@v1" } as never)
  monter()
  await screen.findByRole("heading", { name: "Sur cette machine" })

  // zimage-pixel : prêt, pas installé → « Installer ».
  const ligneZimage = (await screen.findByText("Pixel art net et rapide")).closest("li")!
  fireEvent.click(within(ligneZimage).getByRole("button", { name: "Installer" }))
  await waitFor(() => expect(stylesLocaux.installer).toHaveBeenCalledWith("zimage-pixel"))
  expect(api.rafraichirCatalogue).toHaveBeenCalled()

  // klein-portrait : déjà installé → « Réinstaller », même route (défaut 4).
  const ligneKlein = screen.getByText("Portrait Klein").closest("li")!
  expect(ligneKlein).toHaveTextContent("prêt · installé")
  fireEvent.click(within(ligneKlein).getByRole("button", { name: "Réinstaller" }))
  await waitFor(() => expect(stylesLocaux.installer).toHaveBeenCalledWith("klein-portrait"))

  // sdxl-toon : il manque un fichier → aucun bouton, la marche à suivre.
  const ligneSdxl = screen.getByText("Toon SDXL").closest("li")!
  expect(ligneSdxl).toHaveTextContent("il manque le checkpoint SDXL de base")
  expect(within(ligneSdxl).queryByRole("button")).toBeNull()
})

test("« Repeindre une zone » n'apparaît que pour un moteur qui sait — en ligne comme sur cette machine", async () => {
  vi.mocked(stylesLocaux.lister).mockResolvedValue({ styles: [{ ...stylePret, repeint: false }] })
  monter([modeleEnLigne, modeleEnLigneIndisponible])
  const zimage = (await screen.findByText("Z-Image Turbo")).closest("article")!
  expect(zimage).not.toHaveTextContent("Repeindre une zone")
  const gpt = screen.getByText("GPT Image").closest("article")!
  expect(gpt).not.toHaveTextContent("Repeindre une zone")
  const sunburst = screen.getByText("GPT Image Sunburst").closest("article")!
  expect(sunburst).toHaveTextContent("Repeindre une zone")
})

test("le renvoi depuis un outil atterrit sur la bonne fiche — défilé et mis en évidence, puis oublié", async () => {
  vi.useFakeTimers({ toFake: ["setTimeout"] })
  const scroll = vi.spyOn(Element.prototype, "scrollIntoView").mockImplementation(() => undefined)
  const { onSignale } = monter([modeleEnLigne], "klein")
  await vi.waitFor(() => expect(screen.queryByText("Portrait Klein")).toBeTruthy())
  const carte = document.querySelector('[data-moteur-carte="klein"]')!
  expect(carte.className).toContain("border-signal")
  expect(scroll).toHaveBeenCalled()
  await vi.advanceTimersByTimeAsync(2200)
  expect(onSignale).toHaveBeenCalledTimes(1)
  scroll.mockRestore()
  vi.useRealTimers()
})
