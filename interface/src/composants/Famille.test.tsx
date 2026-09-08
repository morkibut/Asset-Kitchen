// Ce que la grille d'une famille fait : ses trois filtres et sa pagination
// (B9.6), sa sélection et son glisser-déposer vers les collections (B9.5),
// et ses trois vues (B9.4). `fetch` est doublé à la main, comme partout dans
// le dépôt — aucun essai ne coûte un centime.
//
// `glisses` est un état du PARENT (le contrat de `EcranFamille` le dit) : un
// petit composant de contrôle le porte ici, pour que `surGlisser` mis à jour
// se voie redescendre dans la prop, exactement comme `App.tsx` le ferait.

import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { useState } from "react"
import { afterEach, describe, expect, test, vi } from "vitest"

import { EcranFamille, GLISSE_DES_SUJETS } from "./Famille"
import type { GrilleDeFamille, SujetDeLaGrille } from "../api"

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
    return rendre({})
  })
  return { fetchDouble, appels }
}

// ── Le montage ───────────────────────────────────────────────────────────────

/** Porte `glisses` comme le ferait le parent réel : `surGlisser` le met à
 *  jour, et la prop redescend aussitôt dans `EcranFamille`. */
function Controle(props: {
  surGlisser: (s: readonly string[] | null, arrivants?: Record<string, number>) => void
  surGroupes: (g: GrilleDeFamille["groupes"]) => void
  rafraichi: number
  collection?: string | null
  creerUnGroupe?: number
  surRange: () => void
  surReglages: () => void
  surAjouter: () => void
  surErreur: (r: string) => void
}) {
  const [glisses, setGlisses] = useState<readonly string[] | null>(null)
  return (
    <EcranFamille
      famille="personnages"
      nom="Les personnages"
      jeu="le-marais"
      collection={props.collection ?? null}
      glisses={glisses}
      surGlisser={(s, arrivants) => {
        setGlisses(s)
        props.surGlisser(s, arrivants)
      }}
      surGroupes={props.surGroupes}
      rafraichi={props.rafraichi}
      creerUnGroupe={props.creerUnGroupe ?? 0}
      surRange={props.surRange}
      surReglages={props.surReglages}
      surAjouter={props.surAjouter}
      surErreur={props.surErreur}
    />
  )
}

function monter(surplus: { collection?: string | null; creerUnGroupe?: number } = {}) {
  const { fetchDouble, appels } = construireDouble()
  vi.stubGlobal("fetch", fetchDouble)
  const rappels = {
    surGlisser: vi.fn(),
    surGroupes: vi.fn(),
    surRange: vi.fn(),
    surReglages: vi.fn(),
    surAjouter: vi.fn(),
    surErreur: vi.fn(),
  }
  render(<Controle {...rappels} rafraichi={0} {...surplus} />)
  return { ...rappels, appels }
}

