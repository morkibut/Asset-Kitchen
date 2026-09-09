// Ce que l'écran de la retouche montre (B16, étendu en B24) : les huit tables
// dans leur ordre, le trait, les deux fabriques à droite de lui — ouvertes
// dans le cadre lui-même depuis B24 —, la raison écrite à côté de chaque
// grisé, la jauge au-delà de 240 ms, la colonne des sœurs, le presse-papiers
// et les recettes nommées, la promotion d'un détourage en défaut du projet,
// et le grossissement libre entre 1 et 250 %.
//
// **Trois choses sont mesurées ici et nulle part ailleurs.**
//
// 1. **Aucune table n'est cachée** — c'est le premier critère de la tranche, et
//    c'est celui qu'une refonte casse le plus facilement : une table qu'on ne
//    sait pas dessiner disparaît, et personne ne s'en aperçoit.
// 2. **Un réglage grisé porte sa raison et le geste qui le rallume** — la
//    marge du recadrage est le cas d'école : la phrase était déjà là, et le
//    curseur restait actif.
// 3. **La jauge ne paraît qu'au-delà de 240 ms** — mesuré sur des horloges
//    fausses, dans les deux sens : elle est absente à 100 ms, présente à 400.
//
// ⚠️ **Le seuil se mesure des deux côtés, et c'est délibéré.** Un essai qui ne
// vérifierait que sa présence passerait aussi bien avec une jauge toujours
// visible — c'est-à-dire avec le défaut exact que le seuil existe pour éviter.
//
// **B24 déménage cinq gestes de `Tables.tsx`** : la colonne des sœurs, le
// presse-papiers et les recettes nommées, la promotion d'un détourage en
// défaut du projet, les deux fabriques montées dans le cadre plutôt que
// derrière un aller-retour vers l'ancien `EcranTables`, et le grossissement
// libre. Les essais qui les mesurent sont neufs ici ; ils ne reprennent aucun
// essai de `Places.test.tsx`, qui ne connaît ni les tables ni la retouche.

import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"

import type { ReactNode } from "react"
import { Retouche } from "./Retouche"
import { reinitialiserPressePapier } from "./Tables"
import {
  RECETTE_VIDE,
  UNIVERS_VIDE,
  type Asset,
  type EtatTraitement,
  type Recette,
  type Univers,
} from "../api"

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

beforeEach(() => {
  // **N'existe que pour les essais** (`Tables.tsx`) : deux essais qui
  // partageraient un presse-papiers se raconteraient l'un l'autre.
  reinitialiserPressePapier()
  nommeesDouble = {}
})

// ── Ce sur quoi on travaille ────────────────────────────────────────────────

function image(surplus: Partial<Asset> = {}): Asset {
  return {
    identifiant: "img-1",
    generation: "gen-1",
    rang: 0,
    largeur: 1024,
    hauteur: 1024,
    type_media: "image/png",
    label: "le pèlerin, au repos",
    recette: RECETTE_VIDE,
    rendu_largeur: 64,
    rendu_hauteur: 64,
    cree_le: 200,
    cout_usd: 0.02,
    consomme: 0.02,
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
  } as Asset
}

const TRAITEMENT: EtatTraitement = {
  moteurs: [
    { nom: "bord", raison: null },
    { nom: "couleur", raison: null },
    { nom: "modele", raison: "le modèle n'est pas descendu sur cette machine" },
    { nom: "trace", raison: null },
  ],
  silhouettes: [],
  quantification: {
    raison: null,
    note: "aucun artwork officiel — les couleurs se déduisent de chaque image",
  },
  reductions: [
    { nom: "vote", libelle: "vote en deux temps", raison: null },
    { nom: "pixeloe", libelle: "traits épaissis", raison: "la bibliothèque manque" },
    { nom: "lanczos", libelle: "réduction douce", raison: null },
    { nom: "proche", libelle: "au plus proche", raison: null },
  ],
  recettes: [],
} as unknown as EtatTraitement

function univers(surplus: Partial<Univers> = {}): Univers {
  return {
    ...UNIVERS_VIDE,
    style: "pixel",
    cible_px: 64,
    couleurs: 24,
    methode_pixels: "proche",
    palette: ["#241d16", "#8a5a2c"],
    fond: "#ff00ff",
    ...surplus,
  }
}

/** La recette d'une image détourée et mise en case — **le cas normal**, celui
 *  où la case avale la marge du recadrage. */
function recetteDeTravail(surplus: Partial<Recette> = {}): Recette {
  return {
    ...RECETTE_VIDE,
    passes: [
      {
        moteur: "bord",
        tolerance: 28,
        seuil_alpha: 128,
        durcissement: 0,
        point: null,
        portee: "tache",
        masquee: false,
        trace: [],
        modele: "",
      },
    ],
    recadrage: { marge: 8, boite: null },
    grille: {
      cible: 64,
      occupation: 100,
      ancrage: "bas",
      decalage: 0,
      methode: "proche",
    },
    ...surplus,
  } as Recette
}

const MESURES = {
  taches: [
    { aire: 1, boite: [0, 0, 0, 0], couleur: "#6b5a44", point: [0, 0] },
    { aire: 5, boite: [1, 1, 2, 2], couleur: "#6b5a44", point: [1, 1] },
  ],
  taches_total: 2,
  poches: [],
  poches_total: 0,
  trous: [{ aire: 5, boite: [3, 3, 4, 4], couleur: "#000000", point: [3, 3] }],
  crans_occupation: [100],
  hauteur: { carres: 64, personnages: 1, max: 800, sujet: 64 },
  grille_du_modele: { pas: 8, depart: 0, raison: null },
  fond: { fond: "#ff00ff", bord: 100, frange: 0, colles: 0, sujet: 500, part_collee: 0 },
  opaque: false,
  main: null,
  visees: [null],
  recadrage: {
    origine: [1024, 1024],
    sujet: [256, 256, 768, 768],
    tracee: null,
    obtenue: [248, 248, 776, 776],
    jete: 0.75,
    bords: [],
    coupe: {},
    // **La case avale la marge** : c'est le serveur qui le dit, jamais l'écran.
    marge_sans_effet: true,
  },
}

/** Ce que promet `/imposed` (US-164) quand personne ne le surcharge :
 *  une image seule, dans la famille « personnages » — de quoi voir les deux
 *  portées de la promotion sans que chaque essai les redéclare. */
const IMPOSE_PAR_DEFAUT = {
  impose: null,
  echelle: "",
  nature: "image",
  detourage: {
    passe: {
      moteur: "bord",
      tolerance: 20,
      seuil_alpha: 128,
      durcissement: 0,
      point: null,
      portee: "tache",
      masquee: false,
      trace: [],
      modele: "",
    },
    origine: "produit",
    famille: "personnages",
  },
}

/** Les recettes nommées du double, **hors de `construireDouble`** : elles
 *  vivent sur le disque de l'atelier, pas dans l'écran, et un essai qui
 *  démonte puis remonte l'écran (« nommer, changer d'écran, réappliquer »)
 *  doit les retrouver — exactement ce qu'un second `construireDouble` par
 *  montage ne permettrait pas. Vidée à chaque essai par `beforeEach`. */
