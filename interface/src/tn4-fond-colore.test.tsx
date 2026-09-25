// « Refaire sur fond coloré » (TN4, `docs/PLAN-transparence-native.md`) : ce
// que le geste de la fiche arme, et le chemin par lequel l'appel part.
//
// **Le geste ne paie pas** : il reprend les réglages de la génération, coche
// « Sur fond coloré » et ouvre la préparation. **L'appel part par le chemin de
// tous les autres** : l'écran qui relit avant l'envoi (`api.envoi`, qui annonce
// le prix ou le temps) reçoit le drapeau, puis l'appel qui paie (`api.generer`).

import { afterEach, expect, it, vi } from "vitest"
import { act, cleanup, renderHook } from "@testing-library/react"
import { api, type Asset } from "./api"
import { useGestes, type CeQueLesGestesLisent } from "./gestes"
import { usePaiement, type CeQueLePaiementLit } from "./paiement"
import { TRI_VIDE } from "./envoi"

afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks() })

const LE_MAGE = { identifiant: "mage-0", generation: "mage" } as Asset
const TEXTE_PARTI =
  "This is an RGBA format image with transparency.\n\nREQUEST\n\nun mage.\n\nThe image has an alpha channel and a transparent background."

function gestes(ouvrirPreparation: ReturnType<typeof vi.fn>) {
  return {
    bibliotheque: { courant: "jeu" }, cible: null,
    echouer: vi.fn(), relireProduction: vi.fn(async () => {}),
    setCible: vi.fn(), setModeleChoisi: vi.fn(),
    poserLaRacine: vi.fn(), ouvrirPreparation, setGarderMiseEnPage: vi.fn(),
    setFondColore: vi.fn(), setOptions: vi.fn(),
    setPrompt: vi.fn(), setPromptNegatif: vi.fn(), setProportions: vi.fn(),
    setProvenance: vi.fn(), setReinjections: vi.fn(), setRepris: vi.fn(),
    setTri: vi.fn(), setVariations: vi.fn(),
  } as unknown as CeQueLesGestesLisent
}

const generationDuMage = (demande: Record<string, unknown> = {}) =>
  ({
    demande: {
      prompt: TEXTE_PARTI, prompt_negatif: "", proportions: "1:1", variations: 1,
      options: {}, transparence: true, ...demande,
    },
    modele: "ComfyUI:qwen-image-21@v1",
  }) as unknown as Awaited<ReturnType<typeof api.generation>>

it("le geste reprend les réglages, coche le fond coloré et ne paie rien", async () => {
  vi.spyOn(api, "generation").mockResolvedValue(generationDuMage())
  const payer = vi.spyOn(api, "generer")
  const ouvrirPreparation = vi.fn()
  const c = gestes(ouvrirPreparation)
  const { result } = renderHook(() => useGestes(c))

  await act(async () => { await result.current.reprendreReglages(LE_MAGE, { fondColore: true }) })

  expect(c.setFondColore).toHaveBeenCalledWith(true)
  expect(c.setPrompt).toHaveBeenCalledWith(TEXTE_PARTI)
  expect(c.setRepris).toHaveBeenCalledWith(true)
  expect(c.setModeleChoisi).toHaveBeenCalledWith("ComfyUI:qwen-image-21@v1")
  expect(ouvrirPreparation).toHaveBeenCalledOnce()
  expect(payer).not.toHaveBeenCalled()
})

it("reprendre les réglages tout court décoche le fond coloré — sauf s'il était parti", async () => {
  const generation = vi.spyOn(api, "generation").mockResolvedValue(generationDuMage())
  const c = gestes(vi.fn())
  const { result } = renderHook(() => useGestes(c))

  await act(async () => { await result.current.reprendreReglages(LE_MAGE) })
  expect(c.setFondColore).toHaveBeenLastCalledWith(false)

  generation.mockResolvedValue(generationDuMage({ transparence: undefined, fond_colore: true }))
  await act(async () => { await result.current.reprendreReglages(LE_MAGE) })
  expect(c.setFondColore).toHaveBeenLastCalledWith(true)
})

function paiement(fondColore: boolean): CeQueLePaiementLit {
  return {
    bibliotheque: { courant: "jeu" }, cases: 0, chantier: [], setChantier: vi.fn(),
    cible: null, setCible: vi.fn(), directionsCible: [],
    ecarteesGeneration: null, setEcarteesGeneration: vi.fn(), echelle: "", echouer: vi.fn(),
    enPlanche: false, setEnvoi: vi.fn(), envoiOuvert: true, setEnvoiOuvert: vi.fn(),
    setEnPaiement: vi.fn(), paiementEnCours: { current: false }, intention: { current: null },
    liaison: true, modeles: [{ identifiant: "Essai:image", nom: "Image", refus: null, options: {} }],
    modele: { identifiant: "Essai:image", nom: "Image", refus: null, options: {} }, panne: null,
    options: {}, ouverture: { current: true }, posesCible: [],
    prompt: TEXTE_PARTI, promptNegatif: "", proportions: "1:1", reinjections: [], repris: true,
    serieSautee: null, setEchecDuPaiement: vi.fn(),
    tri: TRI_VIDE, setTri: vi.fn(), triDe: null, setTriDe: vi.fn(), univers: {}, variations: 1,
    garderMiseEnPage: false, setGarderMiseEnPage: vi.fn(),
    fondColore, setFondColore: vi.fn(),
  } as unknown as CeQueLePaiementLit
}

it("l'écran qui relit avant l'envoi reçoit le fond coloré — c'est lui qui annonce le prix", async () => {
  vi.useFakeTimers()
  const envoi = vi.spyOn(api, "envoi").mockImplementation(() => new Promise(() => {}))
  renderHook(() => usePaiement(paiement(true)))
  await act(async () => { await vi.runOnlyPendingTimersAsync() })
  expect(envoi).toHaveBeenCalledOnce()
  expect(envoi.mock.calls[0][0]).toMatchObject({ fond_colore: true, repris: true })
})

it("l'appel qui paie le porte, puis le drapeau retombe : c'était l'intention de cet appel-là", async () => {
  const appel = { identifiant: "refait", emplacements: [] } as unknown as Awaited<ReturnType<typeof api.generer>>
  const envoyer = vi.spyOn(api, "generer").mockResolvedValue(appel)
  vi.spyOn(api, "envoi").mockImplementation(() => new Promise(() => {}))
  const c = { ...paiement(true), envoiOuvert: false }
  const { result } = renderHook(() => usePaiement(c))
  await act(async () => { await result.current.payer() })
  expect(envoyer).toHaveBeenCalledOnce()
  expect(envoyer.mock.calls[0][0]).toMatchObject({ fond_colore: true })
  expect(c.setFondColore).toHaveBeenCalledWith(false)
})

it("sans le geste, le corps d'un appel reste celui d'avant", async () => {
  const envoyer = vi.spyOn(api, "generer").mockImplementation(() => new Promise(() => {}))
  vi.spyOn(api, "envoi").mockImplementation(() => new Promise(() => {}))
  const { result } = renderHook(() => usePaiement({ ...paiement(false), envoiOuvert: false }))
  act(() => { void result.current.payer() })
  expect(envoyer.mock.calls[0][0]).not.toHaveProperty("fond_colore")
})
