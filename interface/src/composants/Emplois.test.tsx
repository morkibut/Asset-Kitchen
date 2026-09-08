// Ce que la page d'une pièce montre (B19) : ses emplois, les façons dont elle
// sert. Aucun appel serveur — l'écran ne reçoit que des props déjà chargées et
// remonte les trois gestes au parent, comme `GrilleDuJeu.tsx`. Il n'y a donc
// aucun double de `fetch` ici, et c'est le signe que le partage est bon.

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react"
import { afterEach, describe, expect, test, vi } from "vitest"

import { Emplois } from "./Emplois"
import type { EmploiResolu, Piece, PieceEtSesEmplois } from "../api"

afterEach(cleanup)

// ── Ce qu'on monte ──────────────────────────────────────────────────────────

const PORTEURS = [
  { identifiant: "goliath", nom: "Le goliath" },
  { identifiant: "minus", nom: "Le minus" },
  { identifiant: "magicien", nom: "Le magicien" },
]

function emploi(surplus: Partial<EmploiResolu> & { identifiant: string }): EmploiResolu {
  return {
    genre: "porte",
    porteur: "",
    nom: "",
    emplacement: "",
    devant: true,
    description: "",
    deduit: false,
    orphelin: false,
    porteur_nom: "",
    emplacement_nom: "",
    fait: 0,
    attendu: 0,
    ...surplus,
  }
}

function piece(surplus: Partial<Piece> = {}): Piece {
  return {
    identifiant: "epee",
    nom: "Epée",
    description: "A classic one hand sword",
    emplacement: "les-mains",
    portee: "contenue",
    concept_arts: [],
    ...surplus,
  }
}

function monter(
  surplus: Partial<PieceEtSesEmplois> = {},
  porteurs: readonly { identifiant: string; nom: string }[] = PORTEURS,
) {
  const emplois = surplus.emplois ?? []
  const onEmploi = vi.fn()
  const onAjouterEmploi = vi.fn()
  const onRetirerLaPiece = vi.fn()
  const onErreur = vi.fn()
  render(
    <Emplois
      pieceEtSesEmplois={{
        piece: piece(),
        declare: true,
        emplois,
        fait: emplois.reduce((n, e) => n + e.fait, 0),
        attendu: emplois.reduce((n, e) => n + e.attendu, 0),
        ...surplus,
      }}
      porteurs={porteurs}
      onEmploi={onEmploi}
      onAjouterEmploi={onAjouterEmploi}
      onRetirerLaPiece={onRetirerLaPiece}
      onErreur={onErreur}
    />,
  )
  return { onEmploi, onAjouterEmploi, onRetirerLaPiece, onErreur }
}

/** Une ligne d'emploi par son identifiant — la liste n'a pas de rôle propre, et
 *  viser le libellé rendrait l'essai circulaire quand c'est justement le
 *  libellé qu'on vérifie. */
function ligne(identifiant: string): HTMLElement {
  return document.querySelector(`[data-emploi="${identifiant}"]`) as HTMLElement
}

/** Ouvrir le formulaire d'ajout par le bouton du bas de liste. */
function ouvrirLAjout() {
  fireEvent.click(document.querySelector("[data-ouvrir-l-ajout]") as HTMLElement)
  return document.querySelector("[data-ajout-d-emploi]") as HTMLElement
}

// ── Les essais ──────────────────────────────────────────────────────────────

describe("un emploi sans nom écrit se compose de son genre et de son porteur", () => {
  test("porté, il dit qui le porte", () => {
    monter({
      emplois: [emploi({ identifiant: "e1", genre: "porte", porteur: "goliath", porteur_nom: "Le goliath" })],
    })

    expect(ligne("e1").textContent).toContain("Portée par Le goliath")
  })

  test("une image à part se nomme elle-même", () => {
    monter({ emplois: [emploi({ identifiant: "e2", genre: "a-part" })] })

    expect(ligne("e2").textContent).toContain("Une image à part")
  })

  test("une mise en scène se nomme elle-même", () => {
    monter({ emplois: [emploi({ identifiant: "e3", genre: "mise-en-scene" })] })

    expect(ligne("e3").textContent).toContain("Une mise en scène")
  })

  test("le nom écrit par l'auteur passe avant le libellé composé", () => {
    monter({
      emplois: [
        emploi({
          identifiant: "e4",
          genre: "mise-en-scene",
          nom: "Plantée dans un rocher",
        }),
      ],
    })

    expect(ligne("e4").textContent).toContain("Plantée dans un rocher")
    expect(ligne("e4").textContent).not.toContain("Une mise en scène")
  })
})

