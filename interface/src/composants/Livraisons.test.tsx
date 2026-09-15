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

const enConflit = {
  ...apercu, pret: false,
  conflits: [{ chemin: "pelerin.tscn", raison: "Fichier modifié dans le jeu.", decision: null }],
}

async function relireUnConflit() {
  vi.mocked(api.prevoirLivraison).mockResolvedValue(enConflit)
  render(<Livraisons projet="jeu" onFerme={() => {}} />)
  fireEvent.click(await screen.findByRole("checkbox", { name: /Marche lente/ }))
  fireEvent.click(screen.getByRole("button", { name: "Relire 1 animation à livrer" }))
  return await screen.findByRole("alert")
}

test("un conflit non décidé dit ce qui reste à décider et interdit la publication", async () => {
  await relireUnConflit()
  expect(screen.getByRole("alert")).toHaveTextContent("1 fichier à décider avant de livrer.")
  expect(screen.getByText("Fichier modifié dans le jeu.")).toBeTruthy()
  expect(screen.getByRole("button", { name: "Livrer ces versions dans Godot" })).toBeDisabled()
  expect(api.livrerGodot).not.toHaveBeenCalled()
})

test("les trois décisions sont posées, et chacune dit ce qu'elle fait avant d'être prise", async () => {
  await relireUnConflit()
  for (const [nom, fait] of [
    ["Conserver", /n’écrit rien ici/],
    ["Copier à côté", /\.copie-atelier/],
    ["Remplacer", /par-dessus/],
  ] as const) {
    expect(screen.getByRole("button", { name: nom })).toHaveAttribute("aria-pressed", "false")
    expect(screen.getByText(fait)).toBeTruthy()
  }
})

test("décider ouvre la livraison, et le geste ne devine pas la décision", async () => {
  vi.spyOn(api, "deciderConflit").mockResolvedValue({
    ...enConflit, pret: true,
    conflits: [{ chemin: "pelerin.tscn", raison: "Fichier modifié dans le jeu.", decision: "copier", voisin: "pelerin.copie-atelier.tscn" }],
  })
  await relireUnConflit()
  fireEvent.click(screen.getByRole("button", { name: "Copier à côté" }))
  await waitFor(() => expect(api.deciderConflit).toHaveBeenCalledWith("jeu", "choix-relu", "pelerin.tscn", "copier"))
  expect(await screen.findByText(/pelerin\.copie-atelier\.tscn/)).toBeTruthy()
  expect(screen.getByRole("alert")).toHaveTextContent("Chaque conflit a sa décision.")
  expect(screen.getByRole("button", { name: "Copier à côté" })).toHaveAttribute("aria-pressed", "true")
  const livrer = screen.getByRole("button", { name: "Livrer ces versions dans Godot" })
  expect(livrer).not.toBeDisabled()
  fireEvent.click(livrer)
  await waitFor(() => expect(api.livrerGodot).toHaveBeenCalledWith("jeu", "choix-relu"))
})

test("les versions se cochent une par une, et toutes d'un coup", async () => {
  render(<Livraisons projet="jeu" onFerme={() => {}} />)
  fireEvent.click(await screen.findByRole("button", { name: "Tout sélectionner" }))
  expect(screen.getByRole("checkbox", { name: /Marche lente/ })).toBeChecked()
  expect(screen.getByRole("checkbox", { name: /Marche rapide/ })).toBeChecked()
  expect(screen.getByText("2 sur 2")).toBeTruthy()
  fireEvent.click(screen.getByRole("button", { name: "Tout décocher" }))
  expect(screen.getByRole("checkbox", { name: /Marche lente/ })).not.toBeChecked()
  fireEvent.click(screen.getByRole("checkbox", { name: /Marche rapide/ }))
  expect(screen.getByText("1 sur 2")).toBeTruthy()
})

test("un brouillon est mis de côté et l'écran demande sa case", async () => {
  vi.mocked(api.production).mockResolvedValue({ personnages: [{ identifiant: "pelerin", nom: "Pèlerin", cases: [{ bandes: [
    { identifiant: "marche-v1", nom: "Marche lente", pose: "marche", direction: "sud", compte: 8, cadence: 11, supprime: false },
    { identifiant: "essai-1", nom: "Découpe pour voir", pose: "", direction: "", compte: 5, cadence: 12, supprime: false, brouillon: true },
  ] }] } as Personnage] } as Awaited<ReturnType<typeof api.production>>)
  render(<Livraisons projet="jeu" onFerme={() => {}} />)
  expect(await screen.findByRole("checkbox", { name: /Marche lente/ })).toBeTruthy()
  expect(screen.queryByRole("checkbox", { name: /Découpe pour voir/ })).toBeNull()
  expect(screen.getByRole("status")).toHaveTextContent("1 brouillon mis de côté : Découpe pour voir.")
  expect(screen.getByRole("status")).toHaveTextContent("mouvement et leur direction")
})
