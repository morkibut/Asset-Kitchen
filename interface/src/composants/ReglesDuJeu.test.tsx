// Le parcours des règles du jeu (B14). Aucun de ces essais ne coûte un
// centime : `fetch` est doublé à la main, route par route — jamais de serveur,
// jamais de réseau. Le double **jette sur une route non doublée**, si bien qu'un
// appel imprévu se voit au lieu de renvoyer `undefined` en silence.
//
// **Les deux essais les plus importants du fichier :**
//
// 1. *Les sept cases voyagent, toujours* — le même piège qu'en `B9.7` : `PUT
//    /universe` remplace `bible` en entier dès que la clé est là. Un écran qui
//    ne renverrait que les cinq cases qu'il montre effacerait les deux autres,
//    et avec elles le texte d'auteur devenu inerte que la tranche s'est promis
//    de ne pas jeter.
// 2. *Le texte de caméra montré est celui du serveur* — la chaîne servie par
//    `/api/universe/views`, au caractère près. Une paraphrase à l'écran serait
//    devenue fausse au premier mot changé dans `atelier/domaine/vue.py`.

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, test, vi } from "vitest"

import { ReglesDuJeu, dossierPrevu } from "./ReglesDuJeu"
import { UNIVERS_VIDE, type Champ, type Univers, type VueDuJeu } from "../api"

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

// ── Les données du jeu doublé ───────────────────────────────────────────────

const CHAMPS_BIBLE = [
  "monde",
  "epoque",
  "rendu",
  "trait",
  "eclairage",
  "vue",
  "technique",
] as const

function bibleVide(): Champ[] {
  return CHAMPS_BIBLE.map((nom) => ({ nom, texte: "", actif: true }))
}

/** Les deux vues du décor. **Leurs textes sont ceux du serveur, recopiés du
 *  domaine** (`atelier/domaine/vue.py`) : un essai qui inventerait sa propre
 *  phrase de caméra vérifierait que l'écran sait afficher une chaîne, pas qu'il
 *  affiche la bonne. */
const VUE_DESSUS: VueDuJeu = {
  identifiant: "vue-dessus-verticale",
  libelle: "De dessus, verticale",
  exemples: "les jeux de tir à défilement vertical",
  images: 1,
  phrase: "strict top-down view seen from directly above",
  directions: [],
  contrainte:
    "CAMERA — this overrides everything above. The camera is directly overhead, " +
    "looking straight down at the ground at 90 degrees.",
  volume:
    "You are looking down onto the subject's upper surface: its top face is what " +
    "fills the sprite.",
  corps:
    "On a character, that means the top of the head and the shoulders, never the face.",
}

const VUE_COTE: VueDuJeu = {
  identifiant: "vue-cote-plateforme",
  libelle: "De côté — plateforme",
  exemples: "Mario, Celeste, Hollow Knight",
  images: 2,
  phrase: "side view, orthographic, subject centered",
  directions: [],
  contrainte:
    "CAMERA — this overrides everything above. The camera is at the subject's own " +
    "height and looks at it from the side, in pure profile.",
  volume: "You see one whole flank of the subject.",
  corps: "On a character, that means a pure profile, head to feet.",
}

/** La jumelle de `VUE_COTE` — **même consigne de caméra, mot pour mot**. Le
 *  domaine en porte vraiment deux dans ce cas, et la planche le signale. */
const VUE_DEFILEMENT: VueDuJeu = {
  ...VUE_COTE,
  identifiant: "vue-cote-defilement",
  libelle: "De côté — défilement",
  exemples: "les jeux de baston de rue",
}

const VUES = [VUE_DESSUS, VUE_COTE, VUE_DEFILEMENT]

type Appel = { url: string; methode: string; corps: unknown }

/** Un double de `fetch` qui rejoue, pour les seules routes que ce parcours
 *  appelle, ce que le serveur répond — le bloc `atelier` compris, qui est la
 *  moitié serveur de la tranche. */
