import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { afterEach, beforeEach, expect, test, vi } from "vitest"
import { SonRetro } from "./SonRetro"
import { ecoute, jeuxDeVariantes } from "../api-series-son"
import { sfxr } from "../api-sfxr"
import type { Son } from "../api-sons"
import { jeu, mesures } from "../son-essais"

vi.mock("../api-series-son", () => ({
  seriesSon: {}, texteSon: {},
  jeuxDeVariantes: { lire: vi.fn(), renommer: vi.fn(), lister: vi.fn(), creer: vi.fn(), ajouter: vi.fn(), retirer: vi.fn() },
  ecoute: { onde: vi.fn(), adresse: (p: string, id: string, r: number) => `/api/projects/${p}/sounds/${id}/preview.wav?revision=${r}&brut=false` },
}))
vi.mock("../api-sfxr", async (original) => ({ ...(await original<typeof import("../api-sfxr")>()), sfxr: { departs: vi.fn(), fabriquer: vi.fn(), variantes: vi.fn() } }))

const son = (i: number, o: Partial<Son> = {}): Son => ({
  identifiant: `r${i}`, projet: "jeu", nom: `Saut — variante ${i}`, revision: 1, revision_courante: 1, pret: true, etat: "pret", raison: "", jugement: "a-juger",
  source: { nom: "sfxr.wav", empreinte: "e", octets: 10 }, provenance: { nature: "sfxr", parametres: { p_base_freq: 0.3 + i / 100 }, graine: i, depart: "jump" },
  recette: {} as Son["recette"], mesures: mesures({ duree: 0.21 }), versions: [], ...o,
} as Son)

beforeEach(() => {
  vi.clearAllMocks()
  HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined) as unknown as HTMLMediaElement["play"]
  HTMLMediaElement.prototype.pause = vi.fn()
  vi.mocked(ecoute.onde).mockResolvedValue({ duree: 0.21, taux: 44100, canaux: 1, canaux_ondes: [{ minimum: [-0.5], maximum: [0.5] }] })
  vi.mocked(sfxr.departs).mockResolvedValue(["blip_select", "clic", "erreur", "explosion", "hit_hurt", "jump", "laser_shoot", "pickup_coin", "power_up", "survol", "validation"])
})
afterEach(() => cleanup())

const membre = (s: string, revision = 2) => ({ ...jeu([1]).membres[0], son: s, rang: null, nom: `Saut — variante ${s.slice(1)}`, revision, famille: "interface" })
const jeuRetro = (sons: string[], o: Partial<ReturnType<typeof jeu>> = {}) =>
  ({ ...jeu([]), identifiant: "retro", serie: null, famille: "interface" as const, nom: "Saut", sons, membres: sons.map((s) => membre(s)), ...o })

