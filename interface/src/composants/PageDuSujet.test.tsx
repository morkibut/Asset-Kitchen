// Ce que la page d'un sujet fait (B10) : ses quatre onglets sur un seul écran,
// sa fiche, ce qui existe de lui, ce qui lui manque, et la porte de la matrice
// — qui porte encore le vestiaire, les planches, le calibrage et les
// animations. `fetch` est doublé à la main : aucun essai ne coûte un centime.
//
// La matrice elle-même n'est pas essayée ici : elle a les siens, dans
// `App.test.tsx`, et les monter deux fois ferait dire deux choses de la même
// pièce.

import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { afterEach, describe, expect, test, vi } from "vitest"

import { PageDuSujet } from "./PageDuSujet"
import { RECETTE_VIDE, type Asset, type Case, type Personnage, type Pose } from "../api"

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

// ── De quoi fabriquer un sujet ──────────────────────────────────────────────

function image(surplus: Partial<Asset> & { identifiant: string }): Asset {
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
    cree_le: 200,
    cout_usd: 0.02,
    consomme: 0.02,
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

function sujet(surplus: Partial<Personnage> = {}): Personnage {
  return {
    identifiant: "le-pelerin",
    projet: "le-marais",
    nom: "Le pèlerin",
    description: "a weathered pilgrim in a hooded brown robe",
    ecartees: [],
    concept_arts: [],
    references_ecartees: [],
    cree_le: 1_700_000_000,
    cases: [
      sienne({ pose: "repos", images: [image({ identifiant: "a" })], corps: "a" }),
      sienne({ pose: "marche" }),
    ],
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
  }
}

const UNIVERS = {
  univers: {
    bareme: [{ nom: "personnage", famille: "personnages", occupation: 1, silhouette: "", poses: [] }],
    modeles: {},
  },
}

const FAMILLE = {
  personnages: [
    {
      identifiant: "le-pelerin",
      collections: [{ identifiant: "heros", nom: "Les héros" }],
    },
  ],
  groupes: [
    { identifiant: "heros", nom: "Les héros", sujets: 3 },
    { identifiant: "pnj", nom: "Les PNJ", sujets: 7 },
  ],
  filtres: { tous: 1, incomplets: 0, "sans-description": 0 },
  total: 1,
}

function construireDouble() {
  const appels: { url: string; methode: string; corps: unknown }[] = []
  const fetchDouble = vi.fn(async (chemin: string, init?: RequestInit) => {
    const url = String(chemin)
    appels.push({
      url,
      methode: init?.method ?? "GET",
      corps:
        init?.body && typeof init.body === "string"
          ? (JSON.parse(init.body) as unknown)
          : undefined,
    })
    const rendre = (charge: unknown) =>
      ({ ok: true, status: 200, json: async () => charge }) as Response
    if (url.startsWith("/api/universe")) return rendre(UNIVERS)
    if (url.startsWith("/api/characters/families/")) return rendre(FAMILLE)
    if (url.startsWith("/api/characters/le-pelerin/export"))
      return rendre({ compte: 4, dossier: "D:/jeu", chemins: [] })
    return rendre({})
  })
  return { fetchDouble, appels }
}

function monter(surplus: Partial<Personnage> = {}, dossierJeu = "D:/jeu") {
  const { fetchDouble, appels } = construireDouble()
  vi.stubGlobal("fetch", fetchDouble)
  const rappels = {
    onPersonnage: vi.fn(),
    onArmer: vi.fn(),
    onAnimer: vi.fn(),
    onFente: vi.fn(),
    onOuvrirCase: vi.fn(),
    onMonterLaBande: vi.fn(),
    onOuvrirLaBande: vi.fn(),
    onSuperposition: vi.fn(),
    onSupprimer: vi.fn(),
  }
  render(
    <PageDuSujet
      ouvert={sujet(surplus)}
      plan={PLAN}
      emplacements={[]}
      pieces={[]}
      dossierJeu={dossierJeu}
      barreQuiPaie={<div data-barre-qui-paie />}
      outil={null}
      {...rappels}
    />,
  )
  return { ...rappels, appels }
}

const onglet = (nom: string) => screen.getByRole("tab", { name: nom })

// ── Les quatre onglets ──────────────────────────────────────────────────────

describe("les quatre onglets", () => {
  test("la page ouvre sur sa fiche, et porte le marqueur du lieu", () => {
    monter()
    expect(document.querySelector("[data-etabli]")).toBeTruthy()
    expect(document.querySelector("[data-page-du-sujet]")).toBeTruthy()
    expect(onglet("Sa fiche").getAttribute("aria-selected")).toBe("true")
    expect(screen.getByRole("heading", { name: "Le pèlerin" })).toBeTruthy()
  })

  // Les deux onglets à venir sont dans la barre et cliquables : les cacher
  // ferait croire que la page est finie. Ils disent qu'ils ne sont pas
  // construits **sans nommer leur tranche** — `B11` et `B12` ne veulent rien
  // dire à l'écran, et l'interface n'écrit de code de tranche nulle part
  // ailleurs.
  test("les quatre sont là, cliquables, et l'essai dit qu'il n'est pas encore construit", () => {
    monter()
    for (const nom of ["Sa fiche", "Ses images", "Ses animations", "L'essai"])
      expect(onglet(nom)).toBeTruthy()
    // « Ses animations » est construit depuis B11 — voir
    // `AnimationsDuSujet.test.tsx` pour son rangement.
    fireEvent.click(onglet("Ses animations"))
    expect(document.querySelector("[data-onglet-animations]")).toBeTruthy()
    fireEvent.click(onglet("L'essai"))
    expect(screen.getByText(/décor n'est pas encore construit/)).toBeTruthy()
  })

  test("passer d'un onglet à l'autre ne redemande rien au serveur, aller et retour", async () => {
    // Le critère de la tranche : le carnet ne bouge pas, et rien ne se
    // recharge. L'onglet est un état de la page, pas un lieu de la pile.
    //
    // **Et le retour compte autant que l'aller** : la fiche se démonte en
    // changeant d'onglet, et ses deux lectures repartaient à chaque retour tant
    // qu'elles vivaient dedans. Elles sont tenues par la page.
    const { appels } = monter()
    await waitFor(() => expect(appels.length).toBeGreaterThan(0))
    const apresLaFiche = appels.length
    fireEvent.click(onglet("Ses images"))
    fireEvent.click(onglet("Ses animations"))
    fireEvent.click(onglet("Sa fiche"))
    fireEvent.click(onglet("Ses images"))
    fireEvent.click(onglet("Sa fiche"))
    expect(appels).toHaveLength(apresLaFiche)
    // Et ce qu'elles avaient lu est toujours là.
    expect(screen.getByText("Les héros")).toBeTruthy()
    expect(screen.getByText("il occupe 100 % de la hauteur")).toBeTruthy()
  })

  test("la barre qui paie reste au pied, quel que soit l'onglet", () => {
    monter()
    expect(document.querySelector("[data-barre-qui-paie]")).toBeTruthy()
    fireEvent.click(onglet("Ses images"))
    expect(document.querySelector("[data-barre-qui-paie]")).toBeTruthy()
  })

  test("l'onglet « Ses images » montre bien le rangement en rangées", () => {
    monter()
    fireEvent.click(onglet("Ses images"))
    expect(document.querySelector("[data-onglet-images]")).toBeTruthy()
    expect(document.querySelector('[data-pose-de-rangement="repos"]')).toBeTruthy()
  })

  test("l'onglet « Ses animations » montre bien le rangement en rangées (B11)", () => {
    monter()
    fireEvent.click(onglet("Ses animations"))
    expect(document.querySelector("[data-onglet-animations]")).toBeTruthy()
    expect(document.querySelector('[data-pose-de-rangement="repos"]')).toBeTruthy()
  })
})

// ── Sa fiche ────────────────────────────────────────────────────────────────

describe("sa fiche", () => {
  test("son nom s'écrit, son dossier se lit et ne s'écrit pas", () => {
    monter()
    expect(screen.getByLabelText("Nom du sujet")).toHaveProperty("value", "Le pèlerin")
    expect(screen.getByText("le-pelerin")).toBeTruthy()
    expect(screen.getByText(/Le dossier est fixé à la création/)).toBeTruthy()
  })

  test("renommer part au serveur en quittant le champ, et rien avant", async () => {
    const { appels, onPersonnage } = monter()
    const champ = screen.getByLabelText("Nom du sujet")
    fireEvent.change(champ, { target: { value: "Le pénitent" } })
    expect(appels.filter((a) => a.methode === "PUT")).toHaveLength(0)
    fireEvent.blur(champ)
    await waitFor(() => expect(onPersonnage).toHaveBeenCalled())
    const pose = appels.find((a) => a.methode === "PUT")
    expect(pose?.url).toBe("/api/characters/le-pelerin")
    expect(pose?.corps).toEqual({ nom: "Le pénitent" })
  })

  test("un nom vidé revient à celui d'avant, sans rien envoyer", () => {
    const { appels } = monter()
    const champ = screen.getByLabelText("Nom du sujet")
    fireEvent.change(champ, { target: { value: "   " } })
    fireEvent.blur(champ)
    expect(champ).toHaveProperty("value", "Le pèlerin")
    expect(appels.filter((a) => a.methode === "PUT")).toHaveLength(0)
  })

  test("sa description part avec chaque génération, et le dit", async () => {
    const { appels } = monter()
    const champ = screen.getByLabelText("Description du sujet")
    fireEvent.change(champ, { target: { value: "un pèlerin usé" } })
    fireEvent.blur(champ)
    await waitFor(() =>
      expect(appels.some((a) => a.methode === "PUT")).toBe(true),
    )
    expect(appels.find((a) => a.methode === "PUT")?.corps).toEqual({
      description: "un pèlerin usé",
    })
    expect(screen.getByText("elle part avec chaque génération")).toBeTruthy()
  })

  test("son image de référence est celle que le produit désignerait, et le dit", () => {
    monter()
    const portrait = document.querySelector("[data-portrait-du-sujet]") as HTMLElement
    expect(within(portrait).getByAltText("image a")).toBeTruthy()
    expect(screen.getByText(/la retenue de repos, sinon la plus récente/)).toBeTruthy()
  })

  test("« En choisir une autre » mène là où l'on retient — pas ailleurs", () => {
    monter()
    fireEvent.click(screen.getByRole("button", { name: "En choisir une autre" }))
    expect(onglet("Ses images").getAttribute("aria-selected")).toBe("true")
  })

  test("sans une seule image, il n'y a pas de portrait, et ce n'est pas un manque", () => {
    monter({ cases: [sienne({ pose: "repos" })] })
    expect(screen.getByText("aucune image encore")).toBeTruthy()
    expect(screen.queryByRole("button", { name: "En choisir une autre" })).toBeNull()
  })

  test("ses collections se lisent, se retirent et se rangent", async () => {
    const { appels } = monter()
    await screen.findByText("Les héros")
    fireEvent.click(screen.getByLabelText("Retirer de Les héros"))
    await waitFor(() =>
      expect(appels.some((a) => a.methode === "DELETE")).toBe(true),
    )
    expect(appels.find((a) => a.methode === "DELETE")?.url).toBe(
      "/api/collections/heros/members/le-marais/le-pelerin",
    )
  })

  test("« + ranger » ne propose que les collections où il n'est pas déjà", async () => {
    const { appels } = monter()
    await screen.findByText("Les héros")
    fireEvent.click(screen.getByRole("button", { name: "+ ranger" }))
    expect(screen.getByRole("button", { name: "Les PNJ" })).toBeTruthy()
    expect(screen.queryByRole("button", { name: "Les héros" })).toBeNull()
    fireEvent.click(screen.getByRole("button", { name: "Les PNJ" }))
    await waitFor(() => expect(appels.some((a) => a.methode === "PUT")).toBe(true))
    expect(appels.find((a) => a.methode === "PUT")?.corps).toEqual({
      jeu: "le-marais",
      sujet: "le-pelerin",
    })
  })

  test("son type dit ce qu'il occupe, lu dans le barème du jeu", async () => {
    monter()
    expect(await screen.findByText("il occupe 100 % de la hauteur")).toBeTruthy()
  })

  test("« Ce qui existe de lui » compte les poses faites, les images et le reste", () => {
    monter()
    expect(screen.getByText("1 / 2")).toBeTruthy()
    expect(screen.getByText("poses")).toBeTruthy()
    expect(screen.getByText("image")).toBeTruthy()
  })
})

// ── Ce qui lui manque ───────────────────────────────────────────────────────

describe("ce qui lui manque", () => {
  const manque = () => document.querySelector("[data-ce-qui-lui-manque]") as HTMLElement

  test("une pose sans image se nomme, et son geste arme sans dépenser", () => {
    const { onArmer, appels } = monter()
    const avant = appels.length
    expect(within(manque()).getByText("1 pose sans image")).toBeTruthy()
    fireEvent.click(within(manque()).getByRole("button", { name: "Armer marche" }))
    expect(onArmer.mock.calls[0][1][0].identifiant).toBe("marche")
    expect(appels).toHaveLength(avant)
  })

  test("aucune animation propose d'en commencer une — la seule route qui existe", () => {
    const { onAnimer } = monter()
    fireEvent.click(
      within(manque()).getByRole("button", { name: "Commencer une animation" }),
    )
    expect(onAnimer).toHaveBeenCalledTimes(1)
    expect(onAnimer.mock.calls[0][1].identifiant).toBe("repos")
  })

  test("un sujet sans description le dit, et sans bouton : le champ est à gauche", () => {
    monter({ description: "" })
    expect(within(manque()).getByText("Aucune description")).toBeTruthy()
    expect(within(manque()).queryByRole("button", { name: /description/i })).toBeNull()
  })

  test("le total dit ce qu'il compte, et ce qu'il ne compte pas", () => {
    monter()
    expect(within(manque()).getByText("Ce que ses images ont coûté")).toBeTruthy()
    expect(within(manque()).getByText("$0.020")).toBeTruthy()
    expect(within(manque()).getByText(/une génération ratée ne laisse aucune image/)).toBeTruthy()
  })

  test("sans dossier de jeu, l'export est éteint et sa raison est à côté", () => {
    monter({}, "")
    const bouton = within(manque()).getByRole("button", {
      name: "L'exporter pour le moteur…",
    })
    expect(bouton).toHaveProperty("disabled", true)
    expect(within(manque()).getByText(/aucun dossier de jeu/)).toBeTruthy()
  })

  test("l'export rend son compte de fichiers", async () => {
    monter()
    fireEvent.click(
      within(manque()).getByRole("button", { name: "L'exporter pour le moteur…" }),
    )
    expect(await within(manque()).findByText(/4 fichiers posés/)).toBeTruthy()
  })

  test("le retirer du jeu part au serveur, et le rend marqué supprimé", async () => {
    const { appels, onPersonnage } = monter()
    fireEvent.click(within(manque()).getByRole("button", { name: "Le retirer du jeu" }))
    await waitFor(() => expect(onPersonnage).toHaveBeenCalled())
    expect(appels.some((a) => a.methode === "DELETE" && a.url.includes("le-pelerin"))).toBe(
      true,
    )
    expect(onPersonnage.mock.calls[0][0].supprime).toBe(true)
  })

  test("aucune commande sans route derrière — ni dupliquer, ni comparer", () => {
    monter()
    expect(screen.queryByRole("button", { name: /dupliquer/i })).toBeNull()
    expect(screen.queryByRole("button", { name: /comparer/i })).toBeNull()
  })
})

// ── La porte de la matrice ──────────────────────────────────────────────────

describe("la matrice, devenue une profondeur", () => {
  test("la fiche en porte la clé, et dit ce qui vit encore derrière", () => {
    monter()
    expect(document.querySelector("[data-porte-de-la-matrice]")).toBeTruthy()
  })

  test("l'ouvrir remplace la page, et le marqueur du lieu ne bouge pas", () => {
    monter()
    fireEvent.click(document.querySelector("[data-porte-de-la-matrice]") as HTMLElement)
    expect(document.querySelector("[data-matrice]")).toBeTruthy()
    // Les cinquante-sept essais d'écran qui visent `[data-etabli]` continuent
    // de le trouver : c'est la page qui le porte, et elle contient la matrice.
    expect(document.querySelector("[data-etabli]")).toBeTruthy()
    expect(document.querySelector("[data-page-du-sujet]")).toBeNull()
  })

  test("on en revient à sa page, sur la fiche", () => {
    monter()
    fireEvent.click(document.querySelector("[data-porte-de-la-matrice]") as HTMLElement)
    fireEvent.click(screen.getByRole("button", { name: "‹ Sa page" }))
    expect(document.querySelector("[data-page-du-sujet]")).toBeTruthy()
    expect(onglet("Sa fiche").getAttribute("aria-selected")).toBe("true")
  })

  test("« Ses animations » ne mène plus à la matrice — c'est son propre écran depuis B11", () => {
    // Avant B11, l'onglet était un placeholder dont le seul geste possible
    // était de fuir vers la matrice. Il a maintenant son propre rangement
    // (`AnimationsDuSujet.tsx`), et cette porte de secours a disparu avec lui.
    monter()
    fireEvent.click(onglet("Ses animations"))
    expect(screen.queryByRole("button", { name: "Ses cases, une par une ›" })).toBeNull()
    expect(document.querySelector("[data-matrice]")).toBeNull()
  })
})
