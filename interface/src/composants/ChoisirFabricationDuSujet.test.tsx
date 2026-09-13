import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, expect, test, vi } from "vitest"
import type { ObjectifProduction, Personnage, Pose } from "../api"
import { ChoisirFabricationDuSujet } from "./ChoisirFabricationDuSujet"

afterEach(() => cleanup())

const plan: Pose[] = [
  { identifiant: "repos", nom: "Repos", images: 1, consigne: "", ecartees: [], images_avant: 0 },
  { identifiant: "marche", nom: "Marche", images: 8, consigne: "", ecartees: [], images_avant: 0 },
]

const objectif: ObjectifProduction = {
  sorties: [{ nature: "animation", pose: "marche", direction: "est", quantite: 1 }],
  largeur: 64, hauteur: 64, cadence: 8, boucle: true, repere: { x: 32, y: 64 },
}

function sujet(objectifDuSujet?: ObjectifProduction): Personnage {
  return {
    nom: "La voyageuse",
    objectif: objectifDuSujet,
    cases: [
      { pose: "repos", directions: [] },
      { pose: "marche", directions: [{ identifiant: "est", nom: "Est" }] },
    ],
  } as unknown as Personnage
}

test("la fabrication privilégie l’animation visée et transmet pose et direction à chaque source", () => {
  const onImage = vi.fn()
  const onVideo = vi.fn()
  const on3D = vi.fn()
  render(<ChoisirFabricationDuSujet personnage={sujet(objectif)} plan={plan} onFermer={vi.fn()} onImage={onImage} onVideo={onVideo} on3D={on3D} />)

  expect((screen.getByLabelText("Mouvement ou pose") as HTMLSelectElement).value).toBe("marche")
  expect((screen.getByLabelText("Direction") as HTMLSelectElement).value).toBe("est")
  expect(document.querySelector('optgroup[label="Autres poses du plan"]')).toBeTruthy()

  fireEvent.click(screen.getByRole("button", { name: /une animation depuis une vidéo/i }))
  fireEvent.click(screen.getByRole("button", { name: /une image fixe/i }))
  fireEvent.click(screen.getByRole("button", { name: /un modèle 3D et ses animations/i }))
  expect(onVideo).toHaveBeenCalledWith(plan[1], "est")
  expect(onImage).toHaveBeenCalledWith(plan[1], "est")
  expect(on3D).toHaveBeenCalledWith(plan[1], "est")
})

// **Les portes d'import sont sorties en `AU21`.** Cet écran commence par
// demander *quel mouvement, quelle direction ?* — une question qui a un sens
// quand on va payer pour remplir une case, et aucun quand on pose un fichier
// qu'on a déjà. Ce qui entre du disque passe par « Importer… », qui regarde le
// fichier et enchaîne seul.
test("le dialogue n’offre que les trois portes payantes", () => {
  render(<ChoisirFabricationDuSujet personnage={sujet(objectif)} plan={plan} onFermer={vi.fn()} onImage={vi.fn()} onVideo={vi.fn()} on3D={vi.fn()} />)
  expect(screen.queryByRole("button", { name: /une image que tu as déjà/i })).toBeNull()
  expect(screen.queryByRole("button", { name: /une vidéo que tu as déjà/i })).toBeNull()
  expect(screen.getAllByRole("button", { name: /^une |^un /i })).toHaveLength(3)
})

test("sans objectif, le dialogue reprend la première pose historique", () => {
  render(<ChoisirFabricationDuSujet personnage={sujet()} plan={plan} onFermer={vi.fn()} onImage={vi.fn()} onVideo={vi.fn()} on3D={vi.fn()} />)
  expect((screen.getByLabelText("Mouvement ou pose") as HTMLSelectElement).value).toBe("repos")
})
