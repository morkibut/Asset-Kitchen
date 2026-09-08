// Ce que le vestiaire d'un sujet montre (B19) : **ce qu'il porte, lui**, et
// non l'équipement du jeu entier — le troisième grief que la tranche lève. Deux
// gestes seulement en partent, et un seul écrit une relation neuve : nommer une
// pièce ici l'attribue d'emblée à ce sujet-là. Aucun appel serveur : la section
// ne reçoit que des props déjà chargées, comme `GrilleDuJeu.tsx`.

import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, test, vi } from "vitest"

import { VestiaireDuSujet, ceQuIlPorte } from "./VestiaireDuSujet"
import {
  RECETTE_VIDE,
  type Asset,
  type Case,
  type EmploiResolu,
  type Personnage,
  type PieceEtSesEmplois,
  type Pose,
  type VestiaireDuJeu,
} from "../api"

afterEach(cleanup)

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
    cout_usd: 0,
    consomme: 0,
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
]

function sujet(surplus: Partial<Personnage> = {}): Personnage {
  return {
    identifiant: "le-pelerin",
    projet: "le-marais",
    nom: "Le pèlerin",
    description: "",
    ecartees: [],
    concept_arts: [],
    references_ecartees: [],
    cree_le: 1_700_000_000,
    cases: [],
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
    pieces: [],
    ...surplus,
  }
}

function emploi(surplus: Partial<EmploiResolu> = {}): EmploiResolu {
  return {
    identifiant: "porte-le-pelerin",
    genre: "porte",
    porteur: "le-pelerin",
    nom: "",
    emplacement: "",
    devant: true,
    description: "",
    deduit: false,
    orphelin: false,
    porteur_nom: "Le pèlerin",
    emplacement_nom: "les mains",
    fait: 2,
    attendu: 6,
    ...surplus,
  }
}

function sienneDuJeu(
  identifiant: string,
  nom: string,
  emplois: EmploiResolu[],
): PieceEtSesEmplois {
  return {
    piece: {
      identifiant,
      nom,
      description: "",
      emplacement: "les-mains",
      portee: "contenue",
      concept_arts: [],
    },
    declare: true,
    emplois,
    fait: emplois.reduce((s, e) => s + e.fait, 0),
    attendu: emplois.reduce((s, e) => s + e.attendu, 0),
  }
}

function vestiaire(pieces: PieceEtSesEmplois[]): VestiaireDuJeu {
  return {
    projet: "le-marais",
    emplacements: [{ identifiant: "les-mains", nom: "les mains", rang: 4 }],
    pieces,
    porteurs: [{ identifiant: "le-pelerin", nom: "Le pèlerin" }],
  }
}

function monter(
  personnage: Personnage,
  vu: VestiaireDuJeu | null,
) {
  const rappels = {
    onPiece: vi.fn(),
    onCreerPiece: vi.fn(),
    onRetirerLEmploi: vi.fn(),
  }
  render(
    <VestiaireDuSujet personnage={personnage} vestiaire={vu} {...rappels} />,
  )
  return rappels
}

// ── Ce qu'il porte, lui — et pas l'équipement du jeu ─────────────────────────

describe("il ne montre que ce que ce sujet-là porte", () => {
  test("une pièce portée par quelqu'un d'autre n'y paraît pas", () => {
    monter(
      sujet(),
      vestiaire([
        sienneDuJeu("epee", "Epée", [emploi()]),
        sienneDuJeu("casque", "Casque", [
          emploi({
            identifiant: "porte-le-goliath",
            porteur: "le-goliath",
            porteur_nom: "Le goliath",
          }),
        ]),
      ]),
    )

    expect(screen.getByText("Epée")).toBeTruthy()
    expect(screen.queryByText("Casque")).toBeNull()
  })

  test("une pièce que personne ne porte n'y paraît pas non plus", () => {
    monter(sujet(), vestiaire([sienneDuJeu("sac", "Sac de voyage", [])]))

    expect(screen.queryByText("Sac de voyage")).toBeNull()
    expect(screen.getByText(/Il ne porte rien encore/)).toBeTruthy()
  })

  test("un emploi qui ne porte personne ne compte pas pour lui", () => {
    // *Posée au sol* n'est portée par personne : elle ne doit pas remonter
    // dans le vestiaire d'un sujet sous prétexte qu'elle existe.
    monter(
      sujet(),
      vestiaire([
        sienneDuJeu("epee", "Epée", [
          emploi({ identifiant: "au-sol", genre: "a-part", porteur: "" }),
        ]),
      ]),
    )

    expect(screen.queryByText("Epée")).toBeNull()
  })
})

