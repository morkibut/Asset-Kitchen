// Ce que **la** grille d'assets fait : ses trois filtres et sa pagination
// (B9.6), sa sélection et son glisser-déposer vers les collections (B9.5),
// et ses trois vues (B9.4). `fetch` est doublé à la main, comme partout dans
// le dépôt — aucun essai ne coûte un centime.
//
// **Il n'y en a qu'une depuis `RP7`** (16 septembre 2026) : montée sans
// famille elle est la porte « Les sujets », montée sur une famille elle est
// sa grille. Les essais des deux écrans d'avant vivent donc tous ici.

import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { useState } from "react"
import { afterEach, describe, expect, test, vi } from "vitest"

import { EcranFamille, GLISSE_DES_SUJETS } from "./Famille"
import { MemoireDuParcours } from "./MemoireDuParcours"
import { api, UNIVERS_VIDE } from "../api"
import type {
  GrilleDeFamille,
  GroupeDeRangement,
  Personnage,
  Piece,
  SujetDeLaGrille,
} from "../api"

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

// ── Les sujets de l'essai ───────────────────────────────────────────────────

function sujet(surplus: Partial<SujetDeLaGrille> & { identifiant: string; nom: string }): SujetDeLaGrille {
  return {
    projet: "le-marais",
    description: "un texte",
    type: "personnage",
    cree_le: 1_700_000_000,
    compte: {
      poses: { fait: 6, attendu: 6 },
      images: { fait: 12, attendu: 12 },
      bandes: { fait: 0, attendu: 6 },
      complet: true,
      detail: [
        { identifiant: "repos", nom: "repos", fait: 1, attendu: 1 },
        { identifiant: "marche", nom: "marche", fait: 1, attendu: 1 },
      ],
    },
    collections: [],
    vignette: { identifiant: "gen-1", empreinte: "e1" },
    ...surplus,
  }
}

const A = sujet({
  identifiant: "a",
  nom: "Le pèlerin",
  collections: [{ identifiant: "boss", nom: "Les boss" }],
})
const B = sujet({
  identifiant: "b",
  nom: "La bête des tourbières",
  description: "",
  type: "créature",
  vignette: null,
  compte: {
    poses: { fait: 0, attendu: 4 },
    images: { fait: 0, attendu: 8 },
    bandes: { fait: 0, attendu: 4 },
    complet: false,
    // Cette créature ne tient pas la pose « marche » : aucune entrée pour
    // elle, pas une entrée à zéro.
    detail: [{ identifiant: "repos", nom: "repos", fait: 0, attendu: 1 }],
  },
})
const C = sujet({
  identifiant: "c",
  nom: "Le passeur",
  collections: [{ identifiant: "pnj", nom: "Les PNJ" }],
  compte: {
    poses: { fait: 3, attendu: 6 },
    images: { fait: 5, attendu: 12 },
    bandes: { fait: 2, attendu: 6 },
    complet: false,
    detail: [
      { identifiant: "repos", nom: "repos", fait: 1, attendu: 1 },
      { identifiant: "marche", nom: "marche", fait: 0, attendu: 1 },
    ],
  },
})
const D = sujet({ identifiant: "d", nom: "Le meunier" })
const E = sujet({ identifiant: "e", nom: "Le charbonnier" })

const GROUPES = [
  { identifiant: "boss", nom: "Les boss", sujets: 10 },
  { identifiant: "pnj", nom: "Les PNJ", sujets: 20 },
]
const FILTRES = { tous: 5, incomplets: 2, "sans-description": 1 }

function reponsePour(
  filtre: string,
  recherche: string,
  limite: number,
  collection: string | null = null,
): GrilleDeFamille {
  // C'est le serveur qui restreint à une collection — l'écran ne fait que lui
  // passer le mot, et les trois comptes reviennent restreints avec.
  if (collection === "boss")
    return {
      personnages: [A],
      groupes: GROUPES,
      filtres: { tous: 1, incomplets: 0, "sans-description": 0 },
      total: 1,
    }
  if (recherche === "passeur")
    return { personnages: [C], groupes: GROUPES, filtres: FILTRES, total: 1 }
  if (filtre === "incomplets")
    // Dans un ordre volontairement différent de « comme la grille normale » :
    // c'est le serveur qui décide, l'écran ne retrie jamais.
    return { personnages: [C, B], groupes: GROUPES, filtres: FILTRES, total: 2 }
  if (limite >= 240)
    return { personnages: [A, B, C, D, E], groupes: GROUPES, filtres: FILTRES, total: 5 }
  return { personnages: [A, B, C], groupes: GROUPES, filtres: FILTRES, total: 5 }
}

const BIBLIOTHEQUE_VIDE = {
  courant: null,
  projets: [],
  collections: [],
  sans_projet: { assets: 0, total_usd: 0 },
  total_usd: 0,
}

