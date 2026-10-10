// MO6 · « Les workflows importés » sur la page « Moteurs » — `fetch` doublé.
//
// Un workflow importé par l'auteur se montre comme un moteur : ce qu'il sait
// faire, où le retrouver, et **ce qui lui manque, élément par élément** — pas
// le seul « prêt / pas prêt ». Ce que son graphe saurait recevoir en plus se
// relie d'un geste, qui écrit une nouvelle version.

import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { afterEach, beforeEach, expect, test, vi } from "vitest"
import { api } from "../api"
import { workflowsImportes, type MoteurImporte } from "../api-workflows"
import { SectionWorkflowsImportes } from "./MoteursImportes"

vi.mock("../api-workflows", async () => {
  const reel = await vi.importActual<typeof import("../api-workflows")>("../api-workflows")
  return { ...reel, workflowsImportes: { lister: vi.fn(), lireGraphe: vi.fn(), relier: vi.fn() } }
})

const diagnosticPret = { disponible: true, problemes: [], noeuds: [], observe_le: 1000, adresse: "http://local", a_completer: [] }

const retouche: MoteurImporte = {
  identifiant: "retouche-maison", nom: "Retouche maison", nature: "image", description: "", modele: "ComfyUI:retouche-maison@v1",
  version: "v1", cree_le: 1000, versions: 1, references_min: 0, references_max: 0, durees: [], capacites: ["creer_image"],
  a_relier: [{ capacite: "repeindre_zone", reliable: true, texte: "Son graphe reçoit une zone à repeindre (nœud 6) : relie-la, et il repeindra une zone dans « Repeindre »." }],
  diagnostic: {
    disponible: false, observe_le: 1000, adresse: "http://local", noeuds: [],
    problemes: ["Nœud absent : ImageToMask (7).", "CheckpointLoaderSimple / ckpt_name : sdxl.safetensors est absent des choix installés."],
    a_completer: [
      { genre: "noeud", classe: "ImageToMask", noeuds: ["7"], texte: "Le nœud « ImageToMask » n'est pas installé dans ComfyUI : installe l'extension qui le fournit, puis redémarre ComfyUI." },
      { genre: "fichier", classe: "CheckpointLoaderSimple", noeuds: ["1"], champ: "ckpt_name", fichier: "sdxl.safetensors", texte: "Le fichier « sdxl.safetensors » n'est pas dans ComfyUI : pose-le dans le dossier de modèles qui convient." },
    ],
  },
}

const clip: MoteurImporte = {
  identifiant: "wan-maison", nom: "Wan maison", nature: "video", description: "", modele: "ComfyUI:wan-maison@v3",
  version: "v3", cree_le: 2000, versions: 3, references_min: 1, references_max: 1, durees: [3, 5], capacites: ["animer", "finir_sur_image"],
  a_relier: [], diagnostic: { ...diagnosticPret, fin_libre: false, remarques: ["Sans image de fin, ComfyUI refuserait ce graphe : « WanFirstLastFrameToVideo » exige « end_image »."] },
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(workflowsImportes.lister).mockResolvedValue({ moteurs: [retouche, clip] })
  vi.spyOn(api, "rafraichirCatalogue").mockResolvedValue({} as never)
})
afterEach(() => { cleanup(); vi.restoreAllMocks() })

