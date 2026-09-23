import { appeler, type AttenteVideo, type PrixVideo, type ObjectifProduction } from "./api"
import type { TravailEquipement } from "./api-travaux-equipement"
import type { TravailImageLocale } from "./api-workflows"
import type { TravailVideoLibre } from "./api-video-libre"
import type { Travail3D } from "./api-3d"
import type { TravailAudio } from "./api-travaux-audio"

export type CadreDelegation = {
  autoriser_local: boolean; autoriser_payant: boolean
  modeles_image: string[]; modeles_video: string[]; modeles_3d?: string[]; modeles_audio: string[]
  plafond_appels: number; plafond_usd: number
  /** SN12 : le temps de calcul sonore local autorisé à l'agent, en secondes, cumulé pour ce jeu. */
  plafond_secondes_audio: number
  livraison_provisoire: boolean
  origine?: string
}
export type DemandeTravail = {
  cle: string; personnage: string; pose: string; direction: string
  reference_asset?: string | null; modele_image?: string | null; prompt_image?: string
  references_image?: string[]; references_image_ecartees?: string[]; repris_image?: boolean
  options_image?: Record<string, unknown>; options_video?: Record<string, unknown>
  proportions_image?: string; resolution_image?: string | null; prompt_negatif_image?: string
  modele_video: string; prompt_video: string; secondes: number; resolution: string; proportions: string
  nombre_images: number; cadence: number; sens: "boucle" | "aller-retour"
  livrer_provisoire?: boolean; plafond_image_usd?: number | null
  /** **RV5** : le mouvement choisi dans la bibliothèque — le serveur compose
   *  alors `prompt_video`, qui devient facultatif. `correction_geste` corrige
   *  le geste seul pour cet appel ; la phrase de direction reste celle du
   *  serveur, et vaut donc pour chaque direction d'une série. */
  mouvement?: string | null; correction_geste?: string
  /** Le style de combat **coché pour cet envoi** — jamais d'office : `null`
   *  laisse le texte du mouvement partir seul. Coché, il écrit son texte pour
   *  le mouvement de chaque case (le repos du fusil n'est pas son tir). */
  style_combat?: string | null
}
/** Une case d'une série (RV5) : sa pose et sa direction, le reste vient de la
 *  demande commune. */
export type CaseSerie = { pose: string; direction: string }
/** Ce que rend `preview-series` / `series/{cle}/start` — **avec son
 *  annonce**, pour que la fenêtre n'ait pas à recalculer le prix ou le temps
 *  d'un lot à partir des travaux un par un. */
export type Serie = {
  serie: { cle: string; identifiant: string; total: number }
  travaux: Travail[]
  annonce_serie: { reservation_usd: number; temps_s: number | null; appels: number; locale: boolean }
}
export type Travail = {
  nature?: "animation"
  identifiant: string; projet: string; cle: string; acteur: "auteur" | "agent"
  etat: "prepare" | "en_cours" | "a_reprendre" | "a_verifier" | "externe_inconnu" | "termine" | "annule"
  /** **RV9** : l'étape de la file locale que ce travail a fait tourner, quand
   *  il tourne ou a tourné en local — la liste unique des fabrications l'utilise
   *  pour ne pas montrer deux fois le même calcul (une fois comme travail, une
   *  fois comme ligne de la file locale). */
  etape_locale?: string | null
  etape: string; demande: DemandeTravail; cree_le: number; modifie_le?: number
  reference_asset: string | null; clip: string | null; bandes: string[]
  /** **RV9** : la génération de l'image de départ, quand ce travail en a créé
   *  une — c'est elle que le journal des appels connaît sous son propre
   *  identifiant. Même raison qu'`etape_locale` : ne pas montrer deux fois le
   *  même appel (une fois comme travail, une fois comme ligne de journal). */
  generation_image?: string | null
  references: { asset?: string | null; nom: string; url: string; empreinte: string }[]
  entree_video?: { url: string; empreinte: string }
  envoi_image?: { prompt: string; prompt_negatif?: string; options: Record<string, unknown>; proportions: string; resolution?: string | null }
  objectif: ObjectifProduction
  annonce: { image_usd: number; video: PrixVideo; temps_local: AttenteVideo | null
    reservation_usd: number; appels: number; limite: string; video_locale: boolean }
  consommations: { generation: string; modele: string; consomme: number; unite: string; cout_usd: number }[]
  raison?: string; prochaine_action: string; livraison?: string | null
  /** RV1 : le contrôle d'arrivée qui a rejeté le clip (noire, immobile, vide). */
  controle?: string | null
  /** **RV7** : l'heure du départ, l'étape en un mot et le temps attendu depuis
   *  le départ (`null` : personne ne sait) — calculés au serveur, au même
   *  endroit que pour la case visée (`atelier/services/retours.py`). */
  lance_le?: number; phase?: Phase; attendu_s?: number | null
}
/** **RV7** : ce qu'un travail attend, en un mot. */
export type Phase = "image" | "video" | "decoupage" | "livraison" | "termine"
export const NOM_DE_LA_PHASE: Record<Phase, string> = { image: "Image de départ", video: "Vidéo", decoupage: "Découpage", livraison: "Livraison", termine: "Terminée" }
/** **RV7 — ce qui est parti, rangé par case visée.** La forme est écrite en
 *  tête de `atelier/services/retours.py` ; l'écran la relit, il ne la pousse
 *  jamais. */