function construireDouble() {
  const appels: { url: string; methode: string; corps: unknown }[] = []
  const fetchDouble = vi.fn(async (chemin: string, init?: RequestInit) => {
    const url = String(chemin)
    const methode = init?.method ?? "GET"
    const corps =
      init?.body && typeof init.body === "string" ? (JSON.parse(init.body) as unknown) : undefined
    appels.push({ url, methode, corps })
    const rendre = (charge: unknown) => ({ ok: true, status: 200, json: async () => charge }) as Response

    if (url.startsWith("/api/characters/families/")) {
      const [, requete] = url.split("?")
      const params = new URLSearchParams(requete ?? "")
      return rendre(
        reponsePour(
          params.get("filtre") ?? "tous",
          params.get("recherche") ?? "",
          Number(params.get("limite") ?? "0"),
          params.get("collection"),
        ),
      )
    }
    if (methode === "PUT" && url.includes("/members")) {
      return rendre({
        collection: { identifiant: "boss", nom: "Les boss", projet: "le-marais", cree_le: 0, sujets: 11 },
        bibliotheque: BIBLIOTHEQUE_VIDE,
      })
    }
    if (methode === "POST" && url === "/api/collections") {
      const nom = (corps as { nom: string }).nom
      return rendre({
        collection: { identifiant: "nouvelle", nom, projet: "le-marais", cree_le: 0, sujets: 0 },
        bibliotheque: BIBLIOTHEQUE_VIDE,
      })
    }
    if (methode === "POST" && url === "/api/characters") {
      const { nom, famille } = corps as { nom: string; famille: string | null }
      return rendre({
        personnage: {
          identifiant: nom.toLowerCase().replace(/\s+/g, "-"),
          projet: "le-marais",
          nom,
          description: "",
          ecartees: [],
          concept_arts: [],
          references_ecartees: [],
          cree_le: 0,
          cases: [],
          plan: [],
          type: "",
          ambiance: "",
          prend: "tout",
          textes: {},
          eteints: [],
          references: [],
          ajoutees: [],
          directions_ecartees: {},
          hors_calibrage: [],
          famille: famille ?? "personnages",
          equipable: (famille ?? "personnages") === "personnages",
          pieces: [],
        },
      })
    }
    return rendre({})
  })
  return { fetchDouble, appels }
}

// ── Le montage ───────────────────────────────────────────────────────────────

/** La grille, montée comme `App.tsx` la monte. **Plus de `glisses` porté par
 *  le parent depuis `RP7`** : les deux cibles de dépôt — la colonne de gauche
 *  et le volet de droite — sont maintenant dans l'écran, qui n'a donc plus
 *  besoin de faire remonter ce qu'il traîne. */
function Controle(props: {
  surGroupes: (g: GroupeDeRangement[]) => void
  rafraichi: number
  famille?: string | null
  collectionInitiale?: string | null
  pieces?: Piece[]
  surRange: () => void
  surReglages: () => void
  surErreur: (r: string) => void
  surFamille?: (famille: string) => void
  surCollection?: (collection: string | null) => void
  onOuvrir?: (identifiant: string) => void
  onPiece?: (identifiant: string) => void
  onCree?: (personnage: Personnage) => void
}) {
  return (
    <EcranFamille
      famille={props.famille === undefined ? "personnages" : props.famille}
      nom="Les personnages"
      jeu="le-marais"
      collectionInitiale={props.collectionInitiale ?? null}
      pieces={props.pieces ?? []}
      surGroupes={props.surGroupes}
      surCollection={props.surCollection}
      surFamille={props.surFamille}
      rafraichi={props.rafraichi}
      surRange={props.surRange}
      surReglages={props.surReglages}
      surErreur={props.surErreur}
      onOuvrir={props.onOuvrir ?? (() => {})}
      onPiece={props.onPiece ?? (() => {})}
      onCree={props.onCree ?? (() => {})}
    />
  )
}

function monter(
  surplus: {
    famille?: string | null
    collectionInitiale?: string | null
    pieces?: Piece[]
    surFamille?: (famille: string) => void
    surCollection?: (collection: string | null) => void
  } = {},
) {
  const { fetchDouble, appels } = construireDouble()
  vi.stubGlobal("fetch", fetchDouble)
  const rappels = {
    surGroupes: vi.fn(),
    surRange: vi.fn(),
    surReglages: vi.fn(),
    surErreur: vi.fn(),
    onOuvrir: vi.fn(),
    onPiece: vi.fn(),
    surCollection: vi.fn(),
    surFamille: vi.fn(),
  }
  render(<Controle {...rappels} rafraichi={0} {...surplus} />)
  return { ...rappels, appels }
}

const grille = () => document.querySelector("[data-grille-de-sujets]") as HTMLElement
const carte = (identifiant: string) =>
  document.querySelector(`[data-carte-de-sujet="${identifiant}"]`) as HTMLElement

/** Un `DataTransfer` doublé — **la charge utile voyage vraiment**, écrite au
 *  `dragstart` et relue au `drop`. C'est ce qui rend le type unique vérifiable
 *  sans navigateur : deux types incompatibles ne se reliraient pas l'un
 *  l'autre, et l'essai le dirait. */
function transfertDouble() {
  const contenu = new Map<string, string>()
  return {
    get types() {
      return [...contenu.keys()]
    },
    setData: (type: string, valeur: string) => contenu.set(type, valeur),
    getData: (type: string) => contenu.get(type) ?? "",
    setDragImage: () => {},
    effectAllowed: "move",
    files: [],
  }
}

