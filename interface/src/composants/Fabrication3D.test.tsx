import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, expect, test, vi } from "vitest"
import { Parcours3D, SuiviFabrication3D } from "./Fabrication3D"
import { sources3d, type Catalogue3D, type Travail3D } from "../api-3d"
import { travaux } from "../api-travaux"
import type { Asset, Personnage } from "../api"

vi.mock("../api-3d", () => ({ sources3d: { catalogue: vi.fn(), personnages: vi.fn(), preparer: vi.fn(), travail: vi.fn(), lancer: vi.fn(), reconcilier: vi.fn(), fichierTravail: () => "/copie.glb" } }))
vi.mock("../api-travaux", () => ({ travaux: { lister: vi.fn() } }))
vi.mock("./BibliothequePourImage", () => ({ BibliothequePourImage: ({ onChoisir }: { onChoisir: (a: Asset) => void }) => <button onClick={() => onChoisir({ identifiant: "reference" } as Asset)}>Choisir la référence filtrée</button> }))
const personnage = { identifiant: "hero", projet: "jeu", nom: "Héros", plan: [], cases: [] } as unknown as Personnage
const catalogue: Catalogue3D = { moteurs_3d: [{ valeur: "trellis2", libelle: "Trellis" }], moteur_3d_defaut: "trellis2", animations: ["marche.fbx"], defaut: "marche.fbx", angles: [], angle_defaut: "", eclairages: [], eclairage_defaut: "", styles: [], style_defaut: "", bornes: [] }
const travail: Travail3D = { nature: "3d", identifiant: "modele-conserve", projet: "jeu", acteur: "auteur", modele: "asset3d:trellis2", adresse: "http://127.0.0.1:8498", cree_le: 1,
  demande: { cle: "cle", etape: "modele_3d", personnage: "hero", reference_asset: "reference", cadence: 8, reglages: { steps_forme: 7 } }, etape: "modele_3d", etat: "prepare", fichiers_3d: {}, bandes: [], consommations: [],
  references: [{ nom: "Exacte", url: "/reference-figee.png", empreinte: "hash" }], apercu_3d: { reglages: { steps_forme: 7 }, prerequis: { disponible: true, raisons: [] } }, annonce: { appels: 1, reservation_usd: 0, limite: "Une seule étape", mesures: [] } }
beforeEach(() => { vi.clearAllMocks(); localStorage.clear(); vi.mocked(travaux.lister).mockResolvedValue([]); vi.mocked(sources3d.catalogue).mockResolvedValue(catalogue); vi.mocked(sources3d.personnages).mockResolvedValue({ personnages: [{ identifiant: "source-conservee", complet: true, photo: "", indisponible_parce_que: null, animations_posees: [] }] }); vi.mocked(sources3d.preparer).mockResolvedValue(travail); vi.mocked(sources3d.lancer).mockResolvedValue({ ...travail, etat: "termine", resultat_3d: { identifiant: "externe", personnage: "source-conservee", etat: "termine" } }) })

test("modèle puis squelette : la suite réutilise la source, aucun calcul ne part pendant la relecture", async () => {
  render(<Parcours3D personnage={personnage} />)
  fireEvent.click(screen.getByRole("button", { name: "Préparer une étape 3D" }))
  await screen.findByRole("option", { name: "Trellis" })
  fireEvent.click(screen.getByRole("button", { name: "Choisir l’image de départ" }))
  fireEvent.click(screen.getByRole("button", { name: "Choisir la référence filtrée" }))
  fireEvent.click(screen.getByRole("button", { name: "Relire cette étape avant de lancer" }))
  await screen.findByRole("button", { name: "Lancer cette étape locale" })
  expect(sources3d.lancer).not.toHaveBeenCalled()
  expect(screen.getByAltText("Référence du modèle 3D")).toHaveAttribute("src", "/reference-figee.png")
  fireEvent.click(screen.getByRole("button", { name: "Lancer cette étape locale" }))
  fireEvent.click(await screen.findByRole("button", { name: "Préparer le squelette" }))
  await waitFor(() => expect(screen.getByLabelText("Source 3D à réutiliser")).toHaveValue("source-conservee"))
  expect(screen.getByLabelText("Étape 3D à préparer")).toHaveValue("rig")
  expect(sources3d.preparer).toHaveBeenCalledTimes(1)
  expect(sources3d.lancer).toHaveBeenCalledTimes(1)
})

test("rouvrir un modèle terminé garde son téléchargement et ne contacte pas le moteur", async () => {
  render(<SuiviFabrication3D initiale={{ ...travail, etat: "termine", fichiers_3d: { "modele.glb": "hash" } }} onFermer={vi.fn()} />)
  expect(screen.getByRole("link", { name: "Télécharger le modèle" })).toHaveAttribute("href", "/copie.glb")
  expect(sources3d.travail).not.toHaveBeenCalled(); expect(sources3d.lancer).not.toHaveBeenCalled(); expect(sources3d.catalogue).not.toHaveBeenCalled()
})

test("réponse perdue : retrouver l’envoi conserve la clé et demande une reprise explicite", async () => {
  vi.mocked(sources3d.reconcilier).mockResolvedValue({ ...travail, etat: "a_reprendre" })
  render(<SuiviFabrication3D initiale={{ ...travail, etat: "externe_inconnu" }} onFermer={vi.fn()} />)
  fireEvent.click(screen.getByRole("button", { name: "Retrouver l’envoi" }))
  await screen.findByRole("button", { name: "Reprendre cette étape" })
  expect(sources3d.reconcilier).toHaveBeenCalledWith(expect.objectContaining({ identifiant: "modele-conserve", etat: "externe_inconnu" }))
  expect(sources3d.lancer).not.toHaveBeenCalled(); expect(sources3d.preparer).not.toHaveBeenCalled()
})
