import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, expect, test, vi } from "vitest"
import { FabricationImageLocale, ProfilsWorkflow } from "./WorkflowsLocaux"
import { workflows, stylesLocaux, type ProfilWorkflow, type StyleLocal, type TravailImageLocale } from "../api-workflows"
import { api } from "../api"

vi.mock("../api-workflows", async () => {
  const reel = await vi.importActual<typeof import("../api-workflows")>("../api-workflows")
  return {
    ...reel,
    workflows: {
      lister: vi.fn(), importer: vi.fn(), diagnostiquer: vi.fn(), preparerImage: vi.fn(), lireImage: vi.fn(), demarrerImage: vi.fn(), reprendreImage: vi.fn(),
    },
    stylesLocaux: { lister: vi.fn(), installer: vi.fn(), installerPrets: vi.fn() },
  }
})

const stylePret: StyleLocal = { identifiant: "zimage-pixel", nom: "Pixel art net et rapide", famille: "zimage", genre: "sprite", vitesse: "environ 30 secondes par image", reference: "depart", pret: true, manque: [], modele: null }
const styleInstalle: StyleLocal = { identifiant: "klein-portrait", nom: "Portrait Klein", famille: "klein", genre: "sprite", vitesse: "1 à 3 minutes par image", reference: "sujet", pret: true, manque: [], modele: "ComfyUI:klein-portrait@v1" }
const styleManquant: StyleLocal = { identifiant: "sdxl-toon", nom: "Toon SDXL", famille: "sdxl", genre: "sprite", vitesse: "environ 40 secondes par image", reference: "depart", pret: false, manque: ["le checkpoint SDXL de base"], modele: null }
const profil: ProfilWorkflow = { identifiant: "reference", nom: "Référence dessinée", nature: "image", modele: "ComfyUI:reference@version",
  version: "version", cree_le: 1000, references_min: 0, references_max: 0,
  graphe: { "1": { class_type: "Texte", inputs: { text: "" } }, "2": { class_type: "SaveImage", inputs: {} } },
  liaisons: { prompt: [{ noeud: "1", champ: "text" }] }, parametres: { seed: { genre: "intervalle", minimum: 0, maximum: 999, defaut: 42 } },
  formats: [{ resolution: "64", proportions: "1:1", largeur: 64, hauteur: 64 }], durees: [], cadence: 0, sortie: { noeud: "2", champ: "images" } }
const travail: TravailImageLocale = { nature: "image-locale", identifiant: "travail-image", projet: "jeu", cle: "unique", acteur: "auteur", etat: "prepare", etape: "relecture", cree_le: 1000,
  demande: { cle: "unique", modele: profil.modele, prompt: "Un pèlerin" }, generation_image: "generation", reference_asset: null, clip: null, bandes: [], references: [],
  envoi_image: { prompt: "L’univers exact\nUn pèlerin", options: { seed: 321 }, resolution: "64", proportions: "1:1" }, annonce: { appels: 1, image_usd: 0, reservation_usd: 0,
    locale: { cout_usd: 0, nature: "local", mesures: [], raison: "Durée non encore mesurée pour ce workflow." } }, consommations: [], prochaine_action: "demarrer" }

beforeEach(() => {
  vi.clearAllMocks(); localStorage.clear()
  vi.mocked(workflows.lister).mockResolvedValue({ profils: [profil] })
  vi.mocked(workflows.diagnostiquer).mockResolvedValue({ disponible: true, problemes: [], noeuds: [], observe_le: 1000, adresse: "http://local" })
  vi.mocked(workflows.preparerImage).mockResolvedValue(travail)
  vi.mocked(workflows.demarrerImage).mockResolvedValue({ ...travail, etat: "termine", reference_asset: "asset-produit", assets: ["asset-produit"] })
  vi.mocked(stylesLocaux.lister).mockResolvedValue({ styles: [stylePret, styleInstalle, styleManquant] })
  vi.spyOn(api, "rafraichirCatalogue").mockResolvedValue({} as never)
})
afterEach(cleanup)

