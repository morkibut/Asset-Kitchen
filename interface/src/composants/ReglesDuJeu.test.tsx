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

import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { afterEach, describe, expect, test, vi } from "vitest"

import { ReglesDuJeu, _reinitialiserCacheApercuAllurePourEssais, dossierPrevu } from "./ReglesDuJeu"
import { UNIVERS_VIDE, type Champ, type Univers, type VueDuJeu } from "../api"
import type { MoteurParFamille, MoteurSonore, ProfilWorkflow } from "../api-workflows"

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  // Le cache des vignettes d'aperçu vit au niveau du module (RT2) : sans ce
  // vidage, un essai qui simule une méthode absente verrait le succès mémorisé
  // par l'essai précédent au lieu de son propre refus doublé.
  _reinitialiserCacheApercuAllurePourEssais()
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
    /** Ce que le double répond à `POST /api/board/realign`. */
    realignement?: { realignes: number; conserves: number; sur_grille: boolean }
    /** Les jeux déjà nommés — le double y cherche un homonyme, comme le
     *  service, pour que l'avertissement soit joué et pas seulement affiché. */
    jeux?: string[]
    /** Les méthodes sonores installées (SN1) — nature « audio » seulement,
     *  comme `workflows.lister()` filtré par l'écran. */
    profilsAudio?: ProfilWorkflow[]
    /** Le moteur par défaut de chaque famille de sons (SN2), tel que
     *  `GET /workflow-profiles/sound-defaults` le rend. */
    moteursParFamille?: Record<string, MoteurParFamille>
    /** MO4/MO7 : le catalogue des moteurs sonores (`GET
     *  /workflow-profiles/sound-engines`) — d'où vient le nom d'un moteur
     *  possible pour une famille mais pas encore installé. */
    moteursSonores?: MoteurSonore[]
    /** RT2 : la seule méthode de pixelisation que la machine doublée n'a pas —
     *  comme `pixeloe` sans `torch` sur la vraie machine de l'auteur. Le
     *  double répond alors le refus nommé que rend la route, pour la seule
     *  méthode citée. */
    methodeApercuAbsente?: string
    /** RT6 : le total que `GET /assets` rend pour le jeu ouvert — zéro par
     *  défaut, comme un jeu neuf sans image. */
    nombreDImages?: number
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
      for (const cle of [
        "style",
        "cible_px",
        "vue",
        "methode_pixels",
        // **Les deux réglages relogés de l'assistant par `C2`** : le nombre de
        // couleurs et la couleur de fond. Le double les pose comme le serveur,
        // sans quoi l'essai ne prouverait que l'appel, jamais l'affichage.
        "couleurs",
        "fond",
      ] as const) {
        if (body[cle] !== undefined) univers = { ...univers, [cle]: body[cle] }
      }
      // **Le bloc sonore (SN2)** — comme le service : ce qui n'est pas envoyé
      // ne bouge pas, un moteur se pose famille par famille.
      const corpsSon = (body as { son?: Partial<Univers["son"]> }).son
      if (corpsSon) {
        univers = {
          ...univers,
          son: {
            champs: corpsSon.champs ?? univers.son.champs,
            tonalite: corpsSon.tonalite !== undefined ? (corpsSon.tonalite ?? "") : univers.son.tonalite,
            tempo: corpsSon.tempo !== undefined ? corpsSon.tempo : univers.son.tempo,
            moteurs: corpsSon.moteurs ? { ...univers.son.moteurs, ...corpsSon.moteurs } : univers.son.moteurs,
          },
        }
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

    if (url === "/api/universe/realign" && methode === "POST") {
      return rendre(
        options.realignement ?? { realignes: 12, conserves: 3, sur_grille: true },
      )
    }

    if (url === "/api/workflow-profiles" && methode === "GET") {
      return rendre({ profils: options.profilsAudio ?? [] })
    }

    if (url.startsWith("/api/workflow-profiles/sound-defaults") && methode === "GET") {
      return rendre({ familles: options.moteursParFamille ?? {} })
    }

    if (url === "/api/workflow-profiles/sound-engines" && methode === "GET") {
      return rendre({ moteurs: options.moteursSonores ?? [] })
    }

    // **RT2 — l'aperçu de « Son allure ».** Chaque case de la rangée des
    // tailles, des méthodes et des couleurs appelle cette route pour son
    // compte : le double rejoue le même refus nommé que le serveur pour la
    // seule méthode citée par `methodeApercuAbsente`, et un PNG minuscule pour
    // le reste — jamais une image muette ni une route qui jette.
    if (url.startsWith("/api/universe/allure/preview.png") && methode === "GET") {
      const requete = new URLSearchParams(url.split("?")[1] ?? "")
      const methodeDemandee = requete.get("methode") ?? ""
      if (options.methodeApercuAbsente && methodeDemandee === options.methodeApercuAbsente) {
        return {
          ok: false,
          status: 400,
          json: async () => ({
            code: "apercu_refuse",
            raison: `« ${methodeDemandee} » n'est pas installée sur cette machine.`,
          }),
        } as Response
      }
      return {
        ok: true,
        status: 200,
        blob: async () => new Blob(["png"], { type: "image/png" }),
      } as unknown as Response
    }

    // RT6 : le compte d'images du jeu ouvert, lu par `SonAllure` avant
    // d'avertir sur un changement de taille.
    if (url === "/api/assets?limite=1" && methode === "GET") {
      return rendre({ assets: [], total: options.nombreDImages ?? 0 })
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
  // RT2 : chaque vignette d'aperçu se transforme en `blob:` — jsdom ne sait
  // pas fabriquer cette adresse tout seul, et sa valeur ne compte pour aucun
  // essai, seule son existence compte.
  vi.spyOn(URL, "createObjectURL").mockImplementation(() => "blob:apercu-allure")
  vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined)
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

    expect(await screen.findByText(/La taille — le côté de l'image/)).toBeTruthy()
    expect(screen.getByText(/La pixelisation/)).toBeTruthy()
    expect(screen.getByRole("button", { name: "au plus proche" })).toBeTruthy()
  })
})

