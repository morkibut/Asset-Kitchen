// « Livrer au jeu » › Sons (SN6) : rangés par famille comme la maquette, un
// jeu de variantes comme un seul son, un son sans sujet reste un son du jeu.
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react"
import { afterEach, expect, test, vi } from "vitest"
import { SonsALivrer, lignesALivrer } from "./SonsALivrer"
import { sons, type Son } from "../api-sons"
import { jeuxDeVariantes } from "../api-series-son"
import { sonsDuSujet, type LigneIndex } from "../api-sons-du-sujet"
import { jeu } from "../son-essais"

vi.mock("../api-sons", () => ({ sons: { lister: vi.fn() } }))
vi.mock("../api-series-son", () => ({ jeuxDeVariantes: { lister: vi.fn() } }))
vi.mock("../api-sons-du-sujet", () => ({ sonsDuSujet: { index: vi.fn(), lire: vi.fn() } }))
vi.mock("./ApercuLivraisonSon", () => ({ ApercuLivraisonSon: ({ son, jeu: j }: { son?: Son; jeu?: { nom: string } }) => <p>Aperçu de {son?.nom ?? j?.nom}</p> }))
afterEach(() => { cleanup(); vi.restoreAllMocks() })

const son = (id: string, nom: string, famille: Son["famille"], boucle = false) =>
  ({ identifiant: id, projet: "jeu", nom, famille, recette: { boucle } }) as unknown as Son
const PAS = jeu([1, 2], { identifiant: "jeu-pas", nom: "sfx_heros_pas" })
const INDEX: LigneIndex[] = [{ sujet: "heros", nom_sujet: "Le héros", cle: "pas", nom: "Pas", famille: "bruitage", nom_stable: "sfx_heros_pas",
  contenu: { nature: "jeu", identifiant: "jeu-pas", nom: "sfx_heros_pas", sons: ["s1", "s2"] } }]

test("un jeu compte pour une ligne, ses sons n'en font pas d'autres ; un son sans sujet reste listé", () => {
  const lignes = lignesALivrer([son("s1", "Pas 1", "bruitage"), son("s2", "Pas 2", "bruitage"), son("v", "Vent", "ambiance", true), son("x", "Import", null)], [PAS], INDEX)
  expect(lignes.map((l) => [l.titre, l.famille, l.sujet])).toEqual([
    ["sfx_heros_pas", "bruitage", "Le héros › Pas"], ["Vent", "ambiance", null], ["Import", "aucune", null]])
  expect(lignes[0].detail).toBe("2 variantes · le jeu en joue une au hasard")
  expect(lignes[1].detail).toBe("en boucle")
})

test("un tirage de série que personne n'a gardé ne part pas au jeu", () => {
  const tirage = { ...son("t3", "Pas 3", "bruitage"), provenance: { serie: { identifiant: "serie-1", rang: 3 } } } as unknown as Son
  const lignes = lignesALivrer([son("s1", "Pas 1", "bruitage"), son("s2", "Pas 2", "bruitage"), tirage], [PAS], INDEX)
  expect(lignes.map((l) => l.titre)).toEqual(["sfx_heros_pas"])
})

test("les sons se rangent par famille, et chacun se relit avant de partir", async () => {
  vi.mocked(sons.lister).mockResolvedValue([son("s1", "Pas 1", "bruitage"), son("s2", "Pas 2", "bruitage"), son("v", "Vent", "ambiance", true)])
  vi.mocked(jeuxDeVariantes.lister).mockResolvedValue([PAS])
  vi.mocked(sonsDuSujet.index).mockResolvedValue(INDEX)
  render(<SonsALivrer projet="jeu" />)
  const bruitages = await screen.findByRole("region", { name: "Bruitages" })
  expect(within(bruitages).getByText("sfx_heros_pas")).toBeInTheDocument()
  expect(within(bruitages).getByText(/part aussi avec Le héros › Pas/)).toBeInTheDocument()
  expect(within(screen.getByRole("region", { name: "Ambiances" })).getByText("Vent")).toBeInTheDocument()
  expect(screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent)).toEqual(["Bruitages", "Ambiances"])
  fireEvent.click(within(bruitages).getByRole("button", { name: "Voir ce qui part au jeu" }))
  expect(screen.getByText("Aperçu de sfx_heros_pas")).toBeInTheDocument()
})