let nommeesDouble: Record<string, Recette> = {}

function construireDouble(
  mesures: unknown = MESURES,
  impose: unknown = IMPOSE_PAR_DEFAUT,
) {
  const appels: { url: string; methode: string; corps: unknown }[] = []
  const rendre = (charge: unknown) =>
    ({
      ok: true,
      status: 200,
      json: async () => charge,
    }) as Response
  const fetchDouble = vi.fn(async (entree: unknown, options?: RequestInit) => {
    const url = String(entree)
    const methode = options?.method ?? "GET"
    const corps = options?.body ? JSON.parse(String(options.body)) : null
    appels.push({ url, methode, corps })

    if (url.includes("/spots")) return rendre(mesures)
    if (url.includes("/imposed")) return rendre(impose)
    // **`EcranSuperposition` s'ouvre ici, en plein cadre** (`B24`) : ce que
    // `/overlay` répond n'est pas le sujet de cet essai — `Superposition.tsx`
    // sait déjà se comporter sans réponse (« un serveur plus vieux que
    // l'écran répond sans se plaindre »). Un objet vide, sans `pose`, y
    // suffit ; le double par défaut plus bas a un champ `pose` qui n'a rien à
    // voir (celui d'un personnage) et ferait planter le calage.
    if (url.includes("/overlay")) return rendre({})

    if (url.endsWith("/recipes") && methode === "GET")
      return rendre({ recettes: { ...nommeesDouble } })

    if (url.includes("/recipes/") && methode === "PUT") {
      const nom = decodeURIComponent(url.split("/recipes/")[1])
      nommeesDouble[nom] = corps as Recette
      return rendre({ recettes: { ...nommeesDouble }, laisse: [] })
    }
    if (url.includes("/recipes/") && methode === "DELETE") {
      const nom = decodeURIComponent(url.split("/recipes/")[1])
      delete nommeesDouble[nom]
      return rendre({ recettes: { ...nommeesDouble } })
    }

    if (url.includes("/paste")) {
      // **Une coordonnée ne voyage pas** — ce que la vraie route coupe et
      // annonce. Le double ne rejoue pas toute la règle du domaine
      // (`tests/test_u5.py` s'en charge), il en simule la seule part que
      // cet écran répète : couper le cadre tracé, et le nommer.
      const recette = corps as Recette
      const recadrage = recette.recadrage
      const boite = recadrage?.boite ?? null
      return rendre({
        asset: image({
          recette:
            boite && recadrage
              ? ({ ...recette, recadrage: { ...recadrage, boite: null } } as Recette)
              : recette,
        }),
        laisse: boite ? ["un cadre tracé, qui désignait un endroit de l'autre image"] : [],
      })
    }

    if (url.includes("/apply/")) {
      const nom = decodeURIComponent(url.split("/apply/")[1])
      return rendre({
        asset: image({ recette: nommeesDouble[nom] ?? recetteDeTravail() }),
        laisse: [],
      })
    }

    if (url.includes("/universe") && methode === "PUT")
      return rendre({
        projet: "le-marais",
        univers: { ...univers(), ...(corps as object) },
        atelier: {},
        fond_propose: { couleur: "", distance: 0 },
      })

    return rendre(image({ recette: recetteDeTravail() }))
  })
  return { fetchDouble, appels }
}

/** Une fabrique de découpe minimale, montée telle quelle par `Retouche` :
 *  ce que fait *vraiment* `EcranDecoupe` est mesuré ailleurs, ici on mesure
 *  seulement que `Retouche` la reçoit et sait la refermer. */
const DECOUPE_STUB = (fermerLaFabrique: () => void) => (
  <div data-decoupe-stub>
    <p>la fabrique de découpe</p>
    <button type="button" onClick={fermerLaFabrique}>
      fermer la fabrique
    </button>
  </div>
)

function monter(
  surplus: {
    asset?: Asset
    mesures?: unknown
    univers?: Univers
    impose?: unknown
    soeurs?: Asset[]
    decoupe?: (fermer: () => void) => ReactNode
  } = {},
) {
  const { fetchDouble, appels } = construireDouble(
    surplus.mesures ?? MESURES,
    surplus.impose ?? IMPOSE_PAR_DEFAUT,
  )
  vi.stubGlobal("fetch", fetchDouble)
  const onFermer = vi.fn()
  const onSoeur = vi.fn()
  const onErreur = vi.fn()
  const onUnivers = vi.fn()
  const rendu = render(
    <Retouche
      asset={surplus.asset ?? image({ recette: recetteDeTravail() })}
      soeurs={surplus.soeurs ?? []}
      univers={surplus.univers ?? univers()}
      traitement={TRAITEMENT}
      onFermer={onFermer}
      onSoeur={onSoeur}
      decoupe={surplus.decoupe ?? DECOUPE_STUB}
      onErreur={onErreur}
      onUnivers={onUnivers}
    />,
  )
  const reouvrir = (nouveau: { asset: Asset; soeurs?: Asset[] }) =>
    rendu.rerender(
      <Retouche
        asset={nouveau.asset}
        soeurs={nouveau.soeurs ?? surplus.soeurs ?? []}
        univers={surplus.univers ?? univers()}
        traitement={TRAITEMENT}
        onFermer={onFermer}
        onSoeur={onSoeur}
        decoupe={surplus.decoupe ?? DECOUPE_STUB}
        onErreur={onErreur}
        onUnivers={onUnivers}
      />,
    )
  return { onFermer, onSoeur, onErreur, onUnivers, appels, reouvrir }
}

const barre = () => document.querySelector("[data-barre-des-tables]") as HTMLElement
const colonne = () =>
  document.querySelector("[data-reglages-de-la-table]") as HTMLElement
const soeursColonne = () => document.querySelector("[data-ses-soeurs]") as HTMLElement
const scene = () => document.querySelector("[data-scene-de-retouche]") as HTMLElement

// ── Les essais ──────────────────────────────────────────────────────────────

