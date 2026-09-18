import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { afterEach, beforeEach, expect, test, vi } from "vitest"
import { api, RECETTE_VIDE, type Asset, type EmploiResolu, type Personnage, type Piece, type VestiaireDuJeu } from "../api"
import { apiCalques, type CiblesEmploi, type VarianteCalque } from "../api-calques"
import { CalquesDeLEmploi } from "./CalquesDeLEmploi"
import { EditeurCalqueCible, placeDuDessus } from "./EditeurCalqueCible"
import { AssocierImageEquipement } from "./AssocierImageEquipement"
import { BibliothequePourImage } from "./BibliothequePourImage"

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
  vi.spyOn(api, "arbre").mockResolvedValue({ collections: [] } as never)
  const assets = vi.spyOn(api, "assets").mockResolvedValue({ assets: [image], total: 1 })
  const choisir = vi.fn().mockResolvedValue(undefined)
  render(<BibliothequePourImage retour="Épée divine" role="choix" onChoisir={choisir} onFermer={vi.fn()} />)
  const bouton = await screen.findByRole("button", { name: "Choisir Épée sur le pèlerin" })
  expect(within(bouton).getByRole("presentation")).toHaveAttribute("src", expect.stringContaining("source"))
  fireEvent.click(screen.getByLabelText("Favoris"))
  await waitFor(() => expect(assets).toHaveBeenLastCalledWith({ recherche: "", collection: null, favoris: true, limite: 60 }))
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
  fireEvent.click(screen.getByRole("button", { name: "‹ Le pèlerin" }))
  expect(onPorteur).toHaveBeenCalledTimes(1)
  expect(screen.getByLabelText("Versions de cette cible")).toBeInTheDocument()
})

// ── AU15 · l'ordre des images, expliqué sans parler d'orientation ──────────
//
// Le contrat portait déjà la finesse : `placement.devant` pour l'ordre par
// défaut, le masque `derriere` pour les morceaux qui passent sous le corps —
// tous deux attachés à une variante, donc à une cible, donc à une frame. Ce qui
// manquait était de le dire, et de remettre le réglage par défaut là où la
// maquette le pose : dans les réglages de l'emploi.
test("l'emploi explique l'ordre des images sans parler d'orientation, et le règle", async () => {
  const onRegler = vi.fn()
  render(<CalquesDeLEmploi projet="marais" emploi={emploi} piece={piece} porteur={personnage} emplacements={[]} onRegler={onRegler} onHistorique={vi.fn()} onLesAutresEmplois={vi.fn()} />)
  await screen.findByRole("button", { name: /Marche lente · frame 1/ })
  const ordre = screen.getByLabelText("Ordre des calques par défaut")
  expect(ordre).toHaveValue("devant")
  expect(screen.getByText(/l’ordre des images, pas la direction du regard/)).toBeInTheDocument()
  // Le repli 3/4 nomme les deux pinceaux et dit que la correction est par frame.
  const troisQuarts = screen.getByText("Et en vue de dessus à 3/4 ?")
  expect(troisQuarts.parentElement!.textContent).toContain("Passer cette partie dessous")
  expect(troisQuarts.parentElement!.textContent).toContain("Ramener cette partie dessus")
  expect(troisQuarts.parentElement!.textContent).toContain("sur cette frame seule")
  fireEvent.change(ordre, { target: { value: "derriere" } })
  expect(onRegler).toHaveBeenCalledWith({ devant: false })
})

test("l'atelier du calque dit que la direction de la base ne change pas l'ordre", async () => {
  render(<EditeurCalqueCible chemin={chemin} variante={variante} onGarde={vi.fn()} onSale={vi.fn()} />)
  await screen.findByAltText("Aperçu du calque sur sa base")
  expect(screen.getByText(/la direction de cette base \(ouest\) ne change rien/)).toBeInTheDocument()
  expect(screen.getByText(/sur cette frame seule/)).toBeInTheDocument()
  expect(screen.getByText("Aucun passage peint ici : toute la pièce suit l’ordre par défaut.")).toBeInTheDocument()
  // Les deux pinceaux qui font passer une partie dessous et l'autre dessus.
  expect(screen.getByRole("option", { name: "Passer cette partie dessous" })).toBeInTheDocument()
  expect(screen.getByRole("option", { name: "Ramener cette partie dessus" })).toBeInTheDocument()
})

