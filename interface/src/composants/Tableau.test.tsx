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

import type { Carte, Personnage, PhraseDeCarte } from "../api"
import { CREER_SUJET, CarteTuile, DEVELOPPER, ENCORE, OUVRIR_SUJET, REPRENDRE_TEXTE, RETOUCHER } from "./Tableau"

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
  reprendreTexte?: (p: PhraseDeCarte) => void
  developper?: (c: Carte) => void
  encore?: (c: Carte, p: PhraseDeCarte) => void
  retoucher?: (c: Carte) => void
} = {}) {
  return render(
    <CREER_SUJET.Provider value={options.creerSujet ?? null}>
      <OUVRIR_SUJET.Provider value={options.ouvrirSujet ?? null}>
        <REPRENDRE_TEXTE.Provider value={options.reprendreTexte ?? null}>
          <DEVELOPPER.Provider value={options.developper ?? null}>
            <ENCORE.Provider value={options.encore ?? null}>
              <RETOUCHER.Provider value={options.retoucher ?? null}>
                <CarteTuile
                  carte={carte}
                  personnages={options.personnages ?? []}
                  choisie
                  survolee={false}
                  onSurvol={() => {}}
                  onChoisir={() => {}}
                  onErreur={() => {}}
                />
              </RETOUCHER.Provider>
            </ENCORE.Provider>
          </DEVELOPPER.Provider>
        </REPRENDRE_TEXTE.Provider>
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

// TS18 — « Retoucher dans l'atelier », depuis le panneau d'une carte.

test("une carte image propose de la retoucher dans l'atelier", () => {
  const retoucher = vi.fn()
  monterPanneau(carteImage(), { retoucher })

  fireEvent.click(boutonNomme("Retoucher dans l’atelier"))
  expect(retoucher).toHaveBeenCalledWith(expect.objectContaining({ identifiant: "carte-1" }))
})

test("une carte texte ne porte pas le bouton — la retouche ne connaît que des images", () => {
  monterPanneau(carteTexte(), { retoucher: vi.fn() })
  expect(screen.queryByRole("button", { name: "Retoucher dans l’atelier" })).toBeNull()
})

test("sans le geste fourni, le bouton ne paraît pas — hors de la toile et de la grille", () => {
  monterPanneau(carteImage())
  expect(screen.queryByText("Retoucher dans l’atelier")).toBeNull()
})

test("une carte encore en attente ne porte pas le bouton — pas d'image à retoucher", () => {
  monterPanneau(carteImage({ statut: "attente", montrable: false }), { retoucher: vi.fn() })
  expect(screen.queryByRole("button", { name: "Retoucher dans l’atelier" })).toBeNull()
})

// TS5 — la phrase d'une carte fabriquée depuis la toile, et « Reprendre ce
// texte ». Même montage isolé, sans serveur : `carte.phrase` est ce que
// `/board` a déjà calculé, il n'y a rien à demander de plus ici.

const phrase = (sur: Partial<PhraseDeCarte> = {}): PhraseDeCarte => ({
  texte: "un héron au bord de l'eau",
  modele: "essai:rend-du-png",
  resolution: "512",
  repris: false,
  references: [],
  ...sur,
})

test("une carte fabriquée depuis la toile montre sa phrase", () => {
  monterPanneau(carteImage({ phrase: phrase() }))
  expect(screen.getByText("un héron au bord de l'eau")).toBeInTheDocument()
})

test("une carte sans phrase — note, image collée, clip — ne montre rien de tout ça", () => {
  monterPanneau(carteImage({ phrase: null }))
  expect(screen.queryByText(/Phrase/)).toBeNull()
})

test("une carte texte ne porte pas ce bloc, même si un genre voisin en portait un", () => {
  monterPanneau(carteTexte({ phrase: phrase() }))
  expect(screen.queryByText("un héron au bord de l'eau")).toBeNull()
})

test("« Reprendre ce texte » rend la phrase entière, le modèle et la taille d'origine", () => {
  const reprendreTexte = vi.fn()
  const laPhrase = phrase({ modele: "OpenRouter:openai/gpt-image-2", resolution: "1024", repris: true })
  monterPanneau(carteImage({ phrase: laPhrase }), { reprendreTexte })

  fireEvent.click(boutonNomme("Reprendre ce texte ›"))
  expect(reprendreTexte).toHaveBeenCalledWith(laPhrase)
})

test("sans le geste fourni, le bouton disparaît — comme « Prendre comme référence » hors toile", () => {
  monterPanneau(carteImage({ phrase: phrase() }))
  expect(screen.queryByRole("button", { name: "Reprendre ce texte ›" })).toBeNull()
})

// TS7 — « Encore » : relancer la même demande qu'une carte fabriquée depuis
// la barre, sans rien retaper. Même carte, même bloc que « Reprendre ce
// texte » — la phrase doit exister pour qu'il y ait quelque chose à
// relancer — mais reçoit en plus la carte elle-même, pour savoir à quoi
// relier le résultat.

test("« Encore » relance avec la carte et sa phrase entière", () => {
  const encore = vi.fn()
  const laPhrase = phrase({
    modele: "OpenRouter:openai/gpt-image-2",
    resolution: "1024",
    references: [{ asset: "renard", role: "edition", origine: "carte" }],
  })
  monterPanneau(carteImage({ phrase: laPhrase }), { encore })

  fireEvent.click(boutonNomme("Encore ›"))
  expect(encore).toHaveBeenCalledWith(expect.objectContaining({ identifiant: "carte-1" }), laPhrase)
})

test("sans phrase, « Encore » ne paraît pas — rien à relancer", () => {
  // **C'est le cas que le seul essai « sans le geste fourni » ne verrait
  // pas** : même avec `encore` fourni, sans `carte.phrase` le bouton ne
  // peut pas paraître — un essai qui oublierait cette condition et
  // monterait toujours le bouton dès que le geste est fourni passerait à
  // tort (8octies : ce test tombe si le bloc entier n'est plus gardé par
  // `carte.phrase`).
  monterPanneau(carteImage({ phrase: null }), { encore: vi.fn() })
  expect(screen.queryByRole("button", { name: "Encore ›" })).toBeNull()
})

test("sans le geste fourni, « Encore » disparaît — même règle que les autres gestes de la toile", () => {
  monterPanneau(carteImage({ phrase: phrase() }))
  expect(screen.queryByRole("button", { name: "Encore ›" })).toBeNull()
})

// TS10 — « Développer ce sujet » : sur toute carte image arrivée, pas
// seulement celles que la barre a fabriquées (`phrase` absente ici, à la
// différence des essais de TS5 ci-dessus) — c'est le critère qui distingue
// ce bouton de « Reprendre ce texte ».

test("toute carte image arrivée porte « Développer ce sujet », même sans phrase ni geste de TS5", () => {
  const developper = vi.fn()
  monterPanneau(carteImage({ phrase: null }), { developper })

  fireEvent.click(boutonNomme("Développer ce sujet"))
  expect(developper).toHaveBeenCalledWith(expect.objectContaining({ identifiant: "carte-1" }))
})

test("une carte texte ne porte pas « Développer ce sujet » — rien à développer sans image", () => {
  monterPanneau(carteTexte(), { developper: vi.fn() })
  expect(screen.queryByRole("button", { name: "Développer ce sujet" })).toBeNull()
})

test("une carte pas encore arrivée ne porte pas « Développer ce sujet » — pas d'image à envoyer", () => {
  monterPanneau(carteImage({ statut: "attente" }), { developper: vi.fn() })
  expect(screen.queryByRole("button", { name: "Développer ce sujet" })).toBeNull()
})

test("sans le geste fourni, « Développer ce sujet » disparaît — même règle que les autres gestes de la toile", () => {
  monterPanneau(carteImage())
  expect(screen.queryByRole("button", { name: "Développer ce sujet" })).toBeNull()
})
