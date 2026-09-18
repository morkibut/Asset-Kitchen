// La fiche d'un asset — le bouton « Poser sur la toile » (US-540, AU2).
//
// **Monté seul, sans `App`.** La preuve d'écran de la réutilisation complète —
// cliquer, poser, retrouver la carte en réserve — appartient à `App.test.tsx`,
// où la galerie entière tourne avec son serveur doublé. Elle ne peut
// malheureusement pas s'y écrire aujourd'hui : la sélection de la galerie
// (`useGalerie`, `Galerie.tsx`) ne survit pas au clic qui ouvre une fiche dans
// l'arbre actuel — un défaut préexistant, présent avant cette tranche et sur
// le dernier commit, qui empêche toute fiche de s'ouvrir depuis la galerie
// dans les essais (`« découper part de la fiche »` et une vingtaine d'autres
// essais déjà en échec pour la même raison). Ce fichier isole donc la preuve
// qui reste possible sans dépendre de ce défaut : le bouton lui-même, sa
// présence conditionnée par la porte qu'`App` lui donne, et le geste qu'il
// déclenche.

import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"

import { api, UNIVERS_VIDE, type Asset, type Generation, type Recette } from "../api"
import { Fiche } from "./Fiche"

const RECETTE_VIDE: Recette = {
  passes: [],
  difference: null,
  recadrage: null,
  grille: null,
  quantification: null,
  bords: null,
  contours: null,
  retournement: null,
  main: null,
  veille: [],
  nom: null,
}

const UN_ASSET: Asset = {
  identifiant: "aaaa1111-0",
  generation: "aaaa1111",
  rang: 0,
  largeur: 1024,
  hauteur: 1024,
  type_media: "image/png",
  label: "un tonneau",
  recette: RECETTE_VIDE,
  rendu_largeur: 0,
  rendu_hauteur: 0,
  cree_le: 1_787_800_100,
  cout_usd: 0.0245,
  consomme: 0.0245,
  unite: "usd",
  provenance: "auteur",
  modele: "google/gemini-2.5-flash-image",
  personnage: null,
  pose: null,
  direction: null,
  piece: null,
  calque: null,
  lot: null,
  personnage_supprime: false,
  epingle: false,
  projet: "bac-a-sable",
  collection: null,
  parent: null,
  parent_supprime: false,
  favori: false,
  supprime_le: null,
  traite: false,
  empreinte: "abc123",
}

function monterLaFiche(onPoserSurLaToile?: () => void) {
  return render(
    <Fiche
      asset={UN_ASSET}
      univers={UNIVERS_VIDE}
      plan={[]}
      personnages={[]}
      onFermer={() => {}}
      onErreur={() => {}}
      onReinjecter={() => {}}
      onReglages={() => {}}
      onSupprimer={() => {}}
      onRetoucher={() => {}}
      onPoserSurLaToile={onPoserSurLaToile}
      onOuvrir={() => {}}
    />,
  )
}

describe("la fiche — « Poser sur la toile » (US-540)", () => {
  beforeEach(() => {
    // Les deux effets de la fiche (l'imposé du projet, la génération d'origine)
    // appellent le serveur ; ce test ne regarde ni l'un ni l'autre, et un
    // réseau qui échoue est déjà le chemin que la fiche sait montrer — elle met
    // `impose` et `generation` à `null` et continue. Le doubler en échec évite
    // simplement un vrai appel réseau pendant l'essai.
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.reject(new Error("essai : aucun serveur"))),
    )
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  test("le bouton pose l'asset sur la toile, sans passer par un générateur", () => {
    // Critère AU2 : « La galerie [...] permet l'ouverture et la réutilisation
    // sur la toile sans nouvelle fabrication (US-540). » Ici : le bouton
    // n'appelle que le geste qu'on lui donne — jamais une route de génération.
    const onPoserSurLaToile = vi.fn()
    monterLaFiche(onPoserSurLaToile)

    const bouton = screen.getByRole("button", { name: "Poser sur la toile" })
    fireEvent.click(bouton)

    expect(onPoserSurLaToile).toHaveBeenCalledTimes(1)
  })

  test("absent quand la fiche n'a pas de toile à côté d'elle", () => {
    // Même règle que les deux portes voisines (« Reprendre dans l'établi »,
    // « La retoucher ») : un rappel facultatif absent n'affiche rien, plutôt
    // qu'un bouton grisé sans explication.
    monterLaFiche(undefined)
    expect(screen.queryByRole("button", { name: "Poser sur la toile" })).toBeNull()
  })
})

describe("la fiche — la graine d'une image locale (défaut 6 de la relecture du 18/09/2026)", () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  test("la graine de son emplacement se lit sur la fiche, quand le serveur la rend", async () => {
    // `GET /api/generations/{id}` rend déjà `emplacements[].graine` — c'est
    // `api.ts` qui ne le déclare pas encore (occupé). Lue par l'extension de
    // type `EmplacementAvecGraine`, comme les autres champs de style local.
    const generation = {
      identifiant: "aaaa1111",
      modele: "ComfyUI:zimage-pixel@v1",
      demande: { prompt: "un tonneau", prompt_negatif: "", proportions: "1:1", resolution: null, variations: 1, references: 0, options: {} },
      parametres_resolus: {},
      ecartees: [],
      emplacements: [
        { rang: 0, statut: "reussie", consomme: 0, unite: "jeton", cout_usd: 0, duree_s: 24, resultat: null, raison: null, demarre_le: null, duree_attendue_s: 24, graine: 918273645 },
      ],
      cree_le: 1_787_800_100,
      projet: "bac-a-sable",
      references: [],
      hors_plafond: [],
      parent: null,
      statut: "reussie",
      cout_usd: 0,
      consomme: 0,
      unite: "jeton",
      reussies: 1,
    } as unknown as Generation
    vi.spyOn(api, "generation").mockResolvedValue(generation)
    vi.spyOn(api, "imposeSurAsset").mockRejectedValue(new Error("essai : aucun serveur"))

    monterLaFiche()

    expect(await screen.findByText("graine 918273645")).toBeInTheDocument()
  })

  test("rien ne paraît quand le serveur ne rend pas de graine — un modèle distant, par exemple", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new Error("essai : aucun serveur"))))
    monterLaFiche()
    // Laisse l'effet qui lit la génération se résoudre (en échec, ici).
    await new Promise((r) => setTimeout(r, 0))
    expect(screen.queryByText(/^graine /)).not.toBeInTheDocument()
    vi.unstubAllGlobals()
  })
})
