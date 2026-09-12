import { appeler, type ApercuLivraison } from "./api"
import type { CibleCalque, PlacementCalque, MasquesCalque } from "./api-calques"

export type ChoixEmploiTenue = { piece: string; emploi: string; actif: boolean; priorite: number; nom?: string }
export type DemandeTenue = { nom: string; emplois: ChoixEmploiTenue[]; resultats: { nature: "image" | "animation"; identifiant: string; boucle?: boolean }[]; pivot?: { x: number; y: number } | null; choix?: Record<string, Record<string, string>> }
export type CalqueTenue = { piece: string; emploi: string; variante: string | null; revision?: number; placement?: PlacementCalque; masques?: MasquesCalque; raison: string; a_revoir?: string }
export type FrameTenue = { cle: string; cible: CibleCalque; base: { cadre: { largeur: number; hauteur: number }; repere: { x: number; y: number } }; calques: CalqueTenue[]; a_revoir?: string }
export type SortieTenue = { cle: string; resultat: string; nature: "image" | "animation"; titre: string; pose: string; direction: string; cadence: number; sens: string; boucle: boolean; ordre: number[]; frames: FrameTenue[]; a_revoir?: string }
export type Tenue = { identifiant: string; projet: string; personnage: string; nom: string; revision: number; revisions: number[]; cree_le: number; modifie_le: number; pivot: { x: number; y: number }; demande: DemandeTenue; emplois: ChoixEmploiTenue[]; sorties: SortieTenue[]; couverture: { images: number; prete: boolean; toutes_couches_pretes: boolean; difficultes: { sortie: string; frame: number; piece: string | null; raison: string }[] } }
export const cheminTenue = (projet: string, personnage: string, id?: string) => `/projects/${encodeURIComponent(projet)}/characters/${encodeURIComponent(personnage)}/outfits${id ? `/${encodeURIComponent(id)}` : ""}`
export const tenues = {
  lister: (p: string, c: string) => appeler<Tenue[]>(cheminTenue(p, c)),
  creer: (p: string, c: string, demande: DemandeTenue) => appeler<Tenue>(cheminTenue(p, c), { method: "POST", body: JSON.stringify(demande) }),
  lire: (p: string, c: string, id: string, revision?: number) => appeler<Tenue>(cheminTenue(p, c, id) + (revision ? `?revision=${revision}` : "")),
  regler: (t: Tenue, demande: DemandeTenue) => appeler<Tenue>(cheminTenue(t.projet, t.personnage, t.identifiant), { method: "PUT", body: JSON.stringify({ ...demande, revision: t.revision }) }),
  actualiser: (t: Tenue) => appeler<Tenue>(cheminTenue(t.projet, t.personnage, t.identifiant) + "/refresh", { method: "POST", body: JSON.stringify({ revision: t.revision }) }),
  restaurer: (t: Tenue) => appeler<Tenue>(cheminTenue(t.projet, t.personnage, t.identifiant) + "/restore", { method: "POST", body: JSON.stringify({ revision: Math.max(...t.revisions), depuis: t.revision }) }),
  image: (t: Tenue, sortie: string, frame: number, actifs: string[], priorites?: Record<string, number>) => "/api" + cheminTenue(t.projet, t.personnage, t.identifiant) + "/preview.png?" + new URLSearchParams({ sortie, frame: String(frame), actifs: JSON.stringify(actifs), revision: String(t.revision), ...(priorites ? { priorites: JSON.stringify(priorites) } : {}) }),
  archive: (t: Tenue, mode: "couches" | "assemble") => "/api" + cheminTenue(t.projet, t.personnage, t.identifiant) + `/export.zip?mode=${mode}&revision=${t.revision}`,
  livraison: (t: Tenue, mode: "couches" | "assemble") => appeler<ApercuLivraison>(cheminTenue(t.projet, t.personnage, t.identifiant) + "/delivery/preview", { method: "POST", body: JSON.stringify({ mode, revision: t.revision }) }),
}
