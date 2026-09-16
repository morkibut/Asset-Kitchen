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
import { reinitialiserPressePapier } from "../recette"
import {
  RECETTE_VIDE,
  UNIVERS_VIDE,
  type Asset,
  type EtatTraitement,
  type Passe,
  type Recette,
  type Univers,
} from "../api"

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

beforeEach(() => {
  // **N'existe que pour les essais** (`recette.ts`) : deux essais qui
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
    /** Ce que le serveur dit savoir faire. **Surchargeable depuis `B26`** :
     *  le catalogue des modèles de silhouette vient de là, et le double par
     *  défaut le rend vide — un poste qui ne montre pas le choix quand le
     *  serveur n'a rien répondu est la règle, pas l'exception. */
    traitement?: EtatTraitement
    /** La porte vers l'association à un équipement (AU15). `undefined` quand
     *  aucun jeu n'est ouvert : l'écran n'invente alors pas le bouton. */
    onAssocierEquipement?: () => void
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
    <Retouche enregistrementImmediat
      asset={surplus.asset ?? image({ recette: recetteDeTravail() })}
      soeurs={surplus.soeurs ?? []}
      univers={surplus.univers ?? univers()}
      traitement={surplus.traitement ?? TRAITEMENT}
      onFermer={onFermer}
      onSoeur={onSoeur}
      decoupe={surplus.decoupe ?? DECOUPE_STUB}
      onErreur={onErreur}
      onUnivers={onUnivers}
      onAssocierEquipement={surplus.onAssocierEquipement}
    />,
  )
  const reouvrir = (nouveau: { asset: Asset; soeurs?: Asset[] }) =>
    rendu.rerender(
      <Retouche enregistrementImmediat
        asset={nouveau.asset}
        soeurs={nouveau.soeurs ?? surplus.soeurs ?? []}
        univers={surplus.univers ?? univers()}
        traitement={surplus.traitement ?? TRAITEMENT}
        onFermer={onFermer}
        onSoeur={onSoeur}
        decoupe={surplus.decoupe ?? DECOUPE_STUB}
        onErreur={onErreur}
        onUnivers={onUnivers}
        onAssocierEquipement={surplus.onAssocierEquipement}
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

  test("l'ajusté se mesure sur la surface posée, et la réduit au cadre (B23)", async () => {
    // ⚠️ Le défaut que la relecture de `B23` avait trouvé : le cran tenu
    // retombait à ×1 et la surface prenait ses 2 048 px dans un cadre de 500.
    // Un enfant centré qui déborde ne se défile que de la moitié du
    // débordement de chaque côté, donc le coin haut-gauche de l'image
    // devenait inatteignable — plus moyen d'y poser un coin de recadrage, d'y
    // viser un pixel, d'y peindre.
    //
    // Le pour cent libre de `B24` le règle à la racine, **à condition de se
    // mesurer sur la surface** : le rendu ne fait ici que 64 px, et l'ajuster
    // sur lui donnerait 250 % à une surface qui en compte 2 048.
    const rendre = cadreDe(500)
    try {
      monter({
        asset: image({
          largeur: 2048,
          hauteur: 1024,
          rendu_largeur: 64,
          rendu_hauteur: 64,
          recette: recetteDeTravail(),
        }),
      })
      fireEvent.click(within(barre()).getByRole("button", { name: "Recadrer" }))
      const boite = await waitFor(() => {
        const f = document.querySelector("[data-surface='recadrage']")
        expect(f?.getAttribute("data-surface-au-cadre")).toBe("")
        return f?.firstElementChild as HTMLElement
      })
      // 500 − 44 de marges : la boîte y entre, et elle garde ses proportions,
      // sinon le curseur carré de la main — placé en pour cent de la boîte —
      // se décalerait de l'image, qui s'y contient.
      const largeur = parseFloat(boite.style.width)
      const hauteur = parseFloat(boite.style.height)
      expect(largeur).toBeGreaterThan(0)
      expect(largeur).toBeLessThanOrEqual(456)
      expect(hauteur).toBeLessThanOrEqual(456)
      expect(largeur / hauteur).toBeCloseTo(2048 / 1024, 5)
    } finally {
      rendre()
    }
  })

  // ── U2 · « La molette approche et recule, en gardant le point visé » ───────
  //
  // **Un critère déjà coché du lot `U`, rendu à l'écran neuf** (9 septembre
  // 2026). `B25` avait fermé la porte de l'ancien écran sans que la molette
  // déménage : approcher ne se faisait plus qu'au champ et aux deux boutons.

  /** La mise en page que `jsdom` ne fait pas — et il en faut une vraie ici,
   *  parce que le geste se juge à un point qui ne bouge pas.
   *
   *  La boîte de l'image porte la taille que l'écran lui a calculée (le `<span>`
   *  et son style en pixels) ; elle est centrée par `m-auto` tant qu'elle tient,
   *  et le défilement du cadre la déplace dès qu'elle déborde. C'est exactement
   *  ce que le navigateur fait, et c'est le minimum pour que
   *  `scrollLeft += …` veuille dire quelque chose. */
  function mettreEnPage(cote: number) {
    const vrai = Element.prototype.getBoundingClientRect
    Element.prototype.getBoundingClientRect = function () {
      const noeud = this as HTMLElement
      if (!noeud.hasAttribute?.("data-boite-image")) return vrai.call(this)
      const dedans = noeud.querySelector("span[style]") as HTMLElement | null
      const largeur = dedans ? parseFloat(dedans.style.width) || 0 : 0
      const hauteur = dedans ? parseFloat(dedans.style.height) || 0 : 0
      const cadre = document.querySelector("[data-scene-de-retouche]") as HTMLElement
      const gauche = 22 + Math.max(0, (cote - 44 - largeur) / 2) - (cadre?.scrollLeft ?? 0)
      const haut = 22 + Math.max(0, (cote - 44 - hauteur) / 2) - (cadre?.scrollTop ?? 0)
      return {
        x: gauche,
        y: haut,
        left: gauche,
        top: haut,
        width: largeur,
        height: hauteur,
        right: gauche + largeur,
        bottom: haut + hauteur,
        toJSON: () => ({}),
      } as DOMRect
    }
    return () => {
      Element.prototype.getBoundingClientRect = vrai
    }
  }

  test("la molette approche, recule, arrête le défilement de la page, et garde le point sous le pointeur", async () => {
    const rendreLeCadre = cadreDe(500)
    const rendreLaMesure = mettreEnPage(500)
    try {
      monter({
        asset: image({
          largeur: 1024,
          hauteur: 1024,
          rendu_largeur: 1024,
          rendu_hauteur: 1024,
          recette: recetteDeTravail(),
        }),
      })
      const cadre = await waitFor(() => {
        const s = scene()
        expect(s).toBeTruthy()
        return s
      })
      // `jsdom` ne fait défiler personne : les deux positions deviennent des
      // valeurs qu'on peut écrire, comme le navigateur les écrit.
      for (const nom of ["scrollLeft", "scrollTop"])
        Object.defineProperty(cadre, nom, { value: 0, writable: true, configurable: true })

      const champ = () =>
        document.querySelector(
          '[data-zoom] input[aria-label="Pour cent d\'agrandissement"]',
        ) as HTMLInputElement
      const zoom = document.querySelector("[data-zoom]") as HTMLElement
      fireEvent.click(within(zoom).getByRole("button", { name: "100 %" }))
      await waitFor(() => expect(champ().value).toBe("100"))

      // L'image fait 1 024 px dans un cadre qui en offre 456 : elle déborde,
      // donc le défilement a de quoi rattraper — c'est le seul cas où « le
      // point ne bouge pas » veut dire quelque chose.
      const boite = document.querySelector("[data-boite-image]") as HTMLElement
      const avant = boite.getBoundingClientRect()
      const x = avant.left + avant.width * 0.75
      const y = avant.top + avant.height * 0.25

      // **Un écouteur natif, non passif.** React pose ses écouteurs de molette
      // en passif sur la racine : `preventDefault` y serait ignoré et la page
      // défilerait derrière le zoom.
      const approcher = new WheelEvent("wheel", {
        deltaY: -100,
        clientX: x,
        clientY: y,
        bubbles: true,
        cancelable: true,
      })
      cadre.dispatchEvent(approcher)
      expect(approcher.defaultPrevented).toBe(true)
      await waitFor(() => expect(Number(champ().value)).toBeGreaterThan(100))

      // Le point de l'image qui était sous le pointeur y est encore : c'est
      // *ça*, approcher — et non un grossissement centré qui emmène ailleurs.
      const apres = boite.getBoundingClientRect()
      expect(apres.left + apres.width * 0.75).toBeCloseTo(x, 0)
      expect(apres.top + apres.height * 0.25).toBeCloseTo(y, 0)

      const reculer = new WheelEvent("wheel", {
        deltaY: 100,
        clientX: x,
        clientY: y,
        bubbles: true,
        cancelable: true,
      })
      cadre.dispatchEvent(reculer)
      await waitFor(() => expect(Number(champ().value)).toBe(100))
    } finally {
      rendreLaMesure()
      rendreLeCadre()
    }
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// U3 · Un curseur prend un chiffre — rendu à l'écran neuf
// ─────────────────────────────────────────────────────────────────────────────
//
// **Ce qui se mesure ici** : le champ où la valeur d'une `Glissiere` s'écrit. Le
// geste d'origine reste le bon — on fait glisser, on regarde — mais il ne suffit
// pas quand on connaît déjà le nombre : refaire à la souris un réglage qu'on a
// noté sur l'image d'à côté est une punition, et aucun logiciel d'image ne
// l'impose.
//
// Le comportement est celui de `Curseur` (`pieces.tsx`), repris et non
// réinventé. Un seul composant porte les vingt-deux glissières de l'écran : les
// essais l'éprouvent donc par un de ses emplois, pas par les vingt-deux.

describe("un curseur prend un chiffre", () => {
  const recettesPosees = (appels: { url: string; corps: unknown }[]) =>
    appels.filter((a) => a.url.includes("/recipe"))

  /** *Nettoyer*, et sa tache minimale — de zéro à soixante-quatre pixels. */
  const ouvrirNettoyer = async () => {
    const rendu = monter()
    fireEvent.click(within(barre()).getByRole("button", { name: "Nettoyer" }))
    const champ = (await screen.findByLabelText(
      "tache minimale, en chiffres",
    )) as HTMLInputElement
    return { ...rendu, champ }
  }

  test("le champ porte la valeur de la glissière, et il porte son nom", async () => {
    const { champ } = await ouvrirNettoyer()
    const glissiere = (await screen.findByLabelText(
      "tache minimale",
    )) as HTMLInputElement
    // Le champ montre la valeur de la glissière — il ne tient pas un second
    // état, et l'unité s'y lit comme partout ailleurs.
    expect(champ.value).toBe(`${glissiere.value} px`)
  })

  test("un chiffre écrit vaut un relâchement — un seul envoi", async () => {
    // **La règle de T2, appliquée à l'autre façon de régler.** Un envoi par
    // frappe ferait deux appels pour « 12 », dont un sur une valeur que
    // personne n'a demandé à voir.
    const { champ, appels } = await ouvrirNettoyer()
    const avant = recettesPosees(appels).length

    fireEvent.change(champ, { target: { value: "12" } })
    expect(recettesPosees(appels).length).toBe(avant)

    fireEvent.keyDown(champ, { key: "Enter" })
    await waitFor(() => expect(recettesPosees(appels).length).toBe(avant + 1))
    expect(
      (recettesPosees(appels).at(-1)!.corps as { bords: { aire_min: number } }).bords
        .aire_min,
    ).toBe(12)
    // Et la glissière a suivi : les deux disent toujours la même chose.
    await waitFor(() =>
      expect(
        (screen.getByLabelText("tache minimale") as HTMLInputElement).value,
      ).toBe("12"),
    )
  })

  test("Échap rend la valeur d'avant, sans rien envoyer", async () => {
    const { champ, appels } = await ouvrirNettoyer()
    const avant = recettesPosees(appels).length
    const initiale = champ.value

    fireEvent.change(champ, { target: { value: "7" } })
    fireEvent.keyDown(champ, { key: "Escape" })

    expect(champ.value).toBe(initiale)
    expect(recettesPosees(appels).length).toBe(avant)
  })

  test("quitter le champ vaut Entrée", async () => {
    // **Sans quoi une valeur tapée puis abandonnée resterait à l'écran sans
    // agir** : le champ dirait une chose et l'image en montrerait une autre.
    const { champ, appels } = await ouvrirNettoyer()
    const avant = recettesPosees(appels).length

    fireEvent.change(champ, { target: { value: "9" } })
    fireEvent.blur(champ)

    await waitFor(() => expect(recettesPosees(appels).length).toBe(avant + 1))
    expect(
      (recettesPosees(appels).at(-1)!.corps as { bords: { aire_min: number } }).bords
        .aire_min,
    ).toBe(9)
  })

  test("une valeur hors bornes est ramenée dans les bornes, et la table le dit", async () => {
    // **Ramener plutôt que refuser.** Un champ qui rejette une frappe oblige à
    // deviner ce qu'il accepte ; un champ qui ramène le dit en affichant la
    // valeur retenue et ses bornes.
    const { champ } = await ouvrirNettoyer()

    fireEvent.change(champ, { target: { value: "900" } })
    fireEvent.keyDown(champ, { key: "Enter" })

    expect(
      await within(colonne()).findByText(/ramené à 64 px — les bornes sont 0 et 64/),
    ).toBeTruthy()
    await waitFor(() => expect(champ.value).toBe("64 px"))
  })

  test("taper un chiffre sur la glissière remplit le champ sans qu'on l'ait visée", async () => {
    // **Le geste des logiciels d'image.** La main est sur la glissière, l'œil
    // est sur l'image : viser un champ de quarante-six pixels pour écrire un
    // nombre qu'on connaît déjà casse le geste.
    const { champ } = await ouvrirNettoyer()
    const glissiere = screen.getByLabelText("tache minimale")

    fireEvent.keyDown(glissiere, { key: "9" })
    await waitFor(() => expect(champ.value).toBe("9"))

    // Les flèches, elles, continuent de faire vivre la glissière : on ne
    // détourne que les chiffres.
    fireEvent.keyDown(glissiere, { key: "ArrowRight" })
    expect(champ.value).toBe("9")
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
      <Retouche enregistrementImmediat
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
      <Retouche enregistrementImmediat
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
      within(colonne()).getByText(/un calcul ne s[’']interrompt pas/i),
    ).toBeTruthy()
    expect(within(colonne()).queryByRole("button", { name: /Annuler/i })).toBeNull()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// B23 · les quatre surfaces à coordonnées, et les trois réglages du retournement
//
// ⚠️ **Les nombres de ces essais sont ceux de l'ancien écran, recopiés
// exprès.** `interface/src/App.test.tsx` mesure les mêmes gestes sur la table
// de `Tables.tsx` : un rectangle glissé de (64, 64) à (256, 320) sur une
// surface de 512 px pour une image de 1 024 y donne `[128, 128, 512, 640]`, et
// un clic en (64, 128) y pose le point `[128, 256]`. Les mêmes chiffres ici
// disent la seule chose que la tranche promet — **c'est le même calcul**, et
// non un second qui lui ressemble. Le jour où les deux divergent, l'un des deux
// essais tombe.
// ─────────────────────────────────────────────────────────────────────────────

/** Une passe de détourage, à un moteur près. */
function passe(surplus: Partial<Passe> = {}): Passe {
  return {
    moteur: "bord",
    tolerance: 28,
    seuil_alpha: 128,
    durcissement: 0,
    point: null,
    portee: "tache",
    masquee: false,
    trace: [],
    modele: "",
    ...surplus,
  } as Passe
}

// jsdom ne connaît pas la capture de pointeur, et les trois surfaces qui se
// glissent s'en servent — le cadre de recadrage, la forme entourée, la main.
beforeEach(() => {
  Element.prototype.setPointerCapture = () => {}
  Element.prototype.hasPointerCapture = () => false
  Element.prototype.releasePointerCapture = () => {}
})

/** La surface, mesurée par l'essai — **jsdom n'a pas de mise en page**, donc le
 *  rectangle est celui qu'on lui donne. C'est ce que fait déjà l'essai de la
 *  même surface dans l'ancien écran. */
function poserLaSurface(noeud: HTMLElement, cote: number) {
  noeud.getBoundingClientRect = () =>
    ({ left: 0, top: 0, width: cote, height: cote }) as DOMRect
}

const dernierePose = (appels: { url: string; methode: string; corps: unknown }[]) =>
  appels.filter((a) => a.url.includes("/recipe")).pop()?.corps as Recette | undefined

describe("les quatre surfaces se posent depuis l'écran neuf", () => {
  test("le rectangle de recadrage se glisse sur l'image, et part dans la recette", async () => {
    const { appels } = monter()
    fireEvent.click(within(barre()).getByRole("button", { name: "Recadrer" }))

    const toile = await waitFor(() => {
      const noeud = document.querySelector("[data-cadre-recadrage]")
      if (!noeud) throw new Error("pas de cadre de recadrage")
      return noeud as HTMLElement
    })
    poserLaSurface(toile, 512)

    fireEvent.pointerDown(toile, { button: 0, clientX: 64, clientY: 64, pointerId: 1 })
    fireEvent.pointerMove(toile, { clientX: 256, clientY: 320, pointerId: 1 })
    fireEvent.pointerUp(toile, { pointerId: 1 })

    await waitFor(() => {
      // 512 px d'écran pour 1 024 px d'image : le facteur est deux.
      expect(dernierePose(appels)?.recadrage?.boite).toEqual([128, 128, 512, 640])
    })
    // ⚠️ **Les huit champs, jamais deux** : la marge déjà posée survit au
    // rectangle qu'on vient de tracer.
    expect(dernierePose(appels)?.recadrage?.marge).toBe(8)
  })

  test("le rectangle réellement gardé se voit en pointillé, sous le tracé", async () => {
    monter()
    fireEvent.click(within(barre()).getByRole("button", { name: "Recadrer" }))
    const obtenue = await waitFor(() => {
      const noeud = document.querySelector("[data-boite-obtenue]")
      if (!noeud) throw new Error("pas de boîte obtenue")
      return noeud as HTMLElement
    })
    expect(obtenue.className).toContain("border-dashed")
    // Elle est mesurée par le serveur, jamais recalculée ici : 248 / 1 024.
    expect(obtenue.style.left).toBe(`${(248 / 1024) * 100}%`)
  })

  test("« une boîte tracée » n'est plus grisée pour toujours, et sa raison dit le geste", async () => {
    monter()
    fireEvent.click(within(barre()).getByRole("button", { name: "Recadrer" }))
    const cran = await within(colonne()).findByRole("button", { name: "une boîte tracée" })
    expect((cran as HTMLButtonElement).disabled).toBe(true)
    // La raison ne renvoie plus ailleurs : le geste se fait sur cet écran-ci.
    expect(within(colonne()).getByText(/glisse le rectangle sur l'image/i)).toBeTruthy()

    // Et une fois la boîte tracée, le cran s'allume.
    cleanup()
    monter({
      asset: image({
        recette: recetteDeTravail({
          recadrage: { marge: 0, boite: [10, 10, 40, 40] },
        } as Partial<Recette>),
      }),
    })
    fireEvent.click(within(barre()).getByRole("button", { name: "Recadrer" }))
    expect(
      (
        (await within(colonne()).findByRole("button", {
          name: "une boîte tracée",
        })) as HTMLButtonElement
      ).disabled,
    ).toBe(false)
  })

  test("un pixel visé à la pipette donne la même coordonnée qu'avant le déménagement", async () => {
    const { appels } = monter({
      asset: image({
        recette: recetteDeTravail({ passes: [passe({ moteur: "couleur" })] } as Partial<Recette>),
      }),
    })

    // **La surface n'est pas là avant d'armer.** Une pipette permanente ferait
    // de chaque regard sur l'image un risque de clic.
    expect(document.querySelector("[data-pipette]")).toBeNull()
    fireEvent.click(
      await within(colonne()).findByRole("button", { name: /viser dans l'image/ }),
    )

    const toile = document.querySelector("[data-pipette]") as HTMLElement
    expect(toile).toBeTruthy()
    poserLaSurface(toile, 512)
    fireEvent.click(toile, { clientX: 64, clientY: 128 })

    await waitFor(() => {
      expect(dernierePose(appels)?.passes[0].point).toEqual([128, 256])
    })
    // **Le clic désarme** : viser est un geste qui se termine.
    await waitFor(() => expect(document.querySelector("[data-pipette]")).toBeNull())
  })

  test("la forme entourée se trace sur l'image, et se ferme d'elle-même", async () => {
    const { appels } = monter({
      asset: image({
        recette: recetteDeTravail({ passes: [passe({ moteur: "trace" })] } as Partial<Recette>),
      }),
    })

    fireEvent.click(
      await within(colonne()).findByRole("button", { name: /entourer dans l'image/ }),
    )
    const toile = document.querySelector("[data-trace]") as HTMLElement
    expect(toile).toBeTruthy()
    poserLaSurface(toile, 512)

    fireEvent.pointerDown(toile, { button: 0, clientX: 20, clientY: 20, pointerId: 1 })
    fireEvent.pointerMove(toile, { clientX: 120, clientY: 20, pointerId: 1 })
    fireEvent.pointerMove(toile, { clientX: 120, clientY: 120, pointerId: 1 })
    fireEvent.pointerUp(toile, { pointerId: 1 })

    await waitFor(() => {
      // Les mêmes pixels d'image brute, au facteur deux près.
      expect(dernierePose(appels)?.passes[0].trace).toEqual([
        [40, 40],
        [240, 40],
        [240, 240],
      ])
    })
  })

  test("la main peint sur le rendu, et le curseur est le carré du pixel visé", async () => {
    const { appels } = monter()
    fireEvent.click(within(barre()).getByRole("button", { name: "La main" }))

    const toile = await waitFor(() => {
      const noeud = document.querySelector("[data-toile-main]")
      if (!noeud) throw new Error("pas de toile de la main")
      return noeud as HTMLElement
    })
    // 640 px d'écran pour un **rendu** de 64 px : le facteur est dix. C'est le
    // rendu et non le brut — la huitième place s'applique sur lui.
    poserLaSurface(toile, 640)

    fireEvent.pointerMove(toile, { clientX: 205, clientY: 305, pointerId: 1 })
    const curseur = document.querySelector("[data-curseur-main]") as HTMLElement
    expect(curseur).toBeTruthy()
    // **Calé sur la grille de l'image**, et carré : c'est la promesse d'U11.
    expect(curseur.className).not.toContain("rounded-full")
    const centreX =
      Number.parseFloat(curseur.style.left) + Number.parseFloat(curseur.style.width) / 2
    expect(centreX).toBeCloseTo((20.5 / 64) * 100, 6)

    fireEvent.pointerDown(toile, { button: 0, clientX: 205, clientY: 305, pointerId: 1 })
    fireEvent.pointerMove(toile, { clientX: 305, clientY: 305, pointerId: 1 })
    fireEvent.pointerUp(toile, { pointerId: 1 })

    await waitFor(() => {
      const main = dernierePose(appels)?.main
      expect(main?.opacite[0].points).toEqual([
        [20, 30],
        [30, 30],
      ])
      // Le pinceau de cinq pixels donne un rayon de deux — le diamètre est ce
      // qu'on voit, le rayon ce que le calcul veut.
      expect(main?.opacite[0].rayon).toBe(2)
    })
  })

  test("les calques de la main se règlent ici, et l'opacité est le sol de la pile", async () => {
    const { appels } = monter()
    fireEvent.click(within(colonne()).getByRole("button", { name: "Calques" }))

    // Le sol ne se supprime ni ne se déplace : il n'a aucun de ces boutons.
    expect(within(colonne()).queryByRole("button", { name: "Supprimer l'opacité" })).toBeNull()
    fireEvent.click(
      await within(colonne()).findByRole("button", { name: /Un calque de dessin de plus/ }),
    )
    await waitFor(() => {
      expect(dernierePose(appels)?.main?.calques.length).toBe(1)
    })
    expect(within(colonne()).getByLabelText("Nom du calque calque 1")).toBeTruthy()
  })
})

describe("les trois réglages du retournement se règlent dans l'écran neuf", () => {
  const ouvrirLeRetournement = (sens: string) => {
    const rendu = monter({
      asset: image({
        recette: recetteDeTravail({ retournement: { sens } } as unknown as Partial<Recette>),
      }),
    })
    fireEvent.click(within(barre()).getByRole("button", { name: "Retourner" }))
    return rendu
  }

  test("l'angle se règle sous les deux rotations libres, et nulle part ailleurs", async () => {
    const { appels } = ouvrirLeRetournement("angle-libre")
    const angle = (await screen.findByLabelText(
      "angle du retournement",
    )) as HTMLInputElement
    expect(angle.min).toBe("-180")
    expect(angle.max).toBe("180")
    fireEvent.change(angle, { target: { value: "35" } })
    fireEvent.keyUp(angle)
    await waitFor(() => {
      expect(dernierePose(appels)?.retournement?.angle).toBe(35)
    })

    // Un angle sous « miroir haut-bas » ne voudrait rien dire : il n'y est pas.
    cleanup()
    ouvrirLeRetournement("haut-bas")
    expect(screen.queryByLabelText("angle du retournement")).toBeNull()
  })

  test("la moitié gardée du repli se choisit ici", async () => {
    const { appels } = ouvrirLeRetournement("repli")
    fireEvent.click(await within(colonne()).findByRole("button", { name: "droite" }))
    await waitFor(() => {
      expect(dernierePose(appels)?.retournement?.moitie_repli).toBe("droite")
    })
  })

  test("les zones protégées se posent et se vident ici", async () => {
    const { appels } = ouvrirLeRetournement("sauf-zones")
    fireEvent.click(
      await within(colonne()).findByRole("button", { name: "Une zone au centre" }),
    )
    await waitFor(() => {
      expect(dernierePose(appels)?.retournement?.zones_protegees?.length).toBe(1)
    })
  })
})

// ── RP22 · un sens se déclique, une table s'endort et se vide ──────────────

describe("le retournement se déclique, et la table s'endort et se vide comme les autres", () => {
  const ouvrir = (sens: string) => {
    const rendu = monter({
      asset: image({
        recette: recetteDeTravail({ retournement: { sens } } as unknown as Partial<Recette>),
      }),
    })
    fireEvent.click(within(barre()).getByRole("button", { name: "Retourner" }))
    return rendu
  }

  test("cliquer le sens déjà posé retire tout le retournement", async () => {
    const { appels } = ouvrir("gauche-droite")
    const bouton = within(colonne()).getByRole("button", { name: "miroir gauche-droite" })
    expect(bouton.getAttribute("aria-pressed")).toBe("true")

    fireEvent.click(bouton)

    expect(bouton.getAttribute("aria-pressed")).toBe("false")
    await waitFor(() => {
      expect(dernierePose(appels)?.retournement).toBeFalsy()
    })
  })

  test("une place sans retournement ne montre aucun sens pressé", async () => {
    monter({ asset: image({ recette: recetteDeTravail({ retournement: null }) }) })
    fireEvent.click(within(barre()).getByRole("button", { name: "Retourner" }))
    const bouton = await within(colonne()).findByRole("button", { name: "miroir gauche-droite" })
    // **La panne trouvée par l'auteur** : le cran restait pressé même la
    // table vide, si bien qu'un premier clic ne semblait rien changer.
    expect(bouton.getAttribute("aria-pressed")).toBe("false")
  })

  test("L'endormir puis Remettre à zéro se posent contre la table du retournement, comme sur les sept autres", async () => {
    const { appels } = ouvrir("haut-bas")
    within(colonne()).getByRole("button", { name: "miroir haut-bas" })

    fireEvent.click(within(colonne()).getByRole("button", { name: "L'endormir" }))
    expect(within(colonne()).getByRole("button", { name: "La réveiller" })).toBeTruthy()
    await waitFor(() => {
      expect(dernierePose(appels)?.veille).toContain("retournement")
    })

    fireEvent.click(within(colonne()).getByRole("button", { name: "Remettre à zéro" }))
    await waitFor(() => {
      expect(dernierePose(appels)?.retournement).toBeFalsy()
    })
    // **Vider n'endort pas** (invariant du lot U) : la bascule reste sur
    // « La réveiller », posée juste à côté du geste qui vient de vider.
    expect(within(colonne()).getByRole("button", { name: "La réveiller" })).toBeTruthy()
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
    // parce qu'il vit hors de React (`recette.ts`).
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

// ── Les réglages que le départ de `Places.test.tsx` a laissés sans essai ─────
//
// **`B26` a écrit que ses 22 essais étaient « tous doublés » ; c'était faux**,
// et douze réglages sont tombés à zéro essai d'écran le jour de la
// suppression : `echanges` (5 avant), `grain_min` et `lissage` (4), `saturation`
// et `luminosite` (3), puis `vote_voisins`, les deux morphologies,
// `boucher_jusqua`, `reboucher_jusqua`, `garder`, `epargner_traits_fins` et
// `contraste` (2 chacun). Deux de plus n'en avaient jamais eu —
// `visibles_seuls` et `force_tramage`.
//
// **La capacité n'avait pas bougé, la couverture si**, et c'est exactement la
// forme de perte que ce chantier existe pour clore : un réglage sans essai
// repart à la refonte suivante sans que rien ne refuse. Le domaine les tient de
// son côté (`tests/test_b17.py`, les huit `tests/test_b18_*.py`) ; ce qui suit tient le
// seul fait dont l'écran répond — **la valeur réglée part dans la recette
// envoyée**.
//
// ⚠️ **Le compte est refait ici plutôt que repris**, parce que celui qu'on
// avait reçu comptait `remplissage` pour `lissage` et une phrase de commentaire
// pour un essai. La règle, pour qu'elle se rejoue : un essai = un bloc `test(`,
// commentaires retirés, le nom cité sur une frontière de mot.
//
// ⚠️ **`graine` n'est pas ici**, et c'est le seul : il n'a jamais eu d'essai
// d'écran, ni avant `B26` ni après. Le noter vaut mieux que le laisser en
// blanc — mais ce n'est pas cette tranche qui le lui a pris.

describe("les réglages rendus sans essai par le départ de Places.test.tsx", () => {
  /** Ouvre une table, pousse une glissière et relâche — le geste que
   *  `Places.test.tsx` appelait `glisser`, dans le vocabulaire de cet écran. */
  const glisser = async (table: string, nom: string, valeur: number) => {
    fireEvent.click(within(barre()).getByRole("button", { name: table }))
    const curseur = await screen.findByLabelText(nom)
    fireEvent.change(curseur, { target: { value: String(valeur) } })
    fireEvent.pointerUp(curseur)
  }

  test("le grain de couleur part dans la recette", async () => {
    const { appels } = monter()
    await glisser("Nettoyer", "grain de couleur", 3)
    await waitFor(() => expect(dernierePose(appels)?.bords?.grain_min).toBe(3))
  })

  test("le lissage part dans la recette", async () => {
    const { appels } = monter()
    await glisser("Nettoyer", "lissage", 2)
    await waitFor(() => expect(dernierePose(appels)?.bords?.lissage).toBe(2))
  })

  test("le vote des voisins part dans la recette", async () => {
    const { appels } = monter()
    await glisser("Nettoyer", "vote des voisins", 2)
    await waitFor(() => expect(dernierePose(appels)?.bords?.vote_voisins).toBe(2))
  })

  test("les deux morphologies partent chacune sur sa clé, et ne se confondent pas", async () => {
    // **L'ordre est ce qui les distingue** — ronger puis regonfler retire les
    // excroissances, regonfler puis ronger comble les entailles. Les poser sur
    // la même clé rendrait l'un des deux curseurs muet sans que rien ne le
    // dise.
    const { appels } = monter()
    await glisser("Nettoyer", "ronger puis regonfler", 2)
    await waitFor(() => expect(dernierePose(appels)?.bords?.ronger_regonfler).toBe(2))
    expect(dernierePose(appels)?.bords?.regonfler_ronger).toBe(0)

    await glisser("Nettoyer", "regonfler puis ronger", 3)
    await waitFor(() => expect(dernierePose(appels)?.bords?.regonfler_ronger).toBe(3))
    // Et le premier n'a pas été effacé au passage : la table part entière.
    expect(dernierePose(appels)?.bords?.ronger_regonfler).toBe(2)
  })

  test("les trous et les poches de fond partent chacun sur sa clé", async () => {
    // **Deux lectures inverses de la même chose** : un trou est transparent et
    // entouré de sujet, une poche de fond est opaque et enfermée. Les
    // confondre a déjà coûté cher au détourage.
    const { appels } = monter()
    await glisser("Nettoyer", "boucher les trous jusqu'à", 5)
    await waitFor(() => expect(dernierePose(appels)?.bords?.boucher_jusqua).toBe(5))

    await glisser("Nettoyer", "reboucher les poches de fond jusqu'à", 7)
    await waitFor(() => expect(dernierePose(appels)?.bords?.reboucher_jusqua).toBe(7))
    expect(dernierePose(appels)?.bords?.boucher_jusqua).toBe(5)
  })

  test("garder les plus grandes part dans la recette", async () => {
    // **Un rang, jamais une taille** : ce que la tache minimale ne peut pas
    // faire — effacer un amas collé au sujet, quelle que soit son aire.
    const { appels } = monter()
    await glisser("Nettoyer", "garder les plus grandes", 2)
    await waitFor(() => expect(dernierePose(appels)?.bords?.garder).toBe(2))
  })

  test("épargner les traits fins s'éteint, et l'écran dit ce que ça change", async () => {
    const { appels } = monter()
    fireEvent.click(within(barre()).getByRole("button", { name: "Nettoyer" }))
    expect(
      await within(colonne()).findByText(/un pixel de large — survit au rongement/),
    ).toBeTruthy()

    fireEvent.click(within(colonne()).getByRole("button", { name: "non" }))
    await waitFor(() =>
      expect(dernierePose(appels)?.bords?.epargner_traits_fins).toBe(false),
    )
    expect(
      within(colonne()).getByText(/rien n'est épargné/),
    ).toBeTruthy()
  })

  test("les trois curseurs de B17 partent chacun sur sa clé", async () => {
    // Les quatre curseurs viennent d'une même liste (`CURSEURS`) : ce qu'on
    // mesure ici est que la clé suit le nom, et qu'un curseur posé n'efface pas
    // celui d'à côté.
    const { appels } = monter()
    await glisser("Couleurs", "luminosité", 25)
    await waitFor(() => expect(dernierePose(appels)?.quantification?.luminosite).toBe(25))

    await glisser("Couleurs", "contraste", 15)
    await waitFor(() => expect(dernierePose(appels)?.quantification?.contraste).toBe(15))

    await glisser("Couleurs", "saturation", -40)
    await waitFor(() => expect(dernierePose(appels)?.quantification?.saturation).toBe(-40))
    expect(dernierePose(appels)?.quantification?.luminosite).toBe(25)
    expect(dernierePose(appels)?.quantification?.contraste).toBe(15)
  })

  test("la force du tramage ne se règle qu'avec un tramage choisi", async () => {
    // **Grisée tant qu'aucun tramage n'est choisi**, et la raison est écrite à
    // côté — la règle du grisé de cet écran.
    const { appels } = monter()
    fireEvent.click(within(barre()).getByRole("button", { name: "Couleurs" }))
    const force = (await screen.findByLabelText("force du tramage")) as HTMLInputElement
    expect(force.disabled).toBe(true)
    expect(within(colonne()).getByText("aucun tramage n'est choisi")).toBeTruthy()

    fireEvent.click(within(colonne()).getByRole("button", { name: "diffusion" }))
    await waitFor(() =>
      expect(
        (screen.getByLabelText("force du tramage") as HTMLInputElement).disabled,
      ).toBe(false),
    )

    await glisser("Couleurs", "force du tramage", 40)
    await waitFor(() => expect(dernierePose(appels)?.quantification?.force_tramage).toBe(40))
  })

  test("ne compter que ce qu'on voit part dans la recette", async () => {
    const { appels } = monter()
    fireEvent.click(within(barre()).getByRole("button", { name: "Couleurs" }))
    fireEvent.click(await within(colonne()).findByRole("button", { name: "oui" }))
    await waitFor(() =>
      expect(dernierePose(appels)?.quantification?.visibles_seuls).toBe(true),
    )
  })

  test("une paire d'échange ne rejoint la recette qu'une fois ses deux couleurs nommées", async () => {
    // **Le geste qui ouvre la table est aussi celui que le serveur refuse** si
    // la paire part à moitié faite (*une paire nomme deux couleurs*) : la
    // brouillon reste donc à l'écran, et rien n'est envoyé tant qu'il manque
    // une couleur.
    const { appels } = monter()
    fireEvent.click(within(barre()).getByRole("button", { name: "Couleurs" }))
    const avant = appels.filter((a) => a.url.includes("/recipe")).length

    fireEvent.click(
      await within(colonne()).findByRole("button", { name: /Échanger une couleur/i }),
    )
    expect(
      within(colonne()).getByText(/il manque la couleur qui vient/),
    ).toBeTruthy()
    expect(appels.filter((a) => a.url.includes("/recipe")).length).toBe(avant)

    // *Celle qui vient* est le second champ hexadécimal de la paire.
    const champs = within(colonne()).getAllByLabelText("Couleur, en hexadécimal")
    fireEvent.change(champs[1], { target: { value: "#8a5a2c" } })

    await waitFor(() =>
      expect(dernierePose(appels)?.quantification?.echanges).toEqual([
        { depuis: "#241d16", vers: "#8a5a2c", tolerance: 0 },
      ]),
    )
  })
})

// ── Les six capacités que `B26` a rattrapées ────────────────────────────────
//
// **Six capacités rendues sans une assertion, ce sont six capacités qui
// repartiront à la prochaine refonte sans que rien ne refuse** — le motif même
// que cette tranche existe pour clore. Les six vivaient dans les panneaux de
// l'ancien châssis, elles ont été reprises dans les postes de `Retouche.tsx` le
// 9 septembre 2026, et seul le contour avait jusqu'ici une assertion — au grep,
// dans `tests/test_d4.py`. Ce qui suit mesure le geste, pas le texte du
// fichier.

describe("les six capacités rattrapées par B26", () => {
  /** Un serveur qui sait détourer par modèle, et qui en propose deux. Le
   *  double par défaut grise `modele` et rend un catalogue vide : c'est le cas
   *  normal, pas celui qu'on veut mesurer ici. */
  const AVEC_SILHOUETTES = {
    ...TRAITEMENT,
    moteurs: [
      { nom: "bord", raison: null },
      { nom: "couleur", raison: null },
      { nom: "modele", raison: null },
      { nom: "trace", raison: null },
    ],
    silhouettes: [
      {
        nom: "u2net",
        titre: "rapide",
        octets: 176_000_000,
        lent: false,
        note: "il suffit sur un sujet franchement détaché de son fond",
        entree: 320,
        licence: "MIT",
        defaut: true,
        descendu: true,
        raison: null,
      },
      {
        nom: "birefnet-general",
        titre: "le meilleur sur les silhouettes difficiles",
        octets: 950_000_000,
        lent: true,
        note: "il tient les cheveux, les brins d'herbe et les franges",
        entree: 1024,
        licence: "MIT",
        defaut: false,
        descendu: false,
        raison: null,
      },
    ],
  } as unknown as EtatTraitement

  const ouvrirLeDetourage = (surplus: Parameters<typeof monter>[0] = {}) => {
    const rendu = monter(surplus)
    fireEvent.click(within(barre()).getByRole("button", { name: "Détourer" }))
    return rendu
  }

  // ── 1 · Masquer une passe (U10) ───────────────────────────────────────────

  test("masquer une passe la retire du calcul et lui garde ses réglages", async () => {
    const { appels } = ouvrirLeDetourage()
    const interrupteur = await within(colonne()).findByRole("switch", {
      name: "passe 1 — visible",
    })
    expect(interrupteur.getAttribute("aria-checked")).toBe("true")

    fireEvent.click(interrupteur)
    await waitFor(() => expect(dernierePose(appels)?.passes[0].masquee).toBe(true))
    // **Masquer n'est pas retirer** : la tolérance posée est toujours là.
    expect(dernierePose(appels)?.passes[0].tolerance).toBe(28)
    expect(dernierePose(appels)?.passes.length).toBe(1)
    expect(
      within(colonne()).getByText(/retirée du calcul, elle garde tous ses réglages/),
    ).toBeTruthy()
    await waitFor(() =>
      expect(
        within(colonne())
          .getByRole("switch", { name: "passe 1 — masquée" })
          .getAttribute("aria-checked"),
      ).toBe("false"),
    )
  })

  test("toucher un réglage d'une passe masquée la remontre — la règle U10", async () => {
    // **C'est la règle de la place endormie (U4), un cran plus bas** : poser
    // une valeur *dit* qu'on veut cette passe, et refuser le curseur
    // obligerait à un geste préalable pour avoir le droit de faire le geste
    // qu'on voulait.
    const { appels } = ouvrirLeDetourage()
    fireEvent.click(
      await within(colonne()).findByRole("switch", { name: "passe 1 — visible" }),
    )
    await waitFor(() => expect(dernierePose(appels)?.passes[0].masquee).toBe(true))

    const tolerance = await screen.findByLabelText("tolérance de la passe 1")
    fireEvent.change(tolerance, { target: { value: "44" } })
    fireEvent.pointerUp(tolerance)

    await waitFor(() => expect(dernierePose(appels)?.passes[0].tolerance).toBe(44))
    expect(dernierePose(appels)?.passes[0].masquee).toBe(false)
  })

  // ── 2 · Le catalogue des modèles de détourage (U13) ───────────────────────

  test("le modèle choisi part dans la passe, et le catalogue dit ce que chacun vaut", async () => {
    // **Le catalogue décide, jamais une liste en dur** : `Passe.modele`
    // partait toujours vide, c'est-à-dire au défaut du produit, sans que rien
    // ne le dise.
    const { appels } = ouvrirLeDetourage({ traitement: AVEC_SILHOUETTES })
    fireEvent.click(within(colonne()).getByRole("button", { name: "modèle" }))

    // Sans rien demander, c'est le défaut du serveur qui est montré — et sa
    // note avec lui.
    const rapide = await within(colonne()).findByRole("button", { name: "rapide" })
    expect(rapide.getAttribute("aria-pressed")).toBe("true")
    expect(
      within(colonne()).getByText(/il suffit sur un sujet franchement détaché/),
    ).toBeTruthy()

    fireEvent.click(
      within(colonne()).getByRole("button", {
        name: "le meilleur sur les silhouettes difficiles",
      }),
    )
    await waitFor(() =>
      expect(dernierePose(appels)?.passes[0].modele).toBe("birefnet-general"),
    )
    // **Ce que ça pèse, dit avant l'attente** — pas au milieu.
    expect(
      await within(colonne()).findByText(/l'atelier descendra ce modèle/),
    ).toBeTruthy()
    // Et le côté auquel il infère, qui décide de ce qu'il peut rendre (D4).
    expect(
      within(colonne()).getByText(/il calcule à 1024 px et ne réagrandit pas son masque/),
    ).toBeTruthy()
  })

  test("sans catalogue servi, le moteur reste choisissable et aucun modèle n'est deviné", () => {
    // **Jamais une liste devinée** : le double par défaut ne rend aucune
    // silhouette, et le poste montre alors le moteur sans son choix de modèle.
    ouvrirLeDetourage({
      traitement: { ...AVEC_SILHOUETTES, silhouettes: [] } as EtatTraitement,
    })
    fireEvent.click(within(colonne()).getByRole("button", { name: "modèle" }))
    expect(within(colonne()).queryByRole("button", { name: "rapide" })).toBeNull()
    // Et le curseur qui s'en va le dit, plutôt que de disparaître sans un mot.
    expect(
      within(colonne()).getByText(/il n'y a pas de tolérance à régler/),
    ).toBeTruthy()
  })

  // ── 3 · L'échantillon de l'occupation ─────────────────────────────────────

  test("l'échantillon donne les deux lectures d'une même hauteur", async () => {
    // **Un pour cent n'est pas une mesure** : ce que la hauteur décide est un
    // nombre de carrés, et c'est celui-là qu'on compare d'une image à l'autre.
    monter()
    fireEvent.click(within(barre()).getByRole("button", { name: "Pixéliser" }))
    expect(
      await within(colonne()).findByText("100 % d'un personnage"),
    ).toBeTruthy()
    expect(
      within(colonne()).getByText("l'image revient en 64 carrés de côté"),
    ).toBeTruthy()
  })

  test("au-delà d'un personnage, l'échantillon compte les personnages", async () => {
    monter({
      asset: image({
        recette: recetteDeTravail({
          grille: {
            cible: 64,
            occupation: 300,
            ancrage: "bas",
            decalage: 0,
            methode: "proche",
          },
        } as Partial<Recette>),
      }),
    })
    fireEvent.click(within(barre()).getByRole("button", { name: "Pixéliser" }))
    expect(await within(colonne()).findByText("3 personnages de haut")).toBeTruthy()
    expect(
      within(colonne()).getByText("l'image revient en 192 carrés de côté"),
    ).toBeTruthy()
  })

  // ── 4 · Ce que chaque méthode de pixélisation rend ────────────────────────

  test("la phrase sous les segments suit la méthode choisie", async () => {
    // **Un libellé de trois mots ne dit pas ce qu'on gagne et ce qu'on perd**,
    // et c'est précisément ce qui départage les quatre.
    const { appels } = monter()
    fireEvent.click(within(barre()).getByRole("button", { name: "Pixéliser" }))
    expect(
      await within(colonne()).findByText("brut : un pixel sur N gardé, les autres jetés"),
    ).toBeTruthy()

    fireEvent.click(within(colonne()).getByRole("button", { name: "vote en deux temps" }))
    await waitFor(() => expect(dernierePose(appels)?.grille?.methode).toBe("vote"))
    expect(
      within(colonne()).getByText("contour net et intérieur lisible — un sprite calme"),
    ).toBeTruthy()
  })

  // ── 5 · La source des couleurs ────────────────────────────────────────────

  test("choisir l'image vide la palette de la recette, choisir le jeu la recopie", async () => {
    // **Une palette vide veut dire *déduite de l'image elle-même***, et le
    // domaine le dit depuis `T2`. L'écran lisait déjà ce fait sans jamais le
    // poser.
    const { appels } = monter()
    fireEvent.click(within(barre()).getByRole("button", { name: "Couleurs" }))
    expect(
      (await within(colonne()).findByRole("button", { name: "le jeu" })).getAttribute(
        "aria-pressed",
      ),
    ).toBe("true")

    fireEvent.click(within(colonne()).getByRole("button", { name: "l'image" }))
    await waitFor(() => expect(dernierePose(appels)?.quantification?.palette).toEqual([]))

    fireEvent.click(within(colonne()).getByRole("button", { name: "le jeu" }))
    await waitFor(() =>
      // **Copiée dans la recette au moment du choix** : une recette est un
      // calcul complet, rejouable sans redemander au projet ce qu'il contenait
      // ce jour-là.
      expect(dernierePose(appels)?.quantification?.palette).toEqual([
        "#241d16",
        "#8a5a2c",
      ]),
    )
  })

  test("sans palette de jeu, le jeu est grisé avec sa raison", async () => {
    monter({ univers: univers({ palette: [] }) })
    fireEvent.click(within(barre()).getByRole("button", { name: "Couleurs" }))
    const leJeu = (await within(colonne()).findByRole("button", {
      name: "le jeu",
    })) as HTMLButtonElement
    expect(leJeu.disabled).toBe(true)
    expect(
      within(colonne()).getByText(/dépose un artwork officiel pour lui en donner une/),
    ).toBeTruthy()
  })

  // ── 6 · La provenance de la couleur du contour ────────────────────────────

  test("le contour propose la plus sombre, et marque une couleur hors palette", async () => {
    // **Le produit constate ; il ne refuse pas** (D4). Une couleur de plus dans
    // un jeu est un fait qui se lit, et il mérite d'être dit ici puisque la
    // réduction des couleurs est déjà passée et ne la rattrapera pas.
    const { appels } = monter()
    fireEvent.click(within(barre()).getByRole("button", { name: "Le contour" }))

    // Rien n'est posé : la couleur montrée est proposée, pas choisie.
    expect(
      await within(colonne()).findByText("proposé, d'après ta palette · la plus sombre"),
    ).toBeTruthy()
    expect(within(colonne()).getByText("#241d16 · dans la palette")).toBeTruthy()

    const hexa = within(colonne()).getAllByLabelText("Couleur, en hexadécimal")[0]
    fireEvent.change(hexa, { target: { value: "#ff00ff" } })

    await waitFor(() => expect(dernierePose(appels)?.contours?.couleur).toBe("#ff00ff"))
    expect(within(colonne()).getByText("#ff00ff · hors palette")).toBeTruthy()
    // La proposition ne se redit pas une fois la couleur posée.
    expect(
      within(colonne()).queryByText("proposé, d'après ta palette · la plus sombre"),
    ).toBeNull()
  })

  test("la palette entière se prend à la pastille, pas seulement ses douze premières", async () => {
    const { appels } = monter()
    fireEvent.click(within(barre()).getByRole("button", { name: "Le contour" }))
    fireEvent.click(
      await within(colonne()).findByRole("button", { name: "Prendre #8a5a2c" }),
    )
    await waitFor(() => expect(dernierePose(appels)?.contours?.couleur).toBe("#8a5a2c"))
  })
})

// ── AU15 · la porte de la retouche vers un équipement ──────────────────────
//
// L'écran d'association existe et distingue déjà référence, personnage équipé
// et calque transparent (`AssocierImageEquipement.tsx`, essayé dans
// `CalquesCibles.test.tsx`). Ce qui n'était pas mesuré, c'est la porte : le
// bouton de la retouche qui y mène, et son absence quand aucun jeu n'est ouvert.
describe("associer le rendu à une pièce", () => {
  test("le bouton mène à l'association, sans rien enregistrer d'autre", () => {
    const onAssocierEquipement = vi.fn()
    monter({ onAssocierEquipement })
    fireEvent.click(screen.getByRole("button", { name: "Associer à un équipement" }))
    expect(onAssocierEquipement).toHaveBeenCalledTimes(1)
  })

  test("sans jeu ouvert, la retouche n'invente pas cette porte", () => {
    monter()
    expect(screen.queryByRole("button", { name: "Associer à un équipement" })).toBeNull()
  })
})
