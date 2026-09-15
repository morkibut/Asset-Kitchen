// Ce que Comparer fait (B13) : deux sujets côte à côte, même pose, même
// zoom, avec l'écart chiffré et l'action qui le corrige — ou deux images d'un
// même sujet, quand le second choix est le premier. Quatre écarts, tous tirés
// de nombres que le produit calcule déjà (`Asset.rendu_hauteur`/
// `rendu_largeur`, `recette.contours`, `recette.quantification.couleurs`).
// Aucun appel serveur : comme `GrilleDuJeu.test.tsx`, l'écran ne reçoit que
// des props déjà chargées.

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, test, vi } from "vitest"

import {
  Comparer,
  SES_ANIMATIONS,
  groupesDAnimations,
  pasDuTempsCommun,
  rangSurLeTempsCommun,
} from "./Comparer"
import {
  CONTOUR_PAR_DEFAUT,
  RECETTE_VIDE,
  dureeImageMs,
  type Asset,
  type Bande,
  type Case,
  type Personnage,
  type Pose,
  type Univers,
} from "../api"

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

function image(surplus: Partial<Asset> & { identifiant: string }): Asset {
  return {
    generation: "gen-1",
    rang: 0,
    largeur: 256,
    hauteur: 256,
    type_media: "image/png",
    label: `image ${surplus.identifiant}`,
    recette: RECETTE_VIDE,
    rendu_largeur: 34,
    rendu_hauteur: 62,
    cree_le: 200,
    cout_usd: 0,
    consomme: 0,
    unite: "usd",
    provenance: "auteur",
    modele: "gpt-image-2",
    personnage: "le-pelerin",
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
  { identifiant: "repos", nom: "Repos", images: 1, consigne: "", ecartees: [], images_avant: 0 },
]

function sujet(surplus: Partial<Personnage> = {}): Personnage {
  return {
    identifiant: "le-pelerin",
    projet: "le-marais",
    nom: "Le pèlerin",
    description: "",
    ecartees: [],
    concept_arts: [],
    references_ecartees: [],
    cree_le: 1_700_000_000,
    cases: [sienne({ pose: "repos", images: [image({ identifiant: "a" })], corps: "a" })],
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
    ...surplus,
  } as Personnage
}

function univers(surplus: Partial<Univers> = {}): Univers {
  return {
    bible: [],
    bareme: [
      { nom: "personnage", famille: "personnages", occupation: 100, silhouette: true },
      { nom: "créature", famille: "personnages", occupation: 90, silhouette: true },
    ],
    style: "pixel",
    cible_px: 64,
    vue: "",
    couleurs: 24,
    methode_pixels: "proche",
    palette: [],
    palette_empreinte: "",
    fond: "#336633",
    modeles: {},
    ...surplus,
  } as unknown as Univers
}

const LE_GARDE = sujet({
  identifiant: "le-garde",
  nom: "Le garde",
  cases: [
    sienne({
      pose: "repos",
      images: [image({ identifiant: "b", rendu_hauteur: 66, rendu_largeur: 38 })],
      corps: "b",
    }),
  ],
})

function monter(
  options: {
    sujetA?: Personnage
    autres?: Personnage[]
    univers?: Univers
    onOuvrirCase?: () => void
  } = {},
) {
  const onFermer = vi.fn()
  const onGrille = vi.fn()
  const onOuvrirCase = vi.fn()
  const onOuvrirLaBande = vi.fn()
  const sujetA = options.sujetA ?? sujet()
  const rendu = render(
    <Comparer
      personnage={sujetA}
      personnages={[sujetA, ...(options.autres ?? [LE_GARDE])]}
      plan={PLAN}
      univers={options.univers ?? univers()}
      onFermer={onFermer}
      onGrille={onGrille}
      onOuvrirCase={onOuvrirCase}
      onOuvrirLaBande={onOuvrirLaBande}
    />,
  )
  return { onFermer, onGrille, onOuvrirCase, onOuvrirLaBande, sujetA, ...rendu }
}

describe("deux sujets côte à côte", () => {
  test("s'ouvre sur le second sujet du jeu, par défaut", () => {
    monter()
    expect(screen.getByText("Deux côte à côte")).toBeTruthy()
    expect(screen.getAllByText("Le pèlerin").length).toBeGreaterThan(0)
    expect(screen.getByRole("combobox", { name: "Comparer avec" })).toHaveValue("le-garde")
  })

  test("les écarts de hauteur et de largeur sont ceux des images réelles", () => {
    monter()
    // Hauteur : 62 contre 66, un écart de +4. Largeur : 34 contre 38, pareil.
    expect(screen.getByText("62 px")).toBeTruthy()
    expect(screen.getByText("66 px")).toBeTruthy()
    expect(screen.getAllByText("+4 px")).toHaveLength(2)
    expect(screen.getByText("34 px")).toBeTruthy()
    expect(screen.getByText("38 px")).toBeTruthy()
  })

  test("une hauteur qui dépasse la case du jeu porte l'action qui la corrige", () => {
    const { onOuvrirCase } = monter()
    // 66 px pour une case de 64 : le garde dépasse sa tuile.
    expect(screen.getByText(/dépasse sa case/)).toBeTruthy()
    fireEvent.click(screen.getByRole("button", { name: "La retoucher" }))
    // **Le sujet propriétaire voyage avec l'image** : sans lui, l'appelant ne
    // peut pas savoir qu'il faut changer de page avant d'ouvrir la case —
    // exactement le bug trouvé au navigateur sur l'atelier jetable de B13.
    expect(onOuvrirCase).toHaveBeenCalledWith("le-garde", "b")
  })

  test("un contour d'un seul côté est un écart, pas « le même »", () => {
    // Le bug trouvé au navigateur sur l'atelier jetable de B13 : la règle
    // exigeait les deux contours non nuls avant de comparer, donc « un
    // détouré, l'autre pas » — le cas le plus courant — passait pour
    // identique.
    monter({
      autres: [
        sujet({
          identifiant: "le-garde",
          nom: "Le garde",
          cases: [
            sienne({
              pose: "repos",
              images: [
                image({
                  identifiant: "b",
                  recette: {
                    ...RECETTE_VIDE,
                    contours: {
                      ...CONTOUR_PAR_DEFAUT,
                      epaisseur: 2,
                      couleur: "#1a1a1a",
                      position: "externe",
                      trous: "cercles",
                    },
                  },
                }),
              ],
              corps: "b",
            }),
          ],
        }),
      ],
    })
    expect(screen.getByText("aucun")).toBeTruthy()
    expect(screen.getByText("2 px")).toBeTruthy()
    expect(screen.getByText("deux traits différents")).toBeTruthy()
    expect(screen.getByText("Son contour n'est pas le même")).toBeTruthy()
  })

  test("rien ne dépasse : le panneau le dit, sans carte de correction", () => {
    monter({
      autres: [
        sujet({
          identifiant: "le-passeur",
          nom: "Le passeur",
          cases: [
            sienne({
              pose: "repos",
              images: [image({ identifiant: "c", rendu_hauteur: 60, rendu_largeur: 36 })],
              corps: "c",
            }),
          ],
        }),
      ],
    })
    fireEvent.change(screen.getByRole("combobox", { name: "Comparer avec" }), {
      target: { value: "le-passeur" },
    })
    expect(screen.getByText(/Rien ne dépasse ici/)).toBeTruthy()
    expect(screen.queryByRole("button", { name: "La retoucher" })).toBeNull()
  })
})

describe("choisir deux fois le même sujet", () => {
  test("bascule en comparaison de deux de ses images", () => {
    monter({
      sujetA: sujet({
        cases: [
          sienne({
            pose: "repos",
            images: [
              image({ identifiant: "a", cree_le: 100 }),
              image({ identifiant: "a2", cree_le: 200 }),
            ],
          }),
        ],
      }),
    })
    fireEvent.change(screen.getByRole("combobox", { name: "Comparer avec" }), {
      target: { value: "le-pelerin" },
    })
    expect(screen.getByText("Le même, deux fois")).toBeTruthy()
    expect(screen.getByRole("combobox", { name: "La première image" })).toBeTruthy()
    expect(screen.getByRole("combobox", { name: "La seconde image" })).toBeTruthy()
  })
})

describe("le zoom", () => {
  test("quatre crans entiers, et seulement quatre", () => {
    monter()
    ;["×1", "×2", "×4", "×8"].forEach((libelle) => {
      expect(screen.getByRole("button", { name: libelle })).toBeTruthy()
    })
    expect(screen.queryByRole("button", { name: "×3" })).toBeNull()
  })
})

describe("ça ne modifie rien", () => {
  test("aucun appel réseau ne part de cet écran", () => {
    const fetchDouble = vi.fn()
    vi.stubGlobal("fetch", fetchDouble)
    monter()
    fireEvent.click(screen.getByRole("button", { name: "×8" }))
    fireEvent.change(screen.getByRole("combobox", { name: "Comparer avec" }), {
      target: { value: "le-pelerin" },
    })
    expect(fetchDouble).not.toHaveBeenCalled()
    expect(screen.getByText(/Comparer ne modifie rien/)).toBeTruthy()
    vi.unstubAllGlobals()
  })
})

// ── RP12 · Deux animations sur le même temps ────────────────────────────────
//
// La règle est écrite dans `docs/PLAN-remise-a-plat.md` § RP12. Ce qu'elle
// promet et que ces essais tiennent : une seule horloge, une cadence par côté,
// un cran qui ne saute aucune image, et **rien qui touche à l'export**.

function bande(surplus: Partial<Bande> & { identifiant: string }): Bande {
  return {
    clip: "clip-1",
    nom: `animation ${surplus.identifiant}`,
    images: [0, 1, 2, 3],
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
    personnage: "le-pelerin",
    pose: "marche",
    direction: "sud",
    planche: `generations/clip-1/bandes/${surplus.identifiant}.png`,
    case_largeur: 24,
    case_hauteur: 24,
    cree_le: 300,
    compte: 4,
    secondes: 0.5,
    brouillon: false,
    favori: false,
    rang: 0,
    supprime_le: null,
    supprime: false,
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

const PLAN_ANIME: Pose[] = [
  ...PLAN,
  { identifiant: "marche", nom: "Marche", images: 1, consigne: "", ecartees: [], images_avant: 0 },
]

/** Le pèlerin avec deux animations de la même case : *marche · sud*. */
function sujetAnime(bandes: Bande[]): Personnage {
  return sujet({
    plan: PLAN_ANIME,
    cases: [
      sienne({ pose: "repos", images: [image({ identifiant: "a" })], corps: "a" }),
      sienne({
        pose: "marche",
        directions: [{ ...DIRECTION, identifiant: "sud", nom: "sud", bandes }],
      }),
    ],
  } as Partial<Personnage>)
}

/** Ouvre l'écran, puis bascule sur « ses animations ». */
function monterAnimations(bandes: Bande[]) {
  const monte = monter({ sujetA: sujetAnime(bandes) })
  fireEvent.change(screen.getByRole("combobox", { name: "Comparer avec" }), {
    target: { value: SES_ANIMATIONS },
  })
  return monte
}

const frameDe = (identifiant: string) =>
  document
    .querySelector(`[data-animation-comparee="${identifiant}"]`)
    ?.getAttribute("data-frame")

describe("la règle du temps commun", () => {
  test("chaque côté lit le même temps avec son propre temps d'image", () => {
    const lente = bande({ identifiant: "lente", cadence: 8 }) //  125 ms
    const rapide = bande({ identifiant: "rapide", cadence: 12 }) // 83 ms

    // Au départ, les deux sont sur leur première frame — le seul instant où
    // elles sont sûrement en phase.
    expect(rangSurLeTempsCommun(lente, 0)).toBe(0)
    expect(rangSurLeTempsCommun(rapide, 0)).toBe(0)

    // 83 ms plus tard, la rapide a changé d'image et la lente tient la sienne.
    expect(rangSurLeTempsCommun(lente, 83)).toBe(0)
    expect(rangSurLeTempsCommun(rapide, 83)).toBe(1)

    // 125 ms : la lente passe à sa deuxième, la rapide en est déjà à sa
    // deuxième elle aussi — chacune à son rythme, jamais resynchronisée.
    expect(rangSurLeTempsCommun(lente, 125)).toBe(1)
    expect(rangSurLeTempsCommun(rapide, 125)).toBe(1)
  })

  test("le cran commun est le plus court des deux temps d'image, et ne saute rien", () => {
    const lente = bande({ identifiant: "lente", cadence: 8 })
    const rapide = bande({ identifiant: "rapide", cadence: 12 })
    const pas = pasDuTempsCommun([lente, rapide])
    expect(pas).toBe(dureeImageMs(12))
    expect(pas).toBe(83)

    // Un tour entier, cran par cran : aucune des quatre frames ne manque, d'un
    // côté comme de l'autre. C'est la promesse du « plus court des deux ».
    const vuesLente = new Set<number>()
    const vuesRapide = new Set<number>()
    for (let cran = 0; cran * pas <= 4 * dureeImageMs(8); cran += 1) {
      vuesLente.add(rangSurLeTempsCommun(lente, cran * pas))
      vuesRapide.add(rangSurLeTempsCommun(rapide, cran * pas))
    }
    expect([...vuesLente].sort()).toEqual([0, 1, 2, 3])
    expect([...vuesRapide].sort()).toEqual([0, 1, 2, 3])
  })

  test("boucle contre aller-retour : rien ne se convertit", () => {
    const boucle = bande({ identifiant: "boucle", sens: "boucle" })
    const va = bande({ identifiant: "va", sens: "aller-retour" })
    const pas = dureeImageMs(8) // même cadence des deux côtés

    // Quatre frames : la boucle fait 0 1 2 3 puis repart ; l'aller-retour fait
    // 0 1 2 3 2 1 — les deux bouts ne se rejouent pas.
    const suite = (b: Bande) =>
      [0, 1, 2, 3, 4, 5, 6].map((cran) => rangSurLeTempsCommun(b, cran * pas))
    expect(suite(boucle)).toEqual([0, 1, 2, 3, 0, 1, 2])
    expect(suite(va)).toEqual([0, 1, 2, 3, 2, 1, 0])

    // Leurs tours n'ont donc pas la même longueur, et elles ne se recroisent
    // qu'au début — ce que l'écran dit au lieu de les aligner de force.
    expect(rangSurLeTempsCommun(boucle, 4 * pas)).not.toBe(
      rangSurLeTempsCommun(va, 4 * pas),
    )
  })

  test("les cases comparables sont celles qui portent deux animations du même mouvement", () => {
    const deux = sujetAnime([
      bande({ identifiant: "b1", cree_le: 100 }),
      bande({ identifiant: "b2", cree_le: 200 }),
    ])
    expect(groupesDAnimations(deux, PLAN_ANIME).map((g) => g.nom)).toEqual([
      "Marche · sud",
    ])
    // Une seule animation ne se compare à rien.
    const seule = sujetAnime([bande({ identifiant: "b1" })])
    expect(groupesDAnimations(seule, PLAN_ANIME)).toHaveLength(0)
  })
})

describe("deux animations côte à côte", () => {
  test("elles tournent ensemble, chacune à sa cadence", () => {
    vi.useFakeTimers()
    monterAnimations([
      bande({ identifiant: "lente", cree_le: 200, cadence: 8 }),
      bande({ identifiant: "rapide", cree_le: 100, cadence: 12 }),
    ])
    expect(screen.getByText("Deux animations, même temps")).toBeTruthy()
    expect(frameDe("lente")).toBe("0")
    expect(frameDe("rapide")).toBe("0")

    // ⚠️ On laisse tourner au lieu d'arrêter : c'est en marche que la règle du
    // temps commun se voit (`AGENTS.md`, point 8octies). Les durées avancées
    // sont des multiples du battement — l'écran ne se redessine qu'à un
    // battement, et 83 ms tomberaient entre deux.
    act(() => {
      vi.advanceTimersByTime(96)
    })
    expect(frameDe("lente")).toBe("0") // 96 < 125 : elle tient sa frame
    expect(frameDe("rapide")).toBe("1") // 96 > 83 : elle a changé

    act(() => {
      vi.advanceTimersByTime(32) // 128 ms au total
    })
    expect(frameDe("lente")).toBe("1")
  })

  test("un cran avance la plus rapide pendant que l'autre tient sa frame", () => {
    vi.useFakeTimers()
    monterAnimations([
      bande({ identifiant: "lente", cree_le: 200, cadence: 8 }),
      bande({ identifiant: "rapide", cree_le: 100, cadence: 12 }),
    ])
    fireEvent.click(screen.getByRole("button", { name: "L'image d'après" }))
    expect(frameDe("rapide")).toBe("1")
    expect(frameDe("lente")).toBe("0")
    // Le cran arrête la lecture : sans ça, le métronome reprendrait le pas
    // avant qu'on l'ait vu.
    expect(screen.getByRole("button", { name: "Lire ensemble" })).toBeTruthy()
    fireEvent.click(screen.getByRole("button", { name: "L'image d'avant" }))
    expect(frameDe("rapide")).toBe("0")
  })

  test("« Remettre au début » est le seul geste qui les remet en phase", () => {
    vi.useFakeTimers()
    monterAnimations([
      bande({ identifiant: "lente", cree_le: 200, cadence: 8 }),
      bande({ identifiant: "rapide", cree_le: 100, cadence: 12 }),
    ])
    act(() => {
      vi.advanceTimersByTime(250)
    })
    expect(frameDe("rapide")).not.toBe("0")
    fireEvent.click(screen.getByRole("button", { name: "Remettre au début" }))
    expect(frameDe("lente")).toBe("0")
    expect(frameDe("rapide")).toBe("0")
  })

  test("la cadence lue est celle de l'export, pas 1000 ÷ cadence", () => {
    vi.useFakeTimers()
    monterAnimations([
      bande({ identifiant: "b1", cree_le: 200, cadence: 16 }),
      bande({ identifiant: "b2", cree_le: 100, cadence: 16 }),
    ])
    // À 16 images par seconde le temps exact est 62,5 ms. Le serveur écrit 62
    // dans le descriptif ; `Math.round` de JavaScript aurait rendu 63.
    expect(dureeImageMs(16)).toBe(62)
    expect(screen.getAllByText(/4 frames · 16 i\/s · 62 ms · en boucle/)).toHaveLength(2)
    expect(screen.queryByText(/63 ms/)).toBeNull()
  })

  test("le ralenti ne touche ni la cadence ni le sens — rien ne bouge de l'export", () => {
    vi.useFakeTimers()
    monterAnimations([
      bande({ identifiant: "lente", cree_le: 200, cadence: 8 }),
      bande({ identifiant: "rapide", cree_le: 100, cadence: 12, sens: "aller-retour" }),
    ])
    const avant = document.body.textContent ?? ""
    fireEvent.click(screen.getByRole("button", { name: "×0.5" }))
    act(() => {
      vi.advanceTimersByTime(176)
    })
    // Deux fois moins vite à l'écran : 176 ms comptent pour 88, donc la rapide
    // n'a avancé que d'une frame au lieu des deux de la lecture normale.
    expect(frameDe("rapide")).toBe("1")
    // Et ce qui sortira n'a pas bougé d'un mot.
    expect(screen.getByText(/4 frames · 8 i\/s · 125 ms · en boucle/)).toBeTruthy()
    expect(screen.getByText(/4 frames · 12 i\/s · 83 ms · aller-retour/)).toBeTruthy()
    expect(avant).toContain("4 frames · 12 i/s · 83 ms · aller-retour")
  })

  test("l'écart des cadences et des sens se lit chiffré", () => {
    vi.useFakeTimers()
    monterAnimations([
      bande({ identifiant: "lente", cree_le: 200, cadence: 8 }),
      bande({ identifiant: "rapide", cree_le: 100, cadence: 12, sens: "aller-retour" }),
    ])
    expect(screen.getByText("deux cadences")).toBeTruthy()
    expect(screen.getByText("deux sens")).toBeTruthy()
    expect(screen.getByText("un cran = 83 ms")).toBeTruthy()
    expect(screen.getByText("Elles ne tournent pas à la même cadence")).toBeTruthy()
    expect(screen.getByText("L'une boucle, l'autre fait l'aller-retour")).toBeTruthy()
  })
})

describe("choisir pour le jeu", () => {
  test("le geste existe des deux côtés, et il n'écrit que la retenue d'une animation", async () => {
    vi.useFakeTimers()
    const appels: { url: string; methode: string; corps: unknown }[] = []
    vi.stubGlobal(
      "fetch",
      vi.fn(async (chemin: string, init?: RequestInit) => {
        appels.push({
          url: String(chemin),
          methode: init?.method ?? "GET",
          corps:
            init?.body && typeof init.body === "string"
              ? (JSON.parse(init.body) as unknown)
              : undefined,
        })
        return { ok: true, status: 200, json: async () => ({}) } as Response
      }),
    )
    monterAnimations([
      bande({ identifiant: "retenue", cree_le: 200, favori: true }),
      bande({ identifiant: "a-juger", cree_le: 100 }),
    ])

    const boutons = screen.getAllByRole("button", { name: "Choisir pour le jeu" })
    expect(boutons).toHaveLength(2)
    // Le premier côté est déjà la retenue : son état le dit, et son bouton ne
    // repropose pas ce qui est déjà fait.
    expect(screen.getByText("Retenu")).toBeTruthy()
    expect(screen.getByText("Non jugé")).toBeTruthy()
    expect(boutons[0]).toHaveProperty("disabled", true)

    fireEvent.click(boutons[1])
    await act(async () => {})

    // Deux écritures, et deux seulement : éteindre la sœur, allumer celle-ci.
    // **Aucune ne vise le favori d'une image** — c'est un autre objet, et cet
    // écran ne le touche jamais.
    expect(appels.map((a) => a.url)).toEqual([
      "/api/strips/favorite",
      "/api/strips/favorite",
    ])
    expect(appels[0].corps).toEqual({ identifiants: ["retenue"], favori: false })
    expect(appels[1].corps).toEqual({ identifiants: ["a-juger"], favori: true })
    expect(appels.some((a) => a.url.includes("/assets/"))).toBe(false)
  })

  test("« La retoucher » ouvre l'atelier de cette animation-là", () => {
    vi.useFakeTimers()
    const { onOuvrirLaBande } = monterAnimations([
      bande({ identifiant: "b1", cree_le: 200 }),
      bande({ identifiant: "b2", cree_le: 100 }),
    ])
    fireEvent.click(screen.getAllByRole("button", { name: "La retoucher" })[1])
    expect(onOuvrirLaBande).toHaveBeenCalledWith("b2")
  })
})

describe("les portes", () => {
  test("‹ Sa page ferme l'écran, Voir la grille du jeu l'ouvre", () => {
    const { onFermer, onGrille } = monter()
    fireEvent.click(screen.getByRole("button", { name: "‹ Le pèlerin" }))
    expect(onFermer).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole("button", { name: "Voir la grille du jeu" }))
    expect(onGrille).toHaveBeenCalledTimes(1)
  })
})