describe("la seconde ligne dit où la pièce se pose, ou ce qu'elle est", () => {
  test("un emploi porté dit son emplacement et de quel côté du corps", () => {
    monter({
      emplois: [
        emploi({
          identifiant: "e1",
          genre: "porte",
          porteur: "minus",
          porteur_nom: "Le minus",
          emplacement_nom: "le dos",
          devant: false,
        }),
      ],
    })

    expect(ligne("e1").textContent).toContain("le dos · derrière le corps")
  })

  test("un emploi qui n'est pas porté montre sa description", () => {
    monter({
      emplois: [
        emploi({
          identifiant: "e2",
          genre: "a-part",
          description: "un objet, à l'échelle « objet posé »",
        }),
      ],
    })

    expect(ligne("e2").textContent).toContain("un objet, à l'échelle « objet posé »")
  })
})

describe("le compte d'une ligne a trois états, et pas un de plus", () => {
  test("tout ce qui est attendu est fait : complet", () => {
    monter({ emplois: [emploi({ identifiant: "e1", fait: 24, attendu: 24 })] })

    expect(ligne("e1").textContent).toContain("24 / 24")
    expect(ligne("e1").textContent).toContain("complet")
  })

  test("rien n'est fait : rien", () => {
    monter({ emplois: [emploi({ identifiant: "e1", fait: 0, attendu: 24 })] })

    expect(ligne("e1").textContent).toContain("0 / 24")
    expect(ligne("e1").textContent).toContain("rien")
  })

  test("entre les deux, il dit combien il en manque", () => {
    monter({ emplois: [emploi({ identifiant: "e1", fait: 6, attendu: 24 })] })

    expect(ligne("e1").textContent).toContain("6 / 24")
    expect(ligne("e1").textContent).toContain("18 manquent")
  })

  test("le compte de la pièce entière est celui de la lecture, pas une somme d'écran", () => {
    monter({
      emplois: [emploi({ identifiant: "e1", fait: 6, attendu: 24 })],
      fait: 31,
      attendu: 75,
    })

    expect(
      document.querySelector("[data-compte-de-la-piece]")?.textContent,
    ).toContain("31 images sur 75")
  })
})

describe("une ligne dit d'elle-même ce qu'elle a d'inhabituel", () => {
  test("un emploi déduit dit qu'il a été lu sur les images", () => {
    monter({
      emplois: [
        emploi({ identifiant: "e1", porteur: "goliath", porteur_nom: "Le goliath", deduit: true }),
        emploi({ identifiant: "e2", porteur: "minus", porteur_nom: "Le minus" }),
      ],
    })

    expect(ligne("e1").textContent).toContain("lu sur ses images")
    expect(ligne("e2").textContent).not.toContain("lu sur ses images")
  })

  test("un emploi orphelin dit que son porteur n'est plus là", () => {
    monter({
      emplois: [
        emploi({ identifiant: "e1", porteur: "parti", porteur_nom: "Le fantôme", orphelin: true }),
      ],
    })

    expect(ligne("e1").textContent).toContain("ce porteur n'est plus dans le jeu")
  })

  test("rien n'est déclaré : l'écran le dit plutôt que de laisser croire à des choix", () => {
    monter({
      declare: false,
      emplois: [emploi({ identifiant: "e1", porteur: "goliath", porteur_nom: "Le goliath" })],
    })

    expect(screen.getByText(/tout ce qui suit est lu sur ses calques/i)).toBeTruthy()
  })
})

describe("les gestes remontent au parent, l'écran n'appelle jamais le réseau", () => {
  test("cliquer une ligne ouvre cet emploi-là", () => {
    const { onEmploi } = monter({
      emplois: [
        emploi({ identifiant: "e1", porteur: "goliath", porteur_nom: "Le goliath" }),
        emploi({ identifiant: "e2", porteur: "minus", porteur_nom: "Le minus" }),
      ],
    })

    fireEvent.click(ligne("e2"))

    expect(onEmploi).toHaveBeenCalledTimes(1)
    expect(onEmploi).toHaveBeenCalledWith("e2")
  })

  test("« La retirer du jeu » remonte le retrait, et rappelle que les calques restent", () => {
    const { onRetirerLaPiece } = monter()

    expect(screen.getByText(/ils restent dans la galerie, détachés/i)).toBeTruthy()
    fireEvent.click(screen.getByRole("button", { name: "La retirer du jeu" }))

    expect(onRetirerLaPiece).toHaveBeenCalledTimes(1)
  })
})

