// Les écrans des jeux de tuiles (TU3) : la liste, le choix de la sorte, l'atelier
// — poser, effacer, délier une bordure, enregistrer, rouvrir — et la livraison.
// `fetch` n'est jamais appelé : les routes passent par `tuiles.*`, doublées ici.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { Tuiles } from "./Tuiles"
import { doublerLaLecture } from "./AtelierTuiles"
import { tuiles, type EnsembleTuiles, type EnvoiFabrique } from "../api-tuiles"
import { api, type ApercuLivraison, type Asset } from "../api"
import { installerBouchonCanvas } from "../tuiles/moteur/__tests__/canvas-shim"
import { atlasDe, jeuDepuisRecette, oublierLesRendus, type Recette } from "../tuiles/atelier"
import { encoderPng, enBase64 } from "../tuiles/png"
import type { RGBAImage } from "../tuiles/moteur/types"

installerBouchonCanvas()
// Le moteur rend de vraies planches : sous la charge de toute la suite, plus que cinq secondes.
vi.setConfig({ testTimeout: 30_000 })

vi.mock("./WorkflowsLocaux", () => ({ FabricationImageLocale: () => null }))
vi.mock("./BibliothequePourImage", () => ({ BibliothequePourImage: () => null }))

/** Ce que le serveur fait d'un envoi : il garde la recette complétée et la carte. */
function ensembleDepuis(envoi: EnvoiFabrique, identifiant = "sol-1", revision = 1): EnsembleTuiles {
  const recette: Recette = JSON.parse(JSON.stringify(envoi.recette))
  for (const [b, s] of [["bordure", "surface"], ["bordureBas", "bas"]] as const)
    if (recette.emplacements[b]?.lie) recette.emplacements[b] = { ...(recette.emplacements[s] as object), lie: true } as Recette["emplacements"][string]
  recette.reglages = { couleurSurface: "#92af70", couleurContour: "#43563d", fondBlanc: false, ...recette.reglages }
  return {
    identifiant, projet: "jeu", personnage: null, nom: envoi.nom, revision, historique: [revision], retenues: 47,
    grille: { taille: recette.taille, marge: 0, espacement: 0, colonnes: 8, lignes: 6 },
    source: { asset: "atlas", empreinte: "sha", dimensions: { largeur: 256, hauteur: 192 }, provenance: {} }, corrections: {},
    cellules: [], terrains: [], carte: envoi.carte, atlas_url: "/atlas.png", carte_url: "/carte.png",
    diagnostic: { pret: true, problemes: [], raccords: [], limite: "" }, recette,
  }
}

const ensembleAU13 = (): EnsembleTuiles => ({ identifiant: "foret", projet: "jeu", personnage: null, nom: "Forêt", revision: 1, historique: [1], retenues: 3,
  grille: { taille: 16, marge: 0, espacement: 0, colonnes: 1, lignes: 1 }, source: { asset: "atlas", empreinte: "sha", dimensions: { largeur: 16, hauteur: 16 }, provenance: {} }, corrections: {},
  cellules: [{ x: 0, y: 0, nom: "Herbe", retenue: true, terrain: null, correction: null, raccords: { nord: null, "nord-est": null, est: null, "sud-est": null, sud: null, "sud-ouest": null, ouest: null, "nord-ouest": null } }],
  terrains: [], carte: { largeur: 2, hauteur: 1, cases: [] }, atlas_url: "/foret.png", carte_url: "/carte.png", diagnostic: { pret: false, problemes: [], raccords: [], limite: "" } })

/** La carte se peint à la souris : le canevas mesure une case par 10 px. */
function laCarte() {
  const c = screen.getByLabelText("La carte : clic pour poser, clic droit pour effacer") as HTMLCanvasElement
  vi.spyOn(c, "getBoundingClientRect").mockReturnValue({ left: 0, top: 0, width: 180, height: 120, right: 180, bottom: 120, x: 0, y: 0, toJSON: () => ({}) })
  return c
}
const cases = () => Number(/(\d+) cases/.exec(screen.getByText(/\d+ cases$/).textContent!)![1])

beforeEach(() => { localStorage.clear(); oublierLesRendus() })
afterEach(() => { cleanup(); vi.restoreAllMocks() })

