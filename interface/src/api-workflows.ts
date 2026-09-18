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
/** Un fichier de poids qui manque, tel que l'installation sonore le nomme
 *  (SN1) : jamais proposé puis refusé — son nom en clair, le fichier à poser,
 *  son dossier et sa page de téléchargement. */
export type FichierSonManquant = { nom: string; fichier: string; dossier: string; source: string }
export type DiagnosticWorkflow = {
  disponible: boolean; problemes: string[]; noeuds: { identifiant: string; classe: string; disponible: boolean }[]
  observe_le: number; adresse: string; limite?: string
  /** Les fichiers sonores absents que ce diagnostic a trouvés — vide pour un
   *  workflow qui n'est pas sonore, ou déjà disponible. */
  manque?: FichierSonManquant[]
}
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
/** Ce qu'installer une méthode sonore a trouvé (SN1) : installée et prête, ou
 *  grisée avec chacun de ses fichiers manquants. Rien n'est jamais téléchargé
 *  ici — l'installation ne fait que relire ce que ComfyUI déclare. */
export type ResultatMoteurSon = {
  identifiant: string
  installe: boolean
  manque?: FichierSonManquant[]
  profil?: ProfilWorkflow
}

/** Le moteur sonore par défaut d'une famille (SN2) : celui que l'univers a
 *  posé, sinon le premier moteur installé de la famille — **le même calcul**
 *  que celui qui décide vraiment à l'envoi, jamais une seconde règle côté
 *  écran. `modele` est vide et `raison` porte le texte quand rien n'est
 *  installé. */
export type MoteurParFamille = { famille: string; modele: string | null; moteur: string | null; raison?: string }

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
  /** « Installer les méthodes sonores » (SN1) : retrouve les fichiers déjà
   *  posés et importe chaque profil qui les a tous, sans rien télécharger.
   *  Réinstaller sans changement ne crée pas de nouvelle version. */
  installerSon: (moteurs?: string[]) =>
    appeler<{ moteurs: Record<string, ResultatMoteurSon> }>("/workflow-profiles/install-sound", { method: "POST", body: JSON.stringify({ moteurs }) }),
  moteursParFamille: (projet: string) =>
    appeler<{ familles: Record<string, MoteurParFamille> }>(`/workflow-profiles/sound-defaults?projet=${encodeURIComponent(projet)}`),
}