function construireDouble(
  options: {
    univers?: Partial<Univers>
    sansEffet?: Record<string, string>
    /** Les jeux déjà nommés — le double y cherche un homonyme, comme le
     *  service, pour que l'avertissement soit joué et pas seulement affiché. */
    jeux?: string[]
  } = {},
) {
  let univers: Univers = {
    ...UNIVERS_VIDE,
    bible: bibleVide(),
    ...options.univers,
  }
  let sansEffet = { ...(options.sansEffet ?? {}) }
  const jeux = [...(options.jeux ?? [])]
  const appels: Appel[] = []

  const memeNom = (un: string, autre: string) =>
    un.split(/\s+/).join(" ").toLocaleLowerCase() ===
    autre.split(/\s+/).join(" ").toLocaleLowerCase()

  const universJson = () => ({
    projet: "le-marais",
    univers,
    atelier: { champs: ["rendu", "vue"], sans_effet: sansEffet },
    fond_propose: { couleur: "", distance: 0 },
    artworks: [],
  })

  const rendre = (charge: unknown) =>
    ({ ok: true, status: 200, json: async () => charge }) as Response

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

    if (url === "/api/universe/views" && methode === "GET") {
      return rendre({
        vues: VUES,
        tailles: [
          { cible: 32, quoi: "Les personnages de l'époque 16 bits." },
          { cible: 64, quoi: "Personnages très détaillés, petits boss." },
        ],
        finesses: [{ cible: 512, quoi: "La finesse courante d'un personnage." }],
      })
    }

    if (url === "/api/labels" && methode === "GET") {
      return rendre({
        etiquettes: [
          {
            identifiant: "trait-net",
            libelle: "trait net",
            texte: "clean line",
            case: "trait",
            emplois: 3,
            livree: true,
            oubliee: false,
          },
        ],
      })
    }

    if (url === "/api/labels/trait-net/used" && methode === "POST") {
      return rendre({ etiquettes: [] })
    }

    if (url === "/api/universe" && methode === "GET") return rendre(universJson())

    if (url === "/api/universe" && methode === "PUT") {
      const body = corps as Partial<Univers> & { bible?: Champ[] }
      // Le serveur remplace la bible en entier dès que la clé est là — le
      // double le fait aussi, sans quoi l'essai du piège ne prouverait rien.
      if (body.bible) {
        univers = { ...univers, bible: body.bible }
        sansEffet = Object.fromEntries(
          body.bible
            .filter((c) => ["rendu", "vue"].includes(c.nom) && c.texte.trim())
            .map((c) => [c.nom, c.texte.trim()]),
        )
      }
      for (const cle of ["style", "cible_px", "vue", "methode_pixels"] as const) {
        if (body[cle] !== undefined) univers = { ...univers, [cle]: body[cle] }
      }
      // Les deux phrases de l'atelier se recalculent, comme au serveur.
      const laVue = VUES.find((v) => v.identifiant === univers.vue)
      univers = {
        ...univers,
        phrases: {
          ...(univers.style === "pixel" && univers.cible_px
            ? { rendu: `2D pixel art on a ${univers.cible_px}x${univers.cible_px} grid` }
            : {}),
          ...(laVue ? { vue: laVue.phrase } : {}),
        },
      }
      return rendre(universJson())
    }

    if (url === "/api/projects" && methode === "POST") {
      const nom = (corps as { nom: string }).nom
      const homonyme = jeux.find((j) => memeNom(j, nom))
      jeux.push(nom)
      return rendre({
        projet: { identifiant: dossierPrevu(nom), nom },
        avertissement: homonyme
          ? `Un autre jeu s'appelle déjà « ${homonyme} ».`
          : "",
        bibliotheque: { projets: [], sans_projet: {}, courant: dossierPrevu(nom) },
      })
    }

    if (url.startsWith("/api/projects/") && methode === "PUT") {
      const nom = (corps as { nom: string }).nom
      const homonyme = jeux.find((j) => memeNom(j, nom))
      return rendre({
        projet: { identifiant: url.slice("/api/projects/".length), nom },
        avertissement: homonyme ? `Un autre jeu s'appelle déjà « ${homonyme} ».` : "",
        bibliotheque: { projets: [], sans_projet: {}, courant: "le-marais" },
      })
    }

    throw new Error(`route non doublée dans cet essai : ${methode} ${url}`)
  })

  return { fetchDouble, appels, universLu: () => univers }
}

