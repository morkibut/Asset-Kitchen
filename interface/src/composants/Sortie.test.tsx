// Ce que l'écran de la sortie montre (B21) : les cinq listes servies par le
// serveur, l'arbre des fichiers avec leurs trois marques, les quatre comptes,
// et ce qui n'est pas prêt.
//
// **Les listes ne sont pas écrites dans l'écran**, elles arrivent du serveur :
// les essais montent donc un double d'`api` et vérifient que l'écran affiche
// *ce qu'il a reçu*, jamais ce qu'il aurait pu deviner. C'est le seul niveau
// qui prouve quelque chose — un écran qui redéclarerait les cinq listes
// passerait ces essais tout en refusant, au premier moteur ajouté, de le
// montrer.
//
// ⚠️ **jsdom ne met rien en page** : aucun de ces essais ne voit une largeur,
// un débordement ni un recouvrement. Les trois colonnes se vérifient au
// navigateur, sur `essais/atelier_jetable_b21.py`.

import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"

import { MOTS, parDossier, poids, quand, Sortie } from "./Sortie"
import type { ApercuDeSortie, FichierDeSortie, ReglagesDeLaSortie } from "../api"

const REGLAGES: ReglagesDeLaSortie = {
  lots: ["tout", "personnages", "objets", "decors", "interface", "animations"],
  rangements: ["a_plat", "en_dossiers"],
  collisions: ["remplacer", "numeroter", "arreter", "effacer"],
  moteurs: ["aucun", "godot", "unity", "phaser"],
  sujets: [
    { identifiant: "le-pelerin", nom: "le pèlerin" },
    { identifiant: "le-passeur", nom: "le passeur" },
  ],
  dossier: "D:\\jeux\\marais\\assets",
  precedente: null,
}

function fichier(surplus: Partial<FichierDeSortie> & { chemin: string }): FichierDeSortie {
  return {
    octets: 2048,
    empreinte: "e1",
    marque: "nouveau",
    role: "corps",
    sujet: "le-pelerin",
    source: "asset-1",
    largeur: 66,
    hauteur: 66,
    images: 0,
    ...surplus,
  }
}

const APERCU: ApercuDeSortie = {
  dossier: "D:\\jeux\\marais\\assets",
  fichiers: [
    fichier({ chemin: "personnages/pelerin-repos-est.png", marque: "remplace" }),
    fichier({ chemin: "personnages/pelerin-marche-est.png", marque: "nouveau" }),
    fichier({ chemin: "personnages/pelerin-course-est.png", marque: "inchange" }),
    fichier({
      chemin: "descriptif.json",
      marque: "nouveau",
      role: "descriptif",
      largeur: 0,
      hauteur: 0,
    }),
  ],
  restes: [
    fichier({
      chemin: "personnages/pelerin-mort-est.png",
      marque: "reste",
      largeur: 0,
      hauteur: 0,
    }),
  ],
  pas_prets: [
    {
      genre: "sans_image",
      phrase: "ils seront sautés — aucune de leurs poses n'a d'image",
      compte: 2,
      sujets: [
        { identifiant: "le-passeur", nom: "le passeur", quoi: "aucune image" },
        { identifiant: "le-chaudron", nom: "le chaudron", quoi: "aucune image" },
      ],
    },
  ],
  precedente: null,
  reglage: {
    projet: "le-marais",
    lot: "tout",
    dossier: "D:\\jeux\\marais\\assets",
    rangement: "a_plat",
    collision: "remplacer",
    moteur: "aucun",
    sujet: "",
  },
  compte: 4,
  octets: 8192,
  comptes: { nouveau: 2, remplace: 1, inchange: 1, reste: 1 },
  refus: "",
}

const prevoir = vi.fn()
const sortir = vi.fn()

vi.mock("../api", async (vrai) => {
  const module = await vrai<typeof import("../api")>()
  return {
    ...module,
    api: {
      ...module.api,
      reglagesDeLaSortie: () => Promise.resolve(REGLAGES),
      prevoirLaSortie: (...args: unknown[]) => prevoir(...args),
      sortir: (...args: unknown[]) => sortir(...args),
    },
  }
})

