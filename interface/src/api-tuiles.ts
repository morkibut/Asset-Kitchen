import { appeler, type Asset, type ApercuLivraison } from "./api"

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
}
const racine = (p: string) => `/projects/${encodeURIComponent(p)}/tilesets`
const chemin = (p: string, id: string) => `${racine(p)}/${encodeURIComponent(id)}`
export const reglesTuiles = (e: EnsembleTuiles): ReglesTuiles => ({ nom: e.nom, terrains: e.terrains, cellules: e.cellules, carte: e.carte })
export const tuiles = {
  lister: (p: string) => appeler<EnsembleTuiles[]>(racine(p)),
  lire: (p: string, id: string, revision?: number) => appeler<EnsembleTuiles>(chemin(p, id)+(revision ? `?revision=${revision}` : "")),
  creer: (p: string, r: { nom: string; image: string; grille: { taille: number; marge: number; espacement: number } }) => appeler<EnsembleTuiles>(racine(p), { method: "POST", body: JSON.stringify(r) }),
  garder: (p: string, id: string, revision: number, regles: ReglesTuiles, actualiser_source = false) => appeler<EnsembleTuiles>(chemin(p, id), { method: "PUT", body: JSON.stringify({ revision, regles, actualiser_source }) }),
  restaurer: (p: string, id: string, revision: number, depuis: number) => appeler<EnsembleTuiles>(chemin(p, id)+"/restore", { method: "POST", body: JSON.stringify({ revision, depuis }) }),
  extraire: (p: string, id: string, x: number, y: number, revision: number) => appeler<{ asset: Asset }>(`${chemin(p, id)}/tiles/${x}/${y}/extract`, { method: "POST", body: JSON.stringify({ revision }) }),
  prevoir: (p: string, id: string, revision: number) => appeler<ApercuLivraison>(chemin(p, id)+"/delivery/preview", { method: "POST", body: JSON.stringify({ revision }) }),
  archive: (p: string, id: string, revision: number) => `/api${chemin(p, id)}/export.zip?revision=${revision}`,
}
