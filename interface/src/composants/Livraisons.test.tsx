import { afterEach, beforeEach, expect, test, vi } from "vitest"
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { api, type ApercuLivraison, type Personnage } from "../api"
import { Livraisons } from "./Livraisons"

vi.mock("./Apercu", () => ({ BandeQuiTourne: () => <span>Aperçu animé</span> }))
const apercu: ApercuLivraison = {
  jeton: "choix-relu", projet: "jeu", personnage: "pelerin", revision: "revision-1",
  dossier: "C:/jeu", fichiers: [{ chemin: "pelerin.tscn", role: "scène", etat: "nouveau", empreinte: "abc", octets: 200 }],
  conflits: [], pret: true, scene: "res://pelerin.tscn", sprite_frames: "res://animations.tres", animations: [],
}
beforeEach(() => {
  vi.spyOn(api, "production").mockResolvedValue({ personnages: [{ identifiant: "pelerin", nom: "Pèlerin", cases: [{ bandes: [
    { identifiant: "marche-v1", nom: "Marche lente", pose: "marche", direction: "sud", compte: 8, cadence: 11, supprime: false },
    { identifiant: "marche-v2", nom: "Marche rapide", pose: "marche", direction: "sud", compte: 6, cadence: 15, supprime: false },
  ] }] } as Personnage] } as Awaited<ReturnType<typeof api.production>>)
  vi.spyOn(api, "liaisonGodot").mockResolvedValue({ dossier: "C:/jeu", sous_dossier: "assets" })
  vi.spyOn(api, "livraisonsGodot").mockResolvedValue({ livraisons: [] })
  vi.spyOn(api, "prevoirLivraison").mockResolvedValue(apercu)
  vi.spyOn(api, "livrerGodot").mockResolvedValue({ ...apercu, etat: "terminee" })
})
afterEach(() => { cleanup(); vi.restoreAllMocks() })

test("publie seulement l'instantané relu et invalide l'aperçu après changement de sélection", async () => {
  render(<Livraisons projet="jeu" onFerme={() => {}} />)
  fireEvent.click(await screen.findByRole("checkbox", { name: /Marche lente/ }))
  fireEvent.click(screen.getByRole("button", { name: "Relire 1 animation à livrer" }))
  await screen.findByRole("button", { name: "Livrer ces versions dans Godot" })
  expect(api.livrerGodot).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole("checkbox", { name: /Marche rapide/ }))
  expect(screen.queryByRole("button", { name: "Livrer ces versions dans Godot" })).toBeNull()
  fireEvent.click(screen.getByRole("button", { name: "Relire 2 animations à livrer" }))
  fireEvent.click(await screen.findByRole("button", { name: "Livrer ces versions dans Godot" }))
  await waitFor(() => expect(api.livrerGodot).toHaveBeenCalledWith("jeu", "choix-relu"))
  expect(await screen.findByRole("status")).toHaveTextContent("res://pelerin.tscn")
})

test("un conflit affiche son fichier et interdit la publication", async () => {
  vi.mocked(api.prevoirLivraison).mockResolvedValue({ ...apercu, pret: false, conflits: [{ chemin: "pelerin.tscn", raison: "Fichier modifié dans le jeu." }] })
  render(<Livraisons projet="jeu" onFerme={() => {}} />)
  fireEvent.click(await screen.findByRole("checkbox", { name: /Marche lente/ }))
  fireEvent.click(screen.getByRole("button", { name: "Relire 1 animation à livrer" }))
  expect(await screen.findByRole("alert")).toHaveTextContent("pelerin.tscn — Fichier modifié")
  expect(screen.getByRole("button", { name: "Livrer ces versions dans Godot" })).toBeDisabled()
  expect(api.livrerGodot).not.toHaveBeenCalled()
})
