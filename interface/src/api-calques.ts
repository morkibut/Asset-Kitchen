import { appeler, Refus, type Asset, type EmploiResolu, type Personnage, type Piece, type Trait } from "./api"

export type CheminEmploi = { projet: string; piece: string; emploi: string }
export type CibleCalque = { nature: "image" | "frame"; resultat: string; prise: string }
export type PlacementCalque = { dx: number; dy: number; echelle: number; rotation: number; opacite: number; devant: boolean; ordre: number }
export type MasquesCalque = Record<"calque" | "corps" | "derriere", Trait[]>
export type ExtractionCalque = { dx: number; dy: number; echelle: number; seuil: number }
export type RoleCalque = "reference" | "source-equipee" | "calque"
/** Comment l'image équipée a été lue avant d'être comparée à sa pose
 *  (`atelier/services/calques_cibles.py`, `_preparer_source`). Absente sur une
 *  variante d'avant le 18 septembre 2026 : elle a été lue telle quelle. */
export type PreparationSource = {
  recette: "pose" | "sienne"; echelle: boolean
  depuis: { pose: string; direction: string }
  appliquee: string[]; laissee: string[]
  cadre_source: { largeur: number; hauteur: number }
  facteur?: number; x?: number; y?: number; accord?: number; dehors?: number
  /** Ce qui dépassait du cadre de la pose, en pixels (avant l'agrandissement). */
  debord?: CotesCadre
  /** Le cadre agrandi pour que rien ne soit coupé — l'écrin du personnage. */
  agrandi?: CadreAgrandi
}
export type CotesCadre = { gauche: number; haut: number; droite: number; bas: number }
export type TailleCadre = { largeur: number; hauteur: number }
export type CadreAgrandi = {
  avant: TailleCadre; apres: TailleCadre; cotes: CotesCadre; piece: string
  /** Les autres directions de la même pose, qui suivent. */
  autres_directions: string[]
  /** Les images des autres poses du personnage, qui suivent aussi. */
  autres_images: number
  suivies: { piece: string; emploi: string; variante: string; pose: string; direction: string }[]
}
/** Une variante déjà posée, décalée quand l'écrin a grandi pour une autre image. */
export type CadreSuivi = { cause: { piece: string; pose: string; direction: string }; cotes: CotesCadre; avant: TailleCadre; apres: TailleCadre }
export type VarianteCalque = {
  identifiant: string; cible: CibleCalque; role: RoleCalque; source: string; source_fiche: Asset
  revision: number; placement: PlacementCalque; masques: MasquesCalque; extraction: ExtractionCalque | null
  historique: unknown[]; base: {
    cadre: { largeur: number; hauteur: number }; repere: { x: number; y: number }; pose: string; direction: string
    /** Présents quand le personnage a un écrin : la pose telle que sa recette la rend, et le transparent ajouté autour. */
    cadre_de_la_pose?: TailleCadre; rembourrage?: CotesCadre
  }
  calque_cadre?: { largeur: number; hauteur: number }
  preparation?: PreparationSource
  cadre_suivi?: CadreSuivi
  /** L'image équipée sort d'une fabrication : sa planche revenue peut être relue, sans nouvel appel. */
  planche_d_origine?: boolean
  etat: "reference" | "a-extraire" | "a-verifier" | "prete" | "a-revoir"; raison: string; retenue: boolean; utilisable: boolean
}
/** Une pose du porteur d'après laquelle une image a été fabriquée — relue sur sa génération. */
export type PoseDeReference = { cible: CibleCalque; pose: string; direction: string; raison: string; image: Asset }
export type ImageFabriquee = { image: Asset; deja: boolean }
export type ImageCible = { cible: CibleCalque; pose: string; direction: string; rang?: number; image?: Asset; nom_bande?: string }
export type CiblesEmploi = { piece: Piece; emploi: EmploiResolu; personnage: Personnage; cibles: ImageCible[]; variantes: VarianteCalque[]; images_disponibles: number; calques_retenus: number }
export type BrouillonCalque = { placement: PlacementCalque; masques: MasquesCalque; extraction?: ExtractionCalque; vue?: "composition" | "calque" | "base" | "source" }

