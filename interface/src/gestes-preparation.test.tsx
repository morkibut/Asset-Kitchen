import { afterEach, expect, it, vi } from "vitest"
import { act, cleanup, renderHook } from "@testing-library/react"
import { api, type Asset } from "./api"
import { useGestes, type CeQueLesGestesLisent } from "./gestes"

afterEach(() => { cleanup(); vi.restoreAllMocks() })

function contexte(ouvrirPreparation: ReturnType<typeof vi.fn>) {
  return {
    bibliotheque: { courant: "jeu" }, cible: null,
    echouer: vi.fn(), relireProduction: vi.fn(async () => {}),
    setCible: vi.fn(), setModeleChoisi: vi.fn(),
    poserLaRacine: vi.fn(), ouvrirPreparation, setOptions: vi.fn(),
    setPrompt: vi.fn(), setPromptNegatif: vi.fn(), setProportions: vi.fn(),
    setProvenance: vi.fn(), setReinjections: vi.fn(), setRepris: vi.fn(),
    setTri: vi.fn(), setVariations: vi.fn(),
  } as unknown as CeQueLesGestesLisent
}

const asset = { identifiant: "asset-1", generation: "generation-1" } as Asset

it("réinjecte dans le contexte et attend la génération avant d'ouvrir la préparation", async () => {
  const ouvrirPreparation = vi.fn()
  const generation = vi.spyOn(api, "generation")
  let resoudre!: (valeur: Awaited<ReturnType<typeof api.generation>>) => void
  generation.mockReturnValue(new Promise(resolve => { resoudre = resolve }))
  const c = contexte(ouvrirPreparation)
  const { result } = renderHook(() => useGestes(c))

  act(() => result.current.reinjecter(asset.identifiant, "reference"))
  expect(c.setReinjections).toHaveBeenCalledWith(expect.any(Function))
  expect(ouvrirPreparation).toHaveBeenCalledOnce()
  expect(c.poserLaRacine).not.toHaveBeenCalled()

  act(() => { void result.current.reprendreReglages(asset) })
  expect(generation).toHaveBeenCalledWith("generation-1")
  expect(ouvrirPreparation).toHaveBeenCalledOnce()

  await act(async () => {
    resoudre({ demande: { prompt: "prompt repris", prompt_negatif: "sans", proportions: "4:3", variations: 3, options: { seed: 12 } }, modele: "Essai:image" } as unknown as Awaited<ReturnType<typeof api.generation>>)
    await Promise.resolve()
  })
  expect(c.setPrompt).toHaveBeenCalledWith("prompt repris")
  expect(c.setPromptNegatif).toHaveBeenCalledWith("sans")
  expect(c.setProportions).toHaveBeenCalledWith("4:3")
  expect(c.setVariations).toHaveBeenCalledWith(3)
  expect(c.setOptions).toHaveBeenCalledWith({ seed: "12" })
  expect(c.setModeleChoisi).toHaveBeenCalledWith("Essai:image")
  expect(ouvrirPreparation).toHaveBeenCalledTimes(2)
})
