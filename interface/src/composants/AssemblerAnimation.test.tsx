// RP21 · Le chemin inverse — une sélection d'images fixes devient une
// animation.
//
// Deux choses à vérifier : la raison qui empêche le geste (une fonction pure,
// la même qui grise le bouton et que le serveur rejoue), et le geste lui-même
// depuis la fenêtre qui le pose.

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, expect, test, vi } from "vitest"
import { api, Refus, type Asset, type Personnage, type Pose } from "../api"
import { FenetreAssembler, raisonAssemblage } from "./AssemblerAnimation"

const DIRECTIONS = {
  directions: [
    { identifiant: "nord", nom: "Nord", consigne: "" },
    { identifiant: "sud", nom: "Sud", consigne: "" },
  ],
  origine: "vue" as const,
  vue: "quatre-directions",
  vue_libelle: "Quatre directions",
  proposees: [],
}

beforeEach(() => {
  vi.spyOn(api, "directions").mockResolvedValue(DIRECTIONS)
})

afterEach(() => { cleanup(); vi.restoreAllMocks() })

const image = (identifiant: string, extra: Partial<Asset> = {}): Asset =>
  ({ identifiant, label: identifiant, empreinte: "e", largeur: 16, hauteur: 16, ...extra } as Asset)

const PERSONNAGES = [
  { identifiant: "gobelin", nom: "Le gobelin" },
  { identifiant: "squelette", nom: "Le squelette" },
] as unknown as Personnage[]

const PLAN = [{ identifiant: "marche", nom: "Marche" }] as unknown as Pose[]

// ── La raison, vérifiée sans rendre aucun écran ─────────────────────────────

test("aucune sélection ne donne aucune raison — le bouton ne paraît pas", () => {
  expect(raisonAssemblage([], 0)).toBeNull()
})

test("une sélection d'un seul sujet ne donne aucune raison", () => {
  const images = [image("a", { personnage: "gobelin" }), image("b", { personnage: "gobelin" })]
  expect(raisonAssemblage(images, 2)).toBeNull()
})

test("des images sans sujet du tout ne donnent aucune raison", () => {
  const images = [image("a"), image("b")]
  expect(raisonAssemblage(images, 2)).toBeNull()
})

test("deux sujets dans la sélection donnent une raison qui le dit", () => {
  const images = [image("a", { personnage: "gobelin" }), image("b", { personnage: "squelette" })]
  const raison = raisonAssemblage(images, 2)
  expect(raison).not.toBeNull()
  expect(raison).toMatch(/sujet/)
})

test("une sélection qui contient autre chose qu'une image fixe donne une raison", () => {
  // Une seule image retrouvée sur deux identifiants sélectionnés : l'autre
  // est un clip, ou un travail en cours — pas une image fixe.
  const raison = raisonAssemblage([image("a")], 2)
  expect(raison).not.toBeNull()
})

// ── Le geste, depuis la fenêtre ──────────────────────────────────────────────

test("les images partent dans l'ordre de la sélection, et la bande ouvre son atelier", async () => {
  const assembler = vi.spyOn(api, "assemblerAnimation").mockResolvedValue({
    clip: { identifiant: "clip" },
    bandes: [{ identifiant: "bande" }],
  } as never)
  const onFait = vi.fn()
  render(
    <FenetreAssembler
      images={[image("b"), image("a")]}
      personnages={PERSONNAGES}
      plan={PLAN}
      onFermer={vi.fn()}
      onFait={onFait}
    />,
  )
  fireEvent.click(await screen.findByRole("button", { name: "Créer l'animation" }))
  await waitFor(() => expect(assembler).toHaveBeenCalledOnce())
  // **L'ordre reçu est l'ordre de la sélection**, jamais un tri refait ici.
  expect(assembler.mock.calls[0][0]).toEqual(["b", "a"])
  expect(onFait).toHaveBeenCalledWith([{ identifiant: "bande" }])
})

test("le sujet et la pose se préremplissent quand toutes les images s'accordent", async () => {
  const assembler = vi.spyOn(api, "assemblerAnimation").mockResolvedValue({
    clip: { identifiant: "clip" },
    bandes: [{ identifiant: "bande" }],
  } as never)
  render(
    <FenetreAssembler
      images={[
        image("a", { personnage: "gobelin", pose: "marche" }),
        image("b", { personnage: "gobelin", pose: "marche" }),
      ]}
      personnages={PERSONNAGES}
      plan={PLAN}
      onFermer={vi.fn()}
      onFait={vi.fn()}
    />,
  )
  expect(await screen.findByLabelText("Animation de")).toHaveValue("gobelin")
  expect(screen.getByLabelText("Mouvement")).toHaveValue("marche")
  fireEvent.click(screen.getByRole("button", { name: "Créer l'animation" }))
  await waitFor(() => expect(assembler).toHaveBeenCalledOnce())
  expect(assembler.mock.calls[0][1]).toMatchObject({ personnage: "gobelin", pose: "marche" })
})

test("la direction se préremplit quand toutes les images s'accordent, et part avec la demande", async () => {
  const assembler = vi.spyOn(api, "assemblerAnimation").mockResolvedValue({
    clip: { identifiant: "clip" },
    bandes: [{ identifiant: "bande" }],
  } as never)
  render(
    <FenetreAssembler
      images={[image("a", { direction: "sud" }), image("b", { direction: "sud" })]}
      personnages={PERSONNAGES}
      plan={PLAN}
      onFermer={vi.fn()}
      onFait={vi.fn()}
    />,
  )
  expect(await screen.findByLabelText("Direction")).toHaveValue("sud")
  fireEvent.click(screen.getByRole("button", { name: "Créer l'animation" }))
  await waitFor(() => expect(assembler).toHaveBeenCalledOnce())
  expect(assembler.mock.calls[0][1]).toMatchObject({ direction: "sud" })
})

test("une direction qui diffère ne préremplit rien", async () => {
  render(
    <FenetreAssembler
      images={[image("a", { direction: "sud" }), image("b", { direction: "nord" })]}
      personnages={PERSONNAGES}
      plan={PLAN}
      onFermer={vi.fn()}
      onFait={vi.fn()}
    />,
  )
  expect(await screen.findByLabelText("Direction")).toHaveValue("")
})

test("un sujet qui diffère ne préremplit rien, et se choisit à la main", async () => {
  render(
    <FenetreAssembler
      images={[
        image("a", { personnage: "gobelin" }),
        image("b", { personnage: "squelette" }),
      ]}
      personnages={PERSONNAGES}
      plan={PLAN}
      onFermer={vi.fn()}
      onFait={vi.fn()}
    />,
  )
  expect(await screen.findByLabelText("Animation de")).toHaveValue("")
})

test("un refus du serveur se lit dans la fenêtre, sans la fermer", async () => {
  vi.spyOn(api, "assemblerAnimation").mockRejectedValue(new Refus("cette sélection mélange plusieurs sujets"))
  const onFait = vi.fn()
  render(
    <FenetreAssembler
      images={[image("a"), image("b")]}
      personnages={PERSONNAGES}
      plan={PLAN}
      onFermer={vi.fn()}
      onFait={onFait}
    />,
  )
  fireEvent.click(await screen.findByRole("button", { name: "Créer l'animation" }))
  await screen.findByText("cette sélection mélange plusieurs sujets")
  expect(onFait).not.toHaveBeenCalled()
})