/** Le clic ouvre par défaut (B9 corrigé le 10 septembre 2026) : les essais de
 *  sélection et de rangement entrent d'abord dans le mode dédié, exactement
 *  comme le ferait quelqu'un qui veut ranger plusieurs sujets d'un coup. */
const activerLaSelection = () => fireEvent.click(screen.getByRole("button", { name: "Sélection" }))

const appelsDeFamille = (appels: { url: string }[]) =>
  appels.filter((a) => a.url.startsWith("/api/characters/families/"))

// ── Les essais ───────────────────────────────────────────────────────────────

describe("la grille et son pied", () => {
  test("la grille écrit le titre, le compte des trois filtres et le pied de page", async () => {
    monter()

    expect(await screen.findByRole("heading", { name: /Les 5 personnages/ })).toBeTruthy()
    expect(screen.getByRole("tab", { name: /Incomplets/ }).textContent).toContain("2")
    expect(screen.getByRole("tab", { name: /Sans description/ }).textContent).toContain("1")
    await waitFor(() => expect(document.body.textContent).toMatch(/3 des 5 affichés/))
  })
})

describe("la recherche et les filtres partent au serveur", () => {
  test("chercher relance la lecture avec la recherche, et remet la page à sa première limite", async () => {
    const { appels } = monter()
    await screen.findByRole("heading", { name: /Les 5 personnages/ })

    // On pousse d'abord la limite, pour vérifier qu'une recherche la remet à
    // son premier cran plutôt que de la garder.
    fireEvent.click(await screen.findByRole("button", { name: "Afficher davantage de sujets" }))
    await waitFor(() => expect(appelsDeFamille(appels)).toHaveLength(2))

    fireEvent.change(screen.getByLabelText("Chercher un personnage"), {
      target: { value: "passeur" },
    })

    await waitFor(() => expect(appelsDeFamille(appels)).toHaveLength(3))
    const derniere = appelsDeFamille(appels).at(-1)!
    const params = new URLSearchParams(derniere.url.split("?")[1])
    expect(params.get("recherche")).toBe("passeur")
    expect(params.get("limite")).toBe("120")
  })

  test("changer de filtre part au serveur, il ne trie pas la page reçue", async () => {
    const { appels } = monter()
    await screen.findByRole("heading", { name: /Les 5 personnages/ })

    fireEvent.click(screen.getByRole("tab", { name: /Incomplets/ }))

    await waitFor(() => expect(appelsDeFamille(appels)).toHaveLength(2))
    const derniere = appelsDeFamille(appels).at(-1)!
    expect(new URLSearchParams(derniere.url.split("?")[1]).get("filtre")).toBe("incomplets")

    // Le serveur a rendu [C, B] — la grille doit montrer exactement cet
    // ordre-là, jamais un tri local.
    await screen.findByText("Le passeur")
    const ordre = [...grille().querySelectorAll("[data-carte-de-sujet]")].map((n) =>
      n.getAttribute("data-carte-de-sujet"),
    )
    expect(ordre).toEqual(["c", "b"])
  })

  test("« Afficher davantage de sujets » redemande la même page avec une limite plus grande", async () => {
    const { appels } = monter()
    await screen.findByRole("heading", { name: /Les 5 personnages/ })

    fireEvent.click(screen.getByRole("button", { name: "Afficher davantage de sujets" }))

    await waitFor(() => expect(appelsDeFamille(appels)).toHaveLength(2))
    const derniere = appelsDeFamille(appels).at(-1)!
    const params = new URLSearchParams(derniere.url.split("?")[1])
    expect(params.get("limite")).toBe("240")
    expect(params.get("filtre")).toBeNull()
  })

  test("le bouton « Afficher davantage de sujets » n'est là que s'il reste des sujets à charger", async () => {
    monter()
    await screen.findByRole("heading", { name: /Les 5 personnages/ })
    expect(screen.getByRole("button", { name: "Afficher davantage de sujets" })).toBeTruthy()

    fireEvent.click(screen.getByRole("button", { name: "Afficher davantage de sujets" }))

    await waitFor(() => expect(document.body.textContent).toMatch(/5 des 5 affichés/))
    expect(screen.queryByRole("button", { name: "Afficher davantage de sujets" })).toBeNull()
  })

  test("le lien « Voir seulement ce qui manque » bascule sur le filtre des incomplets", async () => {
    const { appels } = monter()
    await screen.findByRole("heading", { name: /Les 5 personnages/ })

    const lien = screen.getByRole("button", { name: /Voir seulement ce qui manque/ })
    fireEvent.click(lien)

    await waitFor(() =>
      expect(screen.queryByRole("button", { name: /Voir seulement ce qui manque/ })).toBeNull(),
    )
    const derniere = appelsDeFamille(appels).at(-1)!
    expect(new URLSearchParams(derniere.url.split("?")[1]).get("filtre")).toBe("incomplets")
  })
})

