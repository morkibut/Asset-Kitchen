import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, expect, test, vi } from "vitest"
import { EcranEnvoi, TRI_VIDE } from "./Envoi"
import type { Envoi } from "../api"
import type { TexteLocal } from "../api-workflows"

afterEach(cleanup)

const BASE = {
  texte: "Pixel art style. un pèlerin, cape rouge",
  parties: [],
  lignes: [],
  groupes: [],
  images: {
    lignes: [], places: 1, cochees: 0, rang_gabarit: null, rang_palette: null,
    jointe: null, partent: 0, gabarit: 0, palette: 0, prix: null, avertissements: [],
  },
  options: [],
  retour: [],
  avertissements: [],
  prix: {
    total: 0, appels: 1, images: null,
    mesure: { unite: "jeton", prix: null, bas: 0, haut: 0, appels: 0, base: null, par_image: null, sur_base: 0, sur_jointes: 0 },
  },
  reserve: null,
  modele: { identifiant: "ComfyUI:zimage-pixel@v1", nom: "Pixel art net et rapide", references_max: 1, fournisseur: "ComfyUI" },
  ambiance: null,
  cases: 0,
  caracteres: { total: 0, sujet: 0, eteints: 0 },
  corrections: 0,
  fond: { couleur: "", interdiction: "", du_jeu: "", corrige: false, propose: null },
}

/** Un `Envoi` pour un style local, complété de ce que `local`, `modele.reference_nom`
 *  et `fond.negatif_lu` ajoutent (ML3-ML5) — non encore déclaré dans `api.ts`. */
function envoiLocal(local: TexteLocal, options: { referenceNom?: string | null; negatifLu?: boolean } = {}): Envoi {
  return {
    ...BASE,
    local,
    modele: { ...BASE.modele, reference_nom: options.referenceNom ?? "part de l’image" },
    fond: { ...BASE.fond, negatif_lu: options.negatifLu ?? true },
  } as unknown as Envoi
}

function props(envoi: Envoi | null) {
  return {
    presentation: "atelier" as const,
    envoi,
    tri: TRI_VIDE,
    onTri: vi.fn(),
    onImage: vi.fn(),
    onPayer: vi.fn(),
    onFermer: vi.fn(),
    onGarder: vi.fn(),
    onSauter: null,
    onReprendre: vi.fn(),
    refus: null,
    plancheJointe: null,
    onAjouterUneReference: vi.fn(),
  }
}

test("le texte d’un style local part d’un bloc, avec ce qui a été retiré et le compte de jetons", () => {
  const local: NonNullable<TexteLocal> = {
    famille: "sdxl",
    texte: "Pixel art style. un pèlerin, cape rouge",
    segments: [],
    retires: [
      { clef: "cadrage.camera", nom: "caméra", texte: "vue de trois quarts, éclairage doux", raison: "au-delà des 77 jetons que SDXL lit d’un coup" },
    ],
    jetons: 40,
    limite: 75,
    tranche: 77,
    comptage: "approximation du BPE de CLIP",
    negatif_lu: true,
  }
  render(<EcranEnvoi {...props(envoiLocal(local))} />)
  expect(screen.getByText("Pixel art style. un pèlerin, cape rouge")).toBeInTheDocument()
  expect(screen.getByText(/40 jetons sur 75/)).toBeInTheDocument()
  expect(screen.getByText(/caméra/)).toBeInTheDocument()
  expect(screen.getByText(/au-delà des 77 jetons/)).toBeInTheDocument()
})

test("le champ « Ce qu’il faut éviter » n’est pas proposé quand le style local ne lit pas le négatif", () => {
  const local: NonNullable<TexteLocal> = {
    famille: "zimage", texte: "Pixel art style. un pèlerin", segments: [], retires: [],
    jetons: 10, limite: null, tranche: null, comptage: "", negatif_lu: false,
  }
  render(<EcranEnvoi {...props(envoiLocal(local, { negatifLu: false }))} />)
  expect(screen.queryByText("Fond et prompt négatif")).not.toBeInTheDocument()
})

test("le fond reste montré quand le style local lit bien le négatif", () => {
  const local: NonNullable<TexteLocal> = {
    famille: "sdxl", texte: "Pixel art style. un pèlerin", segments: [], retires: [],
    jetons: 10, limite: 75, tranche: 77, comptage: "", negatif_lu: true,
  }
  render(<EcranEnvoi {...props(envoiLocal(local, { negatifLu: true }))} />)
  expect(screen.getByText("Fond et prompt négatif")).toBeInTheDocument()
})

test("un modèle distant garde l’écran habituel — aucun bloc de texte local", () => {
  const distant = { ...BASE, local: null, modele: { ...BASE.modele, reference_nom: null }, fond: { ...BASE.fond, negatif_lu: true } } as unknown as Envoi
  render(<EcranEnvoi {...props(distant)} />)
  expect(screen.getByText("Fond et prompt négatif")).toBeInTheDocument()
})
