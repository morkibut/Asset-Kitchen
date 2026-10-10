// MO3 · Un workflow vidéo importé peut dire qu'il sait finir sur une image.
//
// Sans ce champ, l'auteur qui colle un graphe « première et dernière image »
// n'avait aucun moyen, depuis l'écran, de relier l'image de fin : la capacité
// existait au serveur et nulle part à l'écran (AGENTS 8nonies). Dans un fichier
// à part de `WorkflowsLocaux.test.tsx`, que le son (MO4) touche en parallèle.

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, expect, test, vi } from "vitest"
import { api } from "../api"
import { workflows } from "../api-workflows"
import { ProfilsWorkflow } from "./WorkflowsLocaux"

vi.mock("../api-workflows", async () => {
  const reel = await vi.importActual<typeof import("../api-workflows")>("../api-workflows")
  return { ...reel, workflows: { lister: vi.fn(), importer: vi.fn(), diagnostiquer: vi.fn() } }
})

// Le format API de ComfyUI, tel qu'on le colle : aucun profil autour.
const graphe = {
  "1": { class_type: "CLIPTextEncode", inputs: { text: "" } },
  "6": { class_type: "LoadImage", inputs: { image: "depart.png" } },
  "9": { class_type: "LoadImage", inputs: { image: "fin.png" } },
  "3": { class_type: "WanFirstLastFrameToVideo", inputs: { start_image: ["6", 0], end_image: ["9", 0], positive: ["1", 0] } },
  "5": { class_type: "SaveVideo", inputs: { images: ["3", 0] } },
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(workflows.lister).mockResolvedValue({ profils: [] })
  vi.mocked(workflows.importer).mockImplementation(async (p) => p as never)
  vi.spyOn(api, "rafraichirCatalogue").mockResolvedValue({} as never)
  vi.spyOn(api, "modelesVideo").mockResolvedValue({ modeles: [] } as never)
})
afterEach(() => { cleanup(); vi.restoreAllMocks() })

async function configurer(nature: "video" | "image", fin?: string) {
  render(<ProfilsWorkflow onImage={vi.fn()} />)
  fireEvent.click(await screen.findByRole("button", { name: "Ajouter un workflow" }))
  fireEvent.change(screen.getByLabelText("Document du workflow"), { target: { value: JSON.stringify(graphe) } })
  fireEvent.change(screen.getByLabelText("Nom du workflow"), { target: { value: "Première et dernière image" } })
  fireEvent.change(screen.getByLabelText("Ce qu’il produit"), { target: { value: nature } })
  fireEvent.change(screen.getByLabelText("Champ recevant le prompt"), { target: { value: "1/text" } })
  if (nature === "video") fireEvent.change(screen.getByLabelText("Champ recevant l’image de départ"), { target: { value: "6/image" } })
  if (fin) fireEvent.change(screen.getByLabelText("Champ recevant l’image de fin (facultatif)"), { target: { value: fin } })
  fireEvent.change(screen.getByLabelText("Nœud qui enregistre le résultat"), { target: { value: "5" } })
  fireEvent.click(screen.getByRole("button", { name: "Enregistrer le profil" }))
  await waitFor(() => expect(workflows.importer).toHaveBeenCalledOnce())
  return vi.mocked(workflows.importer).mock.calls[0][0] as { liaisons: Record<string, unknown> }
}

test("le champ de l'image de fin se relie, et part comme une liaison du profil", async () => {
  const profil = await configurer("video", "9/image")
  expect(profil.liaisons.image_de_fin).toEqual([{ noeud: "9", champ: "image" }])
  expect(profil.liaisons["reference:0"]).toEqual([{ noeud: "6", champ: "image" }])
})

test("laissé vide, rien ne change au profil d'avant", async () => {
  const profil = await configurer("video")
  expect(profil.liaisons).not.toHaveProperty("image_de_fin")
})

test("une image n'a pas d'image de fin à relier", async () => {
  render(<ProfilsWorkflow onImage={vi.fn()} />)
  fireEvent.click(await screen.findByRole("button", { name: "Ajouter un workflow" }))
  fireEvent.change(screen.getByLabelText("Document du workflow"), { target: { value: JSON.stringify(graphe) } })
  expect(screen.queryByLabelText("Champ recevant l’image de fin (facultatif)")).toBeNull()
  fireEvent.change(screen.getByLabelText("Ce qu’il produit"), { target: { value: "video" } })
  expect(screen.getByLabelText("Champ recevant l’image de fin (facultatif)")).toBeInTheDocument()
})
