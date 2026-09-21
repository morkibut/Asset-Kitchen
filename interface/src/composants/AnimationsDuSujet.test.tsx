// Ce que l'onglet « Ses animations » fait (B11) : le rangement d'une rangée de
// bandes — la retenue en tête, les gardées dans l'ordre où elles sont
// arrivées, les écartées repliées derrière une flèche —, les trois marques qui
// s'excluent, et la promotion de la plus récente des gardées quand on écarte
// la retenue. `fetch` est doublé à la main, comme partout dans le dépôt —
// aucun essai ne coûte un centime.
//
// Le composant est rendu seul, sans passer par `App` : ce qu'il demande au
// serveur tient en trois routes, et les monter toutes pour les regarder ferait
// de chaque essai une seconde suite d'écran. Voir `ImagesDuSujet.test.tsx`,
// dont ce fichier reprend la structure au mot près pour les bandes.

import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { useState } from "react"
import { MemoireDuParcours } from "./MemoireDuParcours"
import { afterEach, describe, expect, test, vi } from "vitest"

import { AnimationsDuSujet, rangerLaLigne, rangeesDeLaCase } from "./AnimationsDuSujet"
import { RECETTE_VIDE, type Bande, type Case, type ObjectifProduction, type Personnage, type Pose } from "../api"

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

// ── De quoi fabriquer un sujet ──────────────────────────────────────────────

function bande(surplus: Partial<Bande> & { identifiant: string; cree_le: number }): Bande {
  return {
    clip: "clip-1",
    nom: `essai ${surplus.identifiant}`,
    images: [0, 2, 4, 6],
    prises: [],
    chutier: [],
    clips: ["clip-1"],
    melangee: false,
    cadence: 8,
    sens: "boucle",
    cadre: {
      choix: "clip",
      gauche: 0,
      sommet: 0,
      droite: 23,
      bas: 23,
      largeur: 24,
      hauteur: 24,
      mot: "pris sur le clip entier",
    },
    pivot: null,
    recette: RECETTE_VIDE,
    projet: "le-marais",
    personnage: "pelerin",
    pose: "repos",
    direction: "sud",
    planche: `generations/clip-1/bandes/${surplus.identifiant}.png`,
    case_largeur: 24,
    case_hauteur: 24,
    compte: 4,
    secondes: 0.5,
    brouillon: false,
    favori: false,
    rang: 0,
    supprime_le: null,
    supprime: false,
    // **L'état d'une bande nue** (B20) : elle ne porte aucune pièce, et c'est
    // celui de toute bande d'avant la tranche — aucun fichier n'a été réécrit
    // pour lui donner ces cinq champs.
    piece: null,
    habillage: null,
    habillee: false,
    calages: [],
    calage_garde: null,
    ...surplus,
  }
}

const DIRECTION = {
  consigne: "",
  demandees: 1,
  images: [],
  a_confirmer: 0,
  bandes: [],
  bandes_ecartees: [],
}

