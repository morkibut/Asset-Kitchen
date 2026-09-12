import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, expect, test, vi } from "vitest"
import { api, POSE_VIDE, RECETTE_VIDE, type Asset } from "../api"
import { SourceDeFrame } from "./SourceDeFrame"
import { EcranSuperposition } from "./Superposition"
import { BibliothequePourImage } from "./BibliothequePourImage"

afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals() })
const image = (id: string) => ({ identifiant: id, label: id, empreinte: id, largeur: 64, hauteur: 64, recette: RECETTE_VIDE } as Asset)
const boite = { left: 0, top: 0, width: 640, height: 640, right: 640, bottom: 640, x: 0, y: 0, toJSON() {} }

test("la pipette d’une frame vise le pixel source malgré la réduction de la bande", async () => {
  vi.stubGlobal("Image", class { naturalWidth = 640; naturalHeight = 320; onload?: () => void; set src(_s: string) { queueMicrotask(() => this.onload?.()) } })
  const garder = vi.fn(), fermer = vi.fn()
  const recette = { ...RECETTE_VIDE, passes: [{ moteur: "couleur", point: null, trace: [] }] } as never
  render(<SourceDeFrame source="/api/clips/source/frames/8" recette={recette} passe={0} rectangle={false} onRecette={garder} onFermer={fermer} />)
  await screen.findByLabelText("Zoom de la source de frame")
  const surface = document.querySelector("[data-pipette]") as HTMLElement
  vi.spyOn(surface, "getBoundingClientRect").mockReturnValue({ ...boite, width: 320, height: 160 })
  fireEvent.click(surface, { clientX: 100, clientY: 40 })
  expect(garder.mock.calls[0][0].passes[0].point).toEqual([200, 80])
  expect(fermer).toHaveBeenCalledOnce()
  expect(screen.getByAltText("Source de la frame").getAttribute("src")).toBe("/api/clips/source/frames/8")
})

test("la bibliothèque cherche au-delà des voisines et combine les filtres", async () => {
  vi.spyOn(api, "arbre").mockResolvedValue({ collections: [{ identifiant: "objets", nom: "Objets" }] } as never)
  const charger = vi.spyOn(api, "assets").mockResolvedValue({ assets: [image("casque")], total: 1 })
  const choisir = vi.fn()
  render(<BibliothequePourImage voisines={[image("corps")]} onChoisir={choisir} onFermer={vi.fn()} />)
  await screen.findByRole("button", { name: "Choisir casque" })
  fireEvent.change(screen.getByLabelText("Rechercher une image"), { target: { value: "casque" } })
  fireEvent.change(screen.getByLabelText("Collection des images"), { target: { value: "objets" } })
  fireEvent.click(screen.getByLabelText("Favoris"))
  await waitFor(() => expect(charger).toHaveBeenLastCalledWith({ recherche: "casque", collection: "objets", favoris: true, limite: 60 }))
  fireEvent.click(screen.getByRole("button", { name: "Choisir casque" }))
  expect(choisir).toHaveBeenCalledWith(image("casque"))
})

test("l’extraction déplace le dessus au zoom courant puis sauvegarde un vrai masque", async () => {
  const pose = { ...POSE_VIDE, dessus: "haut", dessous: "bas", dx: 3, dy: -2 }
  vi.spyOn(api, "ouvrirSuperposition").mockResolvedValue({ dessus: image("haut"), dessous: image("bas"), pose, passes_dessous: 1, passes_dessus: 1 } as never)
  const apercu = vi.spyOn(api, "apercuSuperposition").mockResolvedValue({ calque: "data:image/png;base64,AA", aplat: "data:image/png;base64,AA", cadrage: { ramene: false }, mesures: { ajout: 0, silhouette: 1, repeint: 0, echelle: 1, compacite: 1 } } as never)
  const fabriquer = vi.spyOn(api, "fabriquerSuperposition").mockResolvedValue({ superpositions: [] })
  vi.stubGlobal("PointerEvent", MouseEvent); HTMLElement.prototype.setPointerCapture = vi.fn()
  render(<EcranSuperposition asset={image("haut")} soeurs={[]} onErreur={vi.fn()} />)
  await waitFor(() => expect(apercu).toHaveBeenCalled())
  const surface = document.querySelector("[data-cadre-superposition]") as HTMLElement
  vi.spyOn(surface, "getBoundingClientRect").mockReturnValue(boite)
  fireEvent.pointerDown(surface, { button: 0, clientX: 100, clientY: 100 })
  fireEvent.pointerMove(surface, { clientX: 130, clientY: 120 })
  fireEvent.pointerUp(surface)
  expect((screen.getByLabelText("horizontal, en chiffres") as HTMLInputElement).value).toBe("6")
  expect((screen.getByLabelText("vertical, en chiffres") as HTMLInputElement).value).toBe("0")
  fireEvent.click(screen.getByRole("button", { name: /^Retirer$/ }))
  fireEvent.pointerMove(surface, { clientX: 205, clientY: 105 })
  expect(document.querySelector("[data-pinceau-extraction]")).toBeTruthy()
  fireEvent.pointerDown(surface, { button: 0, clientX: 205, clientY: 105 })
  fireEvent.pointerMove(surface, { clientX: 215, clientY: 105 })
  fireEvent.pointerUp(surface)
  fireEvent.click(screen.getByRole("button", { name: /Fabriquer —/ }))
  await waitFor(() => expect(fabriquer).toHaveBeenCalledOnce())
  expect(fabriquer.mock.calls[0][0]).toMatchObject({ dx: 6, dy: 0, main: [{ garde: false, rayon: 2, points: [[20, 10], [21, 10]] }] })
  expect(apercu.mock.calls.at(-1)?.[0].main).toHaveLength(1)
})
