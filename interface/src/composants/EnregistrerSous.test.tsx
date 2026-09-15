// RP20 — *Enregistrer sous…* dans les deux ateliers.
//
// **Trois choses sont mesurées ici, et nulle part ailleurs.**
//
// 1. **Le geste est là des deux côtés** — sur l'établi d'une image et dans
//    l'atelier d'une animation. Un geste livré d'un seul côté est la panne que
//    la tranche existe pour fermer : le miroir s'applique aux deux, la façon de
//    le garder ne s'appliquait à aucun.
// 2. **Il est grisé avec sa raison tant qu'aucune retouche n'est appliquée.**
//    ⚠️ Mesuré **des deux côtés du seuil** : un essai qui ne vérifierait que le
//    grisé passerait aussi bien avec un bouton mort en permanence.
// 3. **La fenêtre s'ouvre préremplie**, direction au miroir comprise — et la
//    proposition vient du serveur, jamais d'un calcul d'écran.

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import { afterEach, expect, test, vi } from "vitest"

import {
  api,
  RECETTE_VIDE,
  UNIVERS_VIDE,
  type Asset,
  type AtelierDeBande,
  type EnregistrementPropose,
  type EtatTraitement,
  type Recette,
} from "../api"
import { EcranAtelierDeBande } from "./AtelierDeBande"
import { Retouche } from "./Retouche"

