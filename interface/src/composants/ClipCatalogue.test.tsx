// Redemander le catalogue vidéo, depuis l'écran du clip (`RP18`).
//
// **La route existait depuis `A9` et personne ne l'appelait.** Le côté image a
// ce geste depuis toujours : quand le catalogue tombe, un clic le redemande.
// Côté vidéo, une liste vide se lisait jusqu'à ce qu'on ferme l'atelier — et
// une liste vide, c'est un écran où plus rien ne peut partir.
//
// **Rien ici ne dépense** : on redemande à un fournisseur la liste de ce qu'il
// vend, pas une image. `fetch` n'est jamais appelé — chaque fonction d'`api`
// employée par l'écran est doublée.

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, expect, test, vi } from "vitest"

import { EcranClip, type CibleDuClip } from "./Clip"
import {
  api,
  type BaseModelesVideo,
  type ModeleVideo,
  type MouvementDeLaPose,
  type Personnage,
  type Pose,
} from "../api"

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

const CIBLE: CibleDuClip = {
  personnage: {
    identifiant: "le-goliath",
    nom: "Le goliath",
    description: "",
    cases: [],
    pieces: [],
  } as unknown as Personnage,
  pose: null,
  direction: null,
}

/** Un catalogue vidéo **vide**, avec la panne écrite : c'est l'état où le
 *  bouton a un sens, et le seul où il paraît. */
function videAvecSaPanne(modeles: BaseModelesVideo["modeles"] = []): BaseModelesVideo {
  return {
    modeles,
    recu_le: 1_787_800_000,
    raison: "le fournisseur n'a pas répondu",
    manque: null,
    decodeur: null,
    moteurs: [],
    demande: { secondes: 5, resolution: "480p", proportions: "1:1" },
  } as BaseModelesVideo
}

/** Un modèle, réduit à ce que la colonne en lit. Ce qu'on mesure ici est la
 *  présence du bouton, pas la carte d'un modèle — elle a ses essais. */
const UN_MODELE: ModeleVideo = {
  identifiant: "un/modele",
  nom: "Un modèle",
  fournisseur: "Un fournisseur",
  durees: [1, 5],
  resolutions: ["480p"],
  proportions: ["1:1"],
  mesure: "",
  prix: { montant: 0.1, formule: "par clip", nature: "certain", releve_le: null },
  grise: null,
  de_la_maison: false,
  images_par_seconde: 16,
  duree_conseillee: 5,
  raison_de_la_duree: "",
  images_par_duree: { "5": 81 },
  attente: null,
} as ModeleVideo

const bouton = () =>
  document.querySelector("[data-redemander-le-catalogue-video]") as HTMLButtonElement

beforeEach(() => {
  vi.spyOn(api, "imageDeDepart").mockResolvedValue({
    asset: null,
    raison: "aucune image",
  } as Awaited<ReturnType<typeof api.imageDeDepart>>)
  vi.spyOn(api, "mouvements").mockResolvedValue({ mouvements: [], masques: [] } as Awaited<
    ReturnType<typeof api.mouvements>
  >)
})

test("un catalogue vide offre de le redemander, et le geste relit la liste", async () => {
  const liste = vi
    .spyOn(api, "modelesVideo")
    .mockResolvedValueOnce(videAvecSaPanne())
    .mockResolvedValue(
      videAvecSaPanne([UN_MODELE]),
    )
  const redemande = vi
    .spyOn(api, "rafraichirCatalogueVideo")
    .mockResolvedValue({} as Awaited<ReturnType<typeof api.rafraichirCatalogueVideo>>)

  render(<EcranClip cible={CIBLE} onFermer={vi.fn()} onCommande={vi.fn()} />)

  await waitFor(() => expect(bouton()).toBeTruthy())
  expect(screen.getByText("le fournisseur n'a pas répondu")).toBeTruthy()

  fireEvent.click(bouton())

  // **Deux appels, et l'ordre compte** : on redemande la liste aux
  // fournisseurs, puis on la relit *avec la demande en cours* — durée, format,
  // résolution —, sans quoi les prix affichés ne seraient ceux d'aucun réglage.
  await waitFor(() => expect(redemande).toHaveBeenCalledTimes(1))
  await waitFor(() => expect(liste).toHaveBeenCalledTimes(2))
  expect(liste).toHaveBeenLastCalledWith(1.5, "480p", "1:1")
})

