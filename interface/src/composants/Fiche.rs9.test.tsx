// Ce que la fiche d'une planche dit de sa découpe à l'arrivée (RS9).
//
// **RS7 et RS8 écrivaient déjà la marque** — sur `emplacements[].decoupe` de
// la génération — sans qu'aucun écran ne la montre. Cette planche-ci lit
// exactement ce que `Fiche.test.tsx` § « la graine d'une image locale » lit
// déjà pour la graine : la même génération doublée, le même `api.generation`
// simulé, jamais de serveur réel.

import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, test, vi } from "vitest"

import { api, UNIVERS_VIDE, type Asset, type Generation, type Personnage, type Recette } from "../api"
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

const LA_PLANCHE: Asset = {
  identifiant: "aaaa1111-0",
  generation: "aaaa1111",
  rang: 0,
  largeur: 1024,
  hauteur: 1024,
  type_media: "image/png",
  label: "champy, quatre vues",
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
  matiere: false,
  projet: "bac-a-sable",
  collection: null,
  parent: null,
  parent_supprime: false,
  favori: false,
  supprime_le: null,
  traite: false,
  empreinte: "abc123",
}

const CHAMPY = {
  identifiant: "champy",
  nom: "Champy",
  projet: "bac-a-sable",
  description: "",
  ecartees: [],
  cases: [
    {
      identifiant: "sud",
      directions: [
        { identifiant: "sud", nom: "sud" },
        { identifiant: "est", nom: "est" },
        { identifiant: "nord", nom: "nord" },
        { identifiant: "ouest", nom: "ouest" },
      ],
    },
  ],
  plan: [],
  type: "",
  ambiance: "",
  recette: "champy 01",
} as unknown as Personnage

function generationAvecDecoupe(decoupe: Record<string, unknown>): Generation {
  return {
    identifiant: "aaaa1111",
    modele: "google/gemini-2.5-flash-image",
    demande: { prompt: "champy", prompt_negatif: "", proportions: "1:1", resolution: null, variations: 1, references: 0, options: {} },
    parametres_resolus: {},
    ecartees: [],
    emplacements: [
      { rang: 0, statut: "reussie", consomme: 0.0245, unite: "usd", cout_usd: 0.0245, duree_s: 24, resultat: null, raison: null, demarre_le: null, duree_attendue_s: 24, decoupe },
    ],
    cree_le: 1_787_800_100,
    projet: "bac-a-sable",
    references: [],
    hors_plafond: [],
    parent: null,
    statut: "reussie",
    cout_usd: 0.0245,
    consomme: 0.0245,
    unite: "usd",
    reussies: 1,
    personnage: "champy",
  } as unknown as Generation
}

function monterLaFiche(personnages: Personnage[] = [CHAMPY]) {
  return render(
    <Fiche
      asset={LA_PLANCHE}
      univers={UNIVERS_VIDE}
      plan={[]}
      personnages={personnages}
      onFermer={() => {}}
      onErreur={() => {}}
      onReinjecter={() => {}}
      onReglages={() => {}}
      onSupprimer={() => {}}
      onRetoucher={() => {}}
      onOuvrir={() => {}}
    />,
  )
}

describe("la fiche d'une planche — ce que la découpe à l'arrivée a fait (RS9)", () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  test("coupée avec ses directions : le compte, les directions, et la recette du sujet", async () => {
    vi.spyOn(api, "imposeSurAsset").mockRejectedValue(new Error("essai : aucun serveur"))
    vi.spyOn(api, "generation").mockResolvedValue(
      generationAvecDecoupe({
        morceaux: ["aaaa1111-1", "aaaa1111-2", "aaaa1111-3", "aaaa1111-4"],
        attendu: 4,
        directions: ["sud", "est", "nord", "ouest"],
      }),
    )

    monterLaFiche()

    expect(
      await screen.findByText("Découpée en 4 : sud, est, nord, ouest · recette champy 01"),
    ).toBeInTheDocument()
    // Une vignette par morceau, chacune ouvrable.
    expect(screen.getAllByRole("button", { name: "Ouvrir cette vue" })).toHaveLength(4)
  })

  test("coupée sans direction : la raison de RS8, sans recette quand le sujet n'en a pas", async () => {
    vi.spyOn(api, "imposeSurAsset").mockRejectedValue(new Error("essai : aucun serveur"))
    vi.spyOn(api, "generation").mockResolvedValue(
      generationAvecDecoupe({
        morceaux: ["aaaa1111-1", "aaaa1111-2"],
        attendu: 2,
        directions: null,
        sans_direction: "aucun ordre des vues dit sur la planche du sujet — les images arrivent sans direction",
      }),
    )

    monterLaFiche([{ ...CHAMPY, recette: undefined } as unknown as Personnage])

    expect(
      await screen.findByText(
        "Découpée en 2, sans direction — aucun ordre des vues dit sur la planche du sujet — les images arrivent sans direction",
      ),
    ).toBeInTheDocument()
    expect(screen.queryByText(/· recette/)).not.toBeInTheDocument()
  })

  test("refusée : la phrase dit pourquoi, sans rien inventer", async () => {
    vi.spyOn(api, "imposeSurAsset").mockRejectedValue(new Error("essai : aucun serveur"))
    vi.spyOn(api, "generation").mockResolvedValue(
      generationAvecDecoupe({
        raison: "3 zones sur la planche, 4 attendues d'après la référence planche — rien n'est coupé, découpez à la main",
        attendu: 4,
        trouvees: 3,
      }),
    )

    monterLaFiche()

    expect(
      await screen.findByText(
        "Pas découpée : 3 zones sur la planche, 4 attendues d'après la référence planche — rien n'est coupé, découpez à la main",
      ),
    ).toBeInTheDocument()
  })

  test("en cours : la phrase le dit, rien d'autre", async () => {
    vi.spyOn(api, "imposeSurAsset").mockRejectedValue(new Error("essai : aucun serveur"))
    vi.spyOn(api, "generation").mockResolvedValue(generationAvecDecoupe({ en_cours: true }))

    monterLaFiche()

    expect(await screen.findByText("Découpe en cours…")).toBeInTheDocument()
  })

  test("aucune marque : la fiche ne dit rien de la découpe à l'arrivée", async () => {
    vi.spyOn(api, "imposeSurAsset").mockRejectedValue(new Error("essai : aucun serveur"))
    vi.spyOn(api, "generation").mockResolvedValue(
      (() => {
        const g = generationAvecDecoupe({})
        // Emplacement sans `decoupe` du tout — le cas ordinaire, une image qui
        // n'est jamais passée par la découpe à l'arrivée.
        ;(g.emplacements[0] as unknown as { decoupe?: unknown }).decoupe = undefined
        return g
      })(),
    )

    monterLaFiche()
    await new Promise((r) => setTimeout(r, 0))
    expect(screen.queryByText(/Découpée en/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Pas découpée/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Découpe en cours/)).not.toBeInTheDocument()
  })
})