// ── Ce qu'une famille ne peut pas avoir n'existe pas dans son établi ─────────

describe("une chose qui ne porte pas d'équipement n'a pas de vestiaire", () => {
  test("un décor ne dessine aucune section — pas même grisée", () => {
    monter(
      sujet({ famille: "decors", equipable: false }),
      vestiaire([sienneDuJeu("epee", "Epée", [emploi()])]),
    )

    expect(document.querySelector("[data-vestiaire-du-sujet]")).toBeNull()
  })

  test("un personnage, lui, l'a toujours — même sans rien porter", () => {
    monter(sujet(), vestiaire([]))

    expect(document.querySelector("[data-vestiaire-du-sujet]")).toBeTruthy()
  })
})

// ── Nommer une pièce ici l'attribue d'emblée ─────────────────────────────────

describe("nommer une pièce ici la lui donne, en un seul geste", () => {
  test("le nom tapé part tel quel", () => {
    const { onCreerPiece } = monter(sujet(), vestiaire([]))

    fireEvent.change(screen.getByLabelText("Nommer une pièce qu'il porte"), {
      target: { value: "  Epée  " },
    })
    fireEvent.click(screen.getByRole("button", { name: "La lui donner" }))

    expect(onCreerPiece).toHaveBeenCalledWith("Epée")
  })

  test("Entrée fait le même geste que le bouton", () => {
    const { onCreerPiece } = monter(sujet(), vestiaire([]))

    const champ = screen.getByLabelText("Nommer une pièce qu'il porte")
    fireEvent.change(champ, { target: { value: "Casque" } })
    fireEvent.keyDown(champ, { key: "Enter" })

    expect(onCreerPiece).toHaveBeenCalledWith("Casque")
  })

  test("un nom vide ne part pas", () => {
    const { onCreerPiece } = monter(sujet(), vestiaire([]))

    fireEvent.change(screen.getByLabelText("Nommer une pièce qu'il porte"), {
      target: { value: "   " },
    })
    fireEvent.keyDown(screen.getByLabelText("Nommer une pièce qu'il porte"), {
      key: "Enter",
    })

    expect(onCreerPiece).not.toHaveBeenCalled()
  })

  test("le champ ne propose aucune pièce du jeu — c'est ce que la tranche retire", () => {
    monter(
      sujet(),
      vestiaire([
        sienneDuJeu("casque", "Casque", [
          emploi({ identifiant: "porte-x", porteur: "x", porteur_nom: "X" }),
        ]),
      ]),
    )

    expect(document.querySelector("datalist")).toBeNull()
    expect(screen.queryByRole("option")).toBeNull()
  })
})

// ── Retirer un porteur ne supprime aucune image ──────────────────────────────

describe("il ne la porte plus, et ses calques restent", () => {
  test("le retrait nomme la pièce et l'emploi, jamais l'image", () => {
    const { onRetirerLEmploi } = monter(
      sujet(),
      vestiaire([sienneDuJeu("epee", "Epée", [emploi()])]),
    )

    fireEvent.click(screen.getByRole("button", { name: "Il ne porte plus Epée" }))

    expect(onRetirerLEmploi).toHaveBeenCalledWith("epee", "porte-le-pelerin")
  })

  test("le geste dit que les calques restent", () => {
    monter(sujet(), vestiaire([sienneDuJeu("epee", "Epée", [emploi()])]))

    expect(
      screen.getByRole("button", { name: "Il ne porte plus Epée" }).getAttribute("title"),
    ).toContain("calques restent")
  })
})