// ── Les trois rangées montrent ce qu'elles font (RT2) ───────────────────────
//
// RT1 a ouvert `GET /universe/allure/preview.png` ; ces essais vérifient que
// les trois rangées de l'allure l'appellent — une image par choix, et qui
// correspond au choix qu'elle porte —, qu'elles se refont quand la taille
// change, qu'une méthode absente de la machine se lit sans casser la case, et
// qu'un style dessin ne demande aucun aperçu orphelin.

describe("les trois rangées montrent ce qu'elles font (RT2)", () => {
  test("chaque rangée demande une image par choix, à la bonne combinaison", async () => {
    const { fetchDouble, appels } = construireDouble({
      univers: { style: "pixel", cible_px: 64, methode_pixels: "vote", couleurs: 32 },
    })
    monter(fetchDouble)
    ouvrir("Son allure")

    // La méthode choisie porte son image, à la taille et aux couleurs posées.
    await screen.findByRole("img", { name: "Le rôdeur réduit par « contour net (recommandé) »" })

    const apercus = () => appels.filter((a) => a.url.startsWith("/api/universe/allure/preview.png"))
    await waitFor(() => expect(apercus().length).toBeGreaterThan(0))

    // La rangée des tailles : une demande par taille proposée (32 et 64, ici).
    expect(apercus().some((a) => a.url.includes("taille=32"))).toBe(true)
    expect(apercus().some((a) => a.url.includes("taille=64"))).toBe(true)
    // La rangée des méthodes : les quatre, à la taille posée (64).
    for (const m of ["vote", "pixeloe", "lanczos", "proche"]) {
      expect(apercus().some((a) => a.url.includes(`taille=64`) && a.url.includes(`methode=${m}`))).toBe(true)
    }
    // La rangée des couleurs : un palier par case, à la taille et la méthode
    // posées (64, vote).
    expect(
      apercus().some(
        (a) => a.url.includes("taille=64") && a.url.includes("methode=vote") && a.url.includes("couleurs=32"),
      ),
    ).toBe(true)
  })

  test("changer la taille refait la rangée des méthodes et celle des couleurs", async () => {
    const { fetchDouble, appels } = construireDouble({
      univers: { style: "pixel", cible_px: 64, methode_pixels: "vote", couleurs: 32 },
    })
    monter(fetchDouble)
    ouvrir("Son allure")

    await screen.findByRole("img", { name: "Le rôdeur réduit par « contour net (recommandé) »" })
    const compteAvant = appels.filter((a) => a.url.includes("taille=32") && a.url.includes("methode=")).length

    // Le double ne propose que deux tailles (32 et 64) — on clique l'autre.
    // **Dans le groupe des tailles seulement** : 32 est aussi un palier de
    // couleurs, et les deux rangées de cases se touchent.
    const tailles = within(screen.getByRole("group", { name: "La taille de l'image" }))
    fireEvent.click(tailles.getByRole("button", { name: "32" }))

    await waitFor(() =>
      expect(
        appels.filter((a) => a.url.includes("taille=32") && a.url.includes("methode=")).length,
      ).toBeGreaterThan(compteAvant),
    )
  })

  test("le choix retenu porte une marque, pas seulement un mot dessous", async () => {
    const { fetchDouble } = construireDouble({
      univers: { style: "pixel", cible_px: 64, methode_pixels: "lanczos" },
    })
    monter(fetchDouble)
    ouvrir("Son allure")

    // Les cases de taille et de méthode sont des `Choix` : `aria-pressed`
    // porte la sélection, comme le style et la vue ailleurs dans ce parcours.
    // **Dans le groupe des tailles** : 64 se retrouve aussi comme palier de
    // couleurs, et les deux rangées de cases se touchent.
    const tailles = within(await screen.findByRole("group", { name: "La taille de l'image" }))
    expect(tailles.getByRole("button", { name: "64" }).getAttribute("aria-pressed")).toBe("true")
    expect(
      screen.getByRole("button", { name: "réduction douce" }).getAttribute("aria-pressed"),
    ).toBe("true")
  })

  test("la rangée reste cliquable avant que les images soient revenues", async () => {
    // Un aperçu qui ne répond jamais pendant l'essai — pour prouver que le
    // clic n'attend pas la promesse.
    const attente: { resoudre: (() => void)[] } = { resoudre: [] }
    const { fetchDouble, appels } = construireDouble({
      univers: { style: "pixel", cible_px: 64 },
    })
    const fetchLent = vi.fn(async (chemin: unknown, init?: RequestInit) => {
      const url = String(chemin)
      if (url.startsWith("/api/universe/allure/preview.png")) {
        await new Promise<void>((r) => attente.resoudre.push(r))
        return { ok: true, status: 200, blob: async () => new Blob(["png"], { type: "image/png" }) } as unknown as Response
      }
      return fetchDouble(chemin, init)
    })
    monter(fetchLent)
    ouvrir("Son allure")

    // On clique une méthode avant qu'aucune image ne soit revenue.
    fireEvent.click(await screen.findByRole("button", { name: "au plus proche" }))

    await waitFor(() =>
      expect(
        appels.some(
          (a) =>
            a.url === "/api/universe" &&
            a.methode === "PUT" &&
            (a.corps as { methode_pixels?: string }).methode_pixels === "proche",
        ),
      ).toBe(true),
    )

    // Ménage : on libère les aperçus restés en attente.
    attente.resoudre.forEach((r) => r())
  })

  test("une méthode absente de la machine se lit, et sa case se ferme", async () => {
    const { fetchDouble } = construireDouble({
      univers: { style: "pixel", cible_px: 64 },
      methodeApercuAbsente: "pixeloe",
    })
    monter(fetchDouble)
    ouvrir("Son allure")

    const case_ = await screen.findByRole("button", { name: "traits épaissis" })
    await waitFor(() =>
      expect(screen.getByText(/« pixeloe » n'est pas installée sur cette machine/)).toBeTruthy(),
    )
    // **Elle ne rend rien qu'elle ne puisse tenir** : la méthode qu'on ne
    // peut pas prévisualiser est celle que la fabrication ne rendrait pas non
    // plus, puisque les deux partagent le même moteur — la case se ferme au
    // lieu de promettre un choix qu'elle ne peut pas honorer.
    expect(case_).toHaveProperty("disabled", true)

    // Les trois autres méthodes, elles, restent normales.
    expect(screen.getByRole("button", { name: "contour net (recommandé)" })).toHaveProperty("disabled", false)
  })

  test("en dessin, aucune vignette ne se demande — pas d'aperçu orphelin", async () => {
    const { fetchDouble, appels } = construireDouble({ univers: { style: "dessin" } })
    monter(fetchDouble)
    ouvrir("Son allure")

    await screen.findByRole("button", { name: "Dessin" })
    // Le temps qu'un aperçu, s'il devait partir, ait eu le temps de partir.
    await waitFor(() => expect(screen.getByText(/La finesse/)).toBeTruthy())

    expect(appels.some((a) => a.url.startsWith("/api/universe/allure/preview.png"))).toBe(false)
    expect(screen.queryByRole("img", { name: /Le rôdeur/ })).toBeNull()
  })
})

// ── Le garde-fou de la taille (RT6) ──────────────────────────────────────────
//
// Retiré de la configuration initiale par RT5, reposé ici : sur un jeu qui
// porte déjà des images, changer la taille les laisse à leur ancienne taille.
// L'avertissement se joue avant le réglage, avec le compte, et on peut passer
// outre — ce n'est pas une interdiction.

describe("le garde-fou de la taille (RT6)", () => {
  test("un jeu sans image ne demande rien : le réglage part tout de suite", async () => {
    const { fetchDouble, appels } = construireDouble({
      univers: { style: "pixel", cible_px: 64 },
      nombreDImages: 0,
    })
    const confirme = vi.spyOn(window, "confirm")
    monter(fetchDouble)
    ouvrir("Son allure")

    const tailles = within(await screen.findByRole("group", { name: "La taille de l'image" }))
    fireEvent.click(tailles.getByRole("button", { name: "32" }))

    await waitFor(() =>
      expect(
        appels.some(
          (a) =>
            a.url === "/api/universe" &&
            a.methode === "PUT" &&
            (a.corps as { cible_px?: number }).cible_px === 32,
        ),
      ).toBe(true),
    )
    expect(confirme).not.toHaveBeenCalled()
  })

  test("un jeu qui porte des images avertit avant, avec leur compte", async () => {
    const { fetchDouble, appels } = construireDouble({
      univers: { style: "pixel", cible_px: 64 },
      nombreDImages: 12,
    })
    const confirme = vi.spyOn(window, "confirm").mockReturnValue(true)
    monter(fetchDouble)
    ouvrir("Son allure")

    const tailles = within(await screen.findByRole("group", { name: "La taille de l'image" }))
    fireEvent.click(tailles.getByRole("button", { name: "32" }))

    // L'avertissement se lit sans connaître le produit : il nomme le compte
    // et ce qui arrive, pas un mécanisme interne.
    await waitFor(() => expect(confirme).toHaveBeenCalledTimes(1))
    expect(confirme.mock.calls[0][0]).toContain("12 images")
    expect(confirme.mock.calls[0][0]).toContain("ancienne taille")

    await waitFor(() =>
      expect(
        appels.some(
          (a) =>
            a.url === "/api/universe" &&
            a.methode === "PUT" &&
            (a.corps as { cible_px?: number }).cible_px === 32,
        ),
      ).toBe(true),
    )
  })

  test("passer outre l'avertissement pose quand même le réglage", async () => {
    const { fetchDouble } = construireDouble({
      univers: { style: "pixel", cible_px: 64 },
      nombreDImages: 3,
    })
    vi.spyOn(window, "confirm").mockReturnValue(false)
    monter(fetchDouble)
    ouvrir("Son allure")

    const tailles = within(await screen.findByRole("group", { name: "La taille de l'image" }))
    fireEvent.click(tailles.getByRole("button", { name: "32" }))

    // Le temps qu'un envoi refusé, s'il devait partir, ait eu le temps de partir.
    await waitFor(() => expect(window.confirm).toHaveBeenCalled())
    expect(
      tailles.getByRole("button", { name: "64" }).getAttribute("aria-pressed"),
    ).toBe("true")
  })
})

// ── L'étape « Ses sons » (SN2) ──────────────────────────────────────────────

/** Un moteur sonore installé, minimal mais valide — juste ce que l'écran lit :
 *  son identifiant, son nom, sa nature. */
function profilAudio(identifiant: string, nom: string): ProfilWorkflow {
  return {
    identifiant,
    nom,
    nature: "audio",
    modele: `${identifiant}@version`,
    graphe: {},
    liaisons: {},
    parametres: {},
    formats: [],
    durees: [],
    cadence: 0,
    sortie: { noeud: "1", champ: "audio" },
    version: "version",
    cree_le: 1000,
    references_min: 0,
    references_max: 0,
  }
}

describe("l'étape du son", () => {
  test("écrire une ligne sonore n'envoie que le bloc sonore, jamais la bible", async () => {
    const { fetchDouble, appels } = construireDouble()
    monter(fetchDouble)

    ouvrir("Ses sons")
    fireEvent.click(await screen.findByRole("button", { name: /^époque et matière/ }))
    const champ = await screen.findByRole("textbox", {
      name: "La ligne sonore « époque et matière »",
    })
    fireEvent.change(champ, { target: { value: "medieval fantasy, wood, leather, iron" } })
    fireEvent.blur(champ)

    await waitFor(() =>
      expect(appels.some((a) => a.url === "/api/universe" && a.methode === "PUT")).toBe(true),
    )
    const envoi = appels.find((a) => a.url === "/api/universe" && a.methode === "PUT")!
    const corps = envoi.corps as { son: { champs: Champ[] }; bible?: unknown }
    expect(corps.bible).toBeUndefined()
    expect(corps.son.champs.find((c) => c.nom === "epoque")?.texte).toBe(
      "medieval fantasy, wood, leather, iron",
    )
    // Les trois autres cases voyagent avec leur texte du moment — vide ici.
    expect(corps.son.champs).toHaveLength(4)
  })

  test("la tonalité et le tempo de référence se posent chacun par leur propre appel", async () => {
    const { fetchDouble, appels } = construireDouble()
    monter(fetchDouble)

    ouvrir("Ses sons")
    fireEvent.change(await screen.findByLabelText("Tonalité de référence"), {
      target: { value: "D minor" },
    })
    const champTempo = screen.getByLabelText("Tempo de référence")
    fireEvent.change(champTempo, { target: { value: "90" } })
    // Le tempo ne part qu'à la sortie du champ, jamais à chaque frappe.
    fireEvent.blur(champTempo)

    await waitFor(() =>
      expect(
        appels.filter((a) => a.url === "/api/universe" && a.methode === "PUT"),
      ).toHaveLength(2),
    )
    const [tonalite, tempo] = appels.filter(
      (a) => a.url === "/api/universe" && a.methode === "PUT",
    )
    expect((tonalite.corps as { son: { tonalite: string } }).son.tonalite).toBe("D minor")
    expect((tempo.corps as { son: { tempo: number } }).son.tempo).toBe(90)
  })

  test("le moteur d'une famille n'offre que les méthodes installées", async () => {
    const { fetchDouble, appels } = construireDouble({
      profilsAudio: [profilAudio("sa3-small-sfx", "Stable Audio 3 Small-SFX"), profilAudio("yue2-int8", "YuE2 (int8)")],
      moteursParFamille: {
        bruitage: { famille: "bruitage", modele: "ComfyUI:sa3-small-sfx@46c1", moteur: "sa3-small-sfx", possibles: ["sa3-small-sfx", "sa-open-1"] },
      },
      moteursSonores: [
        { identifiant: "sa-open-1", nom: "Stable Audio Open 1.0", description: "", familles: ["bruitage"], pret: true, manque: [], modele: null },
      ],
    })
    monter(fetchDouble)

    ouvrir("Ses sons")
    const choix = await screen.findByLabelText("Moteur pour Bruitage")
    // Une seule option installée qui sache faire un bruitage, plus
    // « automatique » : YuE2, installé mais fait pour chanter, n'est pas
    // proposé. Stable Audio Open 1.0, possible pour un bruitage mais
    // qu'aucun profil installé ne porte, se montre quand même — grisé, avec
    // sa raison, jamais caché en silence.
    expect(within(choix).getAllByRole("option").map((o) => o.textContent)).toEqual([
      "automatique",
      "Stable Audio 3 Small-SFX",
      "Stable Audio Open 1.0 — pas installé",
    ])
    expect(within(choix).getByText("Stable Audio Open 1.0 — pas installé")).toHaveProperty("disabled", true)
    expect(screen.getByText("en ce moment : Stable Audio 3 Small-SFX")).toBeTruthy()

    fireEvent.change(choix, { target: { value: "sa3-small-sfx" } })

    await waitFor(() =>
      expect(appels.some((a) => a.url === "/api/universe" && a.methode === "PUT")).toBe(true),
    )
    const envoi = appels.find((a) => a.url === "/api/universe" && a.methode === "PUT")!
    expect((envoi.corps as { son: { moteurs: Record<string, string> } }).son.moteurs).toEqual({
      bruitage: "sa3-small-sfx",
    })
  })

  test("sans rien d'installé pour une famille, la raison du serveur s'affiche", async () => {
    const { fetchDouble } = construireDouble({
      moteursParFamille: {
        voix: {
          famille: "voix",
          modele: null,
          moteur: null,
          raison: "Aucun moteur sonore n'existe encore pour « voix ».",
        },
      },
    })
    monter(fetchDouble)

    ouvrir("Ses sons")
    await screen.findByLabelText("Moteur pour Voix")
    expect(
      screen.getByText("Aucun moteur sonore n'existe encore pour « voix ».", { exact: false }),
    ).toBeTruthy()
  })

  test("un univers sans bloc sonore s'affiche vide, sans erreur", async () => {
    const { fetchDouble } = construireDouble()
    monter(fetchDouble)

    ouvrir("Ses sons")
    expect(await screen.findByText("Comment sonne ce monde ?")).toBeTruthy()
    expect(screen.queryByRole("alert")).toBeNull()
  })
})

// ── Ce que `C2` a relogé de l'assistant ─────────────────────────────────────
//
// `Assistant.tsx` était le doublon vrai de cet écran, et trois choses n'avaient
// que lui pour les écrire : le nombre de couleurs, la couleur de fond, et le
// réalignement de tout le jeu. Le relevé complet de ses douze étapes est en
// tête de `ReglesDuJeu.tsx` ; ce qui suit vérifie les trois qui ont déménagé.

describe("les réglages relogés de l'assistant (C2)", () => {
  test("le nombre de couleurs se pose, et l'écran montre la valeur posée", async () => {
    const { fetchDouble, appels } = construireDouble({
      univers: { style: "pixel", cible_px: 64, couleurs: 16 },
    })
    monter(fetchDouble)
    ouvrir("Son allure")

    // **On cherche dans le groupe, jamais dans l'écran** : 32 et 64 sont à la
    // fois des tailles de sprite et des nombres de couleurs, et les deux
    // rangées de boutons se touchent.
    const couleurs = within(
      await screen.findByRole("group", { name: "Les couleurs demandées" }),
    )
    const trente_deux = couleurs.getByRole("button", { name: "32" })
    expect(
      couleurs.getByRole("button", { name: "16" }).getAttribute("aria-pressed"),
    ).toBe("true")

    fireEvent.click(trente_deux)

    await waitFor(() =>
      expect(trente_deux.getAttribute("aria-pressed")).toBe("true"),
    )
    const envoi = appels.find(
      (a) => a.url === "/api/universe" && a.methode === "PUT",
    )!
    expect((envoi.corps as { couleurs: number }).couleurs).toBe(32)
  })

  test("les paliers de couleurs sont plafonnés par la taille du sprite", async () => {
    const { fetchDouble } = construireDouble({
      univers: { style: "pixel", cible_px: 32, couleurs: 16 },
    })
    monter(fetchDouble)
    ouvrir("Son allure")

    const groupe = await screen.findByRole("group", { name: "Les couleurs demandées" })
    // 64, 128 et 256 ne paraissent pas : un sprite de 32 carrés de côté ne
    // porte pas tant de teintes distinctes. La liste raccourcit d'elle-même
    // (RT5) — plus de phrase pour le dire, la rangée courte le montre.
    expect(
      Array.from(groupe.querySelectorAll("button")).map((b) => b.textContent),
    ).toEqual(["8", "16", "32"])
  })

  test("en dessin, le nombre de couleurs ne paraît pas — un dessin garde ses nuances", async () => {
    const { fetchDouble } = construireDouble({ univers: { style: "dessin" } })
    monter(fetchDouble)
    ouvrir("Son allure")

    await screen.findByRole("button", { name: "Dessin" })
    expect(screen.queryByRole("group", { name: "Les couleurs demandées" })).toBeNull()
  })

  test("réaligner tout le jeu dit ce qu'il a fait, sous son bouton", async () => {
    const { fetchDouble } = construireDouble({
      univers: { style: "pixel", cible_px: 64 },
      realignement: { realignes: 12, conserves: 3, sur_grille: false },
    })
    monter(fetchDouble)
    ouvrir("Son allure")

    fireEvent.click(
      await screen.findByRole("button", { name: "Réappliquer la palette à tout le jeu" }),
    )

    // **Sans remise sur grille, on le dit** (US-163) : le balayage a reposé la
    // palette et retiré la grille, et quatre mots valent mieux qu'une infobulle.
    expect(
      await screen.findByText(
        "12 remis à jour · 3 conservés tels quels · aucune remise sur grille",
      ),
    ).toBeTruthy()
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
    expect(screen.getByText(/Se calculera du nom/)).toBeTruthy()
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

  test("chacune des cinq étapes se saute, et le jeu se crée sans en régler une", async () => {
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

    // Les quatre pas suivants, sautés l'un après l'autre.
    fireEvent.click(await screen.findByRole("button", { name: "Passer à sa vue" }))
    fireEvent.click(await screen.findByRole("button", { name: "Passer à son monde" }))
    fireEvent.click(await screen.findByRole("button", { name: "Passer à ses sons" }))
    fireEvent.click(await screen.findByRole("button", { name: "Ouvrir le jeu" }))

    expect(onFerme).toHaveBeenCalled()
    // Le jeu existe, et **aucun réglage n'a été écrit** — pas un seul `PUT`.
    expect(appels.some((a) => a.url === "/api/projects" && a.methode === "POST")).toBe(true)
    expect(appels.some((a) => a.url === "/api/universe" && a.methode === "PUT")).toBe(false)
  })
})
