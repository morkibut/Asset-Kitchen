import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { afterEach, beforeEach, expect, test, vi } from "vitest"
import { MusiqueAdaptative } from "./MusiqueAdaptative"
import { musiqueAdaptative, type MusiqueAdaptative as ObjetMusiqueAdaptative } from "../api-musique-adaptative"
import { sons } from "../api-sons"
import type { Son } from "../api-sons"

vi.mock("../api-musique-adaptative", () => ({
  musiqueAdaptative: { lister: vi.fn(), lire: vi.fn(), creer: vi.fn(), modifier: vi.fn(), supprimer: vi.fn(), previsualiserLivraison: vi.fn() },
}))
vi.mock("../api-sons", async (vrai) => ({ ...(await vrai<typeof import("../api-sons")>()), sons: { lister: vi.fn() } }))
const livrerGodot = vi.hoisted(() => vi.fn())
vi.mock("../api", async (vrai) => {
  const module = await vrai<typeof import("../api")>()
  return { ...module, api: { ...module.api, livrerGodot } }
})

const sonMusical = (i: number, o: Partial<Son> = {}): Son => ({
  identifiant: `m${i}`, projet: "jeu", nom: `Exploration ${i}`, revision: 1, revision_courante: 1, pret: true, etat: "prete", raison: "", jugement: "a-juger",
  source: { nom: "x.ogg", empreinte: "e", octets: 10 }, provenance: {}, recette: {} as Son["recette"],
  mesures: { duree: 64, taux: 44100, canaux: 2, echantillons: 100, crete_db: -1, rms_db: -18, silencieux: false, ecretes: 0 },
  famille: "musique", avertissements: [], recette_proposee: null, versions: [], ...o,
} as Son)

const objet = (o: Partial<ObjetMusiqueAdaptative> = {}): ObjetMusiqueAdaptative => ({
  identifiant: "ma1", projet: "jeu", nom: "Boucle du marais",
  couches: [], morceaux: [{ cle: "exploration_1", son: "m1", nom: null, existe: true, famille: "musique", pret: true, signal: "",
    attributs: { tempo: 90, tonalite: "D minor", mesure: 4, duree: 64 } }],
  transitions: [], ecarts: [], livrable: true, couches_a_livrer: [], morceaux_a_livrer: ["exploration_1"],
  revision: 1, cree_le: 1, ...o,
})

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(musiqueAdaptative.lister).mockResolvedValue([])
})
afterEach(() => cleanup())

test("aucune musique prête empêche de composer ; une fois prête, on compose depuis un son déjà fait", async () => {
  vi.mocked(sons.lister).mockResolvedValue([])
  render(<MusiqueAdaptative projet="jeu" />)
  await screen.findByText(/Aucune musique prête/)
  expect(screen.queryByRole("button", { name: "Composer une musique adaptative" })).toBeNull()
})

