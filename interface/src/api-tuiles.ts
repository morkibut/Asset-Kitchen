import { appeler, type Asset, type ApercuLivraison } from "./api"
import type { CarteServeur, Recette } from "./tuiles/atelier"

export const RACCORDS = ["nord", "nord-est", "est", "sud-est", "sud", "sud-ouest", "ouest", "nord-ouest"] as const
export type Raccord = typeof RACCORDS[number]
export type TerrainTuile = { identifiant: string; nom: string; couleur: string }
export type CelluleTuile = { x: number; y: number; nom: string; retenue: boolean; terrain: string | null; raccords: Record<Raccord, string | null>; correction: string | null }
export type CarteTuiles = { largeur: number; hauteur: number; cases: { x: number; y: number; tuile_x: number; tuile_y: number }[] }
export type ReglesTuiles = { nom: string; terrains: TerrainTuile[]; cellules: CelluleTuile[]; carte: CarteTuiles }
export type EnsembleTuiles = ReglesTuiles & {
  identifiant: string; projet: string; personnage: string | null; revision: number; historique: number[]
  grille: { taille: number; marge: number; espacement: number; colonnes: number; lignes: number }
  source: { asset: string; empreinte: string; dimensions: { largeur: number; hauteur: number }; provenance: unknown }
  corrections: Record<string, { asset: string; empreinte: string }>; retenues: number; atlas_url: string; carte_url: string
  diagnostic: { pret: boolean; problemes: string[]; raccords: { x: number; y: number; vers: string; raison: string }[]; limite: string }
  /** Un jeu **fabriqué** (TU2) garde sa recette ; un jeu fait à partir d'une image n'en a pas. */
  recette?: Recette | null
  /** Qui l'a demandé (TU10) : « agent » pour un jeu créé par les outils MCP, « auteur »
   *  sinon — le serveur le complète toujours, y compris pour un ensemble d'avant TU10. */
  origine?: "agent" | "auteur"
}
/** Ce qui part quand on enregistre un jeu fabriqué : la recette, l'atlas qu'elle a
 *  rendu (PNG en base64) et la carte peinte. */
export type EnvoiFabrique = { nom: string; recette: Recette; atlas: string; carte: CarteServeur }
const racine = (p: string) => `/projects/${encodeURIComponent(p)}/tilesets`
const chemin = (p: string, id: string) => `${racine(p)}/${encodeURIComponent(id)}`

// ── TU5 : les matières générées sur la machine ───────────────────────────────

/** Un cadrage possible pour une matière, tel que le serveur les rend
 *  (`atelier/domaine/texte_matiere.py`, `LISTE_CADRAGES`). */
export type Cadrage = { id: string; nom: string; aide: string }
export type ApercuMatiere = { texte: string; negatif: string; taille: number; cadrages: Cadrage[] }
export type DisponibiliteMatieres = { disponible: boolean; manque: string[]; modele: string | null }
export type ResultatEmplacement = { fichier: string; largeur: number; hauteur: number; type_media: string; octets: number }
export type EmplacementMatiere = { rang: number; statut: string; resultat: ResultatEmplacement | null; raison: string | null }
/** Une matière en cours de fabrication : la forme renvoyée par `POST …/generate`
 *  (`Generation.en_json()`, TU2), réduite à ce que cet onglet lit. Chaque
 *  génération n'a qu'un seul emplacement (`rang=0`, `soumettre_matiere`) : son
 *  asset, une fois arrivé, porte l'identifiant `${identifiant}-0`
 *  (`atelier.domaine.asset.identifiant_de`). */
export type GenerationMatiere = { identifiant: string; statut: string; emplacements: EmplacementMatiere[] }

const racineMatieres = (p: string) => `/projects/${encodeURIComponent(p)}/materials`
/** L'identifiant de l'asset qu'une génération de matière rendra — avant même
 *  qu'elle soit terminée, pour pouvoir le retrouver dans la bibliothèque dès
 *  que son emplacement passe à « reussie ». */
export const assetDeGeneration = (g: Pick<GenerationMatiere, "identifiant">, rang = 0) => `${g.identifiant}-${rang}`
export const matieres = {
  disponibilite: (p: string) => appeler<DisponibiliteMatieres>(`${racineMatieres(p)}/availability`),
  apercu: (p: string, r: { pierre: string; motif: string; cadrage: string }) =>
    appeler<ApercuMatiere>(`${racineMatieres(p)}/preview`, { method: "POST", body: JSON.stringify(r) }),
  generer: (p: string, r: { pierre: string; motif: string; cadrage: string; tirages: number; graine?: number }) =>
    appeler<{ generations: GenerationMatiere[] }>(`${racineMatieres(p)}/generate`, { method: "POST", body: JSON.stringify(r) }),
}
export const reglesTuiles = (e: EnsembleTuiles): ReglesTuiles => ({ nom: e.nom, terrains: e.terrains, cellules: e.cellules, carte: e.carte })
export const tuiles = {
  lister: (p: string) => appeler<EnsembleTuiles[]>(racine(p)),
  lire: (p: string, id: string, revision?: number) => appeler<EnsembleTuiles>(chemin(p, id)+(revision ? `?revision=${revision}` : "")),
  creer: (p: string, r: { nom: string; image: string; grille: { taille: number; marge: number; espacement: number } }) => appeler<EnsembleTuiles>(racine(p), { method: "POST", body: JSON.stringify(r) }),
  garder: (p: string, id: string, revision: number, regles: ReglesTuiles, actualiser_source = false) => appeler<EnsembleTuiles>(chemin(p, id), { method: "PUT", body: JSON.stringify({ revision, regles, actualiser_source }) }),
  creerFabrique: (p: string, envoi: EnvoiFabrique) => appeler<EnsembleTuiles>(racine(p), { method: "POST", body: JSON.stringify(envoi) }),
  /** La recette et l'atlas ne partent que s'ils ont changé : chaque atlas envoyé entre
   *  en bibliothèque, et renommer un jeu ne doit pas en ajouter un. */
  garderFabrique: (p: string, id: string, revision: number, { nom, carte, recette, atlas }: Pick<EnvoiFabrique, "nom" | "carte"> & Partial<Pick<EnvoiFabrique, "recette" | "atlas">>) =>
    appeler<EnsembleTuiles>(chemin(p, id), { method: "PUT", body: JSON.stringify({ revision, regles: { nom, carte }, ...(recette ? { recette, atlas } : {}) }) }),
  restaurer: (p: string, id: string, revision: number, depuis: number) => appeler<EnsembleTuiles>(chemin(p, id)+"/restore", { method: "POST", body: JSON.stringify({ revision, depuis }) }),
  extraire: (p: string, id: string, x: number, y: number, revision: number) => appeler<{ asset: Asset }>(`${chemin(p, id)}/tiles/${x}/${y}/extract`, { method: "POST", body: JSON.stringify({ revision }) }),
  prevoir: (p: string, id: string, revision: number) => appeler<ApercuLivraison>(chemin(p, id)+"/delivery/preview", { method: "POST", body: JSON.stringify({ revision }) }),
  archive: (p: string, id: string, revision: number) => `/api${chemin(p, id)}/export.zip?revision=${revision}`,
}
