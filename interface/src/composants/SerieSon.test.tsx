import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { afterEach, beforeEach, expect, test, vi } from "vitest"
import { SerieSon } from "./SerieSon"
import { ecoute, jeuxDeVariantes, seriesSon, type TirageSerie } from "../api-series-son"
import { jeu, serie, tirageRendu } from "../son-essais"

vi.mock("../api-series-son", () => ({
  seriesSon: { lire: vi.fn(), demarrer: vi.fn(), reprendre: vi.fn(), garder: vi.fn(), annoncer: vi.fn(), preparer: vi.fn() },
  jeuxDeVariantes: { lire: vi.fn(), renommer: vi.fn(), lister: vi.fn(), creer: vi.fn(), ajouter: vi.fn(), retirer: vi.fn() },
  texteSon: { composer: vi.fn(), moteurs: vi.fn() },
  ecoute: { onde: vi.fn(), adresse: (p: string, id: string, r: number) => `/api/projects/${p}/sounds/${id}/preview.wav?revision=${r}&brut=false` },
}))

let joue: ReturnType<typeof vi.fn>
beforeEach(() => {
  vi.clearAllMocks()
  joue = vi.fn().mockResolvedValue(undefined)
  HTMLMediaElement.prototype.play = joue as unknown as HTMLMediaElement["play"]
  HTMLMediaElement.prototype.pause = vi.fn()
  vi.mocked(ecoute.onde).mockResolvedValue({ duree: 0.82, taux: 44100, canaux: 1, canaux_ondes: [{ minimum: [-0.2, -0.8, -0.1], maximum: [0.2, 0.9, 0.1] }] })
})
afterEach(() => cleanup())

const audio = () => document.querySelector("audio")!
const tuile = (rang: number) => screen.getByRole("listitem", { name: `Tirage ${rang}` })

test("la grille s’écoute au clavier : ← → passent, Espace écoute, G garde — un tirage saturé se signale et se garde", async () => {
  const s = serie([tirageRendu(1), tirageRendu(2, { sature: true, ecretes: 40, crete_db: 0 }), tirageRendu(3)])
  vi.mocked(seriesSon.garder).mockResolvedValue(jeu([2, 3]))
  vi.mocked(seriesSon.lire).mockResolvedValue({ ...s, jeux: ["jeu1"] })
  vi.mocked(jeuxDeVariantes.lire).mockResolvedValue(jeu([2, 3]))
  const onRegler = vi.fn()
  render(<SerieSon projet="jeu" identifiant="serie1" initiale={s} titre="Série 1" onRegler={onRegler} />)

  // Le premier tirage prêt est choisi d'emblée ; le saturé est signalé, pas écarté.
  expect(tuile(1)).toHaveAttribute("aria-current", "true")
  expect(within(tuile(2)).getByText("saturé")).toBeInTheDocument()
  expect(within(tuile(1)).getByText("0,82 s · crête −1,2 dB")).toBeInTheDocument()

  fireEvent.keyDown(document.body, { key: "ArrowRight" })
  expect(tuile(2)).toHaveAttribute("aria-current", "true")
  fireEvent.keyDown(document.body, { key: " " })
  expect(joue).toHaveBeenCalledTimes(1)
  expect(audio().getAttribute("src")).toBe("/api/projects/jeu/sounds/s2/preview.wav?revision=1&brut=false")
  // Passer au suivant pendant l'écoute fait écouter le suivant.
  fireEvent.keyDown(document.body, { key: "ArrowRight" })
  expect(tuile(3)).toHaveAttribute("aria-current", "true")
  expect(audio().getAttribute("src")).toContain("/sounds/s3/")
  fireEvent.keyDown(document.body, { key: "ArrowLeft" })
  fireEvent.keyDown(document.body, { key: "g" })
  expect(within(tuile(2)).getByRole("button", { name: "Garder le tirage 2" })).toHaveAttribute("aria-pressed", "true")
  // Écrire dans un champ ne pilote pas la grille.
  fireEvent.click(within(tuile(3)).getByRole("button", { name: "Garder le tirage 3" }))
  const nom = screen.getByLabelText("Nom du jeu de variantes")
  fireEvent.keyDown(nom, { key: "g" })
  expect(within(tuile(3)).getByRole("button", { name: "Garder le tirage 3" })).toHaveAttribute("aria-pressed", "true")
  fireEvent.change(nom, { target: { value: "Épée qui sort" } })

  fireEvent.click(screen.getByRole("button", { name: "Ranger en jeu de variantes" }))
  await screen.findByRole("region", { name: /Jeu de variantes/ })
  expect(seriesSon.garder).toHaveBeenCalledWith("jeu", "serie1", { rangs: [2, 3], nom: "Épée qui sort", cle: "garder:serie1:2,3" })
  expect(screen.getByText("Ce son sature : il reste dans le jeu, à vous de décider.")).toBeInTheDocument()
  expect(screen.getByText("Le jeu en jouera un au hasard.")).toBeInTheDocument()
  // Le jeu formé, la barre disparaît ; « Régler » ouvre la fiche du son.
  expect(screen.queryByRole("button", { name: "Ranger en jeu de variantes" })).toBeNull()
  fireEvent.click(screen.getByRole("button", { name: "Régler le tirage 3" }))
  expect(onRegler).toHaveBeenCalledWith("s3")
})