describe("la barre : huit tables, un trait, deux fabriques", () => {
  test("les dix sont à l'écran, dans l'ordre du domaine, et aucune n'est cachée", () => {
    monter()
    const puces = Array.from(barre().querySelectorAll("[data-table]")).map((b) =>
      b.getAttribute("data-table"),
    )
    // **L'ordre est celui du traitement**, et il ne se change pas : le lire
    // autrement mentirait sur ce que l'image a subi.
    expect(puces).toEqual([
      "detourage",
      "recadrage",
      "grille",
      "quantification",
      "bords",
      "contours",
      "retournement",
      "main",
      "decoupage",
      "superposition",
    ])
  })

  test("le vocabulaire est celui des planches, pas celui du code", () => {
    monter()
    // `grille` se lit *Pixéliser*, `quantification` se lit *Couleurs*, `bords`
    // se lit *Nettoyer* — la planche nomme le geste, le code nomme la place.
    for (const nom of [
      "Détourer",
      "Recadrer",
      "Pixéliser",
      "Couleurs",
      "Nettoyer",
      "Le contour",
      "Retourner",
      "La main",
      "Découper",
      "Superposer",
    ])
      expect(within(barre()).getByRole("button", { name: nom })).toBeTruthy()
  })

  test("un trait sépare les tables des deux fabriques, et il est unique", () => {
    monter()
    const traits = barre().querySelectorAll("[data-trait-des-fabriques]")
    expect(traits.length).toBe(1)
    // **À droite du trait**, et rien d'autre : les deux fabriques écrivent
    // d'autres fichiers et ne posent rien sur cette image-ci.
    const puces = Array.from(barre().querySelectorAll("[data-table]"))
    const rangDuTrait = Array.from(barre().children).findIndex((n) =>
      n.querySelector("[data-trait-des-fabriques]"),
    )
    expect(puces.length).toBe(10)
    expect(rangDuTrait).toBe(8)
  })

  test("chaque table dit son état par une pastille, et les fabriques n'en portent pas", () => {
    monter()
    const detourage = barre().querySelector('[data-table="detourage"]') as HTMLElement
    expect(detourage.getAttribute("data-etat")).toBe("posee")
    // **Les fabriques ne s'endorment pas** : elles n'ont rien à éteindre ici.
    expect(
      (barre().querySelector('[data-table="decoupage"]') as HTMLElement).querySelector(
        "[data-pastille]",
      ),
    ).toBeNull()
  })

  test("une place vide se distingue d'une place posée", () => {
    monter()
    // Le contour n'est pas dans la recette de travail : rien de posé.
    const contour = barre().querySelector('[data-table="contours"]') as HTMLElement
    expect(contour.getAttribute("data-etat")).toBe("vide")
  })
})