const prefixe = (c: CheminEmploi) => `/projects/${encodeURIComponent(c.projet)}/equipment/${encodeURIComponent(c.piece)}/uses/${encodeURIComponent(c.emploi)}`
const couche = (c: CheminEmploi, id: string) => `${prefixe(c)}/layers/${encodeURIComponent(id)}`
const json = (method: string, body: unknown) => ({ method, body: JSON.stringify(body) })
export const cleCible = (c: CibleCalque) => `${c.nature}:${c.resultat}:${c.prise}`
export const ETAT_CALQUE: Record<VarianteCalque["etat"], string> = { reference: "Référence", "a-extraire": "À extraire", "a-verifier": "À vérifier", prete: "Vérifié", "a-revoir": "Base à revoir" }

export const apiCalques = {
  reglerPiece: (projet: string, piece: string, champs: { nom?: string; description?: string; references?: string[] }) => appeler<{ piece: Piece }>(`/characters/pieces/${encodeURIComponent(piece)}`, json("PUT", { ...champs, projet })),
  cibles: (c: CheminEmploi) => appeler<CiblesEmploi>(`${prefixe(c)}/targets`),
  imageCible: (c: CheminEmploi, cible: CibleCalque) => `/api${prefixe(c)}/targets/preview.png?${new URLSearchParams(cible)}`,
  /** `cible` à `null` : la pose de référence de la génération de l'image décide. */
  creer: (c: CheminEmploi, cible: CibleCalque | null, source: string, role: RoleCalque) => appeler<VarianteCalque>(`${prefixe(c)}/layers`, json("POST", { cible, source, role })),
  posesDeReference: (c: CheminEmploi, source: string) => appeler<{ poses: PoseDeReference[] }>(`${prefixe(c)}/targets/references?${new URLSearchParams({ source })}`),
  fabriqueesDApres: (c: CheminEmploi, resultat: string) => appeler<{ images: ImageFabriquee[] }>(`${prefixe(c)}/targets/made-from?${new URLSearchParams({ resultat })}`),
  /** Relire l'image équipée : avec la recette de sa pose ou la sienne, ramenée ou non à l'échelle du corps. */
  reprendreSource: (c: CheminEmploi, id: string, revision: number, recette: PreparationSource["recette"], echelle: boolean) => appeler<VarianteCalque>(`${couche(c, id)}/source`, json("POST", { revision, recette, echelle })),
  /** Relire l'image équipée depuis la case entière de la planche revenue — gratuit, aucun appel au modèle. */
  relireDepuisLaPlanche: (c: CheminEmploi, id: string, revision: number) => appeler<VarianteCalque>(`${couche(c, id)}/source-from-sheet`, json("POST", { revision })),
  lire: (c: CheminEmploi, id: string) => appeler<VarianteCalque>(couche(c, id)),
  regler: (c: CheminEmploi, id: string, revision: number, brouillon: BrouillonCalque) => appeler<VarianteCalque>(couche(c, id), json("PUT", { revision, placement: brouillon.placement, masques: brouillon.masques })),
  extraire: (c: CheminEmploi, id: string, reglage: ExtractionCalque) => appeler<VarianteCalque>(`${couche(c, id)}/extract`, json("POST", { reglage })),
  aligner: (c: CheminEmploi, id: string) => appeler<ExtractionCalque>(`${couche(c, id)}/alignment`),
  valider: (c: CheminEmploi, id: string, revision: number) => appeler<VarianteCalque>(`${couche(c, id)}/validate`, json("POST", { revision })),
  adopter: (c: CheminEmploi, id: string, revision: number, cible: CibleCalque) => appeler<VarianteCalque>(`${couche(c, id)}/adopt`, json("POST", { revision, cible })),
  reutiliser: (c: CheminEmploi, id: string, cibles: CibleCalque[], copier_placement: boolean, copier_masques: boolean) => appeler<VarianteCalque[]>(`${couche(c, id)}/reuse`, json("POST", { cibles, copier_placement, copier_masques })),
  image: (c: CheminEmploi, v: VarianteCalque, vue = "composition") => `/api${couche(c, v.identifiant)}/preview.png?vue=${vue}&revision=${v.revision}`,
  apercu: async (c: CheminEmploi, id: string, brouillon: BrouillonCalque, signal?: AbortSignal) => {
    const reponse = await fetch(`/api${couche(c, id)}/preview.png`, { ...json("POST", brouillon), headers: { "Content-Type": "application/json" }, signal })
    if (!reponse.ok) { const charge = await reponse.json().catch(() => null); throw new Refus(charge?.raison ?? "L’aperçu du calque n’a pas pu être calculé.", charge?.code ?? "erreur") }
    return reponse.blob()
  },
}
