import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { afterEach, beforeEach, expect, test, vi } from "vitest"
import { api, RECETTE_VIDE, type Asset, type EmploiResolu, type Personnage, type Piece, type VestiaireDuJeu } from "../api"
import { apiCalques, type CiblesEmploi, type VarianteCalque } from "../api-calques"
import { CalquesDeLEmploi } from "./CalquesDeLEmploi"
import { EditeurCalqueCible } from "./EditeurCalqueCible"
import { AssocierImageEquipement } from "./AssocierImageEquipement"
import { ChoisirImageEquipement } from "./ChoisirImageEquipement"

const chemin = { projet: "marais", piece: "epee", emploi: "porte-pelerin" }
const image = { identifiant: "source", label: "Épée sur le pèlerin", projet: "marais", type_media: "image/png", largeur: 64, hauteur: 64, rendu_largeur: 64, rendu_hauteur: 64, recette: RECETTE_VIDE, empreinte: "source-1" } as Asset
const personnage = { identifiant: "pelerin", projet: "marais", nom: "Le pèlerin", plan: [{ identifiant: "marche", nom: "Marche" }], cases: [], equipable: true } as unknown as Personnage
const piece: Piece = { identifiant: "epee", nom: "Épée divine", emplacement: "main", description: "", concept_arts: [], portee: "contenue" }
const emploi: EmploiResolu = { identifiant: "porte-pelerin", genre: "porte", porteur: "pelerin", nom: "", description: "", emplacement: "", devant: true, deduit: false, orphelin: false, porteur_nom: "Le pèlerin", emplacement_nom: "Main", fait: 0, attendu: 0 }
const variante: VarianteCalque = {
  identifiant: "calque-1", cible: { nature: "frame", resultat: "bande-1", prise: "frame-1" }, role: "calque", source: "source", source_fiche: image, revision: 4,
  placement: { dx: 3, dy: -2, echelle: 1.5, rotation: 0, opacite: .7, devant: true, ordre: 2 },
  masques: { calque: [], corps: [], derriere: [] }, historique: [], extraction: null,
  base: { cadre: { largeur: 64, hauteur: 64 }, repere: { x: 30, y: 61 }, pose: "marche", direction: "ouest" }, calque_cadre: { largeur: 64, hauteur: 64 },
  etat: "a-verifier", raison: "", retenue: false, utilisable: false,
}
const donnees: CiblesEmploi = { piece, emploi, personnage, images_disponibles: 2, calques_retenus: 0,
  cibles: [1, 2].map((n) => ({ cible: { nature: "frame", resultat: "bande-1", prise: `frame-${n}` }, pose: "marche", direction: "ouest", rang: n - 1, nom_bande: "Marche lente" })), variantes: [variante] }

beforeEach(() => {
  sessionStorage.clear()
  const NativeURL = URL
  vi.stubGlobal("URL", class extends NativeURL { static createObjectURL() { return "blob:apercu-calque" }; static revokeObjectURL() {} })
  vi.spyOn(apiCalques, "apercu").mockResolvedValue(new Blob(["pixels"], { type: "image/png" }))
  vi.spyOn(apiCalques, "cibles").mockResolvedValue(structuredClone(donnees))
})
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals() })

test("le mouvement contient ses directions et frames ; un brouillon ne disparaît pas en changeant de cible", async () => {
  render(<CalquesDeLEmploi projet="marais" emploi={emploi} piece={piece} porteur={personnage} emplacements={[]} onRegler={vi.fn()} onHistorique={vi.fn()} onLesAutresEmplois={vi.fn()} />)
  const cible2 = await screen.findByRole("button", { name: /Marche lente · frame 2/ })
  expect(screen.getByText("Marche", { selector: "summary" })).toBeInTheDocument()
  expect(screen.getByText("ouest", { selector: "summary" })).toBeInTheDocument()
  expect(screen.getByLabelText("Déplacement horizontal — valeur")).toHaveValue(3)
  fireEvent.change(screen.getByLabelText("Déplacement horizontal — valeur"), { target: { value: "9" } })
  fireEvent.click(cible2)
  expect(await screen.findByRole("alert")).toHaveTextContent("Enregistrez ou abandonnez")
  expect(screen.getByLabelText("Déplacement horizontal — valeur")).toHaveValue(9)
  fireEvent.click(screen.getByRole("button", { name: "Abandonner les corrections" }))
  fireEvent.click(cible2)
  expect(await screen.findByText("Le premier calque de cette image")).toBeInTheDocument()
  expect(screen.queryByLabelText("Éditeur du calque ciblé")).not.toBeInTheDocument()
})

