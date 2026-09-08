// Ce que l'écran des calques d'animation montre et règle (B20) : une rangée par
// pose **et par direction**, la distinction « tient » / « glisse », et le vide
// qui ne compte pas.
//
// ⚠️ **Les deux `describe` qui comptent le plus sont le premier et le
// troisième**, et ils verrouillent les deux moitiés du critère de la tranche.
//
// Le premier : cet écran rend bien la grille pose × direction que `Emploi.tsx`
// refuse — et ce n'est pas une contradiction. Ce qu'il range n'est pas un
// calque, c'est une **bande**, et une bande porte sa direction depuis `A10`. Le
// calque, lui, reste solidaire de sa pose : les quatre directions d'une pose
// lisent le même (`test_b20.py` le mesure côté serveur).
//
// Le troisième : **une case sans animation du personnage n'est pas un manque**.
// Elle se dit, elle ne se compte pas — annoncer un trou que personne ne peut
// combler ferait passer un travail impossible pour un travail en retard.
//
// Aucun appel serveur : l'écran ne reçoit que des props, comme `Emploi`.

import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, test, vi } from "vitest"

import {
  CalquesAnimes,
  compteDesAnimations,
  detailDeLaRangee,
  motDeLaRangee,
  pireCalage,
} from "./CalquesAnimes"
import {
  type Bande,
  type MatriceDesCalquesAnimes,
  type Piece,
  type RangeeDeCalqueAnime,
} from "../api"

afterEach(cleanup)

// ── De quoi fabriquer une matrice ───────────────────────────────────────────

const PIECE: Piece = {
  identifiant: "epee",
  nom: "Epée",
  description: "",
  emplacement: "les-mains",
  portee: "contenue",
  concept_arts: [],
}

/** Une bande habillée, réduite à ce que cet écran lui demande.
 *
 *  Les champs que l'écran ne lit pas sont posés une fois ici plutôt que répétés
 *  dans chaque essai : ce qu'on mesure est ce que l'écran **montre**, pas la
 *  forme complète d'une bande, qui a ses propres essais. */
function habillee(surplus: Partial<Bande> = {}): Bande {
  return {
    identifiant: "habillee-1",
    clip: "clip-a",
    nom: "marche",
    images: [0, 1, 2, 3, 4, 5, 6, 7],
    prises: [],
    chutier: [],
    clips: ["clip-a"],
    melangee: false,
    cadence: 8,
    sens: "boucle",
    cadre: {
      choix: "clip",
      gauche: 0,
      sommet: 0,
      droite: 23,
      bas: 23,
      largeur: 24,
      hauteur: 24,
      mot: "",
    },
    recette: {} as Bande["recette"],
    projet: "le-marais",
    personnage: "le-goliath",
    pose: "marche",
    direction: "sud",
    planche: null,
    case_largeur: 24,
    case_hauteur: 24,
    cree_le: 1_787_800_000,
    compte: 8,
    secondes: 1,
    brouillon: false,
    favori: false,
    rang: 0,
    supprime_le: null,
    supprime: false,
    piece: "epee",
    habillage: {
      piece: "epee",
      tenue: "tient",
      mot: "recalé sur chaque image",
      a_la_main: false,
      main: null,
    },
    habillee: true,
    calages: Array.from({ length: 8 }, (_, numero) => ({
      numero,
      echelle: 1,
      dx: 0,
      dy: numero,
      couverture: 0.8 - numero * 0.05,
    })),
    calage_garde: null,
    ...surplus,
  }
}

function rangee(surplus: Partial<RangeeDeCalqueAnime> = {}): RangeeDeCalqueAnime {
  return {
    pose: "marche",
    pose_nom: "Marche",
    direction: "sud",
    direction_nom: "sud",
    etat: "a-habiller",
    mot: "le calque et l'animation sont là — rien n'a encore été posé",
    calque: "calque-marche",
    bande: "bande-marche-sud",
    compte: 8,
    habillee: null,
    ...surplus,
  }
}

function matriceDe(
  surplus: Partial<MatriceDesCalquesAnimes> = {},
): MatriceDesCalquesAnimes {
  return {
    projet: "le-marais",
    piece: PIECE,
    porteur: { identifiant: "le-goliath", nom: "Le goliath" },
    rangees: [rangee()],
    fait: 0,
    attendu: 1,
    sans_animation: 0,
    ...surplus,
  }
}

