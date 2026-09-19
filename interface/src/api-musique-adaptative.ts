// SN10 · La musique qui s'adapte : un objet qui référence des sons déjà
// faits (famille musique, jingle ou chanson), sans jamais en fabriquer.
// Route serveur : `atelier/api/musique_adaptative.py`.
import { appeler } from "./api"
import type { ApercuLivraison } from "./api"
import type { FamilleSon } from "./api-sons"

export type Depart = "immediat" | "temps_suivant" | "mesure_suivante" | "fin"
export type Arrivee = "meme_position" | "debut" | "position_precedente"
export type Fondu = "aucun" | "entree" | "sortie" | "croise" | "auto"

export type AttributsMusicaux = { tempo: number | null; tonalite: string | null; mesure: number | null; duree: number | null }

export type CoucheAdaptative = {
  cle: string; son: string; volume_db: number
  existe: boolean; nom: string | null; famille: FamilleSon | null; pret: boolean; signal: string
  attributs: AttributsMusicaux
}
export type MorceauAdaptatif = {
  cle: string; son: string; nom: string | null
  existe: boolean; famille: FamilleSon | null; pret: boolean; signal: string
  attributs: AttributsMusicaux
}
export type TransitionAdaptative = {
  de: string; vers: string; depart: Depart; arrivee: Arrivee; fondu: Fondu; fondu_temps: number
}
export type MusiqueAdaptative = {
  identifiant: string; projet: string; nom: string
  couches: CoucheAdaptative[]; morceaux: MorceauAdaptatif[]; transitions: TransitionAdaptative[]
  /** Un tempo, une tonalité, une mesure ou une durée qui diffère d'un son
   *  référencé à l'autre : signalé, jamais bloquant (règle du produit). */
  ecarts: string[]
  livrable: boolean; couches_a_livrer: string[]; morceaux_a_livrer: string[]
  revision: number; cree_le: number; modifie_le?: number
}

export type NouvelleCouche = { cle: string; son: string; volume_db?: number }
export type NouveauMorceau = { cle: string; son: string; nom?: string }
export type NouvelleTransition = { de: string; vers: string; depart?: Depart; arrivee?: Arrivee; fondu?: Fondu; fondu_temps?: number }
export type BrutMusiqueAdaptative = { nom: string; couches?: NouvelleCouche[]; morceaux?: NouveauMorceau[]; transitions?: NouvelleTransition[] }

const base = (p: string) => `/projects/${encodeURIComponent(p)}`
const objet = (p: string, id: string) => `${base(p)}/adaptive-music/${encodeURIComponent(id)}`

export const musiqueAdaptative = {
  lister: (p: string) => appeler<MusiqueAdaptative[]>(`${base(p)}/adaptive-music`),
  lire: (p: string, id: string) => appeler<MusiqueAdaptative>(objet(p, id)),
  creer: (p: string, corps: BrutMusiqueAdaptative) => appeler<MusiqueAdaptative>(`${base(p)}/adaptive-music`, { method: "POST", body: JSON.stringify(corps) }),
  /** Remplace en bloc ce que `corps` porte ; ce qui manque garde sa valeur. */
  modifier: (p: string, id: string, corps: Partial<BrutMusiqueAdaptative>) => appeler<MusiqueAdaptative>(objet(p, id), { method: "PATCH", body: JSON.stringify(corps) }),
  supprimer: (p: string, id: string) => appeler<{ supprime: string }>(objet(p, id), { method: "DELETE" }),
  previsualiserLivraison: (p: string, id: string) => appeler<ApercuLivraison>(`${objet(p, id)}/delivery/preview`, { method: "POST" }),
}
