// Ce que l'onglet « Ses images » fait (B10) : le rangement d'une rangée — la
// retenue en tête, les gardées dans l'ordre où elles sont arrivées —, les trois
// marques qui s'excluent, la direction qu'on confirme, et les calques qui
// suivent l'image et non la pose. `fetch` est doublé à la main, comme partout
// dans le dépôt — aucun essai ne coûte un centime.
//
// Le composant est rendu seul, sans passer par `App` : ce qu'il demande au
// serveur tient en trois routes, et les monter toutes pour les regarder ferait
// de chaque essai une seconde suite d'écran.

import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { afterEach, describe, expect, test, vi } from "vitest"

import { ImagesDuSujet, rangerLaLigne, rangeesDeLaCase } from "./ImagesDuSujet"
import { RECETTE_VIDE, type Asset, type Case, type Personnage, type Pose } from "../api"

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

// ── De quoi fabriquer un sujet ──────────────────────────────────────────────

function image(
  surplus: Partial<Asset> & { identifiant: string; cree_le: number },
): Asset {
  return {
    generation: "gen-1",
    rang: 0,
    largeur: 1024,
    hauteur: 1024,
    type_media: "image/png",
    label: `image ${surplus.identifiant}`,
    recette: RECETTE_VIDE,
    rendu_largeur: 64,
    rendu_hauteur: 64,
    cout_usd: 0.019,
    consomme: 0.019,
    unite: "usd",
    provenance: "auteur",
    modele: "gpt-image-2",
    personnage: "pelerin",
    pose: "repos",
    direction: "sud",
    piece: null,
    calque: null,
    lot: null,
    personnage_supprime: false,
    epingle: false,
    projet: "le-marais",
    collection: null,
    parent: null,
    parent_supprime: false,
    favori: false,
    supprime_le: null,
    traite: true,
    empreinte: "e1",
    ...surplus,
  }
}

const DIRECTION = { consigne: "", demandees: 1, a_confirmer: 0, bandes: [] }

function sienne(surplus: Partial<Case> & { pose: string }): Case {
  return {
    demandees: 1,
    images: [],
    bandes: [],
    bandes_demandees: 1,
    calques: {},
    retenus: {},
    corps: null,
    origine: "type",
    directions: [],
    directions_rangees: [],
    sans_direction: [],
    ...surplus,
  }
}

const PLAN: Pose[] = [
  { identifiant: "repos", nom: "repos", images: 1, consigne: "", ecartees: [], images_avant: 0 },
  { identifiant: "marche", nom: "marche", images: 1, consigne: "", ecartees: [], images_avant: 0 },
]

function personnage(cases: Case[]): Personnage {
  return {
    identifiant: "pelerin",
    projet: "le-marais",
    nom: "Le pèlerin",
    description: "a weathered pilgrim",
    ecartees: [],
    concept_arts: [],
    references_ecartees: [],
    cree_le: 1_700_000_000,
    cases,
    plan: PLAN,
    type: "personnage",
    ambiance: "",
    prend: "tout",
    textes: {},
    eteints: [],
    references: [],
    ajoutees: [],
    directions_ecartees: {},
    hors_calibrage: [],
    famille: "personnages",
    equipable: true,
  }
}

/** Trois images d'une même rangée : la plus ancienne, la retenue du milieu, la
 *  plus récente. C'est le cas qui fait mentir un tri par date seule. */
const VIEILLE = image({ identifiant: "a", cree_le: 100 })
const RETENUE = image({ identifiant: "b", cree_le: 200, favori: true })
const RECENTE = image({ identifiant: "c", cree_le: 300 })

const CASE_SUD = sienne({
  pose: "repos",
  images: [VIEILLE, RETENUE, RECENTE],
  directions: [
    { ...DIRECTION, identifiant: "sud", nom: "sud", images: [VIEILLE, RETENUE, RECENTE] },
    { ...DIRECTION, identifiant: "nord", nom: "nord", images: [] },
  ],
})