describe("le clic ouvre par défaut", () => {
  test("cliquer une carte hors du mode sélection ouvre le sujet, et ne le choisit pas", async () => {
    const { onOuvrir } = monter()
    await screen.findByRole("heading", { name: /Les 5 personnages/ })

    const bouton = carte("a")
    expect(bouton.getAttribute("aria-pressed")).toBe("false")
    fireEvent.click(bouton)
    expect(onOuvrir).toHaveBeenCalledWith("a")
    expect(bouton.getAttribute("aria-pressed")).toBe("false")
    expect(document.querySelector("[data-barre-de-masse]")).toBeNull()
  })
})

describe("la sélection", () => {
  test("le bouton « Sélection » arme le mode : cliquer une carte la choisit, recliquer la déchoisit", async () => {
    const { onOuvrir } = monter()
    await screen.findByRole("heading", { name: /Les 5 personnages/ })
    activerLaSelection()

    const bouton = carte("a")
    expect(bouton.getAttribute("aria-pressed")).toBe("false")
    fireEvent.click(bouton)
    expect(bouton.getAttribute("aria-pressed")).toBe("true")
    expect(onOuvrir).not.toHaveBeenCalled()
    fireEvent.click(bouton)
    expect(bouton.getAttribute("aria-pressed")).toBe("false")
  })

  test("la barre de masse ne paraît qu'avec une sélection, et « Ne rien choisir » la vide", async () => {
    monter()
    await screen.findByRole("heading", { name: /Les 5 personnages/ })
    activerLaSelection()

    expect(document.querySelector("[data-barre-de-masse]")).toBeNull()
    fireEvent.click(carte("a"))
    const barre = await screen.findByRole("button", { name: "Ne rien choisir" })
    expect(barre.closest("[data-barre-de-masse]")?.textContent).toContain("1")
    expect(barre.closest("[data-barre-de-masse]")?.textContent).toContain("choisi")

    fireEvent.click(barre)
    expect(document.querySelector("[data-barre-de-masse]")).toBeNull()
  })

  test("couper le mode sélection vide ce qui était choisi", async () => {
    monter()
    await screen.findByRole("heading", { name: /Les 5 personnages/ })
    activerLaSelection()
    fireEvent.click(carte("a"))
    expect(await screen.findByRole("button", { name: "Ne rien choisir" })).toBeTruthy()

    activerLaSelection() // recliquer « Sélection » coupe le mode
    expect(document.querySelector("[data-barre-de-masse]")).toBeNull()
  })
})

// ── Le glisser-déposer, d'un seul type (`RP7`) ───────────────────────────────
//
// Avant le 16 septembre 2026 il y en avait deux, incompatibles : la porte
// « Les assets » écrivait du JSON sous
// `application/x-asset-kitchen-library-subjects`, la grille d'une famille des
// identifiants séparés par un saut de ligne sous `application/x-sujets-atelier`.
// Ces essais tiennent le type retenu **et son format** : le `DataTransfer`
// doublé transporte vraiment la charge utile, écrite au `dragstart` et relue
// au `drop`.