function monter(surplus: Partial<MatriceDesCalquesAnimes> = {}) {
  const onPoser = vi.fn()
  const onBasculer = vi.fn()
  const onRetirer = vi.fn()
  const onRevenirALEmploi = vi.fn()
  render(
    <CalquesAnimes
      matrice={matriceDe(surplus)}
      onPoser={onPoser}
      onBasculer={onBasculer}
      onRetirer={onRetirer}
      onRevenirALEmploi={onRevenirALEmploi}
    />,
  )
  return { onPoser, onBasculer, onRetirer, onRevenirALEmploi }
}

const lignes = () => document.querySelectorAll("[data-rangee-animee]")
const ligne = (cle: string) =>
  document.querySelector(`[data-rangee-animee="${cle}"]`) as HTMLElement

// ── 1. Une rangée par pose ET par direction ────────────────────────────────

describe("la matrice range par pose et par direction, contrairement à celle d'un emploi", () => {
  test("les quatre directions d'une pose font quatre rangées", () => {
    monter({
      rangees: ["sud", "nord", "est", "ouest"].map((direction) =>
        rangee({ direction, direction_nom: direction }),
      ),
      attendu: 4,
    })

    expect(lignes()).toHaveLength(4)
  })

  test("et elles lisent toutes le même calque — l'invariant de C3 tient", () => {
    // Un calque n'a pas de direction. La grille est celle des **bandes** ; le
    // calque de la pose est reposé sur chacune, et il n'y en a qu'un.
    const matrice = matriceDe({
      rangees: ["sud", "nord", "est", "ouest"].map((direction) =>
        rangee({ direction, direction_nom: direction }),
      ),
    })

    const calques = new Set(matrice.rangees.map((r) => r.calque))

    expect(calques.size).toBe(1)
  })

  test("une pose sans direction rend quand même sa rangée", () => {
    // Un jeu vu de face n'a pas de directions, et le mot ne paraît alors nulle
    // part — c'est déjà la règle de la matrice des images.
    monter({ rangees: [rangee({ direction: "", direction_nom: "" })] })

    expect(lignes()).toHaveLength(1)
    expect(ligne("marche-").textContent).toContain("sans direction")
  })
})

// ── 2. Le calque tient, ou le calque glisse ───────────────────────────────

describe("l'écran distingue le calque qui tient de celui qui glisse", () => {
  test("« le calque tient » quand il a été recalé image par image", () => {
    monter({
      rangees: [rangee({ etat: "habille", habillee: habillee() })],
      fait: 1,
    })

    expect(ligne("marche-sud").textContent).toContain("le calque tient")
  })

  test("« le calque glisse » quand un seul calage a servi", () => {
    monter({
      rangees: [
        rangee({
          etat: "habille",
          habillee: habillee({
            habillage: {
              piece: "epee",
              tenue: "glisse",
              mot: "un seul calage pour toute la bande",
              a_la_main: false,
              main: null,
            },
          }),
        }),
      ],
      fait: 1,
    })

    expect(ligne("marche-sud").textContent).toContain("le calque glisse")
  })

  test("et la phrase sous le mot compte les images, elle ne les qualifie pas", () => {
    // *Huit calculs* se vérifie ; *bien calé* ne se vérifie pas. Règle 5 :
    // un chiffre affiché est un chiffre compté.
    const tient = detailDeLaRangee(
      rangee({ etat: "habille", habillee: habillee() }),
    )

    expect(tient).toContain("8 images")
    expect(tient).toContain("gratuits")
  })

  test("basculer la tenue remonte l'autre valeur, jamais la même", () => {
    const { onBasculer } = monter({
      rangees: [rangee({ etat: "habille", habillee: habillee() })],
      fait: 1,
    })

    fireEvent.click(
      document.querySelector(
        '[data-basculer-la-tenue="marche-sud"]',
      ) as HTMLElement,
    )

    expect(onBasculer).toHaveBeenCalledWith("habillee-1", "glisse")
  })

  test("le calage posé à la main se dit, celui qui ne l'est pas se tait", () => {
    monter({
      rangees: [
        rangee({
          etat: "habille",
          habillee: habillee({
            habillage: {
              piece: "epee",
              tenue: "tient",
              mot: "recalé sur chaque image",
              a_la_main: true,
              main: null,
            },
          }),
        }),
      ],
    })

    expect(ligne("marche-sud").textContent).toContain("posé à la main")
  })
})

// ── 3. Une case sans animation reste vide sans compter comme un manque ────