test("un catalogue rempli ne montre pas le bouton", async () => {
  vi.spyOn(api, "modelesVideo").mockResolvedValue(videAvecSaPanne([UN_MODELE]))

  render(<EcranClip cible={CIBLE} onFermer={vi.fn()} onCommande={vi.fn()} />)

  await waitFor(() => expect(screen.queryByText(/redemander le catalogue/)).toBeNull())
})

// ── SC3 : l'écran affiche ce que le serveur a composé, jamais un recollage ──

const POSE: Pose = {
  identifiant: "attaque",
  nom: "attaque",
  images: 1,
  consigne: "",
  ecartees: [],
} as unknown as Pose

test("l'écran affiche le texte que le serveur a composé — la phrase, puis le style, pas le mouvement seul", async () => {
  vi.spyOn(api, "modelesVideo").mockResolvedValue(videAvecSaPanne([UN_MODELE]))
  const mouvementAttaque = {
    identifiant: "attaque",
    nom: "attaque",
    texte: "attack, winding up",
    cadence: 14,
    directions: [],
    livre: true,
    masque: false,
  }
  vi.spyOn(api, "mouvements").mockResolvedValue({
    mouvements: [mouvementAttaque],
    masques: [],
  } as Awaited<ReturnType<typeof api.mouvements>>)

  // **Le serveur seul compose** : le texte qu'il rend ici n'est ni la phrase
  // de la direction ni le texte du mouvement pris isolément — c'est le style
  // du bâton que `ServiceStyles` a résolu pour ce personnage. Si l'écran
  // recollait lui-même la phrase et le texte du mouvement, il afficherait
  // autre chose que ceci.
  const composition: MouvementDeLaPose = {
    pose: "attaque",
    mouvement: mouvementAttaque,
    texte: "Seen from the front. a horizontal swing with the wooden staff",
    direction: "Seen from the front.",
    geste: "a horizontal swing with the wooden staff",
    origine: "mouvement",
    style: { identifiant: "baton", nom: "bâton" },
    origine_du_style: "choisi",
    piece_du_style: null,
  }
  vi.spyOn(api, "mouvementDeLaPose").mockResolvedValue(composition)

  render(
    <EcranClip
      cible={{ ...CIBLE, pose: POSE }}
      onFermer={vi.fn()}
      onCommande={vi.fn()}
    />,
  )

  const texte = await waitFor(() => {
    const trouve = document.querySelector("[data-texte-du-clip]")
    if (!trouve || !trouve.textContent?.includes("horizontal swing")) {
      throw new Error("le texte du serveur n'est pas encore affiché")
    }
    return trouve
  })
  expect(texte.textContent).toBe(composition.texte)

  // Et la ligne d'origine, en clair, sous le texte.
  expect(screen.getByText("Style : bâton (choisi)")).toBeTruthy()
})

test("un refus des fournisseurs se dit, et le bouton redevient cliquable", async () => {
  vi.spyOn(api, "modelesVideo").mockResolvedValue(videAvecSaPanne())
  vi.spyOn(api, "rafraichirCatalogueVideo").mockRejectedValue(
    new Error("aucune clé de fournisseur vidéo"),
  )

  render(<EcranClip cible={CIBLE} onFermer={vi.fn()} onCommande={vi.fn()} />)
  await waitFor(() => expect(bouton()).toBeTruthy())

  fireEvent.click(bouton())

  await waitFor(() => expect(screen.getByText(/aucune clé de fournisseur vidéo/)).toBeTruthy())
  expect(bouton().disabled).toBe(false)
})