describe("le grisé porte sa raison, et le geste qui le rallume", () => {
  test("la marge est éteinte quand la case l'avale, et dit où aller", async () => {
    monter()
    fireEvent.click(within(barre()).getByRole("button", { name: "Recadrer" }))

    const marge = await screen.findByLabelText("marge du recadrage")
    // ⚠️ **Éteinte pour de bon** : c'est la moitié de la règle que le code ne
    // tenait pas — la phrase était là, le curseur restait actif.
    expect((marge as HTMLInputElement).disabled).toBe(true)
    expect(
      within(colonne()).getByText(/la case avale la marge/i),
    ).toBeTruthy()
    // Et le geste qui la remplace est un vrai bouton, pas une phrase.
    expect(
      within(colonne()).getByRole("button", { name: /Pixéliser/ }),
    ).toBeTruthy()
  })

  test("sans case, la marge se règle normalement et ne porte aucune raison", async () => {
    const sansCase = {
      ...MESURES,
      recadrage: { ...MESURES.recadrage, marge_sans_effet: false },
    }
    monter({ mesures: sansCase })
    fireEvent.click(within(barre()).getByRole("button", { name: "Recadrer" }))

    const marge = await screen.findByLabelText("marge du recadrage")
    expect((marge as HTMLInputElement).disabled).toBe(false)
    expect(within(colonne()).queryByText(/la case avale la marge/i)).toBeNull()
  })

  test("une table indisponible s'ouvre quand même et porte sa raison à la place de ses réglages", async () => {
    // Une image entièrement opaque — une tuile de terrain qui remplit son
    // carré. Le critère est la mesure, jamais la famille.
    monter({ mesures: { ...MESURES, opaque: true } })
    fireEvent.click(within(barre()).getByRole("button", { name: "Le contour" }))

    expect(
      await within(colonne()).findByText(/entièrement opaque/i),
    ).toBeTruthy()
    // Elle s'ouvre, et ses réglages ne sont pas là : la raison les remplace.
    expect(screen.queryByLabelText("épaisseur du contour")).toBeNull()
    // Et la pastille dit « rien à faire ici », pas « endormie ».
    expect(
      (barre().querySelector('[data-table="contours"]') as HTMLElement).getAttribute(
        "data-etat",
      ),
    ).toBe("rien")
  })

  test("un moteur que la machine n'a pas est montré grisé, jamais retiré", async () => {
    monter()
    fireEvent.click(within(barre()).getByRole("button", { name: "Détourer" }))
    const modele = await within(colonne()).findByRole("button", { name: "modèle" })
    expect((modele as HTMLButtonElement).disabled).toBe(true)
    // **Montré, pas caché** : c'est ce qui dit ce que l'atelier saurait faire.
    expect(modele).toBeTruthy()
  })

  test("aucun cran éteint ne cache sa raison dans une infobulle", async () => {
    // ⚠️ Trouvé au navigateur, pas par un essai : « une boîte tracée » était
    // bien grisé, mais sa raison ne sortait qu'au survol. Une infobulle ne
    // s'imprime pas, ne se lit pas au clavier, n'existe pas au doigt —
    // `docs/DESIGN.md` règle 2 l'interdit. L'essai passe les huit tables.
    monter()
    for (const nom of [
      "Détourer",
      "Recadrer",
      "Pixéliser",
      "Couleurs",
      "Nettoyer",
      "Le contour",
      "Retourner",
      "La main",
    ]) {
      fireEvent.click(within(barre()).getByRole("button", { name: nom }))
      const col = colonne()
      await waitFor(() => expect(col.textContent).toBeTruthy())
      for (const b of col.querySelectorAll("button[disabled]")) {
        const raison = b.getAttribute("title")
        if (!raison) continue
        // Si une raison est écrite dans un `title`, elle doit aussi se lire.
        expect(col.textContent ?? "").toContain(raison)
      }
    }
  })

  test("les dix sens du retournement sont tous cliquables depuis B18", async () => {
    // **Neuf d'entre eux disaient encore « n'existe pas encore » avant B18** —
    // c'était la table la plus creuse de la chaîne. Elle ne l'est plus : les
    // dix boutons doivent tous répondre à un clic, aucun grisé.
    monter()
    fireEvent.click(within(barre()).getByRole("button", { name: "Retourner" }))
    const col = colonne()
    await waitFor(() => expect(col.textContent).toBeTruthy())

    expect(within(col).queryByText(/n'existe pas encore/i)).toBeNull()
    for (const nom of [
      "miroir gauche-droite",
      "miroir haut-bas",
      "quart de tour à droite",
      "quart de tour à gauche",
      "demi-tour",
      "miroir sur la diagonale",
      "miroir sur soi",
      "miroir, sauf ici",
      "rotation libre, au plus proche",
      "rotation libre, méthode pixel art",
    ]) {
      const bouton = within(col).getByRole("button", { name: nom }) as HTMLButtonElement
      expect(bouton.disabled).toBe(false)
    }
  })

  test("le détourage dit que la couleur du fond se devine, sauf si une passe la vise", async () => {
    monter()
    fireEvent.click(within(barre()).getByRole("button", { name: "Détourer" }))
    expect(
      await within(colonne()).findByText(
        /sauf si elle vise la couleur déclarée du jeu/i,
      ),
    ).toBeTruthy()
  })
})

describe("le plafond : la case en pixel art, la finesse en dessin", () => {
  test("en pixel art la table propose des carrés, jusqu'à 512", async () => {
    monter()
    fireEvent.click(within(barre()).getByRole("button", { name: "Pixéliser" }))
    const col = colonne()
    await waitFor(() => expect(within(col).getByText("taille de case")).toBeTruthy())
    expect(within(col).getByRole("button", { name: "512" })).toBeTruthy()
    expect(within(col).queryByRole("button", { name: "2048" })).toBeNull()
  })

  test("en dessin elle propose des finesses, jusqu'à 2048", async () => {
    // ⚠️ La moitié visible de la contradiction du plafond : la route refusait
    // 1024, et la table n'avait de toute façon aucun cran pour le demander.
    monter({ univers: univers({ style: "dessin", cible_px: 1024 }) })
    fireEvent.click(within(barre()).getByRole("button", { name: "Pixéliser" }))
    const col = colonne()
    await waitFor(() => expect(within(col).getByText("finesse")).toBeTruthy())
    expect(within(col).getByRole("button", { name: "1024" })).toBeTruthy()
    expect(within(col).getByRole("button", { name: "2048" })).toBeTruthy()
    // Et les carrés du pixel art ne traînent pas là : 8 n'a aucun sens pour un
    // dessin, pas plus que 2048 n'en a pour du pixel art.
    expect(within(col).queryByRole("button", { name: "8" })).toBeNull()
  })

  test("poser 2048 en dessin envoie bien 2048, sans rabot", async () => {
    const { appels } = monter({
      univers: univers({ style: "dessin", cible_px: 1024 }),
    })
    fireEvent.click(within(barre()).getByRole("button", { name: "Pixéliser" }))
    const col = colonne()
    await waitFor(() => expect(within(col).getByText("finesse")).toBeTruthy())
    await act(async () => {
      fireEvent.click(within(col).getByRole("button", { name: "2048" }))
    })
    const pose = appels.filter((a) => a.methode === "PUT" && a.url.includes("/recipe")).at(-1)
    expect((pose?.corps as { grille: { cible: number } }).grille.cible).toBe(2048)
  })
})

describe("le grossissement libre entre 1 et 250 % (B24, déménagé de Tables.tsx)", () => {
  /** `jsdom` ne met rien en page : on lui souffle la taille du cadre, sinon
   *  toute mesure vaut zéro et l'écran ne peut rien en conclure. */
  function cadreDe(cote: number) {
    const largeur = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "clientWidth")
    const hauteur = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "clientHeight")
    for (const nom of ["clientWidth", "clientHeight"]) {
      Object.defineProperty(HTMLElement.prototype, nom, {
        configurable: true,
        get() {
          return (this as HTMLElement).hasAttribute("data-scene-de-retouche") ? cote : 0
        },
      })
    }
    return () => {
      if (largeur) Object.defineProperty(HTMLElement.prototype, "clientWidth", largeur)
      if (hauteur) Object.defineProperty(HTMLElement.prototype, "clientHeight", hauteur)
    }
  }

  test("une image de 2 048 px se voit entière, et le pour cent affiché est le pour cent appliqué", async () => {
    // ⚠️ **Le défaut que le navigateur avait trouvé en B16** : l'écran
    // affichait ×4 pendant que le cadre réduisait une image de 2 048 px au
    // cinquième. Le pour cent libre descend sous cent au lieu de se rabattre
    // sur une phrase — il n'y a donc plus jamais d'« impossible ».
    const rendre = cadreDe(500)
    try {
      monter({
        asset: image({
          largeur: 2048,
          hauteur: 2048,
          rendu_largeur: 2048,
          rendu_hauteur: 2048,
          recette: recetteDeTravail(),
        }),
      })
      await waitFor(() => {
        const champ = document.querySelector(
          '[data-zoom] input[aria-label="Pour cent d\'agrandissement"]',
        ) as HTMLInputElement | null
        expect(champ).toBeTruthy()
        expect(Number(champ!.value)).toBeGreaterThan(0)
        expect(Number(champ!.value)).toBeLessThan(100)
      })
      // **La rangée existe toujours** — plus de branche « ça ne tient pas ».
      expect(document.querySelector("[data-zoom]")).toBeTruthy()
    } finally {
      rendre()
    }
  })

  test("une vignette de 64 px s'ajuste à 100 % quand le cadre le lui donne pile", async () => {
    // 108 - 44 (la marge intérieure) = 64 : le cadre offre exactement la
    // taille de l'image, et l'ajusté doit tomber pile sur 100.
    const rendre = cadreDe(108)
    try {
      monter({
        asset: image({
          largeur: 64,
          hauteur: 64,
          rendu_largeur: 64,
          rendu_hauteur: 64,
          recette: recetteDeTravail(),
        }),
      })
      await waitFor(() => {
        const champ = document.querySelector(
          '[data-zoom] input[aria-label="Pour cent d\'agrandissement"]',
        ) as HTMLInputElement
        expect(champ.value).toBe("100")
      })
    } finally {
      rendre()
    }
  })

  test("le champ s'écrit à la main, et se pose à l'entrée", async () => {
    const rendre = cadreDe(108)
    try {
      monter({
        asset: image({
          largeur: 64,
          hauteur: 64,
          rendu_largeur: 64,
          rendu_hauteur: 64,
          recette: recetteDeTravail(),
        }),
      })
      const champ = await waitFor(() => {
        const c = document.querySelector(
          '[data-zoom] input[aria-label="Pour cent d\'agrandissement"]',
        ) as HTMLInputElement
        expect(c.value).toBe("100")
        return c
      })
      fireEvent.change(champ, { target: { value: "175" } })
      fireEvent.keyDown(champ, { key: "Enter" })
      expect((champ as HTMLInputElement).value).toBe("175")
    } finally {
      rendre()
    }
  })

  test("hors bornes, le champ ramène plutôt que de refuser", async () => {
    const rendre = cadreDe(600)
    try {
      monter({
        asset: image({ largeur: 64, hauteur: 64, recette: recetteDeTravail() }),
      })
      const champ = await waitFor(() => {
        const c = document.querySelector(
          '[data-zoom] input[aria-label="Pour cent d\'agrandissement"]',
        ) as HTMLInputElement
        expect(c).toBeTruthy()
        return c
      })
      fireEvent.change(champ, { target: { value: "9000" } })
      fireEvent.keyDown(champ, { key: "Enter" })
      expect(champ.value).toBe("250")
    } finally {
      rendre()
    }
  })

  test("*plus* et *moins* avancent d'un arrêt de l'échelle, jamais d'un pas fixe", async () => {
    const rendre = cadreDe(108)
    try {
      monter({
        asset: image({ largeur: 64, hauteur: 64, recette: recetteDeTravail() }),
      })
      const zoom = await waitFor(() => {
        const z = document.querySelector("[data-zoom]") as HTMLElement
        expect(z).toBeTruthy()
        return z
      })
      fireEvent.click(within(zoom).getByRole("button", { name: "Approcher" }))
      const champ = within(zoom).getByLabelText("Pour cent d'agrandissement") as HTMLInputElement
      // 100 est un arrêt de `ARRETS_ZOOM` ; le suivant est 125.
      expect(champ.value).toBe("125")
    } finally {
      rendre()
    }
  })

  test("100 % et ajusté restent deux boutons à part, atteignables d'un clic", async () => {
    const rendre = cadreDe(500)
    try {
      monter({
        asset: image({
          largeur: 2048,
          hauteur: 2048,
          rendu_largeur: 2048,
          rendu_hauteur: 2048,
          recette: recetteDeTravail(),
        }),
      })
      const zoom = await waitFor(() => {
        const z = document.querySelector("[data-zoom]") as HTMLElement
        expect(z).toBeTruthy()
        return z
      })
      fireEvent.click(within(zoom).getByRole("button", { name: "100 %" }))
      expect(
        (within(zoom).getByLabelText("Pour cent d'agrandissement") as HTMLInputElement).value,
      ).toBe("100")
      fireEvent.click(within(zoom).getByRole("button", { name: "ajusté" }))
      expect(
        Number(
          (within(zoom).getByLabelText("Pour cent d'agrandissement") as HTMLInputElement).value,
        ),
      ).toBeLessThan(100)
    } finally {
      rendre()
    }
  })
})

