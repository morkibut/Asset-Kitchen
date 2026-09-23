import { afterEach, expect, it, vi } from "vitest"
import { act, cleanup, renderHook } from "@testing-library/react"
import { api, type Asset, type Personnage, type PremierePlanche } from "./api"
import { useGestes, type CeQueLesGestesLisent } from "./gestes"

afterEach(() => { cleanup(); vi.restoreAllMocks() })

function contexte(ouvrirPreparation: ReturnType<typeof vi.fn>) {
  return {
    bibliotheque: { courant: "jeu" }, cible: null,
    echouer: vi.fn(), relireProduction: vi.fn(async () => {}),
    setCible: vi.fn(), setModeleChoisi: vi.fn(),
    poserLaRacine: vi.fn(), ouvrirPreparation, setGarderMiseEnPage: vi.fn(), setOptions: vi.fn(),
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
  expect(c.setGarderMiseEnPage).toHaveBeenCalledWith(false)
  expect(ouvrirPreparation).toHaveBeenCalledTimes(2)
})

// **TS3** : « Faire la planche des directions » arme la cible avec le
// drapeau `premierePlanche`, les images du concept art en référence, et
// ouvre la préparation — rien n'est facturé ici.
it("arme la planche des directions avec ce que le serveur a rendu", async () => {
  const sujet = vi.spyOn(api, "sujetDeCase").mockResolvedValue({ sujet: "un pèlerin en capuche" })
  const ouvrirPreparation = vi.fn()
  const c = contexte(ouvrirPreparation)
  const { result } = renderHook(() => useGestes(c))

  const personnage = { identifiant: "pelerin" } as Personnage
  const reponse: PremierePlanche = {
    personnage: "pelerin",
    pose: "repos",
    pose_nom: "repos",
    directions: ["sud", "nord"],
    directions_noms: ["sud", "nord"],
    design: [{ asset: "concept-1", role: "reference", origine: "asset", usage: "design" }],
  }

  await act(async () => { await result.current.armerPremierePlanche(personnage, reponse) })

  expect(c.setCible).toHaveBeenCalledWith({
    personnage: "pelerin",
    poses: ["repos"],
    piece: null,
    direction: null,
    directions: ["sud", "nord"],
    premierePlanche: true,
  })
  // **TS11** : l'origine voyage avec l'image, et le champ reçoit le signalement.
  expect(c.setReinjections).toHaveBeenCalledWith([{ asset: "concept-1", role: "reference", origine: "asset" }])
  expect(sujet).toHaveBeenCalledWith({ personnage: "pelerin", piece: null, projet: "jeu" })
  expect(c.setPrompt).toHaveBeenLastCalledWith("un pèlerin en capuche")
  expect(c.setGarderMiseEnPage).toHaveBeenCalledWith(false)
  expect(c.setRepris).toHaveBeenCalledWith(false)
  expect(ouvrirPreparation).toHaveBeenCalledOnce()
})
