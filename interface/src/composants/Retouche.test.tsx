// Ce que l'écran de la retouche montre (B16) : les huit tables dans leur ordre,
// le trait, les deux fabriques à droite de lui, la raison écrite à côté de
// chaque grisé, la jauge au-delà de 240 ms, et le témoin avant/après.
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

import { Retouche } from "./Retouche"
import {
  RECETTE_VIDE,
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
    bible: [],
    bareme: [],
    style: "pixel",
    cible_px: 64,
    vue: "",
    couleurs: 24,
    methode_pixels: "proche",
    palette: ["#241d16", "#8a5a2c"],
    palette_empreinte: "",
    fond: "#ff00ff",
    modeles: {},
    ...surplus,
  } as unknown as Univers
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

function construireDouble(mesures: unknown = MESURES) {
  const appels: { url: string; methode: string; corps: unknown }[] = []
  const rendre = (charge: unknown) =>
    ({
      ok: true,
      status: 200,
      json: async () => charge,
    }) as Response
  const fetchDouble = vi.fn(async (entree: unknown, options?: RequestInit) => {
    const url = String(entree)
    appels.push({
      url,
      methode: options?.method ?? "GET",
      corps: options?.body ? JSON.parse(String(options.body)) : null,
    })
    if (url.includes("/spots")) return rendre(mesures)
    return rendre(image({ recette: recetteDeTravail() }))
  })
  return { fetchDouble, appels }
}

function monter(
  surplus: { asset?: Asset; mesures?: unknown; univers?: Univers } = {},
) {
  const { fetchDouble, appels } = construireDouble(surplus.mesures ?? MESURES)
  vi.stubGlobal("fetch", fetchDouble)
  const onFermer = vi.fn()
  const onDecouper = vi.fn()
  const onSuperposer = vi.fn()
  const onErreur = vi.fn()
  render(
    <Retouche
      asset={surplus.asset ?? image({ recette: recetteDeTravail() })}
      univers={surplus.univers ?? univers()}
      traitement={TRAITEMENT}
      onFermer={onFermer}
      onDecouper={onDecouper}
      onSuperposer={onSuperposer}
      onErreur={onErreur}
    />,
  )
  return { onFermer, onDecouper, onSuperposer, onErreur, appels }
}

const barre = () => document.querySelector("[data-barre-des-tables]") as HTMLElement
const colonne = () =>
  document.querySelector("[data-reglages-de-la-table]") as HTMLElement

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
    const pose = appels.filter((a) => a.methode === "PUT").at(-1)
    expect((pose?.corps as { grille: { cible: number } }).grille.cible).toBe(2048)
  })
})

describe("le grossissement dit ce qu'il fait vraiment", () => {
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

  test("une image qui ne tient pas au cadre n'offre aucun cran, et le dit", async () => {
    // ⚠️ Vu au navigateur sur un jeu en dessin : l'écran affichait ×4 pendant
    // que le cadre réduisait une image de 2 048 px au cinquième. *Un chiffre
    // affiché est un chiffre compté* (`docs/DESIGN.md`, règle 5).
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
      await waitFor(() =>
        expect(document.querySelector("[data-zoom-impossible]")).toBeTruthy(),
      )
      expect(document.querySelector("[data-zoom]")).toBeNull()
      expect(
        document.querySelector("[data-zoom-impossible]")?.textContent,
      ).toContain("réduite pour tenir")
    } finally {
      rendre()
    }
  })

  test("une vignette de 64 px garde ses quatre crans", async () => {
    const rendre = cadreDe(600)
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
      const crans = await waitFor(() => {
        const z = document.querySelector("[data-zoom]")
        expect(z).toBeTruthy()
        return [...(z as HTMLElement).querySelectorAll("button")].map((b) =>
          b.textContent?.trim(),
        )
      })
      expect(crans).toEqual(["×1", "×2", "×4", "×8"])
    } finally {
      rendre()
    }
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
        univers={univers()}
        traitement={TRAITEMENT}
        onFermer={vi.fn()}
        onDecouper={vi.fn()}
        onSuperposer={vi.fn()}
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
        univers={univers()}
        traitement={TRAITEMENT}
        onFermer={vi.fn()}
        onDecouper={vi.fn()}
        onSuperposer={vi.fn()}
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

describe("le témoin avant / après", () => {
  test("les trois valeurs sont là, et « Après » est le repos", () => {
    monter()
    const temoin = document.querySelector("[data-temoin]") as HTMLElement
    for (const nom of ["Avant", "Les deux", "Après"])
      expect(within(temoin).getByRole("button", { name: nom })).toBeTruthy()
    expect(
      within(temoin).getByRole("button", { name: "Après" }).getAttribute("aria-pressed"),
    ).toBe("true")
  })

  test("« Les deux » montre les deux images, et « Avant » la seule brute", () => {
    monter()
    const temoin = document.querySelector("[data-temoin]") as HTMLElement
    const scene = () => document.querySelector("[data-scene-de-retouche]") as HTMLElement

    fireEvent.click(within(temoin).getByRole("button", { name: "Les deux" }))
    expect(scene().querySelectorAll("img").length).toBe(2)

    fireEvent.click(within(temoin).getByRole("button", { name: "Avant" }))
    const seule = scene().querySelectorAll("img")
    expect(seule.length).toBe(1)
    expect(seule[0].getAttribute("alt")).toMatch(/avant/)
  })

  test("changer de témoin ne retire aucun réglage", () => {
    // **Une comparaison ne retire jamais un geste ; elle pose un témoin à
    // côté.** C'est la règle que la V2.1 a payée, et elle vaut ici aussi.
    monter()
    const temoin = document.querySelector("[data-temoin]") as HTMLElement
    fireEvent.click(within(temoin).getByRole("button", { name: "Les deux" }))
    expect(within(colonne()).getByRole("button", { name: "bord" })).toBeTruthy()
  })
})

describe("une place s'éteint sans se vider", () => {
  test("l'interrupteur envoie la veille et ne touche à aucune valeur", async () => {
    const { appels } = monter()
    fireEvent.click(within(barre()).getByRole("button", { name: "Recadrer" }))
    fireEvent.click(await within(colonne()).findByRole("button", { name: "L'endormir" }))

    const pose = appels.filter((a) => a.methode === "PUT").at(-1)
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

  test("les deux fabriques ne portent pas d'interrupteur", () => {
    monter()
    fireEvent.click(within(barre()).getByRole("button", { name: "Découper" }))
    expect(within(colonne()).queryByRole("button", { name: "L'endormir" })).toBeNull()
    expect(within(colonne()).getByText(/il n'y a rien à éteindre/i)).toBeTruthy()
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

describe("les deux fabriques mènent aux écrans qui existent", () => {
  test("« Découper » et « Superposer » appellent chacune la sienne", () => {
    const { onDecouper, onSuperposer } = monter()

    fireEvent.click(within(barre()).getByRole("button", { name: "Découper" }))
    fireEvent.click(within(colonne()).getByRole("button", { name: /L'ouvrir/ }))
    expect(onDecouper).toHaveBeenCalled()

    fireEvent.click(within(barre()).getByRole("button", { name: "Superposer" }))
    fireEvent.click(within(colonne()).getByRole("button", { name: /L'ouvrir/ }))
    expect(onSuperposer).toHaveBeenCalled()
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
    fireEvent.click(within(barre()).getByRole("button", { name: "La main" }))

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