describe("« sur » et « témoin » — deux questions, deux contrôles (B24, déménagé de Comparateur)", () => {
  test("le repos est « rendu » et « aucun », et rien ne se redit en trop", () => {
    monter()
    const travail = document.querySelector("[data-travail]") as HTMLElement
    const temoin = document.querySelector("[data-temoin]") as HTMLElement
    expect(within(travail).getByRole("button", { name: "Rendu" }).getAttribute("aria-pressed")).toBe(
      "true",
    )
    expect(within(temoin).getByRole("button", { name: "Aucun" }).getAttribute("aria-pressed")).toBe(
      "true",
    )
    expect(scene().querySelectorAll("img").length).toBe(1)
  })

  test("« à côté » montre deux images, « par-dessus » une seule avec un calque et son opacité", () => {
    monter()
    const temoin = document.querySelector("[data-temoin]") as HTMLElement

    fireEvent.click(within(temoin).getByRole("button", { name: "À côté" }))
    expect(scene().querySelectorAll("img").length).toBe(2)

    fireEvent.click(within(temoin).getByRole("button", { name: "Par-dessus" }))
    expect(scene().querySelectorAll("img").length).toBe(2)
    expect(within(temoin).getByLabelText("Opacité du témoin par-dessus")).toBeTruthy()

    fireEvent.click(within(temoin).getByRole("button", { name: "Aucun" }))
    expect(scene().querySelectorAll("img").length).toBe(1)
    expect(within(temoin).queryByLabelText("Opacité du témoin par-dessus")).toBeNull()
  })

  test("passer sur « brut » se redit en ambre sous l'image, et ce jusqu'à revenir sur « rendu »", () => {
    monter()
    const travail = document.querySelector("[data-travail]") as HTMLElement
    expect(screen.queryByText(/on travaille sur le brut/i)).toBeNull()

    fireEvent.click(within(travail).getByRole("button", { name: "Brut" }))
    expect(screen.getByText(/on travaille sur le brut/i)).toBeTruthy()

    fireEvent.click(within(travail).getByRole("button", { name: "Rendu" }))
    expect(screen.queryByText(/on travaille sur le brut/i)).toBeNull()
  })

  test("changer de témoin ou de travail ne retire aucun réglage", () => {
    // **Une comparaison ne retire jamais un geste ; elle pose un témoin à
    // côté.** C'est la règle que la V2.1 a payée, et elle vaut ici aussi.
    monter()
    const temoin = document.querySelector("[data-temoin]") as HTMLElement
    fireEvent.click(within(temoin).getByRole("button", { name: "À côté" }))
    expect(within(colonne()).getByRole("button", { name: "bord" })).toBeTruthy()
  })
})

describe("la jauge", () => {
  beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true }))

  test("elle ne paraît pas sous 240 ms", async () => {
    // Une réponse qui traîne 100 ms : rien ne doit clignoter.
    const lente = vi.fn(
      (entree: unknown) =>
        new Promise<Response>((resoudre) =>
          setTimeout(
            () =>
              resoudre({
                ok: true,
                status: 200,
                json: async () =>
                  String(entree).includes("/spots")
                    ? MESURES
                    : String(entree).includes("/imposed")
                      ? IMPOSE_PAR_DEFAUT
                      : image({ recette: recetteDeTravail() }),
              } as Response),
            100,
          ),
        ),
    )
    vi.stubGlobal("fetch", lente)
    render(
      <Retouche
        asset={image({ recette: recetteDeTravail() })}
        soeurs={[]}
        univers={univers()}
        traitement={TRAITEMENT}
        onFermer={vi.fn()}
        onSoeur={vi.fn()}
        decoupe={DECOUPE_STUB}
        onErreur={vi.fn()}
      />,
    )
    fireEvent.click(within(barre()).getByRole("button", { name: "Nettoyer" }))
    const seuil = await screen.findByLabelText("tache minimale")
    fireEvent.change(seuil, { target: { value: "6" } })
    fireEvent.pointerUp(seuil)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(90)
    })
    expect(document.querySelector("[data-jauge-de-retouche]")).toBeNull()
  })

  test("elle paraît au-delà de 240 ms, et sans jamais écrire un pourcentage", async () => {
    const lente = vi.fn(
      (entree: unknown) =>
        new Promise<Response>((resoudre) =>
          setTimeout(
            () =>
              resoudre({
                ok: true,
                status: 200,
                json: async () =>
                  String(entree).includes("/spots")
                    ? MESURES
                    : String(entree).includes("/imposed")
                      ? IMPOSE_PAR_DEFAUT
                      : image({ recette: recetteDeTravail() }),
              } as Response),
            2000,
          ),
        ),
    )
    vi.stubGlobal("fetch", lente)
    render(
      <Retouche
        asset={image({ recette: recetteDeTravail() })}
        soeurs={[]}
        univers={univers()}
        traitement={TRAITEMENT}
        onFermer={vi.fn()}
        onSoeur={vi.fn()}
        decoupe={DECOUPE_STUB}
        onErreur={vi.fn()}
      />,
    )
    fireEvent.click(within(barre()).getByRole("button", { name: "Nettoyer" }))
    const seuil = await screen.findByLabelText("tache minimale")
    fireEvent.change(seuil, { target: { value: "6" } })
    fireEvent.pointerUp(seuil)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(600)
    })
    const jauge = document.querySelector("[data-jauge-de-retouche]") as HTMLElement
    expect(jauge).toBeTruthy()
    // **Jamais un pourcentage** — les onze pièces disent *le temps qui reste*.
    expect(jauge.textContent).not.toMatch(/%/)
    expect(jauge.textContent).toMatch(/on rejoue la chaîne/i)
  })
})