describe("une case sans animation du personnage n'est pas un manque", () => {
  test("elle porte sa raison, et le mot vient du serveur", () => {
    monter({
      rangees: [
        rangee({
          etat: "sans-animation",
          mot: "le personnage n'a pas encore cette animation — rien à habiller",
          bande: null,
          compte: 0,
        }),
      ],
      attendu: 0,
      sans_animation: 1,
    })

    expect(ligne("marche-sud").textContent).toContain("rien à habiller")
  })

  test("elle n'offre aucun geste — il n'y a rien à faire", () => {
    // Un bouton qui ne fait rien se clique quand même : mieux vaut ne pas le
    // dessiner. C'est déjà la règle de la case vide sur la page d'un emploi.
    monter({
      rangees: [rangee({ etat: "sans-animation", bande: null, compte: 0 })],
      attendu: 0,
      sans_animation: 1,
    })

    expect(
      document.querySelector('[data-poser-le-calque="marche-sud"]'),
    ).toBeNull()
  })

  test("et le compteur la dit à part, sans la compter comme un trou", () => {
    expect(compteDesAnimations(2, 2, 4)).toBe(
      "2 sur 2 · rien ne manque · 4 sans animation",
    )
  })

  test("une case sans calque, elle, compte — parce qu'elle se répare", () => {
    // La distinction que la tranche doit tenir : l'un se comble par une planche
    // d'équipement, l'autre ne se comble par rien.
    expect(compteDesAnimations(1, 3, 0)).toBe("1 sur 3 · 2 à poser")
  })

  test("le manque n'a aucune couleur — un trait fin, et rien d'autre", () => {
    monter({ rangees: [rangee({ etat: "sans-calque", calque: null })] })

    const vide = document.querySelector('[data-case-sans-calque="marche-sud"]')
    expect(vide).not.toBeNull()
    expect(vide?.querySelector(".border-contour")).not.toBeNull()
  })
})

// ── 4. Les gestes, et ils ne dépensent pas ────────────────────────────────

describe("les gestes remontent au parent, et aucun ne dépense", () => {
  test("poser le calque remonte la bande nue et la tenue par défaut", () => {
    const { onPoser } = monter()

    fireEvent.click(
      document.querySelector('[data-poser-le-calque="marche-sud"]') as HTMLElement,
    )

    expect(onPoser).toHaveBeenCalledWith("bande-marche-sud", "tient")
  })

  test("retirer remonte l'habillée, jamais le corps", () => {
    const { onRetirer } = monter({
      rangees: [rangee({ etat: "habille", habillee: habillee() })],
    })

    fireEvent.click(
      document.querySelector(
        '[data-retirer-le-calque="marche-sud"]',
      ) as HTMLElement,
    )

    expect(onRetirer).toHaveBeenCalledWith("habillee-1")
  })

  test("l'écran dit en toutes lettres que rien n'y dépense", () => {
    monter()

    expect(screen.getByText(/Rien sur cet écran ne dépense/)).toBeTruthy()
  })

  test("aucun bouton rouille : cliquer ne coûte jamais", () => {
    // Le rouille ne sert qu'à deux choses — le bouton qui lance, et le chiffre
    // qui coûte. Ici rien ne lance et rien ne coûte, donc rien n'est rouille.
    monter({ rangees: [rangee({ etat: "habille", habillee: habillee() })] })

    expect(document.querySelector(".bg-signal")).toBeNull()
  })
})

// ── Le détail : la couverture, pour dire ce qui tombe mal ─────────────────

describe("la couverture permet de dire quel calage tombe mal", () => {
  test("le pire est celui qui couvre le moins", () => {
    const pire = pireCalage(habillee().calages)

    expect(pire?.numero).toBe(7)
  })

  test("une bande sans calage n'en a pas de pire", () => {
    expect(pireCalage([])).toBeNull()
  })
})

// ── Le vide, et le retour ─────────────────────────────────────────────────

describe("le vide dit une phrase et un geste, rien d'autre", () => {
  test("un porteur sans pose le dit avec son nom", () => {
    monter({ rangees: [], attendu: 0 })

    expect(screen.getByText(/Le goliath n'a encore aucune pose/)).toBeTruthy()
  })

  test("le mot d'une rangée non habillée est celui que le serveur pose", () => {
    // L'écran ne rejoue jamais la règle : il lit le mot. Deux compositions de
    // la même phrase divergeraient au premier changement de vocabulaire.
    expect(motDeLaRangee(rangee({ mot: "une phrase du serveur" }))).toBe(
      "une phrase du serveur",
    )
  })

  test("revenir à l'emploi remonte le geste", () => {
    const { onRevenirALEmploi } = monter()

    fireEvent.click(screen.getByRole("button", { name: /Revenir aux calques/ }))

    expect(onRevenirALEmploi).toHaveBeenCalled()
  })
})
