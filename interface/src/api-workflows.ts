import { appeler, type Option } from "./api"
import type { Travail } from "./api-travaux"

export type LiaisonWorkflow = { noeud: string; champ: string }
export type ParametreWorkflow = Omit<Option, "nom" | "valeurs" | "minimum" | "maximum"> & {
  nom?: string; valeurs?: string[]; minimum?: number | null; maximum?: number | null; defaut: string | number | boolean
}
export type ProfilWorkflow = {
  identifiant: string; nom: string; nature: "image" | "video" | "audio"; description?: string
  graphe: Record<string, { class_type: string; inputs: Record<string, unknown> }>
  liaisons: Record<string, LiaisonWorkflow[]>; parametres: Record<string, ParametreWorkflow>
  formats: { resolution: string; proportions: string; largeur: number; hauteur: number }[]
  durees: number[]; cadence: number; pas_images?: number; sortie: { noeud: string; champ: "images" | "gifs" | "videos" | "audio" }
  version: string; modele: string; cree_le: number; references_min: number; references_max: number
  diagnostic?: DiagnosticWorkflow | null
}
export type DiagnosticWorkflow = { disponible: boolean; problemes: string[]; noeuds: { identifiant: string; classe: string; disponible: boolean }[]; observe_le: number; adresse: string; limite?: string }
export type DemandeImageLocale = {
  cle: string; modele: string; prompt: string; prompt_negatif?: string; references?: string[]
  resolution?: string | null; proportions?: string; options?: Record<string, unknown>; repris?: boolean
  personnage?: string | null; pose?: string | null; direction?: string | null
}
export type TravailImageLocale = Omit<Travail, "nature" | "demande" | "annonce" | "objectif"> & {
  nature: "image-locale"; demande: DemandeImageLocale; generation_image: string; assets?: string[]
  annonce: { appels: number; reservation_usd: number; image_usd: number; locale: {
    cout_usd: number; nature: "local"; raison: string
    mesures: { moteur: string; modele: string; temperature: string; mediane_s: number; mesures: number }[]
  } }
}
const profil = (p: string, v: string) => `/workflow-profiles/${encodeURIComponent(p)}/versions/${encodeURIComponent(v)}`
const travail = (p: string, id: string) => `/projects/${encodeURIComponent(p)}/production-jobs/${encodeURIComponent(id)}`
export const workflows = {
  lister: () => appeler<{ profils: ProfilWorkflow[] }>("/workflow-profiles"),
  importer: (contenu: unknown) => appeler<ProfilWorkflow>("/workflow-profiles", { method: "POST", body: JSON.stringify(contenu) }),
  diagnostiquer: (p: string, version: string) => appeler<DiagnosticWorkflow>(`${profil(p, version)}/diagnose`, { method: "POST" }),
  preparerImage: (p: string, demande: DemandeImageLocale) => appeler<TravailImageLocale>(`/projects/${encodeURIComponent(p)}/workflow-image-jobs/prepare`, { method: "POST", body: JSON.stringify(demande) }),
  lireImage: (p: string, id: string) => appeler<TravailImageLocale>(travail(p, id)),
  demarrerImage: (p: string, id: string) => appeler<TravailImageLocale>(`${travail(p, id)}/start`, { method: "POST" }),
  reprendreImage: (p: string, id: string) => appeler<TravailImageLocale>(`${travail(p, id)}/resume`, { method: "POST" }),
}
