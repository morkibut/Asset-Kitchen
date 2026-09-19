// L'onglet « Sons » de la fiche d'un sujet (SN6) : les emplacements, un vide
// qui lance une série déjà décrite par le sujet, et le gardé qui y apparaît.
// Les routes sont doublées : aucun essai ne lance rien.
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { afterEach, beforeEach, expect, test, vi } from "vitest"
import { SonsDuSujet } from "./SonsDuSujet"
import { sonsDuSujet, type Emplacement, type SonsDuSujet as Vue } from "../api-sons-du-sujet"
import { ecoute, jeuxDeVariantes, seriesSon, texteSon } from "../api-series-son"
import { workflows } from "../api-workflows"
import { jeu, mesures, serie, tirageRendu } from "../son-essais"
import { sfxr } from "../api-sfxr"

vi.mock("../api-sons-du-sujet", () => ({ sonsDuSujet: { lire: vi.fn(), index: vi.fn(), ajouter: vi.fn(), retirer: vi.fn(), poser: vi.fn(), vider: vi.fn(), proposer: vi.fn(), preparer: vi.fn() } }))
vi.mock("../api-workflows", () => ({ workflows: { lister: vi.fn() } }))
vi.mock("../api-series-son", () => ({
  texteSon: { composer: vi.fn(), moteurs: vi.fn() },
  seriesSon: { annoncer: vi.fn(), preparer: vi.fn(), demarrer: vi.fn(), lire: vi.fn(), reprendre: vi.fn(), garder: vi.fn(), lister: vi.fn() },
  jeuxDeVariantes: { lire: vi.fn(), renommer: vi.fn(), lister: vi.fn(), creer: vi.fn(), ajouter: vi.fn(), retirer: vi.fn() },
  ecoute: { onde: vi.fn(), adresse: () => "/api/x.wav" },
}))
vi.mock("../api-sfxr", async (original) => ({ ...(await original<typeof import("../api-sfxr")>()), sfxr: { departs: vi.fn().mockResolvedValue(["clic"]), fabriquer: vi.fn(), variantes: vi.fn() } }))

const TEXTE = "footsteps, small hooded traveller, soft leather boots"
const place = (cle: string, nom: string, famille: Emplacement["famille"], o: Partial<Emplacement> = {}): Emplacement => ({
  cle, nom, famille, indice: null, libre: false, propose: true, contenu: null, rempli: false, nom_stable: `sfx_heros_${cle}`,
  series: [], derniere_serie: null, pose_le: null, par_sfxr: famille === "interface", ...o,
})
const vue = (emplacements: Emplacement[]): Vue => ({
  projet: "jeu", sujet: { identifiant: "heros", nom: "Le héros", famille: "personnages", description: "small hooded traveller" },
  emplacements, remplis: emplacements.filter((e) => e.rempli).length, total: emplacements.length, revision: 1,
})
const VIDE = vue([place("pas", "Pas", "bruitage"), place("attaque", "Attaque", "bruitage"), place("replique", "Réplique", "voix")])

beforeEach(() => {
  vi.clearAllMocks(); localStorage.clear()
  HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined) as unknown as HTMLMediaElement["play"]
  HTMLMediaElement.prototype.pause = vi.fn()
  vi.mocked(workflows.lister).mockResolvedValue({ profils: [] })
  vi.mocked(texteSon.moteurs).mockResolvedValue({ familles: { bruitage: { famille: "bruitage", modele: "ComfyUI:sa3@1", moteur: "sa3-small-sfx", possibles: [] } } as never })
  vi.mocked(texteSon.composer).mockImplementation(async (_p, d) => ({ famille: "bruitage", moteur: "sa3-small-sfx", gabarit: "g", compose: true, texte: `TrackType: SFX. ${d.prompt}`,
    morceaux: [{ texte: d.prompt, source: "description" }], langue: { non_anglais: false, indices: [] }, reglages_recus: [] }))
  vi.mocked(seriesSon.annoncer).mockResolvedValue({ nombre: 8, famille: "bruitage", modele: "ComfyUI:sa3@1", graine_par_tirage: true, annonce: { temps_s: 30, mesures: 3, cout_usd: 0, phrase: "" }, composition: null })
  vi.mocked(ecoute.onde).mockResolvedValue({ duree: 1, taux: 44100, canaux: 1, canaux_ondes: [{ minimum: [-0.5], maximum: [0.5] }] })
  vi.mocked(sonsDuSujet.lire).mockResolvedValue(VIDE)
  vi.mocked(sonsDuSujet.proposer).mockResolvedValue({ famille: "bruitage", prompt: TEXTE, nombre: 8, nom: "Le héros · Pas",
    morceaux: [], emplacement: { sujet: "heros", cle: "pas", nom: "Pas" }, par_sfxr: false })
})
afterEach(() => { cleanup(); vi.restoreAllMocks() })

