// Le panneau des réglages d'une famille (B9.7). Aucun de ces essais ne coûte
// un centime : `fetch` est doublé à la main, un peu à la fois pour chaque
// route que le panneau appelle — jamais de serveur, jamais de réseau.
//
// **Le premier essai est le plus important du fichier** (`AGENTS.md`, la même
// panne payée trois fois sous le nom « un message partiel traité comme un
// objet entier ») : `PUT /universe` remplace tout le barème et tout le
// dictionnaire des modèles dès que la clé est présente. Un panneau qui ne
// renverrait que les lignes de la famille ouverte effacerait les trois
// autres au premier `Enregistrer` — c'est très exactement ce que cet essai
// vérifie n'arrive pas.

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, test, vi } from "vitest"

import { ReglagesDeFamille } from "./ReglagesDeFamille"
import { UNIVERS_VIDE, type Echelle, type EmplacementCorps, type Modele, type Pose } from "../api"

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

// ── Les données du jeu doublé ───────────────────────────────────────────────

function echelle(nom: string, famille: string, occupation = 100, silhouette = true): Echelle {
  return { nom, famille: famille as Echelle["famille"], occupation, silhouette }
}

function pose(identifiant: string, nom: string, images = 1): Pose {
  return { identifiant, nom, images, consigne: "", ecartees: [], images_avant: 0 }
}

function modele(identifiant: string, nomDuModele: string): Modele {
  return {
    identifiant,
    nom: nomDuModele,
    fournisseur: "OpenRouter",
    chez_lui: identifiant,
    references_max: 4,
    proportions: ["1:1"],
    resolutions: ["1024x1024"],
    variations_max: 4,
    options: {},
    refus: null,
    repli: false,
    recu_le: 0,
    unite: "usd",
  }
}

// Quatre familles, deux natures de personnages — la forme exacte du barème
// que la maquette montre (« Les huit natures du jeu... ici on ne voit que
// les deux des personnages »), réduite à cinq pour rester lisible ici.
const BAREME_INITIAL: Echelle[] = [
  echelle("personnage", "personnages", 100, true),
  echelle("créature", "personnages", 90, true),
  echelle("meuble", "objets", 60, false),
  echelle("tuile", "decors", 100, false),
  // TU2 : la nature « matière », comme le serveur (`BAREME_PAR_DEFAUT`).
  echelle("matière", "decors", 100, false),
]

const MODELES_INITIAUX: Record<string, string> = {
  personnages: "OpenRouter:gpt-image-2",
  objets: "OpenRouter:autre-modele",
  decors: "OpenRouter:decor-modele",
}

const POSES_INITIALES: Record<string, Pose[]> = {
  personnage: [pose("repos", "repos"), pose("marche", "marche", 8), pose("attaque", "attaque")],
  créature: [
    pose("repos", "repos"),
    pose("marche", "marche", 8),
    pose("attaque", "attaque"),
    pose("mort", "mort"),
  ],
  meuble: [pose("ferme", "fermé"), pose("ouvert-p", "ouvert"), pose("vide-p", "vidé")],
  tuile: [],
}

const CATALOGUE_MODELES: Modele[] = [
  modele("OpenRouter:gpt-image-2", "GPT Image 2"),
  modele("OpenRouter:autre-modele", "Autre modèle"),
  modele("OpenRouter:modele-3", "Troisième modèle"),
]

type Appel = { url: string; methode: string; corps: unknown }

/** Un double de `fetch` qui rejoue, pour les seules routes que ce panneau
 *  appelle, exactement ce que le service Python répond — refus compris,
 *  au caractère près des messages relevés dans le code réel. */
