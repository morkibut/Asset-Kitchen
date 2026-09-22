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

test("la grille s’écoute au clavier : ← → passent et font écouter, le focus suit, Espace écoute — un tirage saturé se signale et se garde", async () => {
  const s = serie([tirageRendu(1), tirageRendu(2, { sature: true, ecretes: 40, crete_db: 0 }), tirageRendu(3)])
  render(<SerieSon projet="jeu" identifiant="serie1" initiale={s} titre="Série 1" />)

  // Le premier tirage prêt est choisi d'emblée ; le saturé est signalé, pas écarté.
  expect(tuile(1)).toHaveAttribute("aria-current", "true")
  expect(within(tuile(2)).getByText("saturé")).toBeInTheDocument()
  expect(within(tuile(1)).getByText("0,82 s · crête −1,2 dB")).toBeInTheDocument()
  // Un seul tirage entre dans l'ordre de tabulation : celui qu'on voit choisi.
  expect(screen.getByRole("button", { name: "Écouter le tirage 1" })).toHaveAttribute("tabindex", "0")
  expect(screen.getByRole("button", { name: "Écouter le tirage 2" })).toHaveAttribute("tabindex", "-1")

  // Comme la maquette : passer, c'est écouter le tirage choisi — et le focus le suit.
  fireEvent.keyDown(document.body, { key: "ArrowRight" })
  expect(tuile(2)).toHaveAttribute("aria-current", "true")
  expect(joue).toHaveBeenCalledTimes(1)
  expect(audio().getAttribute("src")).toBe("/api/projects/jeu/sounds/s2/preview.wav?revision=1&brut=false")
  expect(document.activeElement).toBe(screen.getByRole("button", { name: "Écouter le tirage 2" }))
  // Espace sur le tirage qui joue l'arrête, puis le rejoue.
  fireEvent.keyDown(document.activeElement!, { key: " " })
  expect(HTMLMediaElement.prototype.pause).toHaveBeenCalled()
  fireEvent.keyDown(document.activeElement!, { key: " " })
  expect(joue).toHaveBeenCalledTimes(2)
  fireEvent.keyDown(document.activeElement!, { key: "ArrowRight" })
  expect(tuile(3)).toHaveAttribute("aria-current", "true")
  expect(audio().getAttribute("src")).toContain("/sounds/s3/")
  expect(document.activeElement).toBe(screen.getByRole("button", { name: "Écouter le tirage 3" }))
})

test("« Garder » écrit : le premier forme le jeu de la série, les suivants s’y ajoutent ou en sortent, sans barre « Ranger »", async () => {
  const s = serie([tirageRendu(1), tirageRendu(2, { sature: true, ecretes: 40, crete_db: 0 }), tirageRendu(3)])
  vi.mocked(seriesSon.garder).mockResolvedValue(jeu([2]))
  vi.mocked(seriesSon.lire).mockResolvedValue({ ...s, jeux: ["jeu1"] })
  vi.mocked(jeuxDeVariantes.lire).mockResolvedValue(jeu([2]))
  vi.mocked(jeuxDeVariantes.ajouter).mockResolvedValue(jeu([2, 3], { revision: 2 }))
  vi.mocked(jeuxDeVariantes.retirer).mockResolvedValue(jeu([2], { revision: 3 }))
  const onRegler = vi.fn()
  render(<SerieSon projet="jeu" identifiant="serie1" initiale={s} titre="Série 1" onRegler={onRegler} />)
  expect(screen.getByText("Garde un ou plusieurs tirages. Les autres restent dans la série.")).toBeInTheDocument()

  fireEvent.keyDown(document.body, { key: "ArrowRight" })
  fireEvent.keyDown(document.body, { key: "g" })
  // L'écran montre le choix tout de suite ; le serveur forme le jeu (réglages de la famille posés par `keep`).
  expect(within(tuile(2)).getByRole("button", { name: "Garder le tirage 2" })).toHaveAttribute("aria-pressed", "true")
  await waitFor(() => expect(seriesSon.garder).toHaveBeenCalledWith("jeu", "serie1", { sons: ["s2"] }))
  expect(await screen.findByRole("region", { name: /Jeu de variantes/ })).toBeInTheDocument()
  expect(screen.getByText("Ce son sature : il reste dans le jeu, à toi de décider.")).toBeInTheDocument()

  const garder3 = within(tuile(3)).getByRole("button", { name: "Garder le tirage 3" })
  garder3.focus()
  fireEvent.click(garder3)
  await waitFor(() => expect(jeuxDeVariantes.ajouter).toHaveBeenCalledWith("jeu", "jeu1", "s3", true))
  expect(await screen.findByText("Le jeu en jouera un au hasard.")).toBeInTheDocument()
  expect(seriesSon.garder).toHaveBeenCalledTimes(1)
  // Espace après un clic sur « Garder » écoute ce tirage ; il ne le dégarde pas.
  fireEvent.keyDown(garder3, { key: " " })
  expect(audio().getAttribute("src")).toContain("/sounds/s3/")
  expect(jeuxDeVariantes.retirer).not.toHaveBeenCalled()
  expect(screen.queryByRole("button", { name: "Ranger en jeu de variantes" })).toBeNull()

  // Dégarder un tirage rangé le retire du jeu.
  fireEvent.click(garder3)
  await waitFor(() => expect(jeuxDeVariantes.retirer).toHaveBeenCalledWith("jeu", "jeu1", "s3"))
  await waitFor(() => expect(within(tuile(3)).getByRole("button", { name: "Garder le tirage 3" })).toHaveAttribute("aria-pressed", "false"))
  fireEvent.click(screen.getByRole("button", { name: "Régler le tirage 2" }))
  expect(onRegler).toHaveBeenCalledWith("s2")
})