test("un passage peint sur cette frame se compte, et l'ordre par défaut reste lisible", async () => {
  const peinte = { ...variante, masques: { calque: [], corps: [], derriere: [{ garde: true, rayon: 2, points: [[30, 19]], couleur: "" }] } } as VarianteCalque
  render(<EditeurCalqueCible chemin={chemin} variante={peinte} onGarde={vi.fn()} onSale={vi.fn()} />)
  await screen.findByAltText("Aperçu du calque sur sa base")
  expect(screen.getByText("1 passage peint ici : une partie de la pièce ne suit pas l’ordre par défaut.")).toBeInTheDocument()
  expect(screen.getByLabelText("Ordre du calque")).toHaveValue("true")
})

// ── L'image équipée lue comme sa pose (18 septembre 2026) ────────────────────
//
// La pose « repos · est » de Champy sortait à 221 × 451 de sa recette, l'image
// équipée arrivait brute à 1024 × 1024. Le serveur la lit désormais avec la
// recette de la pose et la ramène à son échelle ; l'écran doit le **dire**,
// laisser le retirer, et montrer les deux corps ensemble d'emblée.

const preparee: VarianteCalque = {
  ...variante, identifiant: "source-1", role: "source-equipee", etat: "a-extraire", revision: 1,
  cible: { nature: "image", resultat: "pose-est", prise: "" },
  base: { cadre: { largeur: 64, hauteur: 64 }, repere: { x: 32, y: 64 }, pose: "repos", direction: "est" },
  calque_cadre: { largeur: 64, hauteur: 64 },
  preparation: { recette: "pose", echelle: true, depuis: { pose: "repos", direction: "est" }, appliquee: ["détourage", "cadre et échelle de la pose", "couleurs de la pose"], laissee: ["le contour — l’image envoyée au modèle le portait déjà"], cadre_source: { largeur: 256, hauteur: 256 }, facteur: 0.25, x: 0, y: 0, accord: 0.94, dehors: 0.12 },
}

test("l'image équipée dit quelle recette l'a lue, se voit sur sa pose, et la recette se retire", async () => {
  const reprendre = vi.spyOn(apiCalques, "reprendreSource").mockResolvedValue({ ...preparee, revision: 2, preparation: { ...preparee.preparation!, recette: "sienne" } })
  const onRetoucher = vi.fn(), onGarde = vi.fn()
  render(<EditeurCalqueCible chemin={chemin} variante={preparee} nomDeLaPose="Repos" onGarde={onGarde} onSale={vi.fn()} onRetoucher={onRetoucher} />)
  // Les deux corps ensemble, d'emblée : la pose dessous, l'image équipée dessus.
  expect(screen.getByRole("button", { name: "Les deux superposés" })).toHaveAttribute("aria-pressed", "true")
  expect(screen.getByAltText("Pose de référence sous l’image équipée")).toHaveAttribute("src", expect.stringContaining("vue=base"))
  expect(screen.getByAltText("Image équipée posée sur la pose")).toHaveAttribute("src", expect.stringContaining("vue=source"))
  expect(apiCalques.apercu).not.toHaveBeenCalled()
  expect(document.querySelector("[data-recette-appliquee]")).toHaveTextContent("Recette de Repos · est appliquée : détourage, cadre et échelle de la pose, couleurs de la pose.")
  expect(screen.getByText(/12 % de l’image équipée tombe hors du cadre/)).toBeInTheDocument()
  // La chaîne se lit dans l'ordre.
  const titres = screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent)
  expect(titres).toEqual(["1 · Pose de référence", "2 · Image équipée, lue comme la pose", "3 · Caler les deux corps", "4 · Isoler ce qui s’ajoute", "5 · Retoucher à la main"])
  fireEvent.click(screen.getByRole("button", { name: "Retoucher l’image équipée…" }))
  expect(onRetoucher).toHaveBeenCalledWith("source")
  fireEvent.click(screen.getByRole("button", { name: "Sa propre recette" }))
  await waitFor(() => expect(onGarde).toHaveBeenCalled())
  expect(reprendre).toHaveBeenCalledWith(chemin, "source-1", 1, "sienne", true)
})

