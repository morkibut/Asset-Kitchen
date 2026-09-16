import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, expect, test, vi } from "vitest"
import { FabricationAudio } from "./FabricationAudio"
import { SuiviDesTravaux, TravailConserve } from "./FabricationSuivie"
import { travauxAudio, type TravailAudio } from "../api-travaux-audio"
import { travaux } from "../api-travaux"
import { workflows, type ProfilWorkflow } from "../api-workflows"

vi.mock("../api-travaux-audio", () => ({ travauxAudio: { preparer: vi.fn(), lire: vi.fn(), lancer: vi.fn() } }))
vi.mock("../api-workflows", () => ({ workflows: { lister: vi.fn() } }))
const profil: ProfilWorkflow = {
  identifiant: "bruitage", nom: "Bruitages locaux", nature: "audio", version: "exacte", modele: "ComfyUI:bruitage@exacte",
  cree_le: 1000, description: "", graphe: {}, liaisons: { prompt: [], prompt_negatif: [], secondes: [] },
  parametres: { seed: { nom: "Graine", genre: "intervalle", minimum: 0, maximum: 999, defaut: 42 } },
  formats: [], durees: [1, 2.5], cadence: 0, references_min: 0, references_max: 0, sortie: { noeud: "5", champ: "audio" },
}
const t: TravailAudio = {
  nature: "audio", identifiant: "conserve", projet: "jeu", cle: "cle", acteur: "auteur", etat: "prepare", etape: "relecture", cree_le: 1000,
  demande: { cle: "cle", modele: profil.modele, prompt: "Une lame quitte le cuir.", prompt_negatif: "Sans voix", nom: "Épée divine", secondes: 2.5, options: { seed: 357 } },
  snapshot_audio: { prompt: "Une lame quitte le cuir.", prompt_negatif: "Sans voix", secondes: 2.5, options: { seed: 357 } },
  son: null, reference_asset: null, clip: null, bandes: [], references: [], consommations: [], prochaine_action: "demarrer",
  annonce: { appels: 1, reservation_usd: 0, limite: "Calcul local. Le temps demandé est celui du son.", mesures: [] },
}

beforeEach(() => {
  vi.restoreAllMocks(); vi.clearAllMocks(); localStorage.clear()
  vi.mocked(workflows.lister).mockResolvedValue({ profils: [profil] })
  vi.mocked(travauxAudio.preparer).mockResolvedValue(t)
  vi.mocked(travauxAudio.lire).mockResolvedValue(t)
  vi.mocked(travauxAudio.lancer).mockResolvedValue({ ...t, etat: "termine", son: "son-recu" })
})
afterEach(() => { cleanup(); vi.restoreAllMocks() })

test("les réglages sonores se relisent exactement avant tout calcul et le résultat ouvre son atelier", async () => {
  const gestes: string[] = []
  render(<FabricationAudio projet="jeu" onFermer={() => gestes.push("fermer")} onSon={id => gestes.push(id)} />)
  await screen.findByRole("option", { name: /Bruitages locaux/ })
  fireEvent.change(screen.getByLabelText("Workflow sonore"), { target: { value: profil.modele } })
  fireEvent.change(screen.getByLabelText("Nom du bruitage"), { target: { value: "Épée divine" } })
  fireEvent.change(screen.getByLabelText("Description sonore exacte"), { target: { value: t.demande.prompt } })
  fireEvent.change(screen.getByLabelText("Son à éviter"), { target: { value: "Sans voix" } })
  fireEvent.change(screen.getByLabelText("Durée du bruitage"), { target: { value: "2.5" } })
  fireEvent.change(screen.getByLabelText("Graine"), { target: { value: "357" } })
  fireEvent.click(screen.getByRole("button", { name: "Relire avant l’envoi" }))
  await screen.findByRole("button", { name: "Lancer ce calcul local" })
  expect(travauxAudio.preparer).toHaveBeenCalledWith("jeu", expect.objectContaining({ nom: "Épée divine", secondes: 2.5, options: { seed: 357 }, prompt_negatif: "Sans voix" }))
  expect(travauxAudio.lancer).not.toHaveBeenCalled()
  expect(screen.getByText("Temps de calcul encore inconnu pour ce workflow sur cette machine.")).toBeInTheDocument()
  expect(screen.getByText("357")).toBeInTheDocument()
  fireEvent.click(screen.getByRole("button", { name: "Lancer ce calcul local" }))
  fireEvent.click(await screen.findByRole("button", { name: "Écouter et retoucher le son reçu" }))
  expect(gestes).toEqual(["fermer", "son-recu"])
})

test("une fabrication rouverte suit le travail sonore conservé et un son invalide reste accessible", async () => {
  vi.mocked(travauxAudio.lire).mockResolvedValue({ ...t, etat: "a_verifier", son: "a-verifier", raison: "Le fichier est silencieux." })
  vi.spyOn(travaux, "lireSuivi").mockResolvedValue({ ...t, etat: "a_verifier", son: "a-verifier" })
  const onSon = vi.fn()
  render(<TravailConserve projet="jeu" identifiant="conserve" personnages={[]} onClip={vi.fn()} onBande={vi.fn()} onFermer={vi.fn()} onSon={onSon} />)
  await screen.findByText("Le fichier est silencieux.")
  expect(screen.queryByRole("button", { name: "Reprendre le suivi sonore" })).toBeNull()
  fireEvent.click(screen.getByRole("button", { name: "Écouter et retoucher le son reçu" }))
  expect(onSon).toHaveBeenCalledWith("a-verifier")
  expect(travauxAudio.lire).toHaveBeenCalledWith("jeu", "conserve")
  expect(travauxAudio.preparer).not.toHaveBeenCalled(); expect(travauxAudio.lancer).not.toHaveBeenCalled()
})

test("le journal ouvre un travail audio sans lui demander de personnage ou de paramètres vidéo", async () => {
  const recu: TravailAudio = { ...t, etat: "termine", son: "son-recu" }
  vi.spyOn(travaux, "lister").mockResolvedValue([recu])
  vi.mocked(travauxAudio.lire).mockResolvedValue(recu)
  const onSon = vi.fn()
  render(<SuiviDesTravaux projet="jeu" personnages={[]} onClip={vi.fn()} onSon={onSon} />)
  fireEvent.click(await screen.findByRole("button", { name: /Son · Épée divine/ }))
  fireEvent.click(await screen.findByRole("button", { name: "Écouter et retoucher le son reçu" }))
  expect(onSon).toHaveBeenCalledWith("son-recu")
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
})
