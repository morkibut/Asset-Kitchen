// La préparation d'une fabrication — le bloc « Fournisseur et modèle » (ML5).
//
// **Ce que l'atelier jetable a montré au navigateur, corrigé ici** : les
// styles locaux mis à plat sous un seul nom, l'option « force » offerte sans
// image jointe, le prompt négatif proposé à un modèle qui ne le lit pas, et
// « jamais généré » qui ne bougeait plus jamais pour un style local — un appel
// local vaut toujours `cout_usd = 0`, que le compteur de coût écarte.

import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, expect, test, vi } from "vitest"
import { UNIVERS_VIDE, type Modele } from "../api"
import { BarreQuiPaie } from "./BarreQuiPaie"

// CM7 : le champ de prompt de cet écran porte désormais le coup de main
// (`ChampPrompt.tsx`), qui interroge `/api/assist` au montage — doublé ici,
// indisponible, pour que ces essais restent sans réseau et sans marque.
beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ disponible: false, raison: null, modele: "" }))))
})
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

const modeleDistant: Modele = {
  identifiant: "OpenRouter:openai/gpt-image-2", nom: "GPT Image", fournisseur: "OpenRouter", chez_lui: "gpt-image-2",
  references_max: 4, proportions: ["1:1"], resolutions: [], variations_max: 4, options: {},
  refus: null, repli: false, recu_le: 0, unite: "usd",
}

// Un style « garde le sujet » (Klein) : jamais de force, négatif jamais lu.
const modeleLocalSujet: Modele = {
  identifiant: "ComfyUI:klein-edit@v1", nom: "FLUX.2 Klein · Édition", fournisseur: "ComfyUI", chez_lui: "",
  references_max: 3, references_min: 1, locale: true, indisponible: null,
  proportions: ["1:1"], resolutions: ["1024"], variations_max: 1, options: {},
  refus: null, repli: false, recu_le: 0, unite: "usd",
  ...({ reference: "sujet", famille: "klein", negatif_lu: false, temps: { secondes: null, mesures: 0, vitesse: "1 à 3 minutes par image" } } as Record<string, unknown>),
} as Modele

// Un style « part de l'image » (Z-Image) : la force n'agit qu'avec une image
// jointe, et le négatif est lu.
const modeleLocalDepart: Modele = {
  identifiant: "ComfyUI:zimage-pixel@v1", nom: "Pixel art net et rapide", fournisseur: "ComfyUI", chez_lui: "",
  references_max: 1, references_min: 0, locale: true, indisponible: null,
  proportions: ["1:1"], resolutions: ["512"], variations_max: 1,
  options: { force: { nom: "force", genre: "intervalle", valeurs: [], minimum: 0, maximum: 1 } },
  refus: null, repli: false, recu_le: 0, unite: "usd",
  ...({ reference: "depart", famille: "zimage", negatif_lu: true, temps: { secondes: 24.3, mesures: 5, vitesse: "environ 30 secondes par image" } } as Record<string, unknown>),
} as Modele

const props = {
  presentation: "preparation" as const,
  modeles: [modeleDistant, modeleLocalSujet, modeleLocalDepart],
  modele: modeleDistant,
  onChoisirModele: vi.fn(),
  proportions: "1:1", onProportions: vi.fn(), variations: 1, onVariations: vi.fn(),
  options: {}, onOptions: vi.fn(),
  reinjections: [], grille: [], onRetirerReinjection: vi.fn(), onRoleReinjection: vi.fn(),
  projetNom: "jeu", univers: UNIVERS_VIDE, echelle: "", onEchelle: vi.fn(),
  compteReferences: null, cout: null, reserve: null, cases: 0,
  personnageCible: null, posesCible: [], onRetirerPose: vi.fn(), onDesarmer: vi.fn(),
  ecarteesGeneration: null, onEcarterGeneration: vi.fn(), onErreur: vi.fn(),
  prompt: "", onPrompt: vi.fn(), promptNegatif: "", onPromptNegatif: vi.fn(),
  repris: false, onRendre: vi.fn(), refus: null, provenance: null,
  onDefaireProvenance: vi.fn(), onGenerer: vi.fn(),
}

