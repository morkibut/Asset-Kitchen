// La case « Découper à l'arrivée » (RS7, 18 septembre 2026).
//
// **Ce qu'elle promet à l'écran** : elle n'existe que sous « Garder la mise en
// page de la référence » cochée — elle coupe une planche refaite, rien
// d'autre —, et elle se recoche chaque fois qu'on coche la mise en page.
// Qu'elle ne parte qu'avec la mise en page se lit dans `paiement.ts`
// (`coupeALArrivee`) ; que l'atelier la refuse sans elle, dans
// `tests/test_rs7.py`.

import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { useState } from "react"
import { afterEach, expect, test, vi } from "vitest"
import { UNIVERS_VIDE, type Modele } from "../api"
import { BarreQuiPaie } from "./BarreQuiPaie"

afterEach(cleanup)

const modele: Modele = {
  identifiant: "OpenRouter:openai/gpt-image-2", nom: "GPT Image", fournisseur: "OpenRouter", chez_lui: "gpt-image-2",
  references_max: 4, proportions: ["1:1"], resolutions: [], variations_max: 4, options: {},
  refus: null, repli: false, recu_le: 0, unite: "usd",
}

const props = {
  presentation: "preparation" as const,
  modeles: [modele],
  modele,
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

/** Les deux cases tenues comme `App.tsx` les tient : deux états, la
 *  découpe cochée d'office. */
function Preparation() {
  const [garder, setGarder] = useState(false)
  const [decouper, setDecouper] = useState(true)
  return (
    <BarreQuiPaie
      {...props}
      garderMiseEnPage={garder}
      onGarderMiseEnPage={setGarder}
      decouperALArrivee={decouper}
      onDecouperALArrivee={setDecouper}
    />
  )
}

const MISE_EN_PAGE = /Garder la mise en page de la référence/
const DECOUPE = /Découper à l'arrivée/

function coche(nom: RegExp): HTMLInputElement {
  return screen.getByRole("checkbox", { name: nom }) as HTMLInputElement
}

test("la découpe n'apparaît que sous la mise en page cochée, et cochée d'office", () => {
  render(<Preparation />)
  expect(screen.queryByRole("checkbox", { name: DECOUPE })).toBeNull()

  fireEvent.click(coche(MISE_EN_PAGE))
  expect(coche(DECOUPE).checked).toBe(true)
  expect(screen.getByText(/Si le nombre de vues ne tombe pas juste, rien n'est coupé/)).toBeTruthy()

  fireEvent.click(coche(MISE_EN_PAGE))
  expect(screen.queryByRole("checkbox", { name: DECOUPE })).toBeNull()
})

test("décochée, puis la mise en page recochée : la découpe revient cochée", () => {
  render(<Preparation />)
  fireEvent.click(coche(MISE_EN_PAGE))
  fireEvent.click(coche(DECOUPE))
  expect(coche(DECOUPE).checked).toBe(false)

  fireEvent.click(coche(MISE_EN_PAGE))
  fireEvent.click(coche(MISE_EN_PAGE))
  expect(coche(DECOUPE).checked).toBe(true)
})

test("sous un lot armé, ni l'une ni l'autre", () => {
  render(
    <BarreQuiPaie
      {...props}
      cases={4}
      garderMiseEnPage
      onGarderMiseEnPage={vi.fn()}
      decouperALArrivee
      onDecouperALArrivee={vi.fn()}
    />,
  )
  expect(screen.queryByRole("checkbox", { name: MISE_EN_PAGE })).toBeNull()
  expect(screen.queryByRole("checkbox", { name: DECOUPE })).toBeNull()
})
