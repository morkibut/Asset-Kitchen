// Ce que la page d'un sujet fait (B10) : ses quatre onglets sur un seul écran,
// sa fiche, ce qui existe de lui, ce qui lui manque, et la porte de la matrice
// — qui porte encore le vestiaire, les planches, le calibrage et les
// animations. `fetch` est doublé à la main : aucun essai ne coûte un centime.
//
// La matrice elle-même n'est pas essayée ici : elle a les siens, dans
// `App.test.tsx`, et les monter deux fois ferait dire deux choses de la même
// pièce.

import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { afterEach, expect, test, vi } from "vitest"

import { MemoireDuParcours } from "./MemoireDuParcours"
import { PageDuSujet } from "./PageDuSujet"
import {
  api,
  RECETTE_VIDE,
  type Asset,
  type Case,
  type Personnage,
  type Pose,
  type Univers,
} from "../api"

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
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
    pieces: [],
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

function monter(surplus: Partial<Personnage> = {}, dossierJeu = "D:/jeu", onLivrer?: () => void, avecMemoire = false) {
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
    // Les deux rôles de la fiche d une image, montée dans *Ses images* (C4).
    onReinjecter: vi.fn(),
    onReglages: vi.fn(),
    onGrille: vi.fn(),
    onComparer: vi.fn(),
    // **B19** — son vestiaire. `null` : la page ne l'a pas encore lu, et la
    // section le dit plutôt que de faire croire qu'il ne porte rien.
    onPiece: vi.fn(),
    onCreerPiece: vi.fn(),
    onRetirerLEmploi: vi.fn(),
    onFabriquer: vi.fn(),
    onImporter: vi.fn(),
    onDecouper: vi.fn(),
    onExtraire: vi.fn(),
  }
  const page = (
    <PageDuSujet
      ouvert={sujet(surplus)}
      plan={PLAN}
      /* **B12** — l'essai reçoit les autres sujets et les règles du jeu. Un
         seul sujet ici : le sélecteur « un deuxième sujet » n'aura donc que
         « aucun » à proposer, ce que ses propres essais couvrent. */
      personnages={[sujet(surplus)]}
      univers={UNIVERS.univers as unknown as Univers}
      emplacements={[]}
      pieces={[]}
      vestiaire={null}
      dossierJeu={dossierJeu}
      onLivrer={onLivrer}
      barreQuiPaie={<div data-barre-qui-paie />}
      {...rappels}
    />
  )
  // **La mémoire du parcours n'est montée qu'à la demande** : elle ne sert
  // qu'aux essais du défilement, et l'installer partout ferait fuir l'état
  // d'un essai dans le suivant.
  render(avecMemoire ? <MemoireDuParcours>{page}</MemoireDuParcours> : page)
  return { ...rappels, appels }
}

const onglet = (nom: string) => screen.getByRole("tab", { name: nom })

// **Six onglets depuis `AU20`** : « Pas encore rangé » s'est intercalé après
// les sources. Les trois premiers montrent des cases pleines ; celui-là montre
// ce qui appartient au sujet **sans** case — et sans lui, ce qui n'est rangé
// nulle part n'était nulle part.
test("la fiche validée ouvre sur six onglets, sans formulaire ni barre permanente", async () => {
  monter()
  expect(document.querySelector("[data-page-du-sujet]")).toBeTruthy()
  expect(within(screen.getByRole("tablist", { name: "La page du sujet" })).getAllByRole("tab").map(t => t.textContent)).toEqual(["Animations", "Images fixes", "Sources & clips", "Pas encore rangé", "Équipement", "Objectif & règles"])
  expect(onglet("Animations").getAttribute("aria-selected")).toBe("true")
  expect(screen.queryByLabelText("Nom du sujet")).toBeNull()
  expect(document.querySelector("[data-ce-qui-lui-manque]")).toBeNull()
  expect(document.querySelector("[data-barre-qui-paie]")).toBeNull()
  fireEvent.click(onglet("Images fixes"))
  expect(document.querySelector("[data-onglet-images]")).toBeTruthy()
  expect(document.querySelector("[data-barre-qui-paie]")).toBeNull()
  expect(await screen.findByText("Les héros")).toBeTruthy()
})

test("un objectif d’animation n’ajoute aucun manque d’image fixe au résumé", async () => {
  const objectif = { sorties: [{ nature: "animation", pose: "marche", direction: "", quantite: 1 }], largeur: 64, hauteur: 64, cadence: 8, boucle: true, repere: { x: 32, y: 64 } } as const
  vi.spyOn(api, "objectifPersonnage").mockResolvedValue({ objectif, couverture: {
    images: { demande: 0, produit: 0, retenu: 0, manquant: 0, a_retenir: 0 },
    animations: { demande: 1, produit: 0, retenu: 0, manquant: 1, a_retenir: 0 }, cases: [],
  } } as never)
  const livrer = vi.fn()
  monter({ objectif: { ...objectif, sorties: objectif.sorties.map(s => ({ ...s })) } }, "", livrer)
  const resume = screen.getByRole("region", { name: "Résumé de l’asset" })
  expect(await within(resume).findByText(/0 \/ 1 animation retenue · 1 à fabriquer/)).toBeTruthy()
  expect(within(resume).queryByText(/image fixe.*fabriquer/)).toBeNull()
  fireEvent.click(screen.getByRole("button", { name: "Livrer…" }))
  expect(livrer).toHaveBeenCalledOnce()
})

