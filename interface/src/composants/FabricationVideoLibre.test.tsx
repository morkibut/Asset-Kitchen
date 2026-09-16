import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, expect, test, vi } from "vitest"
import { FabricationVideoLibre } from "./FabricationVideoLibre"
import { api, type Asset, type ModeleVideo } from "../api"
import { videoLibre, type TravailVideoLibre } from "../api-video-libre"
import { workflows } from "../api-workflows"

vi.mock("../api-video-libre", () => ({ videoLibre: { preparer: vi.fn(), lire: vi.fn(), demarrer: vi.fn(), reprendre: vi.fn() } }))
vi.mock("../api-workflows", () => ({ workflows: { lister: vi.fn() } }))
vi.mock("./BibliothequePourImage", () => ({ BibliothequePourImage: ({ onChoisir }: { onChoisir: (a: Asset) => void }) => <button onClick={() => onChoisir({ identifiant: "depart", projet: "jeu" } as Asset)}>Choisir l’image filtrée</button> }))
const modele: ModeleVideo = { identifiant: "Moteur:clip", nom: "Clip", fournisseur: "Moteur", durees: [5, 8], resolutions: ["480p", "720p"], proportions: ["1:1", "16:9"], grise: null, de_la_maison: false,
  images_par_seconde: 0, duree_conseillee: 0, raison_de_la_duree: "", images_par_duree: {}, mesure: "",
  options: { seed: { nom: "Graine", genre: "intervalle", minimum: 0, maximum: 999, valeurs: [] } }, prix: { montant: 0.12, nature: "estimation", releve_le: null, formule: "Un clip" }, attente: null }
const travail: TravailVideoLibre = { nature: "video-libre", identifiant: "conserve", projet: "jeu", cle: "cle", acteur: "auteur", etat: "prepare", etape: "reference", cree_le: 1000,
  demande: { cle: "cle", reference_asset: "depart", modele_video: modele.identifiant, prompt_video: "Une marche précise", secondes: 8, resolution: "720p", proportions: "16:9", options_video: { seed: 314 }, nombre_images: 8, cadence: 8, sens: "boucle" },
  reference_asset: "depart", clip: null, bandes: [], references: [], objectif: null, entree_video: { url: "/image-figee.png", empreinte: "hash" },
  annonce: { appels: 1, reservation_usd: 0.12, image_usd: 0, video: modele.prix, temps_local: null, video_locale: false, limite: "Le prix final peut varier." }, consommations: [], prochaine_action: "demarrer" }

beforeEach(() => {
  vi.clearAllMocks(); localStorage.clear()
  vi.mocked(workflows.lister).mockResolvedValue({ profils: [] })
  vi.spyOn(api, "modelesVideo").mockResolvedValue({ modeles: [modele] } as never)
  vi.spyOn(api, "modeles").mockResolvedValue({ modeles: [{ identifiant: "Image:dessin", refus: null, options: {}, proportions: ["1:1"], resolutions: ["1024"], references_max: 4, unite: "usd" }] } as never)
  vi.mocked(videoLibre.preparer).mockResolvedValue(travail)
  vi.mocked(videoLibre.demarrer).mockResolvedValue({ ...travail, etat: "termine", clip: "clip-produit" })
})

test("une vidéo libre se relit sans personnage et ne part qu’après confirmation de l’envoi exact", async () => {
  const onClip = vi.fn()
  render(<FabricationVideoLibre projet="jeu" onClip={onClip} />)
  fireEvent.click(screen.getByRole("button", { name: "Choisir dans la bibliothèque" }))
  fireEvent.click(screen.getByRole("button", { name: "Choisir l’image filtrée" }))
  await screen.findByRole("option", { name: /Moteur:clip/ })
  fireEvent.change(screen.getByLabelText("Fournisseur et modèle"), { target: { value: modele.identifiant } })
  fireEvent.change(screen.getByLabelText("Mouvement et consignes pour la vidéo"), { target: { value: "Une marche précise" } })
  fireEvent.change(screen.getByLabelText("Durée du clip"), { target: { value: "8" } })
  fireEvent.change(screen.getByLabelText("Résolution du clip"), { target: { value: "720p" } })
  fireEvent.change(screen.getByLabelText("Proportions du clip"), { target: { value: "16:9" } })
  fireEvent.change(screen.getByLabelText("Vidéo · Graine"), { target: { value: "314" } })
  await waitFor(() => expect(screen.getByRole("button", { name: "Relire avant l’envoi" })).toBeEnabled())
  fireEvent.click(screen.getByRole("button", { name: "Relire avant l’envoi" }))
  await screen.findByRole("button", { name: "Lancer cette fabrication vidéo" })
  expect(videoLibre.demarrer).not.toHaveBeenCalled()
  const envoyee = vi.mocked(videoLibre.preparer).mock.calls[0][1]
  expect(envoyee).toMatchObject({ reference_asset: "depart", secondes: 8, resolution: "720p", proportions: "16:9", options_video: { seed: 314 } })
  expect(envoyee.personnage).toBeUndefined()
  expect(screen.getByAltText("Image exacte envoyée à la vidéo")).toHaveAttribute("src", "/image-figee.png")
  fireEvent.click(screen.getByRole("button", { name: "Lancer cette fabrication vidéo" }))
  fireEvent.click(await screen.findByRole("button", { name: "Ouvrir le montage et classer" }))
  expect(onClip).toHaveBeenCalledWith("clip-produit")
  expect(screen.getByLabelText("Clip produit")).toHaveAttribute("src", api.videoDuClip("clip-produit"))
})