afterEach(() => {
  cleanup()
  localStorage.clear()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

const TRAITEMENT = {
  moteurs: [{ nom: "bord", raison: null }],
  silhouettes: [],
  reductions: [],
  recettes: [],
  quantification: { raison: null, note: "" },
} as unknown as EtatTraitement

const MIROIR: Recette = {
  ...RECETTE_VIDE,
  retournement: { sens: "gauche-droite" },
} as Recette

/** Ce que le serveur propose : *marche vers l'est*, retournée, donc l'ouest. */
function proposition(surplus: Partial<EnregistrementPropose> = {}) {
  return {
    quoi: "image",
    source: "img-1",
    projet: "le-marais",
    sujet: "le-pelerin",
    pose: "marche",
    direction: "ouest",
    direction_depart: "est",
    miroir: true,
    nom: "le pèlerin · ouest",
    raison: null,
    sujets: [{ identifiant: "le-pelerin", nom: "Le pèlerin" }],
    poses: [
      { identifiant: "repos", nom: "repos" },
      { identifiant: "marche", nom: "marche" },
    ],
    directions: [
      { identifiant: "est", nom: "est" },
      { identifiant: "ouest", nom: "ouest" },
    ],
    derives: [],
    ...surplus,
  } as EnregistrementPropose
}

function image(surplus: Partial<Asset> = {}): Asset {
  return {
    identifiant: "img-1",
    generation: "gen-1",
    rang: 0,
    largeur: 64,
    hauteur: 64,
    type_media: "image/png",
    label: "le pèlerin · est",
    recette: RECETTE_VIDE,
    rendu_largeur: 64,
    rendu_hauteur: 64,
    cree_le: 200,
    cout_usd: 0,
    consomme: 0,
    unite: "usd",
    provenance: "auteur",
    modele: "gpt-image-2",
    personnage: "le-pelerin",
    pose: "marche",
    direction: "est",
    piece: null,
    calque: null,
    lot: null,
    personnage_supprime: false,
    epingle: false,
    projet: "le-marais",
    parent: null,
    parent_supprime: false,
    favori: false,
    supprime_le: null,
    traite: true,
    empreinte: "e1",
    ...surplus,
  } as Asset
}

/** Un serveur qui répond « oui » à tout le reste : cet essai-ci ne mesure que
 *  la fenêtre, et les tables ont leurs propres bancs. */
function serveurMuet() {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (entree: RequestInfo | URL) => {
      const url = String(entree)
      const corps = url.endsWith("/recipes")
        ? { recettes: {} }
        : url.includes("/spots")
          ? { taches: [], couleurs: [], fond: {} }
          : image()
      return new Response(JSON.stringify(corps), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    }),
  )
}

function etabli(recette: Recette) {
  serveurMuet()
  return render(
    <Retouche
      enregistrementImmediat
      asset={image({ recette })}
      soeurs={[]}
      univers={UNIVERS_VIDE}
      traitement={TRAITEMENT}
      onFermer={vi.fn()}
      onSoeur={vi.fn()}
      decoupe={() => null}
      onErreur={vi.fn()}
    />,
  )
}

const geste = () =>
  screen.getByRole("button", { name: "Enregistrer sous…" }) as HTMLButtonElement

// ── L'établi d'une image ────────────────────────────────────────────────────

test("sans retouche, le geste est grisé et porte sa raison", () => {
  etabli(RECETTE_VIDE)
  expect(geste().disabled).toBe(true)
  expect(geste().title).toContain("aucune retouche")
})

test("avec une retouche, le geste ouvre une fenêtre préremplie sur la direction au miroir", async () => {
  const propose = vi
    .spyOn(api, "enregistrementProposePourImage")
    .mockResolvedValue(proposition())
  etabli(MIROIR)
  expect(geste().disabled).toBe(false)

  fireEvent.click(geste())
  await waitFor(() => expect(propose).toHaveBeenCalledOnce())
  // La recette **en cours** part avec la demande : c'est tout l'intérêt du
  // geste, qui se pose sur un brouillon.
  expect(propose.mock.calls[0][1]).toMatchObject({
    retournement: { sens: "gauche-droite" },
  })

  const fenetre = await screen.findByLabelText("Enregistrer sous")
  expect(fenetre).toBeTruthy()
  await waitFor(() =>
    expect((screen.getByLabelText("Direction") as HTMLSelectElement).value).toBe(
      "ouest",
    ),
  )
  expect((screen.getByLabelText("Sujet") as HTMLSelectElement).value).toBe(
    "le-pelerin",
  )
  expect((screen.getByLabelText("Pose") as HTMLSelectElement).value).toBe("marche")
  expect((screen.getByLabelText("Nom") as HTMLInputElement).value).toBe(
    "le pèlerin · ouest",
  )
})

test("la fenêtre envoie la case choisie et dit où le résultat est rangé", async () => {
  vi.spyOn(api, "enregistrementProposePourImage").mockResolvedValue(proposition())
  const enregistrer = vi
    .spyOn(api, "enregistrerImageSous")
    .mockResolvedValue({
      quoi: "image",
      source: "img-1",
      range: "marche · nord",
    } as never)
  etabli(MIROIR)

  fireEvent.click(geste())
  await screen.findByLabelText("Enregistrer sous")
  await waitFor(() =>
    expect((screen.getByLabelText("Direction") as HTMLSelectElement).value).toBe(
      "ouest",
    ),
  )
  fireEvent.change(screen.getByLabelText("Direction"), {
    target: { value: "est" },
  })
  fireEvent.click(screen.getByRole("button", { name: "Enregistrer sous" }))

  await waitFor(() => expect(enregistrer).toHaveBeenCalledOnce())
  expect(enregistrer.mock.calls[0][1]).toMatchObject({
    sujet: "le-pelerin",
    pose: "marche",
    direction: "est",
  })
  expect(await screen.findByText(/C’est rangé : marche · nord/)).toBeTruthy()
})

// ── L'atelier d'une animation ───────────────────────────────────────────────

function fixture(recette: Recette): AtelierDeBande {
  return {
    bande: {
      identifiant: "bande-main",
      nom: "marche vers l'est",
      clip: "clip-source",
      prises: [0, 1, 2].map((numero) => ({
        numero,
        clip: "",
        identifiant: `occurrence-${numero}`,
        dx: 0,
        dy: 0,
      })),
      chutier: [],
      recette,
      cadence: 8,
      sens: "boucle",
      case_largeur: 32,
      case_hauteur: 32,
      cadre: { choix: "clip" },
      melangee: false,
      secondes: 1.5,
      direction: "est",
      pose: "marche",
    },
    planche: "data:image/png;base64,AAAA",
    images_par_clip: { "clip-source": 3 },
    clips_voisins: [],
    cadre: { choix: "clip", a_jour: true },
    ecarts: [],
    contact: { cote: 96, colonnes: 16 },
    images_max: 64,
  } as unknown as AtelierDeBande
}

function atelierDeBande(recette: Recette) {
  const recu = fixture(recette)
  vi.spyOn(api, "ouvrirLaBande").mockResolvedValue(structuredClone(recu))
  vi.spyOn(api, "recettesNommees").mockResolvedValue({ recettes: {} } as never)
  vi.spyOn(api, "apercuDeBande").mockResolvedValue({
    planche: recu.planche,
    ecarts_des_frames: [],
  } as never)
  return render(
    <EcranAtelierDeBande
      identifiant="bande-main"
      univers={UNIVERS_VIDE}
      traitement={TRAITEMENT}
      onFermer={vi.fn()}
      onErreur={vi.fn()}
    />,
  )
}

test("l'atelier d'une animation grise le geste tant qu'aucune retouche n'est appliquée", async () => {
  atelierDeBande({ ...RECETTE_VIDE })
  await screen.findByLabelText("Outil de retouche")
  expect(geste().disabled).toBe(true)
  expect(geste().title).toContain("aucune retouche")
})

test("l'atelier d'une animation offre le même geste, préremplu sur la direction au miroir", async () => {
  const propose = vi
    .spyOn(api, "enregistrementProposePourBande")
    .mockResolvedValue(
      proposition({ quoi: "animation", source: "bande-main", nom: "marche vers l'ouest" }),
    )
  atelierDeBande(MIROIR)
  await screen.findByLabelText("Outil de retouche")
  expect(geste().disabled).toBe(false)

  fireEvent.click(geste())
  await waitFor(() => expect(propose).toHaveBeenCalledOnce())
  await screen.findByLabelText("Enregistrer sous")
  await waitFor(() =>
    expect((screen.getByLabelText("Direction") as HTMLSelectElement).value).toBe(
      "ouest",
    ),
  )
  // Le ruban part avec la demande quand on enregistre : trois frames, celles
  // que l'écran montre.
  const enregistrer = vi
    .spyOn(api, "enregistrerBandeSous")
    .mockResolvedValue({
      quoi: "animation",
      source: "bande-main",
      range: "marche · ouest",
    } as never)
  fireEvent.click(screen.getByRole("button", { name: "Enregistrer sous" }))
  await waitFor(() => expect(enregistrer).toHaveBeenCalledOnce())
  expect(enregistrer.mock.calls[0][1].prises).toHaveLength(3)
})
