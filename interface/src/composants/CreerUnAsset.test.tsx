// AU2 — **créer un sujet et lui donner un objectif, depuis l'interface seule.**
//
// Le critère du plan porte sur l'absence d'agent : ni client MCP, ni cadre de
// délégation, ni configuration. Il se prouve en deux moitiés, et ce fichier
// tient la première bout à bout avec la seconde :
//
//  1. *Créer* — l'écran appelle la route HTTP de création, et rien d'autre. Le
//     serveur prouve ailleurs que MCP et interface lisent le même objectif
//     (`tests/test_au2.py`, `test_mcp_cree_definit_et_relit_le_meme_objectif…`) ;
//     ce qu'il faut montrer ici est qu'aucune des deux routes d'agent n'est
//     nécessaire pour arriver jusque-là.
//  2. *Lui donner un objectif* — l'onglet *Objectif & règles* enregistre des
//     valeurs non défaut, et les relit après fermeture.
//
// **Et créer ne commande aucune image** : c'est l'invariant du produit, écrit
// au pied de l'écran. L'essai le vérifie sur la route, pas sur la phrase.

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, expect, test, vi } from "vitest"
import { api, type ObjectifDuPersonnage, type Personnage, type Piece } from "../api"
import { CreerUnAsset } from "./CreerUnAsset"
import { ObjectifDuSujet } from "./ObjectifDuSujet"

afterEach(() => { cleanup(); vi.restoreAllMocks() })

const sentinelle = { identifiant: "la-sentinelle", projet: "marais", nom: "La sentinelle de contrôle" } as Personnage

const compte = { demande: 0, produit: 0, retenu: 0, manquant: 0, a_retenir: 0 }

/** Ce que le serveur rend d'un sujet neuf : son plan de poses, aucune sortie
 *  demandée. C'est l'état dans lequel la création dépose l'auteur. */
const vierge: ObjectifDuPersonnage = {
  personnage: "la-sentinelle", origine: "plan-existant",
  objectif: { sorties: [], largeur: 64, hauteur: 64, cadence: 8, boucle: true, repere: { x: 32, y: 63 } },
  couverture: {
    images: compte, animations: compte,
    cases: ["est"].flatMap((direction) => (["image", "animation"] as const).map((nature) => ({
      identifiant: `${nature}-${direction}`, nature, pose: "marche", direction, quantite: 0,
      nom_pose: "Marche", nom_direction: "Est", ...compte,
      etat: "non-demande" as const, versions: { retenues: [], a_juger: [], ecartees: [] },
    }))),
  },
}

test("créer un sujet n’appelle que la création, et aucune génération", async () => {
  const creer = vi.spyOn(api, "creerPersonnage").mockResolvedValue({ personnage: sentinelle })
  const piece = vi.spyOn(api, "ajouterPiece")
  const onPersonnage = vi.fn()
  render(<CreerUnAsset familleInitiale="personnages" onFermer={vi.fn()} onPersonnage={onPersonnage} onPiece={vi.fn()} />)

  fireEvent.change(screen.getByLabelText("Nom du sujet"), { target: { value: "La sentinelle de contrôle" } })
  fireEvent.change(screen.getByLabelText("Description créative"), { target: { value: "Immobile, casquée, lance au sol." } })
  fireEvent.click(screen.getByRole("button", { name: "Créer le sujet" }))

  await waitFor(() => expect(onPersonnage).toHaveBeenCalledWith(sentinelle))
  expect(creer).toHaveBeenCalledWith("La sentinelle de contrôle", "Immobile, casquée, lance au sol.", "personnages")
  // Aucune pièce, et surtout aucune demande d'image : l'écran l'annonce, et la
  // seule route touchée est celle de la création.
  expect(piece).not.toHaveBeenCalled()
  expect(screen.getByText("Aucune génération n’est lancée à cette étape.")).toBeInTheDocument()
})

test("un sujet sans nom ne part pas, et un refus laisse la saisie en place", async () => {
  const creer = vi.spyOn(api, "creerPersonnage").mockRejectedValue(new Error("Ce nom est déjà pris dans ce jeu."))
  render(<CreerUnAsset familleInitiale="personnages" onFermer={vi.fn()} onPersonnage={vi.fn()} onPiece={vi.fn()} />)

  expect(screen.getByRole("button", { name: "Créer le sujet" })).toBeDisabled()
  fireEvent.change(screen.getByLabelText("Nom du sujet"), { target: { value: "La sentinelle de contrôle" } })
  fireEvent.click(screen.getByRole("button", { name: "Créer le sujet" }))

  expect(await screen.findByRole("alert")).toHaveTextContent("Ce nom est déjà pris")
  expect(screen.getByLabelText("Nom du sujet")).toHaveValue("La sentinelle de contrôle")
  expect(creer).toHaveBeenCalledTimes(1)
})