function construireDouble() {
  const appels: { url: string; methode: string; corps: unknown }[] = []
  const fetchDouble = vi.fn(async (chemin: string, init?: RequestInit) => {
    appels.push({
      url: String(chemin),
      methode: init?.method ?? "GET",
      corps:
        init?.body && typeof init.body === "string"
          ? (JSON.parse(init.body) as unknown)
          : undefined,
    })
    return { ok: true, status: 200, json: async () => ({}) } as Response
  })
  return { fetchDouble, appels }
}

function monter(cases: Case[] = [CASE_SUD]) {
  const { fetchDouble, appels } = construireDouble()
  vi.stubGlobal("fetch", fetchDouble)
  const rappels = {
    onArmer: vi.fn(),
    onOuvrirCase: vi.fn(),
    onEcarter: vi.fn(),
    onErreur: vi.fn(),
  }
  render(
    <ImagesDuSujet
      personnage={personnage(cases)}
      plan={PLAN}
      pieces={[
        { identifiant: "casque", nom: "le casque", emplacement: "tete", cree_le: 0 } as never,
      ]}
      {...rappels}
    />,
  )
  return { ...rappels, appels }
}

const rangee = (cle: string) =>
  document.querySelector(`[data-rangee="${cle}"]`) as HTMLElement

// ── Le rangement, sans écran ────────────────────────────────────────────────

describe("le rangement d'une rangée", () => {
  test("la retenue passe en tête quelle que soit sa date, les gardées suivent la leur", () => {
    const { retenue, gardees } = rangerLaLigne([RECENTE, VIEILLE, RETENUE])
    expect(retenue?.identifiant).toBe("b")
    expect(gardees.map((a) => a.identifiant)).toEqual(["a", "c"])
  })

  test("sans aucune retenue, rien ne se promeut de soi-même", () => {
    const { retenue, gardees } = rangerLaLigne([RECENTE, VIEILLE])
    expect(retenue).toBeNull()
    expect(gardees.map((a) => a.identifiant)).toEqual(["a", "c"])
  })

  test("entre deux retenues, la plus récente gagne — la règle du serveur", () => {
    // `corps_retenu` prend le maximum de (favori, cree_le, rang) : deux favoris
    // dans une case sont possibles, et c'est la date qui tranche. Un second
    // barème écrit ici verdirait une image et en exporterait une autre.
    const ancienne = image({ identifiant: "x", cree_le: 50, favori: true })
    const { retenue } = rangerLaLigne([ancienne, RETENUE])
    expect(retenue?.identifiant).toBe("b")
  })

  test("une pose sans direction déclarée n'a qu'une rangée, et le mot n'y paraît pas", () => {
    const rangees = rangeesDeLaCase(sienne({ pose: "repos", images: [VIEILLE] }))
    expect(rangees).toHaveLength(1)
    expect(rangees[0].nom).toBe("toutes")
    expect(rangees[0].direction).toBeNull()
  })

  test("une rangée dont toutes les images sont sans direction se lit « à confirmer »", () => {
    const orpheline = image({ identifiant: "o", cree_le: 100, direction: null })
    const rangees = rangeesDeLaCase(
      sienne({
        pose: "repos",
        images: [orpheline],
        directions: [
          { ...DIRECTION, identifiant: "sud", nom: "sud", images: [orpheline], a_confirmer: 1 },
        ],
      }),
    )
    expect(rangees[0].nom).toBe("à confirmer")
    expect(rangees[0].aConfirmer).toBe(true)
  })

  test("une seule image à confirmer parmi d'autres ne renomme pas la rangée", () => {
    const orpheline = image({ identifiant: "o", cree_le: 100, direction: null })
    const rangees = rangeesDeLaCase(
      sienne({
        pose: "repos",
        images: [orpheline, VIEILLE],
        directions: [
          {
            ...DIRECTION,
            identifiant: "sud",
            nom: "sud",
            images: [orpheline, VIEILLE],
            a_confirmer: 1,
          },
        ],
      }),
    )
    expect(rangees[0].nom).toBe("sud")
    expect(rangees[0].aConfirmer).toBe(false)
  })
})

// ── L'écran ─────────────────────────────────────────────────────────────────