test("un clic sur la forme d’onde écoute, un second arrête", async () => {
  render(<SerieSon projet="jeu" identifiant="serie1" initiale={serie([tirageRendu(1), tirageRendu(2)])} />)
  fireEvent.click(screen.getByRole("button", { name: "Écouter le tirage 2" }))
  expect(joue).toHaveBeenCalledTimes(1)
  expect(tuile(2)).toHaveAttribute("aria-current", "true")
  fireEvent.click(screen.getByRole("button", { name: "Écouter le tirage 2" }))
  expect(HTMLMediaElement.prototype.pause).toHaveBeenCalled()
  expect(joue).toHaveBeenCalledTimes(1)
})

test("la série arrive tirage par tirage : le suivi relit la série tant qu’un tirage calcule", async () => {
  const enCours: TirageSerie = { rang: 2, travail: "t2", graine: 102, etat: "en_cours", raison: "", prochaine_action: "attendre", son: null }
  const attente: TirageSerie = { ...enCours, rang: 3, travail: "t3", etat: "en_attente" }
  const debut = serie([tirageRendu(1), enCours, attente], { etat: "en_cours", reste: { temps_s: 40, mesures: 3, cout_usd: 0, phrase: "" } })
  vi.mocked(seriesSon.lire).mockResolvedValue(serie([tirageRendu(1), tirageRendu(2), tirageRendu(3)]))
  render(<SerieSon projet="jeu" identifiant="serie1" initiale={debut} />)
  expect(within(tuile(2)).getByText("en calcul")).toBeInTheDocument()
  expect(within(tuile(3)).getByText("en attente")).toBeInTheDocument()
  expect(screen.getByText("Il reste environ 40 s · 2 tirages à venir")).toBeInTheDocument()
  await screen.findByRole("button", { name: "Écouter le tirage 3" }, { timeout: 3000 })
  expect(seriesSon.lire).toHaveBeenCalledWith("jeu", "serie1")
})

test("une série coupée se reprend par un geste, sans refaire les tirages rendus", async () => {
  const arrete: TirageSerie = { rang: 2, travail: "t2", graine: 102, etat: "a_reprendre", raison: "L’atelier s’est arrêté pendant le calcul.", prochaine_action: "reprendre", son: null }
  vi.mocked(seriesSon.lire).mockResolvedValue(serie([tirageRendu(1), arrete], { etat: "a_reprendre", prochaine_action: "reprendre" }))
  vi.mocked(seriesSon.reprendre).mockResolvedValue(serie([tirageRendu(1), { ...arrete, etat: "en_cours" }], { etat: "en_cours", relances: [2] }))
  render(<SerieSon projet="jeu" identifiant="serie1" />)
  expect(await screen.findByText("L’atelier s’est arrêté pendant le calcul.")).toBeInTheDocument()
  expect(screen.getByText("1 tirage arrêté. Les tirages déjà rendus ne seront pas refaits.")).toBeInTheDocument()
  expect(seriesSon.reprendre).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole("button", { name: "Reprendre" }))
  await waitFor(() => expect(within(tuile(2)).getByText("en calcul")).toBeInTheDocument())
  expect(seriesSon.reprendre).toHaveBeenCalledWith("jeu", "serie1")
})

test("rouverte, une série montre ses jeux déjà formés et leurs tirages gardés", async () => {
  vi.mocked(seriesSon.lire).mockResolvedValue(serie([tirageRendu(1), tirageRendu(2), tirageRendu(3)], { jeux: ["jeu1"] }))
  vi.mocked(jeuxDeVariantes.lire).mockResolvedValue(jeu([1, 3], { nom: "Pas sur l’herbe" }))
  render(<SerieSon projet="jeu" identifiant="serie1" />)
  expect(await screen.findByRole("region", { name: "Jeu de variantes Pas sur l’herbe" })).toBeInTheDocument()
  await waitFor(() => expect(within(tuile(1)).getByRole("button", { name: "Garder le tirage 1" })).toHaveAttribute("aria-pressed", "true"))
  expect(within(tuile(2)).getByRole("button", { name: "Garder le tirage 2" })).toHaveAttribute("aria-pressed", "false")
  // Le même choix qu'un jeu existant ne propose pas d'en former un second.
  expect(screen.queryByRole("button", { name: "Ranger en jeu de variantes" })).toBeNull()
})

test("le jeu se renomme, et son aperçu de livraison s’ouvre sur demande", async () => {
  vi.mocked(seriesSon.lire).mockResolvedValue(serie([tirageRendu(1)], { jeux: ["jeu1"] }))
  vi.mocked(jeuxDeVariantes.lire).mockResolvedValue(jeu([1]))
  vi.mocked(jeuxDeVariantes.renommer).mockResolvedValue(jeu([1], { nom: "sfx_epee" }))
  render(<SerieSon projet="jeu" identifiant="serie1" />)
  const champ = await screen.findByLabelText("Nom du jeu")
  fireEvent.change(champ, { target: { value: "sfx_epee" } })
  fireEvent.blur(champ)
  await waitFor(() => expect(jeuxDeVariantes.renommer).toHaveBeenCalledWith("jeu", "jeu1", "sfx_epee"))
  expect(await screen.findByRole("region", { name: "Jeu de variantes sfx_epee" })).toBeInTheDocument()
})
