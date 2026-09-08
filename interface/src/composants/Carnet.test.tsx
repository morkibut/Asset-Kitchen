// Ce que le carnet fait des collections, et **ce qu'il annonce avant qu'on
// lâche** (B8, B9.5).
//
// `App.test.tsx` monte l'atelier entier et tient les trois règles de `B0` — une
// seule ligne ouverte, jamais plus de trente lignes, il ne se ferme pas tout
// seul. Ce fichier-ci monte le carnet seul, pour poser les questions que la
// tranche `B9` lui ajoute et qu'un écran entier rendrait floues :
//
// - une famille dépliée montre ses **collections**, plus seulement « Tous » ;
// - une collection est une **cible de dépôt**, et elle écrit « 10 + 3 » pendant
//   qu'on la survole ;
// - le « + 3 » est **ce qui arriverait**, jamais ce qu'on traîne : ranger ce qui
//   est rangé est un geste sans effet, et annoncer trois pour en poser un serait
//   mentir sur ce qui va se passer ;
// - au-delà du plafond, la liste s'arrête et **dit combien manquent** plutôt que
//   de faire déborder le carnet en silence.

import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, expect, test, vi } from "vitest"

import { COLLECTIONS_AU_PLUS, Carnet, LIGNES_AU_PLUS } from "./Carnet"
import { GLISSE_DES_SUJETS } from "./Famille"
import type { GroupeDeRangement } from "../api"

const FAMILLES = [
  { cle: "personnages", nom: "Les personnages", compte: 54 },
  { cle: "objets", nom: "Les objets", compte: 250 },
]

const GROUPES: GroupeDeRangement[] = [
  { identifiant: "les-heros", nom: "Les héros", sujets: 3 },
  { identifiant: "les-boss", nom: "Les boss", sujets: 10 },
]

/** Ce que le navigateur donne à une cible pendant un glissement.
 *
 *  jsdom n'en fabrique pas : le double ne porte donc que ce que l'écran lit
 *  vraiment — `types`, et rien d'autre, puisque `getData` est vide pendant le
 *  survol dans tous les navigateurs. */
const GLISSEMENT = {
  dataTransfer: { types: [GLISSE_DES_SUJETS], getData: () => "", files: [] },
}

function monter(surplus: Partial<Parameters<typeof Carnet>[0]> = {}) {
  const rappels = {
    surLeJeu: vi.fn(),
    surLaFamille: vi.fn(),
    surLaCollection: vi.fn(),
    surNouvelleCollection: vi.fn(),
    surDeposer: vi.fn(),
    surLesRegles: vi.fn(),
    surLesReglesDuJeu: vi.fn(),
    surLaGalerie: vi.fn(),
    surLesDepenses: vi.fn(),
    surUnAutreJeu: vi.fn(),
    surTousLesJeux: vi.fn(),
    surCommencerUnJeu: vi.fn(),
    surLaBarre: vi.fn(),
    surLeGuide: vi.fn(),
    surLInstallation: vi.fn(),
  }
  render(
    <Carnet
      jeu="Le marais"
      seconde="560 images"
      familles={FAMILLES}
      collections={GROUPES}
      collectionOuverte={null}
      piecesDuJeu={[]}
      pieceOuverte={null}
      surUnePiece={vi.fn()}
      arrivants={{}}
      regles={61}
      lignesEcrites={3}
      images={560}
      depense={0}
      autresJeux={[]}
      ouvert={null}
      {...rappels}
      {...surplus}
    />,
  )
  return rappels
}

afterEach(cleanup)

/** Déplier une famille — le geste par lequel ses collections paraissent. */
function deplier(nom = /^Les personnages/) {
  fireEvent.click(screen.getByRole("button", { name: nom }))
}

test("une famille dépliée montre ses collections, plus seulement « Tous »", () => {
  monter()
  deplier()

  expect(screen.getByRole("button", { name: /^Tous/ })).toBeTruthy()
  expect(screen.getByRole("button", { name: /^Les héros/ })).toBeTruthy()
  expect(screen.getByRole("button", { name: /^Les boss/ })).toBeTruthy()
  expect(screen.getByRole("button", { name: /Nouvelle collection/ })).toBeTruthy()
})

test("chaque collection porte ce qu'elle contient de ce jeu-ci", () => {
  monter()
  deplier()

  expect(screen.getByRole("button", { name: /^Les boss/ }).textContent).toContain("10")
  expect(screen.getByRole("button", { name: /^Les héros/ }).textContent).toContain("3")
})

test("cliquer une collection l'ouvre, cliquer « Tous » rend la famille entière", () => {
  const rappels = monter()
  deplier()

  fireEvent.click(screen.getByRole("button", { name: /^Les boss/ }))
  expect(rappels.surLaCollection).toHaveBeenCalledWith("personnages", "les-boss")

  fireEvent.click(screen.getByRole("button", { name: /^Tous/ }))
  expect(rappels.surLaCollection).toHaveBeenCalledWith("personnages", null)
})