beforeEach(() => {
  prevoir.mockReset()
  prevoir.mockResolvedValue(APERCU)
  sortir.mockReset()
  sortir.mockResolvedValue({
    dossier: "D:\\jeux\\marais\\assets",
    ecrits: APERCU.fichiers,
    effaces: [],
    inchanges: 1,
    descriptif: "D:\\jeux\\marais\\assets\\descriptif.json",
    catalogue: "",
    le: 1_757_000_000,
    compte: 4,
    octets: 8192,
  })
})

afterEach(cleanup)

function monter(surplus: Partial<Parameters<typeof Sortie>[0]> = {}) {
  const onFerme = vi.fn()
  render(<Sortie projet="le-marais" onFerme={onFerme} {...surplus} />)
  return { onFerme }
}

// ── Les cinq listes viennent du serveur ─────────────────────────────────────

describe("les cinq listes fermées", () => {
  test("elles sont affichées telles que le serveur les a servies", async () => {
    monter()

    for (const valeur of [...REGLAGES.lots, ...REGLAGES.collisions]) {
      expect(await screen.findByText(MOTS[valeur])).toBeTruthy()
    }
    for (const valeur of [...REGLAGES.rangements, ...REGLAGES.moteurs]) {
      expect(await screen.findByText(MOTS[valeur])).toBeTruthy()
    }
  })

  test("« Remplacer » est le mode par défaut", async () => {
    monter()
    const remplacer = await screen.findByRole("radio", { name: /Remplacer/ })
    expect(remplacer.getAttribute("aria-checked")).toBe("true")
  })

  test("changer un réglage redemande un aperçu, et ne coûte rien", async () => {
    monter()
    await screen.findByRole("radio", { name: /Remplacer/ })
    const premiers = prevoir.mock.calls.length

    fireEvent.click(screen.getByRole("radio", { name: "en dossiers" }))

    await waitFor(() => expect(prevoir.mock.calls.length).toBeGreaterThan(premiers))
    // **Prévoir, et jamais sortir** : le second appel n'écrit rien.
    expect(sortir).not.toHaveBeenCalled()
    expect(prevoir.mock.calls.at(-1)?.[0]).toMatchObject({
      rangement: "en_dossiers",
    })
  })
})

// ── L'arbre, ses marques et ses comptes ─────────────────────────────────────

describe("l'arbre des fichiers", () => {
  test("chaque fichier porte sa marque", async () => {
    monter()
    const arbre = await screen.findByText("personnages/")

    const dans = (chemin: string) =>
      document.querySelector(`[data-fichier="${chemin}"]`) as HTMLElement

    expect(arbre).toBeTruthy()
    expect(within(dans("personnages/pelerin-repos-est.png")).getByText("remplace")).toBeTruthy()
    expect(within(dans("personnages/pelerin-marche-est.png")).getByText("nouveau")).toBeTruthy()
    expect(within(dans("personnages/pelerin-course-est.png")).getByText("inchangé")).toBeTruthy()
    expect(within(dans("personnages/pelerin-mort-est.png")).getByText("à effacer")).toBeTruthy()
  })

  test("un reste porte son chemin entier, jamais son seul nom", async () => {
    // ⚠️ **Trouvé au navigateur, pas ici.** Un reste n'est rangé sous aucun
    // dossier de l'arbre : affiché par son seul nom, il se lisait à côté d'un
    // fichier prévu portant le même nom dans un autre dossier — deux lignes
    // identiques, l'une « nouveau », l'autre « à effacer ».
    prevoir.mockResolvedValue({
      ...APERCU,
      fichiers: [fichier({ chemin: "pelerin-mort-est.png", marque: "nouveau" })],
      restes: [
        fichier({ chemin: "personnages/pelerin-mort-est.png", marque: "reste" }),
      ],
    })
    monter()

    const reste = (await screen.findByText(
      "personnages/pelerin-mort-est.png",
    )) as HTMLElement
    expect(reste).toBeTruthy()
    // Et le fichier prévu, lui, garde son nom court : il est sous sa racine.
    expect(screen.getByText("pelerin-mort-est.png")).toBeTruthy()
  })

  test("un fichier sans dimensions n'en affiche aucune", async () => {
    monter()
    await screen.findByText("personnages/")

    // **Zéro n'est pas une dimension, c'est l'absence de mesure.** Un descriptif
    // est du texte : l'arbre n'écrit rien à sa droite, plutôt que « 0×0 ».
    const ligne = document.querySelector('[data-fichier="descriptif.json"]')
    expect(ligne?.textContent).not.toContain("0×0")
    expect(ligne?.textContent).toContain("descriptif.json")
  })

  test("le filtre « ce qui a changé » retire les inchangés", async () => {
    monter()
    await screen.findByText("personnages/")
    expect(document.querySelector('[data-fichier="personnages/pelerin-course-est.png"]')).toBeTruthy()

    fireEvent.click(screen.getByRole("button", { name: "ce qui a changé" }))

    expect(
      document.querySelector('[data-fichier="personnages/pelerin-course-est.png"]'),
    ).toBeNull()
    // Ceux qui changent restent.
    expect(
      document.querySelector('[data-fichier="personnages/pelerin-repos-est.png"]'),
    ).toBeTruthy()
  })

  test("les quatre comptes se lisent sous l'arbre", async () => {
    monter()
    await screen.findByText("personnages/")

    // Cherchés **dans le bloc des comptes** : « à effacer » est aussi la marque
    // d'une ligne de l'arbre, et une recherche sur toute la page en trouverait
    // deux — ce qui est juste, et ce n'est pas ce qu'on mesure ici.
    const comptes = within(document.querySelector("[data-comptes]") as HTMLElement)
    for (const [chiffre, mot] of [
      ["2", "nouveaux"],
      ["1", "remplacés"],
      ["1", "inchangés"],
      ["1", "à effacer"],
    ]) {
      expect(comptes.getByText(mot)).toBeTruthy()
      expect(comptes.getAllByText(chiffre).length).toBeGreaterThan(0)
    }
  })
})