test("pas de phrase : un départ, huit variantes en un instant, la même grille ; « Garder » forme le jeu puis l’ajuste", async () => {
  const huit = Array.from({ length: 8 }, (_, i) => son(i + 1))
  vi.mocked(sfxr.variantes).mockResolvedValue(huit)
  vi.mocked(jeuxDeVariantes.creer).mockResolvedValue(jeuRetro(["r2"]))
  vi.mocked(jeuxDeVariantes.ajouter).mockResolvedValue(jeuRetro(["r2", "r5"], { revision: 2 }))
  vi.mocked(jeuxDeVariantes.retirer).mockResolvedValue(jeuRetro(["r5"], { revision: 3 }))
  vi.mocked(jeuxDeVariantes.renommer).mockResolvedValue(jeuRetro(["r5"], { nom: "ui_saut", revision: 4 }))
  const onRegler = vi.fn()
  render(<SonRetro projet="jeu" onRegler={onRegler} />)

  expect(screen.queryByRole("textbox", { name: "Ce qu’on doit entendre" })).toBeNull()
  fireEvent.click(await screen.findByRole("button", { name: "Saut" }))
  expect(screen.getByRole("button", { name: "Saut" })).toHaveAttribute("aria-pressed", "true")
  const tirer = screen.getByRole("button", { name: "Tirer 8 variantes" })
  tirer.focus()
  fireEvent.click(tirer)
  // Le bouton rend le focus : Espace écoutera un son, il ne tirera pas huit autres variantes.
  expect(document.activeElement).not.toBe(tirer)
  await screen.findByRole("listitem", { name: "Tirage 8" })
  expect(sfxr.variantes).toHaveBeenCalledWith("jeu", expect.objectContaining({ depart: "jump", nombre: 8, nom: "Saut", graine: expect.any(Number) }))
  // Tirer ne forme aucun jeu.
  expect(jeuxDeVariantes.creer).not.toHaveBeenCalled()

  fireEvent.keyDown(document.body, { key: "ArrowRight" })
  fireEvent.keyDown(document.body, { key: "g" })
  // Le premier gardé forme le jeu, avec les réglages de la famille interface.
  await waitFor(() => expect(jeuxDeVariantes.creer).toHaveBeenCalledWith("jeu", { nom: "Saut", sons: ["r2"], famille: "interface", appliquer_reglages: true }))
  fireEvent.click(screen.getByRole("button", { name: "Garder le tirage 5" }))
  await waitFor(() => expect(jeuxDeVariantes.ajouter).toHaveBeenCalledWith("jeu", "retro", "r5", true))
  // La grille joue la version gardée (réglages de la famille posés).
  fireEvent.click(screen.getByRole("button", { name: "Écouter le tirage 5" }))
  expect(document.querySelector("audio")!.getAttribute("src")).toContain("/sounds/r5/preview.wav?revision=2")
  // Dégarder le retire du jeu ; le nom du jeu reste modifiable.
  fireEvent.click(screen.getByRole("button", { name: "Garder le tirage 2" }))
  await waitFor(() => expect(jeuxDeVariantes.retirer).toHaveBeenCalledWith("jeu", "retro", "r2"))
  const nom = await screen.findByLabelText("Nom du jeu")
  fireEvent.change(nom, { target: { value: "ui_saut" } })
  fireEvent.blur(nom)
  await screen.findByRole("region", { name: "Jeu de variantes ui_saut" })
  expect(jeuxDeVariantes.creer).toHaveBeenCalledTimes(1)
  expect(screen.queryByRole("button", { name: "Ranger en jeu de variantes" })).toBeNull()
  fireEvent.click(screen.getByRole("button", { name: "Régler Saut — variante 5" }))
  expect(onRegler).toHaveBeenCalledWith("r5")
})

test("un son en un instant, puis des variantes de ce son-là", async () => {
  vi.mocked(sfxr.fabriquer).mockResolvedValue(son(1, { nom: "Clic" }))
  vi.mocked(sfxr.variantes).mockResolvedValue([son(2), son(3), son(4), son(5)])
  render(<SonRetro projet="jeu" />)
  await screen.findByRole("button", { name: "Clic" })
  fireEvent.click(screen.getByRole("button", { name: "4" }))
  fireEvent.click(screen.getByRole("button", { name: "Un son" }))
  await screen.findByRole("listitem", { name: "Tirage 1" })
  expect(sfxr.fabriquer).toHaveBeenCalledWith("jeu", expect.objectContaining({ depart: "clic", nom: "Clic" }))
  expect(within(screen.getByRole("listitem", { name: "Tirage 1" })).getByText("0,21 s · crête −1,2 dB")).toBeInTheDocument()
  fireEvent.click(screen.getByRole("button", { name: "Tirer 4 variantes de ce son" }))
  await screen.findByRole("listitem", { name: "Tirage 4" })
  expect(sfxr.variantes).toHaveBeenCalledWith("jeu", expect.objectContaining({ parametres: { p_base_freq: 0.31 }, nombre: 4, nom: "Clic" }))
  expect(vi.mocked(sfxr.variantes).mock.calls[0][1]).not.toHaveProperty("depart")
})

test("un son seul gardé forme un jeu à lui", async () => {
  vi.mocked(sfxr.fabriquer).mockResolvedValue(son(1, { nom: "Clic" }))
  vi.mocked(jeuxDeVariantes.creer).mockResolvedValue({ ...jeu([]), nom: "Clic", sons: ["r1"], membres: [{ ...jeu([1]).membres[0], son: "r1", rang: null, nom: "Clic" }] })
  render(<SonRetro projet="jeu" />)
  await screen.findByRole("button", { name: "Clic" })
  fireEvent.click(screen.getByRole("button", { name: "Un son" }))
  fireEvent.click(await screen.findByRole("button", { name: "Garder le tirage 1" }))
  await waitFor(() => expect(jeuxDeVariantes.creer).toHaveBeenCalledWith("jeu", { nom: "Clic", sons: ["r1"], famille: "interface", appliquer_reglages: true }))
  expect(await screen.findByRole("region", { name: "Jeu de variantes Clic" })).toBeInTheDocument()
})
