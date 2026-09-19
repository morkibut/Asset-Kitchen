// Les sons d'un sujet (SN6) : ses emplacements, ce qui les remplit, et une
// série lancée depuis l'un d'eux. Les routes : `atelier/api/sons_du_sujet.py`.
import { appeler } from "./api"
import type { DemandeSon, FamilleSon, JeuVariantes, SerieSon } from "./api-series-son"

export type ContenuEmplacement = {
  nature: "jeu" | "son"; identifiant: string; existe: boolean; nom: string | null; famille: FamilleSon | null
  sons: string[]; a_livrer: string[]; signalements: { son: string | null; statut: string; signal: string }[]; revision?: number | null
}
export type Emplacement = {
  cle: string; nom: string; famille: FamilleSon; indice: string | null; libre: boolean; propose: boolean
  contenu: ContenuEmplacement | null; rempli: boolean; nom_stable: string
  series: string[]; derniere_serie: string | null; pose_le: number | null
  /** Interface et rétro : sfxr, sans texte ni série (SN8). */
  par_sfxr: boolean
}
export type SonsDuSujet = {
  projet: string; sujet: { identifiant: string; nom: string; famille: string; description: string }
  emplacements: Emplacement[]; remplis: number; total: number; revision: number
}
/** La demande proposée depuis un emplacement : rien n'est écrit, elle se relit à l'écran. */
export type Proposition = {
  famille: FamilleSon; prompt: string; nombre: number; nom: string
  morceaux: { texte: string; source: "emplacement" | "sujet" }[]
  emplacement: { sujet: string; cle: string; nom: string }; par_sfxr: boolean
}
/** Un emplacement rempli, vu depuis tout le jeu (galerie, « Livrer au jeu »). */
export type LigneIndex = {
  sujet: string; nom_sujet: string; cle: string; nom: string; famille: FamilleSon; nom_stable: string
  contenu: { nature: "jeu" | "son"; identifiant: string; nom: string | null; sons: string[] }
}

const base = (p: string) => `/projects/${encodeURIComponent(p)}`
const sujet = (p: string, s: string) => `${base(p)}/subjects/${encodeURIComponent(s)}/sounds`
const place = (p: string, s: string, cle: string) => `${sujet(p, s)}/${encodeURIComponent(cle)}`
const poster = (corps: unknown) => ({ method: "POST", body: JSON.stringify(corps) })

export const sonsDuSujet = {
  lire: (p: string, s: string) => appeler<SonsDuSujet>(sujet(p, s)),
  index: (p: string) => appeler<LigneIndex[]>(`${base(p)}/subject-sounds`),
  ajouter: (p: string, s: string, corps: { nom: string; famille: FamilleSon }) => appeler<SonsDuSujet>(sujet(p, s), poster(corps)),
  retirer: (p: string, s: string, cle: string) => appeler<SonsDuSujet>(place(p, s, cle), { method: "DELETE" }),
  poser: (p: string, s: string, cle: string, corps: { jeu: string } | { son: string }) => appeler<Emplacement>(place(p, s, cle), { method: "PUT", body: JSON.stringify(corps) }),
  vider: (p: string, s: string, cle: string) => appeler<Emplacement>(`${place(p, s, cle)}/content`, { method: "DELETE" }),
  proposer: (p: string, s: string, cle: string) => appeler<Proposition>(`${place(p, s, cle)}/series/propose`, { method: "POST" }),
  /** Prépare la série liée à l'emplacement (rien n'est lancé) : « Garder » y range dans son jeu. */
  preparer: (p: string, s: string, cle: string, d: DemandeSon & { nombre: number; nom?: string }) => appeler<SerieSon>(`${place(p, s, cle)}/series`, poster(d)),
}

export type { JeuVariantes }