const grille = () => document.querySelector("[data-grille-de-sujets]") as HTMLElement
const carte = (identifiant: string) =>
  document.querySelector(`[data-carte-de-sujet="${identifiant}"]`) as HTMLElement

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
    fireEvent.click(await screen.findByRole("button", { name: "Charger la suite" }))
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

  test("« Charger la suite » redemande la même page avec une limite plus grande", async () => {
    const { appels } = monter()
    await screen.findByRole("heading", { name: /Les 5 personnages/ })

    fireEvent.click(screen.getByRole("button", { name: "Charger la suite" }))

    await waitFor(() => expect(appelsDeFamille(appels)).toHaveLength(2))
    const derniere = appelsDeFamille(appels).at(-1)!
    const params = new URLSearchParams(derniere.url.split("?")[1])
    expect(params.get("limite")).toBe("240")
    expect(params.get("filtre")).toBeNull()
  })

  test("le bouton « Charger la suite » n'est là que s'il reste des sujets à charger", async () => {
    monter()
    await screen.findByRole("heading", { name: /Les 5 personnages/ })
    expect(screen.getByRole("button", { name: "Charger la suite" })).toBeTruthy()

    fireEvent.click(screen.getByRole("button", { name: "Charger la suite" }))

    await waitFor(() => expect(document.body.textContent).toMatch(/5 des 5 affichés/))
    expect(screen.queryByRole("button", { name: "Charger la suite" })).toBeNull()
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

describe("la sélection", () => {
  test("cliquer une carte la choisit, recliquer la déchoisit", async () => {
    monter()
    await screen.findByRole("heading", { name: /Les 5 personnages/ })

    const bouton = carte("a")
    expect(bouton.getAttribute("aria-pressed")).toBe("false")
    fireEvent.click(bouton)
    expect(bouton.getAttribute("aria-pressed")).toBe("true")
    fireEvent.click(bouton)
    expect(bouton.getAttribute("aria-pressed")).toBe("false")
  })

  test("la barre de masse ne paraît qu'avec une sélection, et « Ne rien choisir » la vide", async () => {
    monter()
    await screen.findByRole("heading", { name: /Les 5 personnages/ })

    expect(document.querySelector("[data-barre-de-masse]")).toBeNull()
    fireEvent.click(carte("a"))
    const barre = await screen.findByRole("button", { name: "Ne rien choisir" })
    expect(barre.closest("[data-barre-de-masse]")?.textContent).toContain("1")
    expect(barre.closest("[data-barre-de-masse]")?.textContent).toContain("choisi")

    fireEvent.click(barre)
    expect(document.querySelector("[data-barre-de-masse]")).toBeNull()
  })
})

describe("le glisser-déposer", () => {
  const glisserDepuis = (cible: HTMLElement, types: string[] = [GLISSE_DES_SUJETS]) =>
    fireEvent.dragStart(cible, {
      dataTransfer: { types, getData: () => "", files: [], setData: vi.fn() },
    })

  test("glisser une carte non choisie ne fait porter le geste que sur elle", async () => {
    const { surGlisser } = monter()
    await screen.findByRole("heading", { name: /Les 5 personnages/ })

    fireEvent.click(carte("a")) // « a » est choisie…
    glisserDepuis(carte("c")) // …mais on attrape « c », qui ne l'est pas.

    // **Et le geste part avec ce que chaque collection gagnerait**, parce que
    // le carnet est l'autre cible de dépôt et qu'il n'a pas les sujets de la
    // page pour le calculer : « c » n'est pas dans « Les boss » et l'est déjà
    // dans « Les PNJ ».
    expect(surGlisser).toHaveBeenLastCalledWith(["c"], { boss: 1, pnj: 0 })
  })

  test("la collection visée annonce « déjà + arrivants » pendant le survol", async () => {
    monter()
    await screen.findByRole("heading", { name: /Les 5 personnages/ })

    fireEvent.click(carte("a")) // déjà dans « Les boss »
    fireEvent.click(carte("c")) // pas dans « Les boss »
    glisserDepuis(carte("a"))

    const puce = document.querySelector('[data-puce-de-rangement="boss"]') as HTMLElement
    fireEvent.dragOver(puce, {
      dataTransfer: { types: [GLISSE_DES_SUJETS], getData: () => "", files: [] },
    })

    expect(within(puce).getByText("1 + 1")).toBeTruthy()
  })

  test("un sujet déjà rangé ne compte pas dans les arrivants, et lâcher range chaque sujet puis relit la grille", async () => {
    const { appels, surRange } = monter()
    await screen.findByRole("heading", { name: /Les 5 personnages/ })

    fireEvent.click(carte("a")) // déjà dans « Les boss »
    fireEvent.click(carte("c")) // pas dans « Les boss »
    glisserDepuis(carte("a"))

    const puce = document.querySelector('[data-puce-de-rangement="boss"]') as HTMLElement
    fireEvent.dragOver(puce, {
      dataTransfer: { types: [GLISSE_DES_SUJETS], getData: () => "", files: [] },
    })
    fireEvent.drop(puce, {
      dataTransfer: { types: [GLISSE_DES_SUJETS], getData: () => "", files: [] },
    })

    await waitFor(() => expect(surRange).toHaveBeenCalledTimes(1))
    const rangements = appels.filter((a) => a.methode === "PUT" && a.url.includes("/members"))
    expect(rangements).toHaveLength(1)
    expect(rangements[0]!.corps).toEqual({ jeu: "le-marais", sujet: "c" })
    // La grille se relit : un appel de plus vers la route de la famille.
    expect(appelsDeFamille(appels).length).toBeGreaterThan(1)
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

// ── Ce que le carnet demande à la grille (B9.5) ──────────────────────────────
//
// Le carnet est à gauche, la grille au centre : deux composants, un seul geste.
// Ces trois essais tiennent la couture entre eux.

describe("la collection ouverte dans le carnet", () => {
  test("elle part au serveur, elle n'est pas triée ici", async () => {
    const { appels } = monter({ collection: "boss" })
    await screen.findByRole("heading", { name: "1 personnage" })

    const lecture = appels.find((a) => a.url.includes("/characters/families/"))!
    expect(lecture.url).toContain("collection=boss")

    // Et les trois onglets comptent ce que le serveur a rendu, restreint avec
    // le reste : deux incomplets dans la famille entière, aucun ici.
    expect(screen.getByRole("tab", { name: /Incomplets/ }).textContent).toContain("0")
  })

  test("le fil d'Ariane nomme la collection, pas « Tous »", async () => {
    monter({ collection: "boss" })
    await screen.findByText("Les boss")
  })

  test("en changer ne part chercher qu'une fois, et à la première page", async () => {
    // Mesuré au navigateur, sur 260 sujets : la grille partait chercher la
    // collection neuve **avec la limite déroulée d'avant**, puis repartait la
    // chercher à 120. Deux allers-retours, et le premier était le gros.
    const { fetchDouble, appels } = construireDouble()
    vi.stubGlobal("fetch", fetchDouble)
    const lectures = () =>
      appels.filter((a) => a.url.includes("/characters/families/")).map((a) => a.url)
    const commun = {
      surGlisser: vi.fn(),
      surGroupes: vi.fn(),
      rafraichi: 0,
      surRange: vi.fn(),
      surReglages: vi.fn(),
      surAjouter: vi.fn(),
      surErreur: vi.fn(),
    }

    const { rerender } = render(<Controle {...commun} />)
    await screen.findByRole("heading", { name: /Les 5 personnages/ })
    fireEvent.click(screen.getByRole("button", { name: "Charger la suite" }))
    await waitFor(() => expect(lectures().some((u) => u.includes("limite=240"))).toBe(true))

    const avant = lectures().length
    rerender(<Controle {...commun} collection="boss" />)
    await screen.findByRole("heading", { name: "1 personnage" })

    const neuves = lectures().slice(avant)
    expect(neuves).toHaveLength(1)
    expect(neuves[0]).toContain("collection=boss")
    expect(neuves[0]).toContain("limite=120")
  })
})

describe("nommer une collection sans rien avoir choisi", () => {
  test("le « ＋ Nouvelle collection » du carnet ouvre le champ ici", async () => {
    // Sans sélection il n'y a pas de volet, donc pas de puce « + nouvelle » :
    // le champ doit paraître ailleurs, sinon le bouton du carnet ne mènerait
    // nulle part.
    const { surRange, appels } = monter({ creerUnGroupe: 1 })
    await screen.findByRole("heading", { name: /Les 5 personnages/ })

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
        surGlisser={vi.fn()}
        surGroupes={surGroupes}
        rafraichi={0}
        surRange={vi.fn()}
        surReglages={vi.fn()}
        surAjouter={vi.fn()}
        surErreur={vi.fn()}
      />,
    )

    await waitFor(() => expect(surGroupes).toHaveBeenCalledWith([]))
    expect(screen.getByRole("heading", { name: "Les personnages" })).toBeTruthy()
  })
})
