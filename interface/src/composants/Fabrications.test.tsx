// Les mots de l'écran Fabrications, contre la liste noire de
// `docs/vocabulaire.html`.
//
// Le mot *asset* y est interdit : une chose du jeu s'appelle **un sujet**.
// L'écran l'écrivait cinq fois — un titre, un libellé de champ, son
// `aria-label`, l'option vide de la liste et le bouton d'une ligne du journal
// —, et le banc `essais/essai_vocabulaire.py` ne pouvait pas le voir : il ne
// lit que les libellés d'ossature (les portes du carnet, les onglets de la
// fiche, les titres d'écran), jamais le texte des cartes.
//
// Rien ici ne part sur le réseau : les quatre lectures que l'écran lance à
// l'ouverture sont doublées, et la seule chose qu'on regarde est ce qui
// s'écrit.

import { afterEach, beforeEach, expect, test, vi } from "vitest"
import { cleanup, render, screen } from "@testing-library/react"

import { api, type Generation, type Personnage } from "../api"
import { fileLocale } from "../api-file-locale"
import { workflows } from "../api-workflows"
import { Fabrications } from "./Fabrications"

const personnage = { identifiant: "pelerin", nom: "Le pèlerin", type: "personnage", ecartees: [], plan: [], cases: [] } as unknown as Personnage

/** Une ligne du journal qui vise un sujet : c'est elle qui porte le bouton. */
const faite = {
  identifiant: "g-1",
  modele: "essai:rend-du-png",
  demande: { prompt: "le pèlerin, de dos" },
  parametres_resolus: {},
  ecartees: [],
  emplacements: [],
  cree_le: 1_700_000_000,
  projet: null,
  personnage: "pelerin",
  references: [],
  hors_plafond: [],
  parent: null,
  statut: "reussie",
  cout_usd: 0,
  consomme: 0,
  unite: "usd",
  reussies: 1,
  clip: null,
} as unknown as Generation

const RIEN = {
  onCreer: () => {},
  onPreparer: () => {},
  onGalerie: () => {},
  onClip: () => {},
  onSujet: () => {},
  onDepenses: () => {},
}

beforeEach(() => {
  vi.spyOn(api, "journal").mockResolvedValue({ appels: [] } as unknown as Awaited<ReturnType<typeof api.journal>>)
  vi.spyOn(fileLocale, "lire").mockResolvedValue({ etapes: [], moteurs: [] } as unknown as Awaited<ReturnType<typeof fileLocale.lire>>)
  vi.spyOn(fileLocale, "moteurs").mockResolvedValue({ moteurs: [] } as unknown as Awaited<ReturnType<typeof fileLocale.moteurs>>)
  vi.spyOn(workflows, "lister").mockResolvedValue({ profils: [] } as unknown as Awaited<ReturnType<typeof workflows.lister>>)
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

test("l'écran dit « sujet », jamais « asset »", () => {
  render(<Fabrications projet={null} chantier={[faite]} clips={[]} personnages={[personnage]} {...RIEN} />)

  expect(screen.getByRole("heading", { name: "Animer un sujet" })).toBeTruthy()
  expect(screen.getByLabelText("Sujet à animer")).toBeTruthy()
  expect(screen.getByRole("option", { name: "Choisir un sujet…" })).toBeTruthy()
  expect(screen.getByRole("button", { name: "Ouvrir le sujet" })).toBeTruthy()

  // Et le mot interdit ne reste nulle part — ni dans le texte, ni dans un
  // libellé que seul le lecteur d'écran entend. *Asset Kitchen*, le nom du
  // produit, est le seul endroit où il a le droit de paraître, et il n'est pas
  // sur cet écran.
  const ecran = screen.getByLabelText("Fabrications")
  expect(ecran.textContent).not.toMatch(/asset/i)
  for (const element of ecran.querySelectorAll("[aria-label]"))
    expect(element.getAttribute("aria-label")).not.toMatch(/asset/i)
})
