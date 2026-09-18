// La fenêtre unique de préparation (`RP4`).
//
// **Ce fichier remplace `ChoisirFabricationDuSujet.test.tsx`**, dont l'écran a
// disparu : ses trois portes sont devenues le choix *Type de résultat*, et ses
// deux listes — mouvement et direction — sont ici, à la même place, avec les
// mêmes groupes. Les quatre essais de l'aiguillage sont repris un par un ; seuls
// les noms qu'ils cherchent ont changé, parce que les boutons ont changé de nom.

import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, expect, test, vi } from "vitest"
import type { ObjectifProduction, Personnage, Pose } from "../api"
import { PreparerUneFabrication } from "./PreparerUneFabrication"

vi.mock("./FabricationSuivie", () => ({
  FabricationSuivie: () => <p>corps du clip d’un sujet</p>,
}))
vi.mock("./FabricationVideoLibre", () => ({
  FabricationVideoLibre: () => <p>corps du clip libre</p>,
}))
vi.mock("./FabricationAudio", () => ({
  FabricationAudio: () => <p>corps du son</p>,
}))
vi.mock("./Fabrication3D", () => ({
  Parcours3D: () => <p>corps du rendu 3D</p>,
}))
vi.mock("./WorkflowsLocaux", () => ({
  FabricationImageLocale: () => <p>corps du workflow importé</p>,
}))

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
    identifiant: "voyageuse",
    nom: "La voyageuse",
    objectif: objectifDuSujet,
    cases: [
      { pose: "repos", directions: [] },
      { pose: "marche", directions: [{ identifiant: "est", nom: "Est" }] },
    ],
  } as unknown as Personnage
}

function ouvrir(champs: Partial<Parameters<typeof PreparerUneFabrication>[0]> = {}) {
  return render(
    <PreparerUneFabrication
      projet="jeu"
      sujet={sujet(objectif)}
      plan={plan}
      personnages={[]}
      preparationImage={<p>corps de l’image du catalogue</p>}
      onViser={vi.fn()}
      onClip={vi.fn()}
      onFermer={vi.fn()}
      {...champs}
    />,
  )
}

const typeDeResultat = () => screen.getByLabelText("Type de résultat") as HTMLSelectElement

test("le type de résultat est le premier choix, et il en existe quatre — pas trois portes", () => {
  ouvrir()
  const choix = typeDeResultat()
  expect([...choix.options].map((o) => o.textContent)).toEqual([
    "Image fixe",
    "Clip",
    "Son",
    "Rendu 3D",
  ])
  // Les trois portes de l'aiguillage ne sont plus des boutons : elles sont des
  // valeurs de cette liste-là.
  expect(screen.queryByRole("button", { name: /une animation depuis une vidéo/i })).toBeNull()
  expect(screen.queryByRole("button", { name: /un modèle 3D et ses animations/i })).toBeNull()
})

test("changer de type change le corps, et la fenêtre ne se ferme pas", () => {
  const onFermer = vi.fn()
  ouvrir({ onFermer })
  expect(screen.getByText("corps de l’image du catalogue")).toBeTruthy()

  fireEvent.change(typeDeResultat(), { target: { value: "clip" } })
  expect(screen.getByText("corps du clip d’un sujet")).toBeTruthy()

  fireEvent.change(typeDeResultat(), { target: { value: "son" } })
  expect(screen.getByText("corps du son")).toBeTruthy()

  fireEvent.change(typeDeResultat(), { target: { value: "rendu-3d" } })
  expect(screen.getByText("corps du rendu 3D")).toBeTruthy()

  // Un seul titre, une seule fenêtre, du premier type au dernier.
  expect(screen.getAllByRole("heading", { level: 1 }).map((h) => h.textContent)).toEqual([
    "Préparer une fabrication",
  ])
  expect(onFermer).not.toHaveBeenCalled()
})

