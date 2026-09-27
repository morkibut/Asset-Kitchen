// MO2 · La page « Moteurs » — les moteurs d'image groupés sur cette machine
// ou en ligne, `fetch` doublé. Reprend les essais de `StylesDeScClone`
// (`WorkflowsLocaux.test.tsx`, avant que MO2 ne les fonde ici) : groupement
// par moteur, installer/réinstaller un style, et ce que MO2 ajoute — les
// cartes « En ligne » et le renvoi signalé depuis un outil.
//
// MO4 · « Le son » — reprend l'essai de `MethodesSonores`
// (`WorkflowsLocaux.test.tsx`, avant que MO4 ne le fonde ici) : les moteurs se
// montrent sans état à l'ouverture, s'installent sur le clic, et un moteur
// absent se grise avec ce qui manque.

import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { afterEach, beforeEach, expect, test, vi } from "vitest"
import type { Modele } from "../api"
import { moteursSonores, stylesLocaux, workflows, type MoteurSonore, type ResultatMoteurSon, type StyleLocal } from "../api-workflows"
import { api } from "../api"
import { PageDesMoteurs } from "./Moteurs"

vi.mock("../api-workflows", async () => {
  const reel = await vi.importActual<typeof import("../api-workflows")>("../api-workflows")
  return {
    ...reel,
    stylesLocaux: { lister: vi.fn(), installer: vi.fn(), installerPrets: vi.fn() },
    moteursSonores: { lister: vi.fn() },
    workflows: { ...reel.workflows, installerSon: vi.fn() },
  }
})

const moteurSonInstalle: MoteurSonore = {
  identifiant: "sa3-small-sfx", nom: "Stable Audio 3 Small-SFX", description: "Bruitages et ambiances.",
  familles: ["bruitage", "ambiance"], pret: true, manque: [], modele: "ComfyUI:sa3-small-sfx@v1",
}
const moteurSonManquant: MoteurSonore = {
  identifiant: "ace-step-15-turbo", nom: "ACE-Step 1.5 turbo", description: "Musique et jingles.",
  familles: ["musique", "jingle"], pret: false,
  manque: [{ nom: "le modèle ACE-Step 1.5 turbo (musique)", fichier: "acestep_v1.5_turbo.safetensors", dossier: "diffusion_models", source: "https://exemple/ace" }],
  modele: null,
}

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
  const onInstallationSon = vi.fn()
  render(<PageDesMoteurs modeles={modeles} signale={signale} onSignale={onSignale} onInstallationSon={onInstallationSon} />)
  return { onSignale, onInstallationSon }
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(stylesLocaux.lister).mockResolvedValue({ styles: [stylePret, styleInstalle, styleManquant] })
  vi.mocked(moteursSonores.lister).mockResolvedValue({ moteurs: [moteurSonInstalle, moteurSonManquant] })
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

// ── MO4 · « Le son » ──────────────────────────────────────────────────────

test("les moteurs sonores se montrent avec ce qu'ils savent faire, sans rien demander à ComfyUI", async () => {
  monter()
  await screen.findByRole("heading", { name: "Le son" })
  expect(moteursSonores.lister).toHaveBeenCalledTimes(1)
  expect(workflows.installerSon).not.toHaveBeenCalled()

  const installe = (await screen.findByText("Stable Audio 3 Small-SFX")).closest("article")!
  expect(installe).toHaveTextContent("Installé")
  expect(installe).toHaveTextContent("Bruitage")
  expect(installe).toHaveTextContent("Ambiance")
  expect(within(installe).getByRole("button", { name: "Réinstaller" })).toBeTruthy()

  // Le moteur qui manque est grisé avec ce qui manque : son nom en clair, le
  // fichier, le dossier où le poser et un lien vers sa page — jamais proposé
  // puis refusé.
  const manquant = screen.getByText("ACE-Step 1.5 turbo").closest("article")!
  expect(manquant).toHaveTextContent("Fichiers manquants")
  expect(within(manquant).getByText("le modèle ACE-Step 1.5 turbo (musique)")).toBeTruthy()
  expect(within(manquant).getByText("acestep_v1.5_turbo.safetensors")).toBeTruthy()
  expect(within(manquant).getByRole("link", { name: "sa page" })).toHaveProperty("href", "https://exemple/ace")
  expect(within(manquant).queryByRole("button")).toBeNull()
})

test("installer un moteur sonore relit le catalogue et prévient l'appelant", async () => {
  const resultat: Record<string, ResultatMoteurSon> = {
    "sa3-small-sfx": { identifiant: "sa3-small-sfx", installe: true, profil: { identifiant: "sa3-small-sfx", nom: "Stable Audio 3 Small-SFX", nature: "audio", modele: "ComfyUI:sa3-small-sfx@v2", version: "v2", cree_le: 2000, graphe: {}, liaisons: {}, parametres: {}, formats: [], durees: [], cadence: 0, sortie: { noeud: "1", champ: "audio" }, references_min: 0, references_max: 0 } },
  }
  vi.mocked(workflows.installerSon).mockResolvedValue({ moteurs: resultat })
  const { onInstallationSon } = monter()
  const carte = (await screen.findByText("Stable Audio 3 Small-SFX")).closest("article")!
  fireEvent.click(within(carte).getByRole("button", { name: "Réinstaller" }))
  await waitFor(() => expect(workflows.installerSon).toHaveBeenCalledWith(["sa3-small-sfx"]))
  await waitFor(() => expect(moteursSonores.lister).toHaveBeenCalledTimes(2))
  expect(onInstallationSon).toHaveBeenCalledTimes(1)
})
