import { afterEach, expect, it, vi } from "vitest"
import { act, cleanup, renderHook } from "@testing-library/react"
import { api } from "./api"
import { usePaiement, type CeQueLePaiementLit } from "./paiement"
import { TRI_VIDE } from "./envoi"

afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks() })

function contexte(): CeQueLePaiementLit {
  // Même cible qu’une série dont l’auteur avait déjà sauté la confirmation.
  // C’est précisément l’état dans lequel un bouton nommé « Relire » payait.
  return {
    bibliotheque: { courant: "marais" }, cases: 0, chantier: [], setChantier: vi.fn(),
    cible: { personnage: "pelerin", poses: ["marche"] }, setCible: vi.fn(), directionsCible: [],
    ecarteesGeneration: null, setEcarteesGeneration: vi.fn(), echelle: "", echouer: vi.fn(),
    enPlanche: false, setEnvoi: vi.fn(), envoiOuvert: false, setEnvoiOuvert: vi.fn(),
    setEnPaiement: vi.fn(), paiementEnCours: { current: false }, intention: { current: null },
    liaison: true, modeles: [{ identifiant: "Essai:image", nom: "Image", refus: null, options: {} }],
    modele: { identifiant: "Essai:image", nom: "Image", refus: null, options: {} }, panne: null,
    options: {}, ouverture: { current: true }, posesCible: [{ identifiant: "marche", nom: "Marche" }],
    prompt: "Pèlerin en marche", promptNegatif: "", proportions: "1:1", reinjections: [], repris: false,
    serieSautee: "pelerin|marche|", setEchecDuPaiement: vi.fn(),
    tri: TRI_VIDE, setTri: vi.fn(), triDe: null, setTriDe: vi.fn(), univers: {}, variations: 1,
  } as unknown as CeQueLePaiementLit
}

it("Relire ouvre la confirmation même lorsque la série précédente la sautait", () => {
  const envoyer = vi.spyOn(api, "generer").mockImplementation(() => new Promise(() => {}))
  const c = contexte()
  const { result } = renderHook(() => usePaiement(c))
  act(() => result.current.generer(true))
  expect(c.setEnvoiOuvert).toHaveBeenCalledWith(true)
  expect(envoyer).not.toHaveBeenCalled()
  expect(c.paiementEnCours.current).toBe(false)
})

it("le même état déclenche bien l’ancien raccourci quand la relecture n’est pas demandée", () => {
  const envoyer = vi.spyOn(api, "generer").mockImplementation(() => new Promise(() => {}))
  const c = contexte()
  const { result } = renderHook(() => usePaiement(c))
  act(() => result.current.generer())
  expect(envoyer).toHaveBeenCalledOnce()
  expect(c.setEnvoiOuvert).not.toHaveBeenCalled()
})

it("attend l’envoi actualisé, même si la réponse d’une ancienne correction arrive entretemps", async () => {
  vi.useFakeTimers()
  const envoyer = vi.spyOn(api, "generer").mockImplementation(() => new Promise(() => {}))
  const reponses: Array<(v: Awaited<ReturnType<typeof api.envoi>>) => void> = []
  vi.spyOn(api, "envoi").mockImplementation(() => new Promise(resolve => reponses.push(resolve)))
  const c = { ...contexte(), envoiOuvert: true }
  const { result, rerender } = renderHook((courant) => usePaiement(courant), { initialProps: c })
  await act(async () => { await vi.runOnlyPendingTimersAsync() })
  expect(reponses).toHaveLength(1)
  expect(result.current.actualisationEnvoi).toBe(true)
  await act(async () => { await result.current.payer() })
  expect(envoyer).not.toHaveBeenCalled()

  rerender({ ...c, prompt: "Pèlerin avec une cape rouge" })
  await act(async () => { await vi.runOnlyPendingTimersAsync() })
  expect(reponses).toHaveLength(2)
  const ancien = { prompt: "ancienne demande" } as unknown as Awaited<ReturnType<typeof api.envoi>>
  const actuel = { prompt: "demande corrigée" } as unknown as Awaited<ReturnType<typeof api.envoi>>
  await act(async () => { reponses[0](ancien) })
  expect(c.setEnvoi).not.toHaveBeenCalled()
  expect(result.current.actualisationEnvoi).toBe(true)
  await act(async () => { await result.current.payer() })
  expect(envoyer).not.toHaveBeenCalled()

  await act(async () => { reponses[1](actuel) })
  expect(c.setEnvoi).toHaveBeenCalledWith(actuel)
  expect(result.current.actualisationEnvoi).toBe(false)
  act(() => { void result.current.payer() })
  expect(envoyer).toHaveBeenCalledOnce()
  expect(envoyer.mock.calls[0][0]).toMatchObject({ prompt: "Pèlerin avec une cape rouge" })
})

// **TS3** : `premiere_planche` part avec l'appel qui paie, et « Garder la
// mise en page » ne part jamais avec lui — les deux sont incompatibles
// (point 6 d'`AGENTS.md`).
it("la première planche part avec l'appel, et jamais avec « garder la mise en page »", async () => {
  const envoyer = vi.spyOn(api, "generer").mockImplementation(() => new Promise(() => {}))
  const c = {
    ...contexte(),
    cases: 0,
    posesCible: [],
    cible: { personnage: "pelerin", poses: [], direction: null, directions: ["sud", "nord"], premierePlanche: true },
    garderMiseEnPage: true,
  } as unknown as CeQueLePaiementLit
  const { result } = renderHook(() => usePaiement(c))
  act(() => { void result.current.payer() })
  expect(envoyer).toHaveBeenCalledOnce()
  expect(envoyer.mock.calls[0][0]).toMatchObject({ premiere_planche: true })
  expect(envoyer.mock.calls[0][0]).not.toHaveProperty("garder_mise_en_page")
})

it("la première planche part aussi avec l'écran de confirmation (« Relire avant l'envoi »)", async () => {
  vi.useFakeTimers()
  vi.spyOn(api, "generer").mockImplementation(() => new Promise(() => {}))
  const envoi = vi.spyOn(api, "envoi").mockImplementation(() => new Promise(() => {}))
  const c = {
    ...contexte(),
    cases: 0,
    posesCible: [],
    cible: { personnage: "pelerin", poses: [], direction: null, directions: ["sud", "nord"], premierePlanche: true },
    envoiOuvert: true,
  } as unknown as CeQueLePaiementLit
  renderHook(() => usePaiement(c))
  await act(async () => { await vi.runOnlyPendingTimersAsync() })
  expect(envoi).toHaveBeenCalledOnce()
  expect(envoi.mock.calls[0][0]).toMatchObject({ premiere_planche: true })
})