describe("le glisser-déposer", () => {
  /** Attraper une carte, et rendre le transfert pour la suite du geste. */
  const glisserDepuis = (cible: HTMLElement) => {
    const dataTransfer = transfertDouble()
    fireEvent.dragStart(cible, { dataTransfer })
    return dataTransfer
  }

  test("un seul type, et la charge utile est la liste des identifiants", async () => {
    monter()
    await screen.findByRole("heading", { name: /Les 5 personnages/ })
    activerLaSelection()

    fireEvent.click(carte("a"))
    fireEvent.click(carte("c"))
    const transfert = glisserDepuis(carte("a"))

    expect(transfert.types).toEqual([GLISSE_DES_SUJETS])
    expect(transfert.getData(GLISSE_DES_SUJETS)).toBe("a\nc")
    // Et rien sous l'ancien type de la porte « Les assets ».
    expect(transfert.getData("application/x-asset-kitchen-library-subjects")).toBe("")
  })

  test("glisser une carte non choisie ne fait porter le geste que sur elle", async () => {
    monter()
    await screen.findByRole("heading", { name: /Les 5 personnages/ })
    activerLaSelection()

    fireEvent.click(carte("a")) // « a » est choisie…
    const transfert = glisserDepuis(carte("c")) // …mais on attrape « c ».

    expect(transfert.getData(GLISSE_DES_SUJETS)).toBe("c")
  })

  test("la collection visée annonce « déjà + arrivants » pendant le survol", async () => {
    monter()
    await screen.findByRole("heading", { name: /Les 5 personnages/ })
    activerLaSelection()

    fireEvent.click(carte("a")) // déjà dans « Les boss »
    fireEvent.click(carte("c")) // pas dans « Les boss »
    const transfert = glisserDepuis(carte("a"))

    const puce = document.querySelector('[data-puce-de-rangement="boss"]') as HTMLElement
    fireEvent.dragOver(puce, { dataTransfer: transfert })

    expect(within(puce).getByText("1 + 1")).toBeTruthy()
  })

  test("un sujet déjà rangé ne compte pas dans les arrivants, et lâcher range chaque sujet puis relit la grille", async () => {
    const { appels, surRange } = monter()
    await screen.findByRole("heading", { name: /Les 5 personnages/ })
    activerLaSelection()

    fireEvent.click(carte("a")) // déjà dans « Les boss »
    fireEvent.click(carte("c")) // pas dans « Les boss »
    const transfert = glisserDepuis(carte("a"))

    const puce = document.querySelector('[data-puce-de-rangement="boss"]') as HTMLElement
    fireEvent.dragOver(puce, { dataTransfer: transfert })
    fireEvent.drop(puce, { dataTransfer: transfert })

    await waitFor(() => expect(surRange).toHaveBeenCalledTimes(1))
    const rangements = appels.filter((a) => a.methode === "PUT" && a.url.includes("/members"))
    expect(rangements).toHaveLength(1)
    expect(rangements[0]!.corps).toEqual({ jeu: "le-marais", sujet: "c" })
    // La grille se relit : un appel de plus vers la route de la famille.
    expect(appelsDeFamille(appels).length).toBeGreaterThan(1)
  })

  test("la seconde cible est revenue : une ligne de collection de la colonne accepte le même glisser", async () => {
    // Elle avait disparu avec le carnet mort. Sans elle, ranger demandait
    // d'abord d'ouvrir le volet — donc d'avoir déjà choisi quelque chose.
    const { appels, surRange } = monter()
    await screen.findByRole("heading", { name: /Les 5 personnages/ })

    // Hors mode sélection, et sans rien avoir choisi : on attrape une carte et
    // on la lâche sur la ligne « Les boss » de la colonne de gauche.
    const transfert = glisserDepuis(carte("c"))
    const ligne = document.querySelector('[data-collection-de-la-colonne="boss"]') as HTMLElement
    expect(ligne).toBeTruthy()
    fireEvent.dragOver(ligne, { dataTransfer: transfert })
    fireEvent.drop(ligne, { dataTransfer: transfert })

    await waitFor(() => expect(surRange).toHaveBeenCalledTimes(1))
    const rangements = appels.filter((a) => a.methode === "PUT" && a.url.includes("/members"))
    expect(rangements).toHaveLength(1)
    expect(rangements[0]!.corps).toEqual({ jeu: "le-marais", sujet: "c" })
  })

  test("un glisser d'un autre type n'est pas accepté", async () => {
    const { appels } = monter()
    await screen.findByRole("heading", { name: /Les 5 personnages/ })

    const etranger = { types: ["text/plain"], getData: () => "c", files: [] }
    const ligne = document.querySelector('[data-collection-de-la-colonne="boss"]') as HTMLElement
    fireEvent.dragOver(ligne, { dataTransfer: etranger })
    fireEvent.drop(ligne, { dataTransfer: etranger })

    expect(appels.filter((a) => a.url.includes("/members"))).toHaveLength(0)
  })
})

describe("la vue « Les poses »", () => {
  test("elle montre une colonne par pose, et une case vide — pas un zéro — pour ce qui manque", async () => {
    monter()
    await screen.findByRole("heading", { name: /Les 5 personnages/ })

    fireEvent.click(screen.getByRole("tab", { name: "Les poses" }))

    const tableau = document.querySelector("[data-tableau-des-poses]") as HTMLElement
    expect(within(tableau).getByText("repos")).toBeTruthy()
    expect(within(tableau).getByText("marche")).toBeTruthy()

    // « La bête des tourbières » ne tient pas la pose « marche ».
    const ligne = within(tableau).getByText("La bête des tourbières").closest("tr")!
    const cellules = within(ligne as HTMLElement).getAllByRole("cell")
    // Sujet · repos · marche
    expect(cellules[2]!.textContent).toBe("·")
    expect(cellules[2]!.textContent).not.toBe("0")
    expect(cellules[2]!.textContent).not.toContain("0 / 0")
  })
})

describe("la vignette", () => {
  test("un sujet sans image montre un cadre vide plutôt qu'une image cassée", async () => {
    monter()
    await screen.findByRole("heading", { name: /Les 5 personnages/ })

    expect(carte("b").querySelector("img")).toBeNull()
    expect(carte("a").querySelector("img")).toBeTruthy()
  })
})

// ── La colonne des familles et des collections (`RP7`) ───────────────────────
//
// Elle vivait dans la porte « Les assets » et nulle part ailleurs ; depuis la
// fusion elle est dans l'écran, et c'est elle qui ouvre une collection.