test("le calage déplace l'image équipée sur la pose sans attendre le serveur", async () => {
  render(<EditeurCalqueCible chemin={chemin} variante={preparee} onGarde={vi.fn()} onSale={vi.fn()} />)
  const dessus = screen.getByAltText("Image équipée posée sur la pose")
  fireEvent.change(screen.getByLabelText("Déplacement horizontal — valeur"), { target: { value: "5" } })
  // Zoom « Adapter » sans place mesurée : 400 %, donc 5 pixels d'image font 20 pixels d'écran.
  expect(dessus.style.left).toBe("20px")
  expect(apiCalques.apercu).not.toHaveBeenCalled()
})

test("placeDuDessus suit la règle d'`aligner` : même cadre, image trop grande, échelle", () => {
  expect(placeDuDessus(64, 64, 64, 64, 1, 0, 0)).toEqual({ left: 0, top: 0, width: 64, height: 64 })
  expect(placeDuDessus(64, 64, 64, 64, 1, 3, -2)).toEqual({ left: 3, top: -2, width: 64, height: 64 })
  // Trop grande : ramenée pour tenir, centrée.
  expect(placeDuDessus(256, 128, 64, 64, 1, 0, 0)).toEqual({ left: 0, top: 16, width: 64, height: 32 })
  // Plus petite : au coin, à sa taille.
  expect(placeDuDessus(32, 32, 64, 64, 1, 0, 0)).toEqual({ left: 0, top: 0, width: 32, height: 32 })
  expect(placeDuDessus(64, 64, 64, 64, 0.5, 0, 0)).toEqual({ left: 16, top: 16, width: 32, height: 32 })
})

test("sur une pose, l'image fabriquée d'après elle s'associe d'un clic, à la pose que sa génération nomme", async () => {
  const poseEst = { cible: { nature: "image" as const, resultat: "pose-est", prise: "" }, pose: "marche", direction: "est", image: { ...image, identifiant: "pose-est", label: "Marche est" } }
  const poseOuest = { cible: { nature: "image" as const, resultat: "pose-ouest", prise: "" }, pose: "marche", direction: "ouest", image: { ...image, identifiant: "pose-ouest", label: "Marche ouest" } }
  vi.spyOn(apiCalques, "cibles").mockResolvedValue({ ...structuredClone(donnees), cibles: [poseEst, poseOuest], variantes: [] })
  vi.spyOn(apiCalques, "fabriqueesDApres").mockResolvedValue({ images: [{ image: { ...image, identifiant: "baton-1", label: "Avec un bâton" }, deja: false }] })
  const references = vi.spyOn(apiCalques, "posesDeReference").mockResolvedValue({ poses: [{ ...poseEst, raison: "l'image à modifier de sa génération" }] })
  const creer = vi.spyOn(apiCalques, "creer").mockResolvedValue({ ...preparee, source: "baton-1", cible: poseEst.cible })
  render(<CalquesDeLEmploi projet="marais" emploi={emploi} piece={piece} porteur={personnage} emplacements={[]} onRegler={vi.fn()} onHistorique={vi.fn()} onLesAutresEmplois={vi.fn()} />)
  const proposees = await screen.findByRole("region", { name: "Fabriquées d’après cette pose" })
  expect(apiCalques.fabriqueesDApres).toHaveBeenCalledWith({ projet: "marais", piece: "epee", emploi: "porte-pelerin" }, "pose-est")
  fireEvent.click(within(proposees).getByRole("button", { name: /Avec un bâton/ }))
  await waitFor(() => expect(creer).toHaveBeenCalledWith(chemin, poseEst.cible, "baton-1", "source-equipee"))
  expect(references).toHaveBeenCalledWith(chemin, "baton-1")
  expect(await screen.findByLabelText("Éditeur du calque ciblé")).toBeInTheDocument()
})

