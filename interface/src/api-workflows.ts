import { appeler, type Option } from "./api"
import type { Travail } from "./api-travaux"

export type LiaisonWorkflow = { noeud: string; champ: string }
export type ParametreWorkflow = Omit<Option, "nom" | "valeurs" | "minimum" | "maximum"> & {
  nom?: string; valeurs?: string[]; minimum?: number | null; maximum?: number | null; defaut: string | number | boolean
  /** Ce que fait le réglage, en une phrase pour l'écran (profils écrits par l'atelier). */
  aide?: string
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
/** `possibles` : les moteurs que l'écran propose pour cette famille — une
 *  proposition, pas une barrière (l'univers accepte tout moteur installé). */
export type MoteurParFamille = { famille: string; modele: string | null; moteur: string | null; raison?: string; possibles?: string[] }

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

// ── ML5 · Les styles de sc-clone, groupés par moteur ────────────────────────
//
// « Les 22 styles sont tous proposés, rangés sous leurs quatre moteurs et
// repliés par défaut » (`docs/PLAN-moteurs-locaux.md`, décision 9). Le serveur
// (`GET /workflow-profiles/styles`, `atelier/services/styles_locaux.py`) ne
// rend que la **clé** du moteur (`zimage`, `klein`, `flux1dev`, `sdxl`) : le
// nom à afficher n'a rien à faire côté domaine, et cette liste est fermée —
// elle ne bougera pas au gré d'un style de plus dans le même moteur.

export const NOM_MOTEUR_LOCAL: Record<string, string> = {
  qwen21: "Qwen-Image 2.1",
  zimage: "Z-Image Turbo",
  klein: "FLUX.2 Klein",
  flux1dev: "FLUX.1-dev",
  sdxl: "SDXL",
}

/** L'ordre d'affichage des moteurs — celui du plan et de `docs/PLAN-moteurs-locaux.md`,
 *  avec Qwen-Image 2.1 en tête depuis le 22/09/2026 : c'est le moteur local principal. */
export const ORDRE_MOTEURS_LOCAUX = ["qwen21", "zimage", "klein", "flux1dev", "sdxl"] as const

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

/** Le temps d'un style local, **arrondi comme on le dirait** : « ≈ 34 secondes
 *  par image », « ≈ 3 minutes par image ». Une médiane au centième se lisait
 *  comme une promesse. */
export function tempsParImage(t: TempsLocal | null | undefined): string | null {
  if (!t) return null
  if (t.secondes == null) return t.vitesse
  const s = Math.max(1, Math.round(t.secondes))
  return s < 90 ? `≈ ${s} secondes par image` : `≈ ${Math.round(s / 60)} minutes par image`
}

/** D'où vient ce temps, en une phrase — la mesure de cette machine, ou la
 *  vitesse relevée dans sc-clone tant qu'aucun tirage n'a eu lieu ici. */
export function origineDuTemps(t: TempsLocal | null | undefined): string {
  if (!t || t.secondes == null) return "Pas encore mesuré sur cette machine : c'est la vitesse relevée dans sc-clone."
  return `Mesuré sur ${t.mesures} tirage${t.mesures > 1 ? "s" : ""} sur cette machine. Le premier tirage d'une série est plus long : il charge le modèle.`
}

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

/** Ce qu'un `Emplacement` (`api.ts`) garde en plus pour une image tirée d'un
 *  style local (défaut 6 de la relecture du 18/09/2026) : la graine tirée
 *  pour cet appel-là, sur `GET /api/generations/{id}` →
 *  `emplacements[].graine`. `api.ts` ne porte pas encore ce champ — lu par une
 *  extension de type, comme les autres ci-dessus. Absent pour un modèle
 *  distant, qui ne la choisit pas de la même façon. Le geste « refaire avec la
 *  même graine » dépend d'un correctif serveur en cours ailleurs : rien ne le
 *  branche ici, on ne fait que la montrer. */
export type EmplacementAvecGraine = { graine?: number | null }

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
