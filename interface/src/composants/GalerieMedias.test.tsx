import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import type { ComponentProps } from "react"
import { afterEach, beforeEach, expect, test, vi } from "vitest"
import { GalerieMedias } from "./GalerieMedias"
import type { Entree } from "./Tuile"
import type { Source3D } from "../api-3d"
import { MemoireDuParcours } from "./MemoireDuParcours"

const { animationsDeLivraison, ouvrirLaBande, lister3d, listerSons, onde } = vi.hoisted(() => ({
  animationsDeLivraison: vi.fn(), ouvrirLaBande: vi.fn(), lister3d: vi.fn(), listerSons: vi.fn(), onde: vi.fn(),
}))

vi.mock("../api", () => ({ api: { animationsDeLivraison, ouvrirLaBande } }))
vi.mock("../api-3d", () => ({
  sources3d: { lister: lister3d, fichier: () => "/frame.png" },
}))
vi.mock("../api-sons", () => ({ sons: { lister: listerSons, onde } }))
vi.mock("./Apercu", () => ({ BandeQuiTourne: ({ bande }: { bande: { nom: string } }) => <span>Planche {bande.nom}</span> }))

beforeEach(() => vi.resetAllMocks())
afterEach(cleanup)

const entreeVideo = {
  cle: "clip-1", date: 1, rang: 0, sorte: "clip",
  generation: { identifiant: "clip-1", clip: { images: 8 }, projet: "jeu", demande: { prompt: "Clip d’essai" } },
} as unknown as Entree

function monter(props: Partial<ComponentProps<typeof GalerieMedias>> = {}) {
  return render(<GalerieMedias
    filtre={{ collection: null, favoris: false, recherche: "" }}
    onRecherche={vi.fn()}
    entrees={[entreeVideo]}
    clips={[(entreeVideo as Extract<Entree, { sorte: "clip" }>).generation]}
    projet="jeu"
    onChanger={vi.fn()}
    onBande={vi.fn()}
    {...props}
  >{(sorte) => <p>Grille {sorte}</p>}</GalerieMedias>)
}

test("la galerie donne une recherche unique et sépare les vidéos", () => {
  monter()
  expect(screen.getByRole("heading", { name: "Galerie" })).toBeTruthy()
  expect(screen.getByText("Grille images")).toBeTruthy()
  fireEvent.click(screen.getByRole("button", { name: "Vidéos" }))
  expect(screen.getByText("Grille videos")).toBeTruthy()
})

test("les animations hors des clips visibles sont lues depuis le catalogue du jeu", async () => {
  const onBande = vi.fn()
  animationsDeLivraison.mockResolvedValueOnce([{ identifiant: "bande-1", nom: "Marche", compte: 8, cadence: 8, pose: "marche", direction: null, personnage: null, sens: "boucle", favori: false, case_largeur: 64, case_hauteur: 64 }])
  ouvrirLaBande.mockResolvedValueOnce({ bande: { identifiant: "bande-1", nom: "Marche", compte: 8, cadence: 8, pose: "marche", direction: null, case_largeur: 64, case_hauteur: 64, sens: "boucle" } })
  monter({ onBande, clips: [] })
  fireEvent.click(screen.getByRole("button", { name: "Animations" }))
  expect(await screen.findByText("Planche Marche")).toBeTruthy()
  fireEvent.click(screen.getByRole("button", { name: "Ouvrir l’animation ›" }))
  expect(onBande).toHaveBeenCalledWith("bande-1")
})

test("une source 3D sans frame ne reçoit pas de fausse vignette", async () => {
  const source = { identifiant: "source-1", projet: "jeu", nom: "Héros", origine: "asset3d", fichiers: { "modele.glb": "hash" }, images: 8, largeur: 64, hauteur: 64, cadence: 8 } as unknown as Source3D
  lister3d.mockResolvedValueOnce({ sources: [source] })
  monter()
  fireEvent.click(screen.getByRole("button", { name: "Modèles 3D" }))
  expect(await screen.findByText("Aperçu image indisponible")).toBeTruthy()
  expect(screen.getByRole("button", { name: "Ouvrir la source 3D ›" })).toHaveProperty("disabled", true)
})