function construireDouble(
  options: {
    bareme?: Echelle[]
    modeles?: Record<string, string>
    posesParType?: Record<string, Pose[]>
    emplacements?: EmplacementCorps[]
  } = {},
) {
  let bareme = options.bareme ? [...options.bareme] : [...BAREME_INITIAL]
  let modeles = { ...(options.modeles ?? MODELES_INITIAUX) }
  const posesParType: Record<string, Pose[]> = { ...(options.posesParType ?? POSES_INITIALES) }
  let emplacements = options.emplacements ? [...options.emplacements] : []
  let prochainRang = emplacements.length

  const appels: Appel[] = []

  const universJson = () => ({
    projet: "le-marais",
    univers: { ...UNIVERS_VIDE, bareme, modeles },
    fond_propose: { couleur: "", distance: 0 },
    artworks: [],
  })
  const typesJson = () => ({
    types: bareme.map((e) => ({
      nom: e.nom,
      origine: "écrite" as const,
      poses: posesParType[e.nom] ?? [],
      connues: [],
    })),
    plan: [],
  })
  const vestiaireJson = () => ({ projet: "le-marais", emplacements, pieces: [] })

  const rendre = (charge: unknown) => ({ ok: true, status: 200, json: async () => charge }) as Response
  const refuser = (raison: string) =>
    ({ ok: false, status: 409, json: async () => ({ raison, code: "refus" }) }) as Response

  const fetchDouble = vi.fn(async (chemin: unknown, init?: RequestInit) => {
    const url = String(chemin)
    const methode = init?.method ?? "GET"
    const corps = (() => {
      if (!init?.body || typeof init.body !== "string") return undefined
      try {
        return JSON.parse(init.body)
      } catch {
        return undefined
      }
    })()
    appels.push({ url, methode, corps })

    if (url === "/api/universe" && methode === "GET") return rendre(universJson())

    if (url === "/api/universe" && methode === "PUT") {
      const body = corps as { bareme?: Echelle[]; modeles?: Record<string, string> }
      if (body.bareme) {
        const vus = new Set<string>()
        for (const e of body.bareme) {
          const propre = e.nom.trim()
          if (!propre) return refuser("une échelle a besoin d'un nom")
          if (vus.has(propre.toLowerCase())) return refuser("deux échelles portent le même nom")
          vus.add(propre.toLowerCase())
        }
        bareme = body.bareme
      }
      if (body.modeles) {
        modeles = Object.fromEntries(Object.entries(body.modeles).filter(([, v]) => v))
      }
      return rendre(universJson())
    }

    if (url === "/api/characters/types" && methode === "GET") return rendre(typesJson())

    if (url.startsWith("/api/characters/types/") && url.endsWith("/poses") && methode === "PUT") {
      const type = decodeURIComponent(
        url.slice("/api/characters/types/".length, url.length - "/poses".length),
      )
      if (!bareme.some((e) => e.nom === type)) return refuser(`aucun type « ${type} » dans ce jeu`)
      const body = corps as { poses: Pose[] }
      posesParType[type] = body.poses
      return rendre(typesJson())
    }

    if (url.startsWith("/api/models")) {
      return rendre({
        recu_le: 0,
        repli: false,
        raison: null,
        fournisseurs: [],
        defaut: { modele: null, options: {} },
        references: { references: 0, artworks: 0, total: 0, plafond: 0 },
        couts: {},
        modeles: CATALOGUE_MODELES,
      })
    }

    if (url === "/api/characters" && methode === "GET") {
      return rendre({
        directions: [],
        connues: [],
        projet: "le-marais",
        plan: [],
        personnages: [],
        emplacements,
        pieces: [],
      })
    }

    if (url === "/api/characters/slots" && methode === "POST") {
      const body = corps as { nom: string }
      const propre = body.nom.trim()
      if (emplacements.some((e) => e.nom.toLowerCase() === propre.toLowerCase())) {
        return refuser(`« ${propre} » est déjà un emplacement de ce projet`)
      }
      const neuf: EmplacementCorps = { identifiant: `slot-${prochainRang}`, nom: propre, rang: prochainRang }
      prochainRang += 1
      emplacements = [...emplacements, neuf]
      return rendre({ emplacement: neuf, ...vestiaireJson() })
    }

    if (url === "/api/characters/slots/suggested" && methode === "POST") {
      for (const nomPropose of ["le dos", "le corps", "les jambes", "le torse", "les mains", "la tête"]) {
        if (!emplacements.some((e) => e.nom === nomPropose)) {
          emplacements = [
            ...emplacements,
            { identifiant: `slot-${prochainRang}`, nom: nomPropose, rang: prochainRang },
          ]
          prochainRang += 1
        }
      }
      return rendre(vestiaireJson())
    }

    if (url.startsWith("/api/characters/slots/") && methode === "PUT") {
      const identifiant = url.slice("/api/characters/slots/".length)
      const body = corps as { nom?: string; rang?: number }
      if (body.nom && emplacements.some((e) => e.identifiant !== identifiant && e.nom.toLowerCase() === body.nom!.toLowerCase())) {
        return refuser(`« ${body.nom} » est déjà un emplacement de ce projet`)
      }
      emplacements = emplacements.map((e) =>
        e.identifiant === identifiant
          ? { ...e, ...(body.nom ? { nom: body.nom } : {}), ...(body.rang != null ? { rang: body.rang } : {}) }
          : e,
      )
      const trouve = emplacements.find((e) => e.identifiant === identifiant)
      return rendre({ emplacement: trouve, ...vestiaireJson() })
    }

    if (url.startsWith("/api/characters/slots/") && methode === "DELETE") {
      const identifiant = url.slice("/api/characters/slots/".length)
      const trouve = emplacements.find((e) => e.identifiant === identifiant)
      emplacements = emplacements.filter((e) => e.identifiant !== identifiant)
      return rendre({ emplacement: trouve, ...vestiaireJson() })
    }

    throw new Error(`route non doublée dans cet essai : ${methode} ${url}`)
  })

  return { fetchDouble, appels }
}