describe("les rangées à l'écran", () => {
  test("la première pose est dépliée, ses rangées portent leur direction et leur compte", () => {
    monter()
    const sud = rangee("repos/sud")
    expect(within(sud).getByText("sud")).toBeTruthy()
    expect(within(sud).getByText("3")).toBeTruthy()
    expect(screen.getByText("la retenue")).toBeTruthy()
  })

  test("la retenue est le premier bouton de la piste, avant les deux gardées", () => {
    monter()
    const vignettes = rangee("repos/sud").querySelectorAll("[data-vignette-de-rangee]")
    expect([...vignettes].map((v) => v.getAttribute("data-vignette-de-rangee"))).toEqual([
      "b",
      "a",
      "c",
    ])
  })

  test("une direction sans image dit « rien encore », et garde sa case à générer", () => {
    monter()
    const nord = rangee("repos/nord")
    expect(within(nord).getByText("rien encore")).toBeTruthy()
    expect(within(nord).getByLabelText("Générer nord")).toBeTruthy()
  })

  test("la case « + générer » est hors de la piste qui défile", () => {
    // Le critère se tient par la structure, pas par une position calculée : la
    // piste est la deuxième colonne de la grille, la case la troisième.
    monter()
    const sud = rangee("repos/sud")
    const piste = sud.querySelector(".overflow-x-auto") as HTMLElement
    const case_ = sud.querySelector("[data-case-de-generation]") as HTMLElement
    expect(piste).toBeTruthy()
    expect(piste.contains(case_)).toBe(false)
  })

  test("armer une case part avec sa pose et sa direction, sans rien dépenser", () => {
    const { onArmer, appels } = monter()
    fireEvent.click(screen.getByLabelText("Générer nord"))
    expect(onArmer).toHaveBeenCalledTimes(1)
    expect(onArmer.mock.calls[0][1][0].identifiant).toBe("repos")
    expect(onArmer.mock.calls[0][3]).toBe("nord")
    expect(appels).toHaveLength(0)
  })

  test("une pose se replie et se déplie, et une seule reste ouverte", () => {
    monter([CASE_SUD, sienne({ pose: "marche", images: [VIEILLE] })])
    expect(rangee("repos/sud")).toBeTruthy()
    fireEvent.click(screen.getByRole("button", { name: /marche/ }))
    expect(rangee("repos/sud")).toBeNull()
    expect(rangee("marche/—")).toBeTruthy()
  })

  test("plusieurs images et aucune retenue : la rangée le dit, et c'est son seul rouge", () => {
    monter([
      sienne({
        pose: "repos",
        images: [VIEILLE, RECENTE],
        directions: [
          { ...DIRECTION, identifiant: "sud", nom: "sud", images: [VIEILLE, RECENTE] },
        ],
      }),
    ])
    expect(within(rangee("repos/sud")).getByText("aucune retenue")).toBeTruthy()
  })

  test("une seule image sans retenue ne réclame rien : il n'y a rien à départager", () => {
    monter([
      sienne({
        pose: "repos",
        images: [VIEILLE],
        directions: [{ ...DIRECTION, identifiant: "sud", nom: "sud", images: [VIEILLE] }],
      }),
    ])
    expect(screen.queryByText("aucune retenue")).toBeNull()
  })
})

describe("les trois marques", () => {
  test("retenir en démote une autre, et l'ordre des deux appels compte", async () => {
    const { appels } = monter()
    const vignette = rangee("repos/sud").querySelectorAll(
      "[data-vignette-de-rangee]",
    )[2] as HTMLElement
    const bloc = vignette.closest("span")?.parentElement as HTMLElement
    fireEvent.click(within(bloc).getAllByLabelText("La retenir")[2])
    await waitFor(() => expect(appels).toHaveLength(2))
    // La démotion part la première : un échec à ce moment-là laisse l'état
    // d'avant intact, au lieu de deux retenues dans la même case.
    expect(appels[0].corps).toEqual({ identifiants: ["b"], favori: false })
    expect(appels[1].corps).toEqual({ identifiants: ["c"], favori: true })
  })

  test("garder la retenue l'éteint, et n'en allume aucune autre", async () => {
    const { appels } = monter()
    fireEvent.click(screen.getAllByLabelText("La garder seulement")[0])
    await waitFor(() => expect(appels).toHaveLength(1))
    expect(appels[0].corps).toEqual({ identifiants: ["b"], favori: false })
  })

  test("garder une image déjà gardée n'appelle personne", () => {
    const { appels } = monter()
    fireEvent.click(screen.getAllByLabelText("La garder seulement")[1])
    expect(appels).toHaveLength(0)
  })

  test("écarter passe par le parent — c'est lui qui porte le geste qui rend", () => {
    const { onEcarter, appels } = monter()
    fireEvent.click(screen.getAllByLabelText("L'écarter")[0])
    expect(onEcarter).toHaveBeenCalledWith(["b"])
    expect(appels).toHaveLength(0)
  })
})

