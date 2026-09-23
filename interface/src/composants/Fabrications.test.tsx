// Les mots de l'écran Fabrications, contre la liste noire de
// `docs/vocabulaire.html`.
//
// Le mot *asset* y est interdit : une chose du jeu s'appelle **un sujet**.
// L'écran l'écrivait cinq fois avant `RV9` — un titre, un libellé de champ,
// son `aria-label`, l'option vide de la liste et le bouton d'une ligne du
// journal —, et le banc `essais/essai_vocabulaire.py` ne pouvait pas le voir :
// il ne lit que les libellés d'ossature (les portes du carnet, les onglets de
// la fiche, les titres d'écran), jamais le texte des cartes.
//
// **RV9 — une seule liste de fabrications** a retiré « Animer un sujet » (son
// propre sélecteur de sujet, remplacé par le champ « Sujet » de la fenêtre
// unique) : ce qui reste à vérifier est que la ligne fusionnée d'une image
// libre — celle que le chantier et le journal portaient déjà — ne dit toujours
// pas « asset », et que le seul bouton de départ ouvre bien la fenêtre.
//
// Rien ici ne part sur le réseau : les quatre lectures que l'écran lance à
// l'ouverture sont doublées, et la seule chose qu'on regarde est ce qui
// s'écrit.

import { afterEach, beforeEach, expect, test, vi } from "vitest"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"

import { api, type Generation, type Personnage } from "../api"
import { fileLocale } from "../api-file-locale"
import { travaux } from "../api-travaux"
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
  vi.spyOn(travaux, "lister").mockResolvedValue([])
  vi.spyOn(fileLocale, "lire").mockResolvedValue({ etapes: [], moteurs: [] } as unknown as Awaited<ReturnType<typeof fileLocale.lire>>)
  vi.spyOn(fileLocale, "moteurs").mockResolvedValue({ moteurs: [] } as unknown as Awaited<ReturnType<typeof fileLocale.moteurs>>)
  vi.spyOn(workflows, "lister").mockResolvedValue({ profils: [] } as unknown as Awaited<ReturnType<typeof workflows.lister>>)
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

test("l'écran dit « sujet », jamais « asset »", async () => {
  render(<Fabrications projet={null} chantier={[faite]} clips={[]} personnages={[personnage]} {...RIEN} />)

  expect(screen.getByRole("button", { name: "Nouvelle fabrication" })).toBeTruthy()
  expect(await screen.findByRole("button", { name: "Ouvrir le sujet" })).toBeTruthy()

  // Et le mot interdit ne reste nulle part — ni dans le texte, ni dans un
  // libellé que seul le lecteur d'écran entend. *Asset Kitchen*, le nom du
  // produit, est le seul endroit où il a le droit de paraître, et il n'est pas
  // sur cet écran.
  const ecran = screen.getByLabelText("Fabrications")
  expect(ecran.textContent).not.toMatch(/asset/i)
  for (const element of ecran.querySelectorAll("[aria-label]"))
    expect(element.getAttribute("aria-label")).not.toMatch(/asset/i)
})

// RV9 : les trois portes « Préparer une image », « Animer un sujet » et
// « Préparer une vidéo »/« Un son » se réduisent à un seul bouton de départ.
test("« Nouvelle fabrication » est le seul bouton de départ, et il ouvre la fenêtre", () => {
  const onCreer = vi.fn()
  render(<Fabrications projet={null} chantier={[]} clips={[]} personnages={[personnage]} {...RIEN} onCreer={onCreer} />)

  expect(screen.queryByRole("button", { name: "Préparer une image" })).toBeNull()
  expect(screen.queryByRole("button", { name: "Préparer une vidéo" })).toBeNull()
  expect(screen.queryByRole("button", { name: "Préparer un son" })).toBeNull()
  expect(screen.queryByLabelText("Sujet à animer")).toBeNull()

  fireEvent.click(screen.getByRole("button", { name: "Nouvelle fabrication" }))
  expect(onCreer).toHaveBeenCalledOnce()
})