test("un asset destiné aux images fixes ouvre directement ses images", () => {
  monter({ objectif: { sorties: [{ nature: "image", pose: "repos", direction: "", quantite: 1 }], largeur: 32, hauteur: 48, cadence: 8, boucle: false, repere: { x: 16, y: 48 } } })
  expect(onglet("Images fixes").getAttribute("aria-selected")).toBe("true")
})

test("la description se modifie à la demande puis se garde en une seule fois", async () => {
  const { onPersonnage } = monter()
  const regler = vi.spyOn(api, "reglerPersonnage").mockResolvedValue({ personnage: sujet({ nom: "La pèlerine", description: "Manteau bleu" }) })
  fireEvent.click(screen.getByRole("button", { name: "Modifier la fiche" }))
  const dialogue = screen.getByRole("dialog", { name: "La fiche de l’asset" })
  fireEvent.change(within(dialogue).getByLabelText("Nom du sujet"), { target: { value: "La pèlerine" } })
  fireEvent.change(within(dialogue).getByLabelText("Description du sujet"), { target: { value: "Manteau bleu" } })
  fireEvent.blur(within(dialogue).getByLabelText("Description du sujet"))
  expect(regler).not.toHaveBeenCalled()
  fireEvent.click(within(dialogue).getByRole("button", { name: "Garder la fiche" }))
  await waitFor(() => expect(onPersonnage).toHaveBeenCalledWith(expect.objectContaining({ nom: "La pèlerine", description: "Manteau bleu" })))
  expect(regler).toHaveBeenCalledWith("le-pelerin", { nom: "La pèlerine", description: "Manteau bleu" })
  expect(screen.queryByRole("dialog")).toBeNull()
})

test("annuler abandonne le brouillon et rouvrir retrouve les valeurs conservées", () => {
  monter()
  const confirmer = vi.spyOn(window, "confirm").mockReturnValue(true)
  const regler = vi.spyOn(api, "reglerPersonnage")
  fireEvent.click(screen.getByRole("button", { name: "Modifier la fiche" }))
  fireEvent.change(screen.getByLabelText("Nom du sujet"), { target: { value: "Brouillon" } })
  fireEvent.click(screen.getByRole("button", { name: "Annuler" }))
  expect(confirmer).toHaveBeenCalledOnce()
  expect(regler).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole("button", { name: "Modifier la fiche" }))
  expect(screen.getByLabelText("Nom du sujet")).toHaveProperty("value", "Le pèlerin")
})

test("le formulaire refuse un nom vide et montre un échec sans jeter le brouillon", async () => {
  const { onFente } = monter()
  vi.spyOn(api, "reglerPersonnage").mockRejectedValue(new Error("Écriture refusée"))
  fireEvent.click(screen.getByRole("button", { name: "Modifier la fiche" }))
  fireEvent.change(screen.getByLabelText("Nom du sujet"), { target: { value: "  " } })
  expect(screen.getByRole("button", { name: "Garder la fiche" })).toHaveProperty("disabled", true)
  fireEvent.change(screen.getByLabelText("Nom du sujet"), { target: { value: "Nouveau" } })
  fireEvent.click(screen.getByRole("button", { name: "Garder la fiche" }))
  await waitFor(() => expect(onFente).toHaveBeenCalledWith(expect.objectContaining({ texte: "Écriture refusée" })))
  expect(screen.getByLabelText("Nom du sujet")).toHaveProperty("value", "Nouveau")
})

test("la référence compacte mène à la rangée de ses images", () => {
  monter()
  const portrait = document.querySelector("[data-portrait-du-sujet]") as HTMLElement
  expect(within(portrait).getByAltText("Référence de Le pèlerin")).toBeTruthy()
  fireEvent.click(portrait)
  expect(onglet("Images fixes").getAttribute("aria-selected")).toBe("true")
})

test("un asset sans source montre un état vide compact", () => {
  monter({ cases: [sienne({ pose: "repos" })] })
  expect(screen.getByText("Référence à créer")).toBeTruthy()
})

