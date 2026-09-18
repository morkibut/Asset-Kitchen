// P1c (V3.5) — le retour en arrière du dépliage, sur l'écran.
//
// Trois choses à prouver : **la liste des découpages d'une planche**, avec la
// suppression de l'un d'eux ; **le bouton absent et la raison affichée** quand
// la planche ne peut plus se redécouper ; et **le rappel d'une ligne** sur une
// image sortie d'un découpage, qui mène à sa planche. Refaire le découpage
// lui-même — la proposition préremplie, valider qui envoie les coupes — est
// prouvé dans `Decoupe.test.tsx`, qui porte l'éditeur de rectangles réutilisé
// ici par sa troisième famille.

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, expect, test, vi } from "vitest"
import { api, RECETTE_VIDE, type Asset, type Depliages, type Envoi } from "../api"
import { toutReplier } from "./pieces"
import { LesDecoupagesDeLaPlanche } from "./Depliages"

/** Un `Envoi` minimal — seuls `modele.nom` et `prix` sont lus par l'écran de
 *  confirmation d'une case refaite. */
const ENVOI_MINIMAL = {
  texte: "",
  parties: [],
  lignes: [],
  groupes: [],
  images: {
    lignes: [],
    places: 0,
    cochees: 0,
    rang_gabarit: null,
    rang_palette: null,
    jointe: null,
    partent: 0,
    gabarit: 0,
    palette: 0,
    prix: null,
    avertissements: [],
  },
  options: [],
  retour: [],
  avertissements: [],
  prix: {
    total: 0.005,
    appels: 1,
    images: null,
    mesure: {
      unite: "usd",
      prix: 0.005,
      bas: 0.005,
      haut: 0.005,
      appels: 4,
      base: null,
      par_image: null,
      sur_base: 0,
      sur_jointes: 0,
    },
  },
  reserve: null,
  modele: { identifiant: "m1", nom: "Modèle d'essai", references_max: 0 },
  ambiance: null,
} as unknown as Envoi

afterEach(() => {
  cleanup()
  toutReplier()
  vi.restoreAllMocks()
})

const planche = (partiel: Partial<Asset> = {}) =>
  ({
    identifiant: "planche-1",
    label: "planche",
    empreinte: "e",
    largeur: 100,
    hauteur: 50,
    recette: RECETTE_VIDE,
    ...partiel,
  } as Asset)

const ETAT: Depliages = {
  planche: "planche-1",
  generation: "g1",
  largeur: 100,
  hauteur: 50,
  refaisable: true,
  raison: null,
  dependants: { depliees: 8, derivees: 0, total: 8 },
  plusieurs: false,
  cases_de_la_planche: [],
  depliages: [
    {
      numero: 1,
      identifiant: "planche-1-d1",
      planche: "planche-1",
      origine: "auto",
      coupes: [],
      rangs: [1, 2, 3, 4, 5, 6, 7, 8],
      cree_le: 0,
      images: new Array(8).fill(0).map((_, i) => ({ identifiant: `img${i}` }) as Asset),
      supprimees: 0,
      supprime: false,
    },
    {
      numero: 2,
      identifiant: "planche-1-d2",
      planche: "planche-1",
      origine: "main",
      coupes: [],
      rangs: [9, 10, 11, 12, 13, 14, 15],
      cree_le: 1,
      images: new Array(7).fill(0).map((_, i) => ({ identifiant: `img2-${i}` }) as Asset),
      supprimees: 0,
      supprime: false,
    },
  ],
}

test("la fiche d'une planche liste ses découpages, et en supprimer un appelle la route", async () => {
  vi.spyOn(api, "depliagesDe").mockResolvedValue(ETAT)
  const supprimer = vi.spyOn(api, "depliageSupprimer").mockResolvedValue({
    supprimes: ["img2-0"], annulation_s: 8, expire_le: 1, depliage: ETAT.depliages[1],
  })

  render(
    <LesDecoupagesDeLaPlanche
      asset={planche()}
      onErreur={vi.fn()}
      onOuvrir={vi.fn()}
      onChangee={vi.fn()}
    />,
  )

  fireEvent.click(await screen.findByRole("button", { name: /Ses découpages/ }))
  expect(await screen.findByText("Découpage n°1 · auto · 8 images")).toBeInTheDocument()
  expect(screen.getByText("Découpage n°2 · à la main · 7 images")).toBeInTheDocument()
  expect(screen.getByRole("button", { name: "Refaire le découpage" })).toBeInTheDocument()

  const boutons = screen.getAllByRole("button", { name: "supprimer ce découpage" })
  fireEvent.click(boutons[1])
  await waitFor(() => expect(supprimer).toHaveBeenCalledWith("planche-1", 2))
})

test("bouton absent et raison affichée quand la planche ne peut plus se redécouper", async () => {
  vi.spyOn(api, "depliagesDe").mockResolvedValue({
    ...ETAT,
    refaisable: false,
    raison: "une planche d'équipement se recale, elle ne se redécoupe pas",
  })

  render(
    <LesDecoupagesDeLaPlanche
      asset={planche()}
      onErreur={vi.fn()}
      onOuvrir={vi.fn()}
      onChangee={vi.fn()}
    />,
  )

  fireEvent.click(await screen.findByRole("button", { name: /Ses découpages/ }))
  expect(screen.queryByRole("button", { name: "Refaire le découpage" })).toBeNull()
  expect(
    await screen.findByText("une planche d'équipement se recale, elle ne se redécoupe pas"),
  ).toBeInTheDocument()
})