test("les styles de sc-clone sont groupés par moteur et repliés par défaut", async () => {
  render(<ProfilsWorkflow />)
  await screen.findByRole("heading", { name: "Les styles de sc-clone" })
  // Les quatre groupes sont des `<details>` sans l'attribut `open` — repliés
  // d'origine, tel que le navigateur les montre, même si jsdom ne masque pas
  // leur contenu pour une requête de texte.
  const resume = screen.getByText("Z-Image Turbo", { exact: false, selector: "summary" })
  expect(resume.closest("details")).not.toHaveAttribute("open")
  fireEvent.click(resume)
  const nom = await screen.findByText("Pixel art net et rapide")
  const ligne = nom.closest("li")!
  expect(ligne).toHaveTextContent("environ 30 secondes par image")
  expect(ligne).toHaveTextContent("part de l’image")
})

test("un style prêt s’installe d’un clic, un style manquant montre ce qu’il faut poser", async () => {
  vi.mocked(stylesLocaux.installer).mockResolvedValue({ ...profil, modele: "ComfyUI:zimage-pixel@v1" })
  render(<ProfilsWorkflow />)
  await screen.findByRole("heading", { name: "Les styles de sc-clone" })
  fireEvent.click(screen.getByText("Z-Image Turbo", { exact: false, selector: "summary" }))
  fireEvent.click(await screen.findByRole("button", { name: "Installer" }))
  await waitFor(() => expect(stylesLocaux.installer).toHaveBeenCalledWith("zimage-pixel"))
  expect(api.rafraichirCatalogue).toHaveBeenCalled()
  fireEvent.click(screen.getByText("SDXL", { exact: false, selector: "summary" }))
  await screen.findByText(/il manque le checkpoint SDXL de base/)
  expect(screen.getByText("node scripts/install-models.mjs")).toBeInTheDocument()
})

test("« Installer les styles prêts » relance le relevé de ComfyUI", async () => {
  vi.mocked(stylesLocaux.installerPrets).mockResolvedValue({ installes: [profil] })
  render(<ProfilsWorkflow />)
  const bouton = await screen.findByRole("button", { name: /Installer les styles prêts/ })
  fireEvent.click(bouton)
  await waitFor(() => expect(stylesLocaux.installerPrets).toHaveBeenCalled())
  expect(stylesLocaux.lister).toHaveBeenCalledTimes(2)
})

test("un style installé apparaît aussitôt dans la liste des méthodes", async () => {
  const installe: ProfilWorkflow = { ...profil, identifiant: "zimage-pixel", nom: "Z-Image Turbo · Pixel art net et rapide", modele: "ComfyUI:zimage-pixel@v1" }
  vi.mocked(workflows.lister).mockResolvedValueOnce({ profils: [] }).mockResolvedValue({ profils: [installe] })
  vi.mocked(stylesLocaux.installerPrets).mockResolvedValue({ installes: [installe] })
  render(<ProfilsWorkflow />)
  await screen.findByText(/Aucun workflow importé/)
  fireEvent.click(await screen.findByRole("button", { name: /Installer les styles prêts/ }))
  await screen.findByRole("heading", { name: "Z-Image Turbo · Pixel art net et rapide" })
  expect(screen.queryByText(/Aucun workflow importé/)).toBeNull()
})

