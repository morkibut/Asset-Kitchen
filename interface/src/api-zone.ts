// PX3 · Repeindre une zone — les routes de la fabrique « Repeindre ».
//
// Rien n'est recalculé ici : ce sont exactement les clés que
// `atelier/services/zone.py` (`ServiceZone`) écrit. Le temps annoncé reprend le
// type des styles locaux (`TempsLocal`, `api-workflows.ts`) : c'est la même
// mesure (`ServiceGenerations.temps_attendu`), lue au même endroit.

import { appeler, type Asset, type Trait } from "./api"
import type { TempsLocal } from "./api-workflows"

/** L'outil local qui sait repeindre une zone, tel que l'installation le voit. */
export type OutilDeZone = {
  identifiant: string
  nom: string
  pret: boolean
  manque: string[]
  /** Le modèle installé, ou `null` tant que l'outil ne l'est pas. */
  modele: string | null
  vitesse: string | null
}

/** Ce que la génération dit être parti — enregistré, jamais recomposé. */
export type PartiDeLaZone = { texte: string; negatif: string } | null

export type MesuresDeLaZone = {
  pixels_hors_zone: number
  pixels_du_sujet_perdus: number
  pixels_changes: number
  pixels_de_la_zone: number
  /** PX9 : tout ce que le moteur a peint dans la zone — la pièce. */
  pixels_de_la_piece?: number
  couleurs_neuves: number
}

/** PX9 : ce que le résultat est devenu — dérivé sur le serveur, jamais rangé. */
export type StatutDuResultat = "a_decider" | "equipement"

/** L'équipement que le résultat est devenu. */
export type EquipementDuResultat = { identifiant: string; nom: string; emplacement: string; porteur: string | null }

/** Un calque repeint, de quoi le rouvrir tel qu'il a été demandé. */
export type CalqueRepeint = {
  identifiant: string
  empreinte: string | null
  label: string
  image: string
  texte: string
  zone: Trait[]
  /** La main de C4 posée depuis — ce qu'elle ôte, et ce qu'elle tranche ou ramène. */
  affinage: Trait[]
  retouche: Trait[]
  couleurs: number
  fond: string
  modele: string
  rendu_largeur: number
  rendu_hauteur: number
  cree_le: number
  generation: string | null
  graine: number | null
  force: number | null
  parti: PartiDeLaZone
  mesures: MesuresDeLaZone | null
  /** PX9 : à décider, ou déjà un équipement. */
  statut: StatutDuResultat
  equipement: EquipementDuResultat | null
  /** L'emplacement proposé d'après la zone (« le dos »), tant qu'on n'a pas décidé. */
  emplacement_propose: string | null
}

/** PX7 : un modèle qui sait repeindre une zone, grisé ou non. */
export type ModeleDeZone = {
  identifiant: string
  nom: string
  famille: string | null
  /** Pourquoi il est grisé — `null` quand il est prêt. */
  raison: string | null
  /** Le temps de **ce** modèle-là — le bouton suit celui qu'on a choisi. */
  temps: TempsLocal | null
}

export type EtatDeLaZone = {
  image: string
  modele: { identifiant: string; nom: string } | null
  /** Pourquoi on ne peut pas repeindre — `null` quand on peut. */
  raison: string | null
  outil: OutilDeZone
  /** PX7 : un outil par famille de moteur local, prêt ou non. */
  outils: OutilDeZone[]
  /** PX7 : tous les modèles capables, grisés ou non — c'est parmi eux qu'on choisit. */
  modeles: ModeleDeZone[]
  temps: TempsLocal | null
  force: { minimum: number; maximum: number; defaut: number } | null
  couleurs: { defaut: number; maximum: number }
  calques: CalqueRepeint[]
  /** PX9 : à qui l'image appartient — les décisions disent ce qu'elles font. */
  sujet: { identifiant: string; nom: string; porte: boolean } | null
  pose: { identifiant: string; nom: string } | null
  direction: string | null
  /** Les emplacements du jeu, pour nommer celui de l'équipement. */
  emplacements: string[]
  /** Pourquoi on ne peut pas en faire un équipement — `null` quand on peut. */
  raison_equipement: string | null
}

/** PX9 : les trois décisions. */
export type Decision = "version" | "equipement" | "jeter"

export type RenduDeLaDecision = {
  decision: Decision
  image?: string
  /** `version` : l'image neuve, rangée dans la pose. */
  asset?: Asset
  /** `equipement` : la pièce, et le calque devenu le sien. */
  equipement?: { identifiant: string; nom: string; emploi: string }
  calque?: CalqueRepeint
}

export type ResultatDeLaZone = {
  generation: string
  statut: "en_attente" | "en_cours" | "reussie" | "echouee" | "interrompue"
  raison: string | null
  calque: CalqueRepeint | null
  graine: number | null
  force: number | null
  parti: PartiDeLaZone
}

export type DemandeDeZone = {
  texte: string
  zone: Trait[]
  graine?: number | null
  force?: number | null
  couleurs?: number
  /** PX7 : le modèle choisi, ou rien pour le défaut du catalogue. */
  modele?: string | null
}

export const zone = {
  etat: (image: string) => appeler<EtatDeLaZone>(`/assets/${encodeURIComponent(image)}/zone`),
  cequiPart: (image: string, texte: string, modele?: string | null) =>
    appeler<{ texte: string; negatif: string; fond: string }>(`/assets/${encodeURIComponent(image)}/zone/preview`, {
      method: "POST",
      body: JSON.stringify({ texte, modele: modele ?? null }),
    }),
  lancer: (image: string, demande: DemandeDeZone) =>
    appeler<ResultatDeLaZone>(`/assets/${encodeURIComponent(image)}/zone`, {
      method: "POST",
      body: JSON.stringify(demande),
    }),
  resultat: (generation: string) => appeler<ResultatDeLaZone>(`/zone/${encodeURIComponent(generation)}`),
  /** PX9 : en faire une nouvelle version de la pose, un équipement du sujet, ou le jeter. */
  decider: (resultat: string, decision: Decision, champs: { nom?: string; emplacement?: string } = {}) =>
    appeler<RenduDeLaDecision>(`/zone/results/${encodeURIComponent(resultat)}/decision`, {
      method: "POST",
      body: JSON.stringify({ decision, ...champs }),
    }),
}

export const TERMINES: readonly ResultatDeLaZone["statut"][] = ["reussie", "echouee", "interrompue"]
