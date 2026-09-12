import { afterEach, beforeEach, expect, test, vi } from "vitest"
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { api, type Personnage } from "../api"
import { travaux, type Travail } from "../api-travaux"
import { FabricationSuivie } from "./FabricationSuivie"

const personnage = { identifiant: "pelerin", nom: "Pèlerin", type: "personnage", ecartees: [], plan: [{ identifiant: "marche", nom: "Marche" }], cases: [{ pose: "marche", directions: [{ identifiant: "sud", nom: "Sud" }] }] } as unknown as Personnage
const t = { identifiant: "travail-relu", projet: "jeu", cle: "cle-premiere", acteur: "auteur", etat: "prepare", etape: "reference", cree_le: 123,
  demande: { cle: "cle-premiere", personnage: "pelerin", pose: "marche", direction: "sud", modele_image: "Images:modele", prompt_image: "Une référence", modele_video: "Video:modele", prompt_video: "Il marche", secondes: 5, resolution: "480p", proportions: "1:1", nombre_images: 8, cadence: 11, sens: "boucle" },
  objectif: { largeur: 64, hauteur: 64 }, reference_asset: null, clip: null, bandes: [], references: [{ nom: "style", url: "/reference-figee.png", asset: "style", empreinte: "fixe" }],
  envoi_image: { prompt: "Le vrai texte composé avec l’univers", options: {}, proportions: "1:1" },
  annonce: { image_usd: .2, video: { montant: .3 }, reservation_usd: .5, appels: 2, video_locale: false, limite: "Estimation avant envoi" }, consommations: [], prochaine_action: "demarrer",
} as unknown as Travail

beforeEach(() => {
  vi.spyOn(api, "modeles").mockResolvedValue({ modeles: [{ identifiant: "Images:modele", options: {}, refus: null }] } as Awaited<ReturnType<typeof api.modeles>>)
  vi.spyOn(api, "modelesVideo").mockResolvedValue({ modeles: [{ identifiant: "Video:modele", grise: null, prix: { montant: .3 }, durees: [5, 10], resolutions: ["480p", "720p"], proportions: ["1:1", "16:9"] }] } as Awaited<ReturnType<typeof api.modelesVideo>>)
  vi.spyOn(travaux, "preparer").mockImplementation(async (_p, d) => ({ ...t, identifiant: "nouvelle-relecture", demande: d }))
  vi.spyOn(travaux, "demarrer").mockResolvedValue({ ...t, etat: "en_cours" })
  vi.spyOn(travaux, "reprendre").mockResolvedValue({ ...t, etat: "en_cours" })
  vi.spyOn(travaux, "lire").mockResolvedValue({ ...t, etat: "termine" })
})
afterEach(() => { cleanup(); vi.restoreAllMocks() })

test("la relecture montre le texte composé et les octets figés sans lancer d’appel", () => {
  render(<FabricationSuivie projet="jeu" personnages={[personnage]} initiale={t} onClip={() => {}} onFermer={() => {}} />)
  expect(screen.getByText("Le vrai texte composé avec l’univers")).toBeTruthy()
  expect(screen.getByAltText("Référence exacte envoyée pour créer l’image")).toHaveAttribute("src", "/reference-figee.png")
  expect(screen.getByText("1 clip · 5 s · 480p · 1:1")).toBeTruthy()
  expect(travaux.demarrer).not.toHaveBeenCalled()
})

test("modifier le texte ou les références demande une nouvelle relecture avec une nouvelle clé", async () => {
  render(<FabricationSuivie projet="jeu" personnages={[personnage]} initiale={t} onClip={() => {}} onFermer={() => {}} />)
  fireEvent.click(screen.getByRole("button", { name: "Modifier le texte et les images" }))
  const texte = screen.getByLabelText("Texte complet de l’image, édité pour cet envoi")
  expect(texte).toHaveValue("Le vrai texte composé avec l’univers")
  fireEvent.change(texte, { target: { value: "Une correction précise" } })
  fireEvent.click(screen.getByRole("button", { name: "Retirer de cet envoi" }))
  await waitFor(() => expect(screen.getByRole("button", { name: "Relire les envois" })).toBeEnabled())
  fireEvent.click(screen.getByRole("button", { name: "Relire les envois" }))
  await waitFor(() => expect(travaux.preparer).toHaveBeenCalledOnce())
  const [projet, demande] = vi.mocked(travaux.preparer).mock.calls[0]
  expect(projet).toBe("jeu")
  expect(demande.cle).not.toBe(t.cle)
  expect(demande.prompt_image).toBe("Une correction précise")
  expect(demande.repris_image).toBe(true)
  expect(demande.references_image_ecartees).toEqual(["style"])
  expect(travaux.demarrer).not.toHaveBeenCalled()
  fireEvent.click(await screen.findByRole("button", { name: /Lancer ·/ }))
  await waitFor(() => expect(travaux.demarrer).toHaveBeenCalledWith("jeu", "nouvelle-relecture"))
})

test("la reprise d’un travail agent conserve son identifiant sans préparer de nouvelle génération", async () => {
  render(<FabricationSuivie projet="jeu" personnages={[personnage]} initiale={{ ...t, acteur: "agent", etat: "a_reprendre" }} onClip={() => {}} onFermer={() => {}} />)
  fireEvent.click(screen.getByRole("button", { name: "Reprendre ce travail" }))
  await waitFor(() => expect(travaux.reprendre).toHaveBeenCalledWith("jeu", "travail-relu"))
  expect(travaux.preparer).not.toHaveBeenCalled()
  expect(travaux.demarrer).not.toHaveBeenCalled()
})