test("relire conserve le texte composé et ne soumet qu’après le bouton de lancement", async () => {
  const ouvrir = vi.fn(), toile = vi.fn()
  render(<FabricationImageLocale projet="jeu" modeleInitial={profil.modele} onAsset={ouvrir} onToile={toile} />)
  await screen.findByText("Prérequis présents · calcul local gratuit")
  fireEvent.change(screen.getByLabelText("L’image à fabriquer"), { target: { value: "Un pèlerin" } })
  fireEvent.change(screen.getByLabelText("seed"), { target: { value: "321" } })
  fireEvent.click(screen.getByRole("button", { name: "Relire avant l’envoi" }))
  await screen.findByText(/L’univers exact/)
  expect(workflows.demarrerImage).not.toHaveBeenCalled()
  expect(workflows.preparerImage).toHaveBeenCalledWith("jeu", expect.objectContaining({ modele: profil.modele, resolution: "64", options: { seed: 321 }, prompt: "Un pèlerin" }))
  fireEvent.click(screen.getByRole("button", { name: "Lancer cette image locale" }))
  await screen.findByRole("heading", { name: "L’image est dans la galerie" })
  expect(workflows.demarrerImage).toHaveBeenCalledTimes(1)
  fireEvent.click(screen.getByRole("button", { name: "Ouvrir et retoucher" })); expect(ouvrir).toHaveBeenCalledWith("asset-produit")
  fireEvent.click(screen.getByRole("button", { name: "Poser sur la toile" })); expect(toile).toHaveBeenCalledWith("asset-produit")
})

test("une fabrication interrompue rouvre son envoi et reprend sans préparer une nouvelle demande", async () => {
  vi.mocked(workflows.lireImage).mockResolvedValue({ ...travail, etat: "a_reprendre" })
  vi.mocked(workflows.reprendreImage).mockResolvedValue({ ...travail, etat: "termine", reference_asset: "asset-produit" })
  render(<FabricationImageLocale projet="jeu" identifiantInitial={travail.identifiant} />)
  fireEvent.click(await screen.findByRole("button", { name: "Reprendre le suivi conservé" }))
  await screen.findByRole("heading", { name: "L’image est dans la galerie" })
  expect(workflows.reprendreImage).toHaveBeenCalledWith("jeu", travail.identifiant)
  expect(workflows.preparerImage).not.toHaveBeenCalled(); expect(workflows.demarrerImage).not.toHaveBeenCalled()
})

test("un prérequis absent empêche la relecture et explique le manque", async () => {
  vi.mocked(workflows.diagnostiquer).mockResolvedValue({ disponible: false, problemes: ["Le modèle local manque dans ComfyUI."], noeuds: [], observe_le: 1000, adresse: "http://local" })
  render(<FabricationImageLocale projet="jeu" modeleInitial={profil.modele} />)
  await screen.findByText("Le modèle local manque dans ComfyUI.")
  fireEvent.change(screen.getByLabelText("L’image à fabriquer"), { target: { value: "Un pèlerin" } })
  expect(screen.getByRole("button", { name: "Relire avant l’envoi" })).toBeDisabled()
  expect(workflows.preparerImage).not.toHaveBeenCalled()
})

test("importer un profil n’exécute pas son graphe et vérifie ses prérequis à la demande", async () => {
  vi.mocked(workflows.importer).mockResolvedValue(profil)
  vi.spyOn(api, "rafraichirCatalogue").mockResolvedValue({} as never)
  vi.spyOn(api, "modelesVideo").mockResolvedValue({ modeles: [] } as never)
  render(<ProfilsWorkflow onImage={vi.fn()} />)
  await screen.findByRole("heading", { name: profil.nom })
  fireEvent.click(screen.getByRole("button", { name: "Ajouter un workflow" }))
  fireEvent.change(screen.getByLabelText("Document du workflow"), { target: { value: JSON.stringify(profil) } })
  fireEvent.click(screen.getByRole("button", { name: "Enregistrer cette version de profil" }))
  await waitFor(() => expect(workflows.importer).toHaveBeenCalledWith(profil))
  expect(workflows.demarrerImage).not.toHaveBeenCalled()
  fireEvent.click(await screen.findByRole("button", { name: "Vérifier les prérequis" }))
  await screen.findByText("Prérequis présents")
  expect(workflows.diagnostiquer).toHaveBeenCalledWith(profil.identifiant, profil.version)
})