test("les emplacements de sa famille, vides ou remplis, et les voix à venir", async () => {
  vi.mocked(sonsDuSujet.lire).mockResolvedValue(vue([
    place("pas", "Pas", "bruitage", { rempli: true, series: ["serie1"], contenu: { nature: "jeu", identifiant: "jeu1", existe: true, nom: "sfx_heros_pas", famille: "bruitage", sons: ["s1", "s2"], a_livrer: ["s1", "s2"], signalements: [] } }),
    place("attaque", "Attaque", "bruitage", { series: ["serie2"] }),
    place("replique", "Réplique", "voix"),
  ]))
  render(<SonsDuSujet projet="jeu" sujet="heros" nomSujet="Le héros" />)
  expect(await screen.findByText("1 sur 3 remplis")).toBeInTheDocument()
  const pas = screen.getByRole("listitem", { name: "Pas" })
  expect(within(pas).getByText("2 variantes")).toBeInTheDocument()
  expect(within(pas).getByText("sfx_heros_pas")).toBeInTheDocument()
  expect(within(pas).getByRole("button", { name: "Ouvrir" })).toBeEnabled()
  const attaque = screen.getByRole("listitem", { name: "Attaque" })
  expect(within(attaque).getByText("une série, rien de gardé")).toBeInTheDocument()
  expect(within(attaque).getByRole("button", { name: "Reprendre la série" })).toBeEnabled()
  expect(within(screen.getByRole("listitem", { name: "Réplique" })).getByRole("button", { name: "Fabriquer · à venir" })).toBeDisabled()
})

test("depuis le « pas » vide, une série déjà décrite par le sujet ; le gardé y range", async () => {
  const lancee = serie([tirageRendu(1), tirageRendu(2)], { identifiant: "serie1", emplacement: { sujet: "heros", cle: "pas", nom_sujet: "Le héros", nom: "Pas", famille: "bruitage" } })
  vi.mocked(sonsDuSujet.preparer).mockResolvedValue({ ...lancee, etat: "preparee" })
  vi.mocked(seriesSon.demarrer).mockResolvedValue(lancee)
  vi.mocked(seriesSon.lire).mockResolvedValue(lancee)
  vi.mocked(seriesSon.garder).mockResolvedValue(jeu([2], { nom: "sfx_heros_pas" }))
  render(<SonsDuSujet projet="jeu" sujet="heros" nomSujet="Le héros" />)
  fireEvent.click(within(await screen.findByRole("listitem", { name: "Pas" })).getByRole("button", { name: "Fabriquer" }))
  // Le texte proposé est dans la case, tel quel, à relire ; la famille est celle de l'emplacement.
  const texte = await screen.findByLabelText("Ce qu’on doit entendre")
  expect(texte).toHaveValue(TEXTE)
  const familles = within(screen.getByRole("group", { name: "Famille" })).getAllByRole("button")
  expect(familles.map((b) => b.textContent)).toEqual(["Bruitage"])
  expect(screen.getByText("Dans", { exact: false })).toHaveTextContent("Dans Le héros › Pas")
  const bouton = await screen.findByRole("button", { name: /^Lancer 8 tirages/ })
  await waitFor(() => expect(bouton).toBeEnabled())
  fireEvent.click(bouton)
  await waitFor(() => expect(sonsDuSujet.preparer).toHaveBeenCalledWith("jeu", "heros", "pas", expect.objectContaining({ famille: "bruitage", prompt: TEXTE, nombre: 8, nom: "Le héros · Pas" })))
  expect(seriesSon.preparer).not.toHaveBeenCalled()
  await waitFor(() => expect(seriesSon.demarrer).toHaveBeenCalledWith("jeu", "serie1"))
  // Garder passe par la série : le serveur range dans le jeu de l'emplacement.
  const tuile = await screen.findByRole("listitem", { name: "Tirage 2" })
  fireEvent.click(within(tuile).getByRole("button", { name: "Garder le tirage 2" }))
  await waitFor(() => expect(seriesSon.garder).toHaveBeenCalledWith("jeu", "serie1", { sons: ["s2"] }))
  expect(await screen.findByDisplayValue("sfx_heros_pas")).toBeInTheDocument()
  // Revenir au sujet relit ses emplacements.
  fireEvent.click(screen.getByRole("button", { name: "‹ Le héros" }))
  await waitFor(() => expect(sonsDuSujet.lire).toHaveBeenCalledTimes(3))
})