test("les deux fabriques d’une image fixe se choisissent dans la fenêtre", () => {
  ouvrir()
  expect(screen.getByText("corps de l’image du catalogue")).toBeTruthy()
  fireEvent.change(screen.getByLabelText("Avec quoi"), { target: { value: "workflow" } })
  expect(screen.getByText("corps du workflow importé")).toBeTruthy()
})

test("un clip se prépare pour le sujet ou sans lui, et cela se choisit ici", () => {
  ouvrir()
  fireEvent.change(typeDeResultat(), { target: { value: "clip" } })
  expect(screen.getByText("corps du clip d’un sujet")).toBeTruthy()
  fireEvent.change(screen.getByLabelText("Pour"), { target: { value: "libre" } })
  expect(screen.getByText("corps du clip libre")).toBeTruthy()
})

// Repris de `ChoisirFabricationDuSujet.test.tsx` — l'animation visée par
// l'objectif l'emporte, la direction suit, et les deux groupes de poses restent.
test("la fenêtre range l’animation visée en tête, et choisir l’arme avec sa direction", () => {
  const onViser = vi.fn()
  const voyageuse = sujet(objectif)
  ouvrir({ sujet: voyageuse, onViser })
  expect(document.querySelector('optgroup[label="Dans l’objectif"]')).toBeTruthy()
  expect(document.querySelector('optgroup[label="Autres poses du plan"]')).toBeTruthy()

  fireEvent.change(screen.getByLabelText("Mouvement ou pose"), { target: { value: "marche" } })
  expect((screen.getByLabelText("Direction") as HTMLSelectElement).value).toBe("est")
  expect(onViser).toHaveBeenLastCalledWith(voyageuse, plan[1], "est")

  fireEvent.change(screen.getByLabelText("Mouvement ou pose"), { target: { value: "repos" } })
  expect(onViser).toHaveBeenLastCalledWith(voyageuse, plan[0], null)
})

// **La liste montre ce qui partira** : rien n'est armé, donc aucune case — et
// l'image est déjà rattachée au sujet ouvert, sans pose.
test("ouverte depuis une fiche, l’image est au sujet, sans case visée", () => {
  const onViser = vi.fn()
  const voyageuse = sujet()
  ouvrir({ sujet: voyageuse, onViser })
  expect((screen.getByLabelText("Mouvement ou pose") as HTMLSelectElement).value).toBe("")
  expect((screen.getByLabelText("Sujet de l’image") as HTMLSelectElement).value).toBe("voyageuse")
  expect(onViser).toHaveBeenCalledWith(voyageuse, null, null)
})

test("le sujet de l’image se change, ou se retire pour une image libre", () => {
  const onViser = vi.fn()
  const autre = { ...sujet(), identifiant: "champy", nom: "Champy" } as Personnage
  ouvrir({ personnages: [autre], onViser })
  fireEvent.change(screen.getByLabelText("Sujet de l’image"), { target: { value: "champy" } })
  expect(onViser).toHaveBeenLastCalledWith(autre, null, null)
  fireEvent.change(screen.getByLabelText("Sujet de l’image"), { target: { value: "" } })
  expect(onViser).toHaveBeenLastCalledWith(null, null, null)
  expect(screen.queryByLabelText("Mouvement ou pose")).toBeNull()
})

// Repris de `ChoisirFabricationDuSujet.test.tsx` — `RP13`. Le renvoi mène à
// l'onglet qui sait déclarer un mouvement ; seul le mot du bouton a changé.
test("liste vide : le renvoi vers Objectif & règles y mène vraiment", () => {
  const onObjectif = vi.fn()
  ouvrir({ sujet: sujet(), plan: [], onObjectif })
  fireEvent.click(screen.getByRole("button", { name: "Ajouter un mouvement dans Objectif & règles" }))
  expect(onObjectif).toHaveBeenCalled()
})

test("un type qu’on ne peut pas préparer d’ici est grisé, avec sa raison", () => {
  ouvrir({ sujet: null })
  const rendu = [...typeDeResultat().options].find((o) => o.value === "rendu-3d")!
  expect(rendu.disabled).toBe(true)
  expect(rendu.textContent).toContain("un rendu 3D part d’un sujet")
})
