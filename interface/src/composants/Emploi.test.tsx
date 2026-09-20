// Ce que la page d'un emploi montre et règle (B19) : une colonne de poses, les
// réglages qui valent pour toutes à la fois, et le retrait.
//
// ⚠️ **Le premier `describe` est celui qui compte le plus.** La planche
// `docs/archive/pistes-2026-09-04/carnet/Emploi.dc.html` dessine une grille de 6 × 4 —
// « vingt-quatre calques : six poses, quatre directions ». Le dépôt ne range
// pas les calques comme ça : `atelier/services/equipement.py` fait une case par
// **pose** (`corps()`, `plier()`), et `atelier/services/production.py`
// (`cases()`) écrit `calques[pose][piece]`, sans le moindre axe d'angle. L'essai
// verrouille la colonne, pour qu'une relecture de la planche ne la retourne pas
// en grille six mois plus tard.
//
// Aucun appel serveur : l'écran ne reçoit que des props, comme `GrilleDuJeu`.

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react"
import { afterEach, describe, expect, test, vi } from "vitest"

import { Emploi } from "./Emploi"
import {
  RECETTE_VIDE,
  type Asset,
  type Case,
  type EmplacementCorps,
  type EmploiResolu,
  type Personnage,
  type Piece,
  type Pose,
} from "../api"

afterEach(cleanup)

// ── Les données d'essai ─────────────────────────────────────────────────────