function monter(
  fetchDouble: ReturnType<typeof construireDouble>["fetchDouble"],
  surplus: {
    mode?: "creation" | "reglages"
    nomDuJeu?: string
    dossierDuJeu?: string | null
  } = {},
) {
  const onFerme = vi.fn()
  const onCree = vi.fn()
  const onRenomme = vi.fn()
  const onErreur = vi.fn()
  vi.stubGlobal("fetch", fetchDouble)
  render(
    <ReglesDuJeu
      mode={surplus.mode ?? "reglages"}
      nomDuJeu={surplus.nomDuJeu ?? "Le Marais"}
      dossierDuJeu={surplus.dossierDuJeu === undefined ? "le-marais" : surplus.dossierDuJeu}
      onFerme={onFerme}
      onCree={onCree}
      onRenomme={onRenomme}
      onErreur={onErreur}
    />,
  )
  return { onFerme, onCree, onRenomme, onErreur }
}

/** Ouvrir une des quatre étapes depuis la barre du haut. */
function ouvrir(titre: string) {
  fireEvent.click(screen.getByRole("button", { name: new RegExp(`${titre}$`) }))
}

// ── Le piège — le plus important ────────────────────────────────────────────

describe("le piège du PATCH partiel sur la bible", () => {
  test("écrire une ligne du monde renvoie les sept cases, pas les cinq montrées", async () => {
    const { fetchDouble, appels } = construireDouble({
      univers: {
        bible: [
          ...bibleVide().filter((c) => !["rendu", "vue"].includes(c.nom)),
          { nom: "rendu", texte: "gros pixels", actif: true },
          { nom: "vue", texte: "vu du ciel", actif: true },
        ],
      },
      sansEffet: { rendu: "gros pixels", vue: "vu du ciel" },
    })
    monter(fetchDouble)

    ouvrir("Son monde")
    fireEvent.click(await screen.findByRole("button", { name: /^monde/ }))
    const champ = await screen.findByRole("textbox", { name: "La ligne « monde »" })
    fireEvent.change(champ, { target: { value: "marais brumeux" } })
    fireEvent.blur(champ)

    await waitFor(() =>
      expect(appels.some((a) => a.url === "/api/universe" && a.methode === "PUT")).toBe(true),
    )
    const envoi = appels.find((a) => a.url === "/api/universe" && a.methode === "PUT")!
    const bible = (envoi.corps as { bible: Champ[] }).bible

    expect(bible).toHaveLength(7)
    expect(bible.find((c) => c.nom === "monde")?.texte).toBe("marais brumeux")
    // **Les deux cases de l'atelier voyagent avec leur texte devenu inerte** :
    // les omettre les aurait effacées du fichier au premier `Enregistrer`.
    expect(bible.find((c) => c.nom === "rendu")?.texte).toBe("gros pixels")
    expect(bible.find((c) => c.nom === "vue")?.texte).toBe("vu du ciel")
  })
})

// ── Les deux cases que l'atelier écrit ──────────────────────────────────────

