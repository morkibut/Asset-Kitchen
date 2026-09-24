// RP11 — la galerie se trie, se filtre et se regroupe, côté écran.
//
// Trois choses à prouver, et une seule est visuelle : **les contrôles appellent
// la route avec les bons paramètres**, **le choix se retrouve après
// fermeture**, et **un groupe replié montre son origine et compte ses
// dérivés**. Le tri et les filtres eux-mêmes sont vérifiés côté serveur
// (`tests/test_rp11.py`) : les rejouer ici ne prouverait que le double de
// `fetch`.

import { act, cleanup, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"
import { Galerie, Grille, useGalerie } from "./Galerie"
import type { Entree } from "./Tuile"
import {
  api,
  PlancheAConfirmer,
  Refus,
  type Asset,
  type Bibliotheque,
  type Personnage,
  type ReferencesDeLaChose,
  type Univers,
} from "../api"

const { assets, supprimerAssetsConfirmable } = vi.hoisted(() => ({
  assets: vi.fn(),
  // P1c (V3.5) : la suppression d'une planche, doublée à part — voir plus bas.
  supprimerAssetsConfirmable: vi.fn(),
}))

vi.mock("../api", async (vrai) => {
  const api = await vrai<typeof import("../api")>()
  return { ...api, api: { ...api.api, assets, supprimerAssetsConfirmable } }
})

// **La tuile est doublée, et c'est le sujet qui l'exige** : ce qu'on vérifie
// ici est *qui* la grille pose et *qui* elle replie, pas ce qu'une vignette
// dessine — Tuile.test.tsx s'en charge. La doubler évite aussi de fabriquer un
// asset complet, dont trente champs n'auraient rien à voir avec le pli.
vi.mock("./Tuile", () => ({
  Tuile: ({ entree }: { entree: { cle: string } }) => <span>{entree.cle}</span>,
}))

beforeEach(() => {
  localStorage.clear()
  assets.mockReset()
  assets.mockResolvedValue({ assets: [], total: 0 })
  supprimerAssetsConfirmable.mockReset()
})
afterEach(cleanup)

const BIBLIOTHEQUE = {
  courant: "jeu",
  projets: [],
  collections: [],
} as unknown as Bibliotheque

function monterLaGalerie() {
  return renderHook(() =>
    useGalerie({
      bibliotheque: BIBLIOTHEQUE,
      chantier: [],
      setChantier: vi.fn(),
      clipsDuJeu: [],
      echouer: vi.fn(),
      setPanne: vi.fn(),
      setFente: vi.fn(),
      replies: {},
      vivant: { current: { relireGrille: vi.fn() } as never },
    }),
  )
}

// ── Les contrôles appellent la route ─────────────────────────────────────────

test("le tri, les deux filtres et le regroupement partent au serveur", async () => {
  const vue = monterLaGalerie()
  await waitFor(() => expect(assets).toHaveBeenCalled())

  // Au repos, rien de neuf ne part : une adresse porte ce qu'on a choisi, pas
  // ce qu'on a laissé.
  expect(assets).toHaveBeenLastCalledWith(
    expect.objectContaining({ tri: "recent", role: "tous", jugement: "tous", groupe: false }),
  )

  act(() => vue.result.current.setVue((v) => ({ ...v, tri: "nom", role: "origine" })))
  await waitFor(() =>
    expect(assets).toHaveBeenLastCalledWith(
      expect.objectContaining({ tri: "nom", role: "origine" }),
    ),
  )

  act(() => vue.result.current.setVue((v) => ({ ...v, jugement: "non-juge", groupe: true })))
  await waitFor(() =>
    expect(assets).toHaveBeenLastCalledWith(
      expect.objectContaining({ jugement: "non-juge", groupe: true }),
    ),
  )
})

test("le choix se retrouve après fermeture", async () => {
  const premiere = monterLaGalerie()
  await waitFor(() => expect(assets).toHaveBeenCalled())
  act(() =>
    premiere.result.current.setVue({
      tri: "ancien",
      role: "calque",
      jugement: "favori",
      groupe: true,
    }),
  )
  await waitFor(() =>
    expect(localStorage.getItem("asset-kitchen:galerie:v1")).toContain("ancien"),
  )
  premiere.unmount()

  const seconde = monterLaGalerie()
  expect(seconde.result.current.vue).toEqual({
    tri: "ancien",
    role: "calque",
    jugement: "favori",
    groupe: true,
  })
})

test("une valeur d'une version d'avant retombe sur le défaut", () => {
  // Sans cette relecture, l'écran afficherait un tri que la route ne connaît
  // pas : elle retomberait sur son défaut sans rien dire, et le contrôle
  // annoncerait autre chose que ce que la grille montre.
  localStorage.setItem(
    "asset-kitchen:galerie:v1",
    JSON.stringify({ tri: "au-hasard", role: "planche", jugement: "ecarte", groupe: 1 }),
  )
  const vue = monterLaGalerie()
  expect(vue.result.current.vue).toEqual({
    tri: "recent",
    role: "tous",
    jugement: "tous",
    groupe: false,
  })
})

// ── Le groupe se voit, et il se déplie ───────────────────────────────────────

const image = (identifiant: string): Entree => ({
  cle: identifiant,
  date: 1,
  rang: 0,
  sorte: "asset",
  asset: {
    identifiant,
    label: identifiant,
    largeur: 64,
    hauteur: 64,
    type_media: "image/png",
    recette: { passes: [] },
    empreinte: "x",
    rendu_largeur: 64,
    rendu_hauteur: 64,
  } as unknown as Asset,
})

function monterLaGrille(
  groupes?: { origine: string; derives: string[] }[],
  reste: { entrees?: Entree[]; vueRestreinte?: boolean; onRetirerFiltre?: () => void } = {},
) {
  return render(
    <Grille
      entrees={[image("feuille"), image("case-1"), image("case-2"), image("seule")]}
      selection={[]}
      filtre={{ collection: null, favoris: false, recherche: "" }}
      zoom={1}
      entree={{ entrer: vi.fn() } as never}
      groupes={groupes}
      onRelancer={vi.fn()}
      onChoisir={vi.fn()}
      onOuvrir={vi.fn()}
      onRetirerFiltre={vi.fn()}
      {...reste}
    />,
  )
}

test("un groupe replié montre son origine et compte ses dérivés", () => {
  monterLaGrille([
    { origine: "feuille", derives: ["case-1", "case-2"] },
    { origine: "seule", derives: [] },
  ])
  // Les deux cases sont dans la page et ne prennent pas de place : c'est
  // exactement ce que le regroupement achète.
  expect(screen.queryByText("case-1")).toBeNull()
  expect(screen.getByRole("button", { name: /2 dérivés/ })).toBeTruthy()
  // Rien sous « seule » : pas de ligne, pas de bouton à zéro.
  expect(screen.queryByRole("button", { name: /0 dérivé/ })).toBeNull()

  fireEvent.click(screen.getByRole("button", { name: /2 dérivés/ }))
  expect(screen.getByText("case-1")).toBeTruthy()
  expect(screen.getByText("case-2")).toBeTruthy()
})

test("sans regroupement, la grille reste plate", () => {
  monterLaGrille(undefined)
  expect(screen.getByText("case-1")).toBeTruthy()
  expect(screen.queryByRole("button", { name: /dérivé/ })).toBeNull()
})

// ── Un filtre de la vue est un filtre ────────────────────────────────────────

test("un rôle sans résultat est une impasse, pas une bibliothèque vide", () => {
  // Sans ça, filtrer sur les calques d'une bibliothèque pleine afficherait
  // « Rien n'est encore sorti d'ici. Écris. » — et le geste qui sort de
  // l'impasse ne serait nulle part.
  const onRetirerFiltre = vi.fn()
  monterLaGrille(undefined, { entrees: [], vueRestreinte: true, onRetirerFiltre })
  expect(screen.getByText("Rien ne répond à ce filtre.")).toBeTruthy()
  fireEvent.click(screen.getByRole("button", { name: "Retirer le filtre ›" }))
  expect(onRetirerFiltre).toHaveBeenCalled()
})

test("les deux filtres de la vue écartent ce qui n'est pas encore arrivé", async () => {
  // C'est ce que le bouton *Favoris* faisait avant d'être mangé par le
  // jugement : un lot en cours n'a ni rôle ni jugement, et le montrer sous un
  // filtre mentirait sur ce que celui-ci a trouvé.
  const { vueRestreint } = await import("../api")
  expect(vueRestreint({ tri: "recent", role: "calque", jugement: "tous", groupe: false })).toBe(true)
  expect(vueRestreint({ tri: "recent", role: "tous", jugement: "favori", groupe: false })).toBe(true)
  // Trier et regrouper déplacent ; ils ne retirent rien.
  expect(vueRestreint({ tri: "nom", role: "tous", jugement: "tous", groupe: true })).toBe(false)
})

// ── P1c (V3.5) : supprimer une planche demande confirmation ────────────────

test("une planche à confirmer pose la question, puis repart avec confirmer: true", async () => {
  supprimerAssetsConfirmable
    .mockRejectedValueOnce(
      new PlancheAConfirmer(
        "8 images dépendent de cette planche — elles resteront, mais son découpage ne pourra plus se refaire. Confirmez pour la supprimer.",
        "planche_a_confirmer",
        null,
        "planche-1",
        { depliees: 8, derivees: 0, total: 8 },
      ),
    )
    .mockResolvedValueOnce({ supprimes: ["planche-1"], annulation_s: 8, expire_le: 123 })

  const vue = monterLaGalerie()
  await waitFor(() => expect(assets).toHaveBeenCalled())

  let resultat: string[] | null = null
  await act(async () => {
    resultat = await vue.result.current.supprimer(["planche-1"])
  })
  expect(supprimerAssetsConfirmable).toHaveBeenNthCalledWith(1, ["planche-1"], false)
  expect(resultat).toBeNull()
  expect(vue.result.current.plancheAConfirmer).toEqual({
    identifiants: ["planche-1"],
    planche: "planche-1",
    dependants: { depliees: 8, derivees: 0, total: 8 },
  })

  await act(async () => {
    resultat = await vue.result.current.supprimer(
      vue.result.current.plancheAConfirmer!.identifiants,
      true,
    )
  })
  expect(supprimerAssetsConfirmable).toHaveBeenNthCalledWith(2, ["planche-1"], true)
  expect(resultat).toEqual(["planche-1"])
  expect(vue.result.current.plancheAConfirmer).toBeNull()
})

test("une image ordinaire se supprime sans confirmation", async () => {
  supprimerAssetsConfirmable.mockResolvedValueOnce({
    supprimes: ["asset-1"], annulation_s: 8, expire_le: 42,
  })
  const vue = monterLaGalerie()
  await waitFor(() => expect(assets).toHaveBeenCalled())

  let resultat: string[] | null = null
  await act(async () => {
    resultat = await vue.result.current.supprimer(["asset-1"])
  })
  expect(supprimerAssetsConfirmable).toHaveBeenCalledWith(["asset-1"], false)
  expect(resultat).toEqual(["asset-1"])
  expect(vue.result.current.plancheAConfirmer).toBeNull()
})

// ── L'onglet Vidéos n'a ni filtres ni compteur d'images (RV13) ──────────────

function monterLaGaleriePleine() {
  const vue = monterLaGalerie()
  render(
    <Galerie
      g={vue.result.current}
      bibliotheque={BIBLIOTHEQUE}
      echouer={vi.fn()}
      etat={null}
      montageOuvert={null}
      setMontageOuvert={vi.fn()}
      ouvrirLAtelierDeBande={vi.fn()}
      ouvrirLaRetouche={vi.fn()}
      personnages={[]}
      plan={[]}
      reinjecter={vi.fn()}
      reprendreReglages={vi.fn()}
      setChantier={vi.fn()}
      setChoseOuverte={vi.fn()}
      poserLaRacine={vi.fn()}
      setPanne={vi.fn()}
      univers={{} as unknown as Univers}
    />,
  )
  return vue
}

test("l'onglet Vidéos n'affiche ni la barre de filtres ni le compteur des images", async () => {
  assets.mockResolvedValue({ assets: [], total: 3 })
  const vue = monterLaGaleriePleine()
  await waitFor(() => expect(assets).toHaveBeenCalled())
  expect(vue.result.current).toBeTruthy()

  // Sur Images (par défaut) : la barre de filtres et le compte d'images
  // paraissent tous les deux.
  expect(screen.getByLabelText("Ne montrer qu'une famille, ou les clips")).toBeTruthy()
  expect(screen.getByLabelText("Trier la grille")).toBeTruthy()

  fireEvent.click(screen.getByRole("button", { name: "Vidéos" }))

  // Sur Vidéos : ni l'une ni l'autre — les clips ne passent pas par la même
  // liste, et un filtre ou un compte d'images n'y dirait rien de juste.
  expect(screen.queryByLabelText("Ne montrer qu'une famille, ou les clips")).toBeNull()
  expect(screen.queryByLabelText("Trier la grille")).toBeNull()
  expect(screen.queryByText(/montrées sur/)).toBeNull()
  // Le pied de grille, lui, reste : ce n'est pas un compteur d'images.
  expect(screen.getByText(/aucune génération ne part d'ici/)).toBeTruthy()
})

// ── TS21 : « En faire la planche de… », le fil que la Galerie tend ─────────
//
// **La preuve à l'écran — le bouton, sa phrase, le clic — vit dans
// `Fiche.test.tsx`** : c'est là que la logique habite (`estUnePlanche`,
// `nomDuSujetPourPlanche`), et c'est elle qui déciderait si le correctif
// manquait. Ici, on prouve le fil que la Galerie tend jusqu'à elle — la
// Galerie ne connaît pas le sujet d'avance, contrairement à la page d'un
// sujet, donc elle relit les usages promus du sujet dès qu'une image rangée
// s'ouvre, et son geste appelle la même route que `ImagesDuSujet.tsx`.

describe("TS21 — le fil que la Galerie tend vers « choisirLaPlanche »", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

const REFERENCES_VIDES: ReferencesDeLaChose = {
  personnage: "elias",
  lignes: [],
  propositions: [],
  disponibles: 0,
}

test("une image ouverte, rangée dans un sujet, relit ses usages promus", async () => {
  const lire = vi.spyOn(api, "referencesDeLaChose").mockResolvedValue(REFERENCES_VIDES)
  assets.mockResolvedValue({
    assets: [{ identifiant: "planche-1", personnage: "elias" } as unknown as Asset],
    total: 1,
  })
  const vue = monterLaGalerie()
  await waitFor(() => expect(assets).toHaveBeenCalled())

  expect(lire).not.toHaveBeenCalled()
  act(() => vue.result.current.setSelection(["planche-1"]))
  await waitFor(() => expect(lire).toHaveBeenCalledWith("elias"))
  await waitFor(() =>
    expect(vue.result.current.referencesDuSujetOuvert).toEqual(REFERENCES_VIDES),
  )
})

test("une image sans sujet ne redemande rien", async () => {
  const lire = vi.spyOn(api, "referencesDeLaChose").mockResolvedValue(REFERENCES_VIDES)
  assets.mockResolvedValue({
    assets: [{ identifiant: "seule-1", personnage: null } as unknown as Asset],
    total: 1,
  })
  const vue = monterLaGalerie()
  await waitFor(() => expect(assets).toHaveBeenCalled())

  act(() => vue.result.current.setSelection(["seule-1"]))
  await new Promise((r) => setTimeout(r, 0))
  expect(lire).not.toHaveBeenCalled()
  expect(vue.result.current.referencesDuSujetOuvert).toBeNull()
})

test("choisirLaPlanche appelle la même route que la page du sujet, et relit ce qu'elle rend", async () => {
  const promue: ReferencesDeLaChose = {
    personnage: "elias",
    lignes: [
      {
        reference: "planche-1",
        genre: "asset",
        provenance: "image promue",
        detail: "fabriquée puis retenue comme référence",
        ecartee: false,
        montre: null,
        usage: "planche",
      },
    ],
    propositions: [],
    disponibles: 0,
  }
  const choisir = vi.spyOn(api, "choisirLaPlanche").mockResolvedValue({
    personnage: { identifiant: "elias" } as unknown as Personnage,
    references: promue,
  })
  const vue = monterLaGalerie()
  await waitFor(() => expect(assets).toHaveBeenCalled())

  const asset = { identifiant: "planche-1", personnage: "elias" } as unknown as Asset
  await act(async () => {
    await vue.result.current.choisirLaPlanche(asset)
  })
  expect(choisir).toHaveBeenCalledWith("elias", "planche-1")
  expect(vue.result.current.referencesDuSujetOuvert).toEqual(promue)
})

test("un refus du serveur se garde par asset, en clair", async () => {
  vi.spyOn(api, "choisirLaPlanche").mockRejectedValue(
    new Refus("image d'un autre sujet", "planche_refusee"),
  )
  const vue = monterLaGalerie()
  await waitFor(() => expect(assets).toHaveBeenCalled())

  const asset = { identifiant: "planche-1", personnage: "elias" } as unknown as Asset
  await act(async () => {
    await vue.result.current.choisirLaPlanche(asset)
  })
  expect(vue.result.current.erreursPlanche["planche-1"]).toBe("image d'un autre sujet")
})
})