// ── Le bouton porte le compte et le poids ───────────────────────────────────

describe("le bouton", () => {
  test("il porte le compte exact et le poids", async () => {
    monter()

    expect(await screen.findByText("Livrer 4 fichiers ›")).toBeTruthy()
    expect(screen.getByText("8 ko · rien ne part sur le réseau")).toBeTruthy()
  })

  test("sans dossier, il est grisé et porte sa raison", async () => {
    prevoir.mockResolvedValue({
      ...APERCU,
      dossier: "",
      fichiers: [],
      restes: [],
      compte: 0,
      octets: 0,
      comptes: {},
      refus: "aucun dossier de jeu — pose-le dans l'installation",
    })
    monter()

    const bouton = (await screen.findByText(/Livrer \d+ fichier/)) as HTMLButtonElement
    expect(bouton.disabled).toBe(true)
    // **Le grisé porte sa raison**, et jamais dans une infobulle.
    expect(
      screen.getByText("aucun dossier de jeu — pose-le dans l'installation"),
    ).toBeTruthy()
  })

  test("cliquer sort, puis redemande un aperçu", async () => {
    monter()
    fireEvent.click(await screen.findByText("Livrer 4 fichiers ›"))

    await waitFor(() => expect(sortir).toHaveBeenCalledTimes(1))
    // Le compte rendu paraît, et il dit le chemin.
    expect(await screen.findByRole("status")).toBeTruthy()
    expect(screen.getByRole("status").textContent).toContain("D:\\jeux\\marais\\assets")
  })
})

// ── Ce qui n'est pas prêt ───────────────────────────────────────────────────

describe("ce qui n'est pas prêt", () => {
  test("le panneau nomme les sujets et accorde son titre", async () => {
    monter()

    expect(await screen.findByText("2 sujets n'ont aucune image qui sort")).toBeTruthy()
    expect(screen.getByText("le passeur")).toBeTruthy()
    expect(screen.getByText("le chaudron")).toBeTruthy()
    // La phrase vient du serveur, au caractère près.
    expect(
      screen.getByText("ils seront sautés — aucune de leurs poses n'a d'image"),
    ).toBeTruthy()
  })

  test("quand tout est prêt, il le dit plutôt que de disparaître", async () => {
    prevoir.mockResolvedValue({ ...APERCU, pas_prets: [] })
    monter()

    expect(
      await screen.findByText("Tout ce que ce lot contient a de quoi sortir."),
    ).toBeTruthy()
  })
})

