import { afterEach, beforeEach, expect, test, vi } from "vitest"
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { api, RECETTE_VIDE, type Asset, type EmploiResolu, type Piece } from "../api"
import { apiCalques } from "../api-calques"
import { equipements, type CouvertureEquipement } from "../api-travaux-equipement"
import { ReferencePiece } from "./ReferencePiece"
import { ResumeEmploi } from "./ResumeEmploi"

const piece: Piece = { identifiant: "epee", nom: "Épée divine", description: "Acier bleu", emplacement: "main", concept_arts: [], portee: "contenue", references: ["ref"] }
const image = { identifiant: "ref", label: "Épée sur fond neutre", type_media: "image/png", largeur: 48, hauteur: 48, rendu_largeur: 48, rendu_hauteur: 48, recette: RECETTE_VIDE, empreinte: "ref" } as Asset
beforeEach(() => {
  vi.spyOn(api, "lireAsset").mockResolvedValue(image)
  vi.spyOn(api, "assets").mockResolvedValue({ assets: [image], total: 1 } as Awaited<ReturnType<typeof api.assets>>)
  vi.spyOn(apiCalques, "reglerPiece").mockImplementation(async (_p, _id, champs) => ({ piece: { ...piece, ...champs } }))
})
afterEach(() => { cleanup(); vi.restoreAllMocks() })

test("une référence commune se voit et le choix n’impose aucun rôle de calque", async () => {
  const changer = vi.fn()
  render(<ReferencePiece projet="marais" piece={piece} onChange={changer} />)
  expect(await screen.findByAltText("Épée sur fond neutre")).toBeInTheDocument()
  fireEvent.click(screen.getByRole("button", { name: "Choisir ou importer une référence" }))
  fireEvent.click(await screen.findByRole("button", { name: "Épée sur fond neutre" }))
  expect(screen.queryByRole("combobox", { name: "Rôle de cette image" })).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole("button", { name: "Définir comme référence de la pièce" }))
  await waitFor(() => expect(apiCalques.reglerPiece).toHaveBeenCalledWith("marais", "epee", { references: ["ref"] }))
  expect(changer).toHaveBeenCalledWith(piece)
})

test("l’emploi affiche ses frames réelles sans réutiliser le compteur historique de six poses", async () => {
  const emploi = { identifiant: "emploi", genre: "porte", porteur: "pelerin", porteur_nom: "Le pèlerin", nom: "", fait: 0, attendu: 6, emplacement_nom: "Main", devant: true } as EmploiResolu
  vi.spyOn(apiCalques, "cibles").mockResolvedValue({ cibles: [1, 2, 3].map(i => ({ cible: { nature: "frame", resultat: "bande", prise: String(i) }, pose: "marche", direction: "sud" })), variantes: [], images_disponibles: 3, calques_retenus: 0 } as unknown as Awaited<ReturnType<typeof apiCalques.cibles>>)
  const compte = { absente: 3, "a-extraire": 0, "a-verifier": 0, prete: 0, "a-revoir": 0, bases_attendues: 1, bases_absentes: 0, bases_a_choisir: 0, images_connues: 3 }
  vi.spyOn(equipements, "couverture").mockResolvedValue({ images: { ...compte, absente: 0, images_connues: 0 }, animations: compte, prete: false } as CouvertureEquipement)
  const ouvrir = vi.fn()
  render(<ResumeEmploi projet="marais" piece="epee" emploi={emploi} onOuvrir={ouvrir} />)
  expect(await screen.findByText(/3 frames de corps disponibles/)).toBeInTheDocument()
  expect(screen.queryByText(/0 \/ 6/)).not.toBeInTheDocument()
  expect(screen.queryByText(/devant le corps/)).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole("button"))
  expect(ouvrir).toHaveBeenCalledOnce()
})