test("placement et pinceau du corps se gardent sur la seule variante puis se rouvrent", async () => {
  const sauver = vi.spyOn(apiCalques, "regler").mockImplementation(async (_c, _id, _rev, b) => ({ ...variante, ...b, revision: 5 }))
  const onGarde = vi.fn(), onSale = vi.fn()
  const montage = render(<EditeurCalqueCible chemin={chemin} variante={variante} onGarde={onGarde} onSale={onSale} />)
  const apercu = await screen.findByAltText("Aperçu du calque sur sa base")
  vi.spyOn(apercu, "getBoundingClientRect").mockReturnValue({ x: 0, y: 0, left: 0, top: 0, right: 256, bottom: 256, width: 256, height: 256, toJSON() {} })
  vi.stubGlobal("PointerEvent", MouseEvent)
  const zone = screen.getByRole("application")
  zone.setPointerCapture = vi.fn()
  fireEvent.change(screen.getByLabelText("Outil du calque"), { target: { value: "masquer" } })
  fireEvent.pointerDown(zone, { button: 0, clientX: 80, clientY: 92, pointerId: 1 })
  fireEvent.pointerMove(zone, { clientX: 84, clientY: 96, pointerId: 1 })
  fireEvent.pointerUp(zone, { pointerId: 1 })
  fireEvent.change(screen.getByLabelText("Déplacement horizontal — valeur"), { target: { value: "11" } })
  fireEvent.click(screen.getByRole("button", { name: "Enregistrer les corrections" }))
  await waitFor(() => expect(onGarde).toHaveBeenCalled())
  expect(sauver).toHaveBeenCalledWith(chemin, "calque-1", 4, expect.objectContaining({ placement: expect.objectContaining({ dx: 11, dy: -2, echelle: 1.5 }), masques: { calque: [], corps: [{ garde: false, rayon: 2, points: [[20, 23], [21, 24]], couleur: "" }], derriere: [] } }))
  const gardee = onGarde.mock.calls[0][0]
  montage.unmount()
  render(<EditeurCalqueCible chemin={chemin} variante={gardee} onGarde={onGarde} onSale={onSale} />)
  expect(screen.getByLabelText("Déplacement horizontal — valeur")).toHaveValue(11)
  expect(screen.getByLabelText("Opacité — valeur")).toHaveValue(.7)
  await waitFor(() => expect(apiCalques.apercu).toHaveBeenLastCalledWith(chemin, "calque-1", expect.objectContaining({ masques: gardee.masques }), expect.any(AbortSignal)))
})

test("une source équipée ne se retient pas avant extraction ; un refus garde les réglages", async () => {
  vi.spyOn(apiCalques, "extraire").mockRejectedValue(new Error("Le recalage dépasse le cadre de la source."))
  render(<EditeurCalqueCible chemin={chemin} variante={{ ...variante, role: "source-equipee", etat: "a-extraire" }} onGarde={vi.fn()} onSale={vi.fn()} />)
  expect(screen.queryByRole("button", { name: "Vérifier et retenir cette variante" })).not.toBeInTheDocument()
  fireEvent.change(screen.getByLabelText("Seuil de différence — valeur"), { target: { value: "17" } })
  await waitFor(() => expect(screen.getByRole("button", { name: "Extraire une nouvelle variante" })).not.toBeDisabled())
  fireEvent.click(screen.getByRole("button", { name: "Extraire une nouvelle variante" }))
  expect(await screen.findByRole("alert")).toHaveTextContent("Le recalage dépasse")
  expect(screen.getByLabelText("Seuil de différence — valeur")).toHaveValue(17)
})

test("le glisser déplace le calque en pixels et le brouillon revient après changement de rubrique", async () => {
  const props = { chemin, variante, onGarde: vi.fn(), onSale: vi.fn() }
  const montage = render(<EditeurCalqueCible {...props} />)
  const apercu = await screen.findByAltText("Aperçu du calque sur sa base")
  vi.spyOn(apercu, "getBoundingClientRect").mockReturnValue({ x: 0, y: 0, left: 0, top: 0, right: 256, bottom: 256, width: 256, height: 256, toJSON() {} })
  vi.stubGlobal("PointerEvent", MouseEvent)
  const zone = screen.getByRole("application")
  zone.setPointerCapture = vi.fn()
  fireEvent.pointerDown(zone, { button: 0, clientX: 80, clientY: 92, pointerId: 1 })
  fireEvent.pointerMove(zone, { clientX: 96, clientY: 100, pointerId: 1 })
  fireEvent.pointerUp(zone, { pointerId: 1 })
  expect(screen.getByLabelText("Déplacement horizontal — valeur")).toHaveValue(7)
  expect(screen.getByLabelText("Déplacement vertical — valeur")).toHaveValue(0)
  montage.unmount()
  render(<EditeurCalqueCible {...props} />)
  expect(screen.getByLabelText("Déplacement horizontal — valeur")).toHaveValue(7)
  expect(screen.getByRole("button", { name: "Vérifier et retenir cette variante" })).toBeDisabled()
  fireEvent.click(screen.getByRole("button", { name: "Abandonner les corrections" }))
  expect(screen.getByLabelText("Déplacement horizontal — valeur")).toHaveValue(3)
})

