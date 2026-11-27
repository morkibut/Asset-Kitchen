// RC1 · Le registre : une entrée à choix se juge sur place, et la décision est
// un état. Les routes sont doublées : l'écran ne fait qu'appeler le service.
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { Registre } from "./Registre"

const ligne = {
  identifiant: "heron-portrait", type: "visuel", nom_type: "Proposition de visuel", titre: "Portrait : le héron",
  resume: "Trois pistes. Prends-en une.", rayon: "personnages", groupe: null, auteur: "fil-portraits", choix: true,
  cree_le: 1, maj_le: 2, version: 1, versions: 1, nouveau: true, mis_a_jour: false, vignette: null, medias: 3,
  etat: "a-trancher", nom_etat: "À trancher", hors_vue: false, porte: "validation", nom_porte: "Validation",
  portes: [{ cle: "validation", nom: "Validation", passee: false }], pris: null, reprise: null,
  attend: "j'attends ce choix pour lancer la suite", remplacee_par: null,
}
const medias = ["a", "b", "c"].map((code) => ({ code, genre: "image", fichier: `medias/${code}.png`, conseil: code === "b", legende: `Piste ${code}` }))
const entree = (pris: string[] | null) => ({ ...ligne, pris, corps: "", change: null, propositions: medias, histoire: [], remarques: [], journal: [] })

let appels: { url: string; init?: RequestInit }[] = []
let pris: string[] | null = null

beforeEach(() => {
  appels = []; pris = null
  vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
    appels.push({ url, init })
    let corps: unknown = {}
    if (url.endsWith("/register")) corps = { projet: "marais", a_trancher: [ligne], nouveautes: [], par_rayon: [], hors_vue: [], depots_refuses: [], reglages: { types: [], rayons: [] }, total: 1, boite_de_depot: "/d" }
    else if (url.endsWith("/choice")) { pris = JSON.parse(String(init?.body)).codes; corps = { ...entree(pris), deja: false } }
    else if (url.endsWith("/seen")) corps = { vu: 1 }
    else if (url.includes("/entries/")) corps = entree(pris)
    return new Response(JSON.stringify(corps), { status: 200, headers: { "Content-Type": "application/json" } })
  }))
})
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

it("met à trancher en tête, ouvre l'entrée, et « Je prends celle-ci » se voit tout de suite", async () => {
  render(<Registre projet="marais" />)
  expect(await screen.findByRole("heading", { name: /À trancher/ })).toBeInTheDocument()
  fireEvent.click(screen.getByRole("button", { name: /Portrait : le héron/ }))
  expect(await screen.findByText("Conseillée par l'agent")).toBeInTheDocument()
  expect(screen.getByText(/Ce que ta décision débloque/)).toBeInTheDocument()
  // Valider attend un choix : une entrée à choix se juge sur ce qu'on a pris.
  expect(screen.getByRole("button", { name: "Valider" })).toBeDisabled()
  fireEvent.click(screen.getAllByRole("button", { name: "Je prends celle-ci" })[1])
  await waitFor(() => expect(screen.getByText("Prise")).toBeInTheDocument())
  expect(appels.find((a) => a.url.endsWith("/choice"))?.init?.body).toBe(JSON.stringify({ codes: ["b"] }))
  expect(screen.getByRole("button", { name: "Valider" })).not.toBeDisabled()
})

it("une décision à la fois montre l'entrée plein cadre", async () => {
  render(<Registre projet="marais" />)
  fireEvent.click(await screen.findByRole("button", { name: "Une décision à la fois · 1" }))
  expect(await screen.findByRole("heading", { name: "Portrait : le héron" })).toBeInTheDocument()
  expect(screen.getByText("Une décision à la fois · 1 à trancher")).toBeInTheDocument()
})