describe("Les tuiles du jeu", () => {
  it("liste les jeux : aperçu du moteur pour un jeu fabriqué, atlas pour un jeu fait d'une image", async () => {
    const fabrique = ensembleDepuis({ nom: "Herbe et terre", recette: { sorte: "sol", taille: 32, graine: 1, emplacements: { surface: { source: "integree", nom: "herbe" }, bordure: { lie: true } }, reglages: {} }, atlas: "", carte: { largeur: 18, hauteur: 12, cases: [] } })
    vi.spyOn(tuiles, "lister").mockResolvedValue([fabrique, ensembleAU13()])
    render(<Tuiles projet="jeu" />)
    const herbe = await screen.findByRole("button", { name: "Ouvrir Herbe et terre" })
    expect(within(herbe).getByText("Sol · 47 pièces · 32 px")).toBeInTheDocument()
    const foret = screen.getByRole("button", { name: "Ouvrir Forêt" })
    expect(within(foret).getByText("À partir d’une image · 3 pièces retenues · 16 px")).toBeInTheDocument()
    expect(foret.querySelector("img")).toHaveAttribute("src", "/foret.png")
    // Le jeu fait d'une image s'ouvre toujours dans l'éditeur d'AU13.
    fireEvent.click(foret)
    expect(await screen.findByRole("button", { name: "Garder les changements" })).toBeInTheDocument()
  })

  it("choisit la sorte, avec la taille du jeu déjà posée, puis ouvre l'atelier", async () => {
    vi.spyOn(tuiles, "lister").mockResolvedValue([])
    render(<Tuiles projet="jeu" tailleDuJeu={64} />)
    fireEvent.click(await screen.findByRole("button", { name: "Nouveau jeu de tuiles" }))
    expect(screen.getByRole("heading", { name: "Quelle sorte de tuiles ?" })).toBeInTheDocument()
    for (const sorte of ["Un sol", "Un chemin", "Un mur", "15 pièces", "17 pièces"]) expect(screen.getByRole("button", { name: new RegExp(`^${sorte}`) })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "64 px" })).toHaveAttribute("aria-pressed", "true")
    expect(screen.getByText("64 px, la taille de ce jeu.")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: /^Un chemin/ }))
    expect(screen.getByLabelText("Nom")).toHaveValue("Nouveau chemin")
    fireEvent.click(screen.getByRole("button", { name: "Ouvrir l’atelier" }))
    expect(screen.getByLabelText("Nom du jeu de tuiles")).toHaveValue("Nouveau chemin")
    expect(screen.getByLabelText("Taille d’une pièce")).toHaveValue("64")
    expect(screen.getByText("Chemin · 16 pièces")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Chemins au hasard" })).toBeInTheDocument()
    // Pas d'onglet « Générer » dans cette tranche : il arrive avec TU5.
    fireEvent.click(screen.getByRole("button", { name: /^Le chemin ·/ }))
    expect(screen.getByRole("tab", { name: "Intégrées" })).toBeInTheDocument()
    expect(screen.queryByRole("tab", { name: "Générer" })).toBeNull()
  })

  it("pose au clic, efface au clic droit, et délie puis relie la bordure", async () => {
    vi.spyOn(tuiles, "lister").mockResolvedValue([])
    render(<Tuiles projet="jeu" />)
    fireEvent.click(await screen.findByRole("button", { name: "Nouveau jeu de tuiles" }))
    fireEvent.click(screen.getByRole("button", { name: "Ouvrir l’atelier" }))
    const c = laCarte()
    fireEvent.click(screen.getByRole("button", { name: "Tout effacer" }))
    expect(cases()).toBe(0)
    fireEvent.mouseDown(c, { clientX: 15, clientY: 15, button: 0 })
    fireEvent.mouseMove(c, { clientX: 25, clientY: 15 })
    fireEvent.mouseUp(window)
    expect(cases()).toBe(2)
    fireEvent.mouseDown(c, { clientX: 15, clientY: 15, button: 2 })
    fireEvent.mouseUp(window)
    expect(cases()).toBe(1)

    // La bordure suit la surface tant qu'on ne la délie pas.
    fireEvent.click(screen.getByRole("button", { name: "suit la surface" }))
    expect(screen.getByText("Bordure : Herbe")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Changer" }))
    expect(screen.getByText("Pour : Bordure")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Sable" }))
    expect(screen.getByText("Bordure : Sable")).toBeInTheDocument()
    // La surface change : la bordure déliée garde sa matière.
    fireEvent.click(screen.getByRole("button", { name: /^Surface ·/ }))
    fireEvent.click(screen.getByRole("button", { name: "Neige" }))
    expect(screen.getByRole("button", { name: "Surface · Neige" })).toBeInTheDocument()
    expect(screen.getByText("Bordure : Sable")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Relier" }))
    expect(screen.getByRole("button", { name: "suit la surface" })).toBeInTheDocument()
  })

  it("enregistre la recette, l'atlas rendu et la carte ; rouvert, tout est identique", async () => {
    const lister = vi.spyOn(tuiles, "lister").mockResolvedValue([])
    let envoi: EnvoiFabrique | null = null
    const creer = vi.spyOn(tuiles, "creerFabrique").mockImplementation(async (_p, e) => { envoi = e; return ensembleDepuis(e) })
    const vue = render(<Tuiles projet="jeu" />)
    fireEvent.click(await screen.findByRole("button", { name: "Nouveau jeu de tuiles" }))
    fireEvent.change(screen.getByLabelText("Nom"), { target: { value: "Herbe et sable" } })
    fireEvent.click(screen.getByRole("button", { name: "Ouvrir l’atelier" }))
    fireEvent.change(screen.getByLabelText("Arrondi des coins"), { target: { value: "5" } })
    fireEvent.click(screen.getByRole("checkbox", { name: "Sur un autre sol" }))
    const posees = cases()
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }))
    await waitFor(() => expect(creer).toHaveBeenCalledTimes(1))
    expect(await screen.findByText("Enregistré.")).toBeInTheDocument()

    // Ce qui part : le nom, la recette par emplacement, l'atlas en PNG, la carte.
    const e = envoi!
    expect(e.nom).toBe("Herbe et sable")
    expect(e.recette).toMatchObject({ sorte: "sol", taille: 32, reglages: { arrondi: 5, secondTerrain: true } })
    expect(e.recette.emplacements).toEqual({ surface: { source: "integree", nom: "herbe" }, bordure: { lie: true }, bas: { source: "integree", nom: "sable" }, bordureBas: { lie: true } })
    expect(e.atlas.startsWith("iVBORw0KGgo")).toBe(true)
    // Sur un autre sol, chaque case de la carte porte une pièce (le sol dessous compris).
    expect(e.carte.cases).toHaveLength(18 * 12)
    expect(e.carte.cases.filter((k) => !(k.tuile_x === 7 && k.tuile_y === 5))).toHaveLength(posees)
    // L'atlas envoyé est celui que la recette rend.
    const jeu = jeuDepuisRecette({ identifiant: null, revision: null, nom: e.nom, recette: e.recette, carte: e.carte }, new Map())
    expect(e.atlas).toBe(enBase64(await encoderPng(atlasDe(jeu).pixels)))

    // Rien n'a changé : pas de second envoi possible.
    expect(screen.getByRole("button", { name: "Enregistrer" })).toBeDisabled()

    // Refermer, rouvrir : même carte, même atlas.
    vue.unmount()
    oublierLesRendus()
    const garde = ensembleDepuis(e)
    lister.mockResolvedValue([garde])
    const garder = vi.spyOn(tuiles, "garderFabrique").mockImplementation(async (_p, _id, revision, envoiPut) => ensembleDepuis({ ...e, ...envoiPut } as EnvoiFabrique, "sol-1", revision + 1))
    render(<Tuiles projet="jeu" />)
    fireEvent.click(await screen.findByRole("button", { name: "Ouvrir Herbe et sable" }))
    await screen.findByLabelText("Nom du jeu de tuiles")
    expect(cases()).toBe(posees)
    expect(screen.getByRole("checkbox", { name: "Sur un autre sol" })).toBeChecked()
    expect(screen.getByLabelText("Arrondi des coins")).toHaveValue("5")
    expect(screen.getByRole("button", { name: "Enregistrer" })).toBeDisabled()

    // Peindre une case : seule la carte repart, sans recette ni atlas.
    const c = laCarte()
    fireEvent.click(screen.getByRole("button", { name: "Tout effacer" }))
    fireEvent.mouseDown(c, { clientX: 5, clientY: 5, button: 0 })
    fireEvent.mouseUp(window)
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }))
    await waitFor(() => expect(garder).toHaveBeenCalledTimes(1))
    expect(garder.mock.calls[0][3]).not.toHaveProperty("recette")
    expect(garder.mock.calls[0][3].carte.cases.filter((k) => !(k.tuile_x === 7 && k.tuile_y === 5))).toHaveLength(1)

    // Changer un réglage : la recette et son atlas repartent.
    await screen.findByText("Enregistré.")
    fireEvent.change(screen.getByLabelText("Relief"), { target: { value: "8" } })
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }))
    await waitFor(() => expect(garder).toHaveBeenCalledTimes(2))
    expect(garder.mock.calls[1][3].recette?.reglages.relief).toBe(8)
    expect(garder.mock.calls[1][3].atlas?.startsWith("iVBORw0KGgo")).toBe(true)
  })

  it("une matière du jeu se pose sur la surface et délie sa bordure", async () => {
    const im: RGBAImage = { width: 8, height: 8, data: new Uint8ClampedArray(8 * 8 * 4).fill(200) }
    doublerLaLecture(async () => im)
    vi.spyOn(tuiles, "lister").mockResolvedValue([])
    const creer = vi.spyOn(tuiles, "creerFabrique").mockImplementation(async (_p, e) => ensembleDepuis(e))
    // Une matière n'a pas de pose : son image n'est dans aucune case, la bibliothèque
    // la retrouve par son sujet. Les images d'autres sujets n'y entrent pas.
    vi.spyOn(api, "assets").mockResolvedValue({ total: 2, assets: [
      { identifiant: "vase-1", personnage: "vase", label: "vase-01.png" }, { identifiant: "heros-1", personnage: "heros", label: "" },
    ] as unknown as Asset[] })
    render(<Tuiles projet="jeu" sujetsMatieres={[{ identifiant: "vase", nom: "Vase du marais" }]} />)
    fireEvent.click(await screen.findByRole("button", { name: "Nouveau jeu de tuiles" }))
    fireEvent.click(screen.getByRole("button", { name: "Ouvrir l’atelier" }))
    fireEvent.click(screen.getByRole("button", { name: /^Surface ·/ }))
    fireEvent.click(screen.getByRole("tab", { name: "Mes matières" }))
    fireEvent.click(await screen.findByRole("button", { name: /Vase du marais/ }))
    expect(await screen.findByRole("button", { name: "Surface · Vase du marais" })).toBeInTheDocument()
    expect(screen.getByText("Bordure : Herbe")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Relier" })).toBeNull()
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }))
    await waitFor(() => expect(creer).toHaveBeenCalled())
    expect(creer.mock.calls[0][1].recette.emplacements).toMatchObject({ surface: { source: "asset", asset: "vase-1" }, bordure: { source: "integree", nom: "herbe", lie: false } })
  })

  it("vérifie la planche pour de vrai, puis relit et dépose la livraison", async () => {
    vi.spyOn(tuiles, "lister").mockResolvedValue([])
    vi.spyOn(tuiles, "creerFabrique").mockImplementation(async (_p, e) => ensembleDepuis(e))
    const apercu: ApercuLivraison = { jeton: "j1", projet: "jeu", personnage: null, revision: "1", dossier: "res://tuiles/sol-1/", pret: true, conflits: [], scene: "res://tuiles/sol-1/carte.tscn", sprite_frames: null, animations: [],
      fichiers: [{ chemin: "res://tuiles/sol-1/tuiles.png", role: "La planche", etat: "nouveau" }, { chemin: "res://tuiles/sol-1/carte.tscn", role: "La carte d’exemple", etat: "nouveau" }] as ApercuLivraison["fichiers"] }
    const prevoir = vi.spyOn(tuiles, "prevoir").mockResolvedValue(apercu)
    const livrer = vi.spyOn(api, "livrerGodot").mockResolvedValue({ ...apercu, etat: "terminee" })
    render(<Tuiles projet="jeu" onLivraisons={() => undefined} />)
    fireEvent.click(await screen.findByRole("button", { name: "Nouveau jeu de tuiles" }))
    fireEvent.click(screen.getByRole("button", { name: "Ouvrir l’atelier" }))
    fireEvent.click(screen.getByRole("tab", { name: "Vérifier" }))
    expect(await screen.findByText("Aucun défaut : les 47 pièces se raccordent.")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("tab", { name: "Planche" }))
    expect(await screen.findByText(/Planche 8 × 6 cases · 256 × 192 px/)).toBeInTheDocument()
    // Livrer enregistre d'abord ce qui ne l'est pas, puis relit la livraison.
    fireEvent.click(screen.getByRole("button", { name: "Livrer à Godot" }))
    expect(await screen.findByRole("heading", { name: "Livrer à Godot" })).toBeInTheDocument()
    await waitFor(() => expect(prevoir).toHaveBeenCalledWith("jeu", "sol-1", 1))
    expect(await screen.findByText("tuiles.png")).toBeInTheDocument()
    expect(screen.getByText("Vérifié : les 47 pièces se raccordent.")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Déposer dans le projet Godot" }))
    await waitFor(() => expect(livrer).toHaveBeenCalledWith("jeu", "j1"))
    expect(await screen.findByText(/Dans Godot, ouvre/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "‹ Nouveau sol" }))
    expect(await screen.findByLabelText("Nom du jeu de tuiles")).toHaveValue("Nouveau sol")
  })

  it("le mur se peint et se livre à Godot, comme les autres sortes", async () => {
    vi.spyOn(tuiles, "lister").mockResolvedValue([])
    render(<Tuiles projet="jeu" />)
    fireEvent.click(await screen.findByRole("button", { name: "Nouveau jeu de tuiles" }))
    fireEvent.click(screen.getByRole("button", { name: /^Un mur/ }))
    fireEvent.click(screen.getByRole("button", { name: "Ouvrir l’atelier" }))
    expect(screen.getByLabelText("Hauteur du mur")).toHaveValue("2")
    expect(screen.getByRole("button", { name: "Pièces au hasard" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Livrer à Godot" })).toBeEnabled()
    expect(screen.queryByText(/prochaine version/)).toBeNull()
  })
})