function sienne(surplus: Partial<Case> & { pose: string }): Case {
  return {
    demandees: 1,
    images: [],
    bandes: [],
    bandes_ecartees: [],
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
    pieces: [],
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

/** Trois bandes d'une même rangée : la plus ancienne, la retenue du milieu, la
 *  plus récente. C'est le cas qui fait mentir un tri par date seule. */
const VIEILLE = bande({ identifiant: "a", cree_le: 100 })
const RETENUE = bande({ identifiant: "b", cree_le: 200, favori: true })
const RECENTE = bande({ identifiant: "c", cree_le: 300 })

const CASE_SUD = sienne({
  pose: "repos",
  // **Le pendant du corps** (`Case.bandes`) : le serveur y met exactement les
  // mêmes bandes que celles réparties par direction — c'est le même ensemble,
  // vu d'un cran plus haut (`atelier/services/production.py`, `cases`).
  bandes: [VIEILLE, RETENUE, RECENTE],
  directions: [
    { ...DIRECTION, identifiant: "sud", nom: "sud", bandes: [VIEILLE, RETENUE, RECENTE] },
    { ...DIRECTION, identifiant: "nord", nom: "nord", bandes: [] },
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

function monter(cases: Case[] = [CASE_SUD], objectif?: ObjectifProduction) {
  const { fetchDouble, appels } = construireDouble()
  vi.stubGlobal("fetch", fetchDouble)
  const rappels = {
    onAnimer: vi.fn(),
    onOuvrirLaBande: vi.fn(),
    onErreur: vi.fn(),
  }
  const sujet = personnage(cases)
  sujet.objectif = objectif
  render(<AnimationsDuSujet personnage={sujet} plan={PLAN} {...rappels} />)
  return { ...rappels, appels }
}

const rangee = (cle: string) =>
  document.querySelector(`[data-rangee="${cle}"]`) as HTMLElement

// **Le défilement ne se retient plus ici** : depuis que la page du sujet ne
// fait qu'un seul bloc qui défile, c'est elle qui garde la position, et
// `PageDuSujet.test.tsx` l'essaie. Il reste ici les filtres et le volet.
test("la galerie retrouve ses filtres au retour de retouche, sans volet imposé", () => {
  const cases = [CASE_SUD, sienne({ pose: "marche", directions: [{ ...DIRECTION, identifiant: "nord", nom: "nord", bandes: [bande({ identifiant: "marche-nord", cree_le: 400, pose: "marche", direction: "nord" })] }] })]
  function Parcours() {
    const [retouche, setRetouche] = useState(false)
    return retouche ? <button onClick={() => setRetouche(false)}>Retour au sujet</button> : <AnimationsDuSujet personnage={personnage(cases)} plan={PLAN} onAnimer={vi.fn()} onErreur={vi.fn()} onOuvrirLaBande={() => setRetouche(true)} />
  }
  render(<MemoireDuParcours><Parcours /></MemoireDuParcours>)
  fireEvent.change(screen.getByLabelText("Mouvement de la galerie"), { target: { value: "marche" } })
  fireEvent.change(screen.getByLabelText("Direction de la galerie"), { target: { value: "nord" } })
  fireEvent.change(screen.getByLabelText("Jugement de la galerie"), { target: { value: "gardee" } })
  expect(document.querySelectorAll("[data-carte-animation]")).toHaveLength(1)
  fireEvent.click(screen.getByRole("button", { name: "Retoucher essai marche-nord" }))
  fireEvent.click(screen.getByRole("button", { name: "Retour au sujet" }))
  expect((screen.getByLabelText("Mouvement de la galerie") as HTMLSelectElement).value).toBe("marche")
  expect((screen.getByLabelText("Direction de la galerie") as HTMLSelectElement).value).toBe("nord")
  expect((screen.getByLabelText("Jugement de la galerie") as HTMLSelectElement).value).toBe("gardee")
  expect(document.querySelectorAll("[data-carte-animation]")).toHaveLength(1)
  expect(document.querySelector('[data-volet-de-la-bande]')).toBeNull()
})

test("une vignette joue au survol ou au focus, et reste immobile autrement", () => {
  vi.useFakeTimers()
  monter()
  const vignette = within(rangee("repos/sud")).getByLabelText("essai a")
  const frame = vignette.querySelector("[data-bande-qui-tourne] > span") as HTMLElement
  const initial = frame.style.backgroundPosition
  act(() => vi.advanceTimersByTime(125))
  expect(frame.style.backgroundPosition).toBe(initial)
  fireEvent.pointerEnter(vignette)
  act(() => vi.advanceTimersByTime(125))
  expect(frame.style.backgroundPosition).not.toBe(initial)
  fireEvent.pointerLeave(vignette)
  act(() => vi.advanceTimersByTime(125))
  expect(frame.style.backgroundPosition).toBe(initial)
  fireEvent.focus(vignette)
  act(() => vi.advanceTimersByTime(125))
  expect(frame.style.backgroundPosition).not.toBe(initial)
  fireEvent.blur(vignette)
  expect(frame.style.backgroundPosition).toBe(initial)
})

// ── Le rangement, sans écran ────────────────────────────────────────────────

describe("le rangement d'une rangée", () => {
  test("la retenue passe en tête quelle que soit sa date, les gardées suivent la leur", () => {
    const { retenue, gardees } = rangerLaLigne([RECENTE, VIEILLE, RETENUE])
    expect(retenue?.identifiant).toBe("b")
    expect(gardees.map((b) => b.identifiant)).toEqual(["a", "c"])
  })

  test("sans aucune retenue, rien ne se promeut de soi-même", () => {
    const { retenue, gardees } = rangerLaLigne([RECENTE, VIEILLE])
    expect(retenue).toBeNull()
    expect(gardees.map((b) => b.identifiant)).toEqual(["a", "c"])
  })

  test("entre deux retenues, la plus récente gagne", () => {
    const ancienne = bande({ identifiant: "x", cree_le: 50, favori: true })
    const { retenue } = rangerLaLigne([ancienne, RETENUE])
    expect(retenue?.identifiant).toBe("b")
  })

  test("une pose sans direction déclarée n'a qu'une rangée, et le mot n'y paraît pas", () => {
    const rangees = rangeesDeLaCase(sienne({ pose: "repos", bandes: [VIEILLE] }))
    expect(rangees).toHaveLength(1)
    expect(rangees[0].nom).toBe("toutes")
    expect(rangees[0].direction).toBeNull()
  })

  test("une bande écartée ne compte pas dans la rangée, et se retrouve triée à part", () => {
    const ecartee1 = bande({ identifiant: "e1", cree_le: 400, supprime_le: 1_700 })
    const ecartee2 = bande({ identifiant: "e2", cree_le: 350, supprime_le: 1_700 })
    const rangees = rangeesDeLaCase(
      sienne({
        pose: "repos",
        directions: [
          {
            ...DIRECTION,
            identifiant: "sud",
            nom: "sud",
            bandes: [RETENUE],
            bandes_ecartees: [ecartee1, ecartee2],
          },
        ],
      }),
    )
    expect(rangees[0].compte).toBe(1)
    expect(rangees[0].ecartees.map((b) => b.identifiant)).toEqual(["e2", "e1"])
  })
})

// ── L'écran ─────────────────────────────────────────────────────────────────

describe("les rangées à l'écran", () => {
  const objectifMarcheEst: ObjectifProduction = {
    sorties: [{ nature: "animation", pose: "marche", direction: "est", quantite: 1 }],
    largeur: 64, hauteur: 64, cadence: 8, boucle: true, repere: { x: 32, y: 64 },
  }
  const marcheEst = sienne({
    pose: "marche",
    directions: [
      { ...DIRECTION, identifiant: "est", nom: "est", bandes: [] },
      { ...DIRECTION, identifiant: "ouest", nom: "ouest", bandes: [] },
    ],
  })

  test("un objectif marche-est seul ne transforme pas les autres poses ni directions en manques", () => {
    monter([
      sienne({ pose: "repos", directions: [{ ...DIRECTION, identifiant: "sud", nom: "sud", bandes: [] }] }),
      marcheEst,
    ], objectifMarcheEst)

    expect(document.querySelector('[data-pose-de-rangement="repos"]')).toBeNull()
    expect(document.querySelector('[data-rangee="marche/ouest"]')).toBeNull()
    expect(rangee("marche/est")).toBeTruthy()
    expect(within(rangee("marche/est")).getByText("aucun clip encore — à fabriquer")).toBeTruthy()
    expect(screen.getAllByText("1 à fabriquer")).toHaveLength(1)
  })

  test("une bande ancienne hors objectif reste ouvrable et porte sa portée", () => {
    const { onOuvrirLaBande } = monter([CASE_SUD, marcheEst], objectifMarcheEst)
    const repos = document.querySelector('[data-pose-de-rangement="repos"]') as HTMLElement
    expect(within(repos).getByText("hors objectif")).toBeTruthy()
    fireEvent.click(within(repos).getByRole("button", { name: /repos/ }))
    fireEvent.click(within(rangee("repos/sud")).getByLabelText(/essai b/))
    fireEvent.click(screen.getByRole("button", { name: "L'ouvrir dans l'atelier" }))
    expect(onOuvrirLaBande).toHaveBeenCalledWith("b")
  })

  test("sans objectif explicite, le plan historique reste entièrement parcourable", () => {
    monter([CASE_SUD, marcheEst])
    expect(document.querySelector('[data-pose-de-rangement="repos"]')).toBeTruthy()
    expect(document.querySelector('[data-pose-de-rangement="marche"]')).toBeTruthy()
    expect(screen.queryByText("hors objectif")).toBeNull()
  })

  test("la première pose est dépliée, ses rangées portent leur direction et leur compte", () => {
    monter()
    const sud = rangee("repos/sud")
    expect(within(sud).getByText("sud")).toBeTruthy()
    expect(within(sud).getByText("3")).toBeTruthy()
    expect(screen.getByText("la retenue")).toBeTruthy()
  })

  test("la retenue est le premier bouton de la piste, avant les deux gardées", () => {
    monter()
    const vignettes = rangee("repos/sud").querySelectorAll("[data-vignette-de-bande]")
    expect([...vignettes].map((v) => v.getAttribute("data-vignette-de-bande"))).toEqual([
      "b",
      "a",
      "c",
    ])
  })

  test("une direction sans bande dit « rien encore », et garde sa case à générer", () => {
    monter()
    const nord = rangee("repos/nord")
    expect(within(nord).getByText(/rien encore/)).toBeTruthy()
    expect(within(nord).getByLabelText("Générer nord")).toBeTruthy()
  })

  test("la case « + générer » est hors de la piste qui défile", () => {
    monter()
    const sud = rangee("repos/sud")
    const piste = sud.querySelector(".overflow-x-auto") as HTMLElement
    const case_ = sud.querySelector("[data-case-de-generation]") as HTMLElement
    expect(piste).toBeTruthy()
    expect(piste.contains(case_)).toBe(false)
  })

  test("générer une case part avec sa pose et sa direction, sans rien dépenser", () => {
    const { onAnimer, appels } = monter()
    fireEvent.click(screen.getByLabelText("Générer nord"))
    expect(onAnimer).toHaveBeenCalledTimes(1)
    expect(onAnimer.mock.calls[0][1].identifiant).toBe("repos")
    expect(onAnimer.mock.calls[0][2]).toEqual({ identifiant: "nord", nom: "nord" })
    expect(appels).toHaveLength(0)
  })

  test("une pose sans direction déclarée génère sans angle", () => {
    const { onAnimer } = monter([sienne({ pose: "repos", bandes: [VIEILLE] })])
    fireEvent.click(screen.getByLabelText("Générer cette pose"))
    expect(onAnimer.mock.calls[0][2]).toBeNull()
  })

  test("une pose se replie et se déplie, et une seule reste ouverte", () => {
    monter([CASE_SUD, sienne({ pose: "marche", bandes: [VIEILLE] })])
    expect(rangee("repos/sud")).toBeTruthy()
    fireEvent.click(screen.getByRole("button", { name: /marche/ }))
    expect(rangee("repos/sud")).toBeNull()
    expect(rangee("marche/—")).toBeTruthy()
  })

  test("plusieurs bandes et aucune retenue : la rangée le dit, et c'est son seul rouge", () => {
    monter([
      sienne({
        pose: "repos",
        directions: [{ ...DIRECTION, identifiant: "sud", nom: "sud", bandes: [VIEILLE, RECENTE] }],
      }),
    ])
    expect(within(rangee("repos/sud")).getByText("aucune retenue")).toBeTruthy()
  })

  test("une seule bande à juger garde une place explicite pour la retenue", () => {
    monter([
      sienne({
        pose: "repos",
        directions: [{ ...DIRECTION, identifiant: "sud", nom: "sud", bandes: [VIEILLE] }],
      }),
    ])
    expect(screen.getByText("aucune retenue")).toBeTruthy()
  })
})

// D1 (`docs/PLAN-rangement.md`) : seuls personnage et créature ont des directions.
describe("une nature sans directions", () => {
  function monterSans(avecDirections: boolean | undefined) {
    const { fetchDouble } = construireDouble()
    vi.stubGlobal("fetch", fetchDouble)
    render(<AnimationsDuSujet personnage={personnage([CASE_SUD])} plan={PLAN} onAnimer={vi.fn()} onOuvrirLaBande={vi.fn()} onErreur={vi.fn()}
      {...(avecDirections === undefined ? {} : { avecDirections })} />)
  }

  test("une seule rangée pour la pose, qui garde toutes ses animations", () => {
    const rangees = rangeesDeLaCase(CASE_SUD, false)
    expect(rangees).toHaveLength(1)
    expect(rangees[0].direction).toBeNull()
    expect(rangees[0].compte).toBe(3)
  })

  test("sans la capacité, ni filtre Direction ni rangée par direction", () => {
    monterSans(false)
    expect(screen.queryByLabelText("Direction de la galerie")).toBeNull()
    expect(rangee("repos/sud")).toBeNull()
    expect(rangee("repos/nord")).toBeNull()
    expect(rangee("repos/—")).toBeTruthy()
    expect(document.querySelector('[data-pose-de-rangement="repos"]')?.textContent).not.toMatch(/\d+ directions?/)
  })

  test("avec la capacité, ou tant qu'elle n'est pas connue, rien ne change", () => {
    monterSans(true)
    expect(screen.getByLabelText("Direction de la galerie")).toBeTruthy()
    expect(rangee("repos/sud")).toBeTruthy()
    cleanup()
    monterSans(undefined)
    expect(screen.getByLabelText("Direction de la galerie")).toBeTruthy()
    expect(rangee("repos/nord")).toBeTruthy()
  })
})

describe("les écartées, à droite et repliables", () => {
  const ecartee = bande({ identifiant: "e", cree_le: 150, supprime_le: 1_700 })
  const avecEcartee = sienne({
    pose: "repos",
    bandes: [RETENUE],
    bandes_ecartees: [ecartee],
    directions: [
      {
        ...DIRECTION,
        identifiant: "sud",
        nom: "sud",
        bandes: [RETENUE],
        bandes_ecartees: [ecartee],
      },
    ],
  })

  test("une bande écartée paraît à droite des versions actives", () => {
    monter([avecEcartee])
    const sud = rangee("repos/sud")
    expect(Array.from(sud.querySelectorAll('[data-vignette-de-bande]')).map((v) => v.getAttribute('data-vignette-de-bande'))).toEqual(['b', 'e'])
    expect(within(sud).getByRole("button", { name: "1 écartée" })).toBeTruthy()
  })

  test("la flèche masque puis retrouve les écartées", () => {
    monter([avecEcartee])
    const sud = rangee("repos/sud")
    fireEvent.click(within(sud).getByRole("button", { name: "1 écartée" }))
    expect(sud.querySelector('[data-vignette-de-bande="e"]')).toBeNull()
    fireEvent.click(within(sud).getByRole("button", { name: "1 écartée" }))
    expect(sud.querySelector('[data-vignette-de-bande="e"]')).toBeTruthy()
  })

  test("restaurer une écartée part à /api/strips/restore", async () => {
    const { appels } = monter([avecEcartee])
    const sud = rangee("repos/sud")
    fireEvent.click(within(sud).getByRole("button", { name: /restaurer/i }))
    await waitFor(() => expect(appels).toHaveLength(1))
    expect(appels[0].url).toBe("/api/strips/restore")
    expect(appels[0].corps).toEqual({ identifiants: ["e"] })
  })
})

describe("les trois marques", () => {
  test("retenir démote l'ancienne retenue, et l'ordre des deux appels compte", async () => {
    const { appels } = monter()
    const vignette = rangee("repos/sud").querySelectorAll("[data-vignette-de-bande]")[2] as HTMLElement
    const bloc = vignette.closest("span")?.parentElement as HTMLElement
    fireEvent.click(within(bloc).getAllByLabelText("Choisir pour le jeu")[2])
    await waitFor(() => expect(appels).toHaveLength(2))
    // La démotion part la première : un échec à ce moment-là laisse l'état
    // d'avant intact, au lieu de deux retenues dans la même case.
    expect(appels[0].url).toBe("/api/strips/favorite")
    expect(appels[0].corps).toEqual({ identifiants: ["b"], favori: false })
    expect(appels[1].corps).toEqual({ identifiants: ["c"], favori: true })
  })

  test("garder la retenue l'éteint, et n'en allume aucune autre", async () => {
    const { appels } = monter()
    fireEvent.click(screen.getAllByLabelText("La garder seulement")[0])
    await waitFor(() => expect(appels).toHaveLength(1))
    expect(appels[0].corps).toEqual({ identifiants: ["b"], favori: false })
  })

  test("garder une bande déjà gardée n'appelle personne", () => {
    const { appels } = monter()
    fireEvent.click(screen.getAllByLabelText("La garder seulement")[1])
    expect(appels).toHaveLength(0)
  })

  test("écarter une simple gardée ne touche à aucune retenue", async () => {
    const { appels } = monter()
    fireEvent.click(screen.getAllByLabelText("L'écarter")[1]) // la vieille, gardée
    await waitFor(() => expect(appels).toHaveLength(1))
    expect(appels[0].url).toBe("/api/strips/delete")
    expect(appels[0].corps).toEqual({ identifiants: ["a"] })
  })

  test("⚠️ écarter la retenue promeut la plus récente des gardées à sa place", async () => {
    // Le critère d'acceptation de B11 : une bande écartée qui était la retenue
    // laisse la place à la plus récente de celles qui restent — parce que rien
    // côté serveur ne redépartage seul une bande, contrairement à une image
    // (`corps_retenu`). Voir l'en-tête d'`AnimationsDuSujet.tsx`.
    const { appels } = monter()
    fireEvent.click(screen.getAllByLabelText("L'écarter")[0]) // la retenue, b
    await waitFor(() => expect(appels).toHaveLength(2))
    expect(appels[0].url).toBe("/api/strips/delete")
    expect(appels[0].corps).toEqual({ identifiants: ["b"] })
    expect(appels[1].url).toBe("/api/strips/favorite")
    // c est la plus récente des gardées restantes (a, c).
    expect(appels[1].corps).toEqual({ identifiants: ["c"], favori: true })
  })

  test("écarter la seule bande d'une rangée à une bande ne promeut personne", async () => {
    const { appels } = monter([
      sienne({
        pose: "repos",
        directions: [{ ...DIRECTION, identifiant: "sud", nom: "sud", bandes: [VIEILLE] }],
      }),
    ])
    fireEvent.click(screen.getByLabelText("L'écarter"))
    await waitFor(() => expect(appels).toHaveLength(1))
    expect(appels[0].corps).toEqual({ identifiants: ["a"] })
  })
})

describe("le volet de la bande", () => {
  test("la liste reste pleine largeur ; un clic ouvre les détails, qui se referment", () => {
    monter()
    expect(document.querySelector("[data-volet-de-la-bande]")).toBeNull()
    fireEvent.click(within(rangee("repos/sud")).getByLabelText(/essai b/))
    const volet = document.querySelector("[data-volet-de-la-bande]") as HTMLElement
    expect(within(volet).getByText("L'animation retenue")).toBeTruthy()
    fireEvent.click(screen.getByRole("button", { name: "Fermer les détails" }))
    expect(document.querySelector("[data-volet-de-la-bande]")).toBeNull()
  })

  test("choisir une gardée change le volet, qui cesse de dire « retenue »", () => {
    monter()
    fireEvent.click(within(rangee("repos/sud")).getByLabelText(/essai a/))
    const volet = document.querySelector("[data-volet-de-la-bande]") as HTMLElement
    expect(within(volet).getByText("L'animation choisie")).toBeTruthy()
  })

  test("« L'ouvrir dans l'atelier » part avec l'identifiant de la bande", () => {
    const { onOuvrirLaBande } = monter()
    fireEvent.click(within(rangee("repos/sud")).getByLabelText(/essai b/))
    fireEvent.click(screen.getByRole("button", { name: "L'ouvrir dans l'atelier" }))
    expect(onOuvrirLaBande).toHaveBeenCalledWith("b")
    expect(document.querySelector("[data-volet-de-la-bande]")).toBeNull()
  })

  test("un double clic ouvre directement la retouche et libère les détails", () => {
    const { onOuvrirLaBande } = monter()
    const vignette = within(rangee("repos/sud")).getByLabelText(/essai b/)
    fireEvent.click(vignette)
    fireEvent.doubleClick(vignette)
    expect(onOuvrirLaBande).toHaveBeenCalledWith("b")
    expect(document.querySelector("[data-volet-de-la-bande]")).toBeNull()
  })

  test("« En générer une variante » anime la pose et la direction de la bande choisie", () => {
    const { onAnimer } = monter()
    fireEvent.click(within(rangee("repos/sud")).getByLabelText(/essai b/))
    fireEvent.click(screen.getByRole("button", { name: "En générer une variante" }))
    expect(onAnimer.mock.calls[0][1].identifiant).toBe("repos")
    expect(onAnimer.mock.calls[0][2]).toEqual({ identifiant: "sud", nom: "sud" })
  })

  test("« L'écarter » depuis le volet part au serveur, et promeut si c'était la retenue", async () => {
    const { appels } = monter()
    fireEvent.click(within(rangee("repos/sud")).getByLabelText(/essai b/))
    const volet = document.querySelector("[data-volet-de-la-bande]") as HTMLElement
    fireEvent.click(within(volet).getByRole("button", { name: "L'écarter" }))
    await waitFor(() => expect(appels).toHaveLength(2))
    expect(appels[0].corps).toEqual({ identifiants: ["b"] })
  })

  test("sans animation, aucun volet vide ne réserve une colonne", () => {
    monter([sienne({ pose: "repos" })])
    expect(document.querySelector("aside")).toBeNull()
    expect(screen.getByLabelText("Générer cette pose")).toBeTruthy()
  })
})

describe("les deux filtres", () => {
  const sansRetenue = sienne({
    pose: "marche",
    directions: [{ ...DIRECTION, identifiant: "sud", nom: "sud", bandes: [VIEILLE, RECENTE] }],
  })

  test("« à départager » ne garde que les poses où plusieurs bandes se disputent la case", () => {
    monter([CASE_SUD, sansRetenue])
    fireEvent.click(screen.getByRole("tab", { name: "à départager" }))
    expect(screen.queryByRole("button", { name: /repos/ })).toBeNull()
    expect(screen.getByRole("button", { name: /marche/ })).toBeTruthy()
  })

  test("aucun troisième onglet — « sans retenue » désignerait le même ensemble", () => {
    // Une case à une seule bande non retenue n'est déjà pas signalée par
    // `ceQuiCloche` : un onglet de plus n'isolerait jamais rien que « à
    // départager » ne montre déjà. Voir l'en-tête du fichier.
    monter()
    expect(screen.queryByRole("tab", { name: "sans retenue" })).toBeNull()
  })

  test("un filtre qui ne garde rien le dit, plutôt que de rendre un écran vide", () => {
    monter([sienne({ pose: "repos" })])
    fireEvent.click(screen.getByRole("tab", { name: "à départager" }))
    expect(screen.getByText("Rien de ce genre-là dans ses poses.")).toBeTruthy()
  })
})

// ── Animer en lot, clips non montés, changer de case (16 septembre 2026) ──

function monterAvecServeur(cases: Case[], clips: import("../api").Generation[] = []) {
  const appels: { url: string; methode: string; corps: unknown }[] = []
  vi.stubGlobal("fetch", vi.fn(async (chemin: string, init?: RequestInit) => {
    const url = String(chemin)
    const corps = typeof init?.body === "string" ? (JSON.parse(init.body) as unknown) : undefined
    appels.push({ url, methode: init?.method ?? "GET", corps })
    const rendre = (charge: unknown) => ({ ok: true, status: 200, json: async () => charge }) as Response
    if (url.startsWith("/api/clips/models")) return rendre({ modeles: [{ identifiant: "maison/wan-2.2-i2v-14b-pixel", nom: "Wan maison", grise: null, de_la_maison: true, prix: { montant: 0 }, attente: { secondes: 600, secondes_suivant: 300 } }], raison: null })
    if (url.startsWith("/api/clips/start-image")) return rendre({ asset: { identifiant: "sprite-1" }, origine: "case", raison: "" })
    if (url.startsWith("/api/movements/for-pose/")) return rendre({ pose: "repos", mouvement: { identifiant: "respire" }, texte: "breathing", origine: "mouvement" })
    if (url === "/api/clips") return rendre({ clips: [{ identifiant: "neuf" }] })
    return rendre({})
  }))
  const rappels = { onAnimer: vi.fn(), onOuvrirLaBande: vi.fn(), onErreur: vi.fn(), onMonterLeClip: vi.fn(), onClipsCommandes: vi.fn() }
  render(<AnimationsDuSujet personnage={personnage(cases)} plan={PLAN} clips={clips} {...rappels} />)
  return { ...rappels, appels }
}

test("« Tout animer » ne relance pas une direction retenue, et monte chaque clip à l'arrivée", async () => {
  const { appels, onClipsCommandes } = monterAvecServeur([CASE_SUD])
  fireEvent.click(screen.getByRole("button", { name: "Tout animer" }))
  const dialogue = document.querySelector("[data-animer-en-lot]") as HTMLElement
  const sud = within(dialogue).getByText("sud").closest("label")!.querySelector("input")!
  const nord = within(dialogue).getByText("nord").closest("label")!.querySelector("input")!
  expect(sud.disabled).toBe(true)
  expect(nord.checked).toBe(true)
  const lancer = await within(dialogue).findByRole("button", { name: /Lancer 1 clip/ })
  await waitFor(() => expect((lancer as HTMLButtonElement).disabled).toBe(false))
  fireEvent.click(lancer)
  await within(dialogue).findByText(/1 clip dans la file/)
  const commandes = appels.filter((a) => a.url === "/api/clips" && a.methode === "POST")
  expect(commandes).toHaveLength(1)
  expect(commandes[0].corps).toMatchObject({ pose: "repos", direction: "nord", asset: "sprite-1", mouvement: "respire", secondes: 1.5, monter_auto: true })
  expect(onClipsCommandes).toHaveBeenCalled()
})

test("un clip en route se montre dans sa rangée, et bloque sa case dans un lot", () => {
  const enRoute = { identifiant: "en-route", personnage: "pelerin", pose: "repos", direction: "nord", statut: "en_cours", clip: { jete: false } } as unknown as import("../api").Generation
  monterAvecServeur([CASE_SUD], [enRoute])
  expect(rangee("repos/nord").querySelector('[data-clip-non-monte="en-route"]')).toBeTruthy()
  fireEvent.click(screen.getByRole("button", { name: "Animer les directions" }))
  const dialogue = document.querySelector("[data-animer-en-lot]") as HTMLElement
  expect(within(dialogue).getByText("nord").closest("label")!.querySelector("input")!.disabled).toBe(true)
})

// ── Une vidéo ratée au contrôle d'arrivée (RV1) ─────────────────────────────

test("une vidéo ratée au contrôle reste visible dans sa rangée, avec sa raison", () => {
  const ratee = {
    identifiant: "ratee-1", personnage: "pelerin", pose: "repos", direction: "nord",
    statut: "echouee", clip: { jete: false, controle: "noire" },
    emplacements: [{ raison: "la vidéo est revenue noire" }],
  } as unknown as import("../api").Generation
  monterAvecServeur([CASE_SUD], [ratee])
  const carte = rangee("repos/nord").querySelector('[data-clip-rate="ratee-1"]')
  expect(carte).toBeTruthy()
  expect(carte!.textContent).toContain("la vidéo est revenue noire")
})

test("« Relancer » rouvre la préparation de la case, et rien ne part avant ce clic", () => {
  const ratee = {
    identifiant: "ratee-1", personnage: "pelerin", pose: "repos", direction: "nord",
    statut: "echouee", clip: { jete: false, controle: "vide" },
    emplacements: [{ raison: "le détourage n'a rien laissé" }],
  } as unknown as import("../api").Generation
  const { onAnimer, appels } = monterAvecServeur([CASE_SUD], [ratee])
  const conteneur = rangee("repos/nord")
  const relancer = within(conteneur as unknown as HTMLElement).getByRole("button", { name: "Relancer" })
  fireEvent.click(relancer)
  expect(onAnimer).toHaveBeenCalledTimes(1)
  expect(onAnimer.mock.calls[0][1]).toMatchObject({ identifiant: "repos" })
  expect(onAnimer.mock.calls[0][2]).toMatchObject({ identifiant: "nord" })
  // Rouvrir la préparation n'envoie aucune commande de son propre chef.
  expect(appels.some((a) => a.url === "/api/clips" && a.methode === "POST")).toBe(false)
})

test("le volet déplace l'animation choisie vers une autre pose", async () => {
  const marche = sienne({ pose: "marche", directions: [{ ...DIRECTION, identifiant: "est", nom: "est", bandes: [] }] })
  const { appels } = monterAvecServeur([CASE_SUD, marche])
  const vignette = rangee("repos/sud").querySelector('[data-vignette-de-bande="b"]') as HTMLElement
  fireEvent.click(vignette)
  const volet = document.querySelector("[data-deplacer-l-animation]") as HTMLElement
  fireEvent.change(within(volet).getByLabelText("Pose de destination"), { target: { value: "marche" } })
  fireEvent.click(within(volet).getByRole("button", { name: "Déplacer" }))
  await waitFor(() => expect(appels.some((a) => a.url === "/api/strips/b/case" && a.methode === "PUT")).toBe(true))
  expect(appels.find((a) => a.url === "/api/strips/b/case")!.corps).toEqual({ pose: "marche", direction: "est" })
})