describe("la collection ouverte dans la colonne", () => {
  test("elle part au serveur, elle n'est pas triée ici", async () => {
    const { appels } = monter({ collectionInitiale: "boss" })
    await screen.findByRole("heading", { name: "1 personnage" })

    const lecture = appels.find((a) => a.url.includes("/characters/families/"))!
    expect(lecture.url).toContain("collection=boss")

    // Et les trois onglets comptent ce que le serveur a rendu, restreint avec
    // le reste : deux incomplets dans la famille entière, aucun ici.
    expect(screen.getByRole("tab", { name: /Incomplets/ }).textContent).toContain("0")
  })

  test("le fil d'Ariane nomme la collection, pas « Tous »", async () => {
    monter({ collectionInitiale: "boss" })
    await screen.findAllByText("Les boss")
  })

  test("en ouvrir une depuis la colonne ne part chercher qu'une fois, et à la première page", async () => {
    // Mesuré au navigateur, sur 260 sujets : la grille partait chercher la
    // collection neuve **avec la limite déroulée d'avant**, puis repartait la
    // chercher à 120. Deux allers-retours, et le premier était le gros.
    const { appels, surCollection } = monter()
    const lectures = () =>
      appels.filter((a) => a.url.includes("/characters/families/")).map((a) => a.url)

    await screen.findByRole("heading", { name: /Les 5 personnages/ })
    fireEvent.click(screen.getByRole("button", { name: "Afficher davantage de sujets" }))
    await waitFor(() => expect(lectures().some((u) => u.includes("limite=240"))).toBe(true))

    const avant = lectures().length
    fireEvent.click(document.querySelector('[data-collection-de-la-colonne="boss"]')!)
    await screen.findByRole("heading", { name: "1 personnage" })

    const neuves = lectures().slice(avant)
    expect(neuves).toHaveLength(1)
    expect(neuves[0]).toContain("collection=boss")
    expect(neuves[0]).toContain("limite=120")
    // Le fil d'Ariane l'apprend d'elle : ce n'est pas un lieu, mais il le nomme.
    expect(surCollection).toHaveBeenLastCalledWith("boss")
  })
})

describe("nommer une collection sans rien avoir choisi", () => {
  test("le « ＋ Collection » de la colonne ouvre le champ", async () => {
    // **Le défaut que `RP7` referme.** Sans sélection il n'y a pas de volet,
    // donc pas de puce « + nouvelle », et le seul bouton qui ouvrait ce champ
    // vivait dans le carnet mort : depuis sa disparition, créer une collection
    // depuis la grille était devenu impossible.
    const { surRange, appels } = monter()
    await screen.findByRole("heading", { name: /Les 5 personnages/ })

    expect(screen.queryByLabelText("Nom de la nouvelle collection")).toBeNull()
    fireEvent.click(screen.getByRole("button", { name: "＋ Collection" }))

    const champ = screen.getByLabelText("Nom de la nouvelle collection")
    fireEvent.change(champ, { target: { value: "Les noyés" } })
    fireEvent.click(screen.getByRole("button", { name: "Créer" }))

    await waitFor(() =>
      expect(appels.some((a) => a.methode === "POST" && a.url === "/api/collections")).toBe(true),
    )
    const creation = appels.find((a) => a.methode === "POST" && a.url === "/api/collections")!
    expect((creation.corps as { nom: string }).nom).toBe("Les noyés")

    // Rien n'était choisi : aucun rangement ne part…
    expect(appels.some((a) => a.url.includes("/members"))).toBe(false)
    // …et le carnet l'apprend quand même, sans quoi une collection vide
    // n'apparaîtrait nulle part — elle n'est sur la carte d'aucun sujet.
    await waitFor(() => expect(surRange).toHaveBeenCalled())
  })
})

// ── Nommer, c'est créer (C3 : le champ qui nommait dans le codex vit ici) ────

describe("le bouton « Ajouter » nomme et crée sur-le-champ", () => {
  test("écrire un nom et valider crée la chose et ouvre sa fiche", async () => {
    const { fetchDouble, appels } = construireDouble()
    vi.stubGlobal("fetch", fetchDouble)
    const onOuvrir = vi.fn()
    render(
      <Controle
        surGroupes={vi.fn()}
        rafraichi={0}
        surRange={vi.fn()}
        surReglages={vi.fn()}
        surErreur={vi.fn()}
        onOuvrir={onOuvrir}
      />,
    )

    await screen.findByRole("heading", { name: /Les 5 personnages/ })
    fireEvent.click(screen.getByRole("button", { name: "Ajouter un personnage" }))

    const champ = screen.getByLabelText("Nom du sujet du jeu à créer")
    fireEvent.change(champ, { target: { value: "Le nain" } })
    fireEvent.keyDown(champ, { key: "Enter" })

    await waitFor(() =>
      expect(appels.some((a) => a.methode === "POST" && a.url === "/api/characters")).toBe(true),
    )
    const creation = appels.find((a) => a.methode === "POST" && a.url === "/api/characters")!
    expect((creation.corps as { nom: string; famille: string | null }).nom).toBe("Le nain")
    expect((creation.corps as { famille: string | null }).famille).toBe("personnages")

    await waitFor(() => expect(onOuvrir).toHaveBeenCalledWith("le-nain"))
  })

  test("un nom vide ne part pas", async () => {
    const { fetchDouble, appels } = construireDouble()
    vi.stubGlobal("fetch", fetchDouble)
    render(<Controle {...{
      surGroupes: vi.fn(),
      rafraichi: 0,
      surRange: vi.fn(),
      surReglages: vi.fn(),
      surErreur: vi.fn(),
    }} />)

    await screen.findByRole("heading", { name: /Les 5 personnages/ })
    fireEvent.click(screen.getByRole("button", { name: "Ajouter un personnage" }))
    fireEvent.keyDown(screen.getByLabelText("Nom du sujet du jeu à créer"), { key: "Enter" })

    expect(appels.some((a) => a.methode === "POST" && a.url === "/api/characters")).toBe(false)
  })
})