test("un emplacement rouvert retrouve sa dernière série", async () => {
  vi.mocked(sonsDuSujet.lire).mockResolvedValue(vue([place("pas", "Pas", "bruitage", { series: ["ancienne", "serie1"], derniere_serie: "serie1" })]))
  vi.mocked(seriesSon.lire).mockResolvedValue(serie([tirageRendu(1)], { identifiant: "serie1" }))
  render(<SonsDuSujet projet="jeu" sujet="heros" nomSujet="Le héros" />)
  fireEvent.click(await screen.findByRole("button", { name: "Reprendre la série" }))
  await waitFor(() => expect(seriesSon.lire).toHaveBeenCalledWith("jeu", "serie1"))
  expect(await screen.findByRole("region", { name: "Série 2" })).toBeInTheDocument()
  expect(screen.getByText("Séries précédentes · 1")).toBeInTheDocument()
})

test("nommer un emplacement à la main, avec sa famille", async () => {
  vi.mocked(sonsDuSujet.ajouter).mockResolvedValue(vue([place("pas", "Pas", "bruitage"), place("saut", "Saut", "bruitage", { libre: true, propose: false })]))
  render(<SonsDuSujet projet="jeu" sujet="heros" nomSujet="Le héros" />)
  fireEvent.click(await screen.findByRole("button", { name: "+ Ajouter un emplacement" }))
  fireEvent.change(screen.getByLabelText("Nom de l’emplacement"), { target: { value: "saut" } })
  fireEvent.change(screen.getByLabelText("Famille"), { target: { value: "bruitage" } })
  fireEvent.click(screen.getByRole("button", { name: "Ajouter" }))
  await waitFor(() => expect(sonsDuSujet.ajouter).toHaveBeenCalledWith("jeu", "heros", { nom: "saut", famille: "bruitage" }))
  expect(await screen.findByRole("listitem", { name: "Saut" })).toBeInTheDocument()
  expect(within(screen.getByRole("listitem", { name: "Saut" })).getByRole("button", { name: "Retirer l’emplacement Saut" })).toBeEnabled()
})

test("un emplacement d'interface passe par sfxr, et le jeu gardé s'y pose", async () => {
  vi.mocked(sonsDuSujet.lire).mockResolvedValue(vue([place("clic", "Clic", "interface")]))
  render(<SonsDuSujet projet="jeu" sujet="heros" nomSujet="Le héros" />)
  fireEvent.click(await screen.findByRole("button", { name: "Fabriquer" }))
  expect(await screen.findByText(/Aucun texte ne part/)).toBeInTheDocument()
  expect(sonsDuSujet.proposer).not.toHaveBeenCalled()
  expect(jeuxDeVariantes.lire).not.toHaveBeenCalled()
})