export type Retour = {
  nature: "clip" | "image"
  travail: string | null; generation: string | null; serie: string | null
  personnage: string; pose: string; direction: string
  etat: "en_cours" | "ratee" | "interrompue"
  phase: Phase
  lance_le: number; attendu_s: number | null
  raison: string | null; clip: string | null
  demande: DemandeTravail | null
}
export type RetoursParCase = { retours: Retour[]; clips_suivis: string[] }
export type TravailSuivi = Travail | TravailEquipement | TravailImageLocale | TravailVideoLibre | Travail3D | TravailAudio
export type EtatDeTravail = Travail["etat"]

/** Les états, en toutes lettres. Une seule table pour tout le produit — l'écran
 *  des fabrications, la fenêtre d'un travail et le tiroir des brouillons les
 *  écrivent du même mot. */
export const NOM_DE_L_ETAT: Record<EtatDeTravail, string> = { prepare: "Prête à lancer", en_cours: "En cours", a_reprendre: "À reprendre", a_verifier: "À vérifier", externe_inconnu: "État à vérifier chez le fournisseur", termine: "Terminée", annule: "Annulée" }

/** Les étapes, en toutes lettres — *ce qu'un travail attendait* quand il s'est
 *  arrêté. Même raison qu'au-dessus : une seule table. */
export const NOM_DE_L_ETAPE: Record<string, string> = { file_locale: "Calcul local", annule: "Annulée", reference: "Image de départ", reference_soumise: "Fabrication de l’image", video: "Vidéo", video_soumise: "Fabrication du clip", montage: "Extraction des frames", livraison: "Livraison Godot", termine: "Terminée", modele_3d: "Modèle 3D", rig: "Squelette", rendu: "Rendu des sprites" }

/** **Ce que le compteur du carnet compte** (`RP16`) : tout ce qui n'est ni fini
 *  ni annulé, toutes familles confondues — animations, équipements, images
 *  locales, vidéos libres, 3D, sons. Il comptait les seuls emplacements
 *  d'images du chantier de la galerie. */
export const ENCORE_EN_COURS: readonly EtatDeTravail[] = ["prepare", "en_cours", "a_reprendre", "a_verifier", "externe_inconnu"]

/** **Ce qui paraît au tiroir** : ce qui attend un geste de l'auteur. Un travail
 *  `en_cours` tourne — il n'a rien été laissé en plan, et le carnet le compte
 *  déjà. Les quatre autres attendent qu'on revienne. */
export const LAISSE_EN_PLAN: readonly EtatDeTravail[] = ["prepare", "a_reprendre", "a_verifier", "externe_inconnu"]

/** De quoi un travail parle, en une ligne. */
export function nomDuTravail(t: TravailSuivi, sujets: readonly { identifiant: string; nom: string }[]): string {
  const sujet = (identifiant: string) => sujets.find((p) => p.identifiant === identifiant)?.nom ?? identifiant
  if (t.nature === "audio") return `Son · ${t.demande.nom || t.demande.prompt}`
  if (t.nature === "3d") return `3D · ${t.demande.nom || t.demande.personnage || t.modele} · ${t.etape}`
  if (t.nature === "equipement") return `${t.piece_fiche.nom} · ${sujet(t.personnage)} · ${t.annonce.images_ciblees} images équipées`
  if (t.nature === "image-locale") return `Image locale · ${t.demande.prompt}`
  if (t.nature === "video-libre") return `Vidéo libre · ${t.demande.prompt_video}`
  return `${sujet(t.demande.personnage)} · ${t.demande.pose} · ${t.demande.direction || "Sans direction"}`
}

const chemin = (projet: string) => `/projects/${encodeURIComponent(projet)}`
const travail = (projet: string, id: string) => `${chemin(projet)}/production-jobs/${encodeURIComponent(id)}`
export const travaux = {
  cadre: (projet: string) => appeler<CadreDelegation>(`${chemin(projet)}/delegation`),
  reglerCadre: (projet: string, cadre: CadreDelegation) => {
    const { origine: _origine, ...reglages } = cadre
    return appeler<CadreDelegation>(`${chemin(projet)}/delegation`, { method: "PUT", body: JSON.stringify(reglages) })
  },
  lister: (projet: string) => appeler<TravailSuivi[]>(`${chemin(projet)}/production-jobs`),
  /** **RV7** : ce qui est parti pour ce sujet, rangé par case visée. */
  retours: (projet: string, personnage: string) =>
    appeler<RetoursParCase>(`${chemin(projet)}/production-jobs/by-case?personnage=${encodeURIComponent(personnage)}`),
  preparer: (projet: string, demande: DemandeTravail) => appeler<Travail>(`${chemin(projet)}/production-jobs/preview`, { method: "POST", body: JSON.stringify(demande) }),
  /** **RV5** : prépare `cases.length × nombre` travaux d'un coup — une case
   *  vide reprend celle de `commune`. `commune` est une `DemandeTravail` sans
   *  sa case ; le serveur refuse si la clé porte déjà une autre série. */
  preparerSerie: (projet: string, commune: Omit<DemandeTravail, "pose" | "direction">, cases: CaseSerie[], nombre: number) =>
    appeler<Serie>(`${chemin(projet)}/production-jobs/preview-series`, { method: "POST", body: JSON.stringify({ ...commune, cases, nombre }) }),
  demarrerSerie: (projet: string, cle: string) => appeler<Serie>(`${chemin(projet)}/production-jobs/series/${encodeURIComponent(cle)}/start`, { method: "POST" }),
  lire: (projet: string, id: string) => appeler<Travail>(travail(projet, id)),
  lireSuivi: (projet: string, id: string) => appeler<TravailSuivi>(travail(projet, id)),
  demarrer: (projet: string, id: string) => appeler<Travail>(`${travail(projet, id)}/start`, { method: "POST" }),
  reprendre: (projet: string, id: string) => appeler<Travail>(`${travail(projet, id)}/resume`, { method: "POST" }),
}