test("la famille Équipement crée une pièce, jamais un personnage", async () => {
  const casque = { identifiant: "casque", nom: "Un casque de garde" } as Piece
  const piece = vi.spyOn(api, "ajouterPiece").mockResolvedValue({ piece: casque } as Awaited<ReturnType<typeof api.ajouterPiece>>)
  const personnage = vi.spyOn(api, "creerPersonnage")
  const onPiece = vi.fn()
  render(<CreerUnAsset familleInitiale="equipement" onFermer={vi.fn()} onPersonnage={vi.fn()} onPiece={onPiece} />)

  fireEvent.change(screen.getByLabelText("Nom du sujet"), { target: { value: "Un casque de garde" } })
  fireEvent.click(screen.getByRole("button", { name: "Créer le sujet" }))

  await waitFor(() => expect(onPiece).toHaveBeenCalledWith(casque))
  expect(piece).toHaveBeenCalledWith({ nom: "Un casque de garde", description: "" })
  expect(personnage).not.toHaveBeenCalled()
})

test("le sujet créé reçoit son objectif dans l’interface, et le relit après fermeture", async () => {
  vi.spyOn(api, "creerPersonnage").mockResolvedValue({ personnage: sentinelle })
  const onPersonnage = vi.fn()
  const creation = render(<CreerUnAsset familleInitiale="personnages" onFermer={vi.fn()} onPersonnage={onPersonnage} onPiece={vi.fn()} />)
  fireEvent.change(screen.getByLabelText("Nom du sujet"), { target: { value: "La sentinelle de contrôle" } })
  fireEvent.click(screen.getByRole("button", { name: "Créer le sujet" }))
  await waitFor(() => expect(onPersonnage).toHaveBeenCalledOnce())
  const cree = onPersonnage.mock.calls[0][0] as Personnage
  creation.unmount()

  // Le parcours enchaîne sur *Objectif & règles* — c'est l'onglet que la
  // création mémorise (`App.tsx`). Les valeurs choisies ne sont pas celles du
  // défaut : sans cela, une relecture ne prouverait rien.
  const lire = vi.spyOn(api, "objectifPersonnage").mockResolvedValue(structuredClone(vierge))
  const garder = vi.spyOn(api, "definirObjectifPersonnage")
    .mockImplementation(async (_id, objectif) => ({ ...structuredClone(vierge), origine: "explicite", objectif }))
  const premier = render(<ObjectifDuSujet personnage={cree} projet="marais" />)
  fireEvent.click(await screen.findByRole("button", { name: "Modifier l’objectif" }))
  fireEvent.click(screen.getByRole("button", { name: "Commencer par une animation" }))
  fireEvent.change(screen.getByLabelText("Cadence (images/s)"), { target: { value: "11" } })
  fireEvent.change(screen.getByLabelText("Repère X (px)"), { target: { value: "29" } })
  fireEvent.click(screen.getByLabelText("Rejouer en boucle"))
  fireEvent.click(screen.getByRole("button", { name: "Enregistrer l’objectif" }))
  await screen.findByText("Objectif enregistré. Les résultats existants restent disponibles.")

  expect(garder).toHaveBeenCalledWith("la-sentinelle", expect.objectContaining({
    cadence: 11, boucle: false, repere: { x: 29, y: 63 },
    sorties: [{ nature: "animation", pose: "marche", direction: "est", quantite: 1 }],
  }), "marais")

  // Fermer, rouvrir : l'écran relit ce que le serveur a gardé, et rien du
  // brouillon qui vient d'être quitté.
  const enregistre = await garder.mock.results[0].value
  premier.unmount()
  lire.mockResolvedValue(enregistre)
  render(<ObjectifDuSujet personnage={cree} projet="marais" />)
  fireEvent.click(await screen.findByRole("button", { name: "Modifier l’objectif" }))
  expect(screen.getByLabelText("Cadence (images/s)")).toHaveValue(11)
  expect(screen.getByLabelText("Repère X (px)")).toHaveValue(29)
  expect(screen.getByLabelText("Rejouer en boucle")).not.toBeChecked()
  expect(screen.getByLabelText("Marche · Est · animation")).toBeChecked()
})