test("une image sortie d'un découpage dit sa planche et son numéro, et y mène", async () => {
  const onOuvrir = vi.fn()
  render(
    <LesDecoupagesDeLaPlanche
      asset={planche({
        identifiant: "planche-1-8",
        planche: "planche-1",
        depliage: "planche-1-d2",
      })}
      onErreur={vi.fn()}
      onOuvrir={onOuvrir}
      onChangee={vi.fn()}
    />,
  )

  fireEvent.click(await screen.findByRole("button", { name: /Sa planche/ }))
  expect(await screen.findByText(/découpage n°2/)).toBeInTheDocument()
  fireEvent.click(screen.getByRole("button", { name: "planche-1" }))
  expect(onOuvrir).toHaveBeenCalledWith("planche-1")
})

// ── P2 (V3.5) : la planche à plusieurs objets ───────────────────────────────

const ETAT_PLUSIEURS: Depliages = {
  ...ETAT,
  plusieurs: true,
  cases_de_la_planche: [
    { indice: 0, texte: "une potion bleue", pose: "posee", direction: null, sujet: "potion-bleue" },
    { indice: 1, texte: "une clé dorée", pose: "posee", direction: null, sujet: "cle-doree" },
  ],
  depliages: [
    {
      ...ETAT.depliages[0],
      a_verifier: [{ case: 1, raison: "case vide — rien n'y a été trouvé" }],
    },
  ],
}

test("une planche à plusieurs objets dit l'objet de chaque case, et une case à vérifier montre sa raison", async () => {
  vi.spyOn(api, "depliagesDe").mockResolvedValue(ETAT_PLUSIEURS)

  render(
    <LesDecoupagesDeLaPlanche
      asset={planche()}
      onErreur={vi.fn()}
      onOuvrir={vi.fn()}
      onChangee={vi.fn()}
    />,
  )

  fireEvent.click(await screen.findByRole("button", { name: /Ses découpages/ }))
  expect(await screen.findByText("case 1 · une potion bleue")).toBeInTheDocument()
  expect(screen.getByText("case 2 · une clé dorée")).toBeInTheDocument()
  expect(
    screen.getByText("case 2 à vérifier · case vide — rien n'y a été trouvé"),
  ).toBeInTheDocument()
})

test("« refaire cette case seule » montre le prix et n'appelle POST /generations qu'après l'accord", async () => {
  vi.spyOn(api, "depliagesDe").mockResolvedValue(ETAT_PLUSIEURS)
  const preparer = vi.spyOn(api, "refaireUneCase").mockResolvedValue({
    planche: "planche-1",
    case: 1,
    demande: {
      modele: "m1",
      prompt: "une clé dorée",
      projet: "jeu-1",
      personnage: "cle-doree",
      pose: "posee",
      direction: null,
    },
    envoi: ENVOI_MINIMAL,
  })
  const generer = vi.spyOn(api, "generer").mockResolvedValue({ identifiant: "g2" } as never)

  render(
    <LesDecoupagesDeLaPlanche
      asset={planche()}
      onErreur={vi.fn()}
      onOuvrir={vi.fn()}
      onChangee={vi.fn()}
    />,
  )

  fireEvent.click(await screen.findByRole("button", { name: /Ses découpages/ }))
  fireEvent.click(await screen.findByRole("button", { name: "refaire cette case seule" }))

  await waitFor(() => expect(preparer).toHaveBeenCalledWith("planche-1", 1))
  // Le prix est montré avant tout appel : rien n'est encore parti.
  expect(await screen.findByRole("button", { name: /Payer et lancer.*\$0,0050/ })).toBeInTheDocument()
  expect(generer).not.toHaveBeenCalled()

  fireEvent.click(screen.getByRole("button", { name: /Payer et lancer/ }))
  await waitFor(() =>
    expect(generer).toHaveBeenCalledWith(
      expect.objectContaining({
        modele: "m1",
        prompt: "une clé dorée",
        personnage: "cle-doree",
        pose: "posee",
      }),
    ),
  )
})

test("« ce n'est pas le bon objet » appelle la route depuis une image sortie d'une telle planche", async () => {
  vi.spyOn(api, "depliagesDe").mockResolvedValue(ETAT_PLUSIEURS)
  const signaler = vi.spyOn(api, "pasLeBonSujet").mockResolvedValue({
    planche: "planche-1",
    case: 1,
    image: planche({ identifiant: "planche-1-2" }),
    depliage: ETAT_PLUSIEURS.depliages[0],
  })

  render(
    <LesDecoupagesDeLaPlanche
      asset={planche({
        identifiant: "planche-1-2",
        planche: "planche-1",
        depliage: "planche-1-d1",
      })}
      onErreur={vi.fn()}
      onOuvrir={vi.fn()}
      onChangee={vi.fn()}
    />,
  )

  fireEvent.click(await screen.findByRole("button", { name: /Sa planche/ }))
  const bouton = await screen.findByRole("button", { name: "Ce n'est pas le bon objet" })
  fireEvent.click(bouton)
  await waitFor(() => expect(signaler).toHaveBeenCalledWith("planche-1-2"))
})