test("un workflow à compléter dit chaque chose qui lui manque, en clair, jamais le problème brut", async () => {
  render(<SectionWorkflowsImportes />)
  const carte = (await screen.findByText("Retouche maison")).closest("article")!
  expect(carte).toHaveTextContent("À compléter")
  expect(carte).toHaveTextContent("Créer une image")
  expect(within(carte).getByText(/Le nœud « ImageToMask » n'est pas installé/)).toBeTruthy()
  expect(within(carte).getByText(/Le fichier « sdxl.safetensors »/)).toBeTruthy()
  expect(within(carte).queryByText("Nœud absent : ImageToMask (7).")).toBeNull()
})

test("un clip prêt dit où le retrouver, et qu'il finit toujours sur une image quand ComfyUI l'exige", async () => {
  render(<SectionWorkflowsImportes />)
  const carte = (await screen.findByText("Wan maison")).closest("article")!
  expect(carte).toHaveTextContent("Installé")
  expect(carte).toHaveTextContent("Animer une image")
  expect(carte).toHaveTextContent("Finit toujours sur une image")
  expect(carte).toHaveTextContent("3 s, 5 s")
  expect(carte).toHaveTextContent("3 versions gardées")
  expect(carte).toHaveTextContent("« Faire une vidéo libre » et « 4. Le clip »")
  expect(carte).toHaveTextContent("exige « end_image »")
  expect(within(carte).queryByRole("button", { name: "Relier ce que son graphe reçoit" })).toBeNull()
})

test("relier ce que le graphe reçoit écrit une version, relit le catalogue et prévient l'appelant", async () => {
  const relie = { ...retouche, version: "v2", versions: 2, capacites: ["repeindre_zone"] as MoteurImporte["capacites"], a_relier: [], diagnostic: diagnosticPret }
  vi.mocked(workflowsImportes.relier).mockResolvedValue({} as never)
  const onRelie = vi.fn()
  render(<SectionWorkflowsImportes onRelie={onRelie} />)
  const carte = (await screen.findByText("Retouche maison")).closest("article")!
  expect(carte).toHaveTextContent("Son graphe reçoit une zone à repeindre")
  vi.mocked(workflowsImportes.lister).mockResolvedValue({ moteurs: [relie, clip] })
  fireEvent.click(within(carte).getByRole("button", { name: "Relier ce que son graphe reçoit" }))
  await waitFor(() => expect(workflowsImportes.relier).toHaveBeenCalledWith("retouche-maison", "v1"))
  await waitFor(() => expect(onRelie).toHaveBeenCalledTimes(1))
  expect(api.rafraichirCatalogue).toHaveBeenCalled()
  const neuve = (await screen.findByText("Retouche maison")).closest("article")!
  await waitFor(() => expect(neuve).toHaveTextContent("Repeindre une zone"))
  expect(neuve).toHaveTextContent("se choisit dans « Repeindre »")
})

test("ComfyUI éteint se lit « Indisponible », et « Vérifier de nouveau » relit sans rien lancer", async () => {
  vi.mocked(workflowsImportes.lister).mockResolvedValue({ moteurs: [{ ...retouche, a_relier: [], diagnostic: {
    disponible: false, problemes: ["ConnectError"], noeuds: [], observe_le: 1000, adresse: "http://local",
    a_completer: [{ genre: "comfyui", texte: "ComfyUI ne répond pas : lance-le, puis vérifie de nouveau." }] } }] })
  render(<SectionWorkflowsImportes />)
  const carte = (await screen.findByText("Retouche maison")).closest("article")!
  expect(carte).toHaveTextContent("Indisponible")
  expect(carte).toHaveTextContent("ComfyUI ne répond pas")
  fireEvent.click(within(carte).getByRole("button", { name: "Vérifier de nouveau" }))
  await waitFor(() => expect(workflowsImportes.lister).toHaveBeenCalledTimes(2))
  expect(workflowsImportes.relier).not.toHaveBeenCalled()
})

test("sans workflow importé, la section dit où en importer un", async () => {
  vi.mocked(workflowsImportes.lister).mockResolvedValue({ moteurs: [] })
  render(<SectionWorkflowsImportes />)
  await screen.findByText(/Aucun workflow importé pour l’instant/)
})

test("une version importée plus bas se montre sans recharger la page", async () => {
  const { rerender } = render(<SectionWorkflowsImportes actualiserSur={0} />)
  await screen.findByText("Retouche maison")
  expect(workflowsImportes.lister).toHaveBeenCalledTimes(1)
  rerender(<SectionWorkflowsImportes actualiserSur={1} />)
  await waitFor(() => expect(workflowsImportes.lister).toHaveBeenCalledTimes(2))
})
