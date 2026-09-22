import { afterEach, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { sources3d, type Source3D } from "../api-3d"
import { Source3DConservee } from "./Source3DConservee"

afterEach(() => { cleanup(); vi.restoreAllMocks() })

const source: Source3D = {
  identifiant: "source-1", projet: "jeu", personnage: "pelerin", nom: "Pèlerin animé", origine: "import",
  provenance: { adresse: "copie locale", personnage: "pelerin", rendu: "marche", reglages: { animation: "marche", moteur_3d: "rigify" } },
  fichiers: { "rig.glb": "rig.glb", "modele.glb": "modele.glb", "frame-0000.png": "frame-0000.png" }, images: 8, largeur: 64, hauteur: 64, cadence: 8, bandes: ["bande-1"], cree_le: 1,
}

it("relit une source conservée hors ligne avec le bon GLB, ses fichiers et ses portes", () => {
  const fermer = vi.fn(), bande = vi.fn(), personnage = vi.fn()
  render(<Source3DConservee source={source} onFermer={fermer} onBande={bande} onPersonnage={personnage} />)
  expect(screen.getByRole("heading", { name: "Pèlerin animé" })).toBeTruthy()
  expect(screen.getByRole("link", { name: "Modèle animé" })).toHaveAttribute("href", sources3d.fichier(source, "rig.glb"))
  expect(screen.getByRole("link", { name: "Modèle 3D" })).toHaveAttribute("href", sources3d.fichier(source, "modele.glb"))
  fireEvent.click(screen.getByRole("button", { name: /Retoucher l’animation/ }))
  fireEvent.click(screen.getByRole("button", { name: "Ouvrir le personnage" }))
  fireEvent.click(screen.getByRole("button", { name: "Fermer" }))
  expect(bande).toHaveBeenCalledWith("bande-1"); expect(personnage).toHaveBeenCalledWith("pelerin"); expect(fermer).toHaveBeenCalledOnce()
})

it("montre la première frame quand aucun GLB n'est conservé", () => {
  const sansGlb = { ...source, fichiers: { "frame-0000.png": "frame-0000.png" } }
  render(<Source3DConservee source={sansGlb} onFermer={vi.fn()} onBande={vi.fn()} />)
  expect(screen.getByRole("img", { name: "Première image de Pèlerin animé" })).toHaveAttribute("src", sources3d.fichier(sansGlb, "frame-0000.png"))
  expect(screen.getByText(/Seules les images rendues ont été conservées/)).toBeTruthy()
})
