// MO6 · À l'import d'un graphe seul, l'atelier lit ce qu'il sait recevoir.
//
// Une zone, une image de fin, un nombre d'images : la lecture
// (`POST /workflow-profiles/read-graph`) **préremplit** les champs du
// formulaire — une proposition que l'auteur relit, jamais une liaison posée
// sans lui. Dans un fichier à part de `WorkflowsLocaux.mo3.test.tsx`, dont les
// essais tournent sans lecture (le formulaire reste entier sans elle).

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, expect, test, vi } from "vitest"
import { api } from "../api"
import { workflows, workflowsImportes, type LectureGraphe } from "../api-workflows"
import { ProfilsWorkflow } from "./WorkflowsLocaux"

vi.mock("../api-workflows", async () => {
  const reel = await vi.importActual<typeof import("../api-workflows")>("../api-workflows")
  return {
    ...reel,
    workflows: { lister: vi.fn(), importer: vi.fn(), diagnostiquer: vi.fn() },
    workflowsImportes: { lister: vi.fn(), lireGraphe: vi.fn(), relier: vi.fn() },
  }
})

const grapheZone = {
  "2": { class_type: "CLIPTextEncode", inputs: { text: "" } },
  "4": { class_type: "LoadImage", inputs: { image: "dessous.png" } },
  "6": { class_type: "LoadImage", inputs: { image: "zone.png" } },
  "7": { class_type: "ImageToMask", inputs: { image: ["6", 0], channel: "red" } },
  "8": { class_type: "SetLatentNoiseMask", inputs: { samples: ["5", 0], mask: ["7", 0] } },
  "11": { class_type: "SaveImage", inputs: { images: ["10", 0] } },
}
const lectureZone: LectureGraphe = {
  prompt: { noeud: "2", champ: "text" }, prompt_negatif: null, references: [{ noeud: "4", champ: "image" }],
  masque: { noeud: "6", champ: "image" }, image_de_fin: null, images: null, pas_images: null, cadence: null, duree: null,
  sortie: "11", remarques: [],
}

const grapheWan = {
  "1": { class_type: "CLIPTextEncode", inputs: { text: "" } },
  "6": { class_type: "LoadImage", inputs: { image: "depart.png" } },
  "9": { class_type: "LoadImage", inputs: { image: "fin.png" } },
  "3": { class_type: "WanFirstLastFrameToVideo", inputs: { start_image: ["6", 0], end_image: ["9", 0], positive: ["1", 0], length: 81 } },
  "5": { class_type: "SaveVideo", inputs: { video: ["3", 0] } },
}
const lectureWan: LectureGraphe = {
  prompt: { noeud: "1", champ: "text" }, prompt_negatif: null, references: [{ noeud: "6", champ: "image" }], masque: null,
  image_de_fin: { noeud: "9", champ: "image" }, images: { noeud: "3", champ: "length", valeur: 81 }, pas_images: 4,
  cadence: 16, duree: 5, sortie: "5", remarques: [],
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(workflows.lister).mockResolvedValue({ profils: [] })
  vi.mocked(workflows.importer).mockImplementation(async (p) => p as never)
  vi.spyOn(api, "rafraichirCatalogue").mockResolvedValue({} as never)
  vi.spyOn(api, "modelesVideo").mockResolvedValue({ modeles: [] } as never)
})
afterEach(() => { cleanup(); vi.restoreAllMocks() })

async function coller(graphe: object, onImporte = vi.fn()) {
  render(<ProfilsWorkflow onImage={vi.fn()} onImporte={onImporte} />)
  fireEvent.click(await screen.findByRole("button", { name: "Ajouter un workflow" }))
  fireEvent.change(screen.getByLabelText("Document du workflow"), { target: { value: JSON.stringify(graphe) } })
  await waitFor(() => expect(workflowsImportes.lireGraphe).toHaveBeenCalledWith(graphe))
  return onImporte
}

async function enregistrer() {
  fireEvent.change(screen.getByLabelText("Nom du workflow"), { target: { value: "Essai" } })
  fireEvent.click(screen.getByRole("button", { name: "Enregistrer le profil" }))
  await waitFor(() => expect(workflows.importer).toHaveBeenCalledOnce())
  return vi.mocked(workflows.importer).mock.calls[0][0] as { liaisons: Record<string, unknown>; durees: number[]; pas_images?: number; cadence: number }
}

