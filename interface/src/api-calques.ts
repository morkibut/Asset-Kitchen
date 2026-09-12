import { appeler, Refus, type Asset, type EmploiResolu, type Personnage, type Piece, type Trait } from "./api"

export type CheminEmploi = { projet: string; piece: string; emploi: string }
export type CibleCalque = { nature: "image" | "frame"; resultat: string; prise: string }
export type PlacementCalque = { dx: number; dy: number; echelle: number; rotation: number; opacite: number; devant: boolean; ordre: number }
export type MasquesCalque = Record<"calque" | "corps" | "derriere", Trait[]>
export type ExtractionCalque = { dx: number; dy: number; echelle: number; seuil: number }
export type RoleCalque = "reference" | "source-equipee" | "calque"
export type VarianteCalque = {
  identifiant: string; cible: CibleCalque; role: RoleCalque; source: string; source_fiche: Asset
  revision: number; placement: PlacementCalque; masques: MasquesCalque; extraction: ExtractionCalque | null
  historique: unknown[]; base: { cadre: { largeur: number; hauteur: number }; repere: { x: number; y: number }; pose: string; direction: string }
  calque_cadre?: { largeur: number; hauteur: number }
  etat: "reference" | "a-extraire" | "a-verifier" | "prete" | "a-revoir"; raison: string; retenue: boolean; utilisable: boolean
}
export type ImageCible = { cible: CibleCalque; pose: string; direction: string; rang?: number; image?: Asset; nom_bande?: string }
export type CiblesEmploi = { piece: Piece; emploi: EmploiResolu; personnage: Personnage; cibles: ImageCible[]; variantes: VarianteCalque[]; images_disponibles: number; calques_retenus: number }
export type BrouillonCalque = { placement: PlacementCalque; masques: MasquesCalque; extraction?: ExtractionCalque; vue?: "composition" | "calque" | "base" | "source" }

const prefixe = (c: CheminEmploi) => `/projects/${encodeURIComponent(c.projet)}/equipment/${encodeURIComponent(c.piece)}/uses/${encodeURIComponent(c.emploi)}`
const couche = (c: CheminEmploi, id: string) => `${prefixe(c)}/layers/${encodeURIComponent(id)}`
const json = (method: string, body: unknown) => ({ method, body: JSON.stringify(body) })
export const cleCible = (c: CibleCalque) => `${c.nature}:${c.resultat}:${c.prise}`
export const ETAT_CALQUE: Record<VarianteCalque["etat"], string> = { reference: "Référence", "a-extraire": "À extraire", "a-verifier": "À vérifier", prete: "Vérifié", "a-revoir": "Base à revoir" }

export const apiCalques = {
  cibles: (c: CheminEmploi) => appeler<CiblesEmploi>(`${prefixe(c)}/targets`),
  imageCible: (c: CheminEmploi, cible: CibleCalque) => `/api${prefixe(c)}/targets/preview.png?${new URLSearchParams(cible)}`,
  creer: (c: CheminEmploi, cible: CibleCalque, source: string, role: RoleCalque) => appeler<VarianteCalque>(`${prefixe(c)}/layers`, json("POST", { cible, source, role })),
  lire: (c: CheminEmploi, id: string) => appeler<VarianteCalque>(couche(c, id)),
  regler: (c: CheminEmploi, id: string, revision: number, brouillon: BrouillonCalque) => appeler<VarianteCalque>(couche(c, id), json("PUT", { revision, placement: brouillon.placement, masques: brouillon.masques })),
  extraire: (c: CheminEmploi, id: string, reglage: ExtractionCalque) => appeler<VarianteCalque>(`${couche(c, id)}/extract`, json("POST", { reglage })),
  aligner: (c: CheminEmploi, id: string) => appeler<ExtractionCalque>(`${couche(c, id)}/alignment`),
  valider: (c: CheminEmploi, id: string, revision: number) => appeler<VarianteCalque>(`${couche(c, id)}/validate`, json("POST", { revision })),
  adopter: (c: CheminEmploi, id: string, revision: number, cible: CibleCalque) => appeler<VarianteCalque>(`${couche(c, id)}/adopt`, json("POST", { revision, cible })),
  image: (c: CheminEmploi, v: VarianteCalque, vue = "composition") => `/api${couche(c, v.identifiant)}/preview.png?vue=${vue}&revision=${v.revision}`,
  apercu: async (c: CheminEmploi, id: string, brouillon: BrouillonCalque, signal?: AbortSignal) => {
    const reponse = await fetch(`/api${couche(c, id)}/preview.png`, { ...json("POST", brouillon), headers: { "Content-Type": "application/json" }, signal })
    if (!reponse.ok) { const charge = await reponse.json().catch(() => null); throw new Refus(charge?.raison ?? "L’aperçu du calque n’a pas pu être calculé.", charge?.code ?? "erreur") }
    return reponse.blob()
  },
}