describe("le volet de l'image", () => {
  test("il ouvre sur la retenue de la pose dépliée, et la nomme", () => {
    monter()
    const volet = document.querySelector("[data-volet-de-l-image]") as HTMLElement
    expect(within(volet).getByText("L'image retenue")).toBeTruthy()
    expect(within(volet).getByText("gpt-image-2")).toBeTruthy()
  })

  test("choisir une gardée change le volet, qui cesse de dire « retenue »", () => {
    monter()
    fireEvent.click(screen.getByLabelText("image a"))
    const volet = document.querySelector("[data-volet-de-l-image]") as HTMLElement
    expect(within(volet).getByText("L'image choisie")).toBeTruthy()
  })

  test("« La retoucher » ouvre l'image dans ses tables", () => {
    const { onOuvrirCase } = monter()
    fireEvent.click(screen.getByRole("button", { name: "La retoucher" }))
    expect(onOuvrirCase).toHaveBeenCalledWith("b")
  })

  test("une image sans direction propose les angles du jeu, et un clic la range", async () => {
    const orpheline = image({ identifiant: "o", cree_le: 100, direction: null, favori: true })
    const { appels } = monter([
      sienne({
        pose: "repos",
        images: [orpheline],
        directions: [
          { ...DIRECTION, identifiant: "sud", nom: "sud", images: [orpheline], a_confirmer: 1 },
          { ...DIRECTION, identifiant: "nord", nom: "nord", images: [] },
        ],
      }),
    ])
    expect(screen.getByText("Sa direction est à confirmer")).toBeTruthy()
    fireEvent.click(screen.getByRole("button", { name: "nord" }))
    await waitFor(() => expect(appels).toHaveLength(1))
    expect(appels[0].url).toBe("/api/assets/o/character")
    // Le personnage et la pose repartent tels quels : une désignation
    // partielle effacerait la case.
    expect(appels[0].corps).toEqual({
      personnage: "pelerin",
      pose: "repos",
      direction: "nord",
    })
  })

  test("une image qui sait d'où elle regarde ne propose rien à confirmer", () => {
    monter()
    expect(screen.queryByText("Sa direction est à confirmer")).toBeNull()
  })

  test("sans rien de choisi, le volet ne se referme pas — il se vide", () => {
    // Un volet qui disparaît change la largeur de la surface, et la rangée
    // qu'on lisait se déplace sous le pointeur.
    monter([sienne({ pose: "repos" })])
    expect(document.querySelector("[data-volet-vide]")).toBeTruthy()
    expect(screen.getByText(/Aucune de ses poses n'a d'image/)).toBeTruthy()
  })
})

describe("ce que la case à générer vise", () => {
  test("une rangée « à confirmer » génère quand même vers son angle, pas vers « à confirmer »", () => {
    const orpheline = image({ identifiant: "o", cree_le: 100, direction: null })
    const { onArmer } = monter([
      sienne({
        pose: "repos",
        images: [orpheline],
        directions: [
          { ...DIRECTION, identifiant: "sud", nom: "sud", images: [orpheline], a_confirmer: 1 },
        ],
      }),
    ])
    // La rangée s'intitule « à confirmer » ; c'est bien le sud qu'on remplit.
    fireEvent.click(screen.getByLabelText("Générer sud"))
    expect(onArmer.mock.calls[0][3]).toBe("sud")
  })

  test("une pose sans direction déclarée génère « cette pose », et sans angle", () => {
    const { onArmer } = monter([sienne({ pose: "repos", images: [VIEILLE] })])
    fireEvent.click(screen.getByLabelText("Générer cette pose"))
    expect(onArmer.mock.calls[0][3]).toBeNull()
  })
})

