// **Ce qu'on a laissé en plan** (`RP16`) — la porte commune, le tiroir, le
// compteur, et la garde qui tient les écrans branchés.
//
// Ni réseau ni serveur : `travaux.lister` est doublé ici. Aucun centime.

/// <reference types="vite/client" />
import { useState } from "react"
import { afterEach, expect, test, vi } from "vitest"
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { AvisBrouillon, useBrouillonLocal } from "./BrouillonLocal"
import { TiroirDesBrouillons, useBrouillonsEnPlan } from "./Brouillons"
import { NavigationAtelier } from "./NavigationAtelier"
import { brouillonsLaissesEnPlan, noterOuLonEst, type LigneDeBrouillon } from "../brouillons"
import { travaux, type TravailSuivi } from "../api-travaux"
import type { Lieu } from "../lieux"

afterEach(() => { cleanup(); localStorage.clear(); vi.restoreAllMocks(); noterOuLonEst([]) })

const OU = [{ genre: "galerie" }, { genre: "montage", clip: "clip-1" }] as Lieu[]

function Ecran({ reference = "départ" }: { reference?: string }) {
  const [nom, setNom] = useState(reference)
  const brouillon = useBrouillonLocal({
    cle: "montage:clip-1:nouveau", pret: true, reference: { nom: reference }, etat: { nom },
    appliquer: (recu) => setNom(recu.nom), ecran: "Le montage", quoi: "La marche du pèlerin",
  })
  return <><input aria-label="Le nom" value={nom} onChange={(e) => setNom(e.target.value)} /><AvisBrouillon brouillon={brouillon} /><button onClick={brouillon.effacer}>Abandonner</button></>
}

// ── La porte commune ────────────────────────────────────────────────────────

test("un écran qui se déclare entre au tiroir avec son nom, de quoi il s’agit et le chemin du retour", () => {
  noterOuLonEst(OU)
  render(<Ecran />)
  expect(brouillonsLaissesEnPlan()).toEqual([])
  fireEvent.change(screen.getByLabelText("Le nom"), { target: { value: "La marche" } })
  const [ligne] = brouillonsLaissesEnPlan()
  expect(ligne.cle).toBe("montage:clip-1:nouveau")
  expect(ligne.ecran).toBe("Le montage")
  expect(ligne.quoi).toBe("La marche du pèlerin")
  expect(ligne.retour).toEqual(OU)
  expect(ligne.modifie).toBeGreaterThan(0)
})

test("l’entrée survit à la fermeture de l’écran et meurt avec le brouillon, sans rien laisser derrière", () => {
  noterOuLonEst(OU)
  const vue = render(<Ecran />)
  fireEvent.change(screen.getByLabelText("Le nom"), { target: { value: "La marche" } })
  vue.unmount()
  expect(brouillonsLaissesEnPlan()).toHaveLength(1)
  render(<Ecran />)
  expect(screen.getByRole("button", { name: "Reprendre le brouillon" })).toBeTruthy()
  fireEvent.click(screen.getByRole("button", { name: "Abandonner" }))
  expect(brouillonsLaissesEnPlan()).toEqual([])
  expect(localStorage.length).toBe(0)
})

test("enregistrer retire l’entrée : l’état revenu à la version enregistrée n’est plus un brouillon", () => {
  noterOuLonEst(OU)
  render(<Ecran />)
  fireEvent.change(screen.getByLabelText("Le nom"), { target: { value: "La marche" } })
  expect(brouillonsLaissesEnPlan()).toHaveLength(1)
  fireEvent.change(screen.getByLabelText("Le nom"), { target: { value: "départ" } })
  expect(brouillonsLaissesEnPlan()).toEqual([])
})

test("une ligne dont le brouillon a disparu de ce navigateur ne se montre jamais", () => {
  localStorage.setItem("asset-kitchen:brouillons:v1", JSON.stringify({
    version: 1,
    lignes: [{ cle: "parti", ecran: "La retouche", quoi: "Le pèlerin", modifie: 1, retour: [] }],
  }))
  expect(brouillonsLaissesEnPlan()).toEqual([])
  expect(localStorage.getItem("asset-kitchen:brouillons:v1")).toBeNull()
})

// ── Le tiroir ───────────────────────────────────────────────────────────────

const ligne = (cle: string, ecran: string, quoi: string, retour: Lieu[]): LigneDeBrouillon =>
  ({ cle, ecran, quoi, modifie: Date.parse("2026-09-15T10:00:00Z"), retour })

test("le tiroir range par écran, dit depuis quand, et ramène d’un clic là où on avait laissé", () => {
  const reprendre = vi.fn(), fermer = vi.fn()
  render(<TiroirDesBrouillons
    lignes={[ligne("a", "La retouche", "Le pèlerin", [{ genre: "galerie" }, { genre: "retouche", asset: "img-1" }]), ligne("b", "Le montage", "La marche", OU)]}
    travauxEnPlan={[]} sujets={[]} onReprendre={reprendre} onTravail={vi.fn()} onChangement={vi.fn()} onFermer={fermer} />)
  expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Brouillons à reprendre")
  expect(within(screen.getByLabelText("La retouche")).getByText(/Laissé le/)).toBeTruthy()
  fireEvent.click(screen.getByRole("button", { name: "Reprendre Le pèlerin" }))
  expect(fermer).toHaveBeenCalled()
  expect(reprendre).toHaveBeenCalledWith([{ genre: "galerie" }, { genre: "retouche", asset: "img-1" }])
})