describe("les cases que l'atelier écrit seul", () => {
  test("le rendu et la vue ne sont pas des champs — ils renvoient à leur étape", async () => {
    const { fetchDouble } = construireDouble({
      univers: { vue: "vue-dessus-verticale", phrases: { vue: VUE_DESSUS.phrase } },
    })
    monter(fetchDouble)

    ouvrir("Son monde")

    // Les cinq autres s'ouvrent et se tapent.
    expect(await screen.findByRole("button", { name: /^monde/ })).toBeTruthy()
    // Les deux-là n'ont aucun champ, et disent où aller.
    const laVue = await screen.findByText(VUE_DESSUS.phrase)
    expect(laVue).toBeTruthy()
    expect(screen.getByRole("button", { name: "étape sa vue ›" })).toBeTruthy()
    expect(screen.getByRole("button", { name: "étape son allure ›" })).toBeTruthy()
  })

  test("le texte d'auteur qui ne part plus est montré barré, jamais effacé", async () => {
    const { fetchDouble } = construireDouble({
      sansEffet: { vue: "vu du ciel, bien au-dessus" },
    })
    monter(fetchDouble)

    ouvrir("Son monde")

    const raye = await screen.findByText("vu du ciel, bien au-dessus")
    expect(raye.tagName).toBe("S")
  })

  test("sans rien tapé là, aucune rature n'est dessinée", async () => {
    const { fetchDouble } = construireDouble()
    monter(fetchDouble)

    ouvrir("Son monde")
    await screen.findByRole("button", { name: /^monde/ })

    expect(screen.queryByText(/ne part plus/)).toBeNull()
  })

  test("cliquer l'étape d'une case de l'atelier y mène vraiment", async () => {
    const { fetchDouble } = construireDouble()
    monter(fetchDouble)

    ouvrir("Son monde")
    fireEvent.click(await screen.findByRole("button", { name: "étape sa vue ›" }))

    expect(await screen.findByText("D'où regarde-t-on ce jeu ?")).toBeTruthy()
  })
})

// ── Le texte de caméra ──────────────────────────────────────────────────────

describe("le texte de caméra", () => {
  test("il est celui du serveur, au caractère près — jamais une paraphrase", async () => {
    const { fetchDouble } = construireDouble({
      univers: { vue: "vue-dessus-verticale" },
    })
    monter(fetchDouble)

    ouvrir("Sa vue")

    // Les trois morceaux, littéralement ceux que le serveur sert.
    expect(await screen.findByText(VUE_DESSUS.contrainte)).toBeTruthy()
    expect(screen.getByText(VUE_DESSUS.volume)).toBeTruthy()
    expect(screen.getByText(new RegExp(VUE_DESSUS.corps.slice(0, 40)))).toBeTruthy()
  })

  test("sans vue choisie, rien n'est écrit — et l'écran le dit", async () => {
    const { fetchDouble } = construireDouble()
    monter(fetchDouble)

    ouvrir("Sa vue")

    expect(
      await screen.findByText(/Sans vue choisie, l'atelier n'écrit rien/),
    ).toBeTruthy()
    // Et surtout : aucun texte de caméra n'est montré, puisqu'aucun ne partira.
    expect(screen.queryByText(VUE_DESSUS.contrainte)).toBeNull()
  })

  test("deux vues qui écrivent la même consigne le disent, et c'est calculé", async () => {
    const { fetchDouble } = construireDouble({
      univers: { vue: "vue-cote-plateforme" },
    })
    monter(fetchDouble)

    ouvrir("Sa vue")

    // La phrase se déduit de l'égalité des textes servis : elle disparaîtra
    // d'elle-même le jour où le domaine fera diverger les deux vues.
    expect(
      await screen.findByText(/« De côté — défilement » écrit la même consigne/),
    ).toBeTruthy()
  })

  test("choisir une vue l'écrit par le seul chemin d'écriture", async () => {
    const { fetchDouble, appels } = construireDouble()
    monter(fetchDouble)

    ouvrir("Sa vue")
    fireEvent.click(await screen.findByRole("button", { name: "De dessus, verticale" }))

    await waitFor(() =>
      expect(
        appels.some(
          (a) =>
            a.url === "/api/universe" &&
            a.methode === "PUT" &&
            (a.corps as { vue?: string }).vue === "vue-dessus-verticale",
        ),
      ).toBe(true),
    )
  })
})

// ── L'allure ────────────────────────────────────────────────────────────────