test("la retouche exige une pièce, son emploi, une frame précise et un rôle explicite", async () => {
  vi.spyOn(api, "emploisDuJeu").mockResolvedValue({ pieces: [{ piece, emplois: [emploi], declare: true, fait: 0, attendu: 0 }], porteurs: [{ identifiant: "pelerin", nom: "Le pèlerin" }] } as unknown as VestiaireDuJeu)
  const creer = vi.spyOn(apiCalques, "creer").mockResolvedValue(variante)
  render(<AssocierImageEquipement image={image} projet="marais" onFermer={vi.fn()} />)
  expect(screen.getByRole("button", { name: "Associer à cette cible" })).toBeDisabled()
  await screen.findByRole("option", { name: "Épée divine" })
  fireEvent.change(screen.getByLabelText("Pièce de cette image"), { target: { value: "epee" } })
  fireEvent.change(screen.getByLabelText("Emploi de cette image"), { target: { value: "porte-pelerin" } })
  fireEvent.click(await screen.findByRole("button", { name: /Marche lente · frame 2/ }))
  fireEvent.change(screen.getByLabelText("Rôle de l’image associée"), { target: { value: "source-equipee" } })
  fireEvent.click(screen.getByRole("button", { name: "Associer à cette cible" }))
  expect(await screen.findByRole("status")).toHaveTextContent("Image associée")
  expect(creer).toHaveBeenCalledWith(chemin, donnees.cibles[1].cible, "source", "source-equipee")
})

test("la bibliothèque affiche des vignettes, filtre les favoris et garde le rôle choisi", async () => {
  const assets = vi.spyOn(api, "assets").mockResolvedValue({ assets: [image], total: 1 })
  const choisir = vi.fn().mockResolvedValue(undefined)
  render(<ChoisirImageEquipement onChoisir={choisir} onFermer={vi.fn()} />)
  const bouton = await screen.findByRole("button", { name: "Épée sur le pèlerin" })
  expect(within(bouton).getByRole("presentation")).toHaveAttribute("src", expect.stringContaining("source"))
  fireEvent.click(screen.getByLabelText("Favoris"))
  await waitFor(() => expect(assets).toHaveBeenLastCalledWith({ recherche: "", favoris: true, limite: 60 }))
  fireEvent.click(bouton)
  fireEvent.change(screen.getByLabelText("Rôle de cette image"), { target: { value: "calque" } })
  fireEvent.click(screen.getByRole("button", { name: "Associer cette image" }))
  await waitFor(() => expect(choisir).toHaveBeenCalledWith(image, "calque"))
})

// ── US-537 · le retour au personnage, et les variantes qui restent ──────────
//
// Une pièce nommée depuis la fiche de qui la porte descend jusqu'ici ; le
// chemin inverse ne peut pas reposer sur la pile de navigation, puisque cet
// écran s'ouvre aussi depuis la galerie et depuis un travail conservé.
test("l'écran des calques nomme son porteur, y revient d'un clic, et garde ses variantes", async () => {
  const onPorteur = vi.fn()
  render(<CalquesDeLEmploi projet="marais" emploi={emploi} piece={piece} porteur={personnage} emplacements={[]} onRegler={vi.fn()} onHistorique={vi.fn()} onLesAutresEmplois={vi.fn()} onPorteur={onPorteur} />)
  await screen.findByRole("button", { name: /Marche lente · frame 1/ })
  // Les versions de la cible restent atteignables : choisir une variante ne
  // supprime pas les autres (US-541), et le retour ne les cache pas.
  expect(within(screen.getByLabelText("Versions de cette cible")).getAllByRole("button")).toHaveLength(1)
  fireEvent.click(screen.getByRole("button", { name: "Revenir à Le pèlerin" }))
  expect(onPorteur).toHaveBeenCalledTimes(1)
  expect(screen.getByLabelText("Versions de cette cible")).toBeInTheDocument()
})

test("sans rappel de retour, l'écran n'invente aucun bouton vers le personnage", async () => {
  render(<CalquesDeLEmploi projet="marais" emploi={emploi} piece={piece} porteur={personnage} emplacements={[]} onRegler={vi.fn()} onHistorique={vi.fn()} onLesAutresEmplois={vi.fn()} />)
  await screen.findByRole("button", { name: /Marche lente · frame 1/ })
  expect(screen.queryByRole("button", { name: /^Revenir à/ })).toBeNull()
})