test("la collection survolée pendant un glissement annonce « 10 + 3 »", () => {
  monter({ arrivants: { "les-boss": 3 } })
  deplier()

  const boss = screen.getByRole("button", { name: /^Les boss/ })
  expect(boss.textContent).toContain("10")
  expect(boss.textContent).not.toContain("+")

  fireEvent.dragOver(boss, GLISSEMENT)
  expect(boss.textContent).toContain("10 + 3")

  // Et au lâcher, il redevient un simple chiffre — la planche le dit en toutes
  // lettres : « au lâcher, il redevient un simple 13 ».
  fireEvent.drop(boss, GLISSEMENT)
  expect(boss.textContent).not.toContain("+")
})

test("une collection où les sujets sont déjà tous rangés ne s'allume pas", () => {
  // Zéro arrivant n'est pas « rien n'est glissé » : c'est « ils y sont déjà
  // tous ». La ligne doit le dire en ne promettant rien, pas en promettant zéro.
  monter({ arrivants: { "les-boss": 0 } })
  deplier()

  const boss = screen.getByRole("button", { name: /^Les boss/ })
  fireEvent.dragOver(boss, GLISSEMENT)
  expect(boss.textContent).not.toContain("+")
})

test("lâcher sur une collection la nomme au parent", () => {
  const rappels = monter({ arrivants: { "les-boss": 2 } })
  deplier()

  fireEvent.drop(screen.getByRole("button", { name: /^Les boss/ }), GLISSEMENT)
  expect(rappels.surDeposer).toHaveBeenCalledWith("les-boss")
})

test("un glissement d'un autre genre ne réveille aucune collection", () => {
  // Le type sert de discriminant de provenance, comme pour les cartes de la
  // toile : une image tirée du bureau n'est pas une sélection de sujets.
  const rappels = monter({ arrivants: { "les-boss": 3 } })
  deplier()

  const boss = screen.getByRole("button", { name: /^Les boss/ })
  const etranger = { dataTransfer: { types: ["Files"], getData: () => "", files: [] } }
  fireEvent.dragOver(boss, etranger)
  expect(boss.textContent).not.toContain("+")

  fireEvent.drop(boss, etranger)
  expect(rappels.surDeposer).not.toHaveBeenCalled()
})

test("au-delà du plafond, la liste s'arrête et dit combien manquent", () => {
  // Sans quoi un jeu à quarante groupes ferait un carnet de cinquante lignes,
  // et la règle n°2 tomberait sans que rien ne le dise.
  const beaucoup: GroupeDeRangement[] = Array.from(
    { length: COLLECTIONS_AU_PLUS + 7 },
    (_, rang) => ({
      identifiant: `groupe-${rang}`,
      nom: `Le groupe ${rang}`,
      sujets: rang,
    }),
  )
  monter({ collections: beaucoup })
  deplier()

  expect(
    screen.getAllByRole("button", { name: /^Le groupe/ }).length,
  ).toBe(COLLECTIONS_AU_PLUS)
  expect(screen.getByText(/et 7 autres/)).toBeTruthy()
})

test("« + Nouvelle collection » nomme sa famille au parent", () => {
  const rappels = monter()
  deplier()

  fireEvent.click(screen.getByRole("button", { name: /Nouvelle collection/ }))
  expect(rappels.surNouvelleCollection).toHaveBeenCalledWith("personnages")
})

test("sans collection, une famille ne déplie que « Tous » et l'ajout", () => {
  monter({ collections: [] })
  deplier()

  expect(screen.getByRole("button", { name: /^Tous/ })).toBeTruthy()
  expect(screen.getByRole("button", { name: /Nouvelle collection/ })).toBeTruthy()
  expect(screen.queryByText(/et \d+ autres/)).toBeNull()
})

// ── B14 — la ligne des règles du jeu ────────────────────────────────────────

test("« Les règles du jeu » ouvre le parcours, et compte les lignes écrites", () => {
  const rappels = monter({ lignesEcrites: 3 })

  const ligne = screen.getByRole("button", { name: /^Les règles du jeu/ })
  fireEvent.click(ligne)

  expect(rappels.surLesReglesDuJeu).toHaveBeenCalled()
  // **Cinq et non sept** : le rendu et la vue ne se tapent pas, l'atelier les
  // écrit depuis l'allure et la vue choisies. Compter sur sept ferait croire
  // qu'il en reste deux à remplir.
  expect(ligne.textContent).toContain("3 / 5")
})

test("la ligne des règles ne se confond pas avec la toile de l'univers", () => {
  const rappels = monter()

  fireEvent.click(screen.getByRole("button", { name: /La toile de l'univers/ }))

  expect(rappels.surLesRegles).toHaveBeenCalled()
  expect(rappels.surLesReglesDuJeu).not.toHaveBeenCalled()
})

test("le carnet tient toujours sous son plafond avec la ligne de plus", () => {
  monter({ lignesEcrites: 5 })
  deplier()

  expect(
    document.querySelectorAll("[data-ligne-du-carnet]").length,
  ).toBeLessThanOrEqual(LIGNES_AU_PLUS)
})
