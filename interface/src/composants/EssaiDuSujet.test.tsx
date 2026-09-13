// Ce que L'essai fait (B12) : le personnage joué au clavier, à la vitesse
// exacte qui sortira à l'export, une animation qui manque qui le dit et laisse
// le personnage au repos, et une scène qui se règle sans rien payer.
//
// Aucun appel serveur : l'écran ne reçoit que des props déjà chargées, comme
// `GrilleDuJeu.tsx` et `Comparer.tsx`. Le double de `fetch` n'est là que pour
// prouver qu'il ne part rien — c'est le quatrième critère de la tranche.

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react"
import { afterEach, describe, expect, test, vi } from "vitest"

import {
  EssaiDuSujet,
  bandeQuiSortirait,
  directionsDuSujet,
  poseJouee,
} from "./EssaiDuSujet"
import {
  RECETTE_VIDE,
  dureeImageMs,
  type Bande,
  type Case,
  type Personnage,
  type Pose,
  type Univers,
} from "../api"

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

// ── De quoi fabriquer un sujet ──────────────────────────────────────────────

function bande(surplus: Partial<Bande> & { identifiant: string }): Bande {
  return {
    clip: "clip-1",
    nom: `essai ${surplus.identifiant}`,
    images: [0, 1, 2, 3],
    prises: [],
    chutier: [],
    clips: ["clip-1"],
    melangee: false,
    cadence: 8,
    sens: "boucle",
    cadre: {
      choix: "clip",
      gauche: 0,
      sommet: 0,
      droite: 47,
      bas: 47,
      largeur: 48,
      hauteur: 48,
      mot: "pris sur le clip entier",
    },
    pivot: null,
    recette: RECETTE_VIDE,
    projet: "le-marais",
    personnage: "le-pelerin",
    pose: "repos",
    direction: "sud",
    planche: `generations/clip-1/bandes/${surplus.identifiant}.png`,
    case_largeur: 48,
    case_hauteur: 48,
    cree_le: 100,
    compte: 4,
    secondes: 0.5,
    brouillon: false,
    favori: false,
    rang: 0,
    supprime_le: null,
    supprime: false,
    piece: null,
    habillage: null,
    habillee: false,
    calages: [],
    calage_garde: null,
    ...surplus,
  }
}

const DIRECTION = {
  consigne: "",
  demandees: 1,
  images: [],
  a_confirmer: 0,
  bandes: [],
  bandes_ecartees: [],
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
  "repos",
  "marche",
  "course",
  "attaque",
  "degats",
  "mort",
].map((identifiant) => ({
  identifiant,
  nom: identifiant === "degats" ? "dégâts" : identifiant,
  images: 1,
  consigne: "",
  ecartees: [],
  images_avant: 0,
}))

const QUATRE = ["sud", "nord", "est", "ouest"] as const

/** Une case tenue dans les quatre directions, avec une bande là où on le
 *  demande. `direction: null` veut dire *aucune direction n'en porte*. */
function caseTenue(pose: string, avec: Partial<Record<string, Bande>>): Case {
  return sienne({
    pose,
    bandes: Object.values(avec).filter((b): b is Bande => b != null),
    directions: QUATRE.map((identifiant) => ({
      ...DIRECTION,
      identifiant,
      nom: identifiant,
      bandes: avec[identifiant] ? [avec[identifiant] as Bande] : [],
    })),
  })
}

const REPOS_SUD = bande({ identifiant: "repos-sud", pose: "repos", cadence: 8 })
const MARCHE_SUD = bande({
  identifiant: "marche-sud",
  pose: "marche",
  cadence: 12,
  compte: 12,
})
const COURSE_SUD = bande({ identifiant: "course-sud", pose: "course", cadence: 14 })
// **Seize images par seconde**, la cadence qui fait diverger les deux arrondis :
// l'export écrit 62 ms, `Math.round` en aurait rendu 63.
const ATTAQUE_EST = bande({
  identifiant: "attaque-est",
  pose: "attaque",
  direction: "est",
  cadence: 16,
})