test("compose une musique adaptative, ajoute un second morceau et une transition, montre un écart sans bloquer", async () => {
  vi.mocked(sons.lister).mockResolvedValue([sonMusical(1), sonMusical(2, { nom: "Combat", identifiant: "m2" })])
  const cree = objet()
  vi.mocked(musiqueAdaptative.creer).mockResolvedValue(cree)
  render(<MusiqueAdaptative projet="jeu" />)
  await screen.findByRole("button", { name: "Composer une musique adaptative" })

  fireEvent.change(screen.getByLabelText("Nom de la nouvelle musique adaptative"), { target: { value: "Boucle du marais" } })
  fireEvent.click(screen.getByRole("button", { name: "Composer une musique adaptative" }))
  await waitFor(() => expect(musiqueAdaptative.creer).toHaveBeenCalledWith("jeu", { nom: "Boucle du marais", morceaux: [{ cle: "exploration_1", son: "m1" }] }))
  await waitFor(() => expect(within(screen.getByRole("region", { name: "Morceaux" })).getByRole("listitem")).toHaveTextContent("Exploration 1"))

  // Un second morceau, avec un tempo différent : l'écart se signale, sans bloquer l'ajout.
  const avecEcart = objet({
    morceaux: [...cree.morceaux, { cle: "combat", son: "m2", nom: null, existe: true, famille: "musique", pret: true, signal: "",
      attributs: { tempo: 150, tonalite: "D minor", mesure: 4, duree: 40 } }],
    ecarts: ["Le tempo diffère entre les sons référencés : 90 (le morceau « exploration_1 ») ; 150 (le morceau « combat »)."],
    morceaux_a_livrer: ["exploration_1", "combat"],
  })
  vi.mocked(musiqueAdaptative.modifier).mockResolvedValueOnce(avecEcart)
  const morceaux = screen.getByRole("region", { name: "Morceaux" })
  fireEvent.change(within(morceaux).getByLabelText("Choisir un son"), { target: { value: "m2" } })
  fireEvent.click(within(morceaux).getByRole("button", { name: "Ajouter un morceau" }))
  await waitFor(() => expect(musiqueAdaptative.modifier).toHaveBeenCalledWith("jeu", "ma1",
    { morceaux: [{ cle: "exploration_1", son: "m1", nom: undefined }, { cle: "combat", son: "m2" }] }))
  await screen.findByText(/Le tempo diffère entre les sons référencés/)

  // Deux morceaux : une transition se propose, par défaut sur la mesure suivante.
  const avecTransition = objet({ ...avecEcart, transitions: [{ de: "exploration_1", vers: "combat", depart: "mesure_suivante", arrivee: "debut", fondu: "croise", fondu_temps: 4 }] })
  vi.mocked(musiqueAdaptative.modifier).mockResolvedValueOnce(avecTransition)
  fireEvent.click(await screen.findByRole("button", { name: "Ajouter une transition" }))
  await waitFor(() => expect(musiqueAdaptative.modifier).toHaveBeenCalledWith("jeu", "ma1", { transitions: [{ de: "exploration_1", vers: "combat" }] }))
  expect(await screen.findByLabelText("Départ de la transition Exploration 1 vers Combat")).toHaveValue("mesure_suivante")
})

test("livrer une musique adaptative montre l'aperçu puis publie", async () => {
  vi.mocked(sons.lister).mockResolvedValue([sonMusical(1)])
  vi.mocked(musiqueAdaptative.lister).mockResolvedValue([objet()])
  vi.mocked(musiqueAdaptative.previsualiserLivraison).mockResolvedValue({
    jeton: "j1", projet: "jeu", personnage: null, revision: "r1", dossier: "audio", pret: true, conflits: [],
    scene: "audio/son.tscn", sprite_frames: null, animations: [],
    fichiers: [{ chemin: "audio/mus_boucle_du_marais_exploration_1.ogg", role: "son", etat: "nouveau", empreinte: "e", octets: 1 },
      { chemin: "audio/mus_boucle_du_marais_morceaux.tres", role: "ressource Godot", etat: "nouveau", empreinte: "e", octets: 1 }],
  })
  livrerGodot.mockResolvedValue({ jeton: "j1", projet: "jeu", personnage: null, revision: "r1", dossier: "audio", pret: true, conflits: [],
    scene: "audio/son.tscn", sprite_frames: null, animations: [], fichiers: [], etat: "terminee" })
  render(<MusiqueAdaptative projet="jeu" />)
  fireEvent.click(await screen.findByRole("button", { name: /Boucle du marais/ }))
  fireEvent.click(screen.getByRole("button", { name: "Voir ce qui part au jeu" }))
  await screen.findByText("mus_boucle_du_marais_morceaux.tres")
  fireEvent.click(screen.getByRole("button", { name: "Livrer cette version" }))
  await waitFor(() => expect(livrerGodot).toHaveBeenCalledWith("jeu", "j1"))
  await screen.findByRole("button", { name: "Livraison terminée" })
})