test("un refus du serveur reprend le choix et se dit", async () => {
  vi.mocked(seriesSon.garder).mockRejectedValue(new Error("Le tirage 1 n'a pas encore de son."))
  render(<SerieSon projet="jeu" identifiant="serie1" initiale={serie([tirageRendu(1)])} />)
  fireEvent.click(within(tuile(1)).getByRole("button", { name: "Garder le tirage 1" }))
  expect(await screen.findByRole("alert")).toHaveTextContent("Le tirage 1 n'a pas encore de son.")
  expect(within(tuile(1)).getByRole("button", { name: "Garder le tirage 1" })).toHaveAttribute("aria-pressed", "false")
})

test("écrire dans un champ, ou un dialogue ouvert par-dessus, ne pilote pas la grille", async () => {
  render(<><input aria-label="Ailleurs" /><SerieSon projet="jeu" identifiant="serie1" initiale={serie([tirageRendu(1), tirageRendu(2)])} /></>)
  fireEvent.keyDown(screen.getByLabelText("Ailleurs"), { key: "ArrowRight" })
  expect(tuile(1)).toHaveAttribute("aria-current", "true")
  // La fiche d'un son ouverte par-dessus : la touche arrive sur body, la grille ne bouge pas.
  const fiche = document.createElement("dialog")
  fiche.setAttribute("open", "")
  document.body.appendChild(fiche)
  fireEvent.keyDown(document.body, { key: "ArrowRight" })
  fireEvent.keyDown(document.body, { key: "g" })
  expect(tuile(1)).toHaveAttribute("aria-current", "true")
  expect(seriesSon.garder).not.toHaveBeenCalled()
  fiche.remove()
  fireEvent.keyDown(document.body, { key: "ArrowRight" })
  expect(tuile(2)).toHaveAttribute("aria-current", "true")
})

test("« Lancer » et « Reprendre » portent le temps qu’il reste, jamais un prix", async () => {
  const prepare = { rang: 1, travail: "t1", graine: 1, etat: "prepare" as const, raison: "", prochaine_action: "demarrer", son: null }
  render(<SerieSon projet="jeu" identifiant="serie1" initiale={serie([prepare, { ...prepare, rang: 2 }], { etat: "preparee", reste: { temps_s: 40, mesures: 3, cout_usd: 0, phrase: "" } })} />)
  expect(screen.getByRole("button", { name: "Lancer 2 tirages · environ 40 s" })).toBeInTheDocument()
  cleanup()
  const arrete = { ...prepare, etat: "a_reprendre" as const, prochaine_action: "reprendre" }
  render(<SerieSon projet="jeu" identifiant="serie1" initiale={serie([tirageRendu(1), { ...arrete, rang: 2 }], { etat: "a_reprendre", reste: { temps_s: 30, mesures: 3, cout_usd: 0, phrase: "" } })} />)
  expect(screen.getByRole("button", { name: "Reprendre · environ 30 s" })).toBeInTheDocument()
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
  // Garder un tirage de plus l'ajoute à ce jeu-là ; aucun second jeu n'est formé.
  vi.mocked(jeuxDeVariantes.ajouter).mockResolvedValue(jeu([1, 3, 2], { nom: "Pas sur l’herbe", revision: 2 }))
  fireEvent.click(within(tuile(2)).getByRole("button", { name: "Garder le tirage 2" }))
  await waitFor(() => expect(jeuxDeVariantes.ajouter).toHaveBeenCalledWith("jeu", "jeu1", "s2", true))
  expect(seriesSon.garder).not.toHaveBeenCalled()
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

test("Entrée renomme le jeu une seule fois, même quand le champ se quitte ensuite", async () => {
  vi.mocked(seriesSon.lire).mockResolvedValue(serie([tirageRendu(1)], { jeux: ["jeu1"] }))
  vi.mocked(jeuxDeVariantes.lire).mockResolvedValue(jeu([1]))
  vi.mocked(jeuxDeVariantes.renommer).mockResolvedValue(jeu([1], { nom: "sfx_epee", revision: 2 }))
  render(<SerieSon projet="jeu" identifiant="serie1" />)
  const champ = await screen.findByLabelText("Nom du jeu")
  champ.focus()
  fireEvent.change(champ, { target: { value: "sfx_epee" } })
  fireEvent.keyDown(champ, { key: "Enter" })
  fireEvent.blur(champ)
  await screen.findByRole("region", { name: "Jeu de variantes sfx_epee" })
  fireEvent.blur(champ)
  expect(jeuxDeVariantes.renommer).toHaveBeenCalledTimes(1)
})
