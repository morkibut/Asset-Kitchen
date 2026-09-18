// RP14 · La découpe se règle — une zone se nomme, se garde ou s'écarte, ses
// coordonnées se règlent au clavier, elle s'ajoute, se déplace, se
// redimensionne, le dernier geste se défait, et les sorties se relisent
// avant d'être créées. Le reste de l'écran (proposition, animation) est déjà
// mesuré par `SurfacesAtelier.test.tsx` et `DecoupeAnimation.test.tsx`.

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, expect, test, vi } from "vitest"
import { api, RECETTE_VIDE, type Asset, type Carte } from "../api"
import { EcranDecoupe } from "./Decoupe"

afterEach(() => { cleanup(); localStorage.clear(); vi.restoreAllMocks(); vi.unstubAllGlobals() })

const planche = () =>
  ({ identifiant: "planche", label: "planche", empreinte: "e", largeur: 100, hauteur: 100, recette: RECETTE_VIDE } as Asset)
const carte = () =>
  ({ identifiant: "carte", note: "", empreinte: "e", largeur: 100, hauteur: 100, officiel: false } as Carte)

const RECT = { left: 0, top: 0, width: 100, height: 100, right: 100, bottom: 100, x: 0, y: 0, toJSON() {} }

/** Une seule zone détectée, à un endroit qui laisse de la place pour la
 *  déplacer et la redimensionner sans toucher un bord. */
function poser(boites: number[][] = [[10, 10, 29, 29]]) {
  vi.spyOn(api, "decoupeProposee").mockResolvedValue({ boites } as never)
  const decouper = vi.spyOn(api, "decouper").mockResolvedValue({ decoupes: [] } as never)
  render(<EcranDecoupe
    sujet={{ famille: "planche", planche: planche(), onDecoupe: vi.fn() }}
    onFermer={vi.fn()} onFente={vi.fn()} />)
  return decouper
}

function preparerSurface() {
  vi.stubGlobal("PointerEvent", MouseEvent)
  HTMLElement.prototype.setPointerCapture = vi.fn()
  const surface = document.querySelector("[data-planche-decoupe]") as HTMLElement
  vi.spyOn(surface, "getBoundingClientRect").mockReturnValue(RECT)
  return surface
}

test("une zone se nomme, se garde ou s'écarte", async () => {
  poser()
  const nom = await screen.findByLabelText("Nom de la zone 1")
  expect(nom).toHaveValue("")
  expect(nom).toHaveAttribute("placeholder", "Image 1")
  fireEvent.change(nom, { target: { value: "tête du gobelin" } })
  expect(nom).toHaveValue("tête du gobelin")

  expect(await screen.findByRole("button", { name: "Extraire 1 image" })).toBeInTheDocument()
  fireEvent.click(screen.getByLabelText("Garder la zone 1"))
  expect(screen.getByLabelText("Garder la zone 1")).toHaveAttribute("aria-pressed", "false")
  // Écartée, elle ne compte plus dans ce qui sortira.
  expect(await screen.findByText("aucune zone gardée — coche « garder » sur au moins une")).toBeInTheDocument()
  expect(screen.getByRole("button", { name: "Extraire 0 image" })).toBeDisabled()
})

test("les coordonnées d'une zone se règlent au clavier", async () => {
  poser()
  fireEvent.click(await screen.findByRole("button", { name: "Régler" }))
  expect(await screen.findByLabelText("X")).toHaveValue(10)
  expect(screen.getByLabelText("Y")).toHaveValue(10)
  expect(screen.getByLabelText("Largeur")).toHaveValue(20)
  expect(screen.getByLabelText("Hauteur")).toHaveValue(20)

  fireEvent.change(screen.getByLabelText("Largeur"), { target: { value: "40" } })
  expect(screen.getByLabelText("Largeur")).toHaveValue(40)
  // La liste des zones montre la même mesure, tout de suite.
  expect(screen.getByText("40×20")).toBeInTheDocument()

  fireEvent.change(screen.getByLabelText("X"), { target: { value: "5" } })
  expect(screen.getByLabelText("X")).toHaveValue(5)
})