describe("une réponse tronquée", () => {
  test("le carnet reçoit une liste vide, jamais `undefined`", async () => {
    // Le double de `fetch` d'`App.test.tsx` rend `{}` pour une route qu'il ne
    // connaît pas. Sans garde, `groupes` remonterait `undefined` au carnet, qui
    // le tranche — et l'atelier entier tomberait sur une route absente.
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, status: 200, json: async () => ({}) }) as Response),
    )
    const surGroupes = vi.fn()
    render(
      <Controle
        surGroupes={surGroupes}
        rafraichi={0}
        surRange={vi.fn()}
        surReglages={vi.fn()}
        surErreur={vi.fn()}
      />,
    )

    await waitFor(() => expect(surGroupes).toHaveBeenCalledWith([]))
    expect(screen.getByRole("heading", { name: "Les personnages" })).toBeTruthy()
  })
})

// ── L'invariant : une seule grille d'assets (`RP7`) ──────────────────────────
//
// Ces essais viennent de `BibliothequeDesAssets.test.tsx`, qui est parti avec
// son écran le 16 septembre 2026. Ils tiennent ici ce que la porte
// « Les sujets » savait faire et que la grille d'une famille ne savait pas :
// montrer les quatre familles d'un coup, montrer les pièces d'équipement, et
// garder les refusés choisis après un rangement à moitié réussi.

describe("toutes les familles dans la même grille", () => {
  test("sans famille, elle lit les quatre et n'écrit qu'un titre", async () => {
    const { appels } = monter({ famille: null })

    expect(await screen.findByRole("heading", { name: "Les sujets" })).toBeTruthy()
    await waitFor(() => expect(appelsDeFamille(appels)).toHaveLength(4))
    const familles = appelsDeFamille(appels).map((a) => a.url.split("?")[0]!.split("/").at(-1))
    expect(new Set(familles)).toEqual(new Set(["personnages", "decors", "objets", "interface"]))

    // Un seul écran, un seul cadre : l'ancienne porte en montait un second.
    expect(document.querySelectorAll("[data-grille-dassets]")).toHaveLength(1)
    expect(screen.getByRole("main", { name: "Les sujets du jeu" })).toBeTruthy()
  })

  test("le tri recoud les quatre listes, il ne trie pas une famille seule", async () => {
    monter({ famille: null })
    await screen.findByRole("heading", { name: "Les sujets" })

    // Quatre fois [A, B, C] : sans recouture, on lirait A A A A B B B B…
    await waitFor(() =>
      expect(
        [...grille().querySelectorAll("[data-carte-de-sujet]")].map((n) =>
          n.getAttribute("data-carte-de-sujet"),
        ),
      ).toEqual(["b", "b", "b", "b", "c", "c", "c", "c", "a", "a", "a", "a"]),
    )
  })

  test("cliquer une famille dans la colonne est un lieu : le parent y va", async () => {
    const surFamille = vi.fn()
    monter({ famille: null, surFamille })
    await screen.findByRole("heading", { name: "Les sujets" })

    const colonne = within(screen.getByRole("navigation", { name: "Familles et collections" }))
    fireEvent.click(colonne.getByRole("button", { name: /^Personnages/ }))
    expect(surFamille).toHaveBeenCalledWith("personnages")
  })
})

describe("les pièces d'équipement", () => {
  const heaume: Piece = {
    identifiant: "heaume",
    nom: "Le heaume",
    description: "",
    emplacement: "",
    portee: "contenue",
    concept_arts: ["carte-du-heaume"],
  }
  const sac: Piece = {
    identifiant: "sac",
    nom: "Le sac",
    description: "",
    emplacement: "",
    portee: "contenue",
    concept_arts: [],
  }

  test("un équipement montre un aperçu identifiable, ou dit qu'il reste à créer", async () => {
    monter({ famille: "equipement", pieces: [heaume, sac] })

    // `alt=""` retire l'image de l'arbre d'accessibilité (c'est voulu, la
    // légende voisine porte déjà le nom) : on la retrouve par sa balise.
    const ligneHeaume = (await screen.findByText("Le heaume")).closest("li")!
    expect(ligneHeaume.querySelector("img")?.getAttribute("src")).toBe(
      api.imageCarte("carte-du-heaume", ""),
    )

    const ligneSac = screen.getByText("Le sac").closest("li")!
    expect(within(ligneSac).getByText("À créer")).toBeTruthy()
    expect(ligneSac.querySelector("img")).toBeNull()
  })

  test("les équipements n'interrogent aucune route de famille, et aucune collection ne les range", async () => {
    const { appels, onPiece } = monter({ famille: "equipement", pieces: [heaume] })
    await screen.findByText("Le heaume")

    expect(appelsDeFamille(appels)).toHaveLength(0)
    expect(document.body.textContent).toContain("une collection ne les range pas")

    fireEvent.click(screen.getByText("Le heaume"))
    expect(onPiece).toHaveBeenCalledWith("heaume")
  })
})

