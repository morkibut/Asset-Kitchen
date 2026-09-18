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

// ── ML5 · Les styles de sc-clone, groupés par moteur ────────────────────────
//
// « Les 22 styles sont tous proposés, rangés sous leurs quatre moteurs et
// repliés par défaut » (`docs/PLAN-moteurs-locaux.md`, décision 9). Le serveur
// (`GET /workflow-profiles/styles`, `atelier/services/styles_locaux.py`) ne
// rend que la **clé** du moteur (`zimage`, `klein`, `flux1dev`, `sdxl`) : le
// nom à afficher n'a rien à faire côté domaine, et cette liste est fermée —
// elle ne bougera pas au gré d'un style de plus dans le même moteur.

export const NOM_MOTEUR_LOCAL: Record<string, string> = {
  zimage: "Z-Image Turbo",
  klein: "FLUX.2 Klein",
  flux1dev: "FLUX.1-dev",
  sdxl: "SDXL",
}

/** L'ordre d'affichage des quatre moteurs — celui du plan et de `docs/PLAN-moteurs-locaux.md`. */
export const ORDRE_MOTEURS_LOCAUX = ["zimage", "klein", "flux1dev", "sdxl"] as const

/** Ce qu'un style local fait d'une image jointe (ML3) : il *garde le sujet*
 *  (Klein, plusieurs images possibles) ou il *part de l'image* (les trois
 *  autres moteurs, une seule image, force réglable). */
export type GenreReference = "sujet" | "depart"

export const NOM_REFERENCE: Record<GenreReference, string> = {
  sujet: "garde le sujet",
  depart: "part de l’image",
}

/** Un des vingt-deux styles de sc-clone, tel que le catalogue le rend
 *  (`GET /workflow-profiles/styles`). `modele` est l'identifiant qu'il porte
 *  une fois installé (`ComfyUI:<id>@<version>`), `null` tant qu'il ne l'est
 *  pas — même prêt. */
export type StyleLocal = {
  identifiant: string
  nom: string
  famille: string
  genre: string
  vitesse: string
  reference: GenreReference | null
  pret: boolean
  manque: string[]
  modele: string | null
}

export const stylesLocaux = {
  lister: () => appeler<{ styles: StyleLocal[] }>("/workflow-profiles/styles"),
  installer: (identifiant: string) =>
    appeler<ProfilWorkflow>(`/workflow-profiles/styles/${encodeURIComponent(identifiant)}/install`, { method: "POST" }),
  installerPrets: () => appeler<{ installes: ProfilWorkflow[] }>("/workflow-profiles/styles/install", { method: "POST" }),
}

// ── ML3/ML4 · Ce que « Relire avant l’envoi » ajoute pour un style local ────
//
// `api.ts` ne porte pas encore ces champs : ils sont nouveaux (ML3, ML4) et le
// fichier est occupé par un autre travail en cours au moment d'écrire ML5. Les
// types vivent donc ici, et les écrans qui en ont besoin lisent l'objet reçu
// du serveur au travers d'eux plutôt que d'attendre. Rien n'est recalculé :
// ce sont exactement les clés que `atelier/services/envoi.py` et
// `atelier/domaine/texte_local.py` écrivent déjà.

export type SegmentTexteLocal = { clef: string; nom: string; texte: string; origine: string }
export type RetireTexteLocal = { clef: string; nom: string; texte: string; raison: string }

/** Ce qu'un style local annonce **avant de lancer** (règle 8ter, ML5) : un
 *  temps, jamais un prix. `secondes` est la médiane mesurée sur cette
 *  machine, `null` tant qu'aucun tirage n'a réussi ici ; `vitesse` est alors
 *  le repli, la phrase du style sc-clone (« environ 30 secondes par image »).
 *  Les deux peuvent manquer ensemble — un style tout juste installé, jamais
 *  encore lancé, dont la fiche ne porte pas de vitesse propre. */
export type TempsLocal = { secondes: number | null; mesures: number; vitesse: string | null }

/** Ce qu'un style local laisse en route (ML4) — `null` pour tout modèle qui
 *  n'est pas un style local, distant compris. */
export type TexteLocal = {
  famille: string
  texte: string
  segments: SegmentTexteLocal[]
  retires: RetireTexteLocal[]
  jetons: number
  /** La limite de jetons de SDXL (75), `null` pour les moteurs qui n'en ont pas. */
  limite: number | null
  tranche: number | null
  comptage: string
  negatif_lu: boolean
  /** Le temps annoncé pour ce style-ci (ML5) — voir `TempsLocal`. */
  temps: TempsLocal | null
} | null

/** Ce que `envoi.py` (`ServiceEnvoi.envoi`) ajoute à `Envoi` (`api.ts`) pour
 *  ML3/ML4/ML5 — lu par une extension de type, voir plus haut. */
export type EnvoiAvecLocal = {
  local: TexteLocal
  modele: { reference_nom: string | null }
  fond: { negatif_lu: boolean }
}

/** Ce que `Modele` (`api.ts`) porte pour un style local (ML3, ML5) : le genre
 *  de référence qu'il prend, le moteur sous lequel le grouper, si le négatif
 *  est lu, et le temps annoncé (règle 8ter). Absent — donc `undefined` — pour
 *  un modèle distant. */
export type ModeleAvecReference = {
  reference?: GenreReference | null
  famille?: string | null
  negatif_lu?: boolean
  temps?: TempsLocal | null
}