async function monter(
  fetchDouble: ReturnType<typeof construireDouble>["fetchDouble"],
  surplus: { famille?: string; nom?: string } = {},
) {
  const onFermer = vi.fn()
  const onErreur = vi.fn()
  vi.stubGlobal("fetch", fetchDouble)
  render(
    <ReglagesDeFamille
      famille={surplus.famille ?? "personnages"}
      nom={surplus.nom ?? "Les personnages"}
      onFermer={onFermer}
      onErreur={onErreur}
    />,
  )
  return { onFermer, onErreur }
}

// ── Le piège — le plus important ────────────────────────────────────────────

describe("le piège du PATCH partiel", () => {
  test("enregistrer les natures d'une famille n'efface pas celles des autres", async () => {
    const { fetchDouble, appels } = construireDouble()
    await monter(fetchDouble)

    const occupation = await screen.findByRole("spinbutton", {
      name: "L'occupation de « personnage »",
    })
    fireEvent.change(occupation, { target: { value: "80" } })

    fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }))

    await waitFor(() =>
      expect(appels.some((a) => a.url === "/api/universe" && a.methode === "PUT")).toBe(true),
    )

    const envoi = appels.find((a) => a.url === "/api/universe" && a.methode === "PUT")!
    const bareme = (envoi.corps as { bareme: Echelle[] }).bareme

    // Toutes les échelles voyagent, pas seulement celles des personnages.
    expect(bareme).toHaveLength(BAREME_INITIAL.length)
    expect(bareme.find((e) => e.nom === "personnage")?.occupation).toBe(80)
    // Les deux autres familles sont là, et inchangées.
    expect(bareme.find((e) => e.nom === "meuble")).toEqual(
      BAREME_INITIAL.find((e) => e.nom === "meuble"),
    )
    expect(bareme.find((e) => e.nom === "tuile")).toEqual(
      BAREME_INITIAL.find((e) => e.nom === "tuile"),
    )
  })

  test("enregistrer le modèle d'une famille n'efface pas les modèles des autres familles", async () => {
    const { fetchDouble, appels } = construireDouble()
    await monter(fetchDouble, { famille: "objets", nom: "Les objets" })

    const selecteur = await screen.findByRole("combobox", { name: "Le modèle de cette famille" })
    fireEvent.change(selecteur, { target: { value: "OpenRouter:modele-3" } })

    fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }))

    await waitFor(() =>
      expect(appels.some((a) => a.url === "/api/universe" && a.methode === "PUT")).toBe(true),
    )

    const envoi = appels.find((a) => a.url === "/api/universe" && a.methode === "PUT")!
    const modeles = (envoi.corps as { modeles: Record<string, string> }).modeles

    expect(modeles.objets).toBe("OpenRouter:modele-3")
    expect(modeles.personnages).toBe(MODELES_INITIAUX.personnages)
    expect(modeles.decors).toBe(MODELES_INITIAUX.decors)
  })
})

// ── Les natures ──────────────────────────────────────────────────────────────

describe("la table des natures", () => {
  test("la table ne montre que les natures de la famille demandée", async () => {
    const { fetchDouble } = construireDouble()
    await monter(fetchDouble, { famille: "objets", nom: "Les objets" })

    await screen.findByDisplayValue("meuble")
    expect(screen.queryByDisplayValue("personnage")).toBeNull()
    expect(screen.queryByDisplayValue("créature")).toBeNull()
    expect(screen.queryByDisplayValue("tuile")).toBeNull()
  })

  test("choisir une nature change la table des poses", async () => {
    const { fetchDouble } = construireDouble()
    await monter(fetchDouble)

    // Par défaut, la première nature de la famille est choisie.
    await screen.findByText("repos")
    expect(screen.getByRole("heading", { name: "Les poses de « personnage »" })).toBeTruthy()
    expect(screen.queryByText("mort")).toBeNull()

    fireEvent.click(screen.getByDisplayValue("créature"))

    expect(await screen.findByText("mort")).toBeTruthy()
    expect(screen.getByRole("heading", { name: "Les poses de « créature »" })).toBeTruthy()
  })
})

