// Ce que la barre fait, et surtout **ce qu'elle ne peut pas faire** (B6).
//
// `App.test.tsx` reste le seul endroit du dépôt où l'atelier entier est monté ;
// ce fichier-ci monte la barre seule, avec des actions écrites à la main — la
// forme exacte de ce que `GET /api/actions` sert. C'est ce qui permet de poser
// la question qui compte : *une action qui coûte peut-elle partir d'ici ?*
//
// La réponse est non, et elle ne tient pas à une garde de cet écran : une
// action à confirmer **arrive sans route**, donc la branche qui appelle le
// serveur ne peut pas la prendre. L'essai le vérifie du dehors, en comptant les
// appels.

import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, test, vi } from "vitest"

import { Barre } from "./Barre"
import type { Action, Asset, Generation, Personnage, Piece, Pose } from "../api"

const PAYANTE: Action = {
  outil: "generate_asset",
  verbe: "generer",
  titre: "Générer une image",
  phrase: "Ouvre l'écran d'envoi, déjà rempli. Rien n'est lancé ni payé ici.",
  paiement: "a-confirmer",
  ou: "envoi",
  route: "",
  besoins: [],
}

const GRATUITE: Action = {
  outil: "rebuild_library",
  verbe: "travailler",
  titre: "Reconstruire l'index de la bibliothèque",
  phrase: "Relit tous les fichiers du disque et refait la base.",
  paiement: "gratuit",
  ou: "ici",
  route: "POST /api/library/rebuild",
  besoins: [],
}

const AILLEURS: Action = {
  outil: "get_budget",
  verbe: "aller",
  titre: "Voir les dépenses",
  phrase: "Ce que la séance a coûté.",
  paiement: "gratuit",
  ou: "depenses",
  route: "",
  besoins: [],
}

const PELERIN = {
  identifiant: "pelerin",
  nom: "Le pèlerin",
  description: "un pèlerin en manteau",
  cases: [{ pose: "repos", images: [{ identifiant: "i1" }], calques: {} }],
} as unknown as Personnage

function monter(surplus: Partial<Parameters<typeof Barre>[0]> = {}) {
  const rappels = {
    surUnPersonnage: vi.fn(),
    surUnePiece: vi.fn(),
    surUneImage: vi.fn(),
    surUneGeneration: vi.fn(),
    surUnLieu: vi.fn(),
    surEnvoi: vi.fn(),
    surJouer: vi.fn(),
    onFermer: vi.fn(),
  }
  render(
    <Barre
      actions={[AILLEURS, PAYANTE, GRATUITE]}
      personnages={[PELERIN]}
      pieces={[] as Piece[]}
      images={[] as Asset[]}
      chantier={[] as Generation[]}
      plan={[] as Pose[]}
      {...rappels}
      {...surplus}
    />,
  )
  return rappels
}

const ligne = (nom: RegExp | string) => screen.getByRole("button", { name: nom })

// Le montage ne se démonte pas tout seul : sans ça, la barre du deuxième essai
// se poserait à côté de celle du premier, et chaque requête en trouverait deux.
afterEach(cleanup)

describe("la barre ne paie et ne lance jamais rien", () => {
  test("une action qui coûte ouvre l'écran d'envoi, et n'appelle rien", () => {
    const rappels = monter()

    fireEvent.click(ligne(/Générer une image/))

    expect(rappels.surEnvoi).toHaveBeenCalledTimes(1)
    expect(rappels.surJouer).not.toHaveBeenCalled()
  })

  test("elle porte la marque « à confirmer », et elle seule", () => {
    monter()

    expect(screen.getAllByText("à confirmer")).toHaveLength(1)
  })

  test("un geste gratuit part par la route que le serveur a servie", () => {
    const rappels = monter()

    fireEvent.click(ligne(/Reconstruire l'index/))

    expect(rappels.surJouer).toHaveBeenCalledWith(
      expect.objectContaining({ route: "POST /api/library/rebuild" }),
    )
    expect(rappels.surEnvoi).not.toHaveBeenCalled()
  })

  test("un geste qui mène ailleurs n'appelle rien non plus", () => {
    const rappels = monter()

    fireEvent.click(ligne(/Voir les dépenses/))

    expect(rappels.surUnLieu).toHaveBeenCalledWith("depenses")
    expect(rappels.surJouer).not.toHaveBeenCalled()
  })
})

describe("elle affiche ce qu'elle reçoit, sans le retrier", () => {
  test("les groupes suivent l'ordre du serveur", () => {
    monter()

    const groupes = [...document.querySelectorAll("[data-groupe]")].map((n) =>
      n.getAttribute("data-groupe"),
    )

    // Ce que le serveur a servi, dans cet ordre-là : aller, générer, travailler.
    expect(groupes).toEqual(["aller", "generer", "travailler"])
  })

  test("le pied compte les actions reçues", () => {
    monter()

    expect(screen.getByText("3 actions disponibles")).toBeTruthy()
  })
})

describe("elle cherche des noms, pas des prompts", () => {
  test("un sujet se trouve sans son accent, avec son contexte", () => {
    const rappels = monter()

    fireEvent.change(screen.getByLabelText("Chercher un sujet ou un geste"), {
      target: { value: "pelerin" },
    })

    const trouve = ligne(/Le personnage Le pèlerin/)
    expect(trouve.textContent).toContain("1 poses sur 1")

    fireEvent.click(trouve)
    expect(rappels.surUnPersonnage).toHaveBeenCalledWith("pelerin")
  })

  test("une seule lettre ne cherche rien — et le dit", () => {
    monter()

    fireEvent.change(screen.getByLabelText("Chercher un sujet ou un geste"), {
      target: { value: "p" },
    })

    expect(screen.queryByText(/Le personnage/)).toBeNull()
  })

  test("ce qu'on tape filtre aussi les gestes", () => {
    monter()

    fireEvent.change(screen.getByLabelText("Chercher un sujet ou un geste"), {
      target: { value: "index" },
    })

    expect(ligne(/Reconstruire l'index/)).toBeTruthy()
    expect(screen.queryByText("Générer une image")).toBeNull()
  })
})

describe("le clavier", () => {
  test("↵ active la ligne choisie, ↓ la fait descendre", () => {
    const rappels = monter()

    const champ = screen.getByLabelText("Chercher un sujet ou un geste")
    fireEvent.keyDown(champ, { key: "ArrowDown" })
    fireEvent.keyDown(champ, { key: "Enter" })

    // La première ligne est « Voir les dépenses » ; la seconde, l'action qui
    // coûte — et elle ouvre l'envoi, comme au clic.
    expect(rappels.surEnvoi).toHaveBeenCalledTimes(1)
  })

  test("échap referme", () => {
    const rappels = monter()

    fireEvent.keyDown(screen.getByLabelText("Chercher un sujet ou un geste"), {
      key: "Escape",
    })

    expect(rappels.onFermer).toHaveBeenCalled()
  })
})