test("garder un son rétro dans un emplacement d'interface déjà rempli l'ajoute au jeu, sans en former un nouveau", async () => {
  // Défaut confirmé le 19 septembre 2026 : SonRetro ne recevait pas le jeu
  // déjà posé sur l'emplacement, donc chaque « Garder » en formait un
  // nouveau (`jeuxDeVariantes.creer`) qui remplaçait l'ancien à la pose.
  const deja = jeu([1, 2], { identifiant: "j-clic", nom: "sfx_heros_clic", famille: "interface" })
  vi.mocked(sonsDuSujet.lire).mockResolvedValue(vue([place("clic", "Clic", "interface", { rempli: true,
    contenu: { nature: "jeu", identifiant: "j-clic", existe: true, nom: deja.nom, famille: "interface", sons: deja.sons, a_livrer: deja.a_livrer, signalements: [] } })]))
  vi.mocked(jeuxDeVariantes.lire).mockResolvedValue(deja)
  vi.mocked(sfxr.fabriquer).mockResolvedValue({ identifiant: "r3", projet: "jeu", nom: "Clic — variante 3", revision: 1, revision_courante: 1,
    pret: true, etat: "prete", raison: "", jugement: "a-juger", source: { nom: "sfxr.wav", empreinte: "e", octets: 10 },
    provenance: { nature: "sfxr", parametres: {}, graine: 3, depart: "clic" }, recette: {} as never, mesures: mesures({ duree: 0.2 }),
    famille: "interface", avertissements: [], recette_proposee: null, versions: [] })
  vi.mocked(jeuxDeVariantes.ajouter).mockResolvedValue(jeu([1, 2, 3], { identifiant: "j-clic", nom: "sfx_heros_clic", famille: "interface", revision: 2 }))
  render(<SonsDuSujet projet="jeu" sujet="heros" nomSujet="Le héros" />)
  fireEvent.click(await screen.findByRole("button", { name: "Ouvrir" }))
  await waitFor(() => expect(jeuxDeVariantes.lire).toHaveBeenCalledWith("jeu", "j-clic"))
  fireEvent.click(await screen.findByRole("button", { name: "Un son" }))
  fireEvent.click(await screen.findByRole("button", { name: "Garder le tirage 1" }))
  await waitFor(() => expect(jeuxDeVariantes.ajouter).toHaveBeenCalledWith("jeu", "j-clic", "r3", true))
  expect(jeuxDeVariantes.creer).not.toHaveBeenCalled()
})

test("SN7 : un son gardé se cale sur une animation, et la carte le dit", async () => {
  const marche = { identifiant: "marche-sud", pose: "marche", direction: "sud", compte: 4, cadence: 8, sens: "boucle", case_largeur: 16, case_hauteur: 16, favori: true, cree_le: 1, rang: 0 }
  const personnage = { identifiant: "heros", cases: [{ pose: "marche", bandes: [marche], directions: [{ identifiant: "sud", nom: "Sud", bandes: [marche] }] }] } as never
  vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(new Response(JSON.stringify({ projet: "jeu", sujet: "heros", revision: 2, sons: { pas: ["s1"] },
    reperes: [{ bande: "marche-sud", image: 3, cle: "pas", nom: "Pas", nom_bande: "marche-sud", pose: "marche", direction: "sud", compte: 4, cadence: 8, signal: null }] }),
    { status: 200, headers: { "Content-Type": "application/json" } }))))
  vi.mocked(sonsDuSujet.lire).mockResolvedValue(vue([
    place("pas", "Pas", "bruitage", { rempli: true, contenu: { nature: "son", identifiant: "s1", existe: true, nom: "Pas", famille: "bruitage", sons: ["s1"], a_livrer: ["s1"], signalements: [] } }),
    place("replique", "Réplique", "voix", { rempli: true, contenu: { nature: "son", identifiant: "s2", existe: true, nom: "Bonjour", famille: "voix", sons: ["s2"], a_livrer: ["s2"], signalements: [] } }),
  ]))
  render(<SonsDuSujet projet="jeu" sujet="heros" nomSujet="Le héros" personnage={personnage} plan={[{ identifiant: "marche", nom: "Marche" } as never]} />)
  const pas = await screen.findByRole("listitem", { name: "Pas" })
  expect(await within(pas).findByText("Calé sur marche · sud, image 3")).toBeInTheDocument()
  // Une voix ne se cale pas sur un pas.
  expect(within(screen.getByRole("listitem", { name: "Réplique" })).queryByRole("button", { name: /calage|Caler/ })).toBeNull()
  fireEvent.click(within(pas).getByRole("button", { name: "Modifier le calage" }))
  expect(within(pas).getByRole("button", { name: "Image 3" })).toHaveAttribute("aria-pressed", "true")
  expect(within(pas).getByRole("combobox", { name: "Animation" })).toHaveValue("marche-sud")
  vi.unstubAllGlobals()
})