// ── Le calque retenu la représente, et le manque n'a pas de couleur ──────────

describe("elle se montre par le calque retenu sur ce corps-là", () => {
  test("la vignette est celle que le serveur a départagée", () => {
    const calque = image({ identifiant: "calque-1", piece: "epee" })
    monter(
      sujet({
        cases: [
          sienne({
            pose: "repos",
            calques: { epee: [calque, image({ identifiant: "autre", piece: "epee" })] },
            retenus: { epee: "calque-1" },
          }),
        ],
      }),
      vestiaire([sienneDuJeu("epee", "Epée", [emploi()])]),
    )

    const vue = screen.getByAltText("image calque-1")
    expect(vue.getAttribute("src")).toContain("calque-1")
  })

  test("sans calque, la case le dit sans aucune couleur d'alerte", () => {
    monter(sujet(), vestiaire([sienneDuJeu("epee", "Epée", [emploi()])]))

    const case_ = screen.getByRole("button", { name: "Ouvrir Epée" })
    expect(case_.textContent).toContain("aucun calque encore")
    expect(case_.className).not.toContain("signal")
    expect(case_.className).not.toContain("echec")
  })

  test("ouvrir la vignette ouvre la page de la pièce", () => {
    const { onPiece } = monter(
      sujet(),
      vestiaire([sienneDuJeu("epee", "Epée", [emploi()])]),
    )

    fireEvent.click(screen.getByRole("button", { name: "Ouvrir Epée" }))

    expect(onPiece).toHaveBeenCalledWith("epee")
  })

  test("le compte est celui du serveur, jamais recompté ici", () => {
    // Deux calques sur le disque et un `fait` à 2 : c'est `fait / attendu` qui
    // s'écrit, pas le nombre de vignettes trouvées dans les cases.
    monter(
      sujet({
        cases: [
          sienne({
            pose: "repos",
            calques: { epee: [image({ identifiant: "c1", piece: "epee" })] },
            retenus: { epee: "c1" },
          }),
        ],
      }),
      vestiaire([sienneDuJeu("epee", "Epée", [emploi({ fait: 2, attendu: 6 })])]),
    )

    expect(screen.getByText(/2 \/ 6/)).toBeTruthy()
  })
})

// ── Tant qu'on ne l'a pas lu, il le dit ──────────────────────────────────────

describe("un vestiaire pas encore lu ne ressemble pas à un vestiaire vide", () => {
  test("il le dit, plutôt que d'écrire « il ne porte rien »", () => {
    monter(sujet(), null)

    expect(screen.getByText(/Il se lit avec les pièces du jeu/)).toBeTruthy()
    expect(screen.queryByText(/Il ne porte rien encore/)).toBeNull()
  })
})

// ── Le calcul, à part de l'écran ─────────────────────────────────────────────

describe("ceQuIlPorte lit une fois et ne recompte rien", () => {
  test("il rend l'emploi de ce sujet, et le calque retenu avec", () => {
    const calque = image({ identifiant: "c1", piece: "epee" })
    const porte = ceQuIlPorte(
      sujet({
        cases: [
          sienne({
            pose: "repos",
            calques: { epee: [calque] },
            retenus: { epee: "c1" },
          }),
        ],
      }),
      vestiaire([sienneDuJeu("epee", "Epée", [emploi()])]),
    )

    expect(porte).toHaveLength(1)
    expect(porte[0].emploi.identifiant).toBe("porte-le-pelerin")
    expect(porte[0].calque?.identifiant).toBe("c1")
  })

  test("un retenu que la case ne porte pas ne fabrique aucune vignette", () => {
    // Jamais de cascade : une image supprimée vide sa case toute seule, et le
    // vestiaire ne doit pas fabriquer une adresse pour une image absente.
    const porte = ceQuIlPorte(
      sujet({
        cases: [sienne({ pose: "repos", calques: {}, retenus: { epee: "parti" } })],
      }),
      vestiaire([sienneDuJeu("epee", "Epée", [emploi()])]),
    )

    expect(porte[0].calque).toBeNull()
  })
})