test("les styles locaux sont groupés par moteur dans la liste des modèles", () => {
  render(<BarreQuiPaie {...props} />)
  const select = screen.getByLabelText("Fournisseur et modèle")
  const groupes = [...select.querySelectorAll("optgroup")].map((g) => g.label)
  expect(groupes).toEqual(["Z-Image Turbo", "FLUX.2 Klein"])
  // Le modèle distant reste en tête, hors de tout groupe.
  expect(screen.getByRole("option", { name: /GPT Image/ }).closest("optgroup")).toBeNull()
})

test("un style local choisi montre son temps et le genre de référence, jamais « jamais généré »", () => {
  render(<BarreQuiPaie {...props} modele={modeleLocalDepart} />)
  // La ligne paraît deux fois : sous la liste des modèles, et au pied qui
  // paie (« temps attendu », le même calcul que `cout_attendu` pour un
  // modèle payant) — les deux doivent dire le même temps, jamais deux prix
  // pour le même appel (E13).
  expect(screen.getAllByText(/≈ 24 secondes par image/).length).toBeGreaterThan(0)
  expect(screen.getByText(/part de l’image/)).toBeInTheDocument()
  expect(screen.queryByText("jamais généré")).not.toBeInTheDocument()
})

test("un style local jamais mesuré affiche la vitesse du style, pas un chiffre inventé", () => {
  render(<BarreQuiPaie {...props} modele={modeleLocalSujet} />)
  expect(screen.getAllByText(/1 à 3 minutes par image/).length).toBeGreaterThan(0)
  expect(screen.getByText(/garde le sujet/)).toBeInTheDocument()
})

test("la force n’apparaît que pour un style « part de l’image » avec une image jointe", () => {
  const { rerender } = render(<BarreQuiPaie {...props} modele={modeleLocalDepart} reinjections={[]} />)
  expect(screen.queryByText("Force de la transformation")).not.toBeInTheDocument()
  rerender(<BarreQuiPaie {...props} modele={modeleLocalDepart} reinjections={[{ asset: "a1", role: "reference" }]} />)
  expect(screen.getByText("Force de la transformation")).toBeInTheDocument()
  rerender(<BarreQuiPaie {...props} modele={modeleLocalSujet} reinjections={[{ asset: "a1", role: "reference" }]} />)
  expect(screen.queryByText("Force de la transformation")).not.toBeInTheDocument()
})

test("le curseur de force envoie un nombre, et disparaît des options sans image jointe", () => {
  // Défaut 2 de la relecture du 18/09/2026 : le curseur envoyait
  // `e.target.value`, une chaîne, que le serveur refusait (« La valeur de
  // force n'est pas acceptée ») — et `force` restait dans les options même
  // sans référence, où `composer` la valide quand même et échoue.
  const onOptions = vi.fn()
  const { rerender } = render(
    <BarreQuiPaie
      {...props}
      modele={modeleLocalDepart}
      reinjections={[{ asset: "a1", role: "reference" }]}
      options={{ force: "0.55" }}
      onOptions={onOptions}
    />,
  )
  // `exact: false` : le `<label>` porte aussi la phrase d'aide sous le
  // curseur, donc son texte entier ne vaut plus exactement son titre.
  const curseur = screen.getByLabelText("Force de la transformation", { exact: false })
  fireEvent.change(curseur, { target: { value: "0.8" } })
  expect(onOptions).toHaveBeenCalledWith({ force: 0.8 })
  expect(typeof onOptions.mock.calls[0][0].force).toBe("number")

  onOptions.mockClear()
  // L'image jointe est retirée : la force redevient inerte, et l'effet qui
  // la garde justement ne doit pas la laisser dans les options.
  rerender(
    <BarreQuiPaie
      {...props}
      modele={modeleLocalDepart}
      reinjections={[]}
      options={{ force: "0.55" }}
      onOptions={onOptions}
    />,
  )
  expect(onOptions).toHaveBeenCalledWith({})
})

test("le prompt négatif n’est proposé que si le modèle le lit", () => {
  const { rerender } = render(<BarreQuiPaie {...props} modele={modeleLocalSujet} />)
  expect(screen.queryByText(/Prompt négatif/)).not.toBeInTheDocument()
  rerender(<BarreQuiPaie {...props} modele={modeleLocalDepart} />)
  expect(screen.getByText(/Prompt négatif/)).toBeInTheDocument()
  rerender(<BarreQuiPaie {...props} modele={modeleDistant} />)
  expect(screen.getByText(/Prompt négatif/)).toBeInTheDocument()
})