test("rouvrir une vidéo interrompue reprend son identifiant, ses réglages et ses références", async () => {
  vi.mocked(videoLibre.lire).mockResolvedValue({ ...travail, etat: "a_reprendre" })
  vi.mocked(videoLibre.reprendre).mockResolvedValue({ ...travail, etat: "termine", clip: "clip-conserve" })
  render(<FabricationVideoLibre projet="jeu" identifiantInitial="conserve" onClip={vi.fn()} />)
  fireEvent.click(await screen.findByRole("button", { name: "Reprendre le suivi conservé" }))
  await screen.findByRole("button", { name: "Ouvrir le montage et classer" })
  expect(videoLibre.reprendre).toHaveBeenCalledWith("jeu", "conserve")
  expect(videoLibre.preparer).not.toHaveBeenCalled(); expect(videoLibre.demarrer).not.toHaveBeenCalled()
})

test("fabriquer l’image annonce deux étapes et fige le texte composé avant le clip", async () => {
  vi.mocked(videoLibre.preparer).mockResolvedValue({ ...travail, reference_asset: null, entree_video: undefined,
    demande: { ...travail.demande, reference_asset: null, modele_image: "Image:dessin", prompt_image: "Une île" },
    envoi_image: { prompt: "L’univers composé\nUne île", proportions: "1:1", resolution: "1024", options: {} },
    annonce: { ...travail.annonce, appels: 2, image_usd: 0.05, reservation_usd: 0.17 } })
  render(<FabricationVideoLibre projet="jeu" onClip={vi.fn()} />)
  fireEvent.click(screen.getByRole("button", { name: "Fabriquer une nouvelle image" }))
  await screen.findByRole("option", { name: "Image:dessin" })
  fireEvent.change(screen.getByLabelText("Modèle d’image"), { target: { value: "Image:dessin" } })
  fireEvent.change(screen.getByLabelText("Description de l’image"), { target: { value: "Une île" } })
  fireEvent.change(screen.getByLabelText("Fournisseur et modèle"), { target: { value: modele.identifiant } })
  fireEvent.change(screen.getByLabelText("Mouvement et consignes pour la vidéo"), { target: { value: "Les feuilles bougent" } })
  await waitFor(() => expect(screen.getByRole("button", { name: "Relire avant l’envoi" })).toBeEnabled())
  fireEvent.click(screen.getByRole("button", { name: "Relire avant l’envoi" }))
  await screen.findByText(/L’univers composé/)
  expect(screen.getByText(/2 appel/)).toBeInTheDocument()
  expect(videoLibre.demarrer).not.toHaveBeenCalled()
  expect(videoLibre.preparer).toHaveBeenCalledWith("jeu", expect.objectContaining({ modele_image: "Image:dessin", prompt_image: "Une île", reference_asset: null }))
})

test("importer garde l’image en bibliothèque sans lancer de modèle", async () => {
  vi.spyOn(api, "televerser").mockResolvedValue({ asset: { identifiant: "importe", projet: "jeu" } as Asset, doublon: null })
  render(<FabricationVideoLibre projet="jeu" onClip={vi.fn()} />)
  const fichier = new File(["png"], "ile.png", { type: "image/png" })
  fireEvent.change(screen.getByLabelText("Importer l’image de départ"), { target: { files: [fichier] } })
  expect(await screen.findByAltText("Image de départ choisie")).toHaveAttribute("src", api.fichier("importe"))
  expect(api.televerser).toHaveBeenCalledWith(fichier)
  expect(videoLibre.preparer).not.toHaveBeenCalled(); expect(videoLibre.demarrer).not.toHaveBeenCalled()
})
