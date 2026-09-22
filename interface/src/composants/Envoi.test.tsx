import { cleanup, fireEvent, render, screen } from "@testing-library/react"
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
  fond: { couleur: "", interdiction: "", corrige: false, propose: null },
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
    temps: { secondes: 41.2, mesures: 6, vitesse: "environ 40 secondes par image" },
  }
  render(<EcranEnvoi {...props(envoiLocal(local))} />)
  expect(screen.getByText("Pixel art style. un pèlerin, cape rouge")).toBeInTheDocument()
  expect(screen.getByText(/40 jetons sur 75/)).toBeInTheDocument()
  expect(screen.getByText(/caméra/)).toBeInTheDocument()
  expect(screen.getByText(/au-delà des 77 jetons/)).toBeInTheDocument()
})

test("seul le négatif se cache quand le style local ne le lit pas — le fond reste (défaut 3)", () => {
  const local: NonNullable<TexteLocal> = {
    famille: "zimage", texte: "Pixel art style. un pèlerin", segments: [], retires: [],
    jetons: 10, limite: null, tranche: null, comptage: "", negatif_lu: false,
    temps: { secondes: null, mesures: 0, vitesse: "environ 30 secondes par image" },
  }
  const envoi = envoiLocal(local, { negatifLu: false })
  envoi.fond = { ...envoi.fond, couleur: "#336699", interdiction: "pas de flou" }
  render(<EcranEnvoi {...props(envoi)} />)
  // Le titre ne promet plus un négatif qu'il ne montre pas.
  expect(screen.queryByText("Fond et prompt négatif")).not.toBeInTheDocument()
  expect(screen.getByText("Fond")).toBeInTheDocument()
  // Le fond part dans le texte et sert au retour : il reste lisible.
  expect(screen.getByText(/Fond : #336699/)).toBeInTheDocument()
  // Seule la consigne négative, elle, disparaît.
  expect(screen.queryByText("pas de flou")).not.toBeInTheDocument()
})

test("la relecture nomme le fond, et dit pourquoi il a changé à cause de la description (RV3)", () => {
  const envoi = { ...BASE, fond: { ...BASE.fond, couleur: "#FF00FF", nom: "magenta", motif: "ta description dit verte" } } as unknown as Envoi
  render(<EcranEnvoi {...props(envoi)} />)
  // Le fond est nommé, pas seulement sa couleur hexadécimale.
  expect(screen.getByText(/Fond : #FF00FF magenta/)).toBeInTheDocument()
  // Et la raison du changement tient en une ligne, à côté.
  expect(screen.getByText("fond magenta : ta description dit verte")).toBeInTheDocument()
})

test("aucune ligne de raison quand le fond n'a pas changé à cause de la description", () => {
  const envoi = { ...BASE, fond: { ...BASE.fond, couleur: "#00B140", nom: "studio green", motif: "" } } as unknown as Envoi
  render(<EcranEnvoi {...props(envoi)} />)
  expect(screen.getByText(/Fond : #00B140 studio green/)).toBeInTheDocument()
  expect(screen.queryByText(/ta description dit/)).not.toBeInTheDocument()
})

test("en modification, le fond corrigé montre son nom et la raison quand elle existe", () => {
  const envoi = {
    ...BASE,
    fond: {
      ...BASE.fond,
      couleur: "#FF00FF",
      nom: "magenta",
      motif: "ta description dit verte",
      propose: { couleur: "", nom: "", ecart: 0, voisine: "", raison: "ce jeu n'a pas encore de palette" },
    },
  } as unknown as Envoi
  render(<EcranEnvoi {...props(envoi)} />)
  fireEvent.click(screen.getByRole("button", { name: "Modifier l’envoi" }))
  expect(screen.getByText("#FF00FF magenta")).toBeInTheDocument()
  expect(screen.getByText("fond magenta : ta description dit verte")).toBeInTheDocument()
})

test("le fond reste montré quand le style local lit bien le négatif", () => {
  const local: NonNullable<TexteLocal> = {
    famille: "sdxl", texte: "Pixel art style. un pèlerin", segments: [], retires: [],
    jetons: 10, limite: 75, tranche: 77, comptage: "", negatif_lu: true,
    temps: { secondes: null, mesures: 0, vitesse: "3 à 6 minutes par image" },
  }
  render(<EcranEnvoi {...props(envoiLocal(local, { negatifLu: true }))} />)
  expect(screen.getByText("Fond et prompt négatif")).toBeInTheDocument()
})

test("un style local se lance sur la carte graphique — un temps, jamais un prix, au pied et sur le bouton", () => {
  const local: NonNullable<TexteLocal> = {
    famille: "sdxl", texte: "Pixel art style. un pèlerin", segments: [], retires: [],
    jetons: 10, limite: 75, tranche: 77, comptage: "", negatif_lu: true,
    temps: { secondes: 41.2, mesures: 6, vitesse: "environ 40 secondes par image" },
  }
  render(<EcranEnvoi {...props(envoiLocal(local))} />)
  expect(screen.getByRole("button", { name: /Lancer sur ma carte graphique/ })).toBeInTheDocument()
  expect(screen.queryByText(/Payer et lancer/)).not.toBeInTheDocument()
  expect(screen.getAllByText(/≈ 41 secondes par image/).length).toBeGreaterThan(0); expect(screen.queryByText("Aucune mesure disponible pour ce modèle.")).toBeNull(); expect(screen.getByText(/Mesuré sur 6 tirages sur cette machine/)).toBeInTheDocument()
  expect(screen.queryByText("Coût inconnu")).not.toBeInTheDocument()
})

test("un style local jamais mesuré annonce la vitesse du style plutôt que « Coût inconnu »", () => {
  const local: NonNullable<TexteLocal> = {
    famille: "zimage", texte: "Pixel art style. un pèlerin", segments: [], retires: [],
    jetons: 10, limite: null, tranche: null, comptage: "", negatif_lu: true,
    temps: { secondes: null, mesures: 0, vitesse: "environ 30 secondes par image" },
  }
  render(<EcranEnvoi {...props(envoiLocal(local))} />)
  expect(screen.getAllByText(/environ 30 secondes par image/).length).toBeGreaterThan(0)
  expect(screen.queryByText("Coût inconnu")).not.toBeInTheDocument()
})

test("un modèle distant garde son bouton habituel — « Payer et lancer », jamais la carte graphique", () => {
  const distant = { ...BASE, local: null, modele: { ...BASE.modele, reference_nom: null }, fond: { ...BASE.fond, negatif_lu: true } } as unknown as Envoi
  render(<EcranEnvoi {...props(distant)} />)
  expect(screen.queryByRole("button", { name: /Lancer sur ma carte graphique/ })).not.toBeInTheDocument()
})

test("le modèle se lit par son nom, jamais par son identifiant technique", () => {
  render(<EcranEnvoi {...props(BASE as unknown as Envoi)} />)
  expect(screen.getByText("Pixel art net et rapide")).toBeInTheDocument()
  expect(screen.queryByText("ComfyUI:zimage-pixel@v1")).not.toBeInTheDocument()
})

test("un modèle distant garde l’écran habituel — aucun bloc de texte local", () => {
  const distant = { ...BASE, local: null, modele: { ...BASE.modele, reference_nom: null }, fond: { ...BASE.fond, negatif_lu: true } } as unknown as Envoi
  render(<EcranEnvoi {...props(distant)} />)
  expect(screen.getByText("Fond et prompt négatif")).toBeInTheDocument()
})