test("les collections se modifient depuis la fiche sans toucher aux règles", async () => {
  const { appels } = monter()
  await screen.findByText("Les héros")
  fireEvent.click(screen.getByRole("button", { name: "Modifier la fiche" }))
  const dialogue = screen.getByRole("dialog")
  const choisir = within(dialogue).getByLabelText("Ajouter à une collection")
  expect(within(choisir).queryByRole("option", { name: "Les héros" })).toBeNull()
  fireEvent.change(choisir, { target: { value: "pnj" } })
  fireEvent.click(within(dialogue).getByRole("button", { name: "Ranger" }))
  await waitFor(() => expect(appels.some(a => a.methode === "PUT" && a.url.includes("/collections/pnj"))).toBe(true))
  fireEvent.click(within(dialogue).getByLabelText("Retirer de Les héros"))
  await waitFor(() => expect(appels.some(a => a.methode === "DELETE" && a.url.includes("/collections/heros"))).toBe(true))
})

// **Deux portes, et la ligne entre elles est l'argent** (`AU21`) : *Importer…*
// prend un fichier du disque et devine ce que c'est ; *Fabriquer…* commande au
// fournisseur, et c'est le seul des deux qui pose une case avant d'agir.
test("importer et fabriquer sont deux portes, et les deux tables gardent les leurs", () => {
  const rappels = monter()
  fireEvent.click(screen.getByRole("button", { name: "Fabriquer…" }))
  expect(rappels.onFabriquer).toHaveBeenCalledOnce()
  expect(screen.getByLabelText("Fichier à importer")).toBeTruthy()
  fireEvent.click(screen.getByRole("button", { name: "Découper une image" }))
  expect(rappels.onDecouper).toHaveBeenCalledWith("a")
  fireEvent.click(screen.getByRole("button", { name: "Extraire un élément" }))
  expect(rappels.onExtraire).toHaveBeenCalledWith("a")
})

test("les outils historiques restent accessibles et le test d’animation est une action", () => {
  const { onComparer, onGrille } = monter()
  fireEvent.click(screen.getByText("Autres outils"))
  fireEvent.click(screen.getByRole("button", { name: "Comparer" }))
  expect(onComparer).toHaveBeenCalledOnce()
  fireEvent.click(screen.getByRole("button", { name: "Voir la grille du jeu" }))
  expect(onGrille).toHaveBeenCalledOnce()
  fireEvent.click(screen.getByRole("button", { name: "Tester les animations" }))
  expect(document.querySelector("[data-onglet-essai]")).toBeTruthy()
  fireEvent.click(screen.getByRole("button", { name: "Retour aux animations" }))
  expect(document.querySelector("[data-onglet-animations]")).toBeTruthy()
})

test("retirer l’asset reste disponible dans la modification de la fiche", async () => {
  const { onPersonnage } = monter()
  vi.spyOn(window, "confirm").mockReturnValue(true)
  const retirer = vi.spyOn(api, "supprimerPersonnage").mockResolvedValue({} as never)
  fireEvent.click(screen.getByRole("button", { name: "Modifier la fiche" }))
  fireEvent.click(screen.getByText("Rangement et retrait du jeu"))
  fireEvent.click(screen.getByRole("button", { name: "Le retirer du jeu" }))
  await waitFor(() => expect(retirer).toHaveBeenCalledWith("le-pelerin"))
  expect(onPersonnage).toHaveBeenCalledWith(expect.objectContaining({ supprime: true }))
})

// ── Un seul bloc qui défile ─────────────────────────────────────────────────
//
// Le titre, la fiche, les onglets et la liste descendent ensemble. Avant, le
// haut restait figé et seule la liste bougeait : on lisait ses animations par
// une fente de quatre cents pixels. Aucun onglet ne monte donc plus sa propre
// boîte à défilement, et c'est la page qui retient où on en était.

test("le titre et la fiche défilent avec la liste, dans le même bloc", () => {
  monter()
  const liste = document.querySelector("[data-onglet-animations]") as HTMLElement
  const defileur = liste.closest(".overflow-y-auto") as HTMLElement
  expect(defileur).toBeTruthy()
  expect(defileur.contains(screen.getByRole("heading", { name: "Le pèlerin" }))).toBe(true)
  // Rien entre la liste et ce bloc-là ne défile pour son compte.
  expect(liste.classList.contains("overflow-y-auto")).toBe(false)
  expect(liste.querySelector(":scope > section.overflow-y-auto")).toBeNull()
})

test("chaque onglet retrouve la position où on l'avait laissé", () => {
  monter(undefined, undefined, undefined, true)
  const defileur = (document.querySelector("[data-onglet-animations]") as HTMLElement).closest(".overflow-y-auto") as HTMLElement
  defileur.scrollTop = 456
  fireEvent.scroll(defileur)
  fireEvent.click(onglet("Images fixes"))
  defileur.scrollTop = 120
  fireEvent.scroll(defileur)
  fireEvent.click(onglet("Animations"))
  expect(defileur.scrollTop).toBe(456)
  fireEvent.click(onglet("Images fixes"))
  expect(defileur.scrollTop).toBe(120)
})