test("un brouillon se jette depuis le tiroir, et rien ne reste de lui", () => {
  localStorage.setItem("asset-kitchen:brouillon:v1:a", JSON.stringify({ version: 1, reference: "x", etat: {}, modifie: 1 }))
  localStorage.setItem("asset-kitchen:brouillons:v1", JSON.stringify({ version: 1, lignes: [ligne("a", "La retouche", "Le pèlerin", [])] }))
  const change = vi.fn()
  render(<TiroirDesBrouillons lignes={brouillonsLaissesEnPlan()} travauxEnPlan={[]} sujets={[]} onReprendre={vi.fn()} onTravail={vi.fn()} onChangement={change} onFermer={vi.fn()} />)
  fireEvent.click(screen.getByRole("button", { name: "Jeter le brouillon de Le pèlerin" }))
  expect(change).toHaveBeenCalled()
  expect(localStorage.length).toBe(0)
})

test("le tiroir vide dit une phrase et ne réclame rien", () => {
  render(<TiroirDesBrouillons lignes={[]} travauxEnPlan={[]} sujets={[]} onReprendre={vi.fn()} onTravail={vi.fn()} onChangement={vi.fn()} onFermer={vi.fn()} />)
  expect(screen.getByText(/Rien n’attend/)).toBeTruthy()
  expect(screen.queryByRole("alert")).toBeNull()
})

// ── Les deux sources, et le compteur ────────────────────────────────────────

const travail = (identifiant: string, nature: TravailSuivi["nature"], etat: string, etape: string) => ({
  identifiant, projet: "marais", nature, etat, etape, cree_le: 0, acteur: "auteur",
  demande: { personnage: "pelerin", pose: "marche", direction: "sud", prompt: "un son", prompt_video: "il marche", nom: "" },
  piece_fiche: { nom: "Le casque" }, personnage: "pelerin", annonce: { images_ciblees: 3 }, modele: "local",
}) as unknown as TravailSuivi

function Atelier() {
  const enPlan = useBrouillonsEnPlan("marais")
  return <><NavigationAtelier jeu="Le marais" actif="galerie" travauxEnCours={enPlan.fabricationsEnCours} brouillons={enPlan.nombre}
    replie={false} onReplier={vi.fn()} onAller={vi.fn()} onChangerJeu={vi.fn()} onGuide={vi.fn()} onRecherche={vi.fn()} onBrouillons={vi.fn()} />
    <TiroirDesBrouillons lignes={enPlan.lignes} travauxEnPlan={enPlan.travauxEnPlan} sujets={[{ identifiant: "pelerin", nom: "Le pèlerin" }]}
      onReprendre={vi.fn()} onTravail={vi.fn()} onChangement={vi.fn()} onFermer={vi.fn()} /></>
}

test("le compteur du carnet compte toutes les familles, pas la seule galerie", async () => {
  vi.spyOn(travaux, "lister").mockResolvedValue([
    travail("t1", "animation", "en_cours", "video_soumise"),
    travail("t2", "audio", "en_cours", "reference"),
    travail("t3", "equipement", "a_reprendre", "reference_soumise"),
    travail("t4", "3d", "termine", "termine"),
    travail("t5", "video-libre", "annule", "annule"),
  ])
  render(<Atelier />)
  // Trois familles vivantes sur cinq travaux : deux en cours, un à reprendre.
  await waitFor(() => expect(screen.getByLabelText("3 fabrications en cours")).toBeTruthy())
})

test("un travail interrompu par un redémarrage paraît au tiroir, avec ce qu’il attendait", async () => {
  vi.spyOn(travaux, "lister").mockResolvedValue([
    travail("t1", "animation", "a_reprendre", "video_soumise"),
    travail("t2", "animation", "en_cours", "montage"),
  ])
  render(<Atelier />)
  const section = within(await screen.findByLabelText("Fabrications interrompues"))
  expect(section.getByText("À reprendre · attendait : Fabrication du clip")).toBeTruthy()
  // Celui qui tourne n'a été laissé nulle part : il se compte, il ne s'y range pas.
  expect(section.queryByText(/Extraction des frames/)).toBeNull()
  expect(screen.getByRole("button", { name: "Brouillons à reprendre · 1" })).toBeTruthy()
})

// ── La garde : aucun écran ne garde un brouillon en silence ─────────────────
//
// **Une liste blanche se trompe toujours du même côté** (`essai_jetons.py`) :
// on ne nomme donc aucun écran ici. Tout appel à la porte commune est lu dans
// les sources, et un écran neuf est tenu d'office.

function appels(source: string): string[] {
  const trouves: string[] = []
  const motif = /useBrouillonLocal\s*(?:<[^>]*>)?\s*\(\s*\{/g
  for (let m = motif.exec(source); m; m = motif.exec(source)) {
    let profondeur = 1
    let fin = m.index + m[0].length
    while (fin < source.length && profondeur) {
      profondeur += { "{": 1, "}": -1 }[source[fin]] ?? 0
      fin += 1
    }
    trouves.push(source.slice(m.index, fin))
  }
  return trouves
}

test("chaque écran qui garde un brouillon se déclare au tiroir", () => {
  const sources = import.meta.glob(["./*.tsx", "./*.ts"], { query: "?raw", import: "default", eager: true }) as Record<string, string>
  const oublis: string[] = []
  let tenus = 0
  for (const [nom, source] of Object.entries(sources)) {
    if (nom.includes(".test.") || nom.endsWith("/BrouillonLocal.tsx")) continue
    appels(source).forEach((appel) => { tenus += 1; if (!appel.includes("ecran:")) oublis.push(nom) })
  }
  expect(oublis).toEqual([])
  // Un banc qui ne trouverait plus aucun appel passerait en silence.
  expect(tenus).toBeGreaterThan(10)
})
