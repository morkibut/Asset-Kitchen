import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, expect, test, vi } from "vitest"
import { api, type ObjectifDuPersonnage, type Personnage } from "../api"
import { ObjectifDuSujet } from "./ObjectifDuSujet"

afterEach(() => { cleanup(); vi.restoreAllMocks() })

const personnage = { identifiant: "pelerin", nom: "Le pèlerin" } as Personnage
const compte = { demande: 0, produit: 0, retenu: 0, manquant: 0, a_retenir: 0 }
const lecture: ObjectifDuPersonnage = {
  personnage: "pelerin", origine: "explicite",
  objectif: { sorties: [{ nature: "animation", pose: "marche", direction: "ouest", quantite: 1 }],
    largeur: 96, hauteur: 128, cadence: 11, boucle: false, repere: { x: 41.5, y: 117 } },
  couverture: {
    images: compte,
    animations: { demande: 1, produit: 0, retenu: 0, manquant: 1, a_retenir: 1 },
    cases: ["ouest", "sud"].flatMap((direction) => (["image", "animation"] as const).map((nature) => ({
      identifiant: `${nature}-${direction}`, nature, pose: "marche", direction, quantite: nature === "animation" && direction === "ouest" ? 1 : 0,
      nom_pose: "Marche", nom_direction: direction === "ouest" ? "Ouest" : "Sud", ...compte,
      demande: nature === "animation" && direction === "ouest" ? 1 : 0,
      etat: "non-demande" as const, versions: { retenues: [], a_juger: [], ecartees: [] },
    }))),
  },
}

test("l'objectif animé se rouvre avec cadence, boucle et repère non défaut puis se corrige", async () => {
  const lire = vi.spyOn(api, "objectifPersonnage").mockResolvedValue(structuredClone(lecture))
  const sauver = vi.spyOn(api, "definirObjectifPersonnage").mockImplementation(async (_id, objectif) => ({ ...structuredClone(lecture), objectif }))
  const montage = render(<ObjectifDuSujet personnage={personnage} projet="marais" />)
  await screen.findByText("Non demandées")
  fireEvent.click(screen.getByRole("button", { name: "Modifier l’objectif" }))
  expect(screen.getByLabelText("Cadence (images/s)")).toHaveValue(11)
  expect(screen.getByLabelText("Rejouer en boucle")).not.toBeChecked()
  expect(screen.getByLabelText("Repère Y (px)")).toHaveValue(117)
  expect(screen.getByLabelText("Marche · Ouest · animation")).toBeChecked()
  expect(screen.getByLabelText("Marche · Sud · animation")).not.toBeChecked()
  fireEvent.click(screen.getByLabelText("Marche · Sud · animation"))
  fireEvent.change(screen.getByLabelText("Cadence (images/s)"), { target: { value: "13" } })
  fireEvent.click(screen.getByRole("button", { name: "Enregistrer l’objectif" }))
  await screen.findByText("Objectif enregistré. Les résultats existants restent disponibles.")
  expect(sauver).toHaveBeenCalledWith("pelerin", expect.objectContaining({ cadence: 13, boucle: false, sorties: [
    { nature: "animation", pose: "marche", direction: "ouest", quantite: 1 },
    { nature: "animation", pose: "marche", direction: "sud", quantite: 1 },
  ] }), "marais")
  const garde = await sauver.mock.results[0].value
  montage.unmount()
  lire.mockResolvedValue(garde)
  render(<ObjectifDuSujet personnage={personnage} projet="marais" />)
  fireEvent.click(await screen.findByRole("button", { name: "Modifier l’objectif" }))
  expect(screen.getByLabelText("Cadence (images/s)" )).toHaveValue(13)
  expect(screen.getByLabelText("Marche · Sud · animation")).toBeChecked()
})

test("un refus conserve l'édition et aucune fausse confirmation ne paraît", async () => {
  vi.spyOn(api, "objectifPersonnage").mockResolvedValue(structuredClone(lecture))
  vi.spyOn(api, "definirObjectifPersonnage").mockRejectedValue(new Error("La direction vient d'être retirée du jeu."))
  render(<ObjectifDuSujet personnage={personnage} projet="marais" />)
  fireEvent.click(await screen.findByRole("button", { name: "Modifier l’objectif" }))
  fireEvent.click(screen.getByRole("button", { name: "Ne rien demander" }))
  fireEvent.click(screen.getByRole("button", { name: "Enregistrer l’objectif" }))
  expect(await screen.findByRole("alert")).toHaveTextContent("La direction vient d'être retirée")
  expect(screen.getByLabelText("Marche · Ouest · animation")).not.toBeChecked()
  expect(screen.queryByText("Objectif enregistré.", { exact: false })).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole("button", { name: "Annuler" }))
  await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument())
})