describe("les calques", () => {
  const calqueDeB = image({
    identifiant: "k",
    cree_le: 250,
    piece: "casque",
    recette: { ...RECETTE_VIDE, difference: { base: "b", zone: null, seuil: 0, affinage: [], retouche: [] } },
  })
  const calqueDeC = image({
    identifiant: "k2",
    cree_le: 350,
    piece: "casque",
    recette: { ...RECETTE_VIDE, difference: { base: "c", zone: null, seuil: 0, affinage: [], retouche: [] } },
  })
  const avecCalques = sienne({
    pose: "repos",
    images: [VIEILLE, RETENUE, RECENTE],
    calques: { casque: [calqueDeB, calqueDeC] },
    directions: [
      { ...DIRECTION, identifiant: "sud", nom: "sud", images: [VIEILLE, RETENUE, RECENTE] },
    ],
  })

  test("l'image retenue montre ses calques à elle, pas ceux de sa pose", () => {
    monter([avecCalques])
    const section = document.querySelector("[data-calques-de-l-image]") as HTMLElement
    expect(within(section).getByText("le casque")).toBeTruthy()
    expect(section.querySelectorAll("img")).toHaveLength(1)
  })

  test("changer d'image change de calques — ils ne suivent pas la pose", () => {
    monter([avecCalques])
    fireEvent.click(screen.getByLabelText("image c"))
    const section = document.querySelector("[data-calques-de-l-image]") as HTMLElement
    // Le calque de `c` a pris la place de celui de `b` : un calque appartient à
    // l'image sur laquelle il a été calculé, jamais à la case.
    expect(section.querySelectorAll("img")).toHaveLength(1)
    const volet = document.querySelector("[data-volet-de-l-image]") as HTMLElement
    expect(within(volet).getByAltText("image c")).toBeTruthy()
  })

  test("une image sans calque n'ouvre pas la section", () => {
    monter()
    expect(document.querySelector("[data-calques-de-l-image]")).toBeNull()
  })
})

describe("ce qu'une pose repliée annonce", () => {
  const orpheline = image({ identifiant: "o", cree_le: 100, direction: null })
  const aConfirmer = sienne({
    pose: "repos",
    images: [orpheline],
    directions: [
      { ...DIRECTION, identifiant: "sud", nom: "sud", images: [orpheline], a_confirmer: 1 },
    ],
  })

  test("« à confirmer » passe avant « sans retenue » — trouvé au navigateur", () => {
    // Une pose dont toutes les images attendent leur angle annonçait « 1 sans
    // retenue » : vrai, et inutile. On ne départage pas des images dont on ne
    // sait pas encore d'où elles regardent.
    monter([aConfirmer])
    expect(screen.getByText("à confirmer", { selector: "span.rounded-5" })).toBeTruthy()
    expect(screen.queryByText("1 sans retenue")).toBeNull()
  })

  test("une pose sans la moindre image dit « rien », pas « direction vide »", () => {
    monter([sienne({ pose: "repos" })])
    expect(screen.getByText("rien")).toBeTruthy()
  })
})

describe("les trois filtres", () => {
  const sansRetenue = sienne({
    pose: "marche",
    images: [VIEILLE, RECENTE],
    directions: [
      { ...DIRECTION, identifiant: "sud", nom: "sud", images: [VIEILLE, RECENTE] },
    ],
  })

  test("« à départager » ne garde que les poses où plusieurs images se disputent la case", () => {
    monter([CASE_SUD, sansRetenue])
    fireEvent.click(screen.getByRole("tab", { name: "à départager" }))
    expect(screen.queryByRole("button", { name: /repos/ })).toBeNull()
    expect(screen.getByRole("button", { name: /marche/ })).toBeTruthy()
  })

  test("un filtre qui ne garde rien le dit, plutôt que de rendre un écran vide", () => {
    monter([CASE_SUD])
    fireEvent.click(screen.getByRole("tab", { name: "à confirmer" }))
    expect(screen.getByText("Rien de ce genre-là dans ses poses.")).toBeTruthy()
  })
})