test("un graphe de retouche préremplit la zone et l'image d'en dessous, et part comme un masque", async () => {
  vi.mocked(workflowsImportes.lireGraphe).mockResolvedValue(lectureZone)
  const onImporte = await coller(grapheZone)
  await waitFor(() => expect(screen.getByLabelText("Champ recevant la zone à repeindre (facultatif)")).toHaveValue("6/image"))
  expect(screen.getByLabelText("Champ recevant une référence (facultatif)")).toHaveValue("4/image")
  expect(screen.getByLabelText("Champ recevant le prompt")).toHaveValue("2/text")
  expect(screen.getByRole("note", { name: "Lu dans le graphe" })).toHaveTextContent("reçoit une zone à repeindre (nœud 6)")
  expect(screen.getByText(/se choisit dans « Repeindre »/)).toBeTruthy()
  const profil = await enregistrer()
  expect(profil.liaisons.masque).toEqual([{ noeud: "6", champ: "image" }])
  expect(profil.liaisons["reference:0"]).toEqual([{ noeud: "4", champ: "image" }])
  await waitFor(() => expect(onImporte).toHaveBeenCalledTimes(1))
})

test("une zone sans image d'en dessous ne s'enregistre pas, et le dit", async () => {
  vi.mocked(workflowsImportes.lireGraphe).mockResolvedValue({ ...lectureZone, references: [] })
  await coller(grapheZone)
  await waitFor(() => expect(screen.getByLabelText("Champ recevant la zone à repeindre (facultatif)")).toHaveValue("6/image"))
  fireEvent.change(screen.getByLabelText("Nom du workflow"), { target: { value: "Essai" } })
  expect(screen.getByRole("button", { name: "Enregistrer le profil" })).toBeDisabled()
  expect(screen.getByText(/choisis aussi le champ qui reçoit l’image d’en dessous/)).toBeTruthy()
})

test("un clip de Wan passe en vidéo, relie sa fin et son nombre d'images, et propose plusieurs durées", async () => {
  vi.mocked(workflowsImportes.lireGraphe).mockResolvedValue(lectureWan)
  await coller(grapheWan)
  await waitFor(() => expect(screen.getByLabelText("Ce qu’il produit")).toHaveValue("video"))
  expect(screen.getByLabelText("Champ recevant l’image de fin (facultatif)")).toHaveValue("9/image")
  expect(screen.getByLabelText("Champ recevant l’image de départ")).toHaveValue("6/image")
  expect(screen.getByLabelText("Champ recevant le nombre d’images (facultatif)")).toHaveValue("3/length")
  expect(screen.getByLabelText("Durées proposées")).toHaveValue("5")
  expect(screen.getByText(/arrondi au pas de 4/)).toBeTruthy()
  fireEvent.change(screen.getByLabelText("Durées proposées"), { target: { value: "3, 5" } })
  const profil = await enregistrer()
  expect(profil.liaisons.image_de_fin).toEqual([{ noeud: "9", champ: "image" }])
  expect(profil.liaisons.images).toEqual([{ noeud: "3", champ: "length" }])
  expect(profil.durees).toEqual([3, 5])
  expect(profil.pas_images).toBe(4)
  expect(profil.cadence).toBe(16)
})

test("ce que l'auteur a déjà choisi n'est jamais écrasé par la lecture", async () => {
  let lire: (l: LectureGraphe) => void = () => undefined
  vi.mocked(workflowsImportes.lireGraphe).mockReturnValue(new Promise((r) => { lire = r }))
  await coller(grapheWan)
  fireEvent.change(screen.getByLabelText("Ce qu’il produit"), { target: { value: "image" } })
  fireEvent.change(screen.getByLabelText("Champ recevant le prompt"), { target: { value: "3/length" } })
  lire(lectureWan)
  await waitFor(() => expect(screen.getByLabelText("Champ recevant la zone à repeindre (facultatif)")).toBeInTheDocument())
  expect(screen.getByLabelText("Ce qu’il produit")).toHaveValue("image")
  expect(screen.getByLabelText("Champ recevant le prompt")).toHaveValue("3/length")
})
