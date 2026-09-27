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
import type { EtatTraitement, Modele, Silhouette } from "../api"
import { moteursSonores, stylesLocaux, workflows, workflowsImportes, type MoteurSonore, type ResultatMoteurSon, type StyleLocal } from "../api-workflows"
import { sources3d } from "../api-3d"
import { coupDeMain, type EtatCoupDeMain } from "../api-coup-de-main"
import { api } from "../api"
import { PageDesMoteurs } from "./Moteurs"

vi.mock("../api-workflows", async () => {
  const reel = await vi.importActual<typeof import("../api-workflows")>("../api-workflows")
  return {
    ...reel,
    stylesLocaux: { lister: vi.fn(), installer: vi.fn(), installerPrets: vi.fn() },
    moteursSonores: { lister: vi.fn() },
    workflows: { ...reel.workflows, installerSon: vi.fn() },
    // MO6 : « Les workflows importés » lit sa propre route au montage.
    workflowsImportes: { lister: vi.fn(), lireGraphe: vi.fn(), relier: vi.fn() },
  }
})
// MO5 : la 3D et le coup de main lisent chacun leur propre route au montage,
// jamais celles des styles ni des moteurs sonores ci-dessus.
vi.mock("../api-3d", async () => {
  const reel = await vi.importActual<typeof import("../api-3d")>("../api-3d")
  return { ...reel, sources3d: { ...reel.sources3d, connexion: vi.fn(), catalogue: vi.fn() } }
})
vi.mock("../api-coup-de-main", async () => {
  const reel = await vi.importActual<typeof import("../api-coup-de-main")>("../api-coup-de-main")
  return { ...reel, coupDeMain: { ...reel.coupDeMain, etat: vi.fn() } }
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

// MO5 : cinq modèles de détourage, un de chaque état — celui qu'aucun n'a
// encore vu passer par une carte « Moteurs » avant cette tranche.
const silhouetteInstallee: Silhouette = { nom: "isnet-general-use", titre: "intermédiaire", octets: 178_648_008, lent: false, note: "le défaut du produit", entree: 1024, licence: "Apache-2.0", secondes_par_image: 1.2, defaut: true, descendu: true, raison: null }
const silhouetteAuPremierAppel: Silhouette = { nom: "u2net", titre: "rapide", octets: 175_997_641, lent: false, note: "le plus rapide", entree: 320, licence: "Apache-2.0", secondes_par_image: 0.4, defaut: false, descendu: false, raison: null }
const silhouetteSansExtension: Silhouette = { nom: "birefnet-general", titre: "lourd", octets: 972_666_916, lent: true, note: "quatre fois plus lourd", entree: 1024, licence: "MIT", secondes_par_image: 16, defaut: false, descendu: false, raison: "le moteur par modèle n'est pas installé" }
const traitementFixture: EtatTraitement = {
  moteurs: [], silhouettes: [silhouetteInstallee, silhouetteAuPremierAppel, silhouetteSansExtension],
  quantification: { raison: null, note: null }, reductions: [], recettes: [],
}

const assistDisponible: EtatCoupDeMain = { disponible: true, raison: null, motif: null, modele: "OpenRouter:deepseek/deepseek-v4-flash" }
const assistClefManquante: EtatCoupDeMain = { disponible: false, raison: "il manque la clé OpenRouter", motif: "indisponible", modele: "OpenRouter:deepseek/deepseek-v4-flash" }

function monter(modeles: Modele[] = [modeleEnLigne], signale: string | null = null, traitement: EtatTraitement | null = null) {
  const onSignale = vi.fn()
  const onInstallationSon = vi.fn()
  render(<PageDesMoteurs modeles={modeles} traitement={traitement} signale={signale} onSignale={onSignale} onInstallationSon={onInstallationSon} />)
  return { onSignale, onInstallationSon }
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(stylesLocaux.lister).mockResolvedValue({ styles: [stylePret, styleInstalle, styleManquant] })
  vi.mocked(moteursSonores.lister).mockResolvedValue({ moteurs: [moteurSonInstalle, moteurSonManquant] })
  vi.spyOn(api, "rafraichirCatalogue").mockResolvedValue({} as never)
  // MO5 : par défaut, non configuré / pas de clé — chaque essai qui veut
  // autre chose le repose lui-même.
  vi.mocked(sources3d.connexion).mockResolvedValue({ adresse: "", configure: false })
  vi.mocked(sources3d.catalogue).mockResolvedValue({} as never)
  vi.mocked(coupDeMain.etat).mockResolvedValue(assistClefManquante)
  vi.mocked(workflowsImportes.lister).mockResolvedValue({ moteurs: [] })
})
afterEach(cleanup)

// ── MO6 · Les workflows importés ─────────────────────────────────────────────

test("la page montre les workflows importés par l'auteur, à côté des autres moteurs", async () => {
  vi.mocked(workflowsImportes.lister).mockResolvedValue({ moteurs: [{
    identifiant: "retouche-maison", nom: "Retouche maison", nature: "image", description: "", modele: "ComfyUI:retouche-maison@v2",
    version: "v2", cree_le: 1000, versions: 2, references_min: 1, references_max: 1, durees: [], capacites: ["repeindre_zone"], a_relier: [],
    diagnostic: { disponible: true, problemes: [], noeuds: [], observe_le: 1000, adresse: "http://local", a_completer: [] },
  }] })
  monter()
  await screen.findByRole("heading", { name: "Les workflows importés" })
  const carte = (await screen.findByText("Retouche maison")).closest("article")!
  expect(carte).toHaveTextContent("Repeindre une zone")
  expect(carte).toHaveTextContent("se choisit dans « Repeindre »")
  expect(workflowsImportes.lister).toHaveBeenCalledTimes(1)
})

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

// ── MO5 · La 3D, le détourage et le coup de main ─────────────────────────────

test("la 3D dit qu'elle n'est pas configurée, sans jamais vérifier une adresse absente", async () => {
  monter()
  const carte = (await screen.findByText("asset3d")).closest("article")!
  expect(carte).toHaveTextContent("Non configuré")
  expect(carte).toHaveTextContent("fiche d’un personnage")
  expect(sources3d.connexion).toHaveBeenCalledTimes(1)
  expect(sources3d.catalogue).not.toHaveBeenCalled()
})

test("la 3D vérifie une adresse posée, et dit si asset3d y répond", async () => {
  vi.mocked(sources3d.connexion).mockResolvedValue({ adresse: "http://127.0.0.1:8000", configure: true })
  vi.mocked(sources3d.catalogue).mockResolvedValue({
    moteurs_3d: [], moteur_3d_defaut: "", animations: [], defaut: "", angles: [], angle_defaut: "",
    eclairages: [], eclairage_defaut: "", styles: [], style_defaut: "", bornes: [],
  })
  monter()
  const carte = (await screen.findByText("asset3d")).closest("article")!
  await waitFor(() => expect(carte).toHaveTextContent("Installé"))
  expect(carte).toHaveTextContent("http://127.0.0.1:8000")
})

test("la 3D dit qu'elle ne répond pas, adresse posée mais programme éteint", async () => {
  vi.mocked(sources3d.connexion).mockResolvedValue({ adresse: "http://127.0.0.1:8000", configure: true })
  vi.mocked(sources3d.catalogue).mockRejectedValue(new Error("asset3d ne répond pas à son adresse configurée."))
  monter()
  const carte = (await screen.findByText("asset3d")).closest("article")!
  await waitFor(() => expect(carte).toHaveTextContent("Indisponible"))
  expect(carte).toHaveTextContent("les copies déjà importées restent disponibles")
})

test("le détourage montre les cinq modèles du catalogue reçu, jamais une seconde lecture", async () => {
  monter([modeleEnLigne], null, traitementFixture)
  await screen.findByRole("heading", { name: "Le détourage" })

  const installe = screen.getByText("intermédiaire").closest("article")!
  expect(installe).toHaveTextContent("isnet-general-use")
  expect(installe).toHaveTextContent("défaut")
  expect(installe).toHaveTextContent("Installé")

  const auPremierAppel = screen.getByText("rapide").closest("article")!
  expect(auPremierAppel).toHaveTextContent("Au premier appel")
  expect(auPremierAppel).toHaveTextContent("se télécharge tout seul au premier appel")

  const sansExtension = screen.getByText("lourd").closest("article")!
  expect(sansExtension).toHaveTextContent("Extension absente")
  expect(sansExtension).toHaveTextContent("le moteur par modèle n'est pas installé")
  expect(sansExtension).toHaveTextContent('uv pip install -e ".[detourage]"')
})

test("le détourage attend le catalogue plutôt que de le refaire lui-même", async () => {
  monter()
  await screen.findByRole("heading", { name: "Le détourage" })
  screen.getByText("Lecture des moteurs de détourage…")
})

test("le coup de main montre le même état que la petite marque des champs", async () => {
  monter()
  const carte = (await screen.findByText("OpenRouter · deepseek/deepseek-v4-flash")).closest("article")!
  expect(carte).toHaveTextContent("Clé manquante")
  expect(carte).toHaveTextContent("il manque la clé OpenRouter")
})

test("le coup de main se montre disponible dès que la clé et le plafond le permettent", async () => {
  vi.mocked(coupDeMain.etat).mockResolvedValue(assistDisponible)
  monter()
  const carte = (await screen.findByText("OpenRouter · deepseek/deepseek-v4-flash")).closest("article")!
  await waitFor(() => expect(carte).toHaveTextContent("Installé"))
  expect(carte).toHaveTextContent("Améliorer un champ")
  expect(carte).toHaveTextContent("Répondre à une question")
  expect(carte).toHaveTextContent("Expliquer un blocage")
})

test("le coup de main dit « Plafond atteint » sans se confondre avec une clé manquante", async () => {
  vi.mocked(coupDeMain.etat).mockResolvedValue({ disponible: false, raison: "plafond du mois atteint", motif: "plafond", modele: "OpenRouter:deepseek/deepseek-v4-flash" })
  monter()
  const carte = (await screen.findByText("OpenRouter · deepseek/deepseek-v4-flash")).closest("article")!
  await waitFor(() => expect(carte).toHaveTextContent("Plafond atteint"))
})
