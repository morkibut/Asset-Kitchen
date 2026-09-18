import { act, cleanup, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react"
import { afterEach, expect, test, vi } from "vitest"
import { api, RECETTE_VIDE, UNIVERS_VIDE, type Asset, type EtatTraitement, type Recette } from "../api"
import { useRetoucheBrouillon } from "./RetoucheBrouillon"
import { Retouche } from "./Retouche"
import { MemoireDuParcours } from "./MemoireDuParcours"

afterEach(() => { cleanup(); localStorage.clear(); vi.restoreAllMocks(); vi.unstubAllGlobals() })
const depart = () => ({ identifiant: "sprite", projet: "jeu", label: "Pèlerin", empreinte: "initiale", largeur: 32, hauteur: 32, rendu_largeur: 32, rendu_hauteur: 32, recette: structuredClone(RECETTE_VIDE) }) as Asset
const rendre = (recette: Recette) => ({ recette: structuredClone(recette), rendu: "data:image/png;base64,YQ==", largeur: 32, hauteur: 32, mesures: { opaque: false, taches: [], poches: [], trous: [], crans_occupation: [] }, laisse: [] }) as unknown as Awaited<ReturnType<typeof api.apercuRecette>>
const nonDefaut = () => ({ ...RECETTE_VIDE, retournement: { sens: "gauche-droite" } }) as Recette

test("l’aperçu et le brouillon se rouvrent sans écrire puis la version enregistrée se relit", async () => {
  let disque = depart()
  vi.spyOn(api, "apercuRecette").mockImplementation(async (_id, recette) => rendre(recette))
  const sauver = vi.spyOn(api, "poserRecette").mockImplementation(async (_id, recette) => { disque = { ...disque, recette: structuredClone(recette) }; return disque })
  const erreur = vi.fn()
  let vue = renderHook(() => useRetoucheBrouillon(disque, erreur))
  await act(async () => { await vue.result.current.poser(nonDefaut()) })
  expect(sauver).not.toHaveBeenCalled()
  expect(disque.recette.retournement).toBeNull()
  await waitFor(() => expect(vue.result.current.brouillon.conserve).toBe(true))
  vue.unmount()
  vue = renderHook(() => useRetoucheBrouillon(disque, erreur))
  await waitFor(() => expect(vue.result.current.brouillon.candidat).toBeTruthy())
  expect(vue.result.current.recette.retournement).toBeNull()
  await act(async () => { vue.result.current.brouillon.reprendre() })
  await waitFor(() => expect(vue.result.current.valide).toBe(true))
  expect(vue.result.current.recette.retournement?.sens).toBe("gauche-droite")
  expect(sauver).not.toHaveBeenCalled()
  await act(async () => { await vue.result.current.enregistrer() })
  vue.unmount()
  vue = renderHook(() => useRetoucheBrouillon(disque, erreur))
  expect(vue.result.current.recette.retournement?.sens).toBe("gauche-droite")
  expect(vue.result.current.modifie).toBe(false)
  expect(erreur).not.toHaveBeenCalled()
})

test("une réponse périmée ne remplace pas le dernier aperçu et un refus garde le brouillon", async () => {
  const resolvers: ((v: ReturnType<typeof rendre>) => void)[] = []
  vi.spyOn(api, "apercuRecette").mockImplementation(() => new Promise((r) => resolvers.push(r)))
  const erreur = vi.fn(), disque = depart()
  const vue = renderHook(() => useRetoucheBrouillon(disque, erreur))
  act(() => { void vue.result.current.poser(nonDefaut()) })
  const derniere = { ...RECETTE_VIDE, retournement: { sens: "haut-bas" } } as Recette
  act(() => { void vue.result.current.poser(derniere) })
  await act(async () => { resolvers[1](rendre(derniere)) })
  await act(async () => { resolvers[0](rendre(nonDefaut())) })
  expect(vue.result.current.recette.retournement?.sens).toBe("haut-bas")
  vi.mocked(api.apercuRecette).mockRejectedValueOnce(new Error("rendu indisponible"))
  await act(async () => { await vue.result.current.poser(nonDefaut()) })
  expect(vue.result.current.valide).toBe(false)
  expect(vue.result.current.recette.retournement?.sens).toBe("gauche-droite")
  expect(erreur).toHaveBeenCalledWith("rendu indisponible")
  expect(vue.result.current.brouillon.conserve).toBe(true)
})

test("la vraie retouche peint un aperçu, demande comment quitter et conserve son brouillon", async () => {
  const disque = depart(), fermer = vi.fn()
  vi.spyOn(api, "apercuRecette").mockImplementation(async (_id, recette) => rendre(recette))
  vi.spyOn(api, "taches").mockResolvedValue(rendre(RECETTE_VIDE).mesures)
  const sauver = vi.spyOn(api, "poserRecette").mockResolvedValue(disque)
  vi.stubGlobal("PointerEvent", MouseEvent)
  HTMLElement.prototype.setPointerCapture = vi.fn()
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", "") }
  HTMLDialogElement.prototype.close = function () { this.removeAttribute("open") }
  render(<Retouche asset={disque} soeurs={[]} univers={UNIVERS_VIDE} traitement={{ moteurs: [], silhouettes: [], reductions: [], quantification: { raison: null } } as unknown as EtatTraitement} onFermer={fermer} onSoeur={vi.fn()} decoupe={() => null} onErreur={vi.fn()} />)
  fireEvent.change(screen.getByLabelText("Table de retouche"), { target: { value: "main" } })
  fireEvent.click(screen.getByRole("button", { name: /^ôter$/ }))
  const toile = document.querySelector("[data-toile-main]") as HTMLElement
  vi.spyOn(toile, "getBoundingClientRect").mockReturnValue({ left: 0, top: 0, width: 320, height: 320, right: 320, bottom: 320, x: 0, y: 0, toJSON() {} })
  fireEvent.pointerDown(toile, { button: 0, clientX: 125, clientY: 65, pointerId: 1 })
  fireEvent.pointerUp(toile, { pointerId: 1 })
  await waitFor(() => expect((screen.getByRole("button", { name: "Enregistrer ›" }) as HTMLButtonElement).disabled).toBe(false))
  expect(sauver).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole("button", { name: "‹ Ses images" }))
  expect(screen.getByRole("dialog", { name: "Quitter les retouches" })).toBeTruthy()
  expect(fermer).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole("button", { name: "Garder le brouillon et continuer" }))
  expect(fermer).toHaveBeenCalledOnce()
  expect(sauver).not.toHaveBeenCalled()
  expect(localStorage.getItem("asset-kitchen:brouillon:v1:retouche-explicite:jeu:sprite")).toContain('"points":[[12,6]]')
})