// ── Les poses ────────────────────────────────────────────────────────────────

describe("la table des poses", () => {
  test("retirer une pose l'écrit par la route de cette nature-là, et ne touche pas à l'univers", async () => {
    const { fetchDouble, appels } = construireDouble()
    await monter(fetchDouble)

    await screen.findByText("marche")
    fireEvent.click(screen.getByRole("button", { name: "Retirer la pose « marche »" }))

    await waitFor(() => expect(screen.queryByText("marche")).toBeNull())

    const envoi = appels.find(
      (a) => a.url === "/api/characters/types/personnage/poses" && a.methode === "PUT",
    )!
    expect(envoi).toBeTruthy()
    expect((envoi.corps as { poses: Pose[] }).poses.map((p) => p.nom)).toEqual(["repos", "attaque"])

    // Aucun PUT /universe n'est parti : la route des poses ne touche qu'elle-même.
    expect(appels.some((a) => a.url === "/api/universe" && a.methode === "PUT")).toBe(false)
  })
})

// ── Les emplacements de corps ────────────────────────────────────────────────

describe("les emplacements de corps", () => {
  test("les emplacements de corps n'apparaissent que pour les personnages, et une phrase le dit", async () => {
    const { fetchDouble: doubleObjets } = construireDouble()
    await monter(doubleObjets, { famille: "objets", nom: "Les objets" })

    await screen.findByText(
      "Un objet n'a ni tête ni mains : les emplacements de corps ne valent que pour les personnages.",
    )
    expect(screen.queryByRole("button", { name: "+ un emplacement" })).toBeNull()

    cleanup()

    const { fetchDouble: doublePersonnages } = construireDouble({
      emplacements: [{ identifiant: "e1", nom: "le dos", rang: 0 }],
    })
    await monter(doublePersonnages)

    await screen.findByDisplayValue("le dos")
    expect(
      screen.queryByText(/n'a ni tête ni mains/),
    ).toBeNull()
  })

  test("un jeu sans aucun emplacement propose de poser les six proposés", async () => {
    const { fetchDouble, appels } = construireDouble({ emplacements: [] })
    await monter(fetchDouble)

    const bouton = await screen.findByRole("button", { name: "Poser les six proposés" })
    fireEvent.click(bouton)

    await screen.findByDisplayValue("le dos")
    expect(
      appels.some((a) => a.url === "/api/characters/slots/suggested" && a.methode === "POST"),
    ).toBe(true)
  })

  test("un refus du serveur se montre en clair, il n'est pas avalé", async () => {
    const { fetchDouble } = construireDouble({
      emplacements: [{ identifiant: "e1", nom: "le dos", rang: 0 }],
    })
    const { onErreur } = await monter(fetchDouble)

    await screen.findByDisplayValue("le dos")
    fireEvent.click(screen.getByRole("button", { name: "+ un emplacement" }))
    const champ = await screen.findByRole("textbox", { name: "+ un emplacement" })
    fireEvent.change(champ, { target: { value: "Le Dos" } })
    fireEvent.submit(champ.closest("form")!)

    await waitFor(() =>
      expect(onErreur).toHaveBeenCalledWith("« Le Dos » est déjà un emplacement de ce projet"),
    )
  })
})

// ── Fermer le panneau ────────────────────────────────────────────────────────

describe("fermer le panneau", () => {
  test("Échap et le bouton Fermer appellent tous deux onFermer", async () => {
    const { fetchDouble: double1 } = construireDouble()
    const { onFermer: onFermer1 } = await monter(double1)

    fireEvent.keyDown(window, { key: "Escape" })
    expect(onFermer1).toHaveBeenCalledTimes(1)

    cleanup()

    const { fetchDouble: double2 } = construireDouble()
    const { onFermer: onFermer2 } = await monter(double2)

    fireEvent.click(screen.getByRole("button", { name: "Fermer" }))
    expect(onFermer2).toHaveBeenCalledTimes(1)
  })
})