test("choisie depuis une autre pose, l'image équipée va d'office à celle que sa génération nomme", async () => {
  const poseEst = { cible: { nature: "image" as const, resultat: "pose-est", prise: "" }, pose: "marche", direction: "est", image: { ...image, identifiant: "pose-est", label: "Marche est" } }
  const poseOuest = { cible: { nature: "image" as const, resultat: "pose-ouest", prise: "" }, pose: "marche", direction: "ouest", image: { ...image, identifiant: "pose-ouest", label: "Marche ouest" } }
  vi.spyOn(apiCalques, "cibles").mockResolvedValue({ ...structuredClone(donnees), cibles: [poseOuest, poseEst], variantes: [] })
  vi.spyOn(apiCalques, "fabriqueesDApres").mockResolvedValue({ images: [] })
  vi.spyOn(apiCalques, "posesDeReference").mockResolvedValue({ poses: [{ ...poseEst, raison: "sa planche partait de cette pose" }] })
  vi.spyOn(api, "arbre").mockResolvedValue({ collections: [] } as never)
  vi.spyOn(api, "assets").mockResolvedValue({ assets: [image], total: 1 })
  const creer = vi.spyOn(apiCalques, "creer").mockResolvedValue({ ...preparee, cible: poseEst.cible })
  render(<CalquesDeLEmploi projet="marais" emploi={emploi} piece={piece} porteur={personnage} emplacements={[]} onRegler={vi.fn()} onHistorique={vi.fn()} onLesAutresEmplois={vi.fn()} />)
  fireEvent.click(await screen.findByRole("button", { name: "Choisir une image dans la bibliothèque" }))
  fireEvent.click(await screen.findByRole("button", { name: "Choisir Épée sur le pèlerin" }))
  fireEvent.click(screen.getByRole("button", { name: "Associer cette image" }))
  await waitFor(() => expect(creer).toHaveBeenCalledWith(chemin, poseEst.cible, "source", "source-equipee"))
  expect(await screen.findByText(/Associée à Marche · est : sa planche partait de cette pose/)).toBeInTheDocument()
})

test("depuis la retouche, la pose de référence de la génération est présélectionnée", async () => {
  vi.spyOn(api, "emploisDuJeu").mockResolvedValue({ pieces: [{ piece, emplois: [emploi], declare: true, fait: 0, attendu: 0 }], porteurs: [{ identifiant: "pelerin", nom: "Le pèlerin" }] } as unknown as VestiaireDuJeu)
  vi.spyOn(apiCalques, "posesDeReference").mockResolvedValue({ poses: [{ cible: donnees.cibles[1].cible, pose: "marche", direction: "ouest", raison: "une image de référence de sa génération", image }] })
  const creer = vi.spyOn(apiCalques, "creer").mockResolvedValue(preparee)
  render(<AssocierImageEquipement image={image} projet="marais" onFermer={vi.fn()} />)
  await screen.findByRole("option", { name: "Épée divine" })
  fireEvent.change(screen.getByLabelText("Pièce de cette image"), { target: { value: "epee" } })
  fireEvent.change(screen.getByLabelText("Emploi de cette image"), { target: { value: "porte-pelerin" } })
  await waitFor(() => expect(screen.getByRole("button", { name: /Marche lente · frame 2/ })).toHaveAttribute("aria-pressed", "true"))
  expect(screen.getByLabelText("Rôle de l’image associée")).toHaveValue("source-equipee")
  expect(document.querySelector("[data-pose-de-reference]")).toHaveTextContent("Fabriquée d’après marche · ouest")
  fireEvent.click(screen.getByRole("button", { name: "Associer à cette cible" }))
  await waitFor(() => expect(creer).toHaveBeenCalledWith(chemin, donnees.cibles[1].cible, "source", "source-equipee"))
})

test("sans rappel de retour, l'écran n'invente aucun bouton vers le personnage", async () => {
  render(<CalquesDeLEmploi projet="marais" emploi={emploi} piece={piece} porteur={personnage} emplacements={[]} onRegler={vi.fn()} onHistorique={vi.fn()} onLesAutresEmplois={vi.fn()} />)
  await screen.findByRole("button", { name: /Marche lente · frame 1/ })
  expect(screen.queryByRole("button", { name: /^‹ / })).toBeNull()
})