test("les cartes de sons demandent une forme d’onde sans créer de lecteur", async () => {
  listerSons.mockResolvedValueOnce([{ identifiant: "son-1", projet: "jeu", nom: "Vent", etat: "pret", raison: "", mesures: { duree: 2, canaux: 1 }, revision: 1 }])
  onde.mockResolvedValueOnce({ canaux_ondes: [{ minimum: [0], maximum: [0.5] }] })
  monter()
  fireEvent.click(screen.getByRole("button", { name: "Sons" }))
  await screen.findByText("Vent")
  await waitFor(() => expect(onde).toHaveBeenCalled())
  expect(document.querySelector("audio")).toBeNull()
})

test("la page de la galerie revient après fermeture, puis repart à zéro si le média change", async () => {
  const bandes = Array.from({ length: 25 }, (_, index) => ({ identifiant: `bande-${index}`, nom: `Marche ${index}`, compte: 8, cadence: 8, pose: "marche", direction: null, personnage: null, sens: "boucle", favori: false, case_largeur: 64, case_hauteur: 64 }))
  animationsDeLivraison.mockResolvedValue(bandes)
  ouvrirLaBande.mockResolvedValue({ bande: bandes[0] })
  listerSons.mockResolvedValue([])
  function Ecran({ ouvert }: { ouvert: boolean }) {
    return <MemoireDuParcours>{ouvert ? <GalerieMedias filtre={{ collection: null, favoris: false, recherche: "" }} onRecherche={vi.fn()} entrees={[]} clips={[]} projet="jeu" onChanger={vi.fn()} onBande={vi.fn()}>{(sorte) => <p>Grille {sorte}</p>}</GalerieMedias> : null}</MemoireDuParcours>
  }
  const rendu = render(<Ecran ouvert />)
  fireEvent.click(screen.getByRole("button", { name: "Animations" }))
  await screen.findByText("Marche 0")
  fireEvent.click(screen.getByRole("button", { name: "Suivant" }))
  expect(screen.getByText("Page 2 / 2")).toBeTruthy()
  rendu.rerender(<Ecran ouvert={false} />)
  rendu.rerender(<Ecran ouvert />)
  await screen.findByText("Page 2 / 2")
  fireEvent.click(screen.getByRole("button", { name: "Sons" }))
  expect(screen.queryByText("Page 2 / 2")).toBeNull()
})

test("une vignette d’animation en échec se relance sans masquer l’ouverture", async () => {
  animationsDeLivraison.mockResolvedValueOnce([{ identifiant: "bande-1", nom: "Marche", compte: 8, cadence: 8, pose: null, direction: null, personnage: null, sens: "boucle", favori: false, case_largeur: 64, case_hauteur: 64 }])
  ouvrirLaBande.mockRejectedValueOnce(new Error("lecture"))
  ouvrirLaBande.mockResolvedValueOnce({ bande: { identifiant: "bande-1", nom: "Marche", compte: 8, cadence: 8 } })
  const onBande = vi.fn()
  monter({ clips: [], onBande })
  fireEvent.click(screen.getByRole("button", { name: "Animations" }))
  expect(await screen.findByText("Vignette indisponible")).toBeTruthy()
  expect(screen.getByRole("button", { name: "Ouvrir l’animation ›" })).toBeTruthy()
  fireEvent.click(screen.getByRole("button", { name: "Réessayer la vignette" }))
  expect(await screen.findByText("Planche Marche")).toBeTruthy()
})

test("une erreur de catalogue ne se présente pas comme une galerie vide et peut être relancée", async () => {
  listerSons.mockRejectedValueOnce(new Error("serveur inaccessible"))
  listerSons.mockResolvedValueOnce([])
  monter()
  fireEvent.click(screen.getByRole("button", { name: "Sons" }))
  expect(await screen.findByText("Les sons ne peuvent pas être relus.")).toBeTruthy()
  expect(screen.queryByRole("status")).toBeNull()
  expect(screen.queryByText("Aucun résultat pour ces filtres.")).toBeNull()
  fireEvent.click(screen.getByRole("button", { name: "Réessayer la lecture" }))
  expect(await screen.findByText("Aucun résultat pour ces filtres.")).toBeTruthy()
  expect(screen.queryByRole("alert")).toBeNull()
})