describe("une place s'éteint sans se vider", () => {
  test("l'interrupteur envoie la veille et ne touche à aucune valeur", async () => {
    const { appels } = monter()
    fireEvent.click(within(barre()).getByRole("button", { name: "Recadrer" }))
    fireEvent.click(await within(colonne()).findByRole("button", { name: "L'endormir" }))

    const pose = appels.filter((a) => a.methode === "PUT" && a.url.includes("/recipe")).at(-1)
    const corps = pose?.corps as Recette
    expect(corps.veille).toEqual(["recadrage"])
    // ⚠️ **La place est là, entière** : c'est toute la différence avec la vider.
    expect(corps.recadrage).toEqual({ marge: 8, boite: null })
  })

  test("une table endormie dit que ses réglages sont gardés", async () => {
    monter({
      asset: image({
        recette: recetteDeTravail({ veille: ["recadrage"] } as Partial<Recette>),
      }),
    })
    fireEvent.click(within(barre()).getByRole("button", { name: "Recadrer" }))
    expect(
      await within(colonne()).findByText(/ses réglages sont gardés/i),
    ).toBeTruthy()
    expect(
      (barre().querySelector('[data-table="recadrage"]') as HTMLElement).getAttribute(
        "data-etat",
      ),
    ).toBe("endormie")
  })
})

describe("une coordonnée ne voyage pas, et l'écran le dit", () => {
  test("la pipette annonce que son point vit sur cette image-là", async () => {
    monter({
      asset: image({
        recette: recetteDeTravail({
          passes: [
            {
              moteur: "couleur",
              tolerance: 28,
              seuil_alpha: 128,
              durcissement: 1,
              point: [12, 34],
              portee: "tache",
              masquee: false,
              trace: [],
              modele: "",
            },
          ],
        } as Partial<Recette>),
      }),
    })
    expect(
      await within(colonne()).findByText(/il ne voyage pas/i),
    ).toBeTruthy()
    expect(within(colonne()).getByText(/12, 34/)).toBeTruthy()
  })

  test("la main dit que le pinceau se pose sur l'image", () => {
    monter()
    fireEvent.click(within(barre()).getByRole("button", { name: "La main" }))
    expect(
      within(colonne()).getByText(/un passage de la main ne voyage pas/i),
    ).toBeTruthy()
  })
})

describe("les deux fabriques s'ouvrent dans le cadre, sans repasser par l'ancien écran (B24)", () => {
  test("« Découper » monte la fabrique reçue, en plein cadre — plus de réglages, plus de sœurs", async () => {
    const { onFermer } = monter({ soeurs: [image({ identifiant: "img-2" })] })

    // Avant : les trois colonnes sont là.
    expect(colonne()).toBeTruthy()
    expect(soeursColonne()).toBeTruthy()

    fireEvent.click(within(barre()).getByRole("button", { name: "Découper" }))

    expect(await screen.findByText("la fabrique de découpe")).toBeTruthy()
    // **Elle ne pose rien sur l'image ouverte** : la colonne des réglages et
    // celle des sœurs disparaissent avec elle, exactement comme `Tables.tsx`.
    expect(document.querySelector("[data-reglages-de-la-table]")).toBeNull()
    expect(document.querySelector("[data-ses-soeurs]")).toBeNull()
    // Et `Retouche` elle-même ne s'est pas refermée.
    expect(onFermer).not.toHaveBeenCalled()
  })

  test("fermer la fabrique de découpe revient sur la première table, sans quitter la retouche", async () => {
    const { onFermer } = monter()
    fireEvent.click(within(barre()).getByRole("button", { name: "Découper" }))
    fireEvent.click(await screen.findByRole("button", { name: "fermer la fabrique" }))

    expect(await screen.findByRole("button", { name: "Recadrer" })).toBeTruthy()
    expect(colonne()).toBeTruthy()
    expect(onFermer).not.toHaveBeenCalled()
  })

  test("« Superposer » monte l'écran de la superposition, atteignable comme la découpe", async () => {
    monter()
    fireEvent.click(within(barre()).getByRole("button", { name: "Superposer" }))
    expect(await screen.findByText("les deux images")).toBeTruthy()
    expect(document.querySelector("[data-reglages-de-la-table]")).toBeNull()
  })

  test("les deux fabriques restent sélectionnées dans la barre pendant qu'elles sont ouvertes", async () => {
    monter()
    const decouper = within(barre()).getByRole("button", { name: "Découper" })
    fireEvent.click(decouper)
    await screen.findByText("la fabrique de découpe")
    expect(decouper.getAttribute("aria-pressed")).toBe("true")
  })
})