test("une retouche commencée pendant l’enregistrement reste un nouveau brouillon", async () => {
  const disque = depart()
  vi.spyOn(api, "apercuRecette").mockImplementation(async (_id, recette) => rendre(recette))
  let terminer!: (asset: Asset) => void
  const sauver = vi.spyOn(api, "poserRecette").mockImplementation(() => new Promise((resolve) => { terminer = resolve }))
  const vue = renderHook(() => useRetoucheBrouillon(disque, vi.fn()))
  await act(async () => { await vue.result.current.poser(nonDefaut()) })
  let fini!: Promise<boolean>
  act(() => { fini = vue.result.current.enregistrer(); void vue.result.current.enregistrer() })
  expect(sauver).toHaveBeenCalledOnce()
  const derniere = { ...RECETTE_VIDE, retournement: { sens: "haut-bas" } } as Recette
  await act(async () => { await vue.result.current.poser(derniere) })
  await act(async () => { terminer({ ...disque, recette: nonDefaut() }); await fini })
  expect(await fini).toBe(false)
  expect(vue.result.current.recette.retournement?.sens).toBe("haut-bas")
  expect(vue.result.current.modifie).toBe(true)
  expect(vue.result.current.brouillon.conserve).toBe(true)
})

test("revenir à l’image retrouve son panneau, son calque et son pinceau sans écrire la recette", () => {
  const disque = depart()
  disque.recette.main = { opacite: [], calques: [{ nom: "Cape", visible: true, passages: [] }] }
  vi.spyOn(api, "taches").mockResolvedValue(rendre(disque.recette).mesures)
  const sauver = vi.spyOn(api, "poserRecette")
  const apercu = vi.spyOn(api, "apercuRecette")
  const afficher = (ouvert: boolean) => <MemoireDuParcours>{ouvert && <Retouche asset={disque} soeurs={[]} univers={UNIVERS_VIDE} traitement={{ moteurs: [], silhouettes: [], reductions: [], quantification: { raison: null } } as unknown as EtatTraitement} onFermer={vi.fn()} onSoeur={vi.fn()} decoupe={() => null} onErreur={vi.fn()} />}</MemoireDuParcours>
  const vue = render(afficher(true))
  fireEvent.click(screen.getByRole("button", { name: "Calques" }))
  fireEvent.click(screen.getByRole("button", { name: "Choisir Cape" }))
  fireEvent.click(screen.getByRole("button", { name: "Retouche" }))
  fireEvent.change(screen.getByRole("slider", { name: "diamètre du pinceau" }), { target: { value: "9" } })
  fireEvent.click(screen.getByRole("button", { name: "Calques" }))
  vue.rerender(afficher(false))
  vue.rerender(afficher(true))
  expect(screen.getByRole("button", { name: "Calques" }).getAttribute("aria-pressed")).toBe("true")
  fireEvent.click(screen.getByRole("button", { name: "Retouche" }))
  expect(screen.getByText(/Cape · 0 passage/)).toBeTruthy()
  expect((screen.getByRole("slider", { name: "diamètre du pinceau" }) as HTMLInputElement).value).toBe("9")
  expect(sauver).not.toHaveBeenCalled()
  expect(apercu).not.toHaveBeenCalled()
})
