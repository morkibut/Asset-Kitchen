// TS2 — le panneau d'une carte propose de la faire naître en sujet.
//
// **Monté seul, sans `App`**, comme `Fiche.test.tsx` : `CarteTuile` porte le
// panneau d'une carte (son menu, `Reglages`), et les deux gestes de la
// tranche — créer, ou ouvrir le sujet qui existe déjà — sont deux contextes
// (`CREER_SUJET`, `OUVRIR_SUJET`) qu'`Univers.tsx` fournit à l'écran réel. Les
// fournir ici suffit à observer le bouton sans le serveur ni `App` entier.
//
// Ne coûte rien : aucune route n'est appelée, les deux gestes sont de simples
// rappels observés par un espion.

import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, expect, test, vi } from "vitest"

import type { Carte, Personnage } from "../api"
import { CREER_SUJET, CarteTuile, OUVRIR_SUJET } from "./Tableau"

afterEach(cleanup)

const carteImage = (sur: Partial<Carte> = {}): Carte => ({
  identifiant: "carte-1",
  projet: "marais",
  genre: "image",
  texte: "",
  statut: "prete",
  raison: null,
  source: "",
  cree_le: 0,
  groupe: "",
  note: "Le forgeron",
  taille: 1,
  position: null,
  largeur_libre: null,
  teinte: "",
  officiel: false,
  famille: "objets",
  empreinte: "v1",
  largeur: 64,
  hauteur: 64,
  type_media: "image/png",
  octets: 100,
  montrable: true,
  artwork: false,
  en_reserve: true,
  ...sur,
})

const carteTexte = (sur: Partial<Carte> = {}): Carte => ({
  ...carteImage(sur),
  genre: "texte",
  texte: "une intention",
})

/** Ouverte d'emblée (`choisie`) : le menu de la carte, donc son panneau, se
 *  rend sans survol ni clic à simuler — ce que jsdom ne mesure pas. */
function monterPanneau(carte: Carte, options: {
  personnages?: Personnage[]
  creerSujet?: (c: Carte) => void
  ouvrirSujet?: (id: string) => void
} = {}) {
  return render(
    <CREER_SUJET.Provider value={options.creerSujet ?? null}>
      <OUVRIR_SUJET.Provider value={options.ouvrirSujet ?? null}>
        <CarteTuile
          carte={carte}
          personnages={options.personnages ?? []}
          choisie
          survolee={false}
          onSurvol={() => {}}
          onChoisir={() => {}}
          onErreur={() => {}}
        />
      </OUVRIR_SUJET.Provider>
    </CREER_SUJET.Provider>,
  )
}

// **Le libellé infobulle porte aussi `role="button"`** (`Libelle`, dans
// `pieces.tsx`) : le même texte y paraît deux fois, une fois comme titre
// pointillé, une fois comme vrai bouton. On filtre sur la balise pour ne
// cliquer que le second.
function boutonNomme(nom: string): HTMLElement {
  const trouve = screen.getAllByRole("button", { name: nom }).find((b) => b.tagName === "BUTTON")
  if (!trouve) throw new Error(`aucun <button> nommé "${nom}"`)
  return trouve
}

test("une carte image propose de la faire naître en sujet", () => {
  const creerSujet = vi.fn()
  monterPanneau(carteImage(), { creerSujet })

  fireEvent.click(boutonNomme("Créer un sujet avec cette image"))
  expect(creerSujet).toHaveBeenCalledWith(expect.objectContaining({ identifiant: "carte-1" }))
})

test("une carte texte ne porte pas le bouton — ce qui part en portrait, ce sont des octets d'image", () => {
  monterPanneau(carteTexte(), { creerSujet: vi.fn() })
  expect(screen.queryByRole("button", { name: "Créer un sujet avec cette image" })).toBeNull()
})

test("sans les deux gestes fournis, le bloc ne paraît pas — ni bouton, ni bandeau vide", () => {
  monterPanneau(carteImage())
  expect(screen.queryByText("Créer un sujet avec cette image")).toBeNull()
  expect(screen.queryByText(/^Déjà le sujet/)).toBeNull()
})

test("une carte déjà concept art d'un sujet dit lequel et l'ouvre, plutôt que d'en proposer un second", () => {
  const ouvrirSujet = vi.fn()
  const creerSujet = vi.fn()
  const forgeron = { identifiant: "le-forgeron", nom: "Le forgeron", concept_arts: ["carte-1"] } as Personnage

  monterPanneau(carteImage(), { personnages: [forgeron], creerSujet, ouvrirSujet })

  expect(screen.getByText("Déjà le sujet Le forgeron")).toBeInTheDocument()
  expect(screen.queryByRole("button", { name: "Créer un sujet avec cette image" })).toBeNull()

  fireEvent.click(screen.getByRole("button", { name: "Ouvrir Le forgeron" }))
  expect(ouvrirSujet).toHaveBeenCalledWith("le-forgeron")
  expect(creerSujet).not.toHaveBeenCalled()
})