function image(surplus: Partial<Asset> & { identifiant: string }): Asset {
  return {
    generation: "gen-1",
    rang: 0,
    largeur: 256,
    hauteur: 256,
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
    personnage: "le-goliath",
    pose: "repos",
    direction: "sud",
    piece: "epee",
    calque: null,
    lot: null,
    personnage_supprime: false,
    epingle: false,
    matiere: false,
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

const POSES = ["repos", "marche", "course", "attaque", "degats", "mort"] as const
const NOMS_DE_POSE = ["Repos", "Marche", "Course", "Attaque", "Dégâts", "Mort"]

const PLAN: Pose[] = POSES.map((identifiant, rang) => ({
  identifiant,
  nom: NOMS_DE_POSE[rang],
  images: 1,
  consigne: "",
  ecartees: [],
  images_avant: 0,
}))

const EMPLACEMENTS: EmplacementCorps[] = [
  { identifiant: "tete", nom: "la tête", rang: 0 },
  { identifiant: "mains", nom: "les mains", rang: 1 },
  { identifiant: "dos", nom: "le dos", rang: 2 },
]

/** Un calque par pose, dans l'ordre du plan — **jamais quatre par pose** : le
 *  disque n'en garde qu'un, et c'est le sujet du premier essai. */
function casesAvecCalques(combien: number): Case[] {
  return POSES.map((pose, rang) =>
    rang < combien
      ? sienne({
          pose,
          calques: { epee: [image({ identifiant: `calque-${pose}`, pose })] },
          retenus: { epee: `calque-${pose}` },
        })
      : sienne({ pose }),
  )
}

function porteurDe(surplus: Partial<Personnage> = {}): Personnage {
  return {
    identifiant: "le-goliath",
    projet: "le-marais",
    nom: "Le goliath",
    description: "",
    ecartees: [],
    concept_arts: [],
    references_ecartees: [],
    cree_le: 1_700_000_000,
    cases: casesAvecCalques(6),
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
    pieces: ["epee"],
    ...surplus,
  } as Personnage
}

function pieceDe(surplus: Partial<Piece> = {}): Piece {
  return {
    identifiant: "epee",
    nom: "Épée",
    description: "",
    emplacement: "mains",
    portee: "contenue",
    concept_arts: [],
    ...surplus,
  }
}

function emploiDe(surplus: Partial<EmploiResolu> = {}): EmploiResolu {
  return {
    identifiant: "emploi-1",
    genre: "porte",
    porteur: "le-goliath",
    nom: "L'épée du goliath, en main droite",
    emplacement: "",
    devant: true,
    description: "",
    deduit: false,
    orphelin: false,
    porteur_nom: "Le goliath",
    emplacement_nom: "les mains",
    fait: 6,
    attendu: 6,
    ...surplus,
  }
}

function monter({
  emploi = {},
  piece = {},
  porteur = porteurDe(),
}: {
  emploi?: Partial<EmploiResolu>
  piece?: Partial<Piece>
  porteur?: Personnage | null
} = {}) {
  const onRegler = vi.fn()
  const onRetirer = vi.fn()
  const onCalque = vi.fn()
  const onLesAutresEmplois = vi.fn()
  const onCalquesAnimes = vi.fn()
  const onPorteur = vi.fn()
  render(
    <Emploi
      emploi={emploiDe(emploi)}
      piece={pieceDe(piece)}
      emplacements={EMPLACEMENTS}
      porteur={porteur}
      onRegler={onRegler}
      onRetirer={onRetirer}
      onCalque={onCalque}
      onLesAutresEmplois={onLesAutresEmplois}
      onPorteur={onPorteur}
      onCalquesAnimes={onCalquesAnimes}
    />,
  )
  return { onRegler, onRetirer, onCalque, onLesAutresEmplois, onCalquesAnimes, onPorteur }
}

const rangees = () => document.querySelectorAll("[data-rangee-de-pose]")
const matrice = () => document.querySelector("[data-la-matrice]") as HTMLElement
const cases = () =>
  document.querySelectorAll("[data-calque-de-pose], [data-case-vide]")

// ── Les essais ──────────────────────────────────────────────────────────────

describe("la matrice est une colonne de poses, pas la grille 6 × 4 de la planche", () => {
  test("une rangée par pose du porteur, et une seule case par rangée", () => {
    monter()
    expect(rangees()).toHaveLength(6)
    // Six poses × quatre directions ferait vingt-quatre. Un calque n'a pas de
    // direction : il en reste six.
    expect(cases()).toHaveLength(6)
    expect(cases()).not.toHaveLength(24)
  })

  test("aucune colonne de direction ne paraît", () => {
    monter()
    for (const angle of ["Vers le bas", "Vers la gauche", "Vers la droite", "Vers le haut"])
      expect(screen.queryByText(angle)).toBeNull()
    expect(screen.queryByText(/quatre directions/i)).toBeNull()
  })

  test("les rangées portent le nom des poses, dans l'ordre du plan", () => {
    monter()
    const noms = [...rangees()].map((rangee) => rangee.textContent)
    NOMS_DE_POSE.forEach((nom, rang) => {
      expect(noms[rang]).toContain(nom)
    })
  })
})

describe("le manque n'a aucune couleur", () => {
  test("une case vide est un trait fin, sans signal, sans échec, sans attention", () => {
    monter({ porteur: porteurDe({ cases: casesAvecCalques(4) }) })
    const vides = document.querySelectorAll("[data-case-vide]")
    expect(vides).toHaveLength(2)
    for (const vide of vides) {
      const classes = vide.outerHTML
      expect(classes).not.toMatch(/signal/)
      expect(classes).not.toMatch(/echec/)
      expect(classes).not.toMatch(/attention/)
      // Le trait, et rien d'autre.
      expect(vide.querySelector(".border-contour")).toBeTruthy()
    }
  })

  test("une case vide ne se clique pas — il n'y a rien à ouvrir", () => {
    const { onCalque } = monter({ porteur: porteurDe({ cases: casesAvecCalques(0) }) })
    expect(document.querySelectorAll("[data-case-vide]")).toHaveLength(6)
    expect(screen.queryByRole("button", { name: /Le calque de/ })).toBeNull()
    expect(onCalque).not.toHaveBeenCalled()
  })
})

describe("le compteur dit ce qui manque, sans le peindre", () => {
  test("tout est là : « rien ne manque »", () => {
    monter({ emploi: { fait: 6, attendu: 6 } })
    expect(screen.getByText("6 sur 6 · rien ne manque")).toBeTruthy()
  })

  test("il en manque : le nombre, et le mot au pluriel", () => {
    monter({ emploi: { fait: 4, attendu: 6 } })
    expect(screen.getByText("4 sur 6 · 2 manquent")).toBeTruthy()
  })

  test("il en manque un seul : le singulier s'accorde", () => {
    monter({ emploi: { fait: 5, attendu: 6 } })
    expect(screen.getByText("5 sur 6 · 1 manque")).toBeTruthy()
  })
})

describe("une case pleine ouvre son calque", () => {
  test("cliquée, elle rend l'identifiant du calque retenu", () => {
    const { onCalque } = monter()
    fireEvent.click(screen.getByRole("button", { name: "Le calque de Marche" }))
    expect(onCalque).toHaveBeenCalledWith("calque-marche")
  })

  test("un calque non retenu ne remplit pas la case", () => {
    // Des calques dans la liste, mais `retenus` n'en désigne aucun : l'écran
    // montre ce qui part, pas ce qui existe.
    monter({
      porteur: porteurDe({
        cases: [
          sienne({
            pose: "repos",
            calques: { epee: [image({ identifiant: "calque-repos" })] },
            retenus: {},
          }),
        ],
      }),
    })
    expect(document.querySelectorAll("[data-case-vide]")).toHaveLength(1)
    expect(document.querySelectorAll("[data-calque-de-pose]")).toHaveLength(0)
  })
})

describe("l'emplacement", () => {
  test("le changer remonte `onRegler({ emplacement })`", () => {
    const { onRegler } = monter()
    fireEvent.change(screen.getByLabelText("L'emplacement"), {
      target: { value: "dos" },
    })
    expect(onRegler).toHaveBeenCalledWith({ emplacement: "dos" })
  })

  test("l'option vide dit celui de la pièce, nommé", () => {
    monter()
    expect(screen.getByRole("option", { name: "celui de la pièce (les mains)" })).toBeTruthy()
  })

  test("une pièce sans emplacement le dit plutôt que de laisser un blanc", () => {
    monter({ piece: { emplacement: "" } })
    expect(
      screen.getByRole("option", { name: "celui de la pièce (aucun pour l'instant)" }),
    ).toBeTruthy()
  })
})

describe("devant ou derrière", () => {
  test("deux boutons, et celui qui vaut est marqué", () => {
    monter({ emploi: { devant: true } })
    expect(screen.getByRole("button", { name: "devant le corps" })).toHaveAttribute(
      "aria-pressed",
      "true",
    )
    expect(screen.getByRole("button", { name: "derrière le corps" })).toHaveAttribute(
      "aria-pressed",
      "false",
    )
  })

  test("chacun remonte `onRegler({ devant })`", () => {
    const { onRegler } = monter({ emploi: { devant: true } })
    fireEvent.click(screen.getByRole("button", { name: "derrière le corps" }))
    expect(onRegler).toHaveBeenCalledWith({ devant: false })

    fireEvent.click(screen.getByRole("button", { name: "devant le corps" }))
    expect(onRegler).toHaveBeenCalledWith({ devant: true })
  })
})

describe("le porteur est en lecture seule", () => {
  test("son nom et ses poses paraissent, et aucun contrôle n'en change", () => {
    monter()
    const bloc = document.querySelector("[data-le-porteur]") as HTMLElement
    expect(within(bloc).getByText("Le goliath")).toBeTruthy()
    expect(within(bloc).getByText(/6/)).toBeTruthy()
    // Ni liste, ni bouton, ni champ : il n'y a pas de geste qui le change.
    expect(bloc.querySelector("select")).toBeNull()
    expect(bloc.querySelector("button")).toBeNull()
    expect(bloc.querySelector("input")).toBeNull()
  })

  test("l'écran dit pourquoi il ne se change pas", () => {
    monter()
    expect(screen.getByText(/rangés sous lui/)).toBeTruthy()
    expect(screen.getByText(/en retirant l'emploi/)).toBeTruthy()
  })
})

describe("un emploi qui ne porte personne", () => {
  test("`a-part` : ni emplacement ni porteur dans son volet, mais une description", () => {
    monter({ emploi: { genre: "a-part", porteur: "", porteur_nom: "" }, porteur: null })
    expect(screen.queryByLabelText("L'emplacement")).toBeNull()
    expect(document.querySelector("[data-le-porteur]")).toBeNull()
    expect(screen.queryByRole("button", { name: "devant le corps" })).toBeNull()
    expect(screen.getByLabelText("La description")).toBeTruthy()
  })

  test("changer la description la remonte quand le champ se referme", () => {
    const { onRegler } = monter({
      emploi: { genre: "mise-en-scene", porteur: "", porteur_nom: "" },
      porteur: null,
    })
    const champ = screen.getByLabelText("La description")
    fireEvent.change(champ, { target: { value: "posée sur l'établi du forgeron" } })
    fireEvent.blur(champ)
    expect(onRegler).toHaveBeenCalledWith({
      description: "posée sur l'établi du forgeron",
    })
  })

  test("il n'a pas de matrice, et le dit", () => {
    monter({ emploi: { genre: "a-part", porteur: "", porteur_nom: "" }, porteur: null })
    expect(rangees()).toHaveLength(0)
    expect(within(matrice()).getByText(/ne se pose sur personne/)).toBeTruthy()
  })
})

describe("un porteur absent ne fait pas tomber l'écran", () => {
  test("`porteur` à `null` sur un emploi qui porte : l'écran tient et le dit", () => {
    monter({ emploi: { orphelin: true }, porteur: null })
    expect(document.querySelector("[data-emploi]")).toBeTruthy()
    expect(rangees()).toHaveLength(0)
    expect(within(matrice()).getByText(/n'est plus dans le jeu/)).toBeTruthy()
  })

  test("le volet garde ses réglages, et le porteur y dit son absence", () => {
    monter({ emploi: { orphelin: true }, porteur: null })
    expect(screen.getByLabelText("L'emplacement")).toBeTruthy()
    const bloc = document.querySelector("[data-le-porteur]") as HTMLElement
    expect(within(bloc).getByText("il n'est plus dans le jeu")).toBeTruthy()
  })
})

describe("l'entête", () => {
  test("le titre compose le genre et le porteur ; le nom libre est éditable", () => {
    monter()
    expect(
      screen.getByRole("heading", { name: "Portée par Le goliath" }),
    ).toBeTruthy()
    expect(screen.getByLabelText("Le nom de cet emploi")).toHaveValue(
      "L'épée du goliath, en main droite",
    )
  })

  test("le nom se garde quand le champ se referme, et pas avant", () => {
    const { onRegler } = monter()
    const champ = screen.getByLabelText("Le nom de cet emploi")
    fireEvent.change(champ, { target: { value: "L'épée, en main gauche" } })
    expect(onRegler).not.toHaveBeenCalled()
    fireEvent.blur(champ)
    expect(onRegler).toHaveBeenCalledWith({ nom: "L'épée, en main gauche" })
  })

  test("la phrase du calque est là, mot pour mot", () => {
    monter()
    expect(
      screen.getByText(
        "Un calque se pose sur le personnage. Il ne le remplace pas et ne le modifie pas.",
      ),
    ).toBeTruthy()
  })

  test("les autres emplois de la pièce s'ouvrent d'un clic", () => {
    const { onLesAutresEmplois } = monter()
    fireEvent.click(screen.getByRole("button", { name: /Les autres emplois de Épée/ }))
    expect(onLesAutresEmplois).toHaveBeenCalledTimes(1)
  })
})

describe("retirer cet emploi", () => {
  test("le bouton remonte `onRetirer`", () => {
    const { onRetirer } = monter()
    fireEvent.click(screen.getByRole("button", { name: "Retirer cet emploi" }))
    expect(onRetirer).toHaveBeenCalledTimes(1)
  })

  test("l'écran rappelle que les images restent", () => {
    monter()
    expect(
      screen.getByText(
        "Retirer un porteur ne supprime pas ses images : elles restent dans la galerie, détachées.",
      ),
    ).toBeTruthy()
  })
})

describe("le volet", () => {
  test("il fait 380 px, et porte son titre", () => {
    monter()
    const volet = document.querySelector(
      "[data-comment-le-calque-se-pose]",
    ) as HTMLElement
    expect(volet.className).toContain("w-[380px]")
    expect(within(volet).getByText("Comment le calque se pose")).toBeTruthy()
    expect(
      within(volet).getByText("Ces réglages valent pour toutes les poses à la fois."),
    ).toBeTruthy()
  })
})

// ── Le retour au personnage (US-537, AU2) ───────────────────────────────────
//
// Une pièce nommée depuis la fiche de qui la porte descend jusqu'à ses calques ;
// le chemin inverse doit rester ouvert, et il ne peut pas reposer sur la pile —
// un emploi ouvert depuis la galerie ou depuis un travail conservé n'a pas son
// porteur sous lui. D'où un bouton, sur les deux vues de l'écran.

describe("revenir au personnage qui porte", () => {
  test("le bouton nomme le porteur et remonte `onPorteur`", () => {
    const { onPorteur } = monter()
    fireEvent.click(screen.getByRole("button", { name: "‹ Le goliath" }))
    expect(onPorteur).toHaveBeenCalledTimes(1)
  })

  test("un emploi dont le porteur n'est plus dans le jeu n'offre nulle part où revenir", () => {
    monter({ porteur: null })
    expect(screen.queryByRole("button", { name: /^‹ / })).toBeNull()
  })

  test("il ne remplace pas l'accès aux autres emplois de la pièce", () => {
    const { onLesAutresEmplois, onPorteur } = monter()
    fireEvent.click(screen.getByRole("button", { name: /Les autres emplois de Épée/ }))
    expect(onLesAutresEmplois).toHaveBeenCalledTimes(1)
    expect(onPorteur).not.toHaveBeenCalled()
  })
})