describe("on n'annule pas un calcul", () => {
  test("l'écran le dit, et n'offre aucun bouton qui aurait l'air de le faire", () => {
    monter()
    expect(
      within(colonne()).getByText(/un calcul ne s'interrompt pas/i),
    ).toBeTruthy()
    expect(within(colonne()).queryByRole("button", { name: /Annuler/i })).toBeNull()
  })
})

describe("le nettoyage part de zéro", () => {
  test("sans place posée, le seuil affiché est zéro et rien n'est annoncé effacé", async () => {
    monter()
    fireEvent.click(within(barre()).getByRole("button", { name: "Nettoyer" }))
    const seuil = (await screen.findByLabelText("tache minimale")) as HTMLInputElement
    // ⚠️ **Zéro, pas trois.** L'écran affichait 3 px et annonçait des taches
    // effacées alors que rien n'était posé et que l'image n'avait pas bougé.
    expect(seuil.value).toBe("0")
    expect(within(colonne()).getByText(/zéro n'efface rien/i)).toBeTruthy()
  })
})

describe("la colonne des sœurs (B24, déménagée de Tables.tsx)", () => {
  test("elle liste les sœurs reçues, et marque la sœur courante", () => {
    monter({
      soeurs: [
        image({ identifiant: "img-1", label: "le pèlerin, au repos" }),
        image({ identifiant: "img-2", label: "le pèlerin, en marche" }),
      ],
    })
    const boutons = within(soeursColonne()).getAllByRole("button")
    expect(boutons.length).toBe(2)
    expect(
      within(soeursColonne())
        .getByTitle("le pèlerin, au repos")
        .getAttribute("aria-pressed"),
    ).toBe("true")
    expect(
      within(soeursColonne())
        .getByTitle("le pèlerin, en marche")
        .getAttribute("aria-pressed"),
    ).toBe("false")
  })

  test("sans voisine, elle le dit plutôt que de rester vide sans un mot", () => {
    monter({ soeurs: [] })
    expect(within(soeursColonne()).getByText(/n'a pas de voisine/i)).toBeTruthy()
  })

  test("choisir une sœur appelle le geste du parent, avec son identifiant", async () => {
    const { onSoeur } = monter({
      soeurs: [
        image({ identifiant: "img-1", label: "le pèlerin, au repos" }),
        image({ identifiant: "img-2", label: "le pèlerin, en marche" }),
      ],
    })
    fireEvent.click(within(barre()).getByRole("button", { name: "Recadrer" }))
    await screen.findByLabelText("marge du recadrage")

    fireEvent.click(within(soeursColonne()).getByTitle("le pèlerin, en marche"))
    expect(onSoeur).toHaveBeenCalledWith("img-2")
  })

  test("passer d'une sœur à l'autre ne referme pas la table ouverte", async () => {
    // **Le critère de la tranche.** `Tables.tsx`/`App.tsx` lèvent `ouverte`
    // hors de l'écran, et aucune ouverture d'image ne le réinitialise seule ;
    // ce test rejoue le même geste ici, en simulant ce que fait `onSoeur` —
    // rendre l'écran avec la sœur suivante en `asset`.
    const soeurs = [
      image({ identifiant: "img-1", label: "le pèlerin, au repos" }),
      image({ identifiant: "img-2", label: "le pèlerin, en marche" }),
    ]
    const { reouvrir } = monter({ asset: soeurs[0], soeurs })
    fireEvent.click(within(barre()).getByRole("button", { name: "Recadrer" }))
    await screen.findByLabelText("marge du recadrage")

    reouvrir({ asset: soeurs[1], soeurs })

    expect(within(barre()).getByRole("button", { name: "Recadrer" }).getAttribute("aria-pressed")).toBe(
      "true",
    )
    expect(screen.getByLabelText("marge du recadrage")).toBeTruthy()
  })

  test("la barre des sœurs se rafraîchit sur l'image affichée", () => {
    const soeurs = [
      image({ identifiant: "img-1", label: "le pèlerin, au repos" }),
      image({ identifiant: "img-2", label: "le pèlerin, en marche" }),
    ]
    const { reouvrir } = monter({ asset: soeurs[0], soeurs })
    expect(
      within(soeursColonne())
        .getByTitle("le pèlerin, au repos")
        .getAttribute("aria-pressed"),
    ).toBe("true")

    // **Le parent décide de la sœur suivante** — ici en rendant l'écran avec
    // `asset` changé, exactement ce que fait `onSoeur` dans `App.tsx` — et la
    // barre se rafraîchit dessus, sans qu'on la rouvre.
    reouvrir({ asset: soeurs[1], soeurs })
    expect(
      within(soeursColonne())
        .getByTitle("le pèlerin, au repos")
        .getAttribute("aria-pressed"),
    ).toBe("false")
    expect(
      within(soeursColonne())
        .getByTitle("le pèlerin, en marche")
        .getAttribute("aria-pressed"),
    ).toBe("true")
  })

  test("la fabrique de superposition reçoit les mêmes sœurs, pour choisir le dessous", async () => {
    monter({
      soeurs: [
        image({ identifiant: "img-1" }),
        image({ identifiant: "img-2", label: "le pèlerin, en marche" }),
      ],
    })
    fireEvent.click(within(barre()).getByRole("button", { name: "Superposer" }))
    expect(await screen.findByText("les deux images")).toBeTruthy()
  })
})

describe("le presse-papiers et les recettes nommées (B24, U5 déménagé de Tables.tsx)", () => {
  const ouvrirLePanneau = () => {
    fireEvent.click(screen.getByRole("button", { name: /Recettes/ }))
    return within(document.querySelector("[data-recettes]") as HTMLElement)
  }

  test("tant que rien n'est copié, coller est inactif et dit pourquoi", () => {
    monter()
    const panneau = ouvrirLePanneau()
    const coller = panneau.getByRole("button", { name: "Coller" }) as HTMLButtonElement
    expect(coller.disabled).toBe(true)
    expect(panneau.getByText(/rien de copié/i)).toBeTruthy()
  })

  test("copier ici, coller là — la recette entière est envoyée", async () => {
    const soeurs = [
      image({ identifiant: "img-1", recette: recetteDeTravail() }),
      image({ identifiant: "img-2", recette: RECETTE_VIDE }),
    ]
    const { appels, reouvrir } = monter({ asset: soeurs[0], soeurs })
    let panneau = ouvrirLePanneau()
    fireEvent.click(panneau.getByRole("button", { name: "Copier les réglages" }))
    await waitFor(() =>
      expect(
        (panneau.getByRole("button", { name: "Coller" }) as HTMLButtonElement).disabled,
      ).toBe(false),
    )

    // On change d'image — la sœur d'à côté — et le presse-papiers survit,
    // parce qu'il vit hors de React (`Tables.tsx`).
    fireEvent.click(screen.getByRole("button", { name: "Recettes ›" }))
    reouvrir({ asset: soeurs[1], soeurs })

    panneau = ouvrirLePanneau()
    fireEvent.click(panneau.getByRole("button", { name: "Coller" }))

    const collage = await waitFor(() => {
      const trouve = appels.filter((a) => a.url.includes("/paste")).pop()
      if (!trouve) throw new Error("rien n'a été collé")
      return trouve
    })
    // **L'écran envoie ce qu'il a sous les yeux, entier.**
    expect((collage.corps as Recette).passes[0].tolerance).toBe(28)
    expect(collage.url).toContain("img-2")
  })

  test("un collage annonce ce qui n'a pas voyagé", async () => {
    monter({
      asset: image({
        identifiant: "img-1",
        recette: recetteDeTravail({ recadrage: { marge: 0, boite: [4, 4, 20, 20] } }),
      }),
    })
    let panneau = ouvrirLePanneau()
    fireEvent.click(panneau.getByRole("button", { name: "Copier les réglages" }))
    fireEvent.click(screen.getByRole("button", { name: "Recettes ›" }))

    panneau = ouvrirLePanneau()
    fireEvent.click(panneau.getByRole("button", { name: "Coller" }))

    const annonce = await waitFor(() => {
      const trouve = document.querySelector("[data-recettes-annonce]")
      if (!trouve) throw new Error("le collage n'a rien annoncé")
      return trouve as HTMLElement
    })
    expect(annonce.textContent).toContain("un endroit de l'autre image")
  })

  test("nommer une recette, changer d'écran, et la réappliquer plus tard", async () => {
    const premier = monter()
    let panneau = ouvrirLePanneau()
    const nom = panneau.getByLabelText("le nom de la recette")
    fireEvent.change(nom, { target: { value: "silhouette de base" } })
    fireEvent.click(panneau.getByRole("button", { name: "Enregistrer" }))
    await waitFor(() =>
      expect(panneau.getByText("silhouette de base")).toBeTruthy(),
    )

    // **Le changement d'écran** : on démonte tout, comme un aller-retour vers
    // une autre partie du carnet le ferait vraiment.
    cleanup()
    monter()
    panneau = ouvrirLePanneau()
    const appliquer = await waitFor(() => {
      const b = panneau.queryByRole("button", { name: "appliquer" })
      if (!b) throw new Error("la recette n'a pas survécu au changement d'écran")
      return b
    })
    fireEvent.click(appliquer)
    await waitFor(() => expect(panneau.queryByText(/c'est posé/i)).toBeTruthy())
    void premier
  })

  test("le presse-papiers ne survit pas au rechargement de la page — c'est le contrat", () => {
    // Un rechargement démonte tout et ne rappelle jamais `reinitialiserPressePapier`
    // de lui-même : c'est bien parce que `copiee` est un module réimporté à
    // zéro par le navigateur, pas une garantie que cet essai mesure — il
    // documente le contrat, il ne le prouve pas artificiellement.
    monter()
    const panneau = ouvrirLePanneau()
    expect((panneau.getByRole("button", { name: "Coller" }) as HTMLButtonElement).disabled).toBe(
      true,
    )
  })

  test("la recette courante en un mot se lit au pied du panneau", () => {
    monter()
    const panneau = ouvrirLePanneau()
    expect(panneau.getByText(/Détourer/)).toBeTruthy()
  })
})

describe("promouvoir un détourage en défaut du projet (M7, déménagé en B24)", () => {
  test("le geste est proposé sous la table du détourage, jamais imposé", async () => {
    monter()
    fireEvent.click(within(barre()).getByRole("button", { name: "Détourer" }))
    expect(
      await within(colonne()).findByRole("button", {
        name: /enregistrer ce réglage comme défaut du projet/i,
      }),
    ).toBeTruthy()
  })

  test("ouvrir le geste propose deux portées, choisies — jamais devinées", async () => {
    monter()
    fireEvent.click(within(barre()).getByRole("button", { name: "Détourer" }))
    fireEvent.click(
      await within(colonne()).findByRole("button", {
        name: /enregistrer ce réglage comme défaut du projet/i,
      }),
    )
    expect(
      within(colonne()).getByRole("button", { name: /pour une image seule/i }),
    ).toBeTruthy()
    expect(
      within(colonne()).getByRole("button", { name: /pour tout ce que tu ranges dans personnages/i }),
    ).toBeTruthy()
  })

  test("sans famille, la portée par famille n'est pas proposée vide", async () => {
    monter({
      impose: {
        ...IMPOSE_PAR_DEFAUT,
        detourage: { ...IMPOSE_PAR_DEFAUT.detourage, famille: "" },
      },
    })
    fireEvent.click(within(barre()).getByRole("button", { name: "Détourer" }))
    fireEvent.click(
      await within(colonne()).findByRole("button", {
        name: /enregistrer ce réglage comme défaut du projet/i,
      }),
    )
    expect(within(colonne()).queryByRole("button", { name: /pour tout ce que/i })).toBeNull()
    expect(within(colonne()).getByText(/n'a pas de famille/i)).toBeTruthy()
  })

  test("poser la portée « nature » écrit dans l'univers, et le dit", async () => {
    const { onUnivers, appels } = monter()
    fireEvent.click(within(barre()).getByRole("button", { name: "Détourer" }))
    fireEvent.click(
      await within(colonne()).findByRole("button", {
        name: /enregistrer ce réglage comme défaut du projet/i,
      }),
    )
    await act(async () => {
      fireEvent.click(within(colonne()).getByRole("button", { name: /pour une image seule/i }))
    })
    const pose = appels.filter((a) => a.url.includes("/universe")).at(-1)
    expect((pose?.corps as { detourage_image: unknown }).detourage_image).toBeTruthy()
    expect(onUnivers).toHaveBeenCalled()
    expect(
      await within(colonne()).findByText(/partira désormais de ce détourage/i),
    ).toBeTruthy()
  })

  test("poser la portée « famille » envoie le dictionnaire entier, pas seulement la case qui change", async () => {
    const { appels } = monter({
      univers: univers({ detourages: { objets: { ...recetteDeTravail().passes[0] } } }),
    })
    fireEvent.click(within(barre()).getByRole("button", { name: "Détourer" }))
    fireEvent.click(
      await within(colonne()).findByRole("button", {
        name: /enregistrer ce réglage comme défaut du projet/i,
      }),
    )
    await act(async () => {
      fireEvent.click(
        within(colonne()).getByRole("button", { name: /pour tout ce que tu ranges dans personnages/i }),
      )
    })
    const pose = appels.filter((a) => a.url.includes("/universe")).at(-1)
    const detourages = (pose?.corps as { detourages: Record<string, unknown> }).detourages
    expect(Object.keys(detourages)).toEqual(expect.arrayContaining(["objets", "personnages"]))
  })

  test("un défaut n'a qu'une passe — le dit quand la recette en porte plusieurs", async () => {
    monter({
      asset: image({
        recette: recetteDeTravail({
          passes: [
            ...recetteDeTravail().passes,
            {
              moteur: "bord",
              tolerance: 10,
              seuil_alpha: 128,
              durcissement: 0,
              point: null,
              portee: "tache",
              masquee: false,
              trace: [],
              modele: "",
            },
          ],
        } as Partial<Recette>),
      }),
    })
    fireEvent.click(within(barre()).getByRole("button", { name: "Détourer" }))
    fireEvent.click(
      await within(colonne()).findByRole("button", {
        name: /enregistrer ce réglage comme défaut du projet/i,
      }),
    )
    expect(within(colonne()).getByText(/la passe 1 seule/i)).toBeTruthy()
  })

  test("un défaut n'a pas d'image où viser — le dit pour la pipette et le tracé", async () => {
    monter({
      asset: image({
        recette: recetteDeTravail({
          passes: [
            {
              moteur: "couleur",
              tolerance: 28,
              seuil_alpha: 128,
              durcissement: 1,
              point: [4, 4],
              portee: "tache",
              masquee: false,
              trace: [],
              modele: "",
            },
          ],
        } as Partial<Recette>),
      }),
    })
    fireEvent.click(within(barre()).getByRole("button", { name: "Détourer" }))
    fireEvent.click(
      await within(colonne()).findByRole("button", {
        name: /enregistrer ce réglage comme défaut du projet/i,
      }),
    )
    expect(within(colonne()).getByText(/ne part pas avec/i)).toBeTruthy()
  })

  test("annuler referme le geste sans rien poser", async () => {
    const { appels } = monter()
    fireEvent.click(within(barre()).getByRole("button", { name: "Détourer" }))
    fireEvent.click(
      await within(colonne()).findByRole("button", {
        name: /enregistrer ce réglage comme défaut du projet/i,
      }),
    )
    fireEvent.click(within(colonne()).getByRole("button", { name: "annuler" }))
    expect(
      within(colonne()).queryByRole("button", { name: /pour une image seule/i }),
    ).toBeNull()
    expect(appels.some((a) => a.url.includes("/universe"))).toBe(false)
  })

  test("aucune image déjà faite n'est retouchée — l'écran le rappelle", async () => {
    monter()
    fireEvent.click(within(barre()).getByRole("button", { name: "Détourer" }))
    fireEvent.click(
      await within(colonne()).findByRole("button", {
        name: /enregistrer ce réglage comme défaut du projet/i,
      }),
    )
    expect(within(colonne()).getByText(/vaut pour ce qui arrivera/i)).toBeTruthy()
  })

  test("sans passe posée, le geste ne paraît pas — un défaut sans réglage n'a rien à garder", () => {
    monter({ asset: image({ recette: RECETTE_VIDE }) })
    fireEvent.click(within(barre()).getByRole("button", { name: "Détourer" }))
    expect(
      screen.queryByRole("button", { name: /enregistrer ce réglage comme défaut du projet/i }),
    ).toBeNull()
  })
})
