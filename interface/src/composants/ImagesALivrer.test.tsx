import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, expect, test, vi } from "vitest"
import { api, type Asset, type Personnage } from "../api"
import { livraisonImages, type LivraisonImage } from "../api-livraison-images"
import { Livraisons } from "./Livraisons"

vi.mock("../api-livraison-images", () => ({ livraisonImages: { lister: vi.fn(), prevoir: vi.fn() } }))
const image = { identifiant: "portrait-v2", label: "Portrait retenu", projet: "jeu", personnage: "portrait", pose: "version", direction: "ouest", favori: true, modele: "Moteur:dessin", epingle: true } as Asset
const apercu: LivraisonImage = { nature: "image", nom: "Portrait", image: image.identifiant, usage: "interface", dimensions: { largeur: 96, hauteur: 128 },
  jeton: "image-relue", projet: "jeu", personnage: "portrait", revision: "ancienne-version", dossier: "C:/jeu",
  fichiers: [{ chemin: "portrait/revision/image.png", role: "image", etat: "nouveau", empreinte: "abc", octets: 400 }], conflits: [], pret: true,
  scene: "res://portrait.tscn", ressource: "res://portrait/revision/texture.tres", sprite_frames: null, animations: [], pivot: { x: 7, y: 11 } }
beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(api, "production").mockResolvedValue({ personnages: [{ identifiant: "portrait", nom: "Portrait", cases: [] } as unknown as Personnage] } as never)
  vi.spyOn(api, "liaisonGodot").mockResolvedValue({ dossier: "C:/jeu", sous_dossier: "assets" })
  vi.spyOn(api, "livraisonsGodot").mockResolvedValue({ livraisons: [] })
  vi.spyOn(api, "livrerGodot").mockResolvedValue({ ...apercu, etat: "terminee" })
  vi.mocked(livraisonImages.lister).mockResolvedValue({ personnage: "portrait", nom: "Portrait", famille: "interface", usage_conseille: "interface", images: [image] })
  vi.mocked(livraisonImages.prevoir).mockResolvedValue(apercu)
})
afterEach(() => { cleanup(); vi.restoreAllMocks() })

test("un portrait sans animation se choisit par vignette et utilise la publication commune", async () => {
  render(<Livraisons projet="jeu" onFerme={vi.fn()} />)
  await screen.findByRole("option", { name: "Portrait" })
  fireEvent.click(screen.getByRole("button", { name: "Images fixes" }))
  fireEvent.click(await screen.findByRole("button", { name: /Portrait retenu/ }))
  expect(screen.getByLabelText("Utilisation dans Godot")).toHaveValue("interface")
  expect(screen.getByText(/Recette ajustée sur cette image/)).toBeInTheDocument()
  fireEvent.click(screen.getByRole("button", { name: "Relire l’image à livrer" }))
  await screen.findByText(/Texture à utiliser directement/)
  expect(api.livrerGodot).not.toHaveBeenCalled()
  expect(livraisonImages.prevoir).toHaveBeenCalledWith("jeu", { personnage: "portrait", image: "portrait-v2", usage: "interface" })
  fireEvent.click(screen.getByRole("button", { name: "Livrer ces versions dans Godot" }))
  await waitFor(() => expect(api.livrerGodot).toHaveBeenCalledWith("jeu", "image-relue"))
  expect(await screen.findByRole("status")).toHaveTextContent("res://portrait.tscn")
})

test("la reprise d’une ancienne image ne demande ni animation ni nouvelle préparation de pixels", async () => {
  vi.mocked(api.livraisonsGodot).mockResolvedValue({ livraisons: [{ ...apercu, etat: "terminee" }] })
  vi.spyOn(api, "reprendreLivraison").mockResolvedValue({ ...apercu, jeton: "restauration" })
  render(<Livraisons projet="jeu" onFerme={vi.fn()} />)
  fireEvent.click(await screen.findByRole("button", { name: "Relire cette livraison" }))
  await screen.findByText(/Texture à utiliser directement/)
  expect(screen.getByRole("button", { name: "Images fixes" })).toHaveAttribute("aria-pressed", "true")
  expect(livraisonImages.prevoir).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole("button", { name: "Livrer ces versions dans Godot" }))
  await waitFor(() => expect(api.livrerGodot).toHaveBeenCalledWith("jeu", "restauration"))
})

test("changer l’usage retire l’aperçu ancien ; un conflit d’image interdit la livraison", async () => {
  vi.mocked(livraisonImages.prevoir).mockResolvedValue({ ...apercu, pret: false, conflits: [{ chemin: "image.png", raison: "Fichier modifié dans le jeu.", decision: null }] })
  render(<Livraisons projet="jeu" onFerme={vi.fn()} />)
  await screen.findByRole("option", { name: "Portrait" })
  fireEvent.click(screen.getByRole("button", { name: "Images fixes" }))
  fireEvent.click(await screen.findByRole("button", { name: /Portrait retenu/ }))
  fireEvent.click(screen.getByRole("button", { name: "Relire l’image à livrer" }))
  expect(await screen.findByRole("alert")).toHaveTextContent("1 fichier à décider avant de livrer.")
  expect(screen.getByText("Fichier modifié dans le jeu.")).toBeTruthy()
  expect(screen.getByRole("button", { name: "Livrer ces versions dans Godot" })).toBeDisabled()
  fireEvent.change(screen.getByLabelText("Utilisation dans Godot"), { target: { value: "monde" } })
  expect(screen.queryByRole("button", { name: "Livrer ces versions dans Godot" })).toBeNull()
  expect(api.livrerGodot).not.toHaveBeenCalled()
})