// ── La fois d'avant ─────────────────────────────────────────────────────────

describe("la dernière sortie", () => {
  test("jamais sortie, elle le dit", async () => {
    monter()
    expect(
      await screen.findByText("Ce jeu n'est jamais sorti. Tout sera nouveau."),
    ).toBeTruthy()
  })

  test("déjà sortie, elle donne la date, le compte et le poids", async () => {
    prevoir.mockResolvedValue({
      ...APERCU,
      precedente: {
        le: 1_757_000_400,
        dossier: "D:\\jeux\\marais\\assets",
        compte: 726,
        chemins: [],
        octets: 14_260_000,
      },
    })
    monter()

    expect(await screen.findByText("726 fichiers · 13,6 Mo")).toBeTruthy()
  })
})

// ── Le petit outillage, essayé seul ─────────────────────────────────────────

describe("poids", () => {
  test("il met la virgule, jamais le point", () => {
    // Le dépôt a déjà payé un écran qui écrivait « 26,5 Go » et « 8.7 Go » à
    // deux lignes d'écart.
    expect(poids(14_260_000)).toBe("13,6 Mo")
    expect(poids(2048)).toBe("2 ko")
    expect(poids(12)).toBe("12 o")
  })
})

// ── Un seul sujet, à la place du lot (`RP17`) ───────────────────────────────

describe("un seul asset", () => {
  test("le choix paraît avec les lots, et la liste vient du serveur", async () => {
    monter()

    expect(await screen.findByRole("radio", { name: "Un seul sujet" })).toBeTruthy()
    // Tant qu'on ne l'a pas pris, le lot décide et aucune liste de sujets ne
    // s'affiche : un menu sans objet se lit comme un réglage à remplir.
    expect(screen.queryByLabelText("Lequel")).toBeNull()

    fireEvent.click(screen.getByRole("radio", { name: "Un seul sujet" }))
    const lequel = screen.getByLabelText("Lequel") as HTMLSelectElement
    expect([...lequel.options].map((o) => o.textContent)).toEqual([
      "le pèlerin",
      "le passeur",
    ])
  })

  test("le prendre envoie le sujet, et le reprendre au lot le relâche", async () => {
    monter()
    await screen.findByRole("radio", { name: "Un seul sujet" })

    fireEvent.click(screen.getByRole("radio", { name: "Un seul sujet" }))
    await waitFor(() =>
      expect(prevoir.mock.calls.at(-1)?.[0]).toMatchObject({
        sujet: "le-pelerin",
      }),
    )
    // Le lot n'est plus allumé : deux réponses à la même question se
    // contrediraient, et l'écran le montre au lieu de l'expliquer.
    expect(
      screen.getByRole("radio", { name: MOTS.tout }).getAttribute("aria-checked"),
    ).toBe("false")

    fireEvent.change(screen.getByLabelText("Lequel"), {
      target: { value: "le-passeur" },
    })
    await waitFor(() =>
      expect(prevoir.mock.calls.at(-1)?.[0]).toMatchObject({
        sujet: "le-passeur",
      }),
    )

    fireEvent.click(screen.getByRole("radio", { name: MOTS.tout }))
    await waitFor(() =>
      expect(prevoir.mock.calls.at(-1)?.[0]).toMatchObject({ sujet: "" }),
    )
    expect(screen.queryByLabelText("Lequel")).toBeNull()
  })
})

describe("parDossier", () => {
  test("il plie l'arbre, et la racine passe en dernier", () => {
    const groupes = parDossier([
      fichier({ chemin: "descriptif.json" }),
      fichier({ chemin: "personnages/un.png" }),
      fichier({ chemin: "animations/deux.png" }),
      fichier({ chemin: "personnages/trois.png" }),
    ])

    expect(groupes.map((g) => g.dossier)).toEqual([
      "animations",
      "personnages",
      "",
    ])
    expect(groupes[1].fichiers).toHaveLength(2)
  })
})

describe("quand", () => {
  test("elle se lit en français", () => {
    expect(quand(1_757_000_400)).toContain("septembre")
    expect(quand(1_757_000_400)).toContain(" h ")
  })
})