function sujet(surplus: Partial<Personnage> = {}): Personnage {
  return {
    identifiant: "le-pelerin",
    projet: "le-marais",
    nom: "Le pèlerin",
    pieces: [],
    description: "a weathered pilgrim",
    ecartees: [],
    concept_arts: [],
    references_ecartees: [],
    cree_le: 1_700_000_000,
    cases: [
      caseTenue("repos", { sud: REPOS_SUD }),
      caseTenue("marche", { sud: MARCHE_SUD }),
      caseTenue("course", { sud: COURSE_SUD }),
      caseTenue("attaque", { est: ATTAQUE_EST }),
      caseTenue("degats", {}),
      caseTenue("mort", {}),
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

function univers(surplus: Partial<Univers> = {}): Univers {
  return {
    bareme: [],
    cible_px: 64,
    fond: "",
    ...surplus,
  } as unknown as Univers
}

function monter(surplusSujet: Partial<Personnage> = {}, surplusUnivers: Partial<Univers> = {}) {
  const onAnimer = vi.fn()
  const onAnimations = vi.fn()
  const lui = sujet(surplusSujet)
  render(
    <EssaiDuSujet
      personnage={lui}
      personnages={[lui, { ...sujet(), identifiant: "la-grenouille", nom: "La grenouille" }]}
      plan={PLAN}
      univers={univers(surplusUnivers)}
      onAnimer={onAnimer}
      onAnimations={onAnimations}
    />,
  )
  return { onAnimer, onAnimations }
}

const laScene = () => document.querySelector("[data-scene-de-l-essai]") as HTMLElement
const jouee = () =>
  laScene().querySelector("[data-bande-au-jeu]")?.getAttribute("data-bande-au-jeu") ?? null
/** La première étiquette de la scène — *ce qu'on regarde*, pose et direction.
 *  Elle est faite de deux morceaux de texte, donc on lit son contenu entier
 *  plutôt que de chercher une chaîne qui n'existe dans aucun nœud. */
const cequOnRegarde = () =>
  laScene().querySelector("[data-marque-de-la-scene]")?.textContent?.trim() ?? null

// ── Le départage, en clair ──────────────────────────────────────────────────

describe("ce qui sortirait dans le jeu", () => {
  test("la retenue passe devant la plus récente", () => {
    const ancienne = bande({ identifiant: "a", cree_le: 100, favori: true })
    const recente = bande({ identifiant: "b", cree_le: 300 })
    const cases = [
      sienne({
        pose: "repos",
        directions: [{ ...DIRECTION, identifiant: "sud", nom: "sud", bandes: [ancienne, recente] }],
      }),
    ]
    expect(bandeQuiSortirait(cases, "repos", "sud")?.identifiant).toBe("a")
  })

  test("sans retenue, c'est la plus récente — et non la première venue", () => {
    const vieille = bande({ identifiant: "a", cree_le: 100 })
    const recente = bande({ identifiant: "b", cree_le: 300 })
    const cases = [
      sienne({
        pose: "repos",
        directions: [{ ...DIRECTION, identifiant: "sud", nom: "sud", bandes: [vieille, recente] }],
      }),
    ]
    expect(bandeQuiSortirait(cases, "repos", "sud")?.identifiant).toBe("b")
  })

  test("un jeu sans direction déclarée n'est pas un jeu sans animation", () => {
    const seule = bande({ identifiant: "a", direction: null })
    const cases = [sienne({ pose: "repos", bandes: [seule], directions: [] })]
    expect(directionsDuSujet(cases)).toEqual([])
    expect(bandeQuiSortirait(cases, "repos", null)?.identifiant).toBe("a")
  })
})

describe("la pose que le clavier choisit", () => {
  const connues = new Set(["repos", "marche", "course", "attaque"])

  test("aucune touche tenue rend la pose posée à la main", () => {
    expect(poseJouee("attaque", new Set(), false, connues)).toBe("attaque")
  })

  test("une touche tenue met à la marche, Maj à la course", () => {
    expect(poseJouee("repos", new Set(["s"]), false, connues)).toBe("marche")
    expect(poseJouee("repos", new Set(["s"]), true, connues)).toBe("course")
  })

  test("un plan sans course laisse la marche plutôt que d'inventer", () => {
    expect(poseJouee("repos", new Set(["s"]), true, new Set(["repos", "marche"]))).toBe("marche")
  })

  test("un plan sans marche ne fait rien de la touche", () => {
    expect(poseJouee("ferme", new Set(["s"]), false, new Set(["ferme", "ouvert"]))).toBe("ferme")
  })
})

// ── « La vitesse jouée est celle qui sortira à l'export » ────────────────────

describe("la vitesse", () => {
  test("la scène annonce le temps d'une image, celui du fichier d'export", () => {
    monter()
    // 8 images par seconde tombe juste : 125 ms, des deux côtés.
    expect(screen.getByText(/8 i\/s · 125 ms par image/)).toBeTruthy()
    expect(dureeImageMs(8)).toBe(125)
  })

  test("une cadence qui n'arrondit pas juste porte le millième du fichier", () => {
    monter()
    fireEvent.keyDown(laScene(), { key: "s" })
    // 12 i/s : 83 ms, et non 83,33 — c'est ce que le descriptif écrit.
    expect(screen.getByText(/12 i\/s · 83 ms par image/)).toBeTruthy()
    expect(dureeImageMs(12)).toBe(83)
  })

  test("chaque pose de la colonne porte son temps par image", () => {
    monter()
    const ligne = document.querySelector("[data-ce-qu-il-fait='course']") as HTMLElement
    expect(ligne.textContent).toContain("14 i/s")
    expect(ligne.textContent).toContain(`${dureeImageMs(14)} ms`)
  })
})

// ── Le clavier ──────────────────────────────────────────────────────────────

describe("le clavier", () => {
  test("la scène ne prend les touches que lorsqu'on la lui donne", () => {
    monter()
    // L'écouteur est sur la scène, jamais sur `window` : une touche envoyée au
    // document ne fait rien, et le raccourci du carnet reste joignable.
    fireEvent.keyDown(document.body, { key: "s" })
    expect(jouee()).toBe("repos-sud")
  })

  test("une touche de déplacement met à la marche, la relâcher rend le repos", () => {
    monter()
    fireEvent.keyDown(laScene(), { key: "s" })
    expect(jouee()).toBe("marche-sud")
    fireEvent.keyUp(laScene(), { key: "s" })
    expect(jouee()).toBe("repos-sud")
  })

  test("Maj tenue avec le déplacement met à la course", () => {
    monter()
    fireEvent.keyDown(laScene(), { key: "s", shiftKey: true })
    expect(jouee()).toBe("course-sud")
  })

  test("la direction suit le déplacement", () => {
    monter()
    fireEvent.keyDown(laScene(), { key: "d" })
    expect(screen.getAllByText(/marche · est/).length).toBeGreaterThan(0)
  })

  test("une touche de 1 à 6 joue une animation directement", () => {
    monter()
    fireEvent.keyDown(laScene(), { key: "3" })
    expect(jouee()).toBe("course-sud")
  })

  test("Échap relâche le clavier", () => {
    monter()
    fireEvent.focus(laScene())
    expect(screen.getByText(/La scène a le clavier/)).toBeTruthy()
    fireEvent.keyDown(laScene(), { key: "Escape" })
    fireEvent.blur(laScene())
    expect(screen.getByText(/Clique la scène pour lui donner le clavier/)).toBeTruthy()
  })

  test("une direction que le jeu ne déclare pas laisse la touche muette", () => {
    // Un jeu de côté : `droite` et `gauche`, ni nord ni sud. Z ne vise que le
    // nord, que ce jeu-là n'a pas — la touche ne fait donc rien, plutôt que de
    // deviner que « droite » lui ressemble.
    const deCote = sienne({
      pose: "repos",
      directions: [
        { ...DIRECTION, identifiant: "droite", nom: "droite", bandes: [REPOS_SUD] },
        { ...DIRECTION, identifiant: "gauche", nom: "gauche", bandes: [] },
      ],
    })
    monter({ cases: [deCote] })
    expect(cequOnRegarde()).toBe("repos · droite")
    fireEvent.keyDown(laScene(), { key: "z" })
    expect(cequOnRegarde()).toBe("repos · droite")
    // …mais Q vise `gauche`, que ce jeu-là déclare bien.
    fireEvent.keyDown(laScene(), { key: "q" })
    expect(cequOnRegarde()).toBe("repos · gauche")
  })
})

// ── « Une animation qui manque le dit, et il reste au repos » ────────────────

describe("une animation qui manque", () => {
  test("elle le dit, et ne joue jamais celle d'à côté", () => {
    monter()
    fireEvent.keyDown(laScene(), { key: "4" })
    expect(screen.getByText("attaque vers sud n'existe pas")).toBeTruthy()
    // **Le cœur du critère** : l'attaque vers l'est existe, et elle ne joue pas.
    expect(jouee()).toBe("repos-sud")
    expect(jouee()).not.toBe("attaque-est")
  })

  test("elle montre ce qui existe ailleurs, sans y aller toute seule", () => {
    monter()
    fireEvent.keyDown(laScene(), { key: "4" })
    const vers = screen.getByRole("button", { name: /vers est/ })
    expect(vers.textContent).toContain("4 images")
    expect(jouee()).toBe("repos-sud")
    fireEvent.click(vers)
    // On y va parce qu'on l'a demandé, jamais parce que l'écran l'a décidé.
    expect(jouee()).toBe("attaque-est")
  })

  test("sans repos non plus, rien ne bouge et la scène le dit", () => {
    monter({ cases: [caseTenue("repos", {}), caseTenue("attaque", { est: ATTAQUE_EST })] })
    fireEvent.keyDown(laScene(), { key: "2" })
    expect(jouee()).toBeNull()
    expect(screen.getByText(/Il n'a pas non plus de repos dans cette direction/)).toBeTruthy()
  })

  test("une pose sans animation dit pourquoi sa touche ne fait rien", () => {
    monter()
    const ligne = document.querySelector("[data-ce-qu-il-fait='mort']") as HTMLElement
    expect(ligne.textContent).toContain("pas encore faite vers sud")
  })
})

// ── « Demander un clip part d'ici, pré-rempli, et son prix est annoncé » ─────

describe("demander un clip", () => {
  test("il part avec la pose et la direction regardées", () => {
    const { onAnimer } = monter()
    fireEvent.keyDown(laScene(), { key: "4" })
    fireEvent.click(screen.getByRole("button", { name: /Demander un clip pour attaque · sud/ }))
    expect(onAnimer).toHaveBeenCalledTimes(1)
    const [personnage, pose, direction] = onAnimer.mock.calls[0]
    expect(personnage.identifiant).toBe("le-pelerin")
    expect(pose.identifiant).toBe("attaque")
    expect(direction).toEqual({ identifiant: "sud", nom: "sud" })
  })

  test("il dit où le prix s'annonce, et qu'il ne part rien d'ici", () => {
    monter()
    expect(screen.getByText(/son bouton porte le prix avant qu'on commande/)).toBeTruthy()
    expect(screen.getByText(/Rien ne part d'ici/)).toBeTruthy()
  })

  test("c'est le seul bouton rouille de l'écran", () => {
    monter()
    const rouilles = [...document.querySelectorAll("button")].filter((b) =>
      b.className.split(/\s+/).includes("bg-signal"),
    )
    expect(rouilles).toHaveLength(1)
    expect(rouilles[0].textContent).toContain("Demander un clip")
  })
})

// ── « La scène se règle sans rien fabriquer et sans rien payer » ─────────────

describe("la scène", () => {
  test("aucun appel réseau ne part de cet écran", () => {
    const fetchDouble = vi.fn()
    vi.stubGlobal("fetch", fetchDouble)
    monter({}, { fond: "#2d5a3d" })

    fireEvent.click(screen.getByRole("tab", { name: "La scène" }))
    fireEvent.click(screen.getByRole("button", { name: "Fond damier" }))
    fireEvent.click(screen.getByRole("button", { name: "Fond un décor du jeu" }))
    fireEvent.click(screen.getAllByRole("button", { name: "cachée" })[0])
    fireEvent.click(screen.getAllByRole("button", { name: "caché" })[0])
    fireEvent.click(screen.getByRole("button", { name: "en pente" }))
    fireEvent.change(screen.getByLabelText("Poser un deuxième sujet à côté"), {
      target: { value: "la-grenouille" },
    })
    fireEvent.click(screen.getByRole("tab", { name: "Ce qu'il fait" }))
    fireEvent.click(screen.getByRole("button", { name: "×6" }))
    fireEvent.keyDown(laScene(), { key: "s" })

    expect(fetchDouble).not.toHaveBeenCalled()
  })

  test("le fond du jeu se grise quand le jeu n'a pas de couleur, et le dit", () => {
    monter()
    fireEvent.click(screen.getByRole("tab", { name: "La scène" }))
    expect(
      (screen.getByRole("button", { name: "Fond un décor du jeu" }) as HTMLButtonElement).disabled,
    ).toBe(true)
    expect(screen.getByText(/le jeu n'a pas encore de couleur de fond/)).toBeTruthy()
  })

  test("le zoom est entier, et il change la taille jouée", () => {
    monter()
    const avant = (laScene().querySelector("[data-bande-au-jeu]") as HTMLElement).style.width
    expect(avant).toBe("144px") // 48 px × 3
    fireEvent.click(screen.getByRole("button", { name: "×6" }))
    expect((laScene().querySelector("[data-bande-au-jeu]") as HTMLElement).style.width).toBe(
      "288px",
    )
    expect(screen.queryByRole("button", { name: "×3,5" })).toBeNull()
  })

  test("un deuxième sujet se pose à côté, et il joue aussi", () => {
    monter()
    fireEvent.click(screen.getByRole("tab", { name: "La scène" }))
    fireEvent.change(screen.getByLabelText("Poser un deuxième sujet à côté"), {
      target: { value: "la-grenouille" },
    })
    expect(laScene().querySelectorAll("[data-bande-au-jeu]")).toHaveLength(2)
    expect(within(laScene()).getByText("La grenouille")).toBeTruthy()
  })

  test("« Remettre au début » rend la pose et la direction de départ", () => {
    monter()
    fireEvent.keyDown(laScene(), { key: "d" })
    fireEvent.keyDown(laScene(), { key: "3" })
    fireEvent.click(screen.getByRole("button", { name: "Remettre au début" }))
    expect(jouee()).toBe("repos-sud")
  })
})