describe("l'étape de l'allure", () => {
  test("en dessin, la pixelisation disparaît — le style commande", async () => {
    const { fetchDouble } = construireDouble({ univers: { style: "dessin" } })
    monter(fetchDouble)

    ouvrir("Son allure")

    await screen.findByRole("button", { name: "Dessin" })
    expect(screen.queryByText(/La pixelisation/)).toBeNull()
    // Et l'échelle proposée est celle des finesses, pas celle des carrés.
    expect(screen.getByText(/La finesse/)).toBeTruthy()
  })

  test("en pixel, la taille et la méthode sont là toutes les deux", async () => {
    const { fetchDouble } = construireDouble({ univers: { style: "pixel", cible_px: 64 } })
    monter(fetchDouble)

    ouvrir("Son allure")

    expect(await screen.findByText(/La taille — le côté du sprite/)).toBeTruthy()
    expect(screen.getByText(/La pixelisation/)).toBeTruthy()
    expect(screen.getByRole("button", { name: "au plus proche" })).toBeTruthy()
  })
})

// ── Le nom, le dossier, l'homonyme ──────────────────────────────────────────

describe("le nom et son dossier", () => {
  test("le dossier prévu se dérive du nom, accents dépliés", () => {
    expect(dossierPrevu("Le Marais du Vieux Moulin")).toBe("le-marais-du-vieux-moulin")
    expect(dossierPrevu("Forêt d'Émeraude")).toBe("foret-d-emeraude")
    // Un nom qui ne laisse aucune lettre retombe sur le défaut du serveur.
    expect(dossierPrevu("日本")).toBe("projet")
  })

  test("créer un jeu du nom d'un autre montre l'avertissement du serveur", async () => {
    const { fetchDouble } = construireDouble({ jeux: ["Le Marais"] })
    const { onCree } = monter(fetchDouble, {
      mode: "creation",
      nomDuJeu: "",
      dossierDuJeu: null,
    })

    const champ = screen.getByRole("textbox", { name: "Le nom du jeu" })
    fireEvent.change(champ, { target: { value: "le  marais" } })
    fireEvent.click(screen.getByRole("button", { name: "Créer et choisir son allure" }))

    // La phrase vient du serveur — l'écran ne la compose pas.
    expect(
      await screen.findByText(/Un autre jeu s'appelle déjà « Le Marais »/),
    ).toBeTruthy()
    expect(onCree).toHaveBeenCalledWith("le-marais")
  })

  test("l'avertissement se lit avant qu'on avance, et il ne bloque rien", async () => {
    // **Trouvé par l'essai précédent, et verrouillé ici.** Le premier clic
    // créait le jeu *et* changeait d'étape : la phrase d'homonyme était écrite
    // sur un écran qu'on venait de quitter. Le premier clic s'arrête donc pour
    // la montrer ; le second continue, parce que rien n'est refusé.
    const { fetchDouble } = construireDouble({ jeux: ["Le Marais"] })
    monter(fetchDouble, { mode: "creation", nomDuJeu: "", dossierDuJeu: null })

    fireEvent.change(screen.getByRole("textbox", { name: "Le nom du jeu" }), {
      target: { value: "Le Marais" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Créer et choisir son allure" }))

    await screen.findByText(/Un autre jeu s'appelle déjà/)
    // On est encore sur l'étape du nom, et le bouton dit que le jeu existe déjà.
    expect(screen.getByText("Comment s'appelle ce jeu ?")).toBeTruthy()

    fireEvent.click(await screen.findByRole("button", { name: "Choisir son allure" }))
    expect(await screen.findByText("Quelle allure a ce jeu ?")).toBeTruthy()
  })

  test("un nom libre n'avertit de rien", async () => {
    const { fetchDouble } = construireDouble({ jeux: ["Les Salines"] })
    monter(fetchDouble, { mode: "creation", nomDuJeu: "", dossierDuJeu: null })

    fireEvent.change(screen.getByRole("textbox", { name: "Le nom du jeu" }), {
      target: { value: "Le Marais" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Créer et choisir son allure" }))

    await waitFor(() => expect(screen.queryByText(/s'appelle déjà/)).toBeNull())
  })

  test("le dossier prévu s'affiche avant que le jeu existe, et se fige après", async () => {
    const { fetchDouble } = construireDouble()
    monter(fetchDouble, { mode: "creation", nomDuJeu: "", dossierDuJeu: null })

    fireEvent.change(screen.getByRole("textbox", { name: "Le nom du jeu" }), {
      target: { value: "Le Marais" },
    })
    expect(screen.getByText("le-marais")).toBeTruthy()
    expect(screen.getByText(/il ne changera plus jamais/)).toBeTruthy()
  })
})

// ── Les deux entrées, un seul parcours ──────────────────────────────────────

describe("un seul parcours, deux entrées", () => {
  test("la création déroule les quatre étapes ; les règles ouvrent sur leur liste", async () => {
    const premier = construireDouble()
    monter(premier.fetchDouble, { mode: "creation", nomDuJeu: "", dossierDuJeu: null })
    // En création, l'étape du nom est ouverte d'emblée.
    expect(screen.getByText("Comment s'appelle ce jeu ?")).toBeTruthy()
    cleanup()

    const second = construireDouble()
    monter(second.fetchDouble, { mode: "reglages" })
    // En réglages, on ouvre sur la liste des quatre — aucune n'est dépliée.
    expect(screen.queryByText("Comment s'appelle ce jeu ?")).toBeNull()
    expect(await screen.findByText(/S'applique à tout le jeu/)).toBeTruthy()
  })

  test("les deux modes écrivent par la même route et le même message", async () => {
    const enCreation = construireDouble()
    monter(enCreation.fetchDouble, { mode: "creation", nomDuJeu: "", dossierDuJeu: null })
    fireEvent.change(screen.getByRole("textbox", { name: "Le nom du jeu" }), {
      target: { value: "Le Marais" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Créer et choisir son allure" }))
    fireEvent.click(await screen.findByRole("button", { name: /Sa vue$/ }))
    fireEvent.click(await screen.findByRole("button", { name: "De dessus, verticale" }))
    await waitFor(() =>
      expect(
        enCreation.appels.some((a) => a.url === "/api/universe" && a.methode === "PUT"),
      ).toBe(true),
    )
    const parLaCreation = enCreation.appels.find(
      (a) => a.url === "/api/universe" && a.methode === "PUT",
    )!
    cleanup()

    const enReglages = construireDouble()
    monter(enReglages.fetchDouble, { mode: "reglages" })
    ouvrir("Sa vue")
    fireEvent.click(await screen.findByRole("button", { name: "De dessus, verticale" }))
    await waitFor(() =>
      expect(
        enReglages.appels.some((a) => a.url === "/api/universe" && a.methode === "PUT"),
      ).toBe(true),
    )
    const parLesReglages = enReglages.appels.find(
      (a) => a.url === "/api/universe" && a.methode === "PUT",
    )!

    // **Un seul chemin d'écriture** — même route, même méthode, même message.
    expect(parLesReglages.url).toBe(parLaCreation.url)
    expect(parLesReglages.methode).toBe(parLaCreation.methode)
    expect(parLesReglages.corps).toEqual(parLaCreation.corps)
  })

  test("chacune des quatre étapes se saute, et le jeu se crée sans en régler une", async () => {
    const { fetchDouble, appels } = construireDouble()
    const { onCree, onFerme } = monter(fetchDouble, {
      mode: "creation",
      nomDuJeu: "",
      dossierDuJeu: null,
    })

    fireEvent.change(screen.getByRole("textbox", { name: "Le nom du jeu" }), {
      target: { value: "Tout neuf" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Créer et choisir son allure" }))
    await waitFor(() => expect(onCree).toHaveBeenCalled())

    // Les trois pas suivants, sautés l'un après l'autre.
    fireEvent.click(await screen.findByRole("button", { name: "Passer à sa vue" }))
    fireEvent.click(await screen.findByRole("button", { name: "Passer à son monde" }))
    fireEvent.click(await screen.findByRole("button", { name: "Ouvrir le jeu" }))

    expect(onFerme).toHaveBeenCalled()
    // Le jeu existe, et **aucun réglage n'a été écrit** — pas un seul `PUT`.
    expect(appels.some((a) => a.url === "/api/projects" && a.methode === "POST")).toBe(true)
    expect(appels.some((a) => a.url === "/api/universe" && a.methode === "PUT")).toBe(false)
  })
})
