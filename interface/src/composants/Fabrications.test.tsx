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
  onMethodesLocales: () => {},
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

// RV9 — retour de l'auteur du 23 septembre : toutes les vignettes étaient des
// carrés gris, y compris pour des images terminées. Les essais d'avant
// passaient avec des carrés gris parce qu'aucun ne lisait `src` : celui-ci le
// lit, sur les deux origines qui peuvent maintenant montrer une image réelle
// — le journal (un appel que `bibliotheque.journal` joint désormais à
// l'asset qu'il a produit) et un travail (l'image locale qu'il a gardée).
test("une ligne terminée montre la vignette réelle du résultat, jamais un carré gris", async () => {
  vi.spyOn(api, "journal").mockResolvedValue({
    appels: [{
      identifiant: "g-2", modele: "OpenRouter:openai/gpt-image-2", prompt: "un gobelin, de face",
      cree_le: 1_700_000_100, cout_usd: 0.01, statut: "reussie", reussies: 1, rates: [], vignette: "asset-du-gobelin",
    }],
  } as unknown as Awaited<ReturnType<typeof api.journal>>)
  vi.spyOn(travaux, "lister").mockResolvedValue([{
    nature: "image-locale", identifiant: "t-1", projet: null, acteur: "auteur", cle: "c-1",
    cree_le: 1_700_000_200, etat: "termine", etape: "termine",
    demande: { cle: "c-1", prompt: "une porte de donjon" }, generation_image: "g-3", assets: ["asset-de-la-porte"],
  } as unknown as Awaited<ReturnType<typeof travaux.lister>>[number]])

  const { container } = render(<Fabrications projet="jeu" chantier={[]} clips={[]} personnages={[personnage]} {...RIEN} />)

  await screen.findByText("un gobelin, de face")
  // **C'est bien l'attribut `src` qu'on lit** : les essais d'avant passaient
  // avec des carrés gris parce qu'aucun ne le faisait.
  const sources = [...container.querySelectorAll("img")].map((i) => i.getAttribute("src"))
  expect(sources.some((s) => s?.includes("/api/assets/asset-du-gobelin/vignette"))).toBe(true)
  expect(sources.some((s) => s?.includes("/api/assets/asset-de-la-porte/vignette"))).toBe(true)
  // Aucun carré gris (lettre seule, sans image) pour ces deux lignes-là.
  expect(container.querySelectorAll("span.rounded-7").length).toBe(0)
})

// RV9 — même retour : « ComfyUI · qwen21-qualite@e3563da64c0c7b8… » restait
// lisible tel quel dans la liste fusionnée, alors qu'`RV4` avait retiré cet
// identifiant technique partout ailleurs. La liste doit lire le même nom que
// le catalogue donne ailleurs (`libelleModele`), jamais la chaîne brute.
test("le nom du modèle reste lisible dans la liste, jamais l'identifiant technique", async () => {
  const identifiantTechnique = "ComfyUI:qwen21-qualite@e3563da64c0c7b8eecc0e4afc6782acb"
  vi.spyOn(api, "modeles").mockResolvedValue({
    modeles: [{ identifiant: identifiantTechnique, nom: "Qwen 2.1 qualité", fournisseur: "ComfyUI" }],
  } as unknown as Awaited<ReturnType<typeof api.modeles>>)
  vi.spyOn(api, "modelesVideo").mockResolvedValue({ modeles: [] } as unknown as Awaited<ReturnType<typeof api.modelesVideo>>)
  vi.spyOn(fileLocale, "lire").mockResolvedValue({
    etapes: [{
      identifiant: "e-1", cle: "c-2", projet: null, acteur: "auteur", nature: "image",
      moteur: "comfyui", modele: identifiantTechnique, etat: "termine",
      travail_externe: null, raison: "", soumission_engagee: true,
      cree_le: 1_700_000_300, demarre_le: null, termine_le: null, duree_s: null, temperature: "chaud",
    }],
  } as unknown as Awaited<ReturnType<typeof fileLocale.lire>>)

  render(<Fabrications projet="jeu" chantier={[]} clips={[]} personnages={[personnage]} {...RIEN} />)

  const ecran = await screen.findByText(/Qwen 2\.1 qualité/)
  expect(ecran.textContent).toContain("ComfyUI · Qwen 2.1 qualité")
  expect(screen.getByLabelText("Fabrications").textContent).not.toMatch(/@e3563da64c0c7b8/)
})