test("une zone s'ajoute avec + Zone", async () => {
  poser()
  await screen.findByLabelText("Nom de la zone 1")
  fireEvent.click(screen.getByRole("button", { name: "+ Zone" }))
  expect(await screen.findByLabelText("Nom de la zone 2")).toBeInTheDocument()
  expect(screen.getByRole("button", { name: "Extraire 2 images" })).toBeInTheDocument()
})

test("une zone se déplace en la glissant par son corps", async () => {
  poser()
  await screen.findByLabelText("Nom de la zone 1")
  const surface = preparerSurface()
  const corps = surface.querySelector('[data-zone="0"]') as HTMLElement
  fireEvent.pointerDown(corps, { button: 0, clientX: 15, clientY: 15 })
  fireEvent.pointerMove(surface, { clientX: 25, clientY: 25 })
  fireEvent.pointerUp(surface, { clientX: 25, clientY: 25 })

  expect(await screen.findByLabelText("X")).toHaveValue(20)
  expect(screen.getByLabelText("Y")).toHaveValue(20)
  // La taille ne bouge pas : c'est un déplacement, pas un redimensionnement.
  expect(screen.getByLabelText("Largeur")).toHaveValue(20)
})

test("une zone se redimensionne par son coin inférieur droit", async () => {
  poser()
  await screen.findByLabelText("Nom de la zone 1")
  const surface = preparerSurface()
  const poignee = surface.querySelector('[data-poignee="0"]') as HTMLElement
  fireEvent.pointerDown(poignee, { button: 0, clientX: 29, clientY: 29 })
  fireEvent.pointerMove(surface, { clientX: 50, clientY: 60 })
  fireEvent.pointerUp(surface, { clientX: 50, clientY: 60 })

  expect(await screen.findByLabelText("X")).toHaveValue(10)
  expect(screen.getByLabelText("Y")).toHaveValue(10)
  expect(screen.getByLabelText("Largeur")).toHaveValue(41)
  expect(screen.getByLabelText("Hauteur")).toHaveValue(51)
})

test("le dernier geste se défait", async () => {
  poser()
  await screen.findByLabelText("Nom de la zone 1")
  expect(screen.getByRole("button", { name: "Annuler le dernier réglage" })).toBeDisabled()

  fireEvent.click(screen.getByRole("button", { name: "+ Zone" }))
  await screen.findByLabelText("Nom de la zone 2")
  expect(screen.getByRole("button", { name: "Annuler le dernier réglage" })).toBeEnabled()

  fireEvent.click(screen.getByRole("button", { name: "Annuler le dernier réglage" }))
  await waitFor(() => expect(screen.queryByLabelText("Nom de la zone 2")).toBeNull())
  expect(screen.getByRole("button", { name: "Annuler le dernier réglage" })).toBeDisabled()
})

test("les sorties se relisent avant d'être créées, et une zone écartée n'en fait pas partie", async () => {
  const decouper = poser([[10, 10, 29, 29], [40, 10, 59, 29]])
  await screen.findByLabelText("Nom de la zone 2")
  fireEvent.change(screen.getByLabelText("Nom de la zone 1"), { target: { value: "tête" } })
  fireEvent.click(screen.getByLabelText("Garder la zone 2"))

  fireEvent.click(screen.getByRole("button", { name: "Extraire 1 image" }))
  const fenetre = await screen.findByRole("dialog", { name: "Découper une image" })
  expect(fenetre).toHaveTextContent("tête")
  expect(fenetre).toHaveTextContent("20 × 20 px")
  expect(decouper).not.toHaveBeenCalled()

  fireEvent.click(screen.getByRole("button", { name: "Créer ces résultats" }))
  await waitFor(() => expect(decouper).toHaveBeenCalledWith("planche", [[10, 10, 29, 29]], ["tête"]))
})

test("la relecture propose « ‹ Les zones » sans rien créer", async () => {
  const decouper = poser()
  await screen.findByLabelText("Nom de la zone 1")
  fireEvent.click(screen.getByRole("button", { name: "Extraire 1 image" }))
  await screen.findByRole("dialog", { name: "Découper une image" })
  fireEvent.click(screen.getByRole("button", { name: "‹ Les zones" }))
  expect(screen.queryByRole("dialog")).toBeNull()
  expect(decouper).not.toHaveBeenCalled()
})