describe("un rangement à moitié réussi", () => {
  test("les refusés restent choisis, et le reste est rangé", async () => {
    const { surErreur } = monter()
    const ranger = vi
      .spyOn(api, "rangerSujet")
      .mockImplementation(async (_collection, _jeu, sujet) => {
        if (sujet === "c") throw new Error("Disque momentanément occupé")
        return {} as never
      })

    await screen.findByRole("heading", { name: /Les 5 personnages/ })
    activerLaSelection()
    fireEvent.click(screen.getByRole("button", { name: "Sélectionner cette page" }))
    fireEvent.click(await screen.findByRole("button", { name: "Ranger dans…" }))
    fireEvent.click(screen.getByRole("button", { name: "Les PNJ" }))

    await waitFor(() => expect(ranger).toHaveBeenCalledTimes(3))
    await waitFor(() =>
      expect(surErreur).toHaveBeenCalledWith(expect.stringContaining("restent sélectionnés")),
    )
    // Seul « c » a été refusé : lui seul reste choisi, pour réessayer.
    await waitFor(() => expect(carte("c").getAttribute("aria-pressed")).toBe("true"))
    expect(carte("a").getAttribute("aria-pressed")).toBe("false")
  })
})

describe("ce que l'écran retient d'un aller-retour", () => {
  test("la recherche, la vue et la collection reviennent après un détour", async () => {
    const { fetchDouble } = construireDouble()
    vi.stubGlobal("fetch", fetchDouble)

    function Parcours() {
      const [visible, setVisible] = useState(true)
      return (
        <MemoireDuParcours>
          <button onClick={() => setVisible((v) => !v)}>Changer d'écran</button>
          {visible && (
            <Controle
              surGroupes={vi.fn()}
              rafraichi={0}
              surRange={vi.fn()}
              surReglages={vi.fn()}
              surErreur={vi.fn()}
            />
          )}
        </MemoireDuParcours>
      )
    }
    render(<Parcours />)
    await screen.findByRole("heading", { name: /Les 5 personnages/ })

    fireEvent.click(document.querySelector('[data-collection-de-la-colonne="boss"]')!)
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "passeur" } })
    fireEvent.click(screen.getByRole("tab", { name: "La liste" }))

    fireEvent.click(screen.getByRole("button", { name: "Changer d'écran" }))
    fireEvent.click(screen.getByRole("button", { name: "Changer d'écran" }))

    expect(await screen.findByRole("searchbox")).toHaveValue("passeur")
    expect(screen.getByRole("tab", { name: "La liste" }).getAttribute("aria-selected")).toBe("true")
    await waitFor(() =>
      expect(
        document.querySelector('[data-collection-de-la-colonne="boss"]')?.getAttribute("aria-current"),
      ).toBe("page"),
    )
  })
})

// ── Les natures de la colonne (rangement, D1) ────────────────────────────────
//
// Une matière est une image de la bibliothèque, plus un sujet : sa ligne dans la
// colonne vaudrait toujours « — ». Le serveur dit quelles natures sont des
// matières (`GET /characters/types`, `capacites.matiere`) ; l'écran ne le devine pas.

describe("les natures de la colonne", () => {
  const nature = (nom: string) => ({ nom, famille: "personnages", occupation: 1, silhouette: true }) as never
  const UNIVERS = { ...UNIVERS_VIDE, bareme: [nature("personnage"), nature("créature"), nature("matière")] }
  const type = (nom: string, matiere: boolean) => ({
    nom, origine: "connue", poses: [], connues: [], se_decoupe: true,
    capacites: { directions: false, anime: false, sons: false, matiere },
  })

  function monterAvecNatures(reponse: unknown) {
    const { fetchDouble } = construireDouble()
    const fetchAvecTypes = vi.fn(async (chemin: string, init?: RequestInit) =>
      String(chemin) === "/api/characters/types"
        ? ({ ok: true, status: 200, json: async () => reponse }) as Response
        : fetchDouble(chemin, init))
    vi.stubGlobal("fetch", fetchAvecTypes)
    render(
      <EcranFamille famille="personnages" nom="Les personnages" jeu="le-marais" univers={UNIVERS} rafraichi={0}
        surGroupes={vi.fn()} surRange={vi.fn()} surReglages={vi.fn()} surErreur={vi.fn()} onOuvrir={vi.fn()} onCree={vi.fn()} />,
    )
    return fetchAvecTypes
  }

  test("une nature qui sert de matière n'a plus de ligne", async () => {
    const fetchAvecTypes = monterAvecNatures({ plan: [], types: [type("personnage", false), type("créature", false), type("matière", true)] })
    await screen.findByText("Personnage")
    await waitFor(() => expect(screen.queryByText("Matière")).toBeNull())
    expect(screen.getByText("Créature")).toBeTruthy()
    expect(fetchAvecTypes.mock.calls.some(([u]) => String(u) === "/api/characters/types")).toBe(true)
  })

  test("tant que la route n'a pas répondu, ou si elle ne dit rien, aucune ligne ne disparaît", async () => {
    const fetchAvecTypes = monterAvecNatures({})
    await screen.findByText("Personnage")
    await waitFor(() => expect(fetchAvecTypes.mock.calls.some(([u]) => String(u) === "/api/characters/types")).toBe(true))
    expect(screen.getByText("Matière")).toBeTruthy()
    expect(screen.getByText("Créature")).toBeTruthy()
  })
})