describe("ajouter un emploi se fait en place, sans fenêtre flottante", () => {
  test("le formulaire ne propose pas quelqu'un qui la porte déjà", () => {
    monter({
      emplois: [
        emploi({ identifiant: "e1", genre: "porte", porteur: "goliath", porteur_nom: "Le goliath" }),
      ],
    })

    const formulaire = ouvrirLAjout()
    const choix = within(formulaire).getByLabelText("Le porteur")

    expect(within(choix).queryByRole("option", { name: "Le goliath" })).toBeNull()
    expect(within(choix).getByRole("option", { name: "Le minus" })).toBeTruthy()
    expect(within(choix).getByRole("option", { name: "Le magicien" })).toBeTruthy()
  })

  test("un emploi porté part avec son genre et son porteur, et rien d'autre", () => {
    const { onAjouterEmploi, onErreur } = monter()

    const formulaire = ouvrirLAjout()
    fireEvent.change(within(formulaire).getByLabelText("Le porteur"), {
      target: { value: "magicien" },
    })
    fireEvent.click(within(formulaire).getByRole("button", { name: "Ajouter" }))

    expect(onAjouterEmploi).toHaveBeenCalledTimes(1)
    expect(onAjouterEmploi).toHaveBeenCalledWith({ genre: "porte", porteur: "magicien" })
    expect(onErreur).not.toHaveBeenCalled()
  })

  test("sans porteur choisi, l'écran refuse lui-même et n'ajoute rien", () => {
    const { onAjouterEmploi, onErreur } = monter()

    const formulaire = ouvrirLAjout()
    fireEvent.click(within(formulaire).getByRole("button", { name: "Ajouter" }))

    expect(onAjouterEmploi).not.toHaveBeenCalled()
    expect(onErreur).toHaveBeenCalledTimes(1)
  })

  test("une image à part part avec le nom qu'on lui donne", () => {
    const { onAjouterEmploi } = monter()

    const formulaire = ouvrirLAjout()
    fireEvent.click(within(formulaire).getByRole("radio", { name: "Une image à part" }))
    fireEvent.change(within(formulaire).getByLabelText("Le nom de l'emploi"), {
      target: { value: "Son icône d'inventaire" },
    })
    fireEvent.click(within(formulaire).getByRole("button", { name: "Ajouter" }))

    expect(onAjouterEmploi).toHaveBeenCalledWith({
      genre: "a-part",
      nom: "Son icône d'inventaire",
    })
  })

  test("une mise en scène sans nom part quand même : c'est le serveur qui la nomme", () => {
    const { onAjouterEmploi } = monter()

    const formulaire = ouvrirLAjout()
    fireEvent.click(within(formulaire).getByRole("radio", { name: "Une mise en scène" }))
    fireEvent.click(within(formulaire).getByRole("button", { name: "Ajouter" }))

    expect(onAjouterEmploi).toHaveBeenCalledWith({ genre: "mise-en-scene" })
  })

  test("quand tout le monde la porte déjà, il le dit plutôt que d'offrir une liste vide", () => {
    monter(
      {
        emplois: [
          emploi({ identifiant: "e1", genre: "porte", porteur: "goliath", porteur_nom: "Le goliath" }),
        ],
      },
      [{ identifiant: "goliath", nom: "Le goliath" }],
    )

    const formulaire = ouvrirLAjout()

    expect(within(formulaire).queryByLabelText("Le porteur")).toBeNull()
    expect(within(formulaire).getByText(/la portent déjà/i)).toBeTruthy()
  })
})

describe("une pièce n'a pas d'image à elle", () => {
  test("l'écran n'en dessine aucune", () => {
    monter({
      emplois: [
        emploi({ identifiant: "e1", porteur: "goliath", porteur_nom: "Le goliath", fait: 24, attendu: 24 }),
      ],
    })

    expect(document.querySelector("[data-emplois] img")).toBeNull()
  })

  test("sous « Son image de référence », c'est sa description qui paraît", () => {
    monter()

    expect(screen.getByRole("heading", { name: "Son image de référence" })).toBeTruthy()
    expect(screen.getByText("« A classic one hand sword »")).toBeTruthy()
  })
})

describe("l'entête compte les emplois réels", () => {
  test("aucun emploi : il le dit, et n'annonce pas de façons de servir", () => {
    monter({ emplois: [] })

    expect(screen.getByRole("heading", { name: "Ses emplois" })).toBeTruthy()
    expect(screen.getByText(/aucun emploi encore/i)).toBeTruthy()
  })

  test("plusieurs emplois : le titre et le sous-titre portent le même nombre", () => {
    monter({
      emplois: [
        emploi({ identifiant: "e1", porteur: "goliath", porteur_nom: "Le goliath" }),
        emploi({ identifiant: "e2", porteur: "minus", porteur_nom: "Le minus" }),
        emploi({ identifiant: "e3", genre: "a-part" }),
      ],
    })

    expect(screen.getByRole("heading", { name: "Ses 3 emplois" })).toBeTruthy()
    expect(screen.getByText(/3 façons de servir/)).toBeTruthy()
  })
})