test("découper une carte relit avant de créer, avec la réserve pour destination", async () => {
  vi.spyOn(api, "decoupeDeCarteProposee").mockResolvedValue({ boites: [[0, 0, 19, 19]] } as never)
  const decouperCarte = vi.spyOn(api, "decouperCarte").mockResolvedValue({
    carte: "carte", morceaux: [], retiree: null, univers: {} as never,
  } as never)
  render(<EcranDecoupe
    sujet={{ famille: "carte", carte: carte(), onDecoupe: vi.fn() }}
    onFermer={vi.fn()} onFente={vi.fn()} />)
  await screen.findByLabelText("Nom de la zone 1")
  fireEvent.click(screen.getByRole("button", { name: "Extraire 1 image" }))
  const fenetre = await screen.findByRole("dialog", { name: "Découper une image" })
  expect(fenetre).toHaveTextContent("la réserve")
  fireEvent.click(screen.getByRole("button", { name: "Créer ces résultats" }))
  await waitFor(() => expect(decouperCarte).toHaveBeenCalledWith("carte", [[0, 0, 19, 19]], false))
})

// ── P1c (V3.5) : refaire le découpage d'une planche ──────────────────────────
//
// La troisième famille de `SujetDecoupe` — mêmes rectangles, même relecture,
// mais la proposition vient de `depliagePropose` (jamais de `decoupeProposee`,
// jamais de mode à régler) et valider appelle `depliageRefaire`, pas
// `decouper`.

test("refaire un découpage : la proposition préremplit, sans détection à régler", async () => {
  vi.spyOn(api, "depliagePropose").mockResolvedValue({
    planche: "planche", generation: "g1", largeur: 100, hauteur: 100,
    boites: [[10, 10, 29, 29], [40, 10, 59, 29]], cases: [0, 1], depuis: "planche-d1",
    marge: 0, cases_de_la_planche: [], refaisable: true, raison: null,
  } as never)
  render(<EcranDecoupe
    sujet={{ famille: "depliage", planche: planche(), onDecoupe: vi.fn() }}
    onFermer={vi.fn()} onFente={vi.fn()} />)

  expect(await screen.findByLabelText("Nom de la zone 2")).toBeInTheDocument()
  // Aucun réglage de détection pour un dépliage refait — on repart des coupes
  // que le serveur propose déjà, jamais d'un mode.
  expect(screen.queryByText("Détection")).not.toBeInTheDocument()
})

test("refaire un découpage : valider envoie les coupes à depliageRefaire", async () => {
  vi.spyOn(api, "depliagePropose").mockResolvedValue({
    planche: "planche", generation: "g1", largeur: 100, hauteur: 100,
    boites: [[10, 10, 29, 29]], cases: [0], depuis: "planche-d1",
    marge: 0, cases_de_la_planche: [], refaisable: true, raison: null,
  } as never)
  const refaire = vi.spyOn(api, "depliageRefaire").mockResolvedValue({
    planche: "planche", depliage: {} as never, images: [{ identifiant: "planche-2" } as Asset],
  })
  const onDecoupe = vi.fn()
  render(<EcranDecoupe
    sujet={{ famille: "depliage", planche: planche(), onDecoupe }}
    onFermer={vi.fn()} onFente={vi.fn()} />)

  await screen.findByLabelText("Nom de la zone 1")
  fireEvent.click(screen.getByRole("button", { name: "Extraire 1 image" }))
  const fenetre = await screen.findByRole("dialog", { name: "Découper une image" })
  expect(fenetre).toHaveTextContent("un nouveau dépliage de la planche")
  fireEvent.click(screen.getByRole("button", { name: "Créer ces résultats" }))
  await waitFor(() => expect(refaire).toHaveBeenCalledWith("planche", [[10, 10, 29, 29]]))
  expect(onDecoupe).toHaveBeenCalledWith([{ identifiant: "planche-2" }])
})
